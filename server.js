'use strict';
require('dotenv').config();
const express   = require('express');
const session   = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { Pool }  = require('pg');
const bcrypt    = require('bcryptjs');
const crypto    = require('crypto');
const path      = require('path');

const PORT    = parseInt(process.env.PORT || '3000');
const SECRET  = process.env.SESSION_SECRET || 'bitte-aendern-' + crypto.randomBytes(16).toString('hex');
const DB_URL  = process.env.DATABASE_URL;
const IS_PROD = process.env.NODE_ENV === 'production';

if (!DB_URL) { console.error('❌ DATABASE_URL fehlt!'); process.exit(1); }
if (SECRET.startsWith('bitte-aendern-')) console.warn('⚠️  SESSION_SECRET nicht gesetzt!');

const pool = new Pool({ connectionString: DB_URL, ssl: IS_PROD ? { rejectUnauthorized: false } : false, max: 10, idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000 });
const q  = (sql, p) => pool.query(sql, p).then(r => r.rows);
const q1 = (sql, p) => pool.query(sql, p).then(r => r.rows[0] || null);
const newId = () => crypto.randomUUID();
const parseRoles = r => Array.isArray(r) ? r : (r ? (typeof r === 'string' ? JSON.parse(r) : r) : ['standard']);
const parseTags  = t => Array.isArray(t) ? t : (t ? (typeof t === 'string' ? JSON.parse(t) : t) : []);

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, initials TEXT NOT NULL,
      roles JSONB NOT NULL DEFAULT '["standard"]', color TEXT NOT NULL DEFAULT '#3b6dd4',
      pw_hash TEXT NOT NULL, must_change_pw BOOLEAN NOT NULL DEFAULT true,
      last_seen TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY, label TEXT NOT NULL, emoji TEXT NOT NULL DEFAULT '📌',
      color TEXT NOT NULL DEFAULT '#64748b', sort_order INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY, label TEXT NOT NULL, color TEXT NOT NULL DEFAULT '#3b6dd4'
    );
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY, is_general BOOLEAN NOT NULL DEFAULT false,
      date_from TEXT NOT NULL, date_to TEXT NOT NULL,
      time_from TEXT DEFAULT '', time_to TEXT DEFAULT '',
      user_id TEXT, category TEXT, reason TEXT NOT NULL,
      approved TEXT DEFAULT 'pending',
      created_by TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY, number TEXT NOT NULL UNIQUE, title TEXT NOT NULL,
      description TEXT DEFAULT '', department TEXT NOT NULL,
      tags JSONB NOT NULL DEFAULT '[]', priority TEXT NOT NULL DEFAULT 'medium',
      status TEXT NOT NULL DEFAULT 'open', bucket TEXT DEFAULT '',
      is_public BOOLEAN NOT NULL DEFAULT false, assignee_id TEXT,
      parent_ticket_id TEXT, created_by TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS ticket_notes (
      id TEXT PRIMARY KEY, ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      text TEXT NOT NULL, author_id TEXT, is_system BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS allowances (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, year INTEGER NOT NULL, month INTEGER NOT NULL,
      nd INTEGER DEFAULT 0, fd INTEGER DEFAULT 0, fw INTEGER DEFAULT 0, c10 INTEGER DEFAULT 0,
      UNIQUE(user_id, year, month)
    );
    CREATE TABLE IF NOT EXISTS activity_log (
      id TEXT PRIMARY KEY, user_id TEXT, user_name TEXT, action TEXT NOT NULL,
      details JSONB DEFAULT '{}', ip TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS checklist_templates (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, department TEXT NOT NULL,
      created_by TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS checklist_template_items (
      id TEXT PRIMARY KEY, template_id TEXT NOT NULL REFERENCES checklist_templates(id) ON DELETE CASCADE,
      text TEXT NOT NULL, sort_order INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS ticket_checklists (
      id TEXT PRIMARY KEY, ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      template_id TEXT REFERENCES checklist_templates(id),
      name TEXT NOT NULL, created_by TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS ticket_checklist_items (
      id TEXT PRIMARY KEY, checklist_id TEXT NOT NULL REFERENCES ticket_checklists(id) ON DELETE CASCADE,
      text TEXT NOT NULL, checked BOOLEAN DEFAULT false, checked_by TEXT,
      checked_at TIMESTAMPTZ, sort_order INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY, from_user_id TEXT NOT NULL, to_department TEXT,
      title TEXT NOT NULL, body TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS message_acks (
      id TEXT PRIMARY KEY, message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL, acked_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(message_id, user_id)
    );
  `);

  // Migrations for existing tables
  for (const m of [
    `ALTER TABLE events ADD COLUMN IF NOT EXISTS approved TEXT DEFAULT 'pending'`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ`,
    `ALTER TABLE ticket_notes ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT false`,
  ]) await pool.query(m).catch(() => {});

  // Make ticket_notes.author_id nullable
  await pool.query(`ALTER TABLE ticket_notes ALTER COLUMN author_id DROP NOT NULL`).catch(() => {});

  // Seed
  const cnt = await q1('SELECT COUNT(*) as n FROM users');
  if (parseInt(cnt.n) === 0) {
    const hash = await bcrypt.hash('Passwort1', 10);
    const [u1,u2,u3] = [newId(),newId(),newId()];
    await pool.query(`INSERT INTO users (id,name,initials,roles,color,pw_hash,must_change_pw) VALUES
      ($1,'Administrator','AD','["admin"]','#3b6dd4',$4,false),
      ($2,'Dienstplanung','DP','["dienstplanung"]','#10b981',$4,false),
      ($3,'Beispiel Mitarbeiter','BM','["standard"]','#e87bb0',$4,true)`,[u1,u2,u3,hash]);
    for (const [e,l,c,i] of [
      ['📚','Ausbildung','#10b981',0],['🎓','Kurs / Schulung','#3b6dd4',1],
      ['🎂','Geburtstag','#e87bb0',2],['📝','Dienstwunsch','#7c3aed',3],
      ['🌴','Urlaub','#f59e0b',4],['🏥','Krankenstand','#ef4444',5],['📌','Sonstiges','#64748b',6],
    ]) await pool.query('INSERT INTO categories (id,label,emoji,color,sort_order) VALUES ($1,$2,$3,$4,$5)',[newId(),l,e,c,i]);
    for (const [l,c] of [['Bug','#ef4444'],['Feature','#3b6dd4'],['Dringend','#f59e0b'],['Frage','#10b981']])
      await pool.query('INSERT INTO tags (id,label,color) VALUES ($1,$2,$3)',[newId(),l,c]);
    console.log('✓ DB initialisiert – Administrator / Passwort1');
  }
}

// ── PERMISSIONS ──
const DEPTS = ['technik','leitung','dienstplanung','ausbildung','qm'];
async function getUser(id) { return q1('SELECT * FROM users WHERE id=$1',[id]); }

async function getP(uid) {
  const u = await getUser(uid);
  const roles = parseRoles(u?.roles);
  const has = (...r) => r.some(x => roles.includes(x));
  const full = has('admin','leitung','dienstplanung');
  return {
    isAdmin: has('admin'), manageUsers: has('admin'), isDP: has('admin','leitung','dienstplanung'),
    seeAllEntries: has('admin','leitung','dienstplanung','ausbildung','qm'),
    othersBlurred: !full && has('ausbildung','qm'),
    editAllPersonal: full, addForOthers: has('admin','leitung','dienstplanung','ausbildung','qm'),
    addGeneral: has('admin','leitung','dienstplanung','technik','ausbildung','qm'),
    manageGeneral: has('admin','leitung','dienstplanung','technik','ausbildung','qm'),
    seeAllAllw: full, editAllw: full,
    canApproveEvents: has('admin','leitung','dienstplanung'), roles,
  };
}

async function getTP(uid) {
  const u = await getUser(uid);
  const roles = parseRoles(u?.roles);
  const has = (...r) => r.some(x => roles.includes(x));
  const myDepts = DEPTS.filter(d => roles.includes(d));
  return {
    seeAll: has('admin','leitung'), editAll: has('admin','leitung'),
    myDepts, canSetPublic: !has('standard'), canAssign: !has('standard'),
    isStandard: has('standard') && myDepts.length === 0, roles,
  };
}

const canSeeTk = (tp, tk, uid) => tp.seeAll || tk.is_public || tk.created_by === uid || tp.myDepts.includes(tk.department);
const canEditTk = (tp, tk, uid) => tp.editAll || tk.created_by === uid || tp.myDepts.includes(tk.department);

async function nextTicketNumber() {
  const row = await q1(`SELECT number FROM tickets ORDER BY CAST(REPLACE(number,'TK-','') AS INTEGER) DESC LIMIT 1`);
  if (!row) return 'TK-1001';
  return `TK-${(parseInt(row.number.replace('TK-',''))+1).toString().padStart(4,'0')}`;
}

async function logActivity(uid, userName, action, details={}, ip=null) {
  await pool.query('INSERT INTO activity_log (id,user_id,user_name,action,details,ip) VALUES ($1,$2,$3,$4,$5,$6)',
    [newId(),uid,userName,action,JSON.stringify(details),ip]).catch(()=>{});
}

async function addSystemNote(ticketId, text) {
  await pool.query('INSERT INTO ticket_notes (id,ticket_id,text,author_id,is_system,created_at) VALUES ($1,$2,$3,NULL,true,NOW())',
    [newId(),ticketId,text]).catch(()=>{});
}

// ── APP ──
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname,'public')));
app.set('trust proxy', 1);
app.use(session({
  store: new pgSession({ pool, tableName: 'sessions', createTableIfMissing: true }),
  secret: SECRET, resave: false, saveUninitialized: false, name: 'lst.sid',
  cookie: { httpOnly: true, secure: IS_PROD, sameSite: 'lax', maxAge: 10*60*60*1000 },
}));

