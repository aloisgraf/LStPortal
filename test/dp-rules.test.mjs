import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const R = require('../lib/dp-rules');

// ── Test-Helfer ───────────────────────────────────────────────────────────────
const DAY   = { id: 'st-day',   is_night: false, start_time: '08:00', end_time: '20:00', duration_hours: 12 };
const NIGHT = { id: 'st-night', is_night: true,  start_time: '19:00', end_time: '07:00', duration_hours: 12 };
const SHIFT_TYPES = [DAY, NIGHT];

const shift = (date, st = DAY) => ({
  date, shift_type_id: st.id, absence_type_id: null, shiftType: st, hours_credited: st.duration_hours,
});
const absence = date => ({ date, shift_type_id: null, absence_type_id: 'at-u', shiftType: null });

// ─────────────────────────────────────────────────────────────────────────────
describe('toISODate (pg-Date-Object-Bugklasse)', () => {
  it('konvertiert JS-Date-Objekte korrekt (nicht "Wed Jul 08")', () => {
    expect(R.toISODate(new Date('2026-07-08T00:00:00Z'))).toBe('2026-07-08');
  });
  it('lässt ISO-Strings unverändert und kürzt Timestamps', () => {
    expect(R.toISODate('2026-07-08')).toBe('2026-07-08');
    expect(R.toISODate('2026-07-08T10:00:00Z')).toBe('2026-07-08');
  });
  it('null/undefined → null', () => {
    expect(R.toISODate(null)).toBeNull();
    expect(R.toISODate(undefined)).toBeNull();
  });
});

describe('Harte Regel: 11h-Ruhezeit (AZG §12) — checkRestPeriod', () => {
  it('blockt zweiten Dienst am selben Tag (Doppelbelegung)', () => {
    expect(R.checkRestPeriod([shift('2026-06-10')], {date: '2026-06-10', shiftType: DAY}, SHIFT_TYPES)).toBe(false);
  });
  it('blockt Folgedienst mit nur 11h-Unterschreitung: Ende 20:00 → Start 06:00 (10h)', () => {
    const early = { ...DAY, start_time: '06:00', end_time: '18:00' };
    expect(R.checkRestPeriod([shift('2026-06-10')], {date: '2026-06-11', shiftType: early}, SHIFT_TYPES)).toBe(false);
  });
  it('erlaubt Folgedienst mit genau 12h Ruhe: Ende 20:00 → Start 08:00', () => {
    expect(R.checkRestPeriod([shift('2026-06-10')], {date: '2026-06-11', shiftType: DAY}, SHIFT_TYPES)).toBe(true);
  });
  it('blockt Tagdienst direkt nach Nachtdienst (Nacht endet 07:00, Tag startet 08:00 → 1h)', () => {
    expect(R.checkRestPeriod([shift('2026-06-10', NIGHT)], {date: '2026-06-11', shiftType: DAY}, SHIFT_TYPES)).toBe(false);
  });
  it('prüft auch rückwärts: Slot VOR bestehendem Dienst mit zu wenig Abstand', () => {
    const early = { ...DAY, start_time: '06:00', end_time: '18:00' };
    // Slot 10.06. endet 20:00, bestehender Dienst 11.06. startet 06:00 → 10h < 11h
    expect(R.checkRestPeriod([{...shift('2026-06-11'), shiftType: early, shift_type_id: early.id}],
      {date: '2026-06-10', shiftType: DAY}, SHIFT_TYPES)).toBe(false);
  });
  it('ignoriert Abwesenheiten bei der Ruhezeitprüfung', () => {
    expect(R.checkRestPeriod([absence('2026-06-10')], {date: '2026-06-11', shiftType: DAY}, SHIFT_TYPES)).toBe(true);
  });
});

