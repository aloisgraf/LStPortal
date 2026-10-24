import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const GL = require('../lib/game-logic');

const T0 = Date.UTC(2026, 0, 1);
const fresh = () => GL.newState(T0);
const rich = (stage = 1) => { const s = fresh(); s.coins = 1e12; s.stage = stage; s.level = 40; return s; };

describe('Spielstand laden', () => {
  it('ohne gespeicherten Stand: neuer Stand, kein Reset-Hinweis', () => {
    const { state, reset } = GL.loadState(null, T0);
    expect(state.v).toBe(GL.SAVE_VERSION);
    expect(state.coins).toBe(GL.START_COINS);
    expect(reset).toBe(false);
  });
  it('alter oder kaputter Stand startet neu und meldet den Reset', () => {
    expect(GL.loadState('{"v":1,"coins":999999}', T0).reset).toBe(true);
    expect(GL.loadState('kein json', T0).state.coins).toBe(GL.START_COINS);
  });
  it('aktueller Stand bleibt erhalten, fehlende Felder werden ergänzt', () => {
    const s = fresh(); s.coins = 1234; delete s.stats;
    const { state, reset } = GL.loadState(JSON.stringify(s), T0);
    expect(reset).toBe(false);
    expect(state.coins).toBe(1234);
    expect(state.stats).toBeTruthy();
  });
});

describe('Preise und Amortisation', () => {
  it('erster Kauf kostet den Grundpreis, jeder weitere mehr', () => {
    const plant = GL.OBJECTS_BY_ID.plant;
    expect(GL.objectPrice(plant, 0, 1)).toBe(plant.baseCost);
    expect(GL.objectPrice(plant, 1, 1)).toBeGreaterThan(plant.baseCost);
  });
  it('höhere Etappen amortisieren sich deutlich langsamer (nicht mehr alles in 2–3 Minuten)', () => {
    const payback = o => o.baseCost / o.income; // Minuten
    const deko = GL.OBJECTS.filter(o => o.cat === 'deko');
    const byStage = st => Math.min(...deko.filter(o => o.stage === st).map(payback));
    expect(byStage(1)).toBeGreaterThanOrEqual(5);
    expect(byStage(2)).toBeGreaterThan(byStage(1));
    expect(byStage(3)).toBeGreaterThan(byStage(2));
    expect(byStage(4)).toBeGreaterThan(60);
  });
});

describe('Stellflächen und Etappen', () => {
  it('jeder Kauf belegt eine Stellfläche und erscheint im Layout', () => {
    const s = rich();
    GL.buyObject(s, 'plant'); GL.buyObject(s, 'plant'); GL.buyObject(s, 'desk');
    expect(s.layout).toEqual(['plant', 'plant', 'desk']);
    expect(s.objects.plant).toBe(2);
  });
  it('volles Büro: kein weiterer Kauf möglich', () => {
    const s = rich();
    for (let i = 0; i < GL.stageSlots(1); i++) GL.buyObject(s, 'plant');
    expect(() => GL.buyObject(s, 'plant')).toThrow(/Kein freier Platz/);
  });
  it('Einrichtung höherer Etappen ist gesperrt', () => {
    const s = rich(1);
    expect(() => GL.buyObject(s, 'monitor2')).toThrow(/Etappe/);
  });
  it('Umzug braucht Level und Geld', () => {
    const s = fresh(); s.coins = 1e9;
    expect(() => GL.moveStage(s)).toThrow(/Level/);
    s.level = GL.STAGES[1].minLevel; s.coins = 0;
    expect(() => GL.moveStage(s)).toThrow(/Nicht genug/);
    s.coins = GL.STAGES[1].cost;
    GL.moveStage(s);
    expect(s.stage).toBe(2);
    expect(GL.stageSlots(2)).toBeGreaterThan(GL.stageSlots(1));
  });
  it('Verkauf gibt den halben Preis zurück und gibt die Fläche frei', () => {
    const s = rich(); GL.buyObject(s, 'coffee');
    const before = s.coins;
    const refund = GL.sellObject(s, 0, T0);
    expect(refund).toBe(Math.floor(GL.OBJECTS_BY_ID.coffee.baseCost * 0.5));
    expect(s.coins).toBe(before + refund);
    expect(s.layout).toEqual([]);
  });
  it('besetzter Arbeitsplatz kann nicht verkauft werden', () => {
    const s = rich(); GL.buyObject(s, 'desk'); GL.hire(s, 'clerk', T0);
    expect(() => GL.sellObject(s, 0, T0)).toThrow(/besetzt/);
  });
});