async function auth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ success:false, error:'Nicht angemeldet' });
  const user = await getUser(req.session.userId);
  if (!user) { req.session.destroy(()=>{}); return res.status(401).json({ success:false, error:'Benutzer nicht gefunden' }); }
  req.uid=user.id; req.user=user;
  req.p  = await getP(user.id);
  req.tp = await getTP(user.id);
  req.ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
  pool.query('UPDATE users SET last_seen=NOW() WHERE id=$1',[user.id]).catch(()=>{});
  next();
}
const adminOnly = (req,res,next) => req.p.manageUsers ? next() : res.status(403).json({success:false,error:'Keine Berechtigung'});
const dpOnly    = (req,res,next) => req.p.canApproveEvents ? next() : res.status(403).json({success:false,error:'Keine Berechtigung'});
const ok  = (res,data) => res.json({ success:true, data:data??null });
const bad = (res,msg,code=400) => res.status(code).json({ success:false, error:msg });

// ── AUTH ROUTES ──
app.get('/api/auth/users', async (req,res) => {
  try { ok(res, (await q('SELECT id,name,initials,color,roles FROM users ORDER BY name')).map(u=>({id:u.id,name:u.name,initials:u.initials,color:u.color,roles:parseRoles(u.roles)}))); }
  catch(e){ bad(res,e.message,500); }
});
app.post('/api/auth/login', async (req,res) => {
  try {
    const {userId,password}=req.body;
    if (!userId||!password) return bad(res,'Benutzername und Passwort erforderlich');
    const user=await getUser(userId);
    if (!user||!(await bcrypt.compare(password,user.pw_hash))) return bad(res,'Falsches Passwort',401);
    req.session.userId=user.id;
    const ip=req.headers['x-forwarded-for']?.split(',')[0]||req.socket.remoteAddress;
    await logActivity(user.id,user.name,'login',{},ip);
    ok(res,{userId:user.id,mustChangePW:user.must_change_pw===true});
  } catch(e){ bad(res,e.message,500); }
});
app.post('/api/auth/logout', async (req,res) => {
  if (req.session.userId) {
    const user=await getUser(req.session.userId).catch(()=>null);
    const ip=req.headers['x-forwarded-for']?.split(',')[0]||req.socket.remoteAddress;
    if (user) await logActivity(user.id,user.name,'logout',{},ip);
  }
  req.session.destroy(()=>ok(res));
});
app.get('/api/auth/me', auth, (req,res) => ok(res,{userId:req.uid,mustChangePW:req.user.must_change_pw===true}));
app.post('/api/auth/change-password', auth, async (req,res) => {
  try {
    const {currentPassword,newPassword}=req.body;
    if (!req.user.must_change_pw && !(await bcrypt.compare(currentPassword||'',req.user.pw_hash)))
      return bad(res,'Aktuelles Passwort falsch');
    if (!newPassword||newPassword.length<6) return bad(res,'Mindestens 6 Zeichen');
    await pool.query('UPDATE users SET pw_hash=$1,must_change_pw=false WHERE id=$2',[await bcrypt.hash(newPassword,10),req.uid]);
    await logActivity(req.uid,req.user.name,'change_password',{},req.ip);
    ok(res);
  } catch(e){ bad(res,e.message,500); }
});