describe('Harte Regel: Nachtdienst-Ruhe — checkNightHardRules', () => {
  const call = (assignments, slotDate, slotIsNight, absDates = []) =>
    R.checkNightHardRules({
      assignments, slotDate, slotIsNight,
      hasAbsenceOn: d => absDates.includes(d),
    });

  it('blockt Nicht-Nacht-Dienst am Tag nach einem Nachtdienst', () => {
    expect(call([shift('2026-06-05', NIGHT)], '2026-06-06', false)).toBe('rest_after_night_required');
  });
  it('blockt Tag+2 nach Doppelnacht (02.+03. Nacht → 05. gesperrt)', () => {
    const a = [shift('2026-06-02', NIGHT), shift('2026-06-03', NIGHT)];
    expect(call(a, '2026-06-04', false)).toBe('rest_after_night_required');
    expect(call(a, '2026-06-05', false)).toBe('rest_after_double_night_required');
  });
  it('erlaubt Tag+3 nach Doppelnacht (Beispiel aus Spez: 06.06. wieder frei)', () => {
    const a = [shift('2026-06-02', NIGHT), shift('2026-06-03', NIGHT)];
    expect(call(a, '2026-06-06', false)).toBeNull();
  });
  it('nach Einzelnacht ist Tag+2 wieder erlaubt', () => {
    expect(call([shift('2026-06-05', NIGHT)], '2026-06-07', false)).toBeNull();
  });
  it('blockt Nacht-Slot, wenn am Folgetag eine Abwesenheit eingetragen ist', () => {
    expect(call([], '2026-06-05', true, ['2026-06-06'])).toBe('night_before_absence_or_shift');
  });
  it('blockt Nacht-Slot, wenn am Folgetag ein Nicht-Nacht-Dienst liegt', () => {
    expect(call([shift('2026-06-06', DAY)], '2026-06-05', true)).toBe('night_before_absence_or_shift');
  });
  it('erlaubt Nacht-Slot vor weiterer Nacht (Doppelnacht-Konstellation)', () => {
    expect(call([shift('2026-06-06', NIGHT)], '2026-06-05', true)).toBeNull();
  });
});

describe('Weiche Regel: Nachtdienst-Abstände — checkNightGapSoft', () => {
  it('keine früheren Nächte → kein Verstoß', () => {
    expect(R.checkNightGapSoft([], '2026-06-10')).toBeNull();
  });
  it('Einzelnacht: unter 5 Tagen blockiert, ab 5 Tagen erlaubt', () => {
    const a = [shift('2026-06-01', NIGHT)];
    expect(R.checkNightGapSoft(a, '2026-06-05')).toBe('night_distance_min5days'); // 4 Tage
    expect(R.checkNightGapSoft(a, '2026-06-06')).toBeNull();                      // 5 Tage
  });
  it('Doppelnacht-Block: unter 10 Tagen blockiert, ab 10 Tagen erlaubt', () => {
    const a = [shift('2026-06-02', NIGHT), shift('2026-06-03', NIGHT)];
    expect(R.checkNightGapSoft(a, '2026-06-12')).toBe('double_night_block_distance_10days'); // 9 Tage nach Blockende
    expect(R.checkNightGapSoft(a, '2026-06-13')).toBeNull();                                  // 10 Tage
  });
  it('zwei Einzelnächte mit Abstand zählen NICHT als Doppelblock', () => {
    const a = [shift('2026-06-01', NIGHT), shift('2026-06-07', NIGHT)];
    // letzte Nacht 07.06., Vorgängerin 6 Tage davor → Einzelnacht-Regel (5 Tage)
    expect(R.checkNightGapSoft(a, '2026-06-12')).toBeNull();
  });
});

describe('Aufeinanderfolgende Tage/Nächte', () => {
  it('getConsecutiveDays zählt Arbeitstage bis exklusive Zieldatum', () => {
    const a = [shift('2026-06-01'), shift('2026-06-02'), shift('2026-06-03')];
    expect(R.getConsecutiveDays(a, '2026-06-04')).toBe(3);
    expect(R.getConsecutiveDays(a, '2026-06-06')).toBe(0); // Lücke am 04./05.
  });
  it('getConsecutiveDays ignoriert Abwesenheiten', () => {
    const a = [shift('2026-06-01'), absence('2026-06-02'), shift('2026-06-03')];
    expect(R.getConsecutiveDays(a, '2026-06-04')).toBe(1);
  });
  it('getConsecutiveNights zählt nur Nachtdienste', () => {
    const a = [shift('2026-06-01', NIGHT), shift('2026-06-02', NIGHT), shift('2026-06-03', DAY)];
    expect(R.getConsecutiveNights(a, '2026-06-03')).toBe(2);
    expect(R.getConsecutiveNights(a, '2026-06-04')).toBe(0); // 03. war Tagdienst
  });
});

