'use strict';
const { Pool } = require('pg');
const crypto   = require('crypto');
const { isAssessmentOnly, canSeeAssessment, canManageAssessment } = require('./lib/roles');
const { derivePermissions, deriveTicketPermissions } = require('./lib/permissions');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  // /api/data (der nach praktisch jeder Speicherung erneut vollständig
  // abgerufen wird) feuert inzwischen weit über 50 Abfragen in einem
  // Promise.all ab — bei nur 10 gleichzeitigen Verbindungen liefen diese in
  // mehreren Wellen nacheinander und verzögerten jeden Speichervorgang
  // messbar. Höherer Pool reduziert die Anzahl Wellen.
  max: 25,
});

const q   = (sql, p) => pool.query(sql, p).then(r => r.rows);
const q1  = (sql, p) => pool.query(sql, p).then(r => r.rows[0] || null);
const newId = () => crypto.randomUUID();

const parseRoles = r => !r ? ['standard'] : Array.isArray(r) ? r : (()=>{ try{return JSON.parse(r);}catch{return ['standard'];} })();
const parseTags  = t => !t ? [] : Array.isArray(t) ? t : (()=>{ try{return JSON.parse(t);}catch{return [];} })();
const getUser    = id => q1('SELECT * FROM users WHERE id=$1', [id]);
const getUserByUsername = username => q1('SELECT * FROM users WHERE LOWER(username)=LOWER($1)', [username]);
const DEPTS = ['technik','leitung','dienstplanung','ausbildung','qm','frei'];

// Fachbereiche sind seit "Spindvergabe" nicht mehr fix im Code verdrahtet,
// sondern in der Tabelle `departments` verwaltet (Admin kann welche
// hinzufügen). DEPTS oben bleibt nur als Fallback, falls die Tabelle einmal
// nicht erreichbar ist. Kurzer Cache analog zur role_permissions-Cache in
// middleware.js, damit nicht bei jedem Request neu abgefragt wird.
let _deptCache = null, _deptCacheTime = 0;
async function getDepartmentIds() {
  if (_deptCache && Date.now()-_deptCacheTime < 300000) return _deptCache;
  try {
    const rows = await q('SELECT id FROM departments');
    _deptCache = rows.map(r => r.id);
    _deptCacheTime = Date.now();
    return _deptCache;
  } catch(e) { return DEPTS; }
}
function invalidateDeptCache() { _deptCache = null; }

// Re-export der zentralen, reinen (DB-freien) Aktiv-Ableitung aus lib/dp-rules.js
// — dort liegt sie, damit sie ohne DB-Verbindung testbar ist (Vitest).
const { isUserActive } = require('./lib/dp-rules');

// Rechte und Reiter-Sichtbarkeit kommen aus lib/permissions.js (Module mit
// Stufen). getP liefert zusätzlich die bisherigen Rechte-Namen (manageUsers,
// canApproveEvents, …), damit die Prüfungen in den Routen weiter gelten.
// Rolle "Assessment" (lib/roles.js): bewusst NICHT über role_permissions
// übersteuerbar, damit die serverseitige Sperre nicht aufgehoben werden kann.
async function getP(uid, userObj=null, overrides=[]) {
  const u = userObj || await getUser(uid);
  const roles = parseRoles(u?.roles);
  return {
    ...derivePermissions(roles, overrides),
    assessmentOnly: isAssessmentOnly(roles),
    seeAssessment: canSeeAssessment(roles),
    manageAssessment: canManageAssessment(roles),
    roles,
  };
}

// p = Ergebnis von getP für denselben Nutzer
async function getTP(uid, userObj=null, p=null) {
  const u = userObj || await getUser(uid);
  const roles = parseRoles(u?.roles);
  const perms = p || derivePermissions(roles, []);
  return deriveTicketPermissions(roles, perms, await getDepartmentIds());
}

