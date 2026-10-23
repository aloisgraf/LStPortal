'use strict';
// Rechte-Modell "Module mit Stufen" — DB-frei, damit es ohne Datenbank testbar
// ist (test/permissions.test.mjs). Einzige Quelle für Module, Stufen, Reiter
// und Standardwerte: der Server prüft daraus, die Rechte-Matrix in
// Einstellungen → Rechte wird daraus gebaut (über /api/data).
//
// - Jede Rolle hat pro Modul genau eine Stufe. Die Stufen eines Moduls sind
//   aufsteigend sortiert, eine höhere Stufe schließt die niedrigeren ein.
// - Ein Reiter ist sichtbar, sobald die Stufe seines Moduls nicht "aus" ist.
// - Mehrere Rollen: pro Modul gilt die höchste Stufe (Rechte sind additiv).
// - Administrator hat immer die höchste Stufe und ist nicht übersteuerbar.
// - Rolle Assessment trägt nichts bei; Bewerber/Prüfer regelt lib/roles.js.
// - Übersteuerungen liegen in role_permissions: permission "mod:<modul>" mit
//   Spalte level, bzw. "flag:<schalter>" mit Spalte granted.

const ROLE_IDS = ['admin','leitung','dienstplanung','schichtleiter','technik','ausbildung','qm','standard'];

const AUS = { id:'aus', label:'kein Zugriff' };
const lv = (id, label) => ({ id, label });

