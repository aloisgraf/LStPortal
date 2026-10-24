'use strict';
// Reine, zustandslose Spiellogik für "Desk Empire" (Menüpunkt "Spiele") —
// bewusst von routes/game.js (DB/HTTP) getrennt, damit sie ohne Datenbank
// automatisiert testbar ist (test/game-logic.test.mjs) und sich das
// Balancing per Simulation prüfen lässt (scripts/game-sim.js).
//
// Ein Spielstand ist ein einfaches JSON-Objekt (siehe newState()). Alle
// Aktionen verändern ihn direkt und werfen bei ungültigen Aktionen einen
// GameError mit einer Meldung für die Oberfläche. Der Server bleibt die
// alleinige Quelle der Wahrheit — der Client schickt nur Absichten.
//
// Wirtschaft (Version 2):
// - Alle Beträge sind "pro Minute" (reale Minute).
// - Das Büro wächst in Etappen (Kellerbüro → Firmenzentrale). Jede Etappe
//   braucht ein Mindestlevel, kostet einen Umzug und hat eine feste Anzahl
//   Stellflächen. Jeder Gegenstand, Arbeitsplatz, Raum und jedes Angebot
//   belegt genau eine Stellfläche und erscheint dort im Büro.
// - Gegenstände amortisieren sich je Etappe langsamer (von ~6 Minuten im
//   Keller bis zu mehreren Stunden in der Firmenzentrale).
// - Mitarbeiter sind der eigentliche Motor: gut versorgt bringen sie
//   deutlich mehr als ihr Gehalt, krank oder unzufrieden rutschen sie ins Minus.
// - Offline-Ertrag nur begrenzt (Standard 2 h zu 50 %).

const SAVE_VERSION = 2;
const ONLINE_GAP_MS = 60 * 1000;            // Lücken bis 1 Min. zählen als "online"
const BASE_OFFLINE = { maxMs: 2 * 3600e3, mult: 0.5 };
const MAX_CLICKS_PER_SECOND = 10;           // Schutz gegen Autoklicker
const MAX_CLICK_WINDOW_MS = 5000;
const START_COINS = 50;

class GameError extends Error {}
const fail = msg => { throw new GameError(msg); };
const clamp = (min, max, v) => Math.max(min, Math.min(max, v));

// ── ETAPPEN ────────────────────────────────────────────────────────────────
const STAGES = [
  { id:1, name:'Kellerbüro',    cols:4,  rows:3, minLevel:1,  cost:0 },
  { id:2, name:'Büroetage',     cols:6,  rows:4, minLevel:7,  cost:20000 },
  { id:3, name:'Großraumbüro',  cols:8,  rows:5, minLevel:13, cost:400000 },
  { id:4, name:'Firmenzentrale',cols:10, rows:6, minLevel:25, cost:100000000 },
];
const stageOf = id => STAGES.find(s => s.id === id) || STAGES[0];
const stageSlots = id => { const s = stageOf(id); return s.cols * s.rows; };