// ── DATA ──
app.get('/api/data', auth, async (req,res) => {
  try {
    const {uid,p,tp}=req;
    const roles=parseRoles(req.user.roles);
    const [usersRaw,cats,tagsRaw,evRaw,tkRaw,notesRaw,allwRaw,msgsRaw,acksRaw,clTplRaw,clItemsRaw,clTkRaw,clTkItemsRaw] = await Promise.all([
      q('SELECT id,name,initials,roles,color,must_change_pw FROM users ORDER BY name'),
      q('SELECT * FROM categories ORDER BY sort_order,label'),
      q('SELECT * FROM tags ORDER BY label'),
      p.seeAllEntries ? q('SELECT * FROM events ORDER BY date_from')
        : q('SELECT * FROM events WHERE is_general=true OR user_id=$1 OR created_by=$1 ORDER BY date_from',[uid]),
      q('SELECT * FROM tickets ORDER BY created_at DESC'),
      q('SELECT * FROM ticket_notes ORDER BY created_at'),
      p.seeAllAllw ? q('SELECT * FROM allowances') : q('SELECT * FROM allowances WHERE user_id=$1',[uid]),
      q(`SELECT m.* FROM messages m WHERE m.to_department IS NULL OR m.to_department=ANY($1::text[]) OR m.from_user_id=$2 ORDER BY m.created_at DESC LIMIT 200`,[roles,uid]),
      q('SELECT * FROM message_acks WHERE user_id=$1',[uid]),
      q('SELECT * FROM checklist_templates ORDER BY name'),
      q('SELECT * FROM checklist_template_items ORDER BY template_id,sort_order'),
      q('SELECT * FROM ticket_checklists ORDER BY created_at'),
      q('SELECT * FROM ticket_checklist_items ORDER BY checklist_id,sort_order'),
    ]);

    const noteMap={};
    notesRaw.forEach(n=>(noteMap[n.ticket_id]=noteMap[n.ticket_id]||[]).push({id:n.id,text:n.text,authorId:n.author_id,isSystem:n.is_system,createdAt:n.created_at}));
    const ackedSet=new Set(acksRaw.map(a=>a.message_id));

    // Events with anonymization
    const events=evRaw.map(ev=>{
      if (ev.is_general) return {id:ev.id,isGeneral:true,dateFrom:ev.date_from,dateTo:ev.date_to,timeFrom:ev.time_from||'',timeTo:ev.time_to||'',category:ev.category,reason:ev.reason,approved:'approved',createdBy:ev.created_by,createdAt:ev.created_at,_anon:false,_blurred:false,_canEdit:false,_canApprove:false};
      const isOwn=ev.user_id===uid||ev.created_by===uid;
      const canSeeAll=p.canApproveEvents||isOwn;
      if (ev.approved==='rejected'&&!canSeeAll) return null;
      const anon=!canSeeAll&&ev.approved!=='approved';
      return {id:ev.id,isGeneral:false,dateFrom:ev.date_from,dateTo:ev.date_to,timeFrom:ev.time_from||'',timeTo:ev.time_to||'',userId:ev.user_id,category:anon?null:ev.category,reason:anon?'(Termin ausstehend)':ev.reason,approved:ev.approved||'pending',createdBy:ev.created_by,createdAt:ev.created_at,_anon:anon,_blurred:!anon&&p.othersBlurred&&!isOwn,_canEdit:isOwn,_canApprove:p.canApproveEvents};
    }).filter(Boolean);

    // Tickets with checklists
    const clItemsByList={};
    clTkItemsRaw.forEach(i=>(clItemsByList[i.checklist_id]=clItemsByList[i.checklist_id]||[]).push({id:i.id,text:i.text,checked:i.checked,checkedBy:i.checked_by,checkedAt:i.checked_at,sortOrder:i.sort_order}));
    const clByTicket={};
    clTkRaw.forEach(cl=>(clByTicket[cl.ticket_id]=clByTicket[cl.ticket_id]||[]).push({id:cl.id,templateId:cl.template_id,name:cl.name,createdBy:cl.created_by,items:clItemsByList[cl.id]||[]}));

    const tickets=tkRaw.filter(tk=>canSeeTk(tp,tk,uid)).map(tk=>({
      id:tk.id,number:tk.number,title:tk.title,description:tk.description||'',department:tk.department,
      tags:parseTags(tk.tags),priority:tk.priority,status:tk.status,bucket:tk.bucket||'',
      isPublic:tk.is_public,assigneeId:tk.assignee_id,parentTicketId:tk.parent_ticket_id,
      createdBy:tk.created_by,createdAt:tk.created_at,updatedAt:tk.updated_at,
      notes:noteMap[tk.id]||[],checklists:clByTicket[tk.id]||[],_canEdit:canEditTk(tp,tk,uid),
    }));

    // Checklist templates (filtered by dept)
    const myDepts=tp.myDepts;
    const clTemplates=clTplRaw.filter(t=>p.isAdmin||roles.includes(t.department)||myDepts.includes(t.department)).map(t=>({id:t.id,name:t.name,department:t.department,createdBy:t.created_by,items:clItemsRaw.filter(i=>i.template_id===t.id).map(i=>({id:i.id,text:i.text,sortOrder:i.sort_order}))}));

    const messages=msgsRaw.map(m=>({id:m.id,fromUserId:m.from_user_id,toDepartment:m.to_department,title:m.title,body:m.body,createdAt:m.created_at,acked:ackedSet.has(m.id),isMine:m.from_user_id===uid}));
    const users=usersRaw.map(u=>({id:u.id,name:u.name,initials:u.initials,roles:parseRoles(u.roles),color:u.color,mustChangePW:u.must_change_pw}));
    const allowances=allwRaw.map(a=>({id:a.id,userId:a.user_id,year:a.year,month:a.month,nd:a.nd,fd:a.fd,fw:a.fw,c10:a.c10}));

    ok(res,{users,categories:cats,tags:tagsRaw,events,tickets,allowances,messages,clTemplates,currentUser:uid,permissions:{isDP:p.isDP,isAdmin:p.isAdmin,canApproveEvents:p.canApproveEvents,isStandard:tp.isStandard,myDepts:tp.myDepts,roles:p.roles}});
  } catch(e){ console.error(e); bad(res,e.message,500); }
});