describe('Mitarbeiter', () => {
  it('ohne Arbeitsplatz keine Einstellung', () => {
    const s = rich();
    expect(() => GL.hire(s, 'clerk', T0)).toThrow(/Arbeitsplatz/);
  });
  it('bei neutraler Stimmung (50/50) leicht im Plus, gut versorgt deutlich, krank im Minus', () => {
    const s = rich(); const f = GL.financials(s, T0);
    const inc = (h, v) => GL.employeeIncome({ classId: 'clerk', health: h, satisfaction: v }, f.agg, f.fx);
    const wage = GL.EMPLOYEE_CLASSES_BY_ID.clerk.wage;
    expect(inc(50, 50)).toBeGreaterThan(wage);
    expect(inc(50, 50)).toBeLessThan(wage * 1.5);
    expect(inc(85, 85)).toBeGreaterThan(wage * 1.6);
    expect(inc(15, 15)).toBeLessThan(wage);
  });
  it('Wohlbefinden nähert sich schrittweise dem Ziel, unabhängig von der Schrittweite', () => {
    const agg = { healthFlat: 20, satisfactionFlat: 10, teamMult: 0, recovery: 100 };
    const big = { health: 50, satisfaction: 50 }, small = { health: 50, satisfaction: 50 };
    GL.tickEmployeeWellbeing(big, 10, agg, 1, false);
    for (let i = 0; i < 10; i++) GL.tickEmployeeWellbeing(small, 1, agg, 1, false);
    expect(big.health).toBeCloseTo(small.health, 6);
    expect(big.health).toBeGreaterThan(50);
    expect(big.health).toBeLessThan(70);
  });
  it('Überlastung ohne Erholungsräume senkt die Gesundheit', () => {
    const agg = { healthFlat: 0, satisfactionFlat: 0, teamMult: 0, recovery: 0 };
    expect(GL.wellbeingTargets({ health: 50 }, agg, 15, false).health)
      .toBeLessThan(GL.wellbeingTargets({ health: 50 }, agg, 2, false).health);
  });
  it('Boni sind gedeckelt', () => {
    const s = rich(3);
    s.policies = { chairs: 1, canteen: 1, bgf: 1 };
    s.objects = { gym: 2, water: 3, fruit: 3, desk_ergo: 20 };
    expect(GL.computeWorkforce(s, T0).healthFlat).toBe(45);
  });
});

describe('Zeitfortschritt und Offline-Ertrag', () => {
  const withIncome = () => { const s = rich(); s.coins = 0; GL.buyObject(Object.assign(s, { coins: 1e9 }), 'coffee'); s.coins = 0; s.lastTickAt = T0; return s; };
  it('kurze Lücken zählen voll', () => {
    const s = withIncome();
    GL.tick(s, T0 + 30e3);
    expect(s.coins).toBeCloseTo(GL.OBJECTS_BY_ID.coffee.income / 2, 5);
  });
  it('lange Abwesenheit: gekappt auf 2 Stunden zu 50 %', () => {
    const s = withIncome();
    const info = GL.tick(s, T0 + 24 * 3600e3);
    expect(info.offline).toBe(true);
    expect(s.coins).toBeCloseTo(GL.OBJECTS_BY_ID.coffee.income * 120 * 0.5, 5);
  });
  it('Upgrade „Nachtschicht“ verlängert den Offline-Ertrag', () => {
    const s = withIncome(); s.stage = 2; s.upgrades.push('night_shift');
    GL.tick(s, T0 + 24 * 3600e3);
    expect(s.coins).toBeCloseTo(GL.OBJECTS_BY_ID.coffee.income * 360 * 0.75, 5);
  });
  it('Kontostand wird nie negativ', () => {
    const s = rich(); GL.buyObject(s, 'desk'); GL.hire(s, 'clerk', T0);
    s.employees[0].health = 0; s.employees[0].satisfaction = 0; s.coins = 10; s.lastTickAt = T0;
    GL.tick(s, T0 + 50e3);
    expect(s.coins).toBeGreaterThanOrEqual(0);
  });
  it('XP kommt aus verdienten Office Coins und hebt das Level', () => {
    const s = fresh(); s.lastClickAt = T0 - 10e3;
    GL.click(s, 10, T0);
    expect(s.xp).toBe(10);
    s.xp = GL.xpForLevel(1); GL.tick(s, T0 + 1000);
    expect(s.level).toBe(2);
  });
});