// ── STELLFLÄCHEN-OBJEKTE (Einrichtung) ─────────────────────────────────────
// cat: deko (automatische Einnahmen), platz (Arbeitsplätze), raum (Räume),
// angebot (Mitarbeiterangebote mit Stellfläche). income/upkeep pro Minute.
const OBJECTS = [
  // Deko & Technik — Einnahmen ohne Personal
  { id:'plant',     cat:'deko', stage:1, name:'Zimmerpflanze',     icon:'🪴', baseCost:30,      growth:1.25, income:5 },
  { id:'lamp',      cat:'deko', stage:1, name:'Stehlampe',         icon:'💡', baseCost:90,      growth:1.25, income:13 },
  { id:'coffee',    cat:'deko', stage:1, name:'Kaffeemaschine',    icon:'☕', baseCost:300,     growth:1.25, income:34 },
  { id:'monitor2',  cat:'deko', stage:2, name:'Zweiter Monitor',   icon:'🖥️', baseCost:1500,    growth:1.25, income:100 },
  { id:'cabinet',   cat:'deko', stage:2, name:'Aktenschrank',      icon:'🗄️', baseCost:4000,    growth:1.25, income:220 },
  { id:'printer',   cat:'deko', stage:2, name:'Kopierer',          icon:'🖨️', baseCost:9000,    growth:1.25, income:400 },
  { id:'aquarium',  cat:'deko', stage:3, name:'Aquarium',          icon:'🐠', baseCost:40000,   growth:1.25, income:1000 },
  { id:'server',    cat:'deko', stage:3, name:'Serverschrank',     icon:'🗃️', baseCost:100000,  growth:1.25, income:2000 },
  { id:'art',       cat:'deko', stage:3, name:'Kunstwerk',         icon:'🗿', baseCost:220000,  growth:1.25, income:3500 },
  { id:'conftech',  cat:'deko', stage:4, name:'Konferenztechnik',  icon:'📡', baseCost:900000,  growth:1.25, income:9000 },
  { id:'lounge',    cat:'deko', stage:4, name:'Dachlounge',        icon:'🛋️', baseCost:2500000, growth:1.25, income:18000 },
  // Arbeitsplätze — ohne Arbeitsplatz kein Mitarbeiter
  { id:'desk',      cat:'platz', stage:1, name:'Schreibtisch',              icon:'🪑', baseCost:150,   growth:1.15, upkeep:5,  capacity:1 },
  { id:'desk_ergo', cat:'platz', stage:2, name:'Ergonomischer Arbeitsplatz',icon:'💺', baseCost:2000,  growth:1.15, upkeep:20, capacity:1, healthFlat:2 },
  { id:'desk_dbl',  cat:'platz', stage:3, name:'Doppelarbeitsplatz',        icon:'👥', baseCost:15000, growth:1.15, upkeep:60, capacity:2 },
  // Räume
  { id:'meeting',   cat:'raum', stage:2, name:'Meetingecke', icon:'🗣️', baseCost:5000,  growth:1.6, upkeep:50,  max:3, teamMult:0.05 },
  { id:'rest',      cat:'raum', stage:2, name:'Ruheraum',    icon:'🛏️', baseCost:6000,  growth:1.6, upkeep:60,  max:3, recovery:5, satisfactionFlat:4 },
  { id:'kitchen',   cat:'raum', stage:3, name:'Büroküche',   icon:'🍽️', baseCost:30000, growth:1.6, upkeep:250, max:2, satisfactionFlat:10 },
  { id:'gym',       cat:'raum', stage:3, name:'Fitnessraum', icon:'🏋️', baseCost:50000, growth:1.6, upkeep:400, max:2, healthFlat:12, recovery:6 },
  // Angebote mit Stellfläche
  { id:'water',     cat:'angebot', stage:1, name:'Wasserspender', icon:'🚰', baseCost:250,  growth:1.5, upkeep:4,  max:3, healthFlat:3 },
  { id:'fruit',     cat:'angebot', stage:1, name:'Obstkorb',      icon:'🍎', baseCost:400,  growth:1.5, upkeep:8,  max:3, healthFlat:2, satisfactionFlat:2 },
  { id:'vending',   cat:'angebot', stage:2, name:'Kaffeeautomat', icon:'🥤', baseCost:1500, growth:1.5, upkeep:15, max:3, satisfactionFlat:5 },
];
const OBJECTS_BY_ID = {}; OBJECTS.forEach(o => OBJECTS_BY_ID[o.id] = o);

// ── ANGEBOTE OHNE STELLFLÄCHE (Regelungen) ─────────────────────────────────
const POLICIES = [
  { id:'chairs',   stage:2, name:'Ergonomische Bürostühle',           icon:'🪑', cost:3000,  upkeep:25,  healthFlat:6 },
  { id:'vacation', stage:2, name:'Zusätzliche Urlaubstage',           icon:'🏖️', cost:8000,  upkeep:60,  satisfactionFlat:10, productivityMult:0.95 },
  { id:'canteen',  stage:3, name:'Gesunde Kantine',                   icon:'🥗', cost:40000, upkeep:300, healthFlat:10, satisfactionFlat:8 },
  { id:'bgf',      stage:3, name:'Betriebliche Gesundheitsförderung', icon:'💚', cost:60000, upkeep:400, healthFlat:15 },
];
const POLICIES_BY_ID = {}; POLICIES.forEach(p => POLICIES_BY_ID[p.id] = p);

// ── MITARBEITER ────────────────────────────────────────────────────────────
// productivity × INCOME_PER_PRODUCTIVITY × Gesundheits-/Zufriedenheitsfaktor
// = Einnahmen pro Minute. Bei 50/50 (Faktor 0,6) liegt ein Sachbearbeiter
// rund 25 % über seinem Gehalt, gut versorgt (Faktor ~0,85) gut 75 % darüber.
const INCOME_PER_PRODUCTIVITY = 210;
const EMPLOYEE_CLASSES = [
  { id:'intern',     stage:1, name:'Praktikant',     hireCost:100,    wage:40,   productivity:0.4 },
  { id:'clerk',      stage:1, name:'Sachbearbeiter', hireCost:400,    wage:100,  productivity:1.0 },
  { id:'specialist', stage:2, name:'Fachkraft',      hireCost:3000,   wage:350,  productivity:3.6 },
  { id:'expert',     stage:3, name:'Spezialist',     hireCost:25000,  wage:1400, productivity:14.8 },
  { id:'lead',       stage:3, name:'Teamleiter',     hireCost:60000,  wage:2200, productivity:16, teamMult:0.03 },
  { id:'manager',    stage:4, name:'Manager',        hireCost:400000, wage:8000, productivity:70, teamMult:0.08 },
];
const EMPLOYEE_CLASSES_BY_ID = {}; EMPLOYEE_CLASSES.forEach(c => EMPLOYEE_CLASSES_BY_ID[c.id] = c);
const FIRST_NAMES = ['Alex','Jamie','Sam','Nina','Jonas','Lea','Paul','Mia','Finn','Clara','Theo','Elena','Max','Sofia','Ben','Anna','Luca','Emma','David','Laura','Felix','Hannah','Lukas','Marie','Tobias','Julia','Simon','Lena','Moritz','Sarah'];

