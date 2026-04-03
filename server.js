'use strict';
require('dotenv').config();

const express    = require('express');
const session    = require('express-session');
const pgSession  = require('connect-pg-simple')(session);
const crypto     = require('crypto');
const path       = require('path');

const PORT    = parseInt(process.env.PORT || '3000');
const SECRET  = process.env.SESSION_SECRET || 'bitte-aendern-' + crypto.randomBytes(16).toString('hex');
const IS_PROD = process.env.NODE_ENV === 'production';

if (!process.env.DATABASE_URL) { console.error('❌ DATABASE_URL fehlt!'); process.exit(1); }
if (SECRET.startsWith('bitte-aendern-')) console.warn('⚠️  SESSION_SECRET nicht gesetzt!');

const { pool } = require('./db');

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
      id TEXT PRIMARY KEY,
      ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      text TEXT NOT NULL, author_id TEXT, is_system BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS allowances (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
      year INTEGER NOT NULL, month INTEGER NOT NULL,
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
      id TEXT PRIMARY KEY,
      template_id TEXT NOT NULL REFERENCES checklist_templates(id) ON DELETE CASCADE,
      text TEXT NOT NULL, sort_order INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS ticket_checklists (
      id TEXT PRIMARY KEY,
      ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      template_id TEXT REFERENCES checklist_templates(id),
      name TEXT NOT NULL, created_by TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS ticket_checklist_items (
      id TEXT PRIMARY KEY,
      checklist_id TEXT NOT NULL REFERENCES ticket_checklists(id) ON DELETE CASCADE,
      text TEXT NOT NULL, checked BOOLEAN DEFAULT false,
      checked_by TEXT, checked_at TIMESTAMPTZ, sort_order INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY, from_user_id TEXT NOT NULL, to_department TEXT,
      title TEXT NOT NULL, body TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS message_acks (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL, acked_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(message_id, user_id)
    );
  `);
  for (const m of [
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ`,
    `ALTER TABLE events ADD COLUMN IF NOT EXISTS approved TEXT DEFAULT 'pending'`,
    `ALTER TABLE ticket_notes ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT false`,
    `ALTER TABLE ticket_notes ALTER COLUMN author_id DROP NOT NULL`,
  ]) await pool.query(m).catch(() => {});

  const cnt = await pool.query('SELECT COUNT(*) as n FROM users').then(r => r.rows[0]);
  if (parseInt(cnt.n) === 0) {
    const bcrypt = require('bcryptjs');
    const { randomUUID } = crypto;
    const hash = await bcrypt.hash('Passwort1', 10);
    await pool.query(`INSERT INTO users (id,name,initials,roles,color,pw_hash,must_change_pw) VALUES
      ($1,'Administrator','AD','["admin"]','#3b6dd4',$4,false),
      ($2,'Dienstplanung','DP','["dienstplanung"]','#10b981',$4,false),
      ($3,'Beispiel Mitarbeiter','BM','["standard"]','#e87bb0',$4,true)`,
      [randomUUID(), randomUUID(), randomUUID(), hash]);
    for (const [e,l,c,i] of [['📚','Ausbildung','#10b981',0],['🎓','Kurs / Schulung','#3b6dd4',1],['🎂','Geburtstag','#e87bb0',2],['📝','Dienstwunsch','#7c3aed',3],['🌴','Urlaub','#f59e0b',4],['🏥','Krankenstand','#ef4444',5],['📌','Sonstiges','#64748b',6]])
      await pool.query('INSERT INTO categories (id,label,emoji,color,sort_order) VALUES ($1,$2,$3,$4,$5)', [randomUUID(),l,e,c,i]);
    for (const [l,c] of [['Bug','#ef4444'],['Feature','#3b6dd4'],['Dringend','#f59e0b'],['Frage','#10b981']])
      await pool.query('INSERT INTO tags (id,label,color) VALUES ($1,$2,$3)', [randomUUID(),l,c]);
    console.log('✓ Datenbank initialisiert – Login: Administrator / Passwort1');
  }
}

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.set('trust proxy', 1);
app.use(session({
  store: new pgSession({ pool, tableName: 'sessions', createTableIfMissing: true }),
  secret: SECRET, resave: false, saveUninitialized: false, name: 'lst.sid',
  cookie: { httpOnly: true, secure: IS_PROD, sameSite: 'lax', maxAge: 10 * 60 * 60 * 1000 },
}));

app.use('/api/auth',    require('./routes/auth'));
app.use('/api/data',    require('./routes/data'));
app.use('/api/events',  require('./routes/events'));
app.use('/api/tickets', require('./routes/tickets'));
app.use('/api',         require('./routes/misc'));

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

initDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n✓ LSt Portal – http://localhost:${PORT}`);
    console.log(`  Umgebung: ${IS_PROD ? 'Produktion' : 'Entwicklung'}\n`);
  });
}).catch(e => { console.error('❌', e.message); process.exit(1); });