// defaults: Stufe je Rolle, '*' = alle übrigen Rollen (auch selbst angelegte
// Fachbereiche). Werte entsprechen dem Verhalten vor der Umstellung.
const MODULES = [
  { key:'uebersicht', label:'Übersicht', tabs:['home'],
    levels:[AUS, lv('an','sichtbar')], defaults:{'*':'an'} },
  { key:'kalender', label:'Kalender und Urlaubsübersicht', tabs:['schedule','vacation'],
    levels:[AUS, lv('eigene','eigene Einträge'), lv('fuerAndere','für andere eintragen'), lv('genehmigen','alle sehen + genehmigen'), lv('verwalten','alle bearbeiten')],
    hint:'Ohne „alle sehen“ werden fremde Einträge anonymisiert. „genehmigen“ umfasst auch Urlaubs-Kontingente.',
    defaults:{leitung:'verwalten', dienstplanung:'verwalten', ausbildung:'fuerAndere', qm:'fuerAndere', '*':'eigene'} },
  { key:'zulagen', label:'Zulagendienste', tabs:['allw'],
    levels:[AUS, lv('eigene','eigene'), lv('alle','alle sehen'), lv('bearbeiten','alle bearbeiten')],
    defaults:{leitung:'bearbeiten', dienstplanung:'bearbeiten', '*':'eigene'} },
  { key:'abrechnung', label:'Abrechnung', tabs:['abrechnung'],
    levels:[AUS, lv('eigene','eigene'), lv('alle','alle sehen')],
    defaults:{dienstplanung:'alle', '*':'eigene'} },
  { key:'homeoffice', label:'Homeoffice', tabs:['homeoffice'],
    levels:[AUS, lv('nutzen','nutzen'), lv('verwalten','Plätze verwalten')],
    defaults:{leitung:'verwalten', dienstplanung:'verwalten', '*':'nutzen'} },
  { key:'diensttausch', label:'Diensttausch', tabs:['diensttausch'],
    levels:[AUS, lv('nutzen','nutzen'), lv('verwalten','alle sehen + entscheiden')],
    defaults:{leitung:'verwalten', dienstplanung:'verwalten', '*':'nutzen'} },
  { key:'dienstplaene', label:'Dienstpläne (PDF)', tabs:['dienstplaene'],
    levels:[AUS, lv('sehen','sehen'), lv('hochladen','hochladen')],
    defaults:{leitung:'hochladen', dienstplanung:'hochladen', technik:'hochladen', ausbildung:'hochladen', qm:'hochladen', '*':'sehen'} },
  { key:'dienstplanung', label:'Dienstplanung (Planerstellung, Konfiguration, Weihnachtsdienst)', tabs:['dp','dp-config','dp-christmas'],
    levels:[AUS, lv('verwalten','Pläne erstellen')],
    hint:'Stammdaten der Konfiguration bleiben der Administration vorbehalten.',
    defaults:{leitung:'verwalten', dienstplanung:'verwalten', '*':'aus'} },
  { key:'meinDienstplan', label:'Mein Dienstplan', tabs:['dp-mine'],
    levels:[AUS, lv('an','sichtbar')], defaults:{'*':'an'} },
  { key:'zahnarzt', label:'Dienstplan Zahnärzte', tabs:['zahnarzt'],
    levels:[AUS, lv('sehen','sehen'), lv('bearbeiten','eintragen + hochladen'), lv('verwalten','auch löschen')],
    defaults:{technik:'verwalten', leitung:'bearbeiten', dienstplanung:'bearbeiten', '*':'sehen'} },
  { key:'platz', label:'Platzübersicht', tabs:['platz'],
    levels:[AUS, lv('sehen','sehen'), lv('verwalten','Ausfälle verwalten')],
    defaults:{leitung:'verwalten', technik:'verwalten', '*':'sehen'} },
  { key:'links', label:'Links', tabs:['links'],
    levels:[AUS, lv('an','sichtbar')], defaults:{'*':'an'} },
  { key:'tickets', label:'Tickets', tabs:['tickets','tickets_closed','tickets_cancelled','tickets_deleted'],
    levels:[AUS, lv('eigene','eigene'), lv('fachbereich','eigener Fachbereich, zuweisen'), lv('alle','alle sehen + bearbeiten')],
    hint:'„eigener Fachbereich“ gilt für die Fachbereiche, die der Person als Rolle zugeordnet sind.',
    defaults:{leitung:'alle', standard:'eigene', '*':'fachbereich'} },
  { key:'checklisten', label:'Checklisten (Ticket-Vorlagen)', tabs:['checklists'],
    levels:[AUS, lv('nutzen','nutzen'), lv('verwalten','alle Vorlagen bearbeiten')],
    defaults:{'*':'nutzen'} },
  { key:'sop', label:'Notfall-Checklisten', tabs:['sop'],
    levels:[AUS, lv('ausfuehren','ausführen'), lv('verwalten','Vorlagen verwalten')],
    defaults:{leitung:'verwalten', technik:'verwalten', '*':'ausfuehren'} },
  { key:'spind', label:'Spindvergabe', tabs:['spint'],
    levels:[AUS, lv('verwalten','verwalten')],
    defaults:{leitung:'verwalten', technik:'verwalten', '*':'aus'} },
  { key:'nachrichten', label:'Nachrichten', tabs:['messages','messages_sent'],
    levels:[AUS, lv('lesen','lesen'), lv('senden','senden'), lv('alleFachbereiche','senden + alle Fachbereiche lesen')],
    defaults:{leitung:'alleFachbereiche', standard:'lesen', '*':'senden'} },
  { key:'chat', label:'Chat', tabs:['chat'],
    levels:[AUS, lv('an','sichtbar')], defaults:{'*':'an'} },
  { key:'news', label:'News', tabs:['news'],
    levels:[AUS, lv('lesen','lesen'), lv('verwalten','verwalten')],
    defaults:{leitung:'verwalten', '*':'lesen'} },
  { key:'dokumente', label:'Dokumente', tabs:['docs'],
    levels:[AUS, lv('lesen','lesen'), lv('anlegen','anlegen')],
    hint:'Was jemand lesen darf, regelt zusätzlich die Freigabe am Ordner/Dokument.',
    defaults:{leitung:'anlegen', dienstplanung:'anlegen', technik:'anlegen', ausbildung:'anlegen', qm:'anlegen', '*':'lesen'} },
  { key:'wiki', label:'Wiki', tabs:['wiki'],
    levels:[AUS, lv('lesen','lesen'), lv('anlegen','anlegen')],
    defaults:{leitung:'anlegen', dienstplanung:'anlegen', technik:'anlegen', ausbildung:'anlegen', qm:'anlegen', '*':'lesen'} },
  { key:'kontakte', label:'Kontakte', tabs:['contacts'],
    levels:[AUS, lv('lesen','lesen'), lv('anlegen','anlegen')],
    defaults:{leitung:'anlegen', dienstplanung:'anlegen', technik:'anlegen', ausbildung:'anlegen', qm:'anlegen', '*':'lesen'} },
  { key:'besprechungen', label:'Besprechungen', tabs:['meetings'],
    levels:[AUS, lv('an','sichtbar')], defaults:{'*':'an'} },
  { key:'todos', label:'Todos', tabs:['todos'],
    levels:[AUS, lv('an','sichtbar')], defaults:{'*':'an'} },
  { key:'statistik', label:'Statistik', tabs:['statistik'],
    levels:[AUS, lv('sehen','sehen')], defaults:{'*':'aus'} },
  { key:'administration', label:'Administration (Benutzer, Rechte, Stammdaten, Aktivitätslog)', tabs:[],
    levels:[AUS, lv('an','voller Zugriff')],
    hint:'Entspricht dem Administrator. Nur vergeben, wenn die Rolle wirklich alles dürfen soll.',
    defaults:{'*':'aus'} },
];

