'use strict';
require('dotenv').config();
const express   = require('express');
const session   = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const path      = require('path');
const crypto    = require('crypto');

const PORT   = parseInt(process.env.PORT || '3000');
const SECRET = process.env.SESSION_SECRET || 'bitte-aendern-' + crypto.randomBytes(16).toString('hex');
if (!process.env.DATABASE_URL) { console.error('❌ DATABASE_URL fehlt!'); process.exit(1); }
if (SECRET.startsWith('bitte-aendern-')) console.warn('⚠️  SESSION_SECRET nicht gesetzt!');

const { pool, q, q1, newId } = require('./db');
const bcrypt = require('bcryptjs');

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
      rejected_by TEXT, rejected_reason TEXT, rejected_at TIMESTAMPTZ,
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
    `ALTER TABLE abrechnung_einspringer ADD COLUMN IF NOT EXISTS rejected_by TEXT`,
    `ALTER TABLE abrechnung_einspringer ADD COLUMN IF NOT EXISTS rejected_reason TEXT`,
    `ALTER TABLE abrechnung_einspringer ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ`,
    `ALTER TABLE messages ADD COLUMN IF NOT EXISTS from_user_id TEXT`,
    `ALTER TABLE messages ADD COLUMN IF NOT EXISTS to_department TEXT`,
    `ALTER TABLE messages ADD COLUMN IF NOT EXISTS title TEXT`,
    `ALTER TABLE messages ADD COLUMN IF NOT EXISTS body TEXT`,
    `ALTER TABLE events ADD COLUMN IF NOT EXISTS approved TEXT DEFAULT 'pending'`,
    `ALTER TABLE ticket_notes ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT false`,
    `ALTER TABLE ticket_notes ALTER COLUMN author_id DROP NOT NULL`,
    `CREATE TABLE IF NOT EXISTS message_reads (id TEXT PRIMARY KEY, message_id TEXT NOT NULL, user_id TEXT NOT NULL, read_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE(message_id, user_id))`,
    `CREATE TABLE IF NOT EXISTS activity_log (id TEXT PRIMARY KEY, user_id TEXT, user_name TEXT, action TEXT NOT NULL, details JSONB DEFAULT '{}', ip TEXT, created_at TIMESTAMPTZ DEFAULT NOW())`,
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

const app = express();
app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('trust proxy', 1);
app.use(session({
  store: new pgSession({ pool, tableName: 'sessions', createTableIfMissing: true }),
  secret: SECRET, resave: false, saveUninitialized: false, name: 'lst.sid',
  cookie: { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 36000000 },
}));

// ── ROUTES ──
app.use('/api/auth',    require('./routes/auth'));
app.use('/api/data',    require('./routes/data'));
app.use('/api/events',  require('./routes/events'));
app.use('/api/tickets', require('./routes/tickets'));
app.use('/api',         require('./routes/misc'));

app.get('*', (req,res) => res.sendFile(path.join(__dirname,'public','index.html')));

// ── START ──
initDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n✓ LSt Portal – http://localhost:${PORT}`);
    console.log(`  DB: ${process.env.DATABASE_URL?.slice(0,40)}...`);
    console.log(`  Env: ${process.env.NODE_ENV || 'development'}\n`);
  });
}).catch(err => { console.error('❌ DB-Fehler:', err.message); process.exit(1); });
