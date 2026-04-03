'use strict';
const { Pool } = require('pg');
const crypto   = require('crypto');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
});

const q   = (sql, p) => pool.query(sql, p).then(r => r.rows);
const q1  = (sql, p) => pool.query(sql, p).then(r => r.rows[0] || null);
const newId = () => crypto.randomUUID();

const parseRoles = r => !r ? ['standard'] : Array.isArray(r) ? r : (()=>{ try{return JSON.parse(r);}catch{return ['standard'];} })();
const parseTags  = t => !t ? [] : Array.isArray(t) ? t : (()=>{ try{return JSON.parse(t);}catch{return [];} })();
const getUser    = id => q1('SELECT * FROM users WHERE id=$1', [id]);
const DEPTS = ['technik','leitung','dienstplanung','ausbildung','qm','frei'];

async function getP(uid) {
  const u = await getUser(uid);
  const roles = parseRoles(u?.roles);
  const has = (...r) => r.some(x => roles.includes(x));
  const full = has('admin','leitung','dienstplanung');
  return {
    manageUsers: has('admin'), editAllPersonal: full,
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
  return {
    seeAll: has('admin','leitung'), editAll: has('admin','leitung'),
    myDepts: DEPTS.filter(d => roles.includes(d)),
    canSetPublic: !has('standard'), canAssign: !has('standard'),
  };
}

const canSeeTk  = (tp,tk,uid) => tp.seeAll || tk.is_public || tk.created_by===uid || tk.department==='frei' || tp.myDepts.includes(tk.department);
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
  msg.sender_id === uid ||
  msg.target_type === 'all' ||
  (msg.target_type === 'user'       && msg.target_value === uid) ||
  (msg.target_type === 'department' && roles.includes(msg.target_value));

module.exports = { pool, q, q1, newId, parseRoles, parseTags, getUser, DEPTS,
  getP, getTP, canSeeTk, canEditTk, nextTicketNumber, auditNote, createNotification,
  parseMentions, canSeeMsg };
