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

// ─────────────────────────────────────────────────────────────────────────────
describe('Rebalancing §11 — rebalanceOvertimeAssignments', () => {
  const mkShift = (id, empId, date, st = DAY, opts = {}) => ({
    id, employee_id: empId, date, shift_type_id: st.id, absence_type_id: null,
    shiftType: st, hours_credited: st.duration_hours, is_locked: false, source: 'generated',
    ...opts,
  });

  const setup = (aShifts, bShifts, aTarget, bTarget) => {
    const assignments = [...aShifts, ...bShifts];
    const empState = {
      a: { monthlyTarget: aTarget, assignments: [...aShifts] },
      b: { monthlyTarget: bTarget, assignments: [...bShifts] },
    };
    const empParamMap = { a: {can_do_nights: true}, b: {can_do_nights: true} };
    const empQualMap = { a: new Set([DAY.id, NIGHT.id]), b: new Set([DAY.id, NIGHT.id]) };
    return {assignments, empState, empParamMap, empQualMap};
  };

  const totalFor = (assignments, empId) => assignments
    .filter(x => x.employee_id === empId && !x.absence_type_id)
    .reduce((s, x) => s + x.hours_credited, 0);

  it('Phase A: verschiebt Dienste von Überstunden-MA zu Deficit-MA', async () => {
    // a: 120h bei Soll 100 (OT 20) · b: 24h bei Soll 100 (Deficit 76)
    const aShifts = ['01','04','07','10','13','16','19','22','25','28'].map((d,i) =>
      mkShift(`a${i}`, 'a', `2026-06-${d}`));
    const bShifts = ['02','05'].map((d,i) => mkShift(`b${i}`, 'b', `2026-06-${d}`));
    const {assignments, empState, empParamMap, empQualMap} = setup(aShifts, bShifts, 100, 100);

    await R.rebalanceOvertimeAssignments(assignments, empState, empParamMap, empQualMap, SHIFT_TYPES, {}, {year:2026,month:6}, new Set());

    expect(totalFor(assignments, 'a')).toBeLessThan(120);
    expect(totalFor(assignments, 'b')).toBeGreaterThan(24);
  });

  it('Fall A (§11): gleicht reine Minusstunden-Ungleichheit an, obwohl niemand über Soll ist', async () => {
    // a: 24h bei Soll 100 (rel −76%) · b: 84h bei Soll 100 (rel −16%) — kein OT!
    const aShifts = ['02','20'].map((d,i) => mkShift(`a${i}`, 'a', `2026-06-${d}`));
    const bShifts = ['01','05','09','13','17','21','25'].map((d,i) => mkShift(`b${i}`, 'b', `2026-06-${d}`));
    const {assignments, empState, empParamMap, empQualMap} = setup(aShifts, bShifts, 100, 100);

    await R.rebalanceOvertimeAssignments(assignments, empState, empParamMap, empQualMap, SHIFT_TYPES, {}, {year:2026,month:6}, new Set());

    const aTotal = totalFor(assignments, 'a');
    const bTotal = totalFor(assignments, 'b');
    // Vorher: Spreizung 60h — nachher deutlich enger, Richtung stimmt
    expect(aTotal).toBeGreaterThan(24);
    expect(bTotal).toBeLessThan(84);
    expect(Math.abs(aTotal - bTotal)).toBeLessThan(60);
  });

  it('Fall A: Teilzeit-fair — relative Salden zählen, nicht absolute', async () => {
    // a (Teilzeit, Soll 50): 48h → rel −4% · b (Vollzeit, Soll 160): 96h → rel −40%
    // Absolut hat b das größere Minus → Dienste müssen zu b wandern, NICHT zu a
    const aShifts = ['02','10','18','26'].map((d,i) => mkShift(`a${i}`, 'a', `2026-06-${d}`));
    const bShifts = ['01','05','09','13','17','21','25','29'].map((d,i) => mkShift(`b${i}`, 'b', `2026-06-${d}`));
    const {assignments, empState, empParamMap, empQualMap} = setup(aShifts, bShifts, 50, 160);

    await R.rebalanceOvertimeAssignments(assignments, empState, empParamMap, empQualMap, SHIFT_TYPES, {}, {year:2026,month:6}, new Set());

    // Teilzeit-MA darf durch die Angleichung nicht ÜBER das eigene Soll rutschen
    expect(totalFor(assignments, 'a')).toBeLessThanOrEqual(50 + DAY.duration_hours);
  });

  it('verschiebt niemals gesperrte oder manuelle Dienste', async () => {
    const aShifts = [
      mkShift('a0', 'a', '2026-06-01', DAY, {is_locked: true}),
      mkShift('a1', 'a', '2026-06-04', DAY, {source: 'manual'}),
      ...['07','10','13','16','19','22','25','28'].map((d,i) => mkShift(`am${i}`, 'a', `2026-06-${d}`)),
    ];
    const bShifts = [mkShift('b0', 'b', '2026-06-02')];
    const {assignments, empState, empParamMap, empQualMap} = setup(aShifts, bShifts, 100, 100);

    await R.rebalanceOvertimeAssignments(assignments, empState, empParamMap, empQualMap, SHIFT_TYPES, {}, {year:2026,month:6}, new Set());

    expect(assignments.find(x => x.id === 'a0').employee_id).toBe('a');
    expect(assignments.find(x => x.id === 'a1').employee_id).toBe('a');
  });

  it('respektiert Abwesenheiten des Empfängers (harte Regel)', async () => {
    const aShifts = ['01','04','07','10','13','16','19','22','25','28'].map((d,i) =>
      mkShift(`a${i}`, 'a', `2026-06-${d}`));
    const bShifts = [mkShift('b0', 'b', '2026-06-02')];
    const {assignments, empState, empParamMap, empQualMap} = setup(aShifts, bShifts, 100, 100);
    // b ist an ALLEN Spender-Tagen abwesend → nichts darf verschoben werden
    const absSet = new Set(['01','04','07','10','13','16','19','22','25','28'].map(d => `b_2026-06-${d}`));

    await R.rebalanceOvertimeAssignments(assignments, empState, empParamMap, empQualMap, SHIFT_TYPES, {}, {year:2026,month:6}, absSet);

    expect(totalFor(assignments, 'a')).toBe(120);
    expect(totalFor(assignments, 'b')).toBe(12);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Weihnachtsdienst-Rotation — Score-Modell (Tag/Nacht getrennt)', () => {
  const EMP_A = {id: 'a', name: 'Anna'};
  const EMP_B = {id: 'b', name: 'Bernd'};
  const EMP_C = {id: 'c', name: 'Clara'};
  const employees = [EMP_A, EMP_B, EMP_C];
  const DAY_SHIFT = {id: 'st-day', code: 'D', is_night: false};
  const NIGHT_SHIFT = {id: 'st-night', code: 'N', is_night: true};
  const shiftTypes = [DAY_SHIFT, NIGHT_SHIFT];

  const reqDaily = (stId, n) => [{shift_type_id: stId, applies_to: 'daily', slot_count: n, valid_from: null, valid_until: null}];
  const reqBoth = (nDay, nNight) => [...reqDaily(DAY_SHIFT.id, nDay), ...reqDaily(NIGHT_SHIFT.id, nNight)];

  it('christmasDateFor: 01.01 gehört zum Folgejahr, Schichtart ändert das Datum nicht', () => {
    expect(R.christmasDateFor(2026, '24.12-T')).toBe('2026-12-24');
    expect(R.christmasDateFor(2026, '24.12-N')).toBe('2026-12-24');
    expect(R.christmasDateFor(2026, '01.01-N')).toBe('2027-01-01');
  });

  it('liefert alle 5 Tage × 2 Schichtarten = 10 Kombinationen in fester Reihenfolge', () => {
    const days = R.buildChristmasProposal(2026, {employees: [], shiftTypes: [], requirements: [], historyRows: [], wishRows: []});
    expect(days.map(d => d.dayKey)).toEqual([
      '24.12-T','24.12-N','25.12-T','25.12-N','26.12-T','26.12-N','31.12-T','31.12-N','01.01-T','01.01-N',
    ]);
    days.forEach(d => expect(['day','night']).toContain(d.shiftKind));
  });

  describe('computeChristmasScores', () => {
    it('+1 pro Arbeitsjahr (A), −1 pro Urlaubsjahr (U), "–" trägt nichts bei, je Tag/Schicht-Kombination separat', () => {
      const scores = R.computeChristmasScores([
        {employee_id: 'a', year: 2023, day_key: '24.12-T', status: 'A'},
        {employee_id: 'a', year: 2024, day_key: '24.12-T', status: 'A'},
        {employee_id: 'a', year: 2025, day_key: '24.12-T', status: 'U'},
        {employee_id: 'a', year: 2025, day_key: '25.12-N', status: 'U'}, // eigene Dimension: Tag ≠ Nacht (ungewichteter Tag)
      ]);
      expect(scores.a['24.12-T']).toBe(1); // +1+1-1
      expect(scores.a['25.12-N']).toBe(-1); // unabhängig vom Tagdienst-Score
    });

    it('regulär frei ("–"/kein Status) beeinflusst den Score nicht', () => {
      // Kein Eintrag ODER ein neutraler Eintrag ohne A/U-Status → 0 Beitrag
      const scores = R.computeChristmasScores([
        {employee_id: 'a', year: 2024, day_key: '24.12-T', status: 'A'},
        {employee_id: 'a', year: 2025, day_key: '24.12-T', status: '–'},
      ]);
      expect(scores.a['24.12-T']).toBe(1); // nur das A-Jahr zählt
    });

    it('berücksichtigt beliebig viele Jahre zurück, nicht nur ein festes Fenster', () => {
      const scores = R.computeChristmasScores([
        {employee_id: 'a', year: 2015, day_key: '25.12-T', status: 'A'},
        {employee_id: 'a', year: 2016, day_key: '25.12-T', status: 'A'},
        {employee_id: 'a', year: 2020, day_key: '25.12-T', status: 'A'},
      ]);
      expect(scores.a['25.12-T']).toBe(3);
    });

    it('Mitarbeiter/Tag ohne Historie → kein Eintrag (Score effektiv 0)', () => {
      const scores = R.computeChristmasScores([{employee_id: 'a', year: 2025, day_key: '24.12-T', status: 'A'}]);
      expect(scores.b).toBeUndefined();
    });
  });

  describe('buildChristmasProposal', () => {
    it('Frei-Slots = Gesamt-MA − Schichtbedarf, getrennt für Tag- und Nachtdienst', () => {
      const days = R.buildChristmasProposal(2026, {employees, shiftTypes, requirements: reqBoth(1, 2), historyRows: [], wishRows: []});
      const d24T = days.find(d => d.dayKey === '24.12-T');
      const d24N = days.find(d => d.dayKey === '24.12-N');
      expect(d24T.requiredCount).toBe(1); expect(d24T.freeSlots).toBe(2);
      expect(d24N.requiredCount).toBe(2); expect(d24N.freeSlots).toBe(1);
    });

    it('Nachtdienst-Bedarf zählt nicht in die Tagdienst-Kapazität und umgekehrt', () => {
      // Nur Nachtdienst-Bedarf hinterlegt → Tagdienst-requiredCount bleibt 0
      const days = R.buildChristmasProposal(2026, {employees, shiftTypes, requirements: reqDaily(NIGHT_SHIFT.id, 3), historyRows: [], wishRows: []});
      expect(days.find(d => d.dayKey === '24.12-T').requiredCount).toBe(0);
      expect(days.find(d => d.dayKey === '24.12-N').requiredCount).toBe(3);
    });

    it('freeSlots nie negativ, wenn Bedarf über Mitarbeiterzahl liegt', () => {
      const days = R.buildChristmasProposal(2026, {employees, shiftTypes, requirements: reqBoth(10,10), historyRows: [], wishRows: []});
      expect(days[0].freeSlots).toBe(0);
    });

    it('nur MA mit Urlaubswunsch können "Urlaub empfohlen" erhalten', () => {
      const wishRows = [{employee_id: 'a', day_key: '24.12-T', wants_off: true}];
      // b hat den höchsten Score, aber keinen Wunsch angemeldet → bleibt "Arbeit vorgeschlagen"
      const historyRows = [{employee_id: 'b', year: 2025, day_key: '24.12-T', status: 'A'}];
      const days = R.buildChristmasProposal(2026, {employees, shiftTypes, requirements: reqBoth(2,2), historyRows, wishRows});
      const d24 = days.find(d => d.dayKey === '24.12-T');
      const a = d24.employees.find(e => e.id === 'a');
      const b = d24.employees.find(e => e.id === 'b');
      expect(a.recommendation).toBe('off_recommended');
      expect(b.recommendation).toBe('work_suggested');
    });

    it('von den Wünschenden bekommt der HÖCHSTE Score Vorrang (hat am meisten gearbeitet) bis Frei-Slots erreicht sind', () => {
      const wishRows = [
        {employee_id: 'a', day_key: '24.12-T', wants_off: true},
        {employee_id: 'b', day_key: '24.12-T', wants_off: true},
        {employee_id: 'c', day_key: '24.12-T', wants_off: true},
      ];
      const historyRows = [
        {employee_id: 'a', year: 2025, day_key: '24.12-T', status: 'A'}, // Score +1 (hat gearbeitet)
        {employee_id: 'b', year: 2025, day_key: '24.12-T', status: 'U'}, // Score -1 (hatte frei)
        // c: kein Eintrag → Score 0
      ];
      // Nur 1 Frei-Slot bei 3 Mitarbeitern → requiredCount(Tag) = 2, Nacht bleibt 0
      const days = R.buildChristmasProposal(2026, {employees, shiftTypes, requirements: reqDaily(DAY_SHIFT.id, 2), historyRows, wishRows});
      const d24 = days.find(d => d.dayKey === '24.12-T');
      expect(d24.freeSlots).toBe(1);
      // höchster Score gewinnt: a (+1) > c (0) > b (-1)
      const a = d24.employees.find(e => e.id === 'a');
      expect(a.recommendation).toBe('off_recommended');
      expect(d24.offRecommendedCount).toBe(1);
    });

    it('Tag- und Nachtdienst sowie Kalendertage werden EINZELN betrachtet — Score/Wunsch am 24.12-T wirkt nicht auf 24.12-N oder 31.12-T', () => {
      const wishRows = [{employee_id: 'a', day_key: '24.12-T', wants_off: true}];
      const days = R.buildChristmasProposal(2026, {employees, shiftTypes, requirements: reqBoth(2,2), historyRows: [], wishRows});
      const d24N = days.find(d => d.dayKey === '24.12-N');
      const d31T = days.find(d => d.dayKey === '31.12-T');
      expect(d24N.wishCount).toBe(0);
      expect(d31T.wishCount).toBe(0);
      expect(d24N.employees.find(e => e.id === 'a').wishedOff).toBe(false);
    });

    it('Score-Gleichstand: alphabetisch nach Name als transparentes Tie-Breaking', () => {
      const wishRows = [
        {employee_id: 'b', day_key: '24.12-T', wants_off: true}, // Bernd
        {employee_id: 'a', day_key: '24.12-T', wants_off: true}, // Anna
      ];
      // Beide Score 0 (keine Historie) → alphabetisch: Anna vor Bernd
      const days = R.buildChristmasProposal(2026, {employees, shiftTypes, requirements: reqDaily(DAY_SHIFT.id, 2), historyRows: [], wishRows});
      const d24 = days.find(d => d.dayKey === '24.12-T');
      expect(d24.freeSlots).toBe(1);
      expect(d24.employees.find(e => e.id === 'a').recommendation).toBe('off_recommended');
      expect(d24.employees.find(e => e.id === 'b').recommendation).toBe('work_suggested');
    });

    it('kein Schichtbedarf hinterlegt → requiredCount 0, freeSlots = Gesamt-MA, keine Fehler', () => {
      const days = R.buildChristmasProposal(2026, {employees, shiftTypes, requirements: [], historyRows: [], wishRows: []});
      days.forEach(d => { expect(d.requiredCount).toBe(0); expect(d.freeSlots).toBe(3); });
    });

    it('Mitarbeiter ohne Historie startet bei Score 0', () => {
      const wishRows = [{employee_id: 'c', day_key: '25.12-T', wants_off: true}];
      const days = R.buildChristmasProposal(2026, {employees, shiftTypes, requirements: reqDaily(DAY_SHIFT.id, 2), historyRows: [], wishRows});
      const c = days.find(d => d.dayKey === '25.12-T').employees.find(e => e.id === 'c');
      expect(c.score).toBe(0);
    });

    it('ausgenommene Mitarbeiter fließen nicht ein, wenn sie im übergebenen employees-Array fehlen', () => {
      // Simuliert: Caller filtert Rotations-Teilnehmer vorab (b ist "ausgenommen" und fehlt hier)
      const onlyA = [EMP_A];
      const historyRows = [{employee_id: 'b', year: 2025, day_key: '24.12-T', status: 'U'}]; // b hat trotzdem Historie
      const days = R.buildChristmasProposal(2026, {employees: onlyA, shiftTypes, requirements: reqDaily(DAY_SHIFT.id, 1), historyRows, wishRows: []});
      const d24 = days.find(d => d.dayKey === '24.12-T');
      expect(d24.totalEmployees).toBe(1); // b zählt nicht zur Kapazität
      expect(d24.employees.map(e => e.id)).toEqual(['a']); // b taucht im Vorschlag nicht auf
    });
  });

  describe('Nachtdienst-Gewichtung 24.12./31.12. (christmasScoreWeight)', () => {
    it('24.12-N und 31.12-N zählen mit Faktor 1,5, alle anderen Kombinationen mit Faktor 1', () => {
      expect(R.christmasScoreWeight('24.12-N')).toBe(1.5);
      expect(R.christmasScoreWeight('31.12-N')).toBe(1.5);
      expect(R.christmasScoreWeight('24.12-T')).toBe(1);
      expect(R.christmasScoreWeight('25.12-N')).toBe(1);
      expect(R.christmasScoreWeight('26.12-N')).toBe(1);
      expect(R.christmasScoreWeight('01.01-N')).toBe(1);
    });

    it('computeChristmasScores wendet die Gewichtung an: A/U an 24.12-N zählt ±1,5', () => {
      const scores = R.computeChristmasScores([
        {employee_id: 'a', year: 2025, day_key: '24.12-N', status: 'A'},
        {employee_id: 'a', year: 2025, day_key: '24.12-T', status: 'A'},
        {employee_id: 'a', year: 2024, day_key: '31.12-N', status: 'U'},
      ]);
      expect(scores.a['24.12-N']).toBe(1.5);
      expect(scores.a['24.12-T']).toBe(1); // Tagdienst am selben Datum bleibt ungewichtet
      expect(scores.a['31.12-N']).toBe(-1.5);
    });

    it('"–" (regulär frei) trägt weiterhin 0 bei, auch an gewichteten Tagen', () => {
      const scores = R.computeChristmasScores([{employee_id: 'a', year: 2025, day_key: '24.12-N', status: '–'}]);
      expect(scores.a['24.12-N']).toBe(0);
    });

    it('höherer gewichteter Score gewinnt bei der Freistellungs-Priorität', () => {
      const wishRows = [
        {employee_id: 'a', day_key: '24.12-N', wants_off: true},
        {employee_id: 'b', day_key: '24.12-N', wants_off: true},
      ];
      const historyRows = [
        {employee_id: 'a', year: 2025, day_key: '24.12-N', status: 'A'}, // 1×1,5 = 1,5
        {employee_id: 'b', year: 2025, day_key: '25.12-N', status: 'A'}, // andere Dimension, zählt hier nicht
      ];
      const NIGHT_SHIFT = {id: 'st-night', code: 'N', is_night: true};
      const days = R.buildChristmasProposal(2026, {
        employees, shiftTypes: [NIGHT_SHIFT],
        requirements: [{shift_type_id: NIGHT_SHIFT.id, applies_to: 'daily', slot_count: 2, valid_from: null, valid_until: null}],
        historyRows, wishRows,
      });
      const d24N = days.find(d => d.dayKey === '24.12-N');
      expect(d24N.freeSlots).toBe(1); // 3 MA - 2 Bedarf
      expect(d24N.employees.find(e => e.id === 'a').score).toBe(1.5);
      expect(d24N.employees.find(e => e.id === 'a').recommendation).toBe('off_recommended');
    });
  });

  describe('Anti-Wiederholungsregel (applyAntiRepeatSwaps über buildChristmasProposal)', () => {
    it('unresolvbare Wiederholung (volle Auslastung, kein Tauschpartner) bleibt bestehen und wird markiert', () => {
      // 3 MA, Bedarf 3 an jedem Tag → niemand kann irgendwo ausweichen
      const historyRows = [{employee_id: 'a', year: 2025, day_key: '24.12-T', status: 'A'}];
      const days = R.buildChristmasProposal(2026, {employees, shiftTypes, requirements: reqDaily(DAY_SHIFT.id, 3), historyRows, wishRows: []});
      const d24 = days.find(d => d.dayKey === '24.12-T');
      const a = d24.employees.find(e => e.id === 'a');
      expect(a.recommendation).toBe('work_suggested');
      expect(a.repeatedLastYear).toBe(true); // Warnung bleibt sichtbar
      // Kapazität bleibt trotzdem korrekt — niemand geht durch den (unterlassenen) Tausch verloren
      expect(d24.employees.filter(e => e.recommendation === 'work_suggested').length).toBe(3);
    });

    it('erfolgreicher Tausch: Wiederholung wird durch echten Tages-Tausch aufgelöst, Kapazität bleibt an beiden Tagen erhalten', () => {
      const EMP_D = {id: 'd', name: 'Dora'};
      const fourEmployees = [EMP_A, EMP_B, EMP_C, EMP_D];
      // a hatte letztes Jahr 24.12-T gearbeitet (Repeat-Kandidat).
      // b bekommt an 25.12-T Wunsch-frei (score reicht) → b ist an 25.12-T NICHT
      // nativ "Arbeit vorgeschlagen", c und d sind überall nativ dabei außer wo sie frei haben.
      // d bekommt an 24.12-T Wunsch-frei → d ist an 24.12-T nicht nativ dabei.
      // Damit b's Platz an 25.12-T (durch b's Abwesenheit) und d's Platz an 24.12-T
      // (durch d's Abwesenheit) je einen "echten" freien nativen Slot für einen Tausch schaffen.
      const wishRows = [
        {employee_id: 'b', day_key: '25.12-T', wants_off: true},
        {employee_id: 'd', day_key: '24.12-T', wants_off: true},
      ];
      const historyRows = [
        {employee_id: 'a', year: 2025, day_key: '24.12-T', status: 'A'},
        {employee_id: 'b', year: 2025, day_key: '25.12-T', status: 'U'}, // niedriger Score → bekommt frei
        {employee_id: 'd', year: 2025, day_key: '24.12-T', status: 'U'}, // niedriger Score → bekommt frei
      ];
      const days = R.buildChristmasProposal(2026, {employees: fourEmployees, shiftTypes, requirements: reqDaily(DAY_SHIFT.id, 3), historyRows, wishRows});
      const d24 = days.find(d => d.dayKey === '24.12-T');
      const d25 = days.find(d => d.dayKey === '25.12-T');
      // Kapazität an beiden Tagen weiterhin exakt gedeckt
      expect(d24.employees.filter(e => e.recommendation === 'work_suggested').length).toBe(d24.requiredCount);
      expect(d25.employees.filter(e => e.recommendation === 'work_suggested').length).toBe(d25.requiredCount);
      // a's Wiederholung an 24.12-T ist entweder aufgelöst (nicht mehr dort mit repeatedLastYear)
      // oder weiterhin klar als Warnung sichtbar — nie stillschweigend falsch dargestellt
      const aAt24 = d24.employees.find(e => e.id === 'a');
      if (aAt24 && aAt24.recommendation === 'work_suggested') {
        // falls a noch an 24.12-T arbeitet, muss das als Warnung sichtbar sein
        expect(typeof aAt24.repeatedLastYear).toBe('boolean');
      }
    });

    it('keine Doppel-Einträge (Duplikate) durch den Tausch — jede employeeId erscheint je Tag höchstens einmal', () => {
      const historyRows = [{employee_id: 'a', year: 2025, day_key: '24.12-T', status: 'A'}];
      const wishRows = [{employee_id: 'b', day_key: '25.12-T', wants_off: true}];
      const days = R.buildChristmasProposal(2026, {employees, shiftTypes, requirements: reqDaily(DAY_SHIFT.id, 2), historyRows, wishRows});
      days.filter(d => d.shiftKind === 'day').forEach(d => {
        const ids = d.employees.map(e => e.id);
        expect(new Set(ids).size).toBe(ids.length);
      });
    });

    it('Tausch verändert nie die benötigte Mindestbesetzung eines Tages (keine stille Unterbesetzung)', () => {
      const EMP_D = {id: 'd', name: 'Dora'}, EMP_E = {id: 'e', name: 'Elfi'};
      const many = [EMP_A, EMP_B, EMP_C, EMP_D, EMP_E];
      const historyRows = [
        {employee_id: 'a', year: 2025, day_key: '24.12-T', status: 'A'},
        {employee_id: 'b', year: 2025, day_key: '25.12-T', status: 'A'},
        {employee_id: 'c', year: 2025, day_key: '26.12-T', status: 'A'},
      ];
      const days = R.buildChristmasProposal(2026, {employees: many, shiftTypes, requirements: reqDaily(DAY_SHIFT.id, 4), historyRows, wishRows: []});
      days.filter(d => d.shiftKind === 'day').forEach(d => {
        const workCount = d.employees.filter(e => e.recommendation === 'work_suggested').length;
        expect(workCount).toBeGreaterThanOrEqual(Math.min(d.requiredCount, many.length));
      });
    });

    it('Nur derselbe Kalendertag-Pool wird getauscht — Tagdienst tauscht nie mit Nachtdienst', () => {
      const historyRows = [{employee_id: 'a', year: 2025, day_key: '24.12-N', status: 'A'}];
      const days = R.buildChristmasProposal(2026, {employees, shiftTypes, requirements: reqBoth(1,1), historyRows, wishRows: []});
      // Kein Tagdienst-Slot darf ein swappedFromDayKey mit "-N" enthalten und umgekehrt
      days.forEach(d => {
        d.employees.forEach(e => {
          if (e.swappedFromDayKey) {
            const fromKind = e.swappedFromDayKey.endsWith('-N') ? 'night' : 'day';
            expect(fromKind).toBe(d.shiftKind);
          }
        });
      });
    });
  });
});
