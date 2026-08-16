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
const getUserByUsername = username => q1('SELECT * FROM users WHERE LOWER(username)=LOWER($1)', [username]);
const DEPTS = ['technik','leitung','dienstplanung','ausbildung','qm','frei'];

// Re-export der zentralen, reinen (DB-freien) Aktiv-Ableitung aus lib/dp-rules.js
// — dort liegt sie, damit sie ohne DB-Verbindung testbar ist (Vitest).
const { isUserActive } = require('./lib/dp-rules');

// Jeder Menü-Reiter (public/index.html, Sidebar-Elemente id="ni-<key>") — für
// die "Reiter-Sichtbarkeit" in Einstellungen → Rechte. Reine Anzeige-Steuerung
// im Menü, ersetzt keine serverseitige Route-Absicherung (die bleibt separat
// bestehen, z.B. canManageDp für die Dienstplanungs-Reiter).
const NAV_TABS = [
  {key:'home', label:'Übersicht'},
  {key:'docs', label:'Dokumente'},
  {key:'meetings', label:'Besprechungen'},
  {key:'todos', label:'Todos'},
  {key:'schedule', label:'Dienstplan (Kalender)'},
  {key:'allw', label:'Zulagendienste'},
  {key:'homeoffice', label:'Homeoffice'},
  {key:'vacation', label:'Urlaubsübersicht'},
  {key:'diensttausch', label:'Diensttausch'},
  {key:'abrechnung', label:'Abrechnung'},
  {key:'dienstplaene', label:'Dienstpläne'},
  {key:'zahnarzt', label:'Dienstplan Zahnärzte'},
  {key:'platz', label:'Platzübersicht'},
  {key:'links', label:'Links'},
  {key:'tickets', label:'Tickets: Offene'},
  {key:'tickets_closed', label:'Tickets: Abgeschlossene'},
  {key:'tickets_deleted', label:'Tickets: Gelöschte'},
  {key:'checklists', label:'Checklisten'},
  {key:'dp', label:'Dienstplanung: Planerstellung'},
  {key:'dp-config', label:'Dienstplanung: Konfiguration'},
  {key:'dp-christmas', label:'Dienstplanung: Weihnachtsdienst'},
  {key:'dp-mine', label:'Dienstplanung: Mein Dienstplan'},
  {key:'messages', label:'Nachrichten: Eingang'},
  {key:'messages_sent', label:'Nachrichten: Gesendet'},
  {key:'news', label:'News'},
  {key:'statistik', label:'Statistik'},
];

// Wendet dieselbe "Grant gewinnt über Deny"-Merge-Logik wie getP()/overrideMap
// an, aber auf role_permissions-Zeilen mit dem Schlüsselpräfix "tab:<key>".
// Default (kein Override vorhanden) = sichtbar, damit ein neu hinzugefügter
// Reiter nicht versehentlich für alle verschwindet.
function getTabVisibility(roles, overrides) {
  const ovMap = {};
  (overrides||[]).forEach(o => {
    if (!roles.includes(o.role) || !o.permission.startsWith('tab:')) return;
    const key = o.permission.slice(4);
    if (o.granted && ovMap[key] !== false) ovMap[key] = true;
    else if (!o.granted && ovMap[key] === undefined) ovMap[key] = false;
  });
  const result = {};
  NAV_TABS.forEach(t => { result[t.key] = ovMap[t.key] !== undefined ? ovMap[t.key] : true; });
  return result;
}