// ── UPGRADES ───────────────────────────────────────────────────────────────
const UPGRADES = [
  { id:'click_mouse',    stage:1, name:'Ergonomische Maus',     desc:'+1 Office Coin pro Klick',                      cost:150,     effects:[{type:'clickAdd',value:1}] },
  { id:'coffee_culture', stage:1, name:'Kaffee-Kultur',         desc:'Kaffeemaschinen bringen doppelt so viel',       cost:2500,    effects:[{type:'objectMult',id:'coffee',value:2}] },
  { id:'click_keyboard', stage:2, name:'Mechanische Tastatur',  desc:'+3 Office Coins pro Klick',                     cost:3000,    effects:[{type:'clickAdd',value:3}] },
  { id:'night_shift',    stage:2, name:'Nachtschicht',          desc:'Offline-Ertrag bis 6 h zu 75 %',                cost:12000,   effects:[{type:'offline',maxMs:6*3600e3,mult:0.75}] },
  { id:'hr_training',    stage:2, name:'Personalschulung',      desc:'+10 % Leistung aller Mitarbeiter',              cost:15000,   effects:[{type:'staffMult',value:1.1}] },
  { id:'click_x2',       stage:2, name:'Doppelter Klick',       desc:'Verdoppelt den Ertrag pro Klick',               cost:20000,   effects:[{type:'clickMult',value:2}] },
  { id:'cheaper_deals',  stage:2, name:'Verhandlungsgeschick',  desc:'10 % günstigere Einrichtung',                   cost:25000,   effects:[{type:'costMult',value:0.9}] },
  { id:'income_training',stage:3, name:'Effizienz-Schulung',    desc:'+25 % auf Deko & Technik',                      cost:150000,  effects:[{type:'decoMult',value:1.25}] },
  { id:'leadership',     stage:3, name:'Führungskräfte-Seminar',desc:'+10 % Leistung aller Mitarbeiter',              cost:250000,  requires:'hr_training', effects:[{type:'staffMult',value:1.1}] },
  { id:'tech_upgrade',   stage:3, name:'Technik-Upgrade',       desc:'Monitore und Serverschränke bringen doppelt so viel', cost:400000, effects:[{type:'objectMult',id:'monitor2',value:2},{type:'objectMult',id:'server',value:2}] },
  { id:'click_x4',       stage:3, name:'Vierfacher Klick',      desc:'Verdoppelt den Klick-Ertrag erneut',            cost:300000,  requires:'click_x2', effects:[{type:'clickMult',value:2}] },
  { id:'income_premium', stage:4, name:'Premium-Ausstattung',   desc:'+50 % auf Deko & Technik',                      cost:3000000, requires:'income_training', effects:[{type:'decoMult',value:1.5}] },
  { id:'remote_work',    stage:4, name:'Homeoffice-Regelung',   desc:'Offline-Ertrag bis 12 h zu 90 %',               cost:4000000, requires:'night_shift', effects:[{type:'offline',maxMs:12*3600e3,mult:0.9}] },
];
const UPGRADES_BY_ID = {}; UPGRADES.forEach(u => UPGRADES_BY_ID[u.id] = u);

// ── TEAMBUILDING ───────────────────────────────────────────────────────────
const TEAMBUILDING_DURATION_MS = 10 * 60 * 1000;
const teambuildingCost = activeCount => Math.max(500, activeCount * 300);

// ── LEVEL ──────────────────────────────────────────────────────────────────
// XP = verdiente Office Coins (aus allen Quellen). Damit misst das Level den
// tatsächlichen Fortschritt und lässt sich nicht durch Klicks auf billige
// Käufe hochtreiben.
function xpForLevel(level){ return Math.round(300 * Math.pow(1.55, level - 1)); }

