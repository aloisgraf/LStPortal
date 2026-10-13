import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const GL = require('../lib/game-logic');
const {
  ITEMS_BY_ID, UPGRADES_BY_ID, EMPLOYEE_CLASSES_BY_ID, WORKSTATIONS_BY_ID, PERKS_BY_ID,
  computeDerived, itemPrice, xpForLevel, computeWorkforce, tickEmployeeWellbeing,
  employeeProductivity, healthFactor, satisfactionFactor,
} = GL;

describe('itemPrice — Kostensteigerung', () => {
  it('erster Kauf kostet genau den Grundpreis', () => {
    expect(itemPrice(ITEMS_BY_ID.plant, 0, 1)).toBe(25);
  });
  it('steigt mit Faktor 1.15 je bereits besessenem Exemplar', () => {
    const p1 = itemPrice(ITEMS_BY_ID.plant, 1, 1);
    const p2 = itemPrice(ITEMS_BY_ID.plant, 2, 1);
    expect(p1).toBe(Math.ceil(25*1.15));
    expect(p2).toBeGreaterThan(p1);
  });
  it('costMult (z.B. Verhandlungsgeschick) senkt den Preis, aber nie unter 1', () => {
    const cheap = itemPrice(ITEMS_BY_ID.plant, 0, 0.9);
    expect(cheap).toBeLessThan(25);
    expect(itemPrice(ITEMS_BY_ID.plant, 0, 0)).toBeGreaterThanOrEqual(1);
  });
});

describe('computeDerived — Klick-/Einnahmen-Upgrades', () => {
  it('ohne Upgrades: Klickwert 1, keine automatischen Einnahmen ohne Items', () => {
    const d = computeDerived({}, []);
    expect(d.clickValue).toBe(1);
    expect(d.incomePerSecond).toBe(0);
  });
  it('clickAdd- und clickMult-Upgrades kombinieren sich korrekt', () => {
    // click_mouse: +1, click_x2: *2 → (1+1)*2 = 4
    const d = computeDerived({}, ['click_mouse','click_x2']);
    expect(d.clickValue).toBe(4);
  });
  it('itemMult wirkt nur auf das Zielitem, nicht auf andere', () => {
    const items = { coffee: 2, lamp: 2 };
    const withUpgrade = computeDerived(items, ['coffee_culture']);
    const without = computeDerived(items, []);
    expect(withUpgrade.incomePerSecond).toBeGreaterThan(without.incomePerSecond);
    // Kaffeemaschine (rate 1.5) verdoppelt: 2*1.5*2=6, Lampe (rate 0.5) unverändert: 2*0.5=1 → 7 gesamt
    expect(withUpgrade.incomePerSecond).toBeCloseTo(7, 5);
  });
});

describe('xpForLevel', () => {
  it('ist monoton steigend', () => {
    expect(xpForLevel(2)).toBeGreaterThan(xpForLevel(1));
    expect(xpForLevel(10)).toBeGreaterThan(xpForLevel(5));
  });
});

describe('computeWorkforce — Kapazität & gedeckelte Boni', () => {
  it('ohne Arbeitsplätze: 0 Kapazität', () => {
    const agg = computeWorkforce({}, {}, false);
    expect(agg.maxEmployees).toBe(0);
  });
  it('Arbeitsplätze summieren Kapazität korrekt (einfach=1, doppelt=2)', () => {
    const agg = computeWorkforce({ ws_simple:2, ws_double:1 }, {}, false);
    expect(agg.maxEmployees).toBe(4);
  });
  it('Gesundheits-/Zufriedenheitsboni sind gedeckelt, nicht beliebig stapelbar', () => {
    // Viele Wasserspender (healthFlat 2 je Stück, max 5 Stück = 10) weit unter dem Deckel (45)
    const small = computeWorkforce({}, { perk_water: 5 }, false);
    expect(small.healthFlat).toBe(10);
    // Simulierte Übersättigung aus mehreren High-Health-Quellen bleibt bei 45 gedeckelt
    const saturated = computeWorkforce(
      { ws_ergo: 10, ws_fitness: 10 },
      { perk_water: 5, perk_fruit: 5, perk_chairs: 1, perk_canteen: 1, perk_fitness: 1, perk_bgf: 1 },
      false
    );
    expect(saturated.healthFlat).toBe(45);
  });
  it('Teambuilding erhöht Zufriedenheit und Team-Multiplikator temporär', () => {
    const inactive = computeWorkforce({}, {}, false);
    const active = computeWorkforce({}, {}, true);
    expect(active.satisfactionFlat).toBeGreaterThan(inactive.satisfactionFlat);
    expect(active.teamMult).toBeGreaterThan(inactive.teamMult);
  });
});

