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

const pool = new Pool({ connectionString: DB_URL, ssl: IS_PROD ? { rejectUnauthorized: false } : false, max: 10 });
const q  = (sql, p) => pool.query(sql, p).then(r => r.rows);
const q1 = (sql, p) => pool.query(sql, p).then(r => r.rows[0] || null);
const newId = () => crypto.randomUUID();

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
      approval_status TEXT DEFAULT NULL,
      created_by TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS event_confirms (
      id TEXT PRIMARY KEY, event_id TEXT NOT NULL, user_id TEXT NOT NULL,
      confirmed_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE(event_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY, number TEXT NOT NULL UNIQUE, title TEXT NOT NULL,
      description TEXT DEFAULT '', department TEXT NOT NULL,
      tags JSONB NOT NULL DEFAULT '[]', priority TEXT NOT NULL DEFAULT 'medium',
      status TEXT NOT NULL DEFAULT 'open', bucket TEXT DEFAULT '',
      is_public BOOLEAN NOT NULL DEFAULT false,
      assignee_id TEXT, parent_ticket_id TEXT, created_by TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS ticket_notes (
      id TEXT PRIMARY KEY, ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      text TEXT NOT NULL, author_id TEXT NOT NULL,
      note_type TEXT NOT NULL DEFAULT 'note', created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS allowances (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, year INTEGER NOT NULL, month INTEGER NOT NULL,
      nd INTEGER DEFAULT 0, fd INTEGER DEFAULT 0, fw INTEGER DEFAULT 0, c10 INTEGER DEFAULT 0,
      UNIQUE (user_id, year, month)
    );
    CREATE TABLE IF NOT EXISTS checklist_templates (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, department TEXT NOT NULL,
      created_by TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS checklist_template_items (
      id TEXT PRIMARY KEY, template_id TEXT NOT NULL REFERENCES checklist_templates(id) ON DELETE CASCADE,
      text TEXT NOT NULL, item_type TEXT NOT NULL DEFAULT 'check', sort_order INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS ticket_checklists (
      id TEXT PRIMARY KEY, ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      template_id TEXT, name TEXT NOT NULL, created_by TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS ticket_checklist_items (
      id TEXT PRIMARY KEY, checklist_id TEXT NOT NULL REFERENCES ticket_checklists(id) ON DELETE CASCADE,
      text TEXT NOT NULL, item_type TEXT NOT NULL DEFAULT 'check', sort_order INTEGER DEFAULT 0,
      completed_by TEXT, completed_at TIMESTAMPTZ, user_note TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL,
      sender_id TEXT NOT NULL, target_type TEXT NOT NULL DEFAULT 'all', target_value TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS message_reads (
      id TEXT PRIMARY KEY, message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL, read_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE(message_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, type TEXT NOT NULL,
      title TEXT NOT NULL, ticket_id TEXT, note_id TEXT, event_id TEXT,
      created_by TEXT NOT NULL, read_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS abrechnung_einspringer (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
      edate TEXT NOT NULL, note TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS abrechnung_homeoffice (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
      year INTEGER NOT NULL, month INTEGER NOT NULL, days INTEGER DEFAULT 0,
      UNIQUE(user_id, year, month)
    );
    CREATE TABLE IF NOT EXISTS dienstplaene (
      id TEXT PRIMARY KEY, month INTEGER NOT NULL, year INTEGER NOT NULL,
      label TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1,
      filename TEXT NOT NULL, file_data TEXT NOT NULL,
      is_archived BOOLEAN NOT NULL DEFAULT false,
      archived_at TIMESTAMPTZ,
      created_by TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  const migs = [
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ`,
    `ALTER TABLE checklist_template_items ADD COLUMN IF NOT EXISTS item_type TEXT NOT NULL DEFAULT 'check'`,
    `ALTER TABLE ticket_checklist_items ADD COLUMN IF NOT EXISTS item_type TEXT NOT NULL DEFAULT 'check'`,
    `ALTER TABLE notifications ADD COLUMN IF NOT EXISTS event_id TEXT`,
  ];
  for (const m of migs) { try { await pool.query(m); } catch(e) {} }

  const cnt = await q1('SELECT COUNT(*) as n FROM users');
  if (parseInt(cnt.n) === 0) {
    const hash = await bcrypt.hash('Passwort1', 10);
    const [u1,u2,u3] = [newId(),newId(),newId()];
    await pool.query(`INSERT INTO users (id,name,initials,roles,color,pw_hash,must_change_pw) VALUES
      ($1,'Administrator','AD','["admin"]','#3b6dd4',$4,false),
      ($2,'Dienstplanung','DP','["dienstplanung"]','#10b981',$4,false),
      ($3,'Beispiel Mitarbeiter','BM','["standard"]','#e87bb0',$4,true)`, [u1,u2,u3,hash]);
    const cats=[['📚','Ausbildung','#10b981',0],['🎓','Kurs','#3b6dd4',1],['🎂','Geburtstag','#e87bb0',2],
      ['📝','Dienstwunsch','#7c3aed',3],['🌴','Urlaub','#f59e0b',4],['🏥','Krankenstand','#ef4444',5],['📌','Sonstiges','#64748b',6]];
    for (const [e,l,c,i] of cats) await pool.query('INSERT INTO categories (id,label,emoji,color,sort_order) VALUES ($1,$2,$3,$4,$5)',[newId(),l,e,c,i]);
    for (const [l,c] of [['Bug','#ef4444'],['Feature','#3b6dd4'],['Dringend','#f59e0b'],['Frage','#10b981']])
      await pool.query('INSERT INTO tags (id,label,color) VALUES ($1,$2,$3)',[newId(),l,c]);
    console.log('✓ Datenbank initialisiert – Login: Administrator / Passwort1');
  }
}

const parseRoles = r => !r ? ['standard'] : Array.isArray(r) ? r : (()=>{ try{return JSON.parse(r);}catch{return ['standard'];} })();
const parseTags  = t => !t ? [] : Array.isArray(t) ? t : (()=>{ try{return JSON.parse(t);}catch{return [];} })();
const getUser    = id => q1('SELECT * FROM users WHERE id=$1', [id]);
const DEPTS = ['technik','leitung','dienstplanung','ausbildung','qm'];

async function getP(uid) {
  const u = await getUser(uid);
  const roles = parseRoles(u?.roles);
  const has = (...r) => r.some(x => roles.includes(x));
  const full = has('admin','leitung','dienstplanung');
  return {
    manageUsers: has('admin'), seeAllEntries: true, // everyone sees all events now
    othersBlurred: false, editAllPersonal: full,
    addForOthers: has('admin','leitung','dienstplanung','ausbildung','qm'),
    addGeneral: has('admin','leitung','dienstplanung','technik','ausbildung','qm'),
    manageGeneral: has('admin','leitung','dienstplanung','technik','ausbildung','qm'),
    seeAllAllw: full, editAllw: full,
    canApproveEvents: has('admin','dienstplanung'),
    canSendMessages: !has('standard'),
    seeAllAbrechnung: has('admin','dienstplanung'),
    roles,
  };
}
async function getTP(uid) {
  const u = await getUser(uid);
  const roles = parseRoles(u?.roles);
  const has = (...r) => r.some(x => roles.includes(x));
  return { seeAll: has('admin','leitung'), editAll: has('admin','leitung'),
    myDepts: DEPTS.filter(d => roles.includes(d)),
    canSetPublic: !has('standard'), canAssign: !has('standard') };
}
const canSeeTk  = (tp,tk,uid) => tp.seeAll || tk.is_public || tk.created_by===uid || tp.myDepts.includes(tk.department);
const canEditTk = (tp,tk,uid) => tp.editAll || tk.created_by===uid || tp.myDepts.includes(tk.department);

async function nextTicketNumber() {
  const row = await q1(`SELECT number FROM tickets ORDER BY CAST(REPLACE(number,'TK-','') AS INTEGER) DESC LIMIT 1`);
  if (!row) return 'TK-1001';
  return `TK-${(parseInt(row.number.replace('TK-',''))+1).toString().padStart(4,'0')}`;
}
async function auditNote(ticketId, userId, text) {
  await pool.query('INSERT INTO ticket_notes (id,ticket_id,text,author_id,note_type) VALUES ($1,$2,$3,$4,$5)',
    [newId(), ticketId, text, userId, 'audit']);
  await pool.query('UPDATE tickets SET updated_at=NOW() WHERE id=$1', [ticketId]);
}
async function createNotification(userId, type, title, ticketId, noteId, createdBy, eventId) {
  await pool.query('INSERT INTO notifications (id,user_id,type,title,ticket_id,note_id,event_id,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
    [newId(), userId, type, title, ticketId||null, noteId||null, eventId||null, createdBy]);
}
function parseMentions(text, users) {
  return users.filter(u => new RegExp('@' + u.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'), 'i').test(text));
}
const canSeeMsg = (msg, uid, roles) =>
  msg.target_type==='all' || (msg.target_type==='user' && msg.target_value===uid) || (msg.target_type==='department' && roles.includes(msg.target_value));

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.set('trust proxy', 1);
app.use(session({
  store: new pgSession({ pool, tableName: 'sessions', createTableIfMissing: true }),
  secret: SECRET, resave: false, saveUninitialized: false, name: 'lst.sid',
  cookie: { httpOnly: true, secure: IS_PROD, sameSite: 'lax', maxAge: 36000000 },
}));

async function auth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ success:false, error:'Nicht angemeldet' });
  const user = await getUser(req.session.userId);
  if (!user) { req.session.destroy(()=>{}); return res.status(401).json({ success:false, error:'Benutzer nicht gefunden' }); }
  req.uid = user.id; req.user = user;
  req.p = await getP(user.id); req.tp = await getTP(user.id);
  pool.query('UPDATE users SET last_seen=NOW() WHERE id=$1', [user.id]).catch(()=>{});
  next();
}
const adminOnly = (req,res,next) => req.p.manageUsers ? next() : res.status(403).json({success:false,error:'Keine Berechtigung'});
const ok  = (res,data) => res.json({success:true, data: data??null});
const bad = (res,msg,code=400) => res.status(code).json({success:false, error:msg});

// AUTH
app.get('/api/auth/users', async (req,res) => {
  try {
    const users = await q('SELECT id,name,initials,color,roles FROM users ORDER BY name');
    ok(res, users.map(u=>({id:u.id,name:u.name,initials:u.initials,color:u.color,roles:parseRoles(u.roles)})));
  } catch(e) { bad(res,e.message,500); }
});
app.post('/api/auth/login', async (req,res) => {
  try {
    const {userId,password} = req.body;
    if (!userId||!password) return bad(res,'Benutzername und Passwort erforderlich');
    const user = await getUser(userId);
    if (!user||!(await bcrypt.compare(password,user.pw_hash))) return bad(res,'Falsches Passwort',401);
    req.session.userId = user.id;
    ok(res, {userId:user.id, mustChangePW: user.must_change_pw===true});
  } catch(e) { bad(res,e.message,500); }
});
app.post('/api/auth/logout', (req,res) => req.session.destroy(()=>ok(res)));
app.get('/api/auth/me', auth, (req,res) => ok(res, {userId:req.uid, mustChangePW:req.user.must_change_pw===true}));
app.post('/api/auth/change-password', auth, async (req,res) => {
  try {
    const {currentPassword,newPassword} = req.body;
    if (!req.user.must_change_pw && !(await bcrypt.compare(currentPassword||'',req.user.pw_hash)))
      return bad(res,'Aktuelles Passwort falsch');
    if (!newPassword||newPassword.length<6) return bad(res,'Mindestens 6 Zeichen');
    await pool.query('UPDATE users SET pw_hash=$1,must_change_pw=false WHERE id=$2',
      [await bcrypt.hash(newPassword,10), req.uid]);
    ok(res);
  } catch(e) { bad(res,e.message,500); }
});

// DATA
app.get('/api/data', auth, async (req,res) => {
  try {
    const uid=req.uid, p=req.p, tp=req.tp, roles=p.roles;
    const [usersRaw,cats,tagsRaw,evRaw,evConfirmsRaw,tkRaw,notesRaw,allwRaw,clTmpls,clItems,
           tkClRaw,tkClItemsRaw,msgsRaw,readsRaw,notifsRaw,einspRaw,hoRaw,dpRaw] = await Promise.all([
      q('SELECT id,name,initials,roles,color,must_change_pw,last_seen FROM users ORDER BY name'),
      q('SELECT * FROM categories ORDER BY sort_order,label'),
      q('SELECT * FROM tags ORDER BY label'),
      q('SELECT * FROM events ORDER BY date_from'),
      q('SELECT event_id FROM event_confirms WHERE user_id=$1',[uid]),
      q('SELECT * FROM tickets ORDER BY created_at DESC'),
      q('SELECT * FROM ticket_notes ORDER BY created_at'),
      p.seeAllAllw ? q('SELECT * FROM allowances') : q('SELECT * FROM allowances WHERE user_id=$1',[uid]),
      q('SELECT * FROM checklist_templates ORDER BY name'),
      q('SELECT * FROM checklist_template_items ORDER BY sort_order'),
      q('SELECT * FROM ticket_checklists'),
      q('SELECT * FROM ticket_checklist_items ORDER BY sort_order'),
      q('SELECT * FROM messages ORDER BY created_at DESC'),
      q('SELECT message_id FROM message_reads WHERE user_id=$1',[uid]),
      q('SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50',[uid]),
      p.seeAllAbrechnung ? q('SELECT * FROM abrechnung_einspringer ORDER BY edate DESC')
        : q('SELECT * FROM abrechnung_einspringer WHERE user_id=$1 ORDER BY edate DESC',[uid]),
      p.seeAllAbrechnung ? q('SELECT * FROM abrechnung_homeoffice ORDER BY year DESC,month DESC')
        : q('SELECT * FROM abrechnung_homeoffice WHERE user_id=$1 ORDER BY year DESC,month DESC',[uid]),
      q('SELECT id,month,year,label,version,filename,is_archived,archived_at,created_by,created_at FROM dienstplaene ORDER BY year DESC,month DESC,version DESC'),
    ]);

    const noteMap={}, clItemMap={}, tkClItemMap={}, tkClMap={};
    notesRaw.forEach(n=>{ if(!noteMap[n.ticket_id]) noteMap[n.ticket_id]=[]; noteMap[n.ticket_id].push({id:n.id,text:n.text,authorId:n.author_id,noteType:n.note_type,createdAt:n.created_at}); });
    clItems.forEach(i=>{ if(!clItemMap[i.template_id]) clItemMap[i.template_id]=[]; clItemMap[i.template_id].push({id:i.id,text:i.text,itemType:i.item_type||'check',sortOrder:i.sort_order}); });
    tkClItemsRaw.forEach(i=>{ if(!tkClItemMap[i.checklist_id]) tkClItemMap[i.checklist_id]=[]; tkClItemMap[i.checklist_id].push({id:i.id,text:i.text,itemType:i.item_type||'check',sortOrder:i.sort_order,completedBy:i.completed_by,completedAt:i.completed_at,userNote:i.user_note||''}); });
    tkClRaw.forEach(c=>{ if(!tkClMap[c.ticket_id]) tkClMap[c.ticket_id]=[]; tkClMap[c.ticket_id].push({id:c.id,templateId:c.template_id,name:c.name,createdBy:c.created_by,items:tkClItemMap[c.id]||[]}); });

    const fiveMinAgo = new Date(Date.now() - 5*60*1000);
    const readIds = new Set(readsRaw.map(r=>r.message_id));
    const confirmedEventIds = new Set(evConfirmsRaw.map(r=>r.event_id));

    ok(res, {
      currentUser: uid,
      permissions: {
        canApproveEvents:p.canApproveEvents, canSendMessages:p.canSendMessages,
        seeAllEntries:true, editAllPersonal:p.editAllPersonal,
        addForOthers:p.addForOthers, addGeneral:p.addGeneral,
        manageUsers:p.manageUsers, seeAllAllw:p.seeAllAllw, editAllw:p.editAllw,
        seeAllAbrechnung:p.seeAllAbrechnung,
        myDepts:tp.myDepts, seeAllTickets:tp.seeAll,
        canSetPublic:tp.canSetPublic, canAssign:tp.canAssign,
      },
      users: usersRaw.map(u=>({
        id:u.id, name:u.name, initials:u.initials, roles:parseRoles(u.roles),
        color:u.color, mustChangePW:u.must_change_pw,
        isOnline: !!(u.last_seen && new Date(u.last_seen) > fiveMinAgo),
      })),
      categories: cats,
      tags: tagsRaw,
      events: evRaw.map(ev=>{
        const concernsMe = !ev.is_general && ev.user_id === uid;
        const createdByMe = ev.created_by === uid;
        const anonymize = !ev.is_general && ev.user_id !== uid && !createdByMe;
        const confirmed = ev.is_general || createdByMe || confirmedEventIds.has(ev.id);
        return {
          id:ev.id, isGeneral:ev.is_general, dateFrom:ev.date_from, dateTo:ev.date_to,
          timeFrom:ev.time_from||'', timeTo:ev.time_to||'',
          userId: anonymize ? null : ev.user_id,
          category:ev.category, reason: anonymize ? null : ev.reason,
          approvalStatus:ev.approval_status,
          createdBy: anonymize ? null : ev.created_by, createdAt:ev.created_at,
          _anonymized: anonymize,
          _concernsMe: concernsMe,
          _confirmed: confirmed,
          _isNew: concernsMe && !createdByMe && !confirmedEventIds.has(ev.id),
          _canEdit: !ev.is_general && createdByMe && !ev.approval_status,
        };
      }),
      tickets: tkRaw.filter(tk=>canSeeTk(tp,tk,uid)).map(tk=>({
        id:tk.id, number:tk.number, title:tk.title, description:tk.description||'',
        department:tk.department, tags:parseTags(tk.tags), priority:tk.priority,
        status:tk.status, bucket:tk.bucket||'', isPublic:tk.is_public,
        assigneeId:tk.assignee_id, parentTicketId:tk.parent_ticket_id,
        createdBy:tk.created_by, createdAt:tk.created_at, updatedAt:tk.updated_at,
        notes:noteMap[tk.id]||[], checklists:tkClMap[tk.id]||[],
        _canEdit:canEditTk(tp,tk,uid),
      })),
      allowances: allwRaw.map(a=>({id:a.id,userId:a.user_id,year:a.year,month:a.month,nd:a.nd,fd:a.fd,fw:a.fw,c10:a.c10})),
      checklists: clTmpls.map(t=>({id:t.id,name:t.name,department:t.department,createdBy:t.created_by,items:clItemMap[t.id]||[]})),
      messages: msgsRaw.filter(m=>canSeeMsg(m,uid,roles)).map(m=>({
        id:m.id,title:m.title,body:m.body,senderId:m.sender_id,
        targetType:m.target_type,targetValue:m.target_value,
        createdAt:m.created_at, isRead:readIds.has(m.id),
      })),
      notifications: notifsRaw.map(n=>({
        id:n.id, type:n.type, title:n.title, ticketId:n.ticket_id,
        noteId:n.note_id, eventId:n.event_id, createdBy:n.created_by, createdAt:n.created_at,
        isRead:!!n.read_at,
      })),
      abrechnung: {
        einspringer: einspRaw.map(e=>({id:e.id,userId:e.user_id,date:e.edate,note:e.note||'',createdAt:e.created_at})),
        homeoffice:  hoRaw.map(h=>({id:h.id,userId:h.user_id,year:h.year,month:h.month,days:h.days})),
      },
      dienstplaene: dpRaw.map(d=>({id:d.id,month:d.month,year:d.year,label:d.label,version:d.version,filename:d.filename,isArchived:d.is_archived,archivedAt:d.archived_at,createdBy:d.created_by,createdAt:d.created_at})),
    });
  } catch(e) { console.error(e); bad(res,e.message,500); }
});

// EVENTS
app.post('/api/events', auth, async (req,res) => {
  try {
    const {isGeneral,dateFrom,dateTo,timeFrom,timeTo,userId,category,reason} = req.body;
    if (!dateFrom||!reason?.trim()) return bad(res,'Datum und Beschreibung erforderlich');
    if (!isGeneral&&!userId) return bad(res,'Mitarbeiter erforderlich');
    if (isGeneral&&!req.p.addGeneral) return bad(res,'Keine Berechtigung',403);
    if (!isGeneral&&userId!==req.uid&&!req.p.addForOthers) return bad(res,'Keine Berechtigung',403);
    const id=newId();
    await pool.query('INSERT INTO events (id,is_general,date_from,date_to,time_from,time_to,user_id,category,reason,approval_status,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
      [id,!!isGeneral,dateFrom,dateTo||dateFrom,timeFrom||'',timeTo||'',isGeneral?null:userId,category||'',reason.trim(),isGeneral?'approved':null,req.uid]);
    // Notify target user if someone else added an event for them
    if (!isGeneral && userId && userId !== req.uid) {
      const author = await getUser(req.uid);
      await createNotification(userId,'event_added',`${author?.name||'?'} hat einen Eintrag für dich eingetragen`,null,null,req.uid,id);
    }
    ok(res,{id});
  } catch(e) { bad(res,e.message,500); }
});
app.put('/api/events/:id', auth, async (req,res) => {
  try {
    const ev = await q1('SELECT * FROM events WHERE id=$1',[req.params.id]);
    if (!ev) return bad(res,'Nicht gefunden',404);
    if (ev.created_by!==req.uid) return bad(res,'Nur Ersteller kann bearbeiten',403);
    const {dateFrom,dateTo,timeFrom,timeTo,category,reason} = req.body;
    await pool.query('UPDATE events SET date_from=$1,date_to=$2,time_from=$3,time_to=$4,category=$5,reason=$6 WHERE id=$7',
      [dateFrom,dateTo||dateFrom,timeFrom||'',timeTo||'',category||'',reason.trim(),req.params.id]);
    // Notify target if someone else edited their event
    if (ev.user_id && ev.user_id !== req.uid) {
      const author = await getUser(req.uid);
      await createNotification(ev.user_id,'event_changed',`${author?.name||'?'} hat deinen Eintrag geändert`,null,null,req.uid,ev.id);
    }
    ok(res);
  } catch(e) { bad(res,e.message,500); }
});
app.put('/api/events/:id/approval', auth, async (req,res) => {
  try {
    if (!req.p.canApproveEvents) return bad(res,'Keine Berechtigung',403);
    const {status} = req.body;
    if (!['approved','rejected'].includes(status)) return bad(res,'Ungültiger Status');
    await pool.query('UPDATE events SET approval_status=$1 WHERE id=$2 AND is_general=false',[status,req.params.id]);
    ok(res);
  } catch(e) { bad(res,e.message,500); }
});
app.post('/api/events/:id/confirm', auth, async (req,res) => {
  try {
    await pool.query('INSERT INTO event_confirms (id,event_id,user_id) VALUES ($1,$2,$3) ON CONFLICT (event_id,user_id) DO NOTHING',
      [newId(),req.params.id,req.uid]);
    ok(res);
  } catch(e) { bad(res,e.message,500); }
});
app.delete('/api/events/:id', auth, async (req,res) => {
  try {
    const ev = await q1('SELECT * FROM events WHERE id=$1',[req.params.id]);
    if (!ev) return bad(res,'Nicht gefunden',404);
    const canDel = (ev.is_general&&req.p.manageGeneral)||(!ev.is_general&&(req.p.editAllPersonal||ev.created_by===req.uid));
    if (!canDel) return bad(res,'Keine Berechtigung',403);
    await pool.query('DELETE FROM event_confirms WHERE event_id=$1',[req.params.id]);
    await pool.query('DELETE FROM events WHERE id=$1',[req.params.id]);
    ok(res);
  } catch(e) { bad(res,e.message,500); }
});

// TICKETS
app.post('/api/tickets', auth, async (req,res) => {
  try {
    const {title,description,department,tags,priority,status,bucket,assigneeId,parentTicketId} = req.body;
    if (!title?.trim()) return bad(res,'Titel erforderlich');
    const id=newId(), number=await nextTicketNumber();
    await pool.query('INSERT INTO tickets (id,number,title,description,department,tags,priority,status,bucket,assignee_id,parent_ticket_id,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
      [id,number,title.trim(),description||'',department||'technik',JSON.stringify(tags||[]),priority||'medium',status||'open',bucket||'',assigneeId||null,parentTicketId||null,req.uid]);
    const uname = (await getUser(req.uid))?.name||'?';
    await auditNote(id,req.uid,`✅ Ticket erstellt von ${uname}`);
    const deptUsers = await q('SELECT id FROM users WHERE roles @> $1::jsonb AND id != $2',
      [JSON.stringify([department]), req.uid]);
    for (const u of deptUsers)
      await createNotification(u.id,'new_ticket',`Neues Ticket in ${department}: ${title.trim()}`,id,null,req.uid);
    if (assigneeId && assigneeId!==req.uid)
      await createNotification(assigneeId,'assigned',`Dir wurde zugewiesen: ${title.trim()}`,id,null,req.uid);
    ok(res,{id,number});
  } catch(e) { bad(res,e.message,500); }
});
app.put('/api/tickets/:id', auth, async (req,res) => {
  try {
    const tk = await q1('SELECT * FROM tickets WHERE id=$1',[req.params.id]);
    if (!tk) return bad(res,'Nicht gefunden',404);
    if (!canEditTk(req.tp,tk,req.uid)) return bad(res,'Keine Berechtigung',403);
    const b=req.body, setClauses=[], vals=[];
    const add=(col,val)=>{ vals.push(val); setClauses.push(`${col}=$${vals.length}`); };
    const uname=(await getUser(req.uid))?.name||'?';
    const PL={low:'Gering',medium:'Mittel',high:'Hoch'};
    const SL={open:'Offen',in_progress:'In Bearbeitung',on_hold:'Zurückgestellt',closed:'Abgeschlossen'};
    const DL={technik:'Technik',leitung:'Leitung',dienstplanung:'Dienstplanung',ausbildung:'Ausbildung',qm:'QM'};
    if (b.status!==undefined&&b.status!==tk.status) await auditNote(tk.id,req.uid,`🔄 Status: ${SL[tk.status]} → ${SL[b.status]} (${uname})`);
    if (b.priority!==undefined&&b.priority!==tk.priority) await auditNote(tk.id,req.uid,`⚡ Priorität: ${PL[tk.priority]} → ${PL[b.priority]} (${uname})`);
    if (b.department!==undefined&&b.department!==tk.department) await auditNote(tk.id,req.uid,`🏢 Fachbereich: ${DL[tk.department]} → ${DL[b.department]} (${uname})`);
    if (b.assigneeId!==undefined&&b.assigneeId!==tk.assignee_id) {
      const oldN=tk.assignee_id?(await getUser(tk.assignee_id))?.name||'?':'niemand';
      const newN=b.assigneeId?(await getUser(b.assigneeId))?.name||'?':'niemand';
      const msg = b.assigneeId===req.uid ? `🙋 ${uname} hat das Ticket übernommen` : `👤 Zuständigkeit: ${oldN} → ${newN} (${uname})`;
      await auditNote(tk.id,req.uid,msg);
      if (b.assigneeId && b.assigneeId!==req.uid)
        await createNotification(b.assigneeId,'assigned',`Dir wurde zugewiesen: ${tk.title}`,tk.id,null,req.uid);
    }
    if (b.title!==undefined) add('title',b.title);
    if (b.description!==undefined) add('description',b.description);
    if (b.department!==undefined) add('department',b.department);
    if (b.tags!==undefined) add('tags',JSON.stringify(b.tags));
    if (b.priority!==undefined) add('priority',b.priority);
    if (b.status!==undefined) add('status',b.status);
    if (b.bucket!==undefined) add('bucket',b.bucket);
    if (b.isPublic!==undefined) add('is_public',!!b.isPublic);
    if (b.assigneeId!==undefined) add('assignee_id',b.assigneeId||null);
    if (b.parentTicketId!==undefined) add('parent_ticket_id',b.parentTicketId||null);
    if (!setClauses.length) return ok(res);
    add('updated_at',new Date().toISOString());
    vals.push(req.params.id);
    await pool.query(`UPDATE tickets SET ${setClauses.join(',')} WHERE id=$${vals.length}`,vals);
    ok(res);
  } catch(e) { bad(res,e.message,500); }
});
app.delete('/api/tickets/:id', auth, async (req,res) => {
  try {
    const tk = await q1('SELECT * FROM tickets WHERE id=$1',[req.params.id]);
    if (!tk) return bad(res,'Nicht gefunden',404);
    if (!canEditTk(req.tp,tk,req.uid)) return bad(res,'Keine Berechtigung',403);
    await pool.query('DELETE FROM ticket_notes WHERE ticket_id=$1',[req.params.id]);
    await pool.query('DELETE FROM tickets WHERE id=$1',[req.params.id]);
    ok(res);
  } catch(e) { bad(res,e.message,500); }
});
app.post('/api/tickets/:id/notes', auth, async (req,res) => {
  try {
    const tk = await q1('SELECT * FROM tickets WHERE id=$1',[req.params.id]);
    if (!tk) return bad(res,'Nicht gefunden',404);
    if (!canEditTk(req.tp,tk,req.uid)) return bad(res,'Keine Berechtigung',403);
    const text=req.body?.text?.trim();
    if (!text) return bad(res,'Text erforderlich');
    const id=newId(), now=new Date().toISOString();
    await pool.query('INSERT INTO ticket_notes (id,ticket_id,text,author_id,note_type,created_at) VALUES ($1,$2,$3,$4,$5,$6)',
      [id,req.params.id,text,req.uid,'note',now]);
    await pool.query('UPDATE tickets SET updated_at=$1 WHERE id=$2',[now,req.params.id]);
    const allUsers = await q('SELECT id,name FROM users');
    const mentioned = parseMentions(text, allUsers);
    const author = await getUser(req.uid);
    for (const u of mentioned) {
      if (u.id === req.uid) continue;
      await createNotification(u.id,'mention',`${author?.name||'?'} erwähnte dich in ${tk.number}`,tk.id,id,req.uid);
    }
    ok(res,{id,createdAt:now});
  } catch(e) { bad(res,e.message,500); }
});

// TICKET CHECKLISTS
app.post('/api/tickets/:id/checklists', auth, async (req,res) => {
  try {
    const tk = await q1('SELECT * FROM tickets WHERE id=$1',[req.params.id]);
    if (!tk||!canEditTk(req.tp,tk,req.uid)) return bad(res,'Keine Berechtigung',403);
    const tmpl = await q1('SELECT * FROM checklist_templates WHERE id=$1',[req.body.templateId]);
    if (!tmpl) return bad(res,'Vorlage nicht gefunden',404);
    const items = await q('SELECT * FROM checklist_template_items WHERE template_id=$1 ORDER BY sort_order',[tmpl.id]);
    const clId=newId();
    await pool.query('INSERT INTO ticket_checklists (id,ticket_id,template_id,name,created_by) VALUES ($1,$2,$3,$4,$5)',[clId,req.params.id,tmpl.id,tmpl.name,req.uid]);
    for (const item of items)
      await pool.query('INSERT INTO ticket_checklist_items (id,checklist_id,text,item_type,sort_order) VALUES ($1,$2,$3,$4,$5)',
        [newId(),clId,item.text,item.item_type||'check',item.sort_order]);
    await auditNote(req.params.id,req.uid,`📋 Checkliste angehängt: "${tmpl.name}"`);
    ok(res,{id:clId});
  } catch(e) { bad(res,e.message,500); }
});
app.delete('/api/tickets/:id/checklists/:cid', auth, async (req,res) => {
  try {
    const tk = await q1('SELECT * FROM tickets WHERE id=$1',[req.params.id]);
    if (!tk||!canEditTk(req.tp,tk,req.uid)) return bad(res,'Keine Berechtigung',403);
    await pool.query('DELETE FROM ticket_checklist_items WHERE checklist_id=$1',[req.params.cid]);
    await pool.query('DELETE FROM ticket_checklists WHERE id=$1',[req.params.cid]);
    ok(res);
  } catch(e) { bad(res,e.message,500); }
});
app.put('/api/tickets/:id/checklists/:cid/items/:iid', auth, async (req,res) => {
  try {
    const tk = await q1('SELECT * FROM tickets WHERE id=$1',[req.params.id]);
    if (!tk||!canEditTk(req.tp,tk,req.uid)) return bad(res,'Keine Berechtigung',403);
    const item = await q1('SELECT * FROM ticket_checklist_items WHERE id=$1',[req.params.iid]);
    if (!item) return bad(res,'Item nicht gefunden',404);
    const {completed, userNote} = req.body;
    if (completed === true)
      await pool.query('UPDATE ticket_checklist_items SET completed_by=$1,completed_at=NOW(),user_note=$2 WHERE id=$3',
        [req.uid, userNote||item.user_note||'', req.params.iid]);
    else if (completed === false)
      await pool.query('UPDATE ticket_checklist_items SET completed_by=NULL,completed_at=NULL WHERE id=$1',[req.params.iid]);
    else if (userNote !== undefined)
      await pool.query('UPDATE ticket_checklist_items SET user_note=$1 WHERE id=$2',[userNote,req.params.iid]);
    ok(res);
  } catch(e) { bad(res,e.message,500); }
});

// CHECKLIST TEMPLATES
app.post('/api/checklists', auth, async (req,res) => {
  try {
    const {name,department,items=[]} = req.body;
    if (!name?.trim()) return bad(res,'Name erforderlich');
    const id=newId();
    await pool.query('INSERT INTO checklist_templates (id,name,department,created_by) VALUES ($1,$2,$3,$4)',[id,name.trim(),department,req.uid]);
    for (let i=0;i<items.length;i++)
      await pool.query('INSERT INTO checklist_template_items (id,template_id,text,item_type,sort_order) VALUES ($1,$2,$3,$4,$5)',
        [newId(),id,items[i].text||items[i],items[i].itemType||'check',i]);
    ok(res,{id});
  } catch(e) { bad(res,e.message,500); }
});
app.put('/api/checklists/:id', auth, async (req,res) => {
  try {
    const tmpl = await q1('SELECT * FROM checklist_templates WHERE id=$1',[req.params.id]);
    if (!tmpl) return bad(res,'Nicht gefunden',404);
    if (!req.p.roles.includes('admin')&&tmpl.created_by!==req.uid) return bad(res,'Keine Berechtigung',403);
    const {name,department,items=[]} = req.body;
    await pool.query('UPDATE checklist_templates SET name=$1,department=$2 WHERE id=$3',[name.trim(),department,req.params.id]);
    await pool.query('DELETE FROM checklist_template_items WHERE template_id=$1',[req.params.id]);
    for (let i=0;i<items.length;i++)
      await pool.query('INSERT INTO checklist_template_items (id,template_id,text,item_type,sort_order) VALUES ($1,$2,$3,$4,$5)',
        [newId(),req.params.id,items[i].text||items[i],items[i].itemType||'check',i]);
    ok(res);
  } catch(e) { bad(res,e.message,500); }
});
app.delete('/api/checklists/:id', auth, async (req,res) => {
  try {
    const tmpl = await q1('SELECT * FROM checklist_templates WHERE id=$1',[req.params.id]);
    if (!tmpl) return bad(res,'Nicht gefunden',404);
    if (!req.p.roles.includes('admin')&&tmpl.created_by!==req.uid) return bad(res,'Keine Berechtigung',403);
    await pool.query('DELETE FROM checklist_template_items WHERE template_id=$1',[req.params.id]);
    await pool.query('DELETE FROM checklist_templates WHERE id=$1',[req.params.id]);
    ok(res);
  } catch(e) { bad(res,e.message,500); }
});

// ALLOWANCES
app.put('/api/allowances', auth, async (req,res) => {
  try {
    if (!req.p.editAllw) return bad(res,'Keine Berechtigung',403);
    const {userId,year,month,nd,fd,fw,c10} = req.body;
    await pool.query(`INSERT INTO allowances (id,user_id,year,month,nd,fd,fw,c10) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (user_id,year,month) DO UPDATE SET nd=EXCLUDED.nd,fd=EXCLUDED.fd,fw=EXCLUDED.fw,c10=EXCLUDED.c10`,
      [newId(),userId,year,month,nd||0,fd||0,fw||0,c10||0]);
    ok(res);
  } catch(e) { bad(res,e.message,500); }
});

// ABRECHNUNG
app.post('/api/abrechnung/einspringer', auth, async (req,res) => {
  try {
    const {date,note} = req.body;
    if (!date) return bad(res,'Datum erforderlich');
    const id=newId();
    await pool.query('INSERT INTO abrechnung_einspringer (id,user_id,edate,note) VALUES ($1,$2,$3,$4)',
      [id,req.uid,date,note||'']);
    ok(res,{id});
  } catch(e) { bad(res,e.message,500); }
});
app.put('/api/abrechnung/einspringer/:id', auth, async (req, res) => {
  try {
    const row = await q1('SELECT * FROM abrechnung_einspringer WHERE id=$1',[req.params.id]);
    if (!row) return bad(res,'Nicht gefunden',404);
    if (row.user_id!==req.uid&&!req.p.manageUsers) return bad(res,'Keine Berechtigung',403);
    const {date,note} = req.body;
    await pool.query('UPDATE abrechnung_einspringer SET edate=$1,note=$2 WHERE id=$3',[date||row.edate,note??row.note,req.params.id]);
    ok(res);
  } catch(e) { bad(res,e.message,500); }
});
app.delete('/api/abrechnung/einspringer/:id', auth, async (req,res) => {
  try {
    const row = await q1('SELECT * FROM abrechnung_einspringer WHERE id=$1',[req.params.id]);
    if (!row) return bad(res,'Nicht gefunden',404);
    if (row.user_id!==req.uid&&!req.p.manageUsers) return bad(res,'Keine Berechtigung',403);
    await pool.query('DELETE FROM abrechnung_einspringer WHERE id=$1',[req.params.id]);
    ok(res);
  } catch(e) { bad(res,e.message,500); }
});
app.put('/api/abrechnung/homeoffice', auth, async (req,res) => {
  try {
    const {year,month,days} = req.body;
    await pool.query(`INSERT INTO abrechnung_homeoffice (id,user_id,year,month,days) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (user_id,year,month) DO UPDATE SET days=EXCLUDED.days`,
      [newId(),req.uid,year,month,days||0]);
    ok(res);
  } catch(e) { bad(res,e.message,500); }
});

// NOTIFICATIONS
app.post('/api/notifications/:id/read', auth, async (req,res) => {
  try {
    await pool.query('UPDATE notifications SET read_at=NOW() WHERE id=$1 AND user_id=$2',[req.params.id,req.uid]);
    ok(res);
  } catch(e) { bad(res,e.message,500); }
});
app.post('/api/notifications/read-all', auth, async (req,res) => {
  try {
    await pool.query('UPDATE notifications SET read_at=NOW() WHERE user_id=$1 AND read_at IS NULL',[req.uid]);
    ok(res);
  } catch(e) { bad(res,e.message,500); }
});

// MESSAGES
app.post('/api/messages', auth, async (req,res) => {
  try {
    if (!req.p.canSendMessages) return bad(res,'Keine Berechtigung',403);
    const {title,body,targetType,targetValue} = req.body;
    if (!title?.trim()||!body?.trim()) return bad(res,'Titel und Text erforderlich');
    const id=newId();
    await pool.query('INSERT INTO messages (id,title,body,sender_id,target_type,target_value) VALUES ($1,$2,$3,$4,$5,$6)',
      [id,title.trim(),body.trim(),req.uid,targetType||'all',targetValue||null]);
    ok(res,{id});
  } catch(e) { bad(res,e.message,500); }
});
app.post('/api/messages/:id/read', auth, async (req,res) => {
  try {
    await pool.query('INSERT INTO message_reads (id,message_id,user_id) VALUES ($1,$2,$3) ON CONFLICT (message_id,user_id) DO NOTHING',
      [newId(),req.params.id,req.uid]);
    ok(res);
  } catch(e) { bad(res,e.message,500); }
});
app.delete('/api/messages/:id', auth, async (req,res) => {
  try {
    const msg=await q1('SELECT * FROM messages WHERE id=$1',[req.params.id]);
    if (!msg) return bad(res,'Nicht gefunden',404);
    if (!req.p.roles.includes('admin')&&msg.sender_id!==req.uid) return bad(res,'Keine Berechtigung',403);
    await pool.query('DELETE FROM message_reads WHERE message_id=$1',[req.params.id]);
    await pool.query('DELETE FROM messages WHERE id=$1',[req.params.id]);
    ok(res);
  } catch(e) { bad(res,e.message,500); }
});

// CATEGORIES / TAGS / USERS
app.post('/api/categories', auth, adminOnly, async (req,res) => {
  try {
    const {label,emoji,color}=req.body; if (!label?.trim()) return bad(res,'Bezeichnung erforderlich');
    const maxR=await q1('SELECT MAX(sort_order) as m FROM categories'); const id=newId();
    await pool.query('INSERT INTO categories (id,label,emoji,color,sort_order) VALUES ($1,$2,$3,$4,$5)',[id,label.trim(),emoji||'📌',color||'#64748b',(maxR?.m||0)+1]);
    ok(res,{id});
  } catch(e) { bad(res,e.message,500); }
});
app.put('/api/categories/:id', auth, adminOnly, async (req,res) => {
  try { await pool.query('UPDATE categories SET label=$1,emoji=$2,color=$3 WHERE id=$4',[req.body.label,req.body.emoji||'📌',req.body.color||'#64748b',req.params.id]); ok(res); } catch(e) { bad(res,e.message,500); }
});
app.delete('/api/categories/:id', auth, adminOnly, async (req,res) => {
  try { await pool.query('DELETE FROM categories WHERE id=$1',[req.params.id]); ok(res); } catch(e) { bad(res,e.message,500); }
});
app.post('/api/tags', auth, adminOnly, async (req,res) => {
  try {
    const {label,color}=req.body; if (!label?.trim()) return bad(res,'Bezeichnung erforderlich');
    const id=newId(); await pool.query('INSERT INTO tags (id,label,color) VALUES ($1,$2,$3)',[id,label.trim(),color||'#3b6dd4']); ok(res,{id});
  } catch(e) { bad(res,e.message,500); }
});
app.put('/api/tags/:id', auth, adminOnly, async (req,res) => {
  try { await pool.query('UPDATE tags SET label=$1,color=$2 WHERE id=$3',[req.body.label,req.body.color||'#3b6dd4',req.params.id]); ok(res); } catch(e) { bad(res,e.message,500); }
});
app.delete('/api/tags/:id', auth, adminOnly, async (req,res) => {
  try { await pool.query('DELETE FROM tags WHERE id=$1',[req.params.id]); ok(res); } catch(e) { bad(res,e.message,500); }
});
app.post('/api/users', auth, adminOnly, async (req,res) => {
  try {
    const {name,initials,roles,color}=req.body;
    if (!name?.trim()||!initials?.trim()) return bad(res,'Name und Kürzel erforderlich');
    const id=newId(), hash=await bcrypt.hash('Passwort1',10);
    await pool.query('INSERT INTO users (id,name,initials,roles,color,pw_hash,must_change_pw) VALUES ($1,$2,$3,$4,$5,$6,true)',
      [id,name.trim(),initials.trim().toUpperCase(),JSON.stringify(roles||['standard']),color||'#64748b',hash]);
    ok(res,{id});
  } catch(e) { bad(res,e.message,500); }
});
app.put('/api/users/:id', auth, adminOnly, async (req,res) => {
  try {
    const {name,initials,roles,color,resetPassword}=req.body;
    if (!name?.trim()||!initials?.trim()) return bad(res,'Name und Kürzel erforderlich');
    await pool.query('UPDATE users SET name=$1,initials=$2,roles=$3,color=$4 WHERE id=$5',
      [name.trim(),initials.trim().toUpperCase(),JSON.stringify(roles||['standard']),color||'#64748b',req.params.id]);
    if (resetPassword) await pool.query('UPDATE users SET pw_hash=$1,must_change_pw=true WHERE id=$2',
      [await bcrypt.hash('Passwort1',10),req.params.id]);
    ok(res);
  } catch(e) { bad(res,e.message,500); }
});
app.delete('/api/users/:id', auth, adminOnly, async (req,res) => {
  try {
    if (req.params.id===req.uid) return bad(res,'Eigenen Account nicht löschbar');
    await pool.query('DELETE FROM users WHERE id=$1',[req.params.id]); ok(res);
  } catch(e) { bad(res,e.message,500); }
});

// ── DIENSTPLAENE ──────────────────────────────────────────────────────────────
app.post('/api/dienstplaene', auth, async (req,res) => {
  try {
    if (!req.p.addGeneral) return bad(res,'Keine Berechtigung',403);
    const {month,year,label,filename,fileData} = req.body;
    if (!month||!year||!label?.trim()||!fileData) return bad(res,'Alle Felder erforderlich');
    const existing = await q('SELECT id,version FROM dienstplaene WHERE month=$1 AND year=$2 AND is_archived=false',[month,year]);
    let nextVersion = 1;
    for (const ex of existing) {
      await pool.query('UPDATE dienstplaene SET is_archived=true,archived_at=NOW() WHERE id=$1',[ex.id]);
      if (ex.version >= nextVersion) nextVersion = ex.version + 1;
    }
    const id=newId();
    await pool.query('INSERT INTO dienstplaene (id,month,year,label,version,filename,file_data,is_archived,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,false,$8)',
      [id,month,year,label.trim(),nextVersion,filename||'dienstplan.pdf',fileData,req.uid]);
    ok(res,{id,version:nextVersion});
  } catch(e) { bad(res,e.message,500); }
});
app.get('/api/dienstplaene/:id/file', auth, async (req,res) => {
  try {
    const row = await q1('SELECT filename,file_data FROM dienstplaene WHERE id=$1',[req.params.id]);
    if (!row) return bad(res,'Nicht gefunden',404);
    const base64 = row.file_data.replace(/^data:[^;]+;base64,/,'');
    const buf = Buffer.from(base64,'base64');
    res.setHeader('Content-Type','application/pdf');
    res.setHeader('Content-Disposition',`inline; filename="${row.filename}"`);
    res.send(buf);
  } catch(e) { bad(res,e.message,500); }
});
app.delete('/api/dienstplaene/:id', auth, async (req,res) => {
  try {
    if (!req.p.addGeneral) return bad(res,'Keine Berechtigung',403);
    await pool.query('DELETE FROM dienstplaene WHERE id=$1',[req.params.id]);
    ok(res);
  } catch(e) { bad(res,e.message,500); }
});

app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));

initDB().then(()=>{
  app.listen(PORT,'0.0.0.0',()=>{
    console.log(`\n✓ LSt Portal auf Port ${PORT} | ${IS_PROD?'Produktion':'Entwicklung'}\n`);
  });
}).catch(err=>{ console.error('❌ DB-Fehler:',err.message); process.exit(1); });