// ── AUFTRÄGE ───────────────────────────────────────────────────────────────
const ORDER_COOLDOWN_MS = 3 * 60 * 1000;
const ORDER_OFFER_TTL_MS = 10 * 60 * 1000;
const ORDER_TEMPLATES = [
  { type:'clicks', name:'Aktenberg abarbeiten',  durationMs:2*60e3,  desc:t=>t+' Klicks in 2 Minuten' },
  { type:'earn',   name:'Großkunde betreuen',    durationMs:10*60e3, desc:t=>fmtNum(t)+' Office Coins in 10 Minuten verdienen' },
  { type:'hire',   name:'Verstärkung gesucht',   durationMs:15*60e3, desc:()=>'1 Mitarbeiter in 15 Minuten einstellen' },
];
function fmtNum(n){ return Math.round(n).toLocaleString('de-DE'); }

// ── ERFOLGE ────────────────────────────────────────────────────────────────
const activeEmps = s => s.employees;
const objCount = s => s.layout.length;
const ACHIEVEMENTS = [
  { id:'first_100',     name:'Erste 100 Office Coins',      icon:'🪙', check:s=>s.totalEarned>=100 },
  { id:'first_object',  name:'Erstes Möbelstück',           icon:'🪴', check:s=>objCount(s)>=1 },
  { id:'first_hire',    name:'Erster Mitarbeiter',          icon:'🧑‍💼', check:s=>s.employees.length>=1 },
  { id:'full_cellar',   name:'Keller voll eingerichtet',    icon:'📦', check:s=>objCount(s)>=stageSlots(1) },
  { id:'stage_2',       name:'Umzug in die Büroetage',      icon:'🏬', check:s=>s.stage>=2 },
  { id:'team_5',        name:'Team von 5',                  icon:'👥', check:s=>activeEmps(s).length>=5 },
  { id:'happy_team',    name:'Zufriedenes Team (5+, ⌀ 80 %)', icon:'😊', check:s=>activeEmps(s).length>=5 && avg(activeEmps(s),e=>e.satisfaction)>=80 },
  { id:'first_order',   name:'Erster Auftrag erledigt',     icon:'📋', check:s=>(s.stats.ordersDone||0)>=1 },
  { id:'orders_10',     name:'10 Aufträge erledigt',        icon:'🗂️', check:s=>(s.stats.ordersDone||0)>=10 },
  { id:'income_1k',     name:'1.000 Office Coins pro Minute', icon:'🚀', check:(s,f)=>f.netPerMinute>=1000 },
  { id:'stage_3',       name:'Umzug ins Großraumbüro',      icon:'🏢', check:s=>s.stage>=3 },
  { id:'team_15',       name:'Team von 15',                 icon:'🏟️', check:s=>activeEmps(s).length>=15 },
  { id:'income_10k',    name:'10.000 Office Coins pro Minute', icon:'💎', check:(s,f)=>f.netPerMinute>=10000 },
  { id:'level_20',      name:'Level 20 erreicht',           icon:'⭐', check:s=>s.level>=20 },
  { id:'stage_4',       name:'Eigene Firmenzentrale',       icon:'🏙️', check:s=>s.stage>=4 },
  { id:'millionaire',   name:'Insgesamt 10 Mio. verdient',  icon:'🏆', check:s=>s.totalEarned>=10e6 },
];

// ── ZUSTAND ────────────────────────────────────────────────────────────────
function newState(now){
  return {
    v: SAVE_VERSION, coins: START_COINS, totalEarned: 0, xp: 0, level: 1, stage: 1,
    objects: {}, layout: [], upgrades: [], policies: {}, employees: [], achievements: [],
    teambuildingUntil: 0, order: null, orderCooldownUntil: now + 60e3,
    lastTickAt: now, lastClickAt: now, stats: { clicks: 0, ordersDone: 0, hired: 0 },
  };
}
// Liest einen gespeicherten Spielstand; alles vor Version 2 wird neu begonnen.
function loadState(json, now){
  let s = null;
  try { s = typeof json === 'string' ? JSON.parse(json) : json; } catch(e) { s = null; }
  if (!s || typeof s !== 'object' || s.v !== SAVE_VERSION) return { state: newState(now), reset: !!json };
  const base = newState(now);
  for (const k of Object.keys(base)) if (s[k] === undefined) s[k] = base[k];
  return { state: s, reset: false };
}

function avg(arr, fn){ return arr.length ? arr.reduce((a,x)=>a+fn(x),0)/arr.length : 0; }

