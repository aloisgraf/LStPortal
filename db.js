'use strict';
const { Pool } = require('pg');

const IS_PROD = process.env.NODE_ENV === 'production';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: IS_PROD ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

const q  = (sql, p) => pool.query(sql, p).then(r => r.rows);
const q1 = (sql, p) => pool.query(sql, p).then(r => r.rows[0] || null);

const parseRoles = r => Array.isArray(r) ? r : (r ? (typeof r === 'string' ? JSON.parse(r) : r) : ['standard']);
const parseTags  = t => Array.isArray(t) ? t : (t ? (typeof t === 'string' ? JSON.parse(t) : t) : []);

const DEPTS = ['technik', 'leitung', 'dienstplanung', 'ausbildung', 'qm'];

async function getUser(id) {
  return q1('SELECT * FROM users WHERE id=$1', [id]);
}

async function getP(uid) {
  const u = await getUser(uid);
  const roles = parseRoles(u?.roles);
  const has = (...r) => r.some(x => roles.includes(x));
  const full = has('admin', 'leitung', 'dienstplanung');
  return {
    isAdmin: has('admin'), manageUsers: has('admin'),
    isDP: has('admin', 'leitung', 'dienstplanung'),
    seeAllEntries: has('admin', 'leitung', 'dienstplanung', 'ausbildung', 'qm'),
    othersBlurred: !full && has('ausbildung', 'qm'),
    editAllPersonal: full,
    addForOthers: has('admin', 'leitung', 'dienstplanung', 'ausbildung', 'qm'),
    addGeneral: has('admin', 'leitung', 'dienstplanung', 'technik', 'ausbildung', 'qm'),
    manageGeneral: has('admin', 'leitung', 'dienstplanung', 'technik', 'ausbildung', 'qm'),
    seeAllAllw: full, editAllw: full,
    canApproveEvents: has('admin', 'leitung', 'dienstplanung'),
    roles,
  };
}

async function getTP(uid) {
  const u = await getUser(uid);
  const roles = parseRoles(u?.roles);
  const has = (...r) => r.some(x => roles.includes(x));
  const myDepts = DEPTS.filter(d => roles.includes(d));
  return {
    seeAll: has('admin', 'leitung'), editAll: has('admin', 'leitung'),
    myDepts, canSetPublic: !has('standard'), canAssign: !has('standard'),
    isStandard: has('standard') && myDepts.length === 0, roles,
  };
}

const canSeeTk  = (tp, tk, uid) => tp.seeAll || tk.is_public || tk.created_by === uid || tp.myDepts.includes(tk.department);
const canEditTk = (tp, tk, uid) => tp.editAll || tk.created_by === uid || tp.myDepts.includes(tk.department);

async function logActivity(uid, userName, action, details = {}, ip = null) {
  const { randomUUID } = require('crypto');
  await pool.query(
    'INSERT INTO activity_log (id,user_id,user_name,action,details,ip) VALUES ($1,$2,$3,$4,$5,$6)',
    [randomUUID(), uid, userName, action, JSON.stringify(details), ip]
  ).catch(() => {});
}

async function addSystemNote(ticketId, text) {
  const { randomUUID } = require('crypto');
  await pool.query(
    'INSERT INTO ticket_notes (id,ticket_id,text,author_id,is_system,created_at) VALUES ($1,$2,$3,NULL,true,NOW())',
    [randomUUID(), ticketId, text]
  ).catch(() => {});
}

module.exports = { pool, q, q1, parseRoles, parseTags, DEPTS, getUser, getP, getTP, canSeeTk, canEditTk, logActivity, addSystemNote };