// ── ACTIVE USERS ──
app.get('/api/active-users', auth, async (req,res) => {
  try { ok(res, await q(`SELECT id,name,initials,color FROM users WHERE last_seen > NOW() - INTERVAL '10 minutes'`)); }
  catch(e){ bad(res,e.message,500); }
});

// ── EVENTS ──
app.post('/api/events', auth, async (req,res) => {
  try {
    const {isGeneral,dateFrom,dateTo,timeFrom,timeTo,userId,category,reason}=req.body;
    if (!dateFrom||!reason?.trim()) return bad(res,'Datum und Beschreibung erforderlich');
    if (!isGeneral&&!userId) return bad(res,'Mitarbeiter erforderlich');
    if (!category) return bad(res,'Kategorie erforderlich');
    if (isGeneral&&!req.p.addGeneral) return bad(res,'Keine Berechtigung',403);
    if (!isGeneral&&userId!==req.uid&&!req.p.addForOthers) return bad(res,'Keine Berechtigung',403);
    const id=newId();
    const approved=isGeneral?'approved':(req.p.canApproveEvents?'approved':'pending');
    await pool.query('INSERT INTO events (id,is_general,date_from,date_to,time_from,time_to,user_id,category,reason,approved,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
      [id,!!isGeneral,dateFrom,dateTo||dateFrom,timeFrom||'',timeTo||'',isGeneral?null:userId,category,reason.trim(),approved,req.uid]);
    await logActivity(req.uid,req.user.name,'create_event',{event_id:id,dateFrom,category,isGeneral},req.ip);
    ok(res,{id});
  } catch(e){ bad(res,e.message,500); }
});

