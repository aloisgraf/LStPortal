'use strict';
const { Pool } = require('pg');
const crypto   = require('crypto');
const { isAssessmentOnly, canSeeAssessment } = require('./lib/roles');

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

// Jeder Menü-Reiter (public/index.html, Sidebar-Elemente id="ni-<key>") — für
// die "Reiter-Sichtbarkeit" in Einstellungen → Rechte. Reine Anzeige-Steuerung
// im Menü, ersetzt keine serverseitige Route-Absicherung (die bleibt separat
// bestehen, z.B. canManageDp für die Dienstplanungs-Reiter).
const NAV_TABS = [
  {key:'home', label:'Übersicht'},
  {key:'docs', label:'Dokumente'},
  {key:'wiki', label:'Wiki'},
  {key:'meetings', label:'Besprechungen'},
  {key:'todos', label:'Todos'},
  {key:'contacts', label:'Kontakte'},
  {key:'sop', label:'Notfall-Checklisten'},
  {key:'spint', label:'Spindvergabe'},
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
  {key:'tickets_cancelled', label:'Tickets: Stornierte'},
  {key:'tickets_deleted', label:'Tickets: Gelöschte'},
  {key:'checklists', label:'Checklisten'},
  {key:'dp', label:'Dienstplanung: Planerstellung'},
  {key:'dp-config', label:'Dienstplanung: Konfiguration'},
  {key:'dp-christmas', label:'Dienstplanung: Weihnachtsdienst'},
  {key:'dp-mine', label:'Dienstplanung: Mein Dienstplan'},
  {key:'messages', label:'Nachrichten: Eingang'},
  {key:'messages_sent', label:'Nachrichten: Gesendet'},
  {key:'chat', label:'Chat'},
  {key:'news', label:'News'},
  {key:'statistik', label:'Statistik'},
  {key:'assessment', label:'Assessment'},
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
    // Notfall-Checklisten anlegen/bearbeiten/freigeben — standardmäßig "technischer
    // Leiter" (Rolle technik) + admin/leitung, wie in der Anforderung beschrieben.
    // Ausführen dürfen weiterhin alle angemeldeten Nutzer (kein eigenes Recht nötig).
    manageSop: perm('manageSop', has('admin','technik','leitung')),
    // Rolle "Assessment" (lib/roles.js): bewusst NICHT über role_permissions
    // übersteuerbar, damit die serverseitige Sperre nicht versehentlich
    // aufgehoben werden kann.
    assessmentOnly: isAssessmentOnly(roles),
    seeAssessment: canSeeAssessment(roles),
    tabs: getTabVisibility(roles, overrides),
    roles,
  };
}

async function getTP(uid, userObj=null) {
  const u = userObj || await getUser(uid);
  const roles = parseRoles(u?.roles);
  const has = (...r) => r.some(x => roles.includes(x));
  const deptIds = await getDepartmentIds();
  return {
    seeAll: has('admin','leitung'), editAll: has('admin','leitung'),
    myDepts: deptIds.filter(d => roles.includes(d)),
    canSetPublic: !has('standard'), canAssign: !has('standard'),
    canSeeSubcat: has('admin','leitung','schichtleiter','qm'),
    canEditSubcat: has('admin','leitung','schichtleiter','qm'),
    roles,
  };
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
    if (found) return found;
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

module.exports = { pool, q, q1, newId, parseRoles, parseTags, getUser, getUserByUsername, DEPTS, logAct,
  getP, getTP, canSeeTk, canEditTk, nextTicketNumber, auditNote, createNotification,
  parseMentions, isUserActive, NAV_TABS, getTabVisibility, getDepartmentIds, invalidateDeptCache,
  parseRoleList, canSeeAcl, canEditAcl };