describe('Österreichische Feiertage', () => {
  const H26 = R.getAustrianHolidays(2026);
  it('fixe Feiertage 2026', () => {
    expect(H26['2026-01-01']).toBe('Neujahr');
    expect(H26['2026-10-26']).toBe('Nationalfeiertag');
    expect(H26['2026-12-25']).toBe('Christtag');
  });
  it('bewegliche Feiertage 2026 (Ostern = 05.04.2026)', () => {
    expect(H26['2026-04-03']).toBe('Karfreitag');
    expect(H26['2026-04-06']).toBe('Ostermontag');
    expect(H26['2026-05-14']).toBe('Christi Himmelfahrt');
    expect(H26['2026-05-25']).toBe('Pfingstmontag');
    expect(H26['2026-06-04']).toBe('Fronleichnam');
  });
  it('getWorkDaysInMonth zählt Mo–Fr ohne Feiertage', () => {
    // Juni 2026: 30 Tage, 22 Werktage Mo–Fr, minus Fronleichnam (Do 04.06.) = 21
    expect(R.getWorkDaysInMonth(2026, 6, H26)).toBe(21);
  });
});

describe('ISO-Kalenderwochen', () => {
  it('Jahresgrenzen korrekt', () => {
    expect(R.getISOWeek('2026-01-01')).toBe('2026-W01'); // Donnerstag
    expect(R.getISOWeek('2027-01-01')).toBe('2026-W53'); // Freitag → KW53 des Vorjahres
  });
  it('Wochenwechsel Montag', () => {
    expect(R.getISOWeek('2026-06-07')).toBe('2026-W23'); // Sonntag
    expect(R.getISOWeek('2026-06-08')).toBe('2026-W24'); // Montag
  });
});

describe('Schichtzeiten', () => {
  it('normale Schicht: Ende nach Start', () => {
    expect(R.getShiftStartHour(DAY)).toBe(8);
    expect(R.getShiftEndHour(DAY)).toBe(20);
  });
  it('Übernacht-Schicht: Ende +24h', () => {
    expect(R.getShiftStartHour(NIGHT)).toBe(19);
    expect(R.getShiftEndHour(NIGHT)).toBe(31); // 07:00 Folgetag
  });
});

describe('Fairness §11 — Statistik & Verteilung', () => {
  it('fairnessStats: Streuung über Salden', () => {
    const s = R.fairnessStats({a: -10, b: 0, c: 10});
    expect(s.mean).toBe(0);
    expect(s.min).toBe(-10);
    expect(s.max).toBe(10);
    expect(s.spread).toBe(20);
    expect(s.stddev).toBeCloseTo(8.16, 1);
  });
  it('fairnessStats: leeres Team', () => {
    expect(R.fairnessStats({})).toEqual({mean: 0, stddev: 0, min: 0, max: 0, spread: 0});
  });
  it('clusterRatio: alles in erster Monatshälfte → 1.0', () => {
    expect(R.clusterRatio(['2026-06-01','2026-06-03','2026-06-05','2026-06-10'], 2026, 6)).toBe(1);
  });
  it('clusterRatio: gleichverteilt → 0.5', () => {
    expect(R.clusterRatio(['2026-06-05','2026-06-10','2026-06-20','2026-06-25'], 2026, 6)).toBe(0.5);
  });
  it('clusterRatio: < 2 Dienste → neutral 0.5', () => {
    expect(R.clusterRatio(['2026-06-05'], 2026, 6)).toBe(0.5);
    expect(R.clusterRatio([], 2026, 6)).toBe(0.5);
  });
  it('localDensity: zählt eigene Dienste im ±3-Tage-Fenster (ohne Slot-Tag selbst)', () => {
    const a = [shift('2026-06-08'), shift('2026-06-09'), shift('2026-06-14'), absence('2026-06-11')];
    expect(R.localDensity(a, '2026-06-10')).toBe(2); // 08. + 09., Abwesenheit zählt nicht, 14. außerhalb
    expect(R.localDensity(a, '2026-06-20')).toBe(0);
  });
});

describe('Zentrale Konstanten (AZG)', () => {
  it('gesetzliche Grenzwerte unverändert', () => {
    expect(R.MAX_WEEKLY_HOURS).toBe(48);
    expect(R.MIN_REST_HOURS).toBe(11);
    expect(R.MAX_CONSECUTIVE_DAYS).toBe(6);
    expect(R.SINGLE_NIGHT_MIN_GAP_DAYS).toBe(5);
    expect(R.DOUBLE_NIGHT_MIN_GAP_DAYS).toBe(10);
  });
});