app.put('/api/events/:id', auth, async (req,res) => {
  try {
    const ev=await q1('SELECT * FROM events WHERE id=$1',[req.params.id]);
    if (!ev) return bad(res,'Eintrag nicht gefunden',404);
    if (ev.created_by!==req.uid) return bad(res,'Nur der Ersteller darf bearbeiten',403);
    const {dateFrom,dateTo,timeFrom,timeTo,category,reason}=req.body;
    const newApproved=req.p.canApproveEvents?'approved':'pending';
    await pool.query('UPDATE events SET date_from=$1,date_to=$2,time_from=$3,time_to=$4,category=$5,reason=$6,approved=$7 WHERE id=$8',
      [dateFrom||ev.date_from,dateTo||ev.date_to,timeFrom||'',timeTo||'',category||ev.category,reason?.trim()||ev.reason,newApproved,req.params.id]);
    await logActivity(req.uid,req.user.name,'edit_event',{event_id:req.params.id},req.ip);
    ok(res);
  } catch(e){ bad(res,e.message,500); }
});

app.delete('/api/events/:id', auth, async (req,res) => {
  try {
    const ev=await q1('SELECT * FROM events WHERE id=$1',[req.params.id]);
    if (!ev) return bad(res,'Eintrag nicht gefunden',404);
    const canDel=(ev.is_general&&req.p.manageGeneral)||(!ev.is_general&&(req.p.editAllPersonal||ev.created_by===req.uid));
    if (!canDel) return bad(res,'Keine Berechtigung',403);
    await pool.query('DELETE FROM events WHERE id=$1',[req.params.id]);
    await logActivity(req.uid,req.user.name,'delete_event',{event_id:req.params.id},req.ip);
    ok(res);
  } catch(e){ bad(res,e.message,500); }
});

app.put('/api/events/:id/approve', auth, dpOnly, async (req,res) => {
  try {
    const {approved}=req.body;
    if (!['approved','rejected','pending'].includes(approved)) return bad(res,'Ungültiger Status');
    const ev=await q1('SELECT * FROM events WHERE id=$1',[req.params.id]);
    if (!ev) return bad(res,'Nicht gefunden',404);
    if (ev.is_general) return bad(res,'Allgemeine Einträge brauchen keine Freigabe');
    await pool.query('UPDATE events SET approved=$1 WHERE id=$2',[approved,req.params.id]);
    await logActivity(req.uid,req.user.name,'approve_event',{event_id:req.params.id,approved},req.ip);
    ok(res);
  } catch(e){ bad(res,e.message,500); }
});

// ── TICKETS ──
const PRIO_LBL={low:'Gering',medium:'Mittel',high:'Hoch'};
const ST_LBL={open:'Offen',in_progress:'In Bearbeitung',on_hold:'Zurückgestellt',closed:'Abgeschlossen'};
const DEPT_LBL={technik:'Technik',leitung:'Leitung',dienstplanung:'Dienstplanung',ausbildung:'Ausbildung',qm:'QM'};

app.post('/api/tickets', auth, async (req,res) => {
  try {
    const {title,description,department,tags,priority,status,bucket,assigneeId,parentTicketId}=req.body;
    if (!title?.trim()) return bad(res,'Titel erforderlich');
    const id=newId(),number=await nextTicketNumber(),now=new Date().toISOString();
    const std=req.tp.isStandard;
    await pool.query('INSERT INTO tickets (id,number,title,description,department,tags,priority,status,bucket,assignee_id,parent_ticket_id,created_by,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13)',
      [id,number,title.trim(),description||'',department||'technik',JSON.stringify(tags||[]),priority||'medium',std?'open':(status||'open'),std?'':(bucket||''),assigneeId||null,parentTicketId||null,req.uid,now]);
    await logActivity(req.uid,req.user.name,'create_ticket',{ticket_id:id,number,title:title.trim()},req.ip);
    ok(res,{id,number});
  } catch(e){ bad(res,e.message,500); }
});

