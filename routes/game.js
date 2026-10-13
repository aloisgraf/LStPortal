'use strict';
// "Desk Empire" — kleines Idle-Spiel (Menüpunkt "Spiele" in der Kopfzeile).
// Design-Entscheidung: der Server ist die einzige Quelle der Wahrheit für
// Kontostand, Preise, Einnahmen/Sekunde und vergangene Zeit. Der Client
// schickt ausschließlich Absichten ("Klick", "kaufe Item X", "stelle
// Mitarbeiter Y ein" usw.) — nie Kontostände, Preise oder Zeitstempel.
// Die eigentliche Spiellogik/Katalog steckt in lib/game-logic.js (zustandslos,
// automatisiert getestet in test/game-logic.test.mjs); diese Datei ist nur
// die dünne DB-/HTTP-Schicht darüber: Spielstand laden/speichern, pro Route
// den jeweils gültigen Zeit-Tick anwenden und die Antwort zusammenbauen.
const router = require('express').Router();
const { q1, pool } = require('../db');
const { auth, ok, bad } = require('../middleware');
const GL = require('../lib/game-logic');
const {
  MAX_OFFLINE_MS, GAME_HOURS_PER_REAL_SECOND,
  ITEMS, ITEMS_BY_ID, UPGRADES, UPGRADES_BY_ID,
  EMPLOYEE_CLASSES, EMPLOYEE_CLASSES_BY_ID,
  WORKSTATIONS, WORKSTATIONS_BY_ID, PERKS, PERKS_BY_ID,
  TEAMBUILDING_COST, TEAMBUILDING_DURATION_MS, ACHIEVEMENTS,
  parseItems, parseList, computeDerived, itemPrice, xpForLevel,
  computeWorkforce, tickEmployeeWellbeing, employeeProductivity,
  randomEmployeeName, INCOME_PER_PRODUCTIVITY,
} = GL;

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
  const elapsedSec=elapsedMs/1000;
  const gameHoursElapsed=elapsedSec*GAME_HOURS_PER_REAL_SECOND;

  const items=parseItems(save.owned_items), upgrades=parseList(save.owned_upgrades);
  const employees=parseList(save.employees);
  const workstations=parseItems(save.workstations), perks=parseItems(save.perks);
  const teambuildingActive = !!(save.teambuilding_until && new Date(save.teambuilding_until).getTime()>now);
  const vacationMult = (perks['perk_vacation']||0) > 0 ? 0.95 : 1;

  const itemDerived=computeDerived(items, upgrades);
  const agg=computeWorkforce(workstations, perks, teambuildingActive);
  const activeEmployees = employees.filter(e=>e.status==='active');

  let employeeIncomePerGameHour=0, wageCostPerGameHour=0;
  for (const emp of activeEmployees){
    employeeIncomePerGameHour += employeeProductivity(emp, agg, vacationMult)*INCOME_PER_PRODUCTIVITY;
    wageCostPerGameHour += (EMPLOYEE_CLASSES_BY_ID[emp.classId]?.wage||0);
  }
  let workstationUpkeepPerGameHour=0;
  for (const ws of WORKSTATIONS){ const c=workstations[ws.id]||0; if(c) workstationUpkeepPerGameHour += ws.upkeep*c; }
  let perkUpkeepPerGameHour=0;
  for (const pk of PERKS){ const c=perks[pk.id]||0; if(c) perkUpkeepPerGameHour += pk.upkeep*c; }

  const itemIncomePerGameHour = itemDerived.incomePerSecond*60;
  const totalIncomePerGameHour = itemIncomePerGameHour + employeeIncomePerGameHour;
  const totalCostPerGameHour = wageCostPerGameHour + workstationUpkeepPerGameHour + perkUpkeepPerGameHour;
  const netPerGameHour = totalIncomePerGameHour - totalCostPerGameHour;
  const netPerSecond = netPerGameHour/60;
  const delta = netPerSecond*elapsedSec;

  save.coins = Math.max(0, save.coins+delta); // nie negativ (siehe Anforderung 8)
  if (delta>0) save.total_earned += delta;

  // Wohlbefinden fortschreiben — wirkt sich erst auf den NÄCHSTEN Tick aus,
  // damit ein Tick nicht rückwirkend seine eigene Berechnungsgrundlage ändert.
  for (const emp of activeEmployees) tickEmployeeWellbeing(emp, gameHoursElapsed, agg, activeEmployees.length, netPerGameHour<0);
  save.employees = JSON.stringify(employees);
  save.last_tick_at = new Date(now);

  return {
    earned: Math.max(0,delta), elapsedMs, items, upgrades, employees, workstations, perks,
    itemDerived, agg, teambuildingActive,
    financials: { itemIncomePerGameHour, employeeIncomePerGameHour, wageCostPerGameHour, workstationUpkeepPerGameHour, perkUpkeepPerGameHour, totalIncomePerGameHour, totalCostPerGameHour, netPerGameHour },
  };
}
function checkAchievements(save, items, derived, employees){
  const have=new Set(parseList(save.achievements));
  const newly=[];
  for (const a of ACHIEVEMENTS){
    if (have.has(a.id)) continue;
    if (a.check(save, items, derived, employees||[])) { have.add(a.id); newly.push({id:a.id,name:a.name,icon:a.icon}); }
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
     owned_upgrades=$6, achievements=$7, last_tick_at=$8, employees=$9, workstations=$10,
     perks=$11, teambuilding_until=$12, updated_at=NOW() WHERE user_id=$13`,
    [save.coins, save.total_earned, save.xp, save.level, save.owned_items,
     save.owned_upgrades, save.achievements, save.last_tick_at, save.employees,
     save.workstations, save.perks, save.teambuilding_until||null, uid]
  );
}
function buildState(save, ctx, extra){
  const { items, upgrades, employees, workstations, perks, itemDerived, agg, teambuildingActive, financials } = ctx;
  const costMult = itemDerived.costMult;
  const activeEmployees = employees.filter(e=>e.status==='active');
  const avg = (arr, fn) => arr.length ? arr.reduce((s,x)=>s+fn(x),0)/arr.length : 0;
  return {
    coins: save.coins, totalEarned: save.total_earned,
    xp: save.xp, level: save.level, xpToNext: xpForLevel(save.level),
    ownedItems: items, ownedUpgrades: upgrades,
    achievements: parseList(save.achievements),
    derived: { clickValue: itemDerived.clickValue, incomePerSecond: itemDerived.incomePerSecond },
    prices: ITEMS.map(it => ({ id: it.id, price: itemPrice(it, items[it.id]||0, costMult) })),
    employees,
    workstations, perks,
    maxEmployees: agg.maxEmployees,
    workforce: {
      activeCount: activeEmployees.length,
      avgHealth: avg(activeEmployees, e=>e.health),
      avgSatisfaction: avg(activeEmployees, e=>e.satisfaction),
    },
    teambuildingActive, teambuildingUntil: save.teambuilding_until||null,
    financials,
    workstationPrices: WORKSTATIONS.map(w => ({ id:w.id, cost:w.cost })),
    perkPrices: PERKS.map(p => ({ id:p.id, cost:p.cost })),
    catalog: {
      items: ITEMS.map(it => ({ id:it.id, name:it.name, icon:it.icon, rate:it.rate*(itemDerived.incomeMult*(itemDerived.itemMult[it.id]||1)), baseCost:it.baseCost })),
      upgrades: UPGRADES.map(u => ({ id:u.id, name:u.name, desc:u.desc, cost:u.cost, requires:u.requires })),
      achievements: ACHIEVEMENTS.map(a => ({ id:a.id, name:a.name, icon:a.icon })),
      employeeClasses: EMPLOYEE_CLASSES,
      workstations: WORKSTATIONS.map(w => ({ id:w.id, name:w.name, icon:w.icon, cost:w.cost, upkeep:w.upkeep })),
      perks: PERKS.map(p => ({ id:p.id, name:p.name, icon:p.icon, cost:p.cost, upkeep:p.upkeep, maxCount:p.maxCount })),
      teambuildingCost: TEAMBUILDING_COST,
    },
    ...extra,
  };
}

router.get('/game/state', auth, async (req, res) => {
  try {
    const save = await loadSave(req.uid);
    const gapMs = Date.now() - new Date(save.last_tick_at).getTime();
    const ctx = applyTick(save);
    const newAchievements = checkAchievements(save, ctx.items, ctx.itemDerived, ctx.employees);
    await persistSave(req.uid, save);
    const showOffline = gapMs > 60000;
    ok(res, buildState(save, ctx, {
      offlineEarnings: showOffline ? ctx.earned : 0,
      offlineSeconds: showOffline ? Math.round(ctx.elapsedMs/1000) : 0,
      newAchievements,
    }));
  } catch(e) { bad(res, 'Serverfehler', 500); }
});

router.post('/game/click', auth, async (req, res) => {
  try {
    const save = await loadSave(req.uid);
    const ctx = applyTick(save);
    save.coins += ctx.itemDerived.clickValue; save.total_earned += ctx.itemDerived.clickValue;
    const leveledUp = applyXp(save, 1);
    const newAchievements = checkAchievements(save, ctx.items, ctx.itemDerived, ctx.employees);
    await persistSave(req.uid, save);
    ok(res, buildState(save, ctx, { leveledUp, newAchievements }));
  } catch(e) { bad(res, 'Serverfehler', 500); }
});

router.post('/game/buy-item', auth, async (req, res) => {
  try {
    const { itemId } = req.body;
    const item = ITEMS_BY_ID[itemId];
    if (!item) return bad(res, 'Unbekannter Gegenstand', 400);
    const save = await loadSave(req.uid);
    const ctx = applyTick(save);
    const owned = ctx.items[itemId]||0;
    const price = itemPrice(item, owned, ctx.itemDerived.costMult);
    if (save.coins < price) return bad(res, 'Nicht genug Office Coins', 400);
    save.coins -= price;
    ctx.items[itemId] = owned+1;
    save.owned_items = JSON.stringify(ctx.items);
    const leveledUp = applyXp(save, 5);
    ctx.itemDerived = computeDerived(ctx.items, ctx.upgrades);
    const newAchievements = checkAchievements(save, ctx.items, ctx.itemDerived, ctx.employees);
    await persistSave(req.uid, save);
    ok(res, buildState(save, ctx, { leveledUp, newAchievements }));
  } catch(e) { bad(res, 'Serverfehler', 500); }
});

router.post('/game/buy-upgrade', auth, async (req, res) => {
  try {
    const { upgradeId } = req.body;
    const upg = UPGRADES_BY_ID[upgradeId];
    if (!upg) return bad(res, 'Unbekanntes Upgrade', 400);
    const save = await loadSave(req.uid);
    const ctx = applyTick(save);
    if (ctx.upgrades.includes(upgradeId)) return bad(res, 'Bereits freigeschaltet', 400);
    if (upg.requires && !ctx.upgrades.includes(upg.requires)) return bad(res, 'Voraussetzung fehlt: '+(UPGRADES_BY_ID[upg.requires]?.name||upg.requires), 400);
    if (save.coins < upg.cost) return bad(res, 'Nicht genug Office Coins', 400);
    save.coins -= upg.cost;
    ctx.upgrades.push(upgradeId);
    save.owned_upgrades = JSON.stringify(ctx.upgrades);
    const leveledUp = applyXp(save, 20);
    ctx.itemDerived = computeDerived(ctx.items, ctx.upgrades);
    const newAchievements = checkAchievements(save, ctx.items, ctx.itemDerived, ctx.employees);
    await persistSave(req.uid, save);
    ok(res, buildState(save, ctx, { leveledUp, newAchievements }));
  } catch(e) { bad(res, 'Serverfehler', 500); }
});

// ── MITARBEITER: EINSTELLEN/KÜNDIGEN ───────────────────────────────────────
router.post('/game/hire', auth, async (req, res) => {
  try {
    const { classId } = req.body;
    const cls = EMPLOYEE_CLASSES_BY_ID[classId];
    if (!cls) return bad(res, 'Unbekannte Position', 400);
    const save = await loadSave(req.uid);
    const ctx = applyTick(save);
    const activeCount = ctx.employees.filter(e=>e.status==='active').length;
    if (activeCount >= ctx.agg.maxEmployees) return bad(res, 'Kein freier Arbeitsplatz — zuerst Büroausstattung erweitern', 400);
    if (save.coins < cls.hireCost) return bad(res, 'Nicht genug Office Coins', 400);
    save.coins -= cls.hireCost;
    ctx.employees.push({
      id: 'e_'+Date.now().toString(36)+Math.random().toString(36).slice(2,7),
      name: randomEmployeeName(), classId, status:'active',
      health:70, satisfaction:70, hiredAt:new Date().toISOString(),
    });
    save.employees = JSON.stringify(ctx.employees);
    const leveledUp = applyXp(save, 10);
    const newAchievements = checkAchievements(save, ctx.items, ctx.itemDerived, ctx.employees);
    await persistSave(req.uid, save);
    ok(res, buildState(save, ctx, { leveledUp, newAchievements }));
  } catch(e) { bad(res, 'Serverfehler', 500); }
});

router.post('/game/fire', auth, async (req, res) => {
  try {
    const { employeeId } = req.body;
    const save = await loadSave(req.uid);
    const ctx = applyTick(save);
    const emp = ctx.employees.find(e=>e.id===employeeId && e.status==='active');
    if (!emp) return bad(res, 'Mitarbeiter nicht gefunden', 404);
    emp.status = 'terminated';
    emp.terminatedAt = new Date().toISOString();
    save.employees = JSON.stringify(ctx.employees);
    await persistSave(req.uid, save);
    ok(res, buildState(save, ctx, {}));
  } catch(e) { bad(res, 'Serverfehler', 500); }
});

// ── BÜROAUSSTATTUNG (ARBEITSPLÄTZE) ────────────────────────────────────────
router.post('/game/buy-workstation', auth, async (req, res) => {
  try {
    const { workstationId } = req.body;
    const ws = WORKSTATIONS_BY_ID[workstationId];
    if (!ws) return bad(res, 'Unbekannte Ausstattung', 400);
    const save = await loadSave(req.uid);
    const ctx = applyTick(save);
    if (save.coins < ws.cost) return bad(res, 'Nicht genug Office Coins', 400);
    save.coins -= ws.cost;
    ctx.workstations[workstationId] = (ctx.workstations[workstationId]||0)+1;
    save.workstations = JSON.stringify(ctx.workstations);
    ctx.agg = computeWorkforce(ctx.workstations, ctx.perks, ctx.teambuildingActive);
    const leveledUp = applyXp(save, 8);
    const newAchievements = checkAchievements(save, ctx.items, ctx.itemDerived, ctx.employees);
    await persistSave(req.uid, save);
    ok(res, buildState(save, ctx, { leveledUp, newAchievements }));
  } catch(e) { bad(res, 'Serverfehler', 500); }
});

// ── MITARBEITERANGEBOTE ────────────────────────────────────────────────────
router.post('/game/buy-perk', auth, async (req, res) => {
  try {
    const { perkId } = req.body;
    const pk = PERKS_BY_ID[perkId];
    if (!pk) return bad(res, 'Unbekanntes Angebot', 400);
    const save = await loadSave(req.uid);
    const ctx = applyTick(save);
    const owned = ctx.perks[perkId]||0;
    if (owned >= pk.maxCount) return bad(res, 'Bereits in maximaler Anzahl vorhanden', 400);
    if (save.coins < pk.cost) return bad(res, 'Nicht genug Office Coins', 400);
    save.coins -= pk.cost;
    ctx.perks[perkId] = owned+1;
    save.perks = JSON.stringify(ctx.perks);
    ctx.agg = computeWorkforce(ctx.workstations, ctx.perks, ctx.teambuildingActive);
    const leveledUp = applyXp(save, 8);
    const newAchievements = checkAchievements(save, ctx.items, ctx.itemDerived, ctx.employees);
    await persistSave(req.uid, save);
    ok(res, buildState(save, ctx, { leveledUp, newAchievements }));
  } catch(e) { bad(res, 'Serverfehler', 500); }
});

router.post('/game/teambuilding', auth, async (req, res) => {
  try {
    const save = await loadSave(req.uid);
    const ctx = applyTick(save);
    if (ctx.teambuildingActive) return bad(res, 'Teambuilding läuft noch', 400);
    if (save.coins < TEAMBUILDING_COST) return bad(res, 'Nicht genug Office Coins', 400);
    save.coins -= TEAMBUILDING_COST;
    save.teambuilding_until = new Date(Date.now()+TEAMBUILDING_DURATION_MS);
    ctx.teambuildingActive = true;
    ctx.agg = computeWorkforce(ctx.workstations, ctx.perks, ctx.teambuildingActive);
    const newAchievements = checkAchievements(save, ctx.items, ctx.itemDerived, ctx.employees);
    await persistSave(req.uid, save);
    ok(res, buildState(save, ctx, { newAchievements }));
  } catch(e) { bad(res, 'Serverfehler', 500); }
});

module.exports = router;
