'use strict';
// Reine, zustandslose Spiellogik für "Desk Empire" (Menüpunkt "Spiele") —
// bewusst von routes/game.js (DB/HTTP) getrennt, damit sie ohne Datenbank
// automatisiert testbar ist (siehe test/game-logic.test.mjs). Enthält den
// Katalog (Gegenstände/Upgrades/Mitarbeiterklassen/Arbeitsplätze/Angebote)
// und alle Berechnungsformeln (Preise, Einnahmen, Gesundheit/Zufriedenheit,
// Produktivität). Der Server bleibt die alleinige Quelle der Wahrheit —
// diese Funktionen werden ausschließlich serverseitig aufgerufen.

const MAX_OFFLINE_MS = 8 * 60 * 60 * 1000; // max. 8h Offline-Gutschrift
const GAME_HOURS_PER_REAL_SECOND = 1/60;   // 1 Spielstunde = 1 reale Minute

// ── KATALOG: KLASSISCHE IDLE-GEGENSTÄNDE ───────────────────────────────────
const ITEMS = [
  { id:'plant',     name:'Zimmerpflanze',         icon:'🪴', baseCost:25,     rate:0.2 },
  { id:'lamp',      name:'Schreibtischlampe',     icon:'💡', baseCost:75,     rate:0.5 },
  { id:'coffee',    name:'Kaffeemaschine',        icon:'☕', baseCost:200,    rate:1.5 },
  { id:'monitor2',  name:'Zweiter Monitor',       icon:'🖥️', baseCost:500,    rate:4 },
  { id:'cabinet',   name:'Aktenschrank',          icon:'🗄️', baseCost:1200,   rate:9 },
  { id:'desk2',     name:'Zweiter Arbeitsplatz',  icon:'🪑', baseCost:3000,   rate:22 },
  { id:'meeting',   name:'Meetingbereich',        icon:'🧑‍🤝‍🧑', baseCost:8000,   rate:60 },
  { id:'kitchen',   name:'Kleine Büroküche',      icon:'🍽️', baseCost:20000,  rate:150 },
  { id:'openspace', name:'Modernes Großraumbüro', icon:'🏢', baseCost:60000,  rate:400 },
  { id:'executive', name:'Executive Office',      icon:'🏙️', baseCost:200000, rate:1200 },
];
const ITEMS_BY_ID = {}; ITEMS.forEach(it => ITEMS_BY_ID[it.id] = it);
const COST_GROWTH = 1.15;

const UPGRADES = [
  { id:'click_mouse',    name:'Ergonomische Maus',          desc:'+1 Office Coin pro Klick',               cost:50,    requires:null,          effects:[{type:'clickAdd',value:1}] },
  { id:'click_keyboard', name:'Mechanische Tastatur',       desc:'+2 Office Coins pro Klick',              cost:300,   requires:null,          effects:[{type:'clickAdd',value:2}] },
  { id:'click_x2',       name:'Doppelte Klick-Einnahmen',   desc:'Verdoppelt den Ertrag pro Klick',        cost:1000,  requires:null,          effects:[{type:'clickMult',value:2}] },
  { id:'click_x4',       name:'Vierfache Klick-Einnahmen',  desc:'Verdoppelt den Klick-Ertrag erneut',     cost:12000, requires:'click_x2',    effects:[{type:'clickMult',value:2}] },
  { id:'income_training',name:'Effizienz-Schulung',        desc:'+25% auf alle automatischen Einnahmen',  cost:2000,  requires:null,          effects:[{type:'incomeMult',value:1.25}] },
  { id:'income_premium', name:'Premium-Ausstattung',        desc:'+50% weitere automatische Einnahmen',    cost:15000, requires:'income_training', effects:[{type:'incomeMult',value:1.5}] },
  { id:'cheaper_deals',  name:'Verhandlungsgeschick',       desc:'10% günstigere Anschaffungskosten',      cost:5000,  requires:null,          effects:[{type:'costMult',value:0.9}] },
  { id:'coffee_culture', name:'Kaffee-Kultur',              desc:'Verdoppelt den Ertrag der Kaffeemaschine', cost:4000, requires:null,        effects:[{type:'itemMult',item:'coffee',value:2}] },
  { id:'tech_upgrade',   name:'Technik-Upgrade',            desc:'Verdoppelt Monitor- & Großraumbüro-Ertrag', cost:25000, requires:null,      effects:[{type:'itemMult',item:'monitor2',value:2},{type:'itemMult',item:'openspace',value:2}] },
];
const UPGRADES_BY_ID = {}; UPGRADES.forEach(u => UPGRADES_BY_ID[u.id] = u);