app.put('/api/tickets/:id', auth, async (req,res) => {
  try {
    const tk=await q1('SELECT * FROM tickets WHERE id=$1',[req.params.id]);
    if (!tk) return bad(res,'Nicht gefunden',404);
    if (!canEditTk(req.tp,tk,req.uid)) return bad(res,'Keine Berechtigung',403);
    const b=req.body,std=req.tp.isStandard;
    const changes=[],set=[],vals=[];
    const add=(col,val)=>{vals.push(val);set.push(`${col}=$${vals.length}`);};
    if (b.title!==undefined) add('title',b.title);
    if (b.description!==undefined) add('description',b.description);
    if (b.department!==undefined){if(b.department!==tk.department)changes.push(`Fachbereich: ${DEPT_LBL[tk.department]||tk.department} → ${DEPT_LBL[b.department]||b.department}`);add('department',b.department);}
    if (b.tags!==undefined) add('tags',JSON.stringify(b.tags));
    if (b.priority!==undefined){if(b.priority!==tk.priority)changes.push(`Priorität: ${PRIO_LBL[tk.priority]} → ${PRIO_LBL[b.priority]}`);add('priority',b.priority);}
    if (b.status!==undefined&&!std){if(b.status!==tk.status)changes.push(`Status: ${ST_LBL[tk.status]} → ${ST_LBL[b.status]}`);add('status',b.status);}
    if (b.bucket!==undefined&&!std) add('bucket',b.bucket);
    if (b.isPublic!==undefined) add('is_public',!!b.isPublic);
    if (b.assigneeId!==undefined){
      if (b.assigneeId!==tk.assignee_id){
        if (b.assigneeId===req.uid) changes.push(`Ticket übernommen von ${req.user.name}`);
        else if (!b.assigneeId) changes.push(`Zuweisung aufgehoben (war: ${(await getUser(tk.assignee_id))?.name||'?'})`);
        else {const nu=await getUser(b.assigneeId);const ou=await getUser(tk.assignee_id);changes.push(`Zuständig: ${ou?.name||'niemand'} → ${nu?.name||'?'}`);}
      }
      add('assignee_id',b.assigneeId||null);
    }
    if (b.parentTicketId!==undefined) add('parent_ticket_id',b.parentTicketId||null);
    add('updated_at',new Date().toISOString());
    if (set.length>1){vals.push(req.params.id);await pool.query(`UPDATE tickets SET ${set.join(',')} WHERE id=$${vals.length}`,vals);}
    for (const c of changes) await addSystemNote(tk.id,c);
    if (changes.length) await logActivity(req.uid,req.user.name,'update_ticket',{ticket_id:tk.id,number:tk.number,changes},req.ip);
    ok(res);
  } catch(e){ bad(res,e.message,500); }
});

app.delete('/api/tickets/:id', auth, async (req,res) => {
  try {
    const tk=await q1('SELECT * FROM tickets WHERE id=$1',[req.params.id]);
    if (!tk) return bad(res,'Nicht gefunden',404);
    if (!canEditTk(req.tp,tk,req.uid)) return bad(res,'Keine Berechtigung',403);
    await pool.query('DELETE FROM ticket_notes WHERE ticket_id=$1',[req.params.id]);
    await pool.query('DELETE FROM tickets WHERE id=$1',[req.params.id]);
    await logActivity(req.uid,req.user.name,'delete_ticket',{ticket_id:req.params.id,number:tk.number},req.ip);
    ok(res);
  } catch(e){ bad(res,e.message,500); }
});

app.post('/api/tickets/:id/notes', auth, async (req,res) => {
  try {
    const tk=await q1('SELECT * FROM tickets WHERE id=$1',[req.params.id]);
    if (!tk) return bad(res,'Nicht gefunden',404);
    if (!canEditTk(req.tp,tk,req.uid)) return bad(res,'Keine Berechtigung',403);
    const text=req.body?.text?.trim();
    if (!text) return bad(res,'Text erforderlich');
    const id=newId(),now=new Date().toISOString();
    await pool.query('INSERT INTO ticket_notes (id,ticket_id,text,author_id,is_system,created_at) VALUES ($1,$2,$3,$4,false,$5)',[id,req.params.id,text,req.uid,now]);
    await pool.query('UPDATE tickets SET updated_at=$1 WHERE id=$2',[now,req.params.id]);
    ok(res,{id,createdAt:now});
  } catch(e){ bad(res,e.message,500); }
});

// ── CHECKLISTS ──
app.post('/api/checklists/templates', auth, async (req,res) => {
  try {
    const {name,department,items}=req.body;
    if (!name?.trim()||!department) return bad(res,'Name und Fachbereich erforderlich');
    const roles=parseRoles(req.user.roles);
    if (!req.p.isAdmin&&!roles.includes(department)) return bad(res,'Keine Berechtigung für diesen Fachbereich',403);
    const id=newId();
    await pool.query('INSERT INTO checklist_templates (id,name,department,created_by) VALUES ($1,$2,$3,$4)',[id,name.trim(),department,req.uid]);
    for (let i=0;i<(items||[]).length;i++) if (items[i]?.trim()) await pool.query('INSERT INTO checklist_template_items (id,template_id,text,sort_order) VALUES ($1,$2,$3,$4)',[newId(),id,items[i].trim(),i]);
    ok(res,{id});
  } catch(e){ bad(res,e.message,500); }
});

app.put('/api/checklists/templates/:id', auth, async (req,res) => {
  try {
    const tpl=await q1('SELECT * FROM checklist_templates WHERE id=$1',[req.params.id]);
    if (!tpl) return bad(res,'Nicht gefunden',404);
    if (!req.p.isAdmin&&tpl.created_by!==req.uid) return bad(res,'Keine Berechtigung',403);
    const {name,department,items}=req.body;
    await pool.query('UPDATE checklist_templates SET name=$1,department=$2 WHERE id=$3',[name||tpl.name,department||tpl.department,req.params.id]);
    await pool.query('DELETE FROM checklist_template_items WHERE template_id=$1',[req.params.id]);
    for (let i=0;i<(items||[]).length;i++) if (items[i]?.trim()) await pool.query('INSERT INTO checklist_template_items (id,template_id,text,sort_order) VALUES ($1,$2,$3,$4)',[newId(),req.params.id,items[i].trim(),i]);
    ok(res);
  } catch(e){ bad(res,e.message,500); }
});

