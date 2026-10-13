'use strict';
// "Desk Empire" — kleines Idle-Spiel (Menüpunkt "Spiele" in der Kopfzeile).
// Design-Entscheidung: der Server ist die einzige Quelle der Wahrheit für
// Kontostand, Preise, Einnahmen/Sekunde und vergangene Zeit. Der Client
// schickt ausschließlich Absichten ("Klick", "kaufe Item X", "kaufe Upgrade
// Y") — nie Kontostände, Preise oder Zeitstempel. So kann ein manipulierter
// Client bestenfalls sinnlose Anfragen schicken, aber nie einen falschen
// Spielstand erzeugen.
const router = require('express').Router();
const { q1, pool } = require('../db');
const { auth, ok, bad } = require('../middleware');

const MAX_OFFLINE_MS = 8 * 60 * 60 * 1000; // siehe Anforderung: max. 8h Offline-Gutschrift

// ── KATALOG (serverseitig fix — der Client bekommt ihn nur zur Anzeige) ────
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

const ACHIEVEMENTS = [
  { id:'first_100',       name:'Erste 100 Office Coins',               icon:'🪙', check:(s)=>s.total_earned>=100 },
  { id:'first_passive',   name:'Erste automatische Einnahme',          icon:'⚙️', check:(s,items)=>Object.values(items).some(v=>v>0) },
  { id:'ten_items',       name:'10 Gegenstände gekauft',               icon:'📦', check:(s,items)=>Object.values(items).reduce((a,b)=>a+b,0)>=10 },
  { id:'thousand_per_min',name:'1.000 Office Coins pro Minute',        icon:'🚀', check:(s,items,derived)=>derived.incomePerSecond*60>=1000 },
  { id:'office_complete', name:'Erstes vollständig ausgebautes Büro',  icon:'🏢', check:(s,items)=>ITEMS.every(it=>(items[it.id]||0)>=1) },
  { id:'level_10',        name:'10 Level erreicht',                    icon:'⭐', check:(s)=>s.level>=10 },
];

function parseItems(txt){ try{ const o=JSON.parse(txt||'{}'); return (o&&typeof o==='object')?o:{}; }catch(e){ return {}; } }
function parseList(txt){ try{ const a=JSON.parse(txt||'[]'); return Array.isArray(a)?a:[]; }catch(e){ return []; } }

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
function applyXp(save, amount){
  save.xp += amount;
  let leveledUp=null;
  while (save.xp >= xpForLevel(save.level)){
    save.xp -= xpForLevel(save.level);
    save.level += 1;
    const bonus = save.level*10;
    save.coins += bonus; save.total_earned += bonus;
    leveledUp = save.level;
  }
  return leveledUp;
}
function applyTick(save){
  const now=Date.now();
  const last=new Date(save.last_tick_at).getTime();
  const elapsedMs=Math.max(0, Math.min(now-last, MAX_OFFLINE_MS));
  const items=parseItems(save.owned_items), upgrades=parseList(save.owned_upgrades);
  const derived=computeDerived(items, upgrades);
  const earned=derived.incomePerSecond*(elapsedMs/1000);
  save.coins += earned; save.total_earned += earned;
  save.last_tick_at = new Date(now);
  return { earned, elapsedMs, items, upgrades, derived };
}
function checkAchievements(save, items, derived){
  const have=new Set(parseList(save.achievements));
  const newly=[];
  for (const a of ACHIEVEMENTS){
    if (have.has(a.id)) continue;
    if (a.check(save, items, derived)) { have.add(a.id); newly.push({id:a.id,name:a.name,icon:a.icon}); }
  }
  if (newly.length) save.achievements=JSON.stringify([...have]);
  return newly;
}

async function loadSave(uid){
  let row = await q1('SELECT * FROM game_saves WHERE user_id=$1',[uid]);
  if (!row){
    row = await q1(
      `INSERT INTO game_saves (user_id) VALUES ($1)
       ON CONFLICT (user_id) DO UPDATE SET user_id=EXCLUDED.user_id RETURNING *`,
      [uid]
    );
  }
  return row;
}
async function persistSave(uid, save){
  await pool.query(
    `UPDATE game_saves SET coins=$1, total_earned=$2, xp=$3, level=$4, owned_items=$5,
     owned_upgrades=$6, achievements=$7, last_tick_at=$8, updated_at=NOW() WHERE user_id=$9`,
    [save.coins, save.total_earned, save.xp, save.level, save.owned_items,
     save.owned_upgrades, save.achievements, save.last_tick_at, uid]
  );
}
function buildState(save, items, upgrades, derived, extra){
  const costMult = derived.costMult;
  return {
    coins: save.coins, totalEarned: save.total_earned,
    xp: save.xp, level: save.level, xpToNext: xpForLevel(save.level),
    ownedItems: items, ownedUpgrades: upgrades,
    achievements: parseList(save.achievements),
    derived: { clickValue: derived.clickValue, incomePerSecond: derived.incomePerSecond },
    prices: ITEMS.map(it => ({ id: it.id, price: itemPrice(it, items[it.id]||0, costMult) })),
    catalog: {
      items: ITEMS.map(it => ({ id:it.id, name:it.name, icon:it.icon, rate:it.rate*(derived.incomeMult*(derived.itemMult[it.id]||1)), baseCost:it.baseCost })),
      upgrades: UPGRADES.map(u => ({ id:u.id, name:u.name, desc:u.desc, cost:u.cost, requires:u.requires })),
      achievements: ACHIEVEMENTS.map(a => ({ id:a.id, name:a.name, icon:a.icon })),
    },
    ...extra,
  };
}