// ── KATALOG: MITARBEITER ───────────────────────────────────────────────────
const EMPLOYEE_CLASSES = [
  { id:'intern',     name:'Praktikant',      hireCost:100,  wage:8,   productivity:0.5 },
  { id:'clerk',      name:'Sachbearbeiter',  hireCost:250,  wage:15,  productivity:1.0 },
  { id:'specialist', name:'Fachkraft',       hireCost:500,  wage:25,  productivity:1.6 },
  { id:'expert',     name:'Spezialist',      hireCost:1000, wage:40,  productivity:2.5 },
  { id:'lead',       name:'Teamleiter',      hireCost:2000, wage:65,  productivity:3.5 },
  { id:'manager',    name:'Manager',         hireCost:5000, wage:120, productivity:5.0 },
];
const EMPLOYEE_CLASSES_BY_ID = {}; EMPLOYEE_CLASSES.forEach(c => EMPLOYEE_CLASSES_BY_ID[c.id] = c);
const FIRST_NAMES = ['Alex','Jamie','Sam','Nina','Jonas','Lea','Paul','Mia','Finn','Clara','Theo','Elena','Max','Sofia','Ben','Anna','Luca','Emma','David','Laura'];

// ── KATALOG: ARBEITSPLÄTZE & BÜROAUSSTATTUNG ──────────────────────────────
const WORKSTATIONS = [
  { id:'ws_simple',   name:'Einfacher Arbeitsplatz',     icon:'🪑', cost:300,  upkeep:2,  effects:[{type:'capacity',value:1}] },
  { id:'ws_ergo',     name:'Ergonomischer Arbeitsplatz', icon:'💺', cost:800,  upkeep:3,  effects:[{type:'capacity',value:1},{type:'healthFlat',value:4}] },
  { id:'ws_double',   name:'Doppelarbeitsplatz',         icon:'🪑', cost:1200, upkeep:5,  effects:[{type:'capacity',value:2}] },
  { id:'ws_meeting',  name:'Meetingraum',                icon:'🧑‍🤝‍🧑', cost:2500, upkeep:10, effects:[{type:'teamProductivityMult',value:0.05}] },
  { id:'ws_restroom', name:'Ruheraum',                   icon:'🛋️', cost:3000, upkeep:12, effects:[{type:'recoveryCapacity',value:10},{type:'satisfactionFlat',value:5}] },
  { id:'ws_fitness',  name:'Fitnessbereich',             icon:'🏋️', cost:5000, upkeep:25, effects:[{type:'healthFlat',value:12},{type:'recoveryCapacity',value:8}] },
  { id:'ws_kitchen',  name:'Moderne Büroküche',          icon:'🍽️', cost:4000, upkeep:20, effects:[{type:'satisfactionFlat',value:10}] },
];
const WORKSTATIONS_BY_ID = {}; WORKSTATIONS.forEach(w => WORKSTATIONS_BY_ID[w.id] = w);