async function getP(uid, userObj=null, overrides=[]) {
  const u = userObj || await getUser(uid);
  const roles = parseRoles(u?.roles);
  const has = (...r) => r.some(x => roles.includes(x));
  const full = has('admin','leitung','dienstplanung');
  // Build overrideMap: for each permission, if any role grants explicitly, use that
  const overrideMap = {};
  (overrides||[]).forEach(o => {
    if(roles.includes(o.role)) {
      if(o.granted && overrideMap[o.permission] !== false) overrideMap[o.permission] = true;
      else if(!o.granted && overrideMap[o.permission] === undefined) overrideMap[o.permission] = false;
    }
  });
  const perm = (key, defaultVal) => overrideMap[key] !== undefined ? overrideMap[key] : defaultVal;
  return {
    manageUsers: perm('manageUsers', has('admin')),
    editAllPersonal: perm('editAllPersonal', full),
    addForOthers: perm('addForOthers', has('admin','leitung','dienstplanung','ausbildung','qm')),
    addGeneral: perm('addGeneral', has('admin','leitung','dienstplanung','technik','ausbildung','qm')),
    manageGeneral: perm('manageGeneral', has('admin','leitung','dienstplanung','technik','ausbildung','qm')),
    seeAllAllw: perm('seeAllAllw', full),
    editAllw: perm('editAllw', full),
    canApproveEvents: perm('canApproveEvents', has('admin','dienstplanung','leitung')),
    canSendMessages: perm('canSendMessages', !has('standard')),
    seeAllAbrechnung: perm('seeAllAbrechnung', has('admin','dienstplanung')),
    tabs: getTabVisibility(roles, overrides),
    roles,
  };
}

async function getTP(uid, userObj=null) {
  const u = userObj || await getUser(uid);
  const roles = parseRoles(u?.roles);
  const has = (...r) => r.some(x => roles.includes(x));
  return {
    seeAll: has('admin','leitung'), editAll: has('admin','leitung'),
    myDepts: DEPTS.filter(d => roles.includes(d)),
    canSetPublic: !has('standard'), canAssign: !has('standard'),
    canSeeSubcat: has('admin','leitung','schichtleiter','qm'),
    canEditSubcat: has('admin','leitung','schichtleiter','qm'),
    roles,
  };
}

// Sichtbarkeit: Ersteller, zugewiesener Bearbeiter und explizit hinzugefügte
// Teilnehmer (participants) sehen ihr Ticket IMMER, unabhängig von
// Sichtbarkeit/Fachbereich. Für alle anderen User desselben Fachbereichs-
// Rechts gilt: nur ÖFFENTLICHE Tickets sind sichtbar. Ein Ticket OHNE
// zugewiesenen Bearbeiter gilt automatisch als öffentlich (es gibt sonst
// niemanden, der es exklusiv bearbeiten könnte).
const canSeeTk = (tp,tk,uid) => {
  if(tp.seeAll || tk.created_by===uid || tk.assignee_id===uid || tk.department==='frei') return true;
  try { if (JSON.parse(tk.mentioned_users||'[]').includes(uid)) return true; } catch {}
  try { if (JSON.parse(tk.participants||'[]').includes(uid)) return true; } catch {}
  const isPublic = !!tk.is_public || !tk.assignee_id;
  if(!isPublic) return false;
  if(tp.myDepts.includes(tk.department)) return true;
  if(tk.subcategory && tp.canSeeSubcat) return true;
  return false;
};
const canEditTk = (tp,tk,uid) => {
  if(tp.editAll || tk.created_by===uid || tk.assignee_id===uid || tp.myDepts.includes(tk.department)) return true;
  if(tk.subcategory && tp.canEditSubcat) return true;
  return false;
};

async function nextTicketNumber() {
  const row = await q1(`SELECT nextval('ticket_number_seq') as n`);
  return `TK-${parseInt(row.n).toString().padStart(4,'0')}`;
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


async function logAct(uid, name, action, details={}) {
  await pool.query(
    'INSERT INTO activity_log (id,user_id,user_name,action,details,created_at) VALUES ($1,$2,$3,$4,$5,NOW())',
    [newId(), uid, name, action, JSON.stringify(details)]
  ).catch(()=>{});
}

module.exports = { pool, q, q1, newId, parseRoles, parseTags, getUser, getUserByUsername, DEPTS, logAct,
  getP, getTP, canSeeTk, canEditTk, nextTicketNumber, auditNote, createNotification,
  parseMentions, isUserActive, NAV_TABS, getTabVisibility };