app.delete('/api/checklists/templates/:id', auth, async (req,res) => {
  try {
    const tpl=await q1('SELECT * FROM checklist_templates WHERE id=$1',[req.params.id]);
    if (!tpl) return bad(res,'Nicht gefunden',404);
    if (!req.p.isAdmin&&tpl.created_by!==req.uid) return bad(res,'Keine Berechtigung',403);
    await pool.query('DELETE FROM checklist_templates WHERE id=$1',[req.params.id]);
    ok(res);
  } catch(e){ bad(res,e.message,500); }
});

app.post('/api/tickets/:id/checklists', auth, async (req,res) => {
  try {
    const tk=await q1('SELECT * FROM tickets WHERE id=$1',[req.params.id]);
    if (!tk||!canEditTk(req.tp,tk,req.uid)) return bad(res,'Keine Berechtigung',403);
    const tpl=await q1('SELECT * FROM checklist_templates WHERE id=$1',[req.body.templateId]);
    if (!tpl) return bad(res,'Vorlage nicht gefunden',404);
    const items=await q('SELECT * FROM checklist_template_items WHERE template_id=$1 ORDER BY sort_order',[tpl.id]);
    const clId=newId();
    await pool.query('INSERT INTO ticket_checklists (id,ticket_id,template_id,name,created_by) VALUES ($1,$2,$3,$4,$5)',[clId,req.params.id,tpl.id,tpl.name,req.uid]);
    for (const it of items) await pool.query('INSERT INTO ticket_checklist_items (id,checklist_id,text,sort_order) VALUES ($1,$2,$3,$4)',[newId(),clId,it.text,it.sort_order]);
    ok(res,{id:clId});
  } catch(e){ bad(res,e.message,500); }
});

app.delete('/api/ticket-checklists/:id', auth, async (req,res) => {
  try {
    const cl=await q1('SELECT * FROM ticket_checklists WHERE id=$1',[req.params.id]);
    if (!cl) return bad(res,'Nicht gefunden',404);
    if (!req.p.isAdmin&&cl.created_by!==req.uid) return bad(res,'Keine Berechtigung',403);
    await pool.query('DELETE FROM ticket_checklists WHERE id=$1',[req.params.id]);
    ok(res);
  } catch(e){ bad(res,e.message,500); }
});

app.put('/api/checklist-items/:id/toggle', auth, async (req,res) => {
  try {
    const item=await q1('SELECT tci.*,tc.ticket_id FROM ticket_checklist_items tci JOIN ticket_checklists tc ON tc.id=tci.checklist_id WHERE tci.id=$1',[req.params.id]);
    if (!item) return bad(res,'Nicht gefunden',404);
    const tk=await q1('SELECT * FROM tickets WHERE id=$1',[item.ticket_id]);
    if (!canEditTk(req.tp,tk,req.uid)) return bad(res,'Keine Berechtigung',403);
    const nc=!item.checked;
    await pool.query('UPDATE ticket_checklist_items SET checked=$1,checked_by=$2,checked_at=$3 WHERE id=$4',[nc,nc?req.uid:null,nc?new Date().toISOString():null,req.params.id]);
    ok(res,{checked:nc});
  } catch(e){ bad(res,e.message,500); }
});

// ── MESSAGES ──
app.post('/api/messages', auth, async (req,res) => {
  try {
    if (!req.p.isDP) return bad(res,'Keine Berechtigung',403);
    const {title,body,toDepartment}=req.body;
    if (!title?.trim()||!body?.trim()) return bad(res,'Titel und Text erforderlich');
    const id=newId();
    await pool.query('INSERT INTO messages (id,from_user_id,to_department,title,body) VALUES ($1,$2,$3,$4,$5)',[id,req.uid,toDepartment||null,title.trim(),body.trim()]);
    await logActivity(req.uid,req.user.name,'send_message',{message_id:id,title:title.trim(),toDepartment},req.ip);
    ok(res,{id});
  } catch(e){ bad(res,e.message,500); }
});

app.post('/api/messages/:id/ack', auth, async (req,res) => {
  try {
    await pool.query('INSERT INTO message_acks (id,message_id,user_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',[newId(),req.params.id,req.uid]);
    await logActivity(req.uid,req.user.name,'ack_message',{message_id:req.params.id},req.ip);
    ok(res);
  } catch(e){ bad(res,e.message,500); }
});