// Sichtbarkeit: Ersteller, zugewiesener Bearbeiter und explizit hinzugefügte
// Teilnehmer (participants) sehen ihr Ticket IMMER, unabhängig von
// Sichtbarkeit/Fachbereich. Für alle anderen User desselben Fachbereichs-
// Rechts gilt: nur ÖFFENTLICHE Tickets sind sichtbar — das Flag wird immer
// respektiert (auch ohne zugewiesenen Bearbeiter bleibt ein als "privat"
// markiertes Ticket privat). Neu angelegte Tickets sind daher standardmäßig
// öffentlich (siehe routes/tickets.js POST /), damit unzugewiesene Tickets
// im Fachbereich wie gewohnt sichtbar/übernehmbar bleiben — "privat" muss
// dafür jetzt aktiv gewählt werden statt implizit ignoriert zu werden.
const canSeeTk = (tp,tk,uid) => {
  if(tp.seeAll || tk.created_by===uid || tk.assignee_id===uid || tk.department==='frei') return true;
  try { if (JSON.parse(tk.mentioned_users||'[]').includes(uid)) return true; } catch {}
  try { if (JSON.parse(tk.participants||'[]').includes(uid)) return true; } catch {}
  if(!tk.is_public) return false;
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

// Ordner-/Datei-basierte Sichtbarkeits-/Bearbeitungs-Einschränkung für Dokumente,
// Wiki-Artikel und Kontakte (jeweils optional in Ordnern/Kategorien organisiert).
// Modell: jeder Datensatz UND jeder Ordner trägt optional visible_roles/
// visible_users/editable_roles/editable_users (JSON-Arrays). Hat der Datensatz
// selbst eine Zuweisung (Rolle ODER Nutzer, für "visible" bzw. "editable"
// getrennt betrachtet), gilt NUR diese — sonst wird die Ordnerkette nach oben
// durchsucht (parent_id) bis eine Zuweisung gefunden wird. Ist nirgends in der
// Kette etwas zugewiesen, gilt deny-by-default: nur Ersteller + Admin dürfen
// sehen/bearbeiten — es gibt bewusst KEINEN "leer = für alle sichtbar"-Shortcut
// mehr, eine Rolle bekommt nie implizit Zugriff auf alle Einträge.
const parseRoleList = r => { if(!r) return []; try{ const a = Array.isArray(r)?r:JSON.parse(r); return Array.isArray(a)?a:[]; }catch{ return []; } };

function _aclOwn(item, field) {
  const roles = parseRoleList(item[field+'_roles']);
  const users = parseRoleList(item[field+'_users']);
  return (roles.length || users.length) ? { roles, users } : null;
}
// categoriesById: Map/Objekt aller Ordner DESSELBEN Typs (z.B. alle doc_categories),
// zum Durchlaufen der parent_id-Kette. item.category_id/parent_id verweisen hinein.
function resolveAcl(item, field, categoriesById) {
  const own = _aclOwn(item, field);
  if (own) return own;
  let catId = item.category_id;
  const seen = new Set();
  while (catId && categoriesById && !seen.has(catId)) {
    seen.add(catId);
    const cat = categoriesById[catId];
    if (!cat) break;
    const found = _aclOwn(cat, field);
    if (found) return { ...found, from: cat };
    catId = cat.parent_id;
  }
  return { roles: [], users: [] };
}
function canSeeAcl(item, uid, roles, p, categoriesById) {
  if (p?.manageUsers) return true;
  const creator = item.created_by ?? item.uploaded_by;
  if (creator === uid) return true;
  const src = resolveAcl(item, 'visible', categoriesById);
  if (!src.roles.length && !src.users.length) return false;
  if (src.users.includes(uid)) return true;
  return (roles||[]).some(r => src.roles.includes(r));
}
function canEditAcl(item, uid, roles, p, categoriesById) {
  if (p?.manageUsers) return true;
  const creator = item.created_by ?? item.uploaded_by;
  if (creator === uid) return true;
  const src = resolveAcl(item, 'editable', categoriesById);
  if (!src.roles.length && !src.users.length) return false;
  if (src.users.includes(uid)) return true;
  return (roles||[]).some(r => src.roles.includes(r));
}

// Für die Übersicht "Meine Ordner-Berechtigungen": ob und warum ein Nutzer
// einen Ordner/Eintrag lesen oder schreiben darf (gleiche Regeln wie
// canSeeAcl/canEditAcl). null = kein Zugriff.
function aclAccessInfo(item, uid, roles, p, categoriesById) {
  if (p?.manageUsers) return { access:'schreiben', via:'admin' };
  if ((item.created_by ?? item.uploaded_by) === uid) return { access:'schreiben', via:'creator' };
  const how = field => {
    const src = resolveAcl(item, field, categoriesById);
    const from = src.from ? src.from.name : null;
    if (src.users.includes(uid)) return { via:'user', from };
    const r = (roles||[]).filter(x => src.roles.includes(x));
    return r.length ? { via:'role', roles:r, from } : null;
  };
  const w = how('editable');
  if (w) return { access:'schreiben', ...w };
  const r = how('visible');
  return r ? { access:'lesen', ...r } : null;
}

module.exports = { pool, q, q1, newId, parseRoles, parseTags, getUser, getUserByUsername, DEPTS, logAct,
  getP, getTP, canSeeTk, canEditTk, nextTicketNumber, auditNote, createNotification,
  parseMentions, isUserActive, getDepartmentIds, invalidateDeptCache,
  parseRoleList, canSeeAcl, canEditAcl, aclAccessInfo };
