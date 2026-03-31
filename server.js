'use strict';
require('dotenv').config();

const express     = require('express');
const session     = require('express-session');
const pgSession   = require('connect-pg-simple')(session);
const { Pool }    = require('pg');
const bcrypt      = require('bcryptjs');
const crypto      = require('crypto');
const path        = require('path');

// ══════════════════════════════════════════
// CONFIG
// ══════════════════════════════════════════
const PORT    = parseInt(process.env.PORT || '3000');
const SECRET  = process.env.SESSION_SECRET || 'bitte-aendern-' + crypto.randomBytes(16).toString('hex');
const DB_URL  = process.env.DATABASE_URL;
const IS_PROD = process.env.NODE_ENV === 'production';

if (!DB_URL) {
  console.error('\n❌ DATABASE_URL ist nicht gesetzt! Bitte .env konfigurieren.\n');
  process.exit(1);
}
if (SECRET.startsWith('bitte-aendern-')) {
  console.warn('\n⚠️  WARNUNG: SESSION_SECRET nicht gesetzt! Bitte .env konfigurieren.\n');
}

// ══════════════════════════════════════════
// DATABASE POOL
// ══════════════════════════════════════════
const pool = new Pool({
  connectionString: DB_URL,
  ssl: IS_PROD ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Shorthand query helper
const q = (sql, params) => pool.query(sql, params).then(r => r.rows);
const q1 = (sql, params) => pool.query(sql, params).then(r => r.rows[0] || null);

// ── SCHEMA INIT ──
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      initials    TEXT NOT NULL,
      roles       JSONB NOT NULL DEFAULT '["standard"]',
      color       TEXT NOT NULL DEFAULT '#3b6dd4',
      pw_hash     TEXT NOT NULL,
      must_change_pw BOOLEAN NOT NULL DEFAULT true,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS categories (
      id          TEXT PRIMARY KEY,
      label       TEXT NOT NULL,
      emoji       TEXT NOT NULL DEFAULT '📌',
      color       TEXT NOT NULL DEFAULT '#64748b',
      sort_order  INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS tags (
      id    TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#3b6dd4'
    );
    CREATE TABLE IF NOT EXISTS events (
      id          TEXT PRIMARY KEY,
      is_general  BOOLEAN NOT NULL DEFAULT false,
      date_from   TEXT NOT NULL,
      date_to     TEXT NOT NULL,
      time_from   TEXT DEFAULT '',
      time_to     TEXT DEFAULT '',
      user_id     TEXT,
      category    TEXT,
      reason      TEXT NOT NULL,
      created_by  TEXT NOT NULL,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS tickets (
      id               TEXT PRIMARY KEY,
      number           TEXT NOT NULL UNIQUE,
      title            TEXT NOT NULL,
      description      TEXT DEFAULT '',
      department       TEXT NOT NULL,
      tags             JSONB NOT NULL DEFAULT '[]',
      priority         TEXT NOT NULL DEFAULT 'medium',
      status           TEXT NOT NULL DEFAULT 'open',
      bucket           TEXT DEFAULT '',
      is_public        BOOLEAN NOT NULL DEFAULT false,
      assignee_id      TEXT,
      parent_ticket_id TEXT,
      created_by       TEXT NOT NULL,
      created_at       TIMESTAMPTZ DEFAULT NOW(),
      updated_at       TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS ticket_notes (
      id         TEXT PRIMARY KEY,
      ticket_id  TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      text       TEXT NOT NULL,
      author_id  TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS allowances (
      id      TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      year    INTEGER NOT NULL,
      month   INTEGER NOT NULL,
      nd      INTEGER DEFAULT 0,
      fd      INTEGER DEFAULT 0,
      fw      INTEGER DEFAULT 0,
      c10     INTEGER DEFAULT 0,
      UNIQUE (user_id, year, month)
    );
  `);

  // Seed default data if users table is empty
  const count = await q1('SELECT COUNT(*) as n FROM users');
  if (parseInt(count.n) === 0) {
    const hash = await bcrypt.hash('Passwort1', 10);
    const uid1 = crypto.randomUUID(), uid2 = crypto.randomUUID(), uid3 = crypto.randomUUID();

    await pool.query(`
      INSERT INTO users (id,name,initials,roles,color,pw_hash,must_change_pw) VALUES
      ($1,'Administrator','AD','["admin"]','#3b6dd4',$4,false),
      ($2,'Dienstplanung','DP','["dienstplanung"]','#10b981',$4,false),
      ($3,'Beispiel Mitarbeiter','BM','["standard"]','#e87bb0',$4,true)
    `, [uid1, uid2, uid3, hash]);

    const cats = [
      ['📚','Ausbildung','#10b981',0],['🎓','Kurs / Schulung','#3b6dd4',1],
      ['🎂','Geburtstag','#e87bb0',2],['📝','Dienstwunsch','#7c3aed',3],
      ['🌴','Urlaub','#f59e0b',4],['🏥','Krankenstand','#ef4444',5],['📌','Sonstiges','#64748b',6],
    ];
    for (const [emoji, label, color, i] of cats) {
      await pool.query('INSERT INTO categories (id,label,emoji,color,sort_order) VALUES ($1,$2,$3,$4,$5)',
        [crypto.randomUUID(), label, emoji, color, i]);
    }
    const tagData = [['Bug','#ef4444'],['Feature','#3b6dd4'],['Dringend','#f59e0b'],['Frage','#10b981']];
    for (const [label, color] of tagData) {
      await pool.query('INSERT INTO tags (id,label,color) VALUES ($1,$2,$3)', [crypto.randomUUID(), label, color]);
    }
    console.log('✓ Datenbank initialisiert mit Standard-Daten');
  }
}

// ══════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════
const newId = () => crypto.randomUUID();

async function getUser(id) {
  return q1('SELECT * FROM users WHERE id=$1', [id]);
}
async function getRoles(uid) {
  const u = await getUser(uid);
  const r = u?.roles;
  if (!r) return ['standard'];
  return Array.isArray(r) ? r : JSON.parse(r);
}
async function getP(uid) {
  const roles = await getRoles(uid);
  const has = (...r) => r.some(x => roles.includes(x));
  const full = has('admin', 'leitung', 'dienstplanung');
  return {
    manageUsers:     has('admin'),
    seeAllEntries:   has('admin', 'leitung', 'dienstplanung', 'ausbildung', 'qm'),
    othersBlurred:   !full && has('ausbildung', 'qm'),
    editAllPersonal: full,
    addForOthers:    has('admin', 'leitung', 'dienstplanung', 'ausbildung', 'qm'),
    addGeneral:      has('admin', 'leitung', 'dienstplanung', 'technik', 'ausbildung', 'qm'),
    manageGeneral:   has('admin', 'leitung', 'dienstplanung', 'technik', 'ausbildung', 'qm'),
    seeAllAllw:      full,
    editAllw:        full,
  };
}
async function getTP(uid) {
  const roles = await getRoles(uid);
  const has = (...r) => r.some(x => roles.includes(x));
  const DEPTS = ['technik', 'leitung', 'dienstplanung', 'ausbildung', 'qm'];
  return {
    seeAll:       has('admin', 'leitung'),
    editAll:      has('admin', 'leitung'),
    myDepts:      DEPTS.filter(d => roles.includes(d)),
    canSetPublic: !has('standard'),
    canAssign:    !has('standard'),
  };
}
function canSeeTk(tp, tk, uid) {
  if (tp.seeAll) return true;
  if (tk.is_public) return true;
  if (tk.created_by === uid) return true;
  return tp.myDepts.includes(tk.department);
}
function canEditTk(tp, tk, uid) {
  if (tp.editAll) return true;
  if (tk.created_by === uid) return true;
  return tp.myDepts.includes(tk.department);
}

async function nextTicketNumber() {
  const row = await q1(
    `SELECT number FROM tickets ORDER BY CAST(REPLACE(number,'TK-','') AS INTEGER) DESC LIMIT 1`
  );
  if (!row) return 'TK-1001';
  const n = parseInt(row.number.replace('TK-', '')) + 1;
  return `TK-${n.toString().padStart(4, '0')}`;
}

function parseRoles(r) {
  if (!r) return ['standard'];
  if (Array.isArray(r)) return r;
  try { return JSON.parse(r); } catch { return ['standard']; }
}
function parseTags(t) {
  if (!t) return [];
  if (Array.isArray(t)) return t;
  try { return JSON.parse(t); } catch { return []; }
}

// ══════════════════════════════════════════
// EXPRESS
// ══════════════════════════════════════════
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.set('trust proxy', 1); // Required for Render (behind proxy)

app.use(session({
  store: new pgSession({
    pool,
    tableName: 'sessions',
    createTableIfMissing: true,
  }),
  secret: SECRET,
  resave: false,
  saveUninitialized: false,
  name: 'lst.sid',
  cookie: {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: 'lax',
    maxAge: 10 * 60 * 60 * 1000, // 10h
  },
}));

// ── MIDDLEWARE ──
async function auth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ success: false, error: 'Nicht angemeldet' });
  const user = await getUser(req.session.userId);
  if (!user) { req.session.destroy(() => {}); return res.status(401).json({ success: false, error: 'Benutzer nicht gefunden' }); }
  req.uid  = user.id;
  req.user = user;
  req.p    = await getP(user.id);
  req.tp   = await getTP(user.id);
  next();
}
async function adminOnly(req, res, next) {
  if (!req.p.manageUsers) return res.status(403).json({ success: false, error: 'Keine Berechtigung' });
  next();
}
const ok  = (res, data) => res.json({ success: true, data: data ?? null });
const bad = (res, msg, code = 400) => res.status(code).json({ success: false, error: msg });

// ══════════════════════════════════════════
// AUTH
// ══════════════════════════════════════════
app.get('/api/auth/users', async (req, res) => {
  try {
    const users = await q('SELECT id,name,initials,color,roles FROM users ORDER BY name');
    ok(res, users.map(u => ({ id: u.id, name: u.name, initials: u.initials, color: u.color, roles: parseRoles(u.roles) })));
  } catch (e) { bad(res, e.message, 500); }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { userId, password } = req.body;
    if (!userId || !password) return bad(res, 'Benutzername und Passwort erforderlich');
    const user = await getUser(userId);
    if (!user || !(await bcrypt.compare(password, user.pw_hash))) return bad(res, 'Falsches Passwort', 401);
    req.session.userId = user.id;
    ok(res, { userId: user.id, mustChangePW: user.must_change_pw === true });
  } catch (e) { bad(res, e.message, 500); }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => ok(res));
});

app.get('/api/auth/me', auth, (req, res) => {
  ok(res, { userId: req.uid, mustChangePW: req.user.must_change_pw === true });
});

app.post('/api/auth/change-password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    // For forced PW change: if must_change_pw=true, skip current PW check
    if (!req.user.must_change_pw) {
      if (!(await bcrypt.compare(currentPassword || '', req.user.pw_hash))) return bad(res, 'Aktuelles Passwort falsch');
    }
    if (!newPassword || newPassword.length < 6) return bad(res, 'Passwort muss mindestens 6 Zeichen haben');
    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET pw_hash=$1, must_change_pw=false WHERE id=$2', [hash, req.uid]);
    ok(res);
  } catch (e) { bad(res, e.message, 500); }
});

// ══════════════════════════════════════════
// DATA (single fetch)
// ══════════════════════════════════════════
app.get('/api/data', auth, async (req, res) => {
  try {
    const uid = req.uid, p = req.p, tp = req.tp;

    const [usersRaw, categories, tagsRaw, eventsRaw, ticketsRaw, notesRaw, allowancesRaw] = await Promise.all([
      q('SELECT id,name,initials,roles,color,must_change_pw FROM users ORDER BY name'),
      q('SELECT * FROM categories ORDER BY sort_order, label'),
      q('SELECT * FROM tags ORDER BY label'),
      p.seeAllEntries
        ? q('SELECT * FROM events ORDER BY date_from')
        : q('SELECT * FROM events WHERE is_general=true OR user_id=$1 ORDER BY date_from', [uid]),
      q('SELECT * FROM tickets ORDER BY created_at DESC'),
      q('SELECT * FROM ticket_notes ORDER BY created_at'),
      p.seeAllAllw
        ? q('SELECT * FROM allowances')
        : q('SELECT * FROM allowances WHERE user_id=$1', [uid]),
    ]);

    // Note map
    const noteMap = {};
    notesRaw.forEach(n => {
      if (!noteMap[n.ticket_id]) noteMap[n.ticket_id] = [];
      noteMap[n.ticket_id].push({ id: n.id, text: n.text, authorId: n.author_id, createdAt: n.created_at });
    });

    const users = usersRaw.map(u => ({
      id: u.id, name: u.name, initials: u.initials,
      roles: parseRoles(u.roles), color: u.color, mustChangePW: u.must_change_pw,
    }));

    const events = eventsRaw.map(ev => ({
      id: ev.id, isGeneral: ev.is_general,
      dateFrom: ev.date_from, dateTo: ev.date_to,
      timeFrom: ev.time_from || '', timeTo: ev.time_to || '',
      userId: ev.user_id, category: ev.category, reason: ev.reason,
      createdBy: ev.created_by, createdAt: ev.created_at,
      _blurred: p.othersBlurred && !ev.is_general && ev.user_id !== uid && ev.created_by !== uid,
    }));

    const tickets = ticketsRaw
      .filter(tk => canSeeTk(tp, tk, uid))
      .map(tk => ({
        id: tk.id, number: tk.number, title: tk.title, description: tk.description || '',
        department: tk.department, tags: parseTags(tk.tags),
        priority: tk.priority, status: tk.status, bucket: tk.bucket || '',
        isPublic: tk.is_public, assigneeId: tk.assignee_id,
        parentTicketId: tk.parent_ticket_id, createdBy: tk.created_by,
        createdAt: tk.created_at, updatedAt: tk.updated_at,
        notes: noteMap[tk.id] || [],
        _canEdit: canEditTk(tp, tk, uid),
      }));

    const allowances = allowancesRaw.map(a => ({
      id: a.id, userId: a.user_id, year: a.year, month: a.month,
      nd: a.nd, fd: a.fd, fw: a.fw, c10: a.c10,
    }));

    ok(res, { users, categories, tags: tagsRaw, events, tickets, allowances, currentUser: uid });
  } catch (e) { console.error(e); bad(res, e.message, 500); }
});

// ══════════════════════════════════════════
// EVENTS
// ══════════════════════════════════════════
app.post('/api/events', auth, async (req, res) => {
  try {
    const { isGeneral, dateFrom, dateTo, timeFrom, timeTo, userId, category, reason } = req.body;
    if (!dateFrom || !reason?.trim()) return bad(res, 'Datum und Beschreibung erforderlich');
    if (!isGeneral && !userId) return bad(res, 'Mitarbeiter erforderlich');
    if (isGeneral && !req.p.addGeneral) return bad(res, 'Keine Berechtigung', 403);
    if (!isGeneral && userId !== req.uid && !req.p.addForOthers) return bad(res, 'Keine Berechtigung', 403);
    const id = newId();
    await pool.query(
      'INSERT INTO events (id,is_general,date_from,date_to,time_from,time_to,user_id,category,reason,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
      [id, !!isGeneral, dateFrom, dateTo || dateFrom, timeFrom || '', timeTo || '', isGeneral ? null : userId, category || '', reason.trim(), req.uid]
    );
    ok(res, { id });
  } catch (e) { bad(res, e.message, 500); }
});

app.delete('/api/events/:id', auth, async (req, res) => {
  try {
    const ev = await q1('SELECT * FROM events WHERE id=$1', [req.params.id]);
    if (!ev) return bad(res, 'Eintrag nicht gefunden', 404);
    const canDel = (ev.is_general && req.p.manageGeneral)
      || (!ev.is_general && (req.p.editAllPersonal || ev.created_by === req.uid));
    if (!canDel) return bad(res, 'Keine Berechtigung', 403);
    await pool.query('DELETE FROM events WHERE id=$1', [req.params.id]);
    ok(res);
  } catch (e) { bad(res, e.message, 500); }
});

// ══════════════════════════════════════════
// TICKETS
// ══════════════════════════════════════════
app.post('/api/tickets', auth, async (req, res) => {
  try {
    const { title, description, department, tags, priority, status, bucket, assigneeId, parentTicketId } = req.body;
    if (!title?.trim()) return bad(res, 'Titel erforderlich');
    const id = newId();
    const number = await nextTicketNumber();
    await pool.query(
      'INSERT INTO tickets (id,number,title,description,department,tags,priority,status,bucket,assignee_id,parent_ticket_id,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
      [id, number, title.trim(), description || '', department || 'technik', JSON.stringify(tags || []), priority || 'medium', status || 'open', bucket || '', assigneeId || null, parentTicketId || null, req.uid]
    );
    ok(res, { id, number });
  } catch (e) { bad(res, e.message, 500); }
});

app.put('/api/tickets/:id', auth, async (req, res) => {
  try {
    const tk = await q1('SELECT * FROM tickets WHERE id=$1', [req.params.id]);
    if (!tk) return bad(res, 'Ticket nicht gefunden', 404);
    if (!canEditTk(req.tp, tk, req.uid)) return bad(res, 'Keine Berechtigung', 403);

    const b = req.body;
    const setClauses = [], vals = [];
    const add = (col, val) => { vals.push(val); setClauses.push(`${col}=$${vals.length}`); };

    if (b.title       !== undefined) add('title', b.title);
    if (b.description !== undefined) add('description', b.description);
    if (b.department  !== undefined) add('department', b.department);
    if (b.tags        !== undefined) add('tags', JSON.stringify(b.tags));
    if (b.priority    !== undefined) add('priority', b.priority);
    if (b.status      !== undefined) add('status', b.status);
    if (b.bucket      !== undefined) add('bucket', b.bucket);
    if (b.isPublic    !== undefined) add('is_public', !!b.isPublic);
    if (b.assigneeId  !== undefined) add('assignee_id', b.assigneeId || null);
    if (b.parentTicketId !== undefined) add('parent_ticket_id', b.parentTicketId || null);
    add('updated_at', new Date().toISOString());

    vals.push(req.params.id);
    await pool.query(`UPDATE tickets SET ${setClauses.join(',')} WHERE id=$${vals.length}`, vals);
    ok(res);
  } catch (e) { bad(res, e.message, 500); }
});

app.delete('/api/tickets/:id', auth, async (req, res) => {
  try {
    const tk = await q1('SELECT * FROM tickets WHERE id=$1', [req.params.id]);
    if (!tk) return bad(res, 'Ticket nicht gefunden', 404);
    if (!canEditTk(req.tp, tk, req.uid)) return bad(res, 'Keine Berechtigung', 403);
    await pool.query('DELETE FROM ticket_notes WHERE ticket_id=$1', [req.params.id]);
    await pool.query('DELETE FROM tickets WHERE id=$1', [req.params.id]);
    ok(res);
  } catch (e) { bad(res, e.message, 500); }
});

app.post('/api/tickets/:id/notes', auth, async (req, res) => {
  try {
    const tk = await q1('SELECT * FROM tickets WHERE id=$1', [req.params.id]);
    if (!tk) return bad(res, 'Ticket nicht gefunden', 404);
    if (!canEditTk(req.tp, tk, req.uid)) return bad(res, 'Keine Berechtigung', 403);
    const text = req.body?.text?.trim();
    if (!text) return bad(res, 'Notiztext erforderlich');
    const id = newId(), now = new Date().toISOString();
    await pool.query('INSERT INTO ticket_notes (id,ticket_id,text,author_id,created_at) VALUES ($1,$2,$3,$4,$5)', [id, req.params.id, text, req.uid, now]);
    await pool.query('UPDATE tickets SET updated_at=$1 WHERE id=$2', [now, req.params.id]);
    ok(res, { id, createdAt: now });
  } catch (e) { bad(res, e.message, 500); }
});

// ══════════════════════════════════════════
// ALLOWANCES
// ══════════════════════════════════════════
app.put('/api/allowances', auth, async (req, res) => {
  try {
    if (!req.p.editAllw) return bad(res, 'Keine Berechtigung', 403);
    const { userId, year, month, nd, fd, fw, c10 } = req.body;
    await pool.query(`
      INSERT INTO allowances (id, user_id, year, month, nd, fd, fw, c10)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT (user_id, year, month)
      DO UPDATE SET nd=EXCLUDED.nd, fd=EXCLUDED.fd, fw=EXCLUDED.fw, c10=EXCLUDED.c10
    `, [newId(), userId, year, month, nd || 0, fd || 0, fw || 0, c10 || 0]);
    ok(res);
  } catch (e) { bad(res, e.message, 500); }
});

// ══════════════════════════════════════════
// CATEGORIES
// ══════════════════════════════════════════
app.post('/api/categories', auth, adminOnly, async (req, res) => {
  try {
    const { label, emoji, color } = req.body;
    if (!label?.trim()) return bad(res, 'Bezeichnung erforderlich');
    const maxR = await q1('SELECT MAX(sort_order) as m FROM categories');
    const maxOrder = maxR?.m || 0;
    const id = newId();
    await pool.query('INSERT INTO categories (id,label,emoji,color,sort_order) VALUES ($1,$2,$3,$4,$5)', [id, label.trim(), emoji || '📌', color || '#64748b', maxOrder + 1]);
    ok(res, { id });
  } catch (e) { bad(res, e.message, 500); }
});
app.put('/api/categories/:id', auth, adminOnly, async (req, res) => {
  try {
    const { label, emoji, color } = req.body;
    await pool.query('UPDATE categories SET label=$1,emoji=$2,color=$3 WHERE id=$4', [label, emoji || '📌', color || '#64748b', req.params.id]);
    ok(res);
  } catch (e) { bad(res, e.message, 500); }
});
app.delete('/api/categories/:id', auth, adminOnly, async (req, res) => {
  try {
    await pool.query('DELETE FROM categories WHERE id=$1', [req.params.id]);
    ok(res);
  } catch (e) { bad(res, e.message, 500); }
});

// ══════════════════════════════════════════
// TAGS
// ══════════════════════════════════════════
app.post('/api/tags', auth, adminOnly, async (req, res) => {
  try {
    const { label, color } = req.body;
    if (!label?.trim()) return bad(res, 'Bezeichnung erforderlich');
    const id = newId();
    await pool.query('INSERT INTO tags (id,label,color) VALUES ($1,$2,$3)', [id, label.trim(), color || '#3b6dd4']);
    ok(res, { id });
  } catch (e) { bad(res, e.message, 500); }
});
app.put('/api/tags/:id', auth, adminOnly, async (req, res) => {
  try {
    await pool.query('UPDATE tags SET label=$1,color=$2 WHERE id=$3', [req.body.label, req.body.color || '#3b6dd4', req.params.id]);
    ok(res);
  } catch (e) { bad(res, e.message, 500); }
});
app.delete('/api/tags/:id', auth, adminOnly, async (req, res) => {
  try {
    await pool.query('DELETE FROM tags WHERE id=$1', [req.params.id]);
    ok(res);
  } catch (e) { bad(res, e.message, 500); }
});

// ══════════════════════════════════════════
// USERS
// ══════════════════════════════════════════
app.post('/api/users', auth, adminOnly, async (req, res) => {
  try {
    const { name, initials, roles, color } = req.body;
    if (!name?.trim() || !initials?.trim()) return bad(res, 'Name und Kürzel erforderlich');
    const id = newId();
    const hash = await bcrypt.hash('Passwort1', 10);
    await pool.query(
      'INSERT INTO users (id,name,initials,roles,color,pw_hash,must_change_pw) VALUES ($1,$2,$3,$4,$5,$6,true)',
      [id, name.trim(), initials.trim().toUpperCase(), JSON.stringify(roles || ['standard']), color || '#64748b', hash]
    );
    ok(res, { id });
  } catch (e) { bad(res, e.message, 500); }
});
app.put('/api/users/:id', auth, adminOnly, async (req, res) => {
  try {
    const { name, initials, roles, color, resetPassword } = req.body;
    if (!name?.trim() || !initials?.trim()) return bad(res, 'Name und Kürzel erforderlich');
    await pool.query(
      'UPDATE users SET name=$1,initials=$2,roles=$3,color=$4 WHERE id=$5',
      [name.trim(), initials.trim().toUpperCase(), JSON.stringify(roles || ['standard']), color || '#64748b', req.params.id]
    );
    if (resetPassword) {
      const hash = await bcrypt.hash('Passwort1', 10);
      await pool.query('UPDATE users SET pw_hash=$1,must_change_pw=true WHERE id=$2', [hash, req.params.id]);
    }
    ok(res);
  } catch (e) { bad(res, e.message, 500); }
});
app.delete('/api/users/:id', auth, adminOnly, async (req, res) => {
  try {
    if (req.params.id === req.uid) return bad(res, 'Eigenen Account nicht löschbar');
    await pool.query('DELETE FROM users WHERE id=$1', [req.params.id]);
    ok(res);
  } catch (e) { bad(res, e.message, 500); }
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
initDB()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n✓ LSt Portal gestartet`);
      console.log(`  URL:       http://localhost:${PORT}`);
      console.log(`  Datenbank: PostgreSQL (Supabase)`);
      console.log(`  Umgebung:  ${IS_PROD ? 'Produktion' : 'Entwicklung'}`);
      console.log('\n  Standard-Zugangsdaten:');
      console.log('  Administrator / Passwort1');
      console.log('  Dienstplanung / Passwort1\n');
    });
  })
  .catch(err => {
    console.error('❌ Datenbankfehler beim Start:', err.message);
    process.exit(1);
  });
