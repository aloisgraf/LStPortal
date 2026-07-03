'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// DP-REGEL-ENGINE — reine Funktionen, keine DB, kein Express.
// Wird von routes/dp.js verwendet und von test/dp-rules.test.js getestet.
//
// Konvention: Assignment-Objekte tragen `date` als ISO-String YYYY-MM-DD,
// `shift_type_id`, `absence_type_id` und optional `shiftType` (Objekt mit
// is_night, start_time, end_time, duration_hours).
// ─────────────────────────────────────────────────────────────────────────────

// ── ZENTRALE PLANUNGS-KONSTANTEN ──────────────────────────────────────────────
const MAX_WEEKLY_HOURS = 48;             // AZG §9
const MIN_REST_HOURS = 11;               // AZG §12
const MAX_CONSECUTIVE_DAYS = 6;          // AZG §12 (weich, +1 im Ausnahmefall)
const DEFAULT_MAX_NIGHTS_PER_MONTH = 6;
const SINGLE_NIGHT_MIN_GAP_DAYS = 5;     // weich: Abstand nach Einzelnacht
const DOUBLE_NIGHT_MIN_GAP_DAYS = 10;    // weich: Abstand nach Doppelnacht-Block
const FAIRNESS_OT_TOLERANCE_H = 3;       // Rebalancing: tolerierte OT-Differenz
const FAIRNESS_SALDO_SPREAD_WARN_H = 10; // Post-Check: Max-Min-Saldo-Warnschwelle
const FAIRNESS_CLUSTER_WARN_RATIO = 0.6; // Post-Check: max. Anteil in einer Monatshälfte

// ── DATUMS-HELFER ─────────────────────────────────────────────────────────────

// pg liefert DATE-Spalten als JS-Date-Objekte; String(dateObj) wäre "Wed Jul 08".
// Diese Funktion ist der EINZIGE Konvertierungspfad im Modul.
const toISODate = d => !d ? null : (d instanceof Date ? d.toISOString().slice(0,10) : String(d).slice(0,10));

const addDaysISO = (dateStr, days) => {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0,10);
};

const diffDays = (a, b) => Math.round((new Date(a) - new Date(b)) / 86400000);

// ── FEIERTAGE (Österreich) ────────────────────────────────────────────────────

function getEasterDate(year) {
  const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),month=Math.floor((h+l-7*m+114)/31),day=((h+l-7*m+114)%31)+1;
  return new Date(year,month-1,day);
}

function getAustrianHolidays(year) {
  const holidays = {
    [`${year}-01-01`]: 'Neujahr',
    [`${year}-01-06`]: 'Heilige Drei Könige',
    [`${year}-05-01`]: 'Staatsfeiertag',
    [`${year}-08-15`]: 'Mariä Himmelfahrt',
    [`${year}-10-26`]: 'Nationalfeiertag',
    [`${year}-11-01`]: 'Allerheiligen',
    [`${year}-12-08`]: 'Mariä Empfängnis',
    [`${year}-12-25`]: 'Christtag',
    [`${year}-12-26`]: 'Stefanitag',
  };
  const easter = getEasterDate(year);
  const addDays = (date, days) => { const d = new Date(date); d.setDate(d.getDate()+days); return d.toISOString().slice(0,10); };
  holidays[addDays(easter, -2)] = 'Karfreitag';
  holidays[addDays(easter, 1)]  = 'Ostermontag';
  holidays[addDays(easter, 39)] = 'Christi Himmelfahrt';
  holidays[addDays(easter, 50)] = 'Pfingstmontag'; // Ostern+50 (Ostern+49 wäre Pfingstsonntag)
  holidays[addDays(easter, 60)] = 'Fronleichnam';
  return holidays;
}

function getWorkDaysInMonth(year, month, holidays) {
  const days = new Date(year, month, 0).getDate();
  let count = 0;
  for (let d = 1; d <= days; d++) {
    const date = new Date(year, month-1, d);
    const dateStr = date.toISOString().slice(0,10);
    const wd = date.getDay();
    if (wd !== 0 && wd !== 6 && !holidays[dateStr]) count++;
  }
  return count;
}

// ── KALENDERWOCHEN ────────────────────────────────────────────────────────────