// ── KATALOG: MITARBEITERANGEBOTE ───────────────────────────────────────────
const PERKS = [
  { id:'perk_water',    name:'Wasserspender',                     icon:'🚰', cost:200,  upkeep:3,  maxCount:5, effects:[{type:'healthFlat',value:2}] },
  { id:'perk_fruit',    name:'Obstkorb',                          icon:'🍎', cost:250,  upkeep:8,  maxCount:5, effects:[{type:'healthFlat',value:2},{type:'satisfactionFlat',value:2}] },
  { id:'perk_coffee',   name:'Kaffeeautomat',                     icon:'☕', cost:400,  upkeep:5,  maxCount:3, effects:[{type:'satisfactionFlat',value:4}] },
  { id:'perk_chairs',   name:'Ergonomische Bürostühle',           icon:'🪑', cost:600,  upkeep:4,  maxCount:1, effects:[{type:'healthFlat',value:6}] },
  { id:'perk_canteen',  name:'Gesunde Kantine',                   icon:'🥗', cost:2500, upkeep:35, maxCount:1, effects:[{type:'healthFlat',value:10},{type:'satisfactionFlat',value:8}] },
  { id:'perk_fitness',  name:'Fitnessangebot',                    icon:'🏃', cost:3000, upkeep:20, maxCount:1, effects:[{type:'healthFlat',value:12}] },
  { id:'perk_bgf',      name:'Betriebliche Gesundheitsförderung', icon:'💚', cost:5000, upkeep:30, maxCount:1, effects:[{type:'healthFlat',value:15}] },
  { id:'perk_vacation', name:'Zusätzliche Urlaubstage',           icon:'🏖️', cost:2000, upkeep:15, maxCount:1, effects:[{type:'satisfactionFlat',value:10},{type:'capacityMult',value:0.95}] },
];
const PERKS_BY_ID = {}; PERKS.forEach(p => PERKS_BY_ID[p.id] = p);
const TEAMBUILDING_COST = 1000;
const TEAMBUILDING_DURATION_MS = 6 * 60 * 1000; // 6 Spielstunden = 6 reale Minuten

const ACHIEVEMENTS = [
  { id:'first_100',       name:'Erste 100 Office Coins',               icon:'🪙', check:(s)=>s.total_earned>=100 },
  { id:'first_passive',   name:'Erste automatische Einnahme',          icon:'⚙️', check:(s,items)=>Object.values(items).some(v=>v>0) },
  { id:'ten_items',       name:'10 Gegenstände gekauft',               icon:'📦', check:(s,items)=>Object.values(items).reduce((a,b)=>a+b,0)>=10 },
  { id:'thousand_per_min',name:'1.000 Office Coins pro Minute',        icon:'🚀', check:(s,items,derived)=>derived.incomePerSecond*60>=1000 },
  { id:'office_complete', name:'Erstes vollständig ausgebautes Büro',  icon:'🏢', check:(s,items)=>ITEMS.every(it=>(items[it.id]||0)>=1) },
  { id:'level_10',        name:'10 Level erreicht',                    icon:'⭐', check:(s)=>s.level>=10 },
  { id:'first_hire',      name:'Erste Mitarbeiterin/erster Mitarbeiter', icon:'🧑‍💼', check:(s,items,derived,employees)=>employees.length>=1 },
  { id:'team_of_ten',     name:'Team von 10 Mitarbeitenden',           icon:'👥', check:(s,items,derived,employees)=>employees.filter(e=>e.status==='active').length>=10 },
];

function parseItems(txt){ try{ const o=JSON.parse(txt||'{}'); return (o&&typeof o==='object')?o:{}; }catch(e){ return {}; } }
function parseList(txt){ try{ const a=JSON.parse(txt||'[]'); return Array.isArray(a)?a:[]; }catch(e){ return []; } }
function clamp(min,max,v){ return Math.max(min, Math.min(max, v)); }

function computeDerived(items, upgrades){
  let clickAdd=0, clickMult=1, incomeMult=1, costMult=1;
  const itemMult={};
  for (const uid of upgrades){
    const u=UPGRADES_BY_ID[uid]; if(!u) continue;
    for (const eff of u.effects){
      if (eff.type==='clickAdd') clickAdd+=eff.value;
      else if (eff.type==='clickMult') clickMult*=eff.value;
      else if (eff.type==='incomeMult') incomeMult*=eff.value;
      else if (eff.type==='costMult') costMult*=eff.value;
      else if (eff.type==='itemMult') itemMult[eff.item]=(itemMult[eff.item]||1)*eff.value;
    }
  }
  const clickValue=(1+clickAdd)*clickMult;
  let incomePerSecond=0;
  for (const it of ITEMS){
    const owned=items[it.id]||0;
    if (!owned) continue;
    incomePerSecond += owned*it.rate*(itemMult[it.id]||1);
  }
  incomePerSecond*=incomeMult;
  return { clickValue, incomePerSecond, costMult, incomeMult, itemMult };
}
function itemPrice(item, owned, costMult){
  return Math.max(1, Math.ceil(item.baseCost*Math.pow(COST_GROWTH,owned)*costMult));
}
// XP-Bedarf, um LEVEL -> LEVEL+1 zu erreichen.
function xpForLevel(level){ return Math.round(50*Math.pow(level,1.5)); }