describe('tickEmployeeWellbeing — graduelle, zeitschritt-unabhängige Annäherung', () => {
  const agg = { healthFlat: 20, satisfactionFlat: 10, teamMult: 0, recoveryCapacity: 100 };
  it('bewegt sich schrittweise auf den Zielwert zu, springt nicht sofort', () => {
    const emp = { health: 50, satisfaction: 50 };
    tickEmployeeWellbeing(emp, 1, agg, 1, false);
    expect(emp.health).toBeGreaterThan(50);
    expect(emp.health).toBeLessThan(70); // Zielwert (50+20), aber nicht erreicht nach nur 1 Spielstunde
  });
  it('viele kleine Ticks ergeben (näherungsweise) dasselbe wie ein großer Tick über dieselbe Zeit', () => {
    const empBig = { health: 50, satisfaction: 50 };
    tickEmployeeWellbeing(empBig, 10, agg, 1, false);
    const empSmall = { health: 50, satisfaction: 50 };
    for (let i=0;i<10;i++) tickEmployeeWellbeing(empSmall, 1, agg, 1, false);
    expect(empBig.health).toBeCloseTo(empSmall.health, 6);
  });
  it('Werte bleiben innerhalb [0,100]', () => {
    const emp = { health: 95, satisfaction: 5 };
    for (let i=0;i<50;i++) tickEmployeeWellbeing(emp, 5, { healthFlat:45, satisfactionFlat:-50, teamMult:0, recoveryCapacity:0 }, 1, true);
    expect(emp.health).toBeGreaterThanOrEqual(0); expect(emp.health).toBeLessThanOrEqual(100);
    expect(emp.satisfaction).toBeGreaterThanOrEqual(0); expect(emp.satisfaction).toBeLessThanOrEqual(100);
  });
  it('Überlastung (mehr Mitarbeiter als Erholungskapazität) senkt den Gesundheits-Zielwert', () => {
    const lowRecovery = { healthFlat: 20, satisfactionFlat: 10, teamMult: 0, recoveryCapacity: 0 };
    const empCrowded = { health: 50, satisfaction: 50 };
    tickEmployeeWellbeing(empCrowded, 5, lowRecovery, 20, false);
    const empAlone = { health: 50, satisfaction: 50 };
    tickEmployeeWellbeing(empAlone, 5, lowRecovery, 1, false);
    expect(empCrowded.health).toBeLessThan(empAlone.health);
  });
});

describe('Produktivitätsfaktoren — stetig und begrenzt', () => {
  it('healthFactor/satisfactionFactor liegen in den erwarteten Grenzen', () => {
    expect(healthFactor(0)).toBeCloseTo(0.5, 5);
    expect(healthFactor(100)).toBeCloseTo(1.1, 5);
    expect(satisfactionFactor(0)).toBeCloseTo(0.6, 5);
    expect(satisfactionFactor(100)).toBeCloseTo(1.1, 5);
  });
  it('employeeProductivity skaliert mit Klasse, Gesundheit und Zufriedenheit', () => {
    const agg = { teamMult: 0 };
    const healthy = { classId:'clerk', health:100, satisfaction:100 };
    const sick = { classId:'clerk', health:0, satisfaction:0 };
    expect(employeeProductivity(healthy, agg, 1)).toBeGreaterThan(employeeProductivity(sick, agg, 1));
  });
  it('Team-Multiplikator (z.B. Meetingraum) erhöht die Produktivität aller', () => {
    const emp = { classId:'clerk', health:70, satisfaction:70 };
    const without = employeeProductivity(emp, { teamMult: 0 }, 1);
    const withBonus = employeeProductivity(emp, { teamMult: 0.3 }, 1);
    expect(withBonus).toBeGreaterThan(without);
  });
  it('unbekannte Mitarbeiterklasse ergibt 0 statt eines Fehlers', () => {
    expect(employeeProductivity({ classId:'does-not-exist', health:50, satisfaction:50 }, { teamMult:0 }, 1)).toBe(0);
  });
});

describe('Katalog-Konsistenz', () => {
  it('jedes Upgrade mit "requires" verweist auf eine existierende Upgrade-ID', () => {
    Object.values(UPGRADES_BY_ID).forEach(u => {
      if (u.requires) expect(UPGRADES_BY_ID[u.requires]).toBeTruthy();
    });
  });
  it('alle Arbeitsplätze/Angebote haben positive Kosten und laufende Kosten', () => {
    Object.values(WORKSTATIONS_BY_ID).forEach(w => { expect(w.cost).toBeGreaterThan(0); expect(w.upkeep).toBeGreaterThanOrEqual(0); });
    Object.values(PERKS_BY_ID).forEach(p => { expect(p.cost).toBeGreaterThan(0); expect(p.maxCount).toBeGreaterThan(0); });
  });
  it('Mitarbeiterklassen sind nach Gehalt und Produktivität aufsteigend sortiert', () => {
    const classes = Object.values(EMPLOYEE_CLASSES_BY_ID);
    for (let i=1;i<classes.length;i++){
      expect(classes[i].wage).toBeGreaterThanOrEqual(classes[i-1].wage);
      expect(classes[i].productivity).toBeGreaterThanOrEqual(classes[i-1].productivity);
    }
  });
});