// ── ALLOWANCES ──
app.put('/api/allowances', auth, async (req,res) => {
  try {
    if (!req.p.editAllw) return bad(res,'Keine Berechtigung',403);
    const {userId,year,month,nd,fd,fw,c10}=req.body;
    await pool.query(`INSERT INTO allowances (id,user_id,year,month,nd,fd,fw,c10) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (user_id,year,month) DO UPDATE SET nd=EXCLUDED.nd,fd=EXCLUDED.fd,fw=EXCLUDED.fw,c10=EXCLUDED.c10`,
      [newId(),userId,year,month,nd||0,fd||0,fw||0,c10||0]);
    ok(res);
  } catch(e){ bad(res,e.message,500); }
});

// ── CATEGORIES / TAGS / USERS ──
app.post('/api/categories',auth,adminOnly,async(req,res)=>{try{const{label,emoji,color}=req.body;if(!label?.trim())return bad(res,'Bezeichnung erforderlich');const max=await q1('SELECT MAX(sort_order) as m FROM categories');await pool.query('INSERT INTO categories(id,label,emoji,color,sort_order)VALUES($1,$2,$3,$4,$5)',[newId(),label.trim(),emoji||'📌',color||'#64748b',(max?.m||0)+1]);ok(res);}catch(e){bad(res,e.message,500);}});
app.put('/api/categories/:id',auth,adminOnly,async(req,res)=>{try{await pool.query('UPDATE categories SET label=$1,emoji=$2,color=$3 WHERE id=$4',[req.body.label,req.body.emoji||'📌',req.body.color||'#64748b',req.params.id]);ok(res);}catch(e){bad(res,e.message,500);}});
app.delete('/api/categories/:id',auth,adminOnly,async(req,res)=>{try{await pool.query('DELETE FROM categories WHERE id=$1',[req.params.id]);ok(res);}catch(e){bad(res,e.message,500);}});
app.post('/api/tags',auth,adminOnly,async(req,res)=>{try{const{label,color}=req.body;if(!label?.trim())return bad(res,'Bezeichnung erforderlich');await pool.query('INSERT INTO tags(id,label,color)VALUES($1,$2,$3)',[newId(),label.trim(),color||'#3b6dd4']);ok(res);}catch(e){bad(res,e.message,500);}});
app.put('/api/tags/:id',auth,adminOnly,async(req,res)=>{try{await pool.query('UPDATE tags SET label=$1,color=$2 WHERE id=$3',[req.body.label,req.body.color||'#3b6dd4',req.params.id]);ok(res);}catch(e){bad(res,e.message,500);}});
app.delete('/api/tags/:id',auth,adminOnly,async(req,res)=>{try{await pool.query('DELETE FROM tags WHERE id=$1',[req.params.id]);ok(res);}catch(e){bad(res,e.message,500);}});
app.post('/api/users',auth,adminOnly,async(req,res)=>{try{const{name,initials,roles,color}=req.body;if(!name?.trim()||!initials?.trim())return bad(res,'Name und Kürzel erforderlich');await pool.query('INSERT INTO users(id,name,initials,roles,color,pw_hash,must_change_pw)VALUES($1,$2,$3,$4,$5,$6,true)',[newId(),name.trim(),initials.trim().toUpperCase(),JSON.stringify(roles||['standard']),color||'#64748b',await bcrypt.hash('Passwort1',10)]);ok(res);}catch(e){bad(res,e.message,500);}});
app.put('/api/users/:id',auth,adminOnly,async(req,res)=>{try{const{name,initials,roles,color,resetPassword}=req.body;if(!name?.trim()||!initials?.trim())return bad(res,'Name und Kürzel erforderlich');await pool.query('UPDATE users SET name=$1,initials=$2,roles=$3,color=$4 WHERE id=$5',[name.trim(),initials.trim().toUpperCase(),JSON.stringify(roles||['standard']),color||'#64748b',req.params.id]);if(resetPassword)await pool.query('UPDATE users SET pw_hash=$1,must_change_pw=true WHERE id=$2',[await bcrypt.hash('Passwort1',10),req.params.id]);ok(res);}catch(e){bad(res,e.message,500);}});
app.delete('/api/users/:id',auth,adminOnly,async(req,res)=>{try{if(req.params.id===req.uid)return bad(res,'Eigenen Account nicht löschbar');await pool.query('DELETE FROM users WHERE id=$1',[req.params.id]);ok(res);}catch(e){bad(res,e.message,500);}});

// ── ACTIVITY LOG ──
app.get('/api/activity-log', auth, adminOnly, async (req,res) => {
  try {
    const limit=Math.min(parseInt(req.query.limit||'100'),500);
    const offset=parseInt(req.query.offset||'0');
    const [logs,total]=await Promise.all([
      q('SELECT * FROM activity_log ORDER BY created_at DESC LIMIT $1 OFFSET $2',[limit,offset]),
      q1('SELECT COUNT(*) as n FROM activity_log'),
    ]);
    ok(res,{logs,total:parseInt(total?.n||0)});
  } catch(e){ bad(res,e.message,500); }
});

app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));

initDB().then(()=>app.listen(PORT,'0.0.0.0',()=>{
  console.log(`\n✓ LSt Portal – http://localhost:${PORT}`);
  console.log(`  DB: PostgreSQL | Env: ${IS_PROD?'Produktion':'Entwicklung'}`);
  console.log('  Login: Administrator / Passwort1\n');
})).catch(e=>{console.error('❌',e.message);process.exit(1);});