// Einzelschalter ohne Rangfolge
const FLAGS = [
  { key:'allgemein', label:'Allgemeine Kalendereinträge anlegen und verwalten',
    roles:['leitung','dienstplanung','technik','ausbildung','qm'] },
  { key:'beschwerden', label:'Tickets: Unterkategorien (Beschwerden) sehen und bearbeiten',
    roles:['leitung','schichtleiter','qm'] },
];

const MOD = Object.fromEntries(MODULES.map(m => [m.key, m]));
const levelIndex = (key, id) => MOD[key].levels.findIndex(l => l.id === id);
const maxLevel = key => MOD[key].levels[MOD[key].levels.length-1].id;

function defaultLevel(key, role) {
  if (role === 'admin') return maxLevel(key);
  const d = MOD[key].defaults;
  return d[role] !== undefined ? d[role] : d['*'];
}
const defaultFlag = (key, role) => role === 'admin' || FLAGS.find(f => f.key === key).roles.includes(role);

// overrides: Zeilen aus role_permissions {role, permission, granted, level}
function resolveAccess(roles, overrides = []) {
  const ov = {};
  for (const o of overrides || []) {
    if (!o || !roles.includes(o.role) || o.role === 'admin') continue;
    (ov[o.role] = ov[o.role] || {})[o.permission] = o;
  }
  const counted = roles.filter(r => r !== 'assessment');
  const levels = {}, flags = {};
  for (const m of MODULES) {
    let best = 0;
    for (const r of counted) {
      const o = ov[r]?.['mod:'+m.key];
      const id = o && levelIndex(m.key, o.level) >= 0 ? o.level : defaultLevel(m.key, r);
      best = Math.max(best, levelIndex(m.key, id));
    }
    levels[m.key] = m.levels[best].id;
  }
  for (const f of FLAGS) {
    flags[f.key] = counted.some(r => {
      const o = ov[r]?.['flag:'+f.key];
      return o ? !!o.granted : defaultFlag(f.key, r);
    });
  }
  const tabs = {};
  for (const m of MODULES) for (const t of m.tabs) tabs[t] = levels[m.key] !== 'aus';
  return { levels, flags, tabs };
}

// true, wenn die Stufe des Moduls mindestens `min` ist
const atLeast = (levels, key, min) => levelIndex(key, levels[key]) >= levelIndex(key, min);

// Die bisherigen Rechte-Namen (req.p.*), abgeleitet aus den Stufen — so
// bleiben die vielen bestehenden Prüfungen in den Routen gültig.
function derivePermissions(roles, overrides = []) {
  const { levels, flags, tabs } = resolveAccess(roles, overrides);
  const at = (k, min) => atLeast(levels, k, min);
  return {
    levels, flags, tabs,
    manageUsers: roles.includes('admin') || levels.administration === 'an',
    addForOthers: at('kalender','fuerAndere'),
    canApproveEvents: at('kalender','genehmigen'),
    editAllPersonal: at('kalender','verwalten'),
    addGeneral: flags.allgemein,
    manageGeneral: flags.allgemein,
    seeAllAllw: at('zulagen','alle'),
    editAllw: at('zulagen','bearbeiten'),
    seeAllAbrechnung: at('abrechnung','alle'),
    manageHomeoffice: at('homeoffice','verwalten'),
    manageDiensttausch: at('diensttausch','verwalten'),
    uploadDienstplaene: at('dienstplaene','hochladen'),
    canManageDp: at('dienstplanung','verwalten'),
    zahnarztEdit: at('zahnarzt','bearbeiten'),
    zahnarztDelete: at('zahnarzt','verwalten'),
    managePlatz: at('platz','verwalten'),
    manageChecklists: at('checklisten','verwalten'),
    manageSop: at('sop','verwalten'),
    canManageSpint: at('spind','verwalten'),
    canSendMessages: at('nachrichten','senden'),
    seeAllMessages: at('nachrichten','alleFachbereiche'),
    manageNews: at('news','verwalten'),
    createDocs: at('dokumente','anlegen'),
    createWiki: at('wiki','anlegen'),
    createContacts: at('kontakte','anlegen'),
    seeStatistik: at('statistik','sehen'),
  };
}