router.get('/game/state', auth, async (req, res) => {
  try {
    const save = await loadSave(req.uid);
    const gapMs = Date.now() - new Date(save.last_tick_at).getTime();
    const { earned, elapsedMs, items, upgrades, derived } = applyTick(save);
    const newAchievements = checkAchievements(save, items, derived);
    await persistSave(req.uid, save);
    // "Willkommen zurück" nur anzeigen, wenn seit dem letzten Kontakt
    // tatsächlich eine nennenswerte Pause lag (nicht bei jedem Tab-Wechsel).
    const showOffline = gapMs > 60000;
    ok(res, buildState(save, items, upgrades, derived, {
      offlineEarnings: showOffline ? earned : 0,
      offlineSeconds: showOffline ? Math.round(elapsedMs/1000) : 0,
      newAchievements,
    }));
  } catch(e) { bad(res, 'Serverfehler', 500); }
});

router.post('/game/click', auth, async (req, res) => {
  try {
    const save = await loadSave(req.uid);
    const { items, upgrades, derived } = applyTick(save);
    save.coins += derived.clickValue; save.total_earned += derived.clickValue;
    const leveledUp = applyXp(save, 1);
    // Klick ändert keine Items/Upgrades — "derived" bleibt gültig für die Antwort.
    const newAchievements = checkAchievements(save, items, derived);
    await persistSave(req.uid, save);
    ok(res, buildState(save, items, upgrades, derived, { leveledUp, newAchievements }));
  } catch(e) { bad(res, 'Serverfehler', 500); }
});

router.post('/game/buy-item', auth, async (req, res) => {
  try {
    const { itemId } = req.body;
    const item = ITEMS_BY_ID[itemId];
    if (!item) return bad(res, 'Unbekannter Gegenstand', 400);
    const save = await loadSave(req.uid);
    const { items, upgrades, derived } = applyTick(save);
    const owned = items[itemId]||0;
    const price = itemPrice(item, owned, derived.costMult);
    if (save.coins < price) return bad(res, 'Nicht genug Office Coins', 400);
    save.coins -= price;
    items[itemId] = owned+1;
    save.owned_items = JSON.stringify(items);
    const leveledUp = applyXp(save, 5);
    const derived2 = computeDerived(items, upgrades);
    const newAchievements = checkAchievements(save, items, derived2);
    await persistSave(req.uid, save);
    ok(res, buildState(save, items, upgrades, derived2, { leveledUp, newAchievements }));
  } catch(e) { bad(res, 'Serverfehler', 500); }
});

router.post('/game/buy-upgrade', auth, async (req, res) => {
  try {
    const { upgradeId } = req.body;
    const upg = UPGRADES_BY_ID[upgradeId];
    if (!upg) return bad(res, 'Unbekanntes Upgrade', 400);
    const save = await loadSave(req.uid);
    const { items, upgrades, derived } = applyTick(save);
    if (upgrades.includes(upgradeId)) return bad(res, 'Bereits freigeschaltet', 400);
    if (upg.requires && !upgrades.includes(upg.requires)) return bad(res, 'Voraussetzung fehlt: '+(UPGRADES_BY_ID[upg.requires]?.name||upg.requires), 400);
    if (save.coins < upg.cost) return bad(res, 'Nicht genug Office Coins', 400);
    save.coins -= upg.cost;
    upgrades.push(upgradeId);
    save.owned_upgrades = JSON.stringify(upgrades);
    const leveledUp = applyXp(save, 20);
    const derived2 = computeDerived(items, upgrades);
    const newAchievements = checkAchievements(save, items, derived2);
    await persistSave(req.uid, save);
    ok(res, buildState(save, items, upgrades, derived2, { leveledUp, newAchievements }));
  } catch(e) { bad(res, 'Serverfehler', 500); }
});

module.exports = router;
