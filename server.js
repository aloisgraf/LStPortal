'use strict';
require('dotenv').config();

const express    = require('express');
const session    = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const Database   = require('better-sqlite3');
const bcrypt     = require('bcryptjs');
const crypto     = require('crypto');
const path       = require('path');
const fs         = require('fs');

// ══════════════════════════════════════════
// CONFIG
// ══════════════════════════════════════════
const PORT    = parseInt(process.env.PORT || '3000');
const SECRET  = process.env.SESSION_SECRET || 'bitte-aendern-' + crypto.randomBytes(16).toString('hex');
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
const IS_PROD  = process.env.NODE_ENV === 'production';

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_FILE = path.join(DATA_DIR, 'lst.db');

if (SECRET.startsWith('bitte-aendern-')) {
  console.warn('\n⚠️  WARNUNG: SESSION_SECRET nicht gesetzt! Bitte .env konfigurieren.\n');
}

// ══════════════════════════════════════════
// DATABASE
// ══════════════════════════════════════════
const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    initials TEXT NOT NULL,
    roles TEXT NOT NULL DEFAULT '["standard"]',
    color TEXT NOT NULL DEFAULT '#3b6dd4',
    pw_hash TEXT NOT NULL,
    must_change_pw INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    emoji TEXT NOT NULL DEFAULT '📌',
    color TEXT NOT NULL DEFAULT '#64748b',
    sort_order INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#3b6dd4'
  );
  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    is_general INTEGER NOT NULL DEFAULT 0,
    date_from TEXT NOT NULL,
    date_to TEXT NOT NULL,
    time_from TEXT DEFAULT '',
    time_to TEXT DEFAULT '',
    user_id TEXT,
    category TEXT,
    reason TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS tickets (
    id TEXT PRIMARY KEY,
    number TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    department TEXT NOT NULL,
    tags TEXT NOT NULL DEFAULT '[]',
    priority TEXT NOT NULL DEFAULT 'medium',
    status TEXT NOT NULL DEFAULT 'open',
    bucket TEXT DEFAULT '',
    is_public INTEGER NOT NULL DEFAULT 0,
    assignee_id TEXT,
    parent_ticket_id TEXT,
    created_by TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS ticket_notes (
    id TEXT PRIMARY KEY,
    ticket_id TEXT NOT NULL,
    text TEXT NOT NULL,
    author_id TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS allowances (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    nd INTEGER DEFAULT 0,
    fd INTEGER DEFAULT 0,
    fw INTEGER DEFAULT 0,
    c10 INTEGER DEFAULT 0,
    UNIQUE(user_id, year, month)
  );
`);

// ── SEED DEFAULT DATA ──
const userCount = db.prepare('SELECT COUNT(*) as n FROM users').get();
if (userCount.n === 0) {
  const hash = bcrypt.hashSync('Passwort1', 10);
  const newId = () => crypto.randomUUID();
  const iU = db.prepare('INSERT INTO users (id,name,initials,roles,color,pw_hash,must_change_pw) VALUES (?,?,?,?,?,?,?)');
  const iC = db.prepare('INSERT INTO categories (id,label,emoji,color,sort_order) VALUES (?,?,?,?,?)');
  const iT = db.prepare('INSERT INTO tags (id,label,color) VALUES (?,?,?)');

  iU.run(newId(),'Administrator','AD','["admin"]','#3b6dd4',hash,0);
  iU.run(newId(),'Dienstplanung','DP','["dienstplanung"]','#10b981',hash,0);
  iU.run(newId(),'Beispiel Mitarbeiter','BM','["standard"]','#e87bb0',hash,1);

  const cats = [
    ['📚','Ausbildung','#10b981',0],['🎓','Kurs / Schulung','#3b6dd4',1],
    ['🎂','Geburtstag','#e87bb0',2],['📝','Dienstwunsch','#7c3aed',3],
    ['🌴','Urlaub','#f59e0b',4],['🏥','Krankenstand','#ef4444',5],
    ['📌','Sonstiges','#64748b',6],
  ];
  cats.forEach(([emoji,label,color,i]) => iC.run(newId(),label,emoji,color,i));

  const tags = [['Bug','#ef4444'],['Feature','#3b6dd4'],['Dringend','#f59e0b'],['Frage','#10b981']];
  tags.forEach(([label,color]) => iT.run(newId(),label,color));

  console.log('✓ Datenbank initialisiert');
  console.log('  Login: Administrator / Passwort1');
  console.log('  Login: Dienstplanung / Passwort1');
}

// ══════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════
const newId = () => crypto.randomUUID();

const getUser  = id => db.prepare('SELECT * FROM users WHERE id=?').get(id);
const getRoles = uid => { const u = getUser(uid); return u ? JSON.parse(u.roles || '["standard"]') : ['standard']; };
const hasRole  = (uid, ...rs) => rs.some(r => getRoles(uid).includes(r));

function getP(uid) {
  const roles = getRoles(uid);
  const has = (...r) => r.some(x => roles.includes(x));
  const full = has('admin','leitung','dienstplanung');
  return {
    manageUsers:    has('admin'),
    seeAllEntries:  has('admin','leitung','dienstplanung','ausbildung','qm'),
    othersBlurred:  !full && has('ausbildung','qm'),
    editAllPersonal: full,
    addForOthers:   has('admin','leitung','dienstplanung','ausbildung','qm'),
    addGeneral:     has('admin','leitung','dienstplanung','technik','ausbildung','qm'),
    manageGeneral:  has('admin','leitung','dienstplanung','technik','ausbildung','qm'),
    seeAllAllw:     full,
    editAllw:       full,
  };
}

function getTP(uid) {
  const roles = getRoles(uid);
  const has = (...r) => r.some(x => roles.includes(x));
  return {
    seeAll:      has('admin','leitung'),
    editAll:     has('admin','leitung'),
    myDepts:     ['technik','leitung','dienstplanung','ausbildung','qm'].filter(d => roles.includes(d)),
    canSetPublic: !has('standard'),
    canAssign:   !has('standard'),
  };
}

function canSeeTk(uid, tk) {
  const tp = getTP(uid);
  if (tp.seeAll) return true;
  if (tk.is_public) return true;
  if (tk.created_by === uid) return true;
  return tp.myDepts.includes(tk.department);
}

function canEditTk(uid, tk) {
  const tp = getTP(uid);
  if (tp.editAll) return true;
  if (tk.created_by === uid) return true;
  return tp.myDepts.includes(tk.department);
}

function nextTicketNumber() {
  const row = db.prepare(
    "SELECT number FROM tickets ORDER BY CAST(REPLACE(number,'TK-','') AS INTEGER) DESC LIMIT 1"
  ).get();
  if (!row) return 'TK-1001';
  const n = parseInt(row.number.replace('TK-','')) + 1;
  return `TK-${n.toString().padStart(4,'0')}`;
}

// ══════════════════════════════════════════
// EXPRESS
// ══════════════════════════════════════════
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  store: new SQLiteStore({ db: 'sessions.db', dir: DATA_DIR, concurrentDB: true }),
  secret: SECRET,
  resave: false,
  saveUninitialized: false,
  name: 'lst.sid',
  cookie: {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: 'lax',
    maxAge: 10 * 60 * 60 * 1000, // 10h
  }
}));

// ── MIDDLEWARE ──
function auth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ success: false, error: 'Nicht angemeldet' });
  const user = getUser(req.session.userId);
  if (!user) { req.session.destroy(() => {}); return res.status(401).json({ success: false, error: 'Benutzer nicht gefunden' }); }
  req.uid  = user.id;
  req.user = user;
  req.p    = getP(user.id);
  req.tp   = getTP(user.id);
  next();
}
function adminOnly(req, res, next) {
  if (!req.p.manageUsers) return res.status(403).json({ success: false, error: 'Keine Berechtigung' });
  next();
}
const ok  = (res, data) => res.json({ success: true, data: data ?? null });
const bad = (res, msg, code = 400) => res.status(code).json({ success: false, error: msg });

// ══════════════════════════════════════════
// AUTH ROUTES
// ══════════════════════════════════════════
// Public user list for login grid
app.get('/api/auth/users', (req, res) => {
  const users = db.prepare('SELECT id,name,initials,color,roles FROM users ORDER BY name').all()
    .map(u => ({ id: u.id, name: u.name, initials: u.initials, color: u.color, roles: JSON.parse(u.roles || '["standard"]') }));
  ok(res, users);
});

app.post('/api/auth/login', (req, res) => {
  const { userId, password } = req.body;
  if (!userId || !password) return bad(res, 'Benutzername und Passwort erforderlich');
  const user = getUser(userId);
  if (!user || !bcrypt.compareSync(password, user.pw_hash)) return bad(res, 'Falsches Passwort', 401);
  req.session.userId = user.id;
  ok(res, { userId: user.id, mustChangePW: user.must_change_pw === 1 });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => ok(res));
});

app.get('/api/auth/me', auth, (req, res) => {
  ok(res, { userId: req.uid, mustChangePW: req.user.must_change_pw === 1 });
});

app.post('/api/auth/change-password', auth, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!bcrypt.compareSync(currentPassword || '', req.user.pw_hash)) return bad(res, 'Aktuelles Passwort falsch');
  if (!newPassword || newPassword.length < 6) return bad(res, 'Passwort muss mindestens 6 Zeichen haben');
  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET pw_hash=?,must_change_pw=0 WHERE id=?').run(hash, req.uid);
  ok(res);
});

// ══════════════════════════════════════════
// DATA ENDPOINT (single fetch for entire state)
// ══════════════════════════════════════════
app.get('/api/data', auth, (req, res) => {
  const uid = req.uid;
  const p   = req.p;

  // Users (strip pw_hash)
  const users = db.prepare('SELECT id,name,initials,roles,color,must_change_pw FROM users ORDER BY name').all()
    .map(u => ({ id:u.id, name:u.name, initials:u.initials, roles:JSON.parse(u.roles), color:u.color, mustChangePW: u.must_change_pw===1 }));

  // Categories & tags
  const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order,label').all();
  const tags = db.prepare('SELECT * FROM tags ORDER BY label').all();

  // Events (filtered by permissions)
  let evRows = db.prepare('SELECT * FROM events ORDER BY date_from').all();
  if (!p.seeAllEntries) {
    evRows = evRows.filter(ev => ev.is_general || ev.user_id === uid);
  }
  const events = evRows.map(ev => ({
    id: ev.id, isGeneral: ev.is_general===1,
    dateFrom: ev.date_from, dateTo: ev.date_to,
    timeFrom: ev.time_from||'', timeTo: ev.time_to||'',
    userId: ev.user_id, category: ev.category, reason: ev.reason,
    createdBy: ev.created_by, createdAt: ev.created_at,
    _blurred: p.othersBlurred && !ev.is_general && ev.user_id !== uid && ev.created_by !== uid
  }));

  // Tickets (filtered by permissions) + notes
  const allNotes = db.prepare('SELECT * FROM ticket_notes ORDER BY created_at').all();
  const noteMap  = {};
  allNotes.forEach(n => {
    if (!noteMap[n.ticket_id]) noteMap[n.ticket_id] = [];
    noteMap[n.ticket_id].push({ id:n.id, text:n.text, authorId:n.author_id, createdAt:n.created_at });
  });

  const tickets = db.prepare('SELECT * FROM tickets ORDER BY created_at DESC').all()
    .filter(tk => canSeeTk(uid, tk))
    .map(tk => ({
      id:tk.id, number:tk.number, title:tk.title, description:tk.description||'',
      department:tk.department, tags:JSON.parse(tk.tags||'[]'),
      priority:tk.priority, status:tk.status, bucket:tk.bucket||'',
      isPublic:tk.is_public===1, assigneeId:tk.assignee_id,
      parentTicketId:tk.parent_ticket_id, createdBy:tk.created_by,
      createdAt:tk.created_at, updatedAt:tk.updated_at,
      notes: noteMap[tk.id] || [],
      _canEdit: canEditTk(uid, tk)
    }));

  // Allowances (filtered)
  const allwRows = p.seeAllAllw
    ? db.prepare('SELECT * FROM allowances').all()
    : db.prepare('SELECT * FROM allowances WHERE user_id=?').all(uid);
  const allowances = allwRows.map(a => ({ id:a.id, userId:a.user_id, year:a.year, month:a.month, nd:a.nd, fd:a.fd, fw:a.fw, c10:a.c10 }));

  ok(res, { users, categories, tags, events, tickets, allowances, currentUser: uid });
});

// ══════════════════════════════════════════
// EVENTS
// ══════════════════════════════════════════
app.post('/api/events', auth, (req, res) => {
  const { isGeneral, dateFrom, dateTo, timeFrom, timeTo, userId, category, reason } = req.body;
  if (!dateFrom || !reason?.trim()) return bad(res, 'Datum und Beschreibung erforderlich');
  if (!isGeneral && !userId) return bad(res, 'Mitarbeiter erforderlich');
  if (isGeneral && !req.p.addGeneral) return bad(res, 'Keine Berechtigung für allgemeine Einträge', 403);
  if (!isGeneral && userId !== req.uid && !req.p.addForOthers) return bad(res, 'Keine Berechtigung', 403);
  const id = newId();
  db.prepare('INSERT INTO events (id,is_general,date_from,date_to,time_from,time_to,user_id,category,reason,created_by) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .run(id, isGeneral?1:0, dateFrom, dateTo||dateFrom, timeFrom||'', timeTo||'', isGeneral?null:userId, category||'', reason.trim(), req.uid);
  ok(res, { id });
});

app.delete('/api/events/:id', auth, (req, res) => {
  const ev = db.prepare('SELECT * FROM events WHERE id=?').get(req.params.id);
  if (!ev) return bad(res, 'Eintrag nicht gefunden', 404);
  const canDel = (ev.is_general && req.p.manageGeneral)
    || (!ev.is_general && (req.p.editAllPersonal || ev.created_by === req.uid));
  if (!canDel) return bad(res, 'Keine Berechtigung', 403);
  db.prepare('DELETE FROM events WHERE id=?').run(req.params.id);
  ok(res);
});

// ══════════════════════════════════════════
// TICKETS
// ══════════════════════════════════════════
app.post('/api/tickets', auth, (req, res) => {
  const { title, description, department, tags, priority, status, bucket, assigneeId, parentTicketId } = req.body;
  if (!title?.trim()) return bad(res, 'Titel erforderlich');
  const id = newId();
  const number = nextTicketNumber();
  const now = new Date().toISOString();
  db.prepare('INSERT INTO tickets (id,number,title,description,department,tags,priority,status,bucket,assignee_id,parent_ticket_id,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(id, number, title.trim(), description||'', department||'technik', JSON.stringify(tags||[]), priority||'medium', status||'open', bucket||'', assigneeId||null, parentTicketId||null, req.uid, now, now);
  ok(res, { id, number });
});

app.put('/api/tickets/:id', auth, (req, res) => {
  const tk = db.prepare('SELECT * FROM tickets WHERE id=?').get(req.params.id);
  if (!tk) return bad(res, 'Ticket nicht gefunden', 404);
  if (!canEditTk(req.uid, tk)) return bad(res, 'Keine Berechtigung', 403);
  const b = req.body;
  const now = new Date().toISOString();
  const fields = {};
  if (b.title       !== undefined) fields.title = b.title;
  if (b.description !== undefined) fields.description = b.description;
  if (b.department  !== undefined) fields.department = b.department;
  if (b.tags        !== undefined) fields.tags = JSON.stringify(b.tags);
  if (b.priority    !== undefined) fields.priority = b.priority;
  if (b.status      !== undefined) fields.status = b.status;
  if (b.bucket      !== undefined) fields.bucket = b.bucket;
  if (b.isPublic    !== undefined) fields.is_public = b.isPublic ? 1 : 0;
  if (b.assigneeId  !== undefined) fields.assignee_id = b.assigneeId || null;
  if (b.parentTicketId !== undefined) fields.parent_ticket_id = b.parentTicketId || null;
  fields.updated_at = now;
  const set = Object.keys(fields).map(k => `${k}=?`).join(',');
  db.prepare(`UPDATE tickets SET ${set} WHERE id=?`).run(...Object.values(fields), req.params.id);
  ok(res);
});

app.delete('/api/tickets/:id', auth, (req, res) => {
  const tk = db.prepare('SELECT * FROM tickets WHERE id=?').get(req.params.id);
  if (!tk) return bad(res, 'Ticket nicht gefunden', 404);
  if (!canEditTk(req.uid, tk)) return bad(res, 'Keine Berechtigung', 403);
  db.prepare('DELETE FROM ticket_notes WHERE ticket_id=?').run(req.params.id);
  db.prepare('DELETE FROM tickets WHERE id=?').run(req.params.id);
  ok(res);
});

app.post('/api/tickets/:id/notes', auth, (req, res) => {
  const tk = db.prepare('SELECT * FROM tickets WHERE id=?').get(req.params.id);
  if (!tk) return bad(res, 'Ticket nicht gefunden', 404);
  if (!canEditTk(req.uid, tk)) return bad(res, 'Keine Berechtigung', 403);
  const text = req.body?.text?.trim();
  if (!text) return bad(res, 'Notiztext erforderlich');
  const id = newId();
  const now = new Date().toISOString();
  db.prepare('INSERT INTO ticket_notes (id,ticket_id,text,author_id,created_at) VALUES (?,?,?,?,?)').run(id, req.params.id, text, req.uid, now);
  db.prepare('UPDATE tickets SET updated_at=? WHERE id=?').run(now, req.params.id);
  ok(res, { id, createdAt: now });
});

// ══════════════════════════════════════════
// ALLOWANCES
// ══════════════════════════════════════════
app.put('/api/allowances', auth, (req, res) => {
  if (!req.p.editAllw) return bad(res, 'Keine Berechtigung', 403);
  const { userId, year, month, nd, fd, fw, c10 } = req.body;
  const ex = db.prepare('SELECT id FROM allowances WHERE user_id=? AND year=? AND month=?').get(userId, year, month);
  if (ex) {
    db.prepare('UPDATE allowances SET nd=?,fd=?,fw=?,c10=? WHERE user_id=? AND year=? AND month=?').run(nd||0,fd||0,fw||0,c10||0,userId,year,month);
  } else {
    db.prepare('INSERT INTO allowances (id,user_id,year,month,nd,fd,fw,c10) VALUES (?,?,?,?,?,?,?,?)').run(newId(),userId,year,month,nd||0,fd||0,fw||0,c10||0);
  }
  ok(res);
});

// ══════════════════════════════════════════
// CATEGORIES
// ══════════════════════════════════════════
app.post('/api/categories', auth, adminOnly, (req, res) => {
  const { label, emoji, color } = req.body;
  if (!label?.trim()) return bad(res, 'Bezeichnung erforderlich');
  const id = newId();
  const maxOrder = db.prepare('SELECT MAX(sort_order) as m FROM categories').get().m || 0;
  db.prepare('INSERT INTO categories (id,label,emoji,color,sort_order) VALUES (?,?,?,?,?)').run(id,label.trim(),emoji||'📌',color||'#64748b',maxOrder+1);
  ok(res, { id });
});
app.put('/api/categories/:id', auth, adminOnly, (req, res) => {
  const { label, emoji, color } = req.body;
  db.prepare('UPDATE categories SET label=?,emoji=?,color=? WHERE id=?').run(label,emoji||'📌',color||'#64748b',req.params.id);
  ok(res);
});
app.delete('/api/categories/:id', auth, adminOnly, (req, res) => {
  db.prepare('DELETE FROM categories WHERE id=?').run(req.params.id);
  ok(res);
});

// ══════════════════════════════════════════
// TAGS
// ══════════════════════════════════════════
app.post('/api/tags', auth, adminOnly, (req, res) => {
  const { label, color } = req.body;
  if (!label?.trim()) return bad(res, 'Bezeichnung erforderlich');
  const id = newId();
  db.prepare('INSERT INTO tags (id,label,color) VALUES (?,?,?)').run(id,label.trim(),color||'#3b6dd4');
  ok(res, { id });
});
app.put('/api/tags/:id', auth, adminOnly, (req, res) => {
  const { label, color } = req.body;
  db.prepare('UPDATE tags SET label=?,color=? WHERE id=?').run(label,color||'#3b6dd4',req.params.id);
  ok(res);
});
app.delete('/api/tags/:id', auth, adminOnly, (req, res) => {
  db.prepare('DELETE FROM tags WHERE id=?').run(req.params.id);
  ok(res);
});

// ══════════════════════════════════════════
// USERS (admin only)
// ══════════════════════════════════════════
app.post('/api/users', auth, adminOnly, (req, res) => {
  const { name, initials, roles, color } = req.body;
  if (!name?.trim() || !initials?.trim()) return bad(res, 'Name und Kürzel erforderlich');
  const id = newId();
  const hash = bcrypt.hashSync('Passwort1', 10);
  db.prepare('INSERT INTO users (id,name,initials,roles,color,pw_hash,must_change_pw) VALUES (?,?,?,?,?,?,1)')
    .run(id, name.trim(), initials.trim().toUpperCase(), JSON.stringify(roles||['standard']), color||'#64748b', hash);
  ok(res, { id });
});
app.put('/api/users/:id', auth, adminOnly, (req, res) => {
  const { name, initials, roles, color, resetPassword } = req.body;
  if (!name?.trim() || !initials?.trim()) return bad(res, 'Name und Kürzel erforderlich');
  db.prepare('UPDATE users SET name=?,initials=?,roles=?,color=? WHERE id=?')
    .run(name.trim(), initials.trim().toUpperCase(), JSON.stringify(roles||['standard']), color||'#64748b', req.params.id);
  if (resetPassword) {
    db.prepare('UPDATE users SET pw_hash=?,must_change_pw=1 WHERE id=?').run(bcrypt.hashSync('Passwort1',10), req.params.id);
  }
  ok(res);
});
app.delete('/api/users/:id', auth, adminOnly, (req, res) => {
  if (req.params.id === req.uid) return bad(res, 'Eigenen Account nicht löschbar');
  db.prepare('DELETE FROM users WHERE id=?').run(req.params.id);
  ok(res);
});

// ══════════════════════════════════════════
// CATCH-ALL → SPA
// ══════════════════════════════════════════
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ══════════════════════════════════════════
// START
// ══════════════════════════════════════════
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n✓ LSt Portal gestartet`);
  console.log(`  URL:       http://localhost:${PORT}`);
  console.log(`  Datenbank: ${DB_FILE}`);
  console.log(`  Umgebung:  ${IS_PROD ? 'Produktion' : 'Entwicklung'}`);
  console.log('\n  Zugangsdaten (Standard):');
  console.log('  Administrator / Passwort1');
  console.log('  Dienstplanung / Passwort1\n');
});