// Ticket-Rechte (req.tp); deptIds = alle Fachbereiche aus der Tabelle departments
function deriveTicketPermissions(roles, p, deptIds) {
  const lvl = p.levels.tickets;
  const dept = atLeast(p.levels, 'tickets', 'fachbereich');
  return {
    seeAll: lvl === 'alle', editAll: lvl === 'alle',
    myDepts: dept ? deptIds.filter(d => roles.includes(d)) : [],
    canSetPublic: dept, canAssign: dept,
    canSeeSubcat: p.flags.beschwerden, canEditSubcat: p.flags.beschwerden,
    roles,
  };
}

// Modell für die Rechte-Matrix im Frontend
function clientModel(extraRoles = []) {
  const roles = [...ROLE_IDS, ...extraRoles.filter(r => !ROLE_IDS.includes(r) && r !== 'assessment')];
  return {
    roles,
    modules: MODULES.map(m => ({ key:m.key, label:m.label, hint:m.hint||'', tabs:m.tabs, levels:m.levels,
      defaults: Object.fromEntries(roles.map(r => [r, defaultLevel(m.key, r)])) })),
    flags: FLAGS.map(f => ({ key:f.key, label:f.label,
      defaults: Object.fromEntries(roles.map(r => [r, defaultFlag(f.key, r)])) })),
  };
}

// API-Bereiche, die eindeutig zu einem Modul gehören. Steht das Modul für
// den Nutzer auf "aus", sperrt middleware.js den Bereich auch serverseitig.
// /api/dp fehlt bewusst: es dient Dienstplanung und "Mein Dienstplan".
const MODULE_PATHS = [
  ['/api/events','kalender'], ['/api/vacation','kalender'],
  ['/api/allowances','zulagen'], ['/api/abrechnung','abrechnung'],
  ['/api/homeoffice','homeoffice'], ['/api/diensttausch','diensttausch'],
  ['/api/dienstplaene','dienstplaene'], ['/api/zahnarzt','zahnarzt'],
  ['/api/station-outages','platz'], ['/api/tickets','tickets'],
  ['/api/sop','sop'], ['/api/lockers','spind'], ['/api/locker-categories','spind'],
  ['/api/messages','nachrichten'], ['/api/chat','chat'], ['/api/news','news'],
  ['/api/docs','dokumente'], ['/api/doc-categories','dokumente'],
  ['/api/wiki-articles','wiki'], ['/api/wiki-categories','wiki'], ['/api/wiki-images','wiki'],
  ['/api/contacts','kontakte'], ['/api/contact-categories','kontakte'],
  ['/api/meetings','besprechungen'], ['/api/meeting-instances','besprechungen'],
  ['/api/meeting-appointments','besprechungen'], ['/api/meeting-protocols','besprechungen'],
  ['/api/meeting-doc-links','besprechungen'], ['/api/meeting-contact-links','besprechungen'],
  ['/api/discussion-items','besprechungen'], ['/api/todos','todos'],
  ['/api/statistik','statistik'],
];
function moduleForPath(rawPath) {
  const path = rawPath.length > 1 ? rawPath.replace(/\/+$/, '') : rawPath;
  const hit = MODULE_PATHS.find(([p]) => path === p || path.startsWith(p + '/'));
  return hit ? hit[1] : null;
}

// Prüft eine Übersteuerung aus der Matrix; liefert Fehlermeldung oder null.
function validateOverride(role, permission, value) {
  if (!role || role === 'admin' || role === 'assessment') return 'Diese Rolle ist nicht einstellbar';
  if (permission?.startsWith('mod:')) {
    const key = permission.slice(4);
    if (!MOD[key]) return 'Unbekanntes Modul';
    if (levelIndex(key, value) < 0) return 'Unbekannte Stufe';
    return null;
  }
  if (permission?.startsWith('flag:')) {
    if (!FLAGS.some(f => f.key === permission.slice(5))) return 'Unbekannter Schalter';
    if (typeof value !== 'boolean') return 'Wert muss ja/nein sein';
    return null;
  }
  return 'Unbekanntes Recht';
}