// ── MITARBEITER/BETRIEBSWIRTSCHAFT ─────────────────────────────────────────
function computeWorkforce(workstations, perks, teambuildingActive){
  let healthFlat=0, satisfactionFlat=0, teamMult=0, recoveryCapacity=0, capacityMult=1, capacity=0;
  const applyEffects = (effects, count) => {
    for (const eff of effects){
      if (eff.type==='capacity') capacity += eff.value*count;
      else if (eff.type==='healthFlat') healthFlat += eff.value*count;
      else if (eff.type==='satisfactionFlat') satisfactionFlat += eff.value*count;
      else if (eff.type==='teamProductivityMult') teamMult += eff.value*count;
      else if (eff.type==='recoveryCapacity') recoveryCapacity += eff.value*count;
      else if (eff.type==='capacityMult') capacityMult *= Math.pow(eff.value, count);
    }
  };
  for (const ws of WORKSTATIONS){ const c=workstations[ws.id]||0; if (c) applyEffects(ws.effects, c); }
  for (const pk of PERKS){ const c=perks[pk.id]||0; if (c) applyEffects(pk.effects, c); }
  if (teambuildingActive){ satisfactionFlat += 15; teamMult += 0.1; }
  healthFlat = Math.min(healthFlat, 45);        // Deckel: kein Einzelkauf erzeugt Maximalwerte
  satisfactionFlat = Math.min(satisfactionFlat, 40);
  teamMult = Math.min(teamMult, 0.3);
  const maxEmployees = Math.floor(capacity*capacityMult);
  return { healthFlat, satisfactionFlat, teamMult, recoveryCapacity, maxEmployees };
}
const WELLBEING_APPROACH_RATE = 0.15; // Anteil der Annäherung je Spielstunde
function tickEmployeeWellbeing(emp, gameHoursElapsed, agg, activeCount, financesNegative){
  const fatigue = Math.max(0, activeCount - agg.recoveryCapacity) * 1.5;
  const healthTarget = clamp(0, 100, 50 + agg.healthFlat - fatigue);
  const satisfactionTarget = clamp(0, 100, 50 + agg.satisfactionFlat - (financesNegative?10:0) - Math.max(0,(50-emp.health))*0.3);
  const factor = gameHoursElapsed>0 ? 1 - Math.pow(1-WELLBEING_APPROACH_RATE, gameHoursElapsed) : 0;
  emp.health = clamp(0, 100, emp.health + (healthTarget-emp.health)*factor);
  emp.satisfaction = clamp(0, 100, emp.satisfaction + (satisfactionTarget-emp.satisfaction)*factor);
}
function healthFactor(h){ return 0.5 + (h/100)*0.6; }       // [0.5 .. 1.1]
function satisfactionFactor(s){ return 0.6 + (s/100)*0.5; } // [0.6 .. 1.1]
const INCOME_PER_PRODUCTIVITY = 15; // Office Coins pro Produktivitätspunkt und Spielstunde
function employeeProductivity(emp, agg, vacationMult){
  const cls = EMPLOYEE_CLASSES_BY_ID[emp.classId];
  if (!cls) return 0;
  return cls.productivity * healthFactor(emp.health) * satisfactionFactor(emp.satisfaction) * (1+agg.teamMult) * vacationMult;
}
function randomEmployeeName(){
  return FIRST_NAMES[Math.floor(Math.random()*FIRST_NAMES.length)];
}

module.exports = {
  MAX_OFFLINE_MS, GAME_HOURS_PER_REAL_SECOND,
  ITEMS, ITEMS_BY_ID, COST_GROWTH,
  UPGRADES, UPGRADES_BY_ID,
  EMPLOYEE_CLASSES, EMPLOYEE_CLASSES_BY_ID,
  WORKSTATIONS, WORKSTATIONS_BY_ID,
  PERKS, PERKS_BY_ID, TEAMBUILDING_COST, TEAMBUILDING_DURATION_MS,
  ACHIEVEMENTS,
  parseItems, parseList, clamp,
  computeDerived, itemPrice, xpForLevel,
  computeWorkforce, tickEmployeeWellbeing, healthFactor, satisfactionFactor,
  employeeProductivity, randomEmployeeName, INCOME_PER_PRODUCTIVITY, WELLBEING_APPROACH_RATE,
};