// ── ABGELEITETE WERTE ──────────────────────────────────────────────────────
function upgradeEffects(s){
  let clickAdd=0, clickMult=1, costMult=1, decoMult=1, staffMult=1;
  let offline={ ...BASE_OFFLINE };
  const objectMult={};
  for (const id of s.upgrades){
    const u=UPGRADES_BY_ID[id]; if(!u) continue;
    for (const e of u.effects){
      if (e.type==='clickAdd') clickAdd+=e.value;
      else if (e.type==='clickMult') clickMult*=e.value;
      else if (e.type==='costMult') costMult*=e.value;
      else if (e.type==='decoMult') decoMult*=e.value;
      else if (e.type==='staffMult') staffMult*=e.value;
      else if (e.type==='objectMult') objectMult[e.id]=(objectMult[e.id]||1)*e.value;
      else if (e.type==='offline' && e.maxMs>offline.maxMs) offline={ maxMs:e.maxMs, mult:e.mult };
    }
  }
  return { clickValue:(1+clickAdd)*clickMult, costMult, decoMult, staffMult, objectMult, offline };
}
function objectPrice(obj, owned, costMult){
  return Math.max(1, Math.ceil(obj.baseCost * Math.pow(obj.growth, owned) * (costMult||1)));
}
function computeWorkforce(s, now){
  let healthFlat=0, satisfactionFlat=0, teamMult=0, recovery=0, capacity=0, productivityMult=1;
  const add = (o, n) => {
    capacity += (o.capacity||0)*n; healthFlat += (o.healthFlat||0)*n;
    satisfactionFlat += (o.satisfactionFlat||0)*n; teamMult += (o.teamMult||0)*n;
    recovery += (o.recovery||0)*n;
    if (o.productivityMult) productivityMult *= Math.pow(o.productivityMult, n);
  };
  for (const o of OBJECTS){ const n=s.objects[o.id]||0; if(n) add(o,n); }
  for (const p of POLICIES){ const n=s.policies[p.id]||0; if(n) add(p,n); }
  for (const e of s.employees){ const c=EMPLOYEE_CLASSES_BY_ID[e.classId]; if (c?.teamMult) teamMult += c.teamMult; }
  const teambuilding = (s.teambuildingUntil||0) > now;
  if (teambuilding){ satisfactionFlat += 15; teamMult += 0.1; }
  return {
    healthFlat: Math.min(healthFlat, 45), satisfactionFlat: Math.min(satisfactionFlat, 40),
    teamMult: Math.min(teamMult, 0.25), recovery, capacity, productivityMult, teambuilding,
  };
}
function healthFactor(h){ return 0.5 + (h/100)*0.5; }       // [0.5 .. 1.0]
function satisfactionFactor(v){ return 0.6 + (v/100)*0.4; } // [0.6 .. 1.0]
function employeeIncome(emp, agg, fx){
  const c = EMPLOYEE_CLASSES_BY_ID[emp.classId];
  if (!c) return 0;
  return c.productivity * INCOME_PER_PRODUCTIVITY * healthFactor(emp.health) * satisfactionFactor(emp.satisfaction)
    * (1 + agg.teamMult) * agg.productivityMult * fx.staffMult;
}
const WELLBEING_APPROACH_RATE = 0.12; // Anteil der Annäherung je Minute
const FREE_STAFF = 3;                 // so viele Mitarbeiter verkraftet das Büro ohne Erholungsraum
function wellbeingTargets(emp, agg, activeCount, financesNegative){
  const fatigue = Math.max(0, activeCount - FREE_STAFF - agg.recovery) * 2;
  const health = clamp(0, 100, 50 + agg.healthFlat - fatigue);
  const satisfaction = clamp(0, 100, 50 + agg.satisfactionFlat - (financesNegative?10:0) - Math.max(0, 50-emp.health)*0.3);
  return { health, satisfaction };
}
function tickEmployeeWellbeing(emp, minutes, agg, activeCount, financesNegative){
  const t = wellbeingTargets(emp, agg, activeCount, financesNegative);
  const f = minutes>0 ? 1 - Math.pow(1-WELLBEING_APPROACH_RATE, minutes) : 0;
  emp.health = clamp(0, 100, emp.health + (t.health-emp.health)*f);
  emp.satisfaction = clamp(0, 100, emp.satisfaction + (t.satisfaction-emp.satisfaction)*f);
}
function financials(s, now){
  const fx = upgradeEffects(s), agg = computeWorkforce(s, now);
  let decoIncome=0, upkeep=0, policyUpkeep=0, staffIncome=0, wages=0;
  for (const o of OBJECTS){
    const n=s.objects[o.id]||0; if(!n) continue;
    if (o.income) decoIncome += n*o.income*(fx.objectMult[o.id]||1);
    upkeep += n*(o.upkeep||0);
  }
  decoIncome *= fx.decoMult;
  for (const p of POLICIES){ if (s.policies[p.id]) policyUpkeep += p.upkeep; }
  for (const e of s.employees){
    staffIncome += employeeIncome(e, agg, fx);
    wages += EMPLOYEE_CLASSES_BY_ID[e.classId]?.wage||0;
  }
  const income = decoIncome + staffIncome, costs = wages + upkeep + policyUpkeep;
  return { decoIncome, staffIncome, wages, upkeep, policyUpkeep, income, costs, netPerMinute: income - costs, fx, agg };
}