describe('Klick-Schutz', () => {
  it('höchstens 10 Klicks pro Sekunde werden angerechnet', () => {
    const s = fresh(); s.lastClickAt = T0;
    expect(GL.click(s, 500, T0 + 1000)).toBe(10);
    expect(GL.click(s, 3, T0 + 2000)).toBe(3);
  });
  it('lange Pause zählt nur bis zum Fenster von 5 Sekunden', () => {
    const s = fresh(); s.lastClickAt = T0;
    expect(GL.click(s, 500, T0 + 60e3)).toBe(50);
  });
});

describe('Aufträge', () => {
  it('nach der Wartezeit wird ein Auftrag angeboten, angenommen und belohnt', () => {
    const s = fresh(); s.lastClickAt = T0;
    GL.tick(s, T0 + 61e3);
    expect(s.order).toBeTruthy();
    s.order = { type: 'clicks', name: 'Test', desc: '', target: 20, reward: 500, progress: 0, active: false, offeredUntil: T0 + 600e3, durationMs: 120e3 };
    GL.acceptOrder(s, T0 + 62e3);
    GL.click(s, 20, T0 + 64e3);
    const coins = s.coins;
    const info = GL.tick(s, T0 + 65e3);
    expect(info.orderEvent?.done).toBe(true);
    expect(s.coins).toBeGreaterThanOrEqual(coins + 500);
    expect(s.stats.ordersDone).toBe(1);
  });
  it('abgelaufener Auftrag scheitert ohne Belohnung', () => {
    const s = fresh();
    s.order = { type: 'clicks', name: 'Test', desc: '', target: 999, reward: 500, progress: 0, active: true, expiresAt: T0 + 1000, durationMs: 1000 };
    const info = GL.tick(s, T0 + 5000);
    expect(info.orderEvent?.failed).toBe(true);
    expect(s.order).toBeNull();
  });
});

describe('Katalog-Konsistenz', () => {
  it('Voraussetzungen von Upgrades existieren', () => {
    GL.UPGRADES.forEach(u => { if (u.requires) expect(GL.UPGRADES_BY_ID[u.requires]).toBeTruthy(); });
  });
  it('Etappen-Angaben aller Kataloge sind gültig', () => {
    const ids = new Set(GL.STAGES.map(s => s.id));
    [...GL.OBJECTS, ...GL.POLICIES, ...GL.UPGRADES, ...GL.EMPLOYEE_CLASSES].forEach(x => expect(ids.has(x.stage)).toBe(true));
  });
  it('Mitarbeiterklassen steigen in Gehalt und Leistung', () => {
    const c = GL.EMPLOYEE_CLASSES;
    for (let i = 1; i < c.length; i++) {
      expect(c[i].wage).toBeGreaterThan(c[i - 1].wage);
      expect(c[i].productivity).toBeGreaterThan(c[i - 1].productivity);
    }
  });
  it('Ansicht enthält Preise für jedes Objekt', () => {
    const v = GL.view(fresh(), T0);
    GL.OBJECTS.forEach(o => expect(v.prices[o.id]).toBeGreaterThan(0));
    expect(v.slots).toBe(GL.stageSlots(1));
  });
});