// ── Übernahme der alten Übersteuerungen ─────────────────────────────────────
// Vor der Umstellung gab es Einzelrechte (manageUsers, canApproveEvents, …)
// und Reiter-Schalter "tab:<reiter>". Hier werden sie pro Rolle in Stufen
// umgerechnet. Es entstehen nur Zeilen, die vom neuen Standard abweichen.
function legacyDefault(role, perm) {
  const has = (...r) => r.includes(role);
  switch (perm) {
    case 'manageUsers': return has('admin');
    case 'editAllPersonal': case 'seeAllAllw': case 'editAllw': case 'canApproveEvents':
      return has('admin','leitung','dienstplanung');
    case 'addForOthers': return has('admin','leitung','dienstplanung','ausbildung','qm');
    case 'addGeneral': case 'manageGeneral': return has('admin','leitung','dienstplanung','technik','ausbildung','qm');
    case 'canSendMessages': return role !== 'standard';
    case 'seeAllAbrechnung': return has('admin','dienstplanung');
    case 'manageSop': return has('admin','technik','leitung');
    default: return false;
  }
}

function migrateLegacyOverrides(rows) {
  const byRole = {};
  for (const r of rows || []) {
    if (!r?.role || !r.permission || r.permission.startsWith('mod:') || r.permission.startsWith('flag:')) continue;
    (byRole[r.role] = byRole[r.role] || {})[r.permission] = !!r.granted;
  }
  const out = [];
  let droppedTabs = 0;
  for (const [role, o] of Object.entries(byRole)) {
    if (role === 'admin' || role === 'assessment' || role.startsWith('_')) continue;
    const old = perm => o[perm] !== undefined ? o[perm] : legacyDefault(role, perm);
    const lvl = {
      administration: old('manageUsers') ? 'an' : 'aus',
      kalender: old('canApproveEvents') && old('editAllPersonal') ? 'verwalten'
        : old('canApproveEvents') ? 'genehmigen' : old('addForOthers') ? 'fuerAndere' : 'eigene',
      homeoffice: old('canApproveEvents') ? 'verwalten' : 'nutzen',
      diensttausch: old('canApproveEvents') ? 'verwalten' : 'nutzen',
      zulagen: old('editAllw') ? 'bearbeiten' : old('seeAllAllw') ? 'alle' : 'eigene',
      abrechnung: old('seeAllAbrechnung') ? 'alle' : 'eigene',
      sop: old('manageSop') ? 'verwalten' : 'ausfuehren',
      dienstplaene: old('addGeneral') ? 'hochladen' : 'sehen',
      dokumente: old('addGeneral') ? 'anlegen' : 'lesen',
      wiki: old('addGeneral') ? 'anlegen' : 'lesen',
      kontakte: old('addGeneral') ? 'anlegen' : 'lesen',
    };
    const nach = defaultLevel('nachrichten', role);
    lvl.nachrichten = old('canSendMessages') ? (nach === 'lesen' ? 'senden' : nach) : 'lesen';
    // Reiter: ein Modul wird nur "aus", wenn alle seine Reiter ausgeblendet waren
    for (const m of MODULES) {
      if (!m.tabs.length) continue;
      const hidden = m.tabs.filter(t => o['tab:'+t] === false).length;
      if (hidden === m.tabs.length) lvl[m.key] = 'aus';
      else if (hidden) droppedTabs += hidden;
    }
    for (const [key, level] of Object.entries(lvl))
      if (level !== defaultLevel(key, role)) out.push({ role, permission:'mod:'+key, granted:true, level });
    const flag = old('addGeneral');
    if (flag !== defaultFlag('allgemein', role)) out.push({ role, permission:'flag:allgemein', granted:flag, level:null });
  }
  return { rows: out, droppedTabs };
}

module.exports = { ROLE_IDS, MODULES, FLAGS, defaultLevel, resolveAccess, atLeast, derivePermissions,
  deriveTicketPermissions, clientModel, validateOverride, migrateLegacyOverrides, moduleForPath };