// ── ZEITFORTSCHRITT ────────────────────────────────────────────────────────
// Lücken bis ONLINE_GAP_MS zählen voll; längere Abwesenheit wird auf das
// Offline-Limit gekürzt und nur anteilig gutgeschrieben (Kosten ebenso).
function tick(s, now){
  const gap = Math.max(0, now - (s.lastTickAt||now));
  const f0 = financials(s, now);
  let effMs = gap, mult = 1, offline = false;
  if (gap > ONLINE_GAP_MS){ offline = true; effMs = Math.min(gap, f0.fx.offline.maxMs); mult = f0.fx.offline.mult; }
  const minutes = effMs/60000;
  const delta = f0.netPerMinute * minutes * mult;
  const before = s.coins;
  s.coins = Math.max(0, s.coins + delta);
  const earned = Math.max(0, delta);
  if (earned > 0) addEarnings(s, earned);
  if (s.order?.active && s.order.type==='earn') s.order.progress += Math.max(0, s.coins - before);
  for (const e of s.employees) tickEmployeeWellbeing(e, minutes, f0.agg, s.employees.length, f0.netPerMinute < 0);
  s.lastTickAt = now;
  const leveledUp = applyLevels(s);
  const orderEvent = updateOrder(s, now);
  return { offline, gapMs: gap, earned, delta, leveledUp, orderEvent };
}
function addEarnings(s, amount){ s.totalEarned += amount; s.xp += amount; }
function applyLevels(s){
  let up = null;
  while (s.xp >= xpForLevel(s.level)){ s.xp -= xpForLevel(s.level); s.level += 1; up = s.level; }
  return up;
}

// ── AUFTRÄGE ───────────────────────────────────────────────────────────────
function makeOrder(s, now){
  const f = financials(s, now);
  const fx = f.fx;
  const pool = ORDER_TEMPLATES.filter(t => t.type!=='hire' || s.employees.length < f.agg.capacity || s.employees.length===0);
  const t = pool[Math.floor(Math.random()*pool.length)];
  let target, reward;
  if (t.type==='clicks'){ target = 120 + 20*Math.min(10, s.level); reward = Math.round(target*fx.clickValue*1.5 + Math.max(0,f.netPerMinute)*2); }
  else if (t.type==='earn'){ const base = Math.max(30, f.netPerMinute); target = Math.round(base*13); reward = Math.round(base*4); }
  else { target = 1; reward = Math.round(Math.max(200, f.netPerMinute*3)); }
  return { type:t.type, name:t.name, desc:t.desc(target), target, reward, progress:0, active:false, offeredUntil: now+ORDER_OFFER_TTL_MS, durationMs:t.durationMs };
}
function updateOrder(s, now){
  const o = s.order;
  if (o?.active){
    if (o.progress >= o.target){
      s.coins += o.reward; addEarnings(s, o.reward);
      s.stats.ordersDone = (s.stats.ordersDone||0)+1;
      s.order = null; s.orderCooldownUntil = now + ORDER_COOLDOWN_MS;
      applyLevels(s);
      return { done:true, name:o.name, reward:o.reward };
    }
    if (now > o.expiresAt){ s.order = null; s.orderCooldownUntil = now + ORDER_COOLDOWN_MS; return { failed:true, name:o.name }; }
    return null;
  }
  if (o && now > o.offeredUntil){ s.order = null; s.orderCooldownUntil = now + ORDER_COOLDOWN_MS; }
  if (!s.order && now >= (s.orderCooldownUntil||0)) s.order = makeOrder(s, now);
  return null;
}
function acceptOrder(s, now){
  if (!s.order) fail('Gerade kein Auftrag verfügbar');
  if (s.order.active) fail('Auftrag läuft bereits');
  s.order.active = true; s.order.startedAt = now; s.order.expiresAt = now + s.order.durationMs; s.order.progress = 0;
}
function declineOrder(s, now){
  if (!s.order || s.order.active) fail('Kein offenes Angebot');
  s.order = null; s.orderCooldownUntil = now + ORDER_COOLDOWN_MS;
}