// Returns ISO week string YYYY-Www for a date string
function getISOWeek(dateStr) {
  const d = new Date(dateStr);
  const day = d.getDay()||7;
  d.setDate(d.getDate() + 4 - day);
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNo).padStart(2,'0')}`;
}

// Returns the Monday of the ISO week as a Date object
function getISOWeekStart(isoWeekStr, year) {
  const weekNum = parseInt(isoWeekStr.split('-W')[1]);
  const jan4 = new Date(year, 0, 4);
  const jan4Day = jan4.getDay() || 7;
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - jan4Day + 1 + (weekNum - 1) * 7);
  return monday;
}

// ── SCHICHTZEITEN ─────────────────────────────────────────────────────────────

function getShiftStartHour(st) {
  const [h, m] = (st.start_time||'08:00').split(':').map(Number);
  return h + m/60;
}

// Dezimalstunde des Schichtendes (Übernacht: end < start → +24)
function getShiftEndHour(st) {
  const [sh, sm] = (st.start_time||'08:00').split(':').map(Number);
  const [eh, em] = (st.end_time||'20:00').split(':').map(Number);
  const startH = sh + sm/60;
  let endH = eh + em/60;
  if (endH <= startH) endH += 24;
  return endH;
}

// ── HARTE REGEL: 11h-RUHEZEIT (AZG §12) ───────────────────────────────────────

function checkRestPeriod(assignments, slot, shiftTypes) {
  const slotStartH = getShiftStartHour(slot.shiftType);
  const slotEndH   = getShiftEndHour(slot.shiftType);

  for (const a of assignments) {
    if (!a.date || a.absence_type_id || !a.shift_type_id) continue;
    const prevSt = a.shiftType || shiftTypes.find(s=>s.id===a.shift_type_id);
    if (!prevSt) continue;

    const dd = (new Date(slot.date) - new Date(a.date)) / 86400000;
    if (Math.abs(dd) > 2) continue; // weit genug auseinander

    if (dd === 0) return false; // gleicher Tag → Doppelbelegung

    const prevStartH = getShiftStartHour(prevSt);
    const prevEndH   = getShiftEndHour(prevSt);

    if (dd > 0) {
      // Bestehender Dienst liegt VOR dem Slot
      const prevEndAbs = prevEndH;
      const slotStartAbs = slotStartH + dd * 24;
      if (slotStartAbs - prevEndAbs < MIN_REST_HOURS) return false;
    } else {
      // Bestehender Dienst liegt NACH dem Slot
      const slotEndAbs = slotEndH;
      const prevStartAbs = prevStartH + Math.abs(dd) * 24;
      if (prevStartAbs - slotEndAbs < MIN_REST_HOURS) return false;
    }
  }
  return true;
}

// ── AUFEINANDERFOLGENDE TAGE / NÄCHTE ─────────────────────────────────────────

// Aufeinanderfolgende Arbeitstage bis (exklusive) targetDate
function getConsecutiveDays(assignments, targetDate) {
  const worked = new Set(assignments
    .filter(a=>!a.absence_type_id && a.shift_type_id)
    .map(a=>a.date)
  );
  let count = 0;
  let d = new Date(targetDate);
  d.setDate(d.getDate() - 1);
  while (worked.has(d.toISOString().slice(0,10))) {
    count++;
    d.setDate(d.getDate() - 1);
    if (count > 7) break;
  }
  return count;
}

// Aufeinanderfolgende Nachtdienste bis (exklusive) targetDate
function getConsecutiveNights(assignments, targetDate) {
  const nights = new Set(assignments
    .filter(a=>!a.absence_type_id && a.shift_type_id && a.shiftType && a.shiftType.is_night)
    .map(a=>a.date)
  );
  let count = 0;
  let d = new Date(targetDate);
  d.setDate(d.getDate() - 1);
  while (nights.has(d.toISOString().slice(0,10))) {
    count++;
    d.setDate(d.getDate() - 1);
    if (count > 30) break;
  }
  return count;
}

// ── HARTE NACHTDIENST-REGELN ──────────────────────────────────────────────────
// Regelblock aus dem Generator, als reine Funktion:
//  · Nicht-Nacht-Slot nach Nachtdienst am Vortag → 'rest_after_night_required'
//  · Nicht-Nacht-Slot am Tag+2 nach Doppelnacht  → 'rest_after_double_night_required'
//  · Nacht-Slot vor Abwesenheit/Nicht-Nacht-Dienst am Folgetag
//                                                → 'night_before_absence_or_shift'
// Rückgabe: Grund-String oder null (= keine Verletzung).
function checkNightHardRules({assignments, slotDate, slotIsNight, hasAbsenceOn}) {
  const isNightOn = ds => assignments.some(a =>
    a.date === ds && !a.absence_type_id && a.shiftType?.is_night
  );

  if (!slotIsNight) {
    // Nach Nachtdienst: Folgetag zwingend frei
    if (isNightOn(addDaysISO(slotDate, -1))) return 'rest_after_night_required';
    // Nach Doppelnacht: 2 Tage frei (Tag+2 nach Blockende ebenfalls gesperrt)
    if (isNightOn(addDaysISO(slotDate, -2)) && isNightOn(addDaysISO(slotDate, -3)))
      return 'rest_after_double_night_required';
    return null;
  }

  // Nacht-Slot: Folgetag darf weder Abwesenheit noch Nicht-Nacht-Dienst haben
  const nextDateStr = addDaysISO(slotDate, 1);
  if (hasAbsenceOn && hasAbsenceOn(nextDateStr)) return 'night_before_absence_or_shift';
  const nextNonNight = assignments.some(a =>
    a.date === nextDateStr && a.shift_type_id && !a.absence_type_id && !a.shiftType?.is_night
  );
  if (nextNonNight) return 'night_before_absence_or_shift';
  return null;
}

// ── WEICHE NACHTDIENST-ABSTÄNDE ───────────────────────────────────────────────
// Einzelnacht → nächste Nacht min. SINGLE_NIGHT_MIN_GAP_DAYS später.
// Doppelnacht-Block → nächste Nacht min. DOUBLE_NIGHT_MIN_GAP_DAYS später.
// Rückgabe: Grund-String oder null.
function checkNightGapSoft(assignments, slotDate) {
  const prevNights = assignments
    .filter(a => !a.absence_type_id && a.shiftType?.is_night && a.date < slotDate)
    .map(a => a.date)
    .sort();
  if (prevNights.length === 0) return null;

  const lastNight = prevNights[prevNights.length - 1];
  const daysSinceLast = diffDays(slotDate, lastNight);
  const secondLastNight = prevNights.length >= 2 ? prevNights[prevNights.length - 2] : null;
  const wasDoubleBlock = secondLastNight && diffDays(lastNight, secondLastNight) === 1;
  const minDays = wasDoubleBlock ? DOUBLE_NIGHT_MIN_GAP_DAYS : SINGLE_NIGHT_MIN_GAP_DAYS;

  if (daysSinceLast < minDays)
    return wasDoubleBlock ? 'double_night_block_distance_10days' : 'night_distance_min5days';
  return null;
}

// ── FAIRNESS (§11) — SALDO-STATISTIK & VERTEILUNG ─────────────────────────────

// Saldo = Ist − Soll (negativ = Minusstunden). Reine Statistik über alle MA.
function fairnessStats(saldos) {
  const vals = Object.values(saldos);
  if (vals.length === 0) return {mean: 0, stddev: 0, min: 0, max: 0, spread: 0};
  const mean = vals.reduce((s,v)=>s+v,0) / vals.length;
  const variance = vals.reduce((s,v)=>s+(v-mean)*(v-mean),0) / vals.length;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  return {
    mean: Math.round(mean*100)/100,
    stddev: Math.round(Math.sqrt(variance)*100)/100,
    min: Math.round(min*100)/100,
    max: Math.round(max*100)/100,
    spread: Math.round((max-min)*100)/100,
  };
}

// Cluster-Metrik: Anteil der Dienste in der stärker belegten Monatshälfte.
// 0.5 = perfekt gleichverteilt, 1.0 = alles in einer Hälfte.
// Bei < 2 Diensten nicht aussagekräftig → 0.5.
function clusterRatio(dates, year, month) {
  if (dates.length < 2) return 0.5;
  const daysInMonth = new Date(year, month, 0).getDate();
  const half = Math.ceil(daysInMonth / 2);
  let firstHalf = 0;
  for (const d of dates) {
    if (parseInt(d.slice(8)) <= half) firstHalf++;
  }
  const ratio = firstHalf / dates.length;
  return Math.max(ratio, 1 - ratio);
}

// Zeitliche-Lücken-Score für das Kandidaten-Scoring: bestraft Bewerber, deren
// bisherige Dienste im Plan bereits dicht am Slot-Datum clustern.
// Rückgabe: Anzahl eigener Dienste im ±windowDays-Fenster um slotDate.
function localDensity(assignments, slotDate, windowDays = 3) {
  let n = 0;
  for (const a of assignments) {
    if (a.absence_type_id || !a.shift_type_id) continue;
    const dd = Math.abs(diffDays(a.date, slotDate));
    if (dd > 0 && dd <= windowDays) n++;
  }
  return n;
}

module.exports = {
  // Konstanten
  MAX_WEEKLY_HOURS, MIN_REST_HOURS, MAX_CONSECUTIVE_DAYS,
  DEFAULT_MAX_NIGHTS_PER_MONTH, SINGLE_NIGHT_MIN_GAP_DAYS, DOUBLE_NIGHT_MIN_GAP_DAYS,
  FAIRNESS_OT_TOLERANCE_H, FAIRNESS_SALDO_SPREAD_WARN_H, FAIRNESS_CLUSTER_WARN_RATIO,
  // Datum
  toISODate, addDaysISO, diffDays,
  // Feiertage / Kalender
  getEasterDate, getAustrianHolidays, getWorkDaysInMonth, getISOWeek, getISOWeekStart,
  // Schichtzeiten
  getShiftStartHour, getShiftEndHour,
  // Harte Regeln
  checkRestPeriod, getConsecutiveDays, getConsecutiveNights, checkNightHardRules,
  // Weiche Regeln
  checkNightGapSoft,
  // Fairness §11
  fairnessStats, clusterRatio, localDensity,
};