// ── AKTIONEN ───────────────────────────────────────────────────────────────
// Klicks kommen gebündelt (count); angerechnet werden höchstens
// MAX_CLICKS_PER_SECOND je vergangener Sekunde seit dem letzten Bündel.
function click(s, count, now){
  count = Math.max(0, Math.floor(Number(count)||0));
  const windowMs = clamp(0, MAX_CLICK_WINDOW_MS, now - (s.lastClickAt||0));
  const allowed = Math.min(count, Math.ceil(windowMs/1000*MAX_CLICKS_PER_SECOND));
  s.lastClickAt = now;
  if (!allowed) return 0;
  const value = upgradeEffects(s).clickValue * allowed;
  s.coins += value; addEarnings(s, value);
  s.stats.clicks = (s.stats.clicks||0) + allowed;
  if (s.order?.active && s.order.type==='clicks') s.order.progress += allowed;
  if (s.order?.active && s.order.type==='earn') s.order.progress += value;
  return allowed;
}
function requireStage(s, stage){ if (s.stage < stage) fail('Erst ab Etappe „'+stageOf(stage).name+'“ verfügbar'); }
function pay(s, cost){ if (s.coins < cost) fail('Nicht genug Office Coins'); s.coins -= cost; }

function buyObject(s, id){
  const o = OBJECTS_BY_ID[id]; if (!o) fail('Unbekannter Gegenstand');
  requireStage(s, o.stage);
  const owned = s.objects[id]||0;
  if (o.max && owned >= o.max) fail('Maximale Anzahl erreicht');
  if (s.layout.length >= stageSlots(s.stage)) fail('Kein freier Platz mehr — zuerst in ein größeres Büro umziehen');
  pay(s, objectPrice(o, owned, upgradeEffects(s).costMult));
  s.objects[id] = owned+1;
  s.layout.push(id);
}
function sellObject(s, index, now){
  index = Math.floor(Number(index));
  if (!(index>=0 && index<s.layout.length)) fail('Platz ist leer');
  const id = s.layout[index], o = OBJECTS_BY_ID[id];
  const capAfter = computeWorkforce(s, now).capacity - (o?.capacity||0);
  if (o?.capacity && s.employees.length > capAfter) fail('Arbeitsplatz ist besetzt — zuerst einen Mitarbeiter entlassen');
  s.layout.splice(index, 1);
  s.objects[id] = Math.max(0, (s.objects[id]||0)-1);
  // Halber Preis des zuletzt gekauften Exemplars zurück
  const refund = o ? Math.floor(objectPrice(o, s.objects[id], 1)*0.5) : 0;
  s.coins += refund;
  return refund;
}
function buyPolicy(s, id){
  const p = POLICIES_BY_ID[id]; if (!p) fail('Unbekanntes Angebot');
  requireStage(s, p.stage);
  if (s.policies[id]) fail('Bereits eingeführt');
  pay(s, p.cost);
  s.policies[id] = 1;
}
function buyUpgrade(s, id){
  const u = UPGRADES_BY_ID[id]; if (!u) fail('Unbekanntes Upgrade');
  requireStage(s, u.stage);
  if (s.upgrades.includes(id)) fail('Bereits freigeschaltet');
  if (u.requires && !s.upgrades.includes(u.requires)) fail('Voraussetzung fehlt: '+(UPGRADES_BY_ID[u.requires]?.name||u.requires));
  pay(s, u.cost);
  s.upgrades.push(id);
}
function hire(s, classId, now){
  const c = EMPLOYEE_CLASSES_BY_ID[classId]; if (!c) fail('Unbekannte Position');
  requireStage(s, c.stage);
  const agg = computeWorkforce(s, now);
  if (s.employees.length >= agg.capacity) fail('Kein freier Arbeitsplatz — zuerst einen Schreibtisch kaufen');
  pay(s, c.hireCost);
  const used = new Set(s.employees.map(e=>e.name));
  const free = FIRST_NAMES.filter(n=>!used.has(n));
  const pool = free.length ? free : FIRST_NAMES;
  s.employees.push({
    id: 'e_'+now.toString(36)+Math.random().toString(36).slice(2,7),
    name: pool[Math.floor(Math.random()*pool.length)], classId,
    health: 70, satisfaction: 70, hiredAt: now,
  });
  s.stats.hired = (s.stats.hired||0)+1;
  if (s.order?.active && s.order.type==='hire') s.order.progress += 1;
}
function fire(s, employeeId){
  const i = s.employees.findIndex(e=>e.id===employeeId);
  if (i<0) fail('Mitarbeiter nicht gefunden');
  s.employees.splice(i,1);
}
function moveStage(s){
  const next = STAGES.find(x=>x.id===s.stage+1);
  if (!next) fail('Größer geht es nicht');
  if (s.level < next.minLevel) fail('Umzug erst ab Level '+next.minLevel);
  pay(s, next.cost);
  s.stage = next.id;
}
function startTeambuilding(s, now){
  if ((s.teambuildingUntil||0) > now) fail('Teambuilding läuft noch');
  if (!s.employees.length) fail('Noch kein Team vorhanden');
  pay(s, teambuildingCost(s.employees.length));
  s.teambuildingUntil = now + TEAMBUILDING_DURATION_MS;
}
function checkAchievements(s, now){
  const have = new Set(s.achievements), f = financials(s, now), newly=[];
  for (const a of ACHIEVEMENTS){
    if (have.has(a.id)) continue;
    if (a.check(s, f)){ have.add(a.id); newly.push({ id:a.id, name:a.name, icon:a.icon }); }
  }
  if (newly.length) s.achievements = [...have];
  return newly;
}

// ── ANSICHT FÜR DEN CLIENT ─────────────────────────────────────────────────
function view(s, now){
  const f = financials(s, now), fx = f.fx, agg = f.agg;
  const next = STAGES.find(x=>x.id===s.stage+1)||null;
  // Erwarteter Dauerertrag einer neuen Kraft bei der aktuellen Ausstattung
  const th = wellbeingTargets({ health:70 }, agg, s.employees.length+1, f.netPerMinute<0).health;
  const ts = wellbeingTargets({ health:th }, agg, s.employees.length+1, f.netPerMinute<0).satisfaction;
  const hireEstimates = Object.fromEntries(EMPLOYEE_CLASSES.map(c => [c.id, employeeIncome({ classId:c.id, health:th, satisfaction:ts }, agg, fx)]));
  return {
    coins: s.coins, totalEarned: s.totalEarned, level: s.level, xp: s.xp, xpToNext: xpForLevel(s.level),
    stage: s.stage, slots: stageSlots(s.stage), layout: s.layout, objects: s.objects,
    upgrades: s.upgrades, policies: s.policies, achievements: s.achievements,
    employees: s.employees.map(e => ({ ...e, income: employeeIncome(e, agg, fx), wage: EMPLOYEE_CLASSES_BY_ID[e.classId]?.wage||0 })),
    capacity: agg.capacity, clickValue: fx.clickValue, offline: fx.offline,
    teambuildingUntil: s.teambuildingUntil > now ? s.teambuildingUntil : 0,
    teambuildingCost: teambuildingCost(s.employees.length),
    order: s.order, stats: s.stats,
    financials: { decoIncome:f.decoIncome, staffIncome:f.staffIncome, wages:f.wages, upkeep:f.upkeep, policyUpkeep:f.policyUpkeep, income:f.income, costs:f.costs, netPerMinute:f.netPerMinute },
    workforce: {
      avgHealth: avg(s.employees, e=>e.health), avgSatisfaction: avg(s.employees, e=>e.satisfaction),
      healthBonus: agg.healthFlat, satisfactionBonus: agg.satisfactionFlat, teamBonus: agg.teamMult,
      recovery: agg.recovery + FREE_STAFF,
    },
    prices: Object.fromEntries(OBJECTS.map(o => [o.id, objectPrice(o, s.objects[o.id]||0, fx.costMult)])),
    nextStage: next, hireEstimates, wellbeingTargets: { health: th, satisfaction: ts },
    now,
  };
}
const CATALOG = {
  stages: STAGES,
  objects: OBJECTS.map(({id,cat,stage,name,icon,income,upkeep,capacity,max,healthFlat,satisfactionFlat,recovery,teamMult}) =>
    ({id,cat,stage,name,icon,income,upkeep,capacity,max,healthFlat,satisfactionFlat,recovery,teamMult})),
  policies: POLICIES,
  employeeClasses: EMPLOYEE_CLASSES,
  upgrades: UPGRADES.map(({id,stage,name,desc,cost,requires}) => ({id,stage,name,desc,cost,requires:requires||null})),
  achievements: ACHIEVEMENTS.map(({id,name,icon}) => ({id,name,icon})),
};

module.exports = {
  SAVE_VERSION, ONLINE_GAP_MS, BASE_OFFLINE, MAX_CLICKS_PER_SECOND, START_COINS, FREE_STAFF,
  GameError, STAGES, stageOf, stageSlots,
  OBJECTS, OBJECTS_BY_ID, POLICIES, POLICIES_BY_ID, EMPLOYEE_CLASSES, EMPLOYEE_CLASSES_BY_ID,
  UPGRADES, UPGRADES_BY_ID, ACHIEVEMENTS, INCOME_PER_PRODUCTIVITY, TEAMBUILDING_DURATION_MS,
  newState, loadState, upgradeEffects, objectPrice, computeWorkforce, healthFactor, satisfactionFactor,
  employeeIncome, wellbeingTargets, tickEmployeeWellbeing, financials, xpForLevel,
  tick, click, buyObject, sellObject, buyPolicy, buyUpgrade, hire, fire, moveStage, startTeambuilding,
  acceptOrder, declineOrder, checkAchievements, view, CATALOG, teambuildingCost,
};
