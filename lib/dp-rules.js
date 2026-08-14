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

// ── WEIHNACHTSDIENST-ROTATION ─────────────────────────────────────────────────
// "01.01" gehört kalendarisch zum Folgejahr, wird aber unter dem Dezember-Jahr
// (year) geführt, damit "Weihnachten <Jahr>" ein zusammenhängender Block bleibt.
// Jeder Kalendertag wird zusätzlich nach Tag-/Nachtdienst getrennt betrachtet
// (eigene Score-Dimension je Datum+Schichtart) — day_key kombiniert daher
// Datum und Schichtart, z.B. "24.12-T" (Tag) / "24.12-N" (Nacht).
const CHRISTMAS_CALENDAR_DAYS = [
  {dateKey: '24.12', dateLabel: '24. Dezember (Heiliger Abend)', month: 12, day: 24, yearOffset: 0},
  {dateKey: '25.12', dateLabel: '25. Dezember (Christtag)',       month: 12, day: 25, yearOffset: 0},
  {dateKey: '26.12', dateLabel: '26. Dezember (Stefanitag)',      month: 12, day: 26, yearOffset: 0},
  {dateKey: '31.12', dateLabel: '31. Dezember (Silvester)',       month: 12, day: 31, yearOffset: 0},
  {dateKey: '01.01', dateLabel: '1. Jänner (Neujahr)',             month: 1,  day: 1,  yearOffset: 1},
];
const CHRISTMAS_SHIFT_KINDS = [
  {kind: 'day',   suffix: 'T', label: 'Tagdienst'},
  {kind: 'night', suffix: 'N', label: 'Nachtdienst'},
];
const CHRISTMAS_DAYS = CHRISTMAS_CALENDAR_DAYS.flatMap(d =>
  CHRISTMAS_SHIFT_KINDS.map(sk => ({
    key: `${d.dateKey}-${sk.suffix}`,
    label: `${d.dateLabel} – ${sk.label}`,
    dateKey: d.dateKey, month: d.month, day: d.day, yearOffset: d.yearOffset,
    shiftKind: sk.kind,
  }))
);
const CHRISTMAS_DAY_KEYS = CHRISTMAS_DAYS.map(d => d.key);

function christmasDateFor(year, dayKey) {
  const day = CHRISTMAS_DAYS.find(d => d.key === dayKey);
  if (!day) return null;
  const y = year + day.yearOffset;
  return `${y}-${String(day.month).padStart(2,'0')}-${String(day.day).padStart(2,'0')}`;
}

// Konfigurierbare Score-Gewichtung: Nachtdienst an 24.12. und 31.12. zählt
// stärker als alle anderen Tag/Nacht-Kombinationen (weiterhin ±1). Bewusst als
// benannte, zentrale Konstante statt verstreuter Magic Number — bei Bedarf hier
// (bzw. später über eine Einstellung) anpassbar.
const CHRISTMAS_SCORE_WEIGHT = 1.5;
const CHRISTMAS_WEIGHTED_DAY_KEYS = ['24.12-N', '31.12-N'];
function christmasScoreWeight(dayKey) {
  return CHRISTMAS_WEIGHTED_DAY_KEYS.includes(dayKey) ? CHRISTMAS_SCORE_WEIGHT : 1;
}

// Kumulativer Fairness-Score je Mitarbeiter × Tag/Schichtart-Kombination, über
// BELIEBIG viele Jahre (keine Beschränkung auf ein Lookback-Fenster):
//   A (gearbeitet)     → +1 × Gewichtung (erhöht die "Berechtigung", beim
//                         nächsten Mal bevorzugt frei zu bekommen)
//   U (Urlaub)         → −1 × Gewichtung (erhöht die "Pflicht", beim nächsten
//                         Mal eher zu arbeiten)
//   "–" (regulär frei) →  0, trägt nicht zum Score bei (kein aktiver
//                         Urlaubsverbrauch, daher neutral)
// Jahre ohne Eintrag tragen ebenfalls nichts bei — kein Sonderfall nötig.
// historyRows: [{employee_id,year,day_key,status}] — Jahres-Spalte wird für
// den Score selbst ignoriert, ist nur Anzeige-/Erfassungsdimension.
function computeChristmasScores(historyRows) {
  const scores = {}; // employeeId -> {dayKey: score}
  for (const h of historyRows) {
    if (!scores[h.employee_id]) scores[h.employee_id] = {};
    const base = h.status === 'A' ? 1 : h.status === 'U' ? -1 : 0;
    const delta = base * christmasScoreWeight(h.day_key);
    scores[h.employee_id][h.day_key] = (scores[h.employee_id][h.day_key] || 0) + delta;
  }
  return scores;
}

// Weiche Anti-Wiederholungsregel: Wer im UNMITTELBAR VORANGEGANGENEN Jahr an
// exakt diesem Tag/dieser Schichtart gearbeitet hat (A), soll heuer bevorzugt
// NICHT wieder für exakt diesen Slot vorgeschlagen werden. Score bestimmt
// weiterhin GRUNDSÄTZLICH, wer arbeiten muss (siehe buildChristmasProposal) —
// diese Funktion tauscht innerhalb der bereits feststehenden "Arbeit
// vorgeschlagen"-Gruppe nur die TAGESZUORDNUNG, ohne an einem Tag mehr oder
// weniger Personen einzuteilen (Kapazität bleibt exakt gleich, da jeder Tausch
// 1:1 erfolgt). Ist kein wiederholungsfreier Tausch möglich, bleibt die
// Wiederholung bestehen und wird als Warnung markiert statt hart blockiert.
//
// daysForKind: die 5 Tages-Objekte EINER Schichtart (bereits mit .employees[]
//   aus dem Score/Kapazitäts-Schritt). lastYearWorkedSet: Set aus
//   "employeeId|dayKey" (dayKey bereits mit Schichtart-Suffix), wer im Jahr
//   `year-1` an diesem exakten Slot gearbeitet hat. scoreOf(empId,dayKey):
//   liefert den (bereits gewichteten) Score für eine Employee/Tag-Kombination
//   — wird gebraucht, um nach einem Tausch den Score für den NEUEN Tag
//   anzuzeigen, nicht den des ursprünglichen.
function applyAntiRepeatSwaps(daysForKind, lastYearWorkedSet, scoreOf) {
  const workedLastYear = (empId, dayKey) => lastYearWorkedSet.has(`${empId}|${dayKey}`);

  // Arbeitskopie: pro Tag die Liste der "Arbeit vorgeschlagen"-MA mit Repeat-Flag
  const slots = daysForKind.map(d => ({
    dayKey: d.dayKey,
    workers: d.employees
      .filter(e => e.recommendation === 'work_suggested')
      .map(e => ({...e, repeatedLastYear: workedLastYear(e.id, d.dayKey), swapped: false, swappedToDayKey: null})),
  }));
  // Ursprüngliche (native) Besetzung je Tag, VOR jedem Tausch — wird als Schutz
  // gebraucht: ein MA, der an X's Tag ohnehin schon nativ vorgeschlagen ist,
  // taugt nicht als Tauschpartner (sein "Zuzug" wäre ein Nullsummen-Vorgang und
  // X's Abgang würde die Kapazität dieses Tages unbemerkt unterschreiten).
  const nativeIds = {};
  slots.forEach(s => { nativeIds[s.dayKey] = new Set(s.workers.map(w => w.id)); });

  // Greedy: für jeden Wiederholungsfall einen 1:1-Tauschpartner an einem
  // anderen Tag suchen, der für BEIDE Seiten echte (nicht bereits vorhandene)
  // Deckung bringt und die Wiederholung für beide auflöst.
  for (const slot of slots) {
    for (const worker of slot.workers) {
      if (!worker.repeatedLastYear || worker.swapped) continue;
      for (const other of slots) {
        if (other === slot) continue;
        const partner = other.workers.find(w =>
          !w.swapped &&
          !workedLastYear(w.id, slot.dayKey) &&      // Partner löst worker's Wiederholung
          !workedLastYear(worker.id, other.dayKey) && // worker löst partner's Slot ohne neue Wiederholung
          !nativeIds[slot.dayKey].has(w.id) &&        // Partner ist an worker's Tag nicht schon nativ dabei (echter Zuzug)
          !nativeIds[other.dayKey].has(worker.id)     // worker ist an partner's Tag nicht schon nativ dabei (echter Zuzug)
        );
        if (partner) {
          worker.swapped = true; worker.swappedToDayKey = other.dayKey;
          partner.swapped = true; partner.swappedToDayKey = slot.dayKey;
          break;
        }
      }
    }
  }

  // Je Zieltag: eigene, nicht weggetauschte MA + von anderen Tagen hereingetauschte.
  // Da ein MA an mehreren Tagen gleichzeitig unabhängig "Arbeit vorgeschlagen"
  // sein kann (jeder Tag wird ja einzeln bewertet), über eine Map nach
  // employeeId deduplizieren — ein hereingetauschter MA, der an diesem Tag
  // ohnehin schon nativ vorgeschlagen war, erzeugt so keine doppelte Zeile.
  return daysForKind.map(d => {
    const mySlot = slots.find(s => s.dayKey === d.dayKey);
    const finalMap = new Map();

    d.employees
      .filter(e => e.recommendation !== 'work_suggested')
      .forEach(e => finalMap.set(e.id, {...e, repeatedLastYear: false}));

    mySlot.workers.filter(w => !w.swapped).forEach(w => {
      finalMap.set(w.id, {id: w.id, name: w.name, score: w.score, wishedOff: w.wishedOff, recommendation: 'work_suggested', repeatedLastYear: w.repeatedLastYear});
    });

    for (const s of slots) {
      if (s.dayKey === d.dayKey) continue;
      for (const w of s.workers) {
        if (w.swapped && w.swappedToDayKey === d.dayKey && !finalMap.has(w.id)) {
          finalMap.set(w.id, {
            id: w.id, name: w.name, score: scoreOf(w.id, d.dayKey), wishedOff: w.wishedOff,
            recommendation: 'work_suggested', repeatedLastYear: false, swappedFromDayKey: s.dayKey,
          });
        }
      }
    }

    const employees = [...finalMap.values()].sort((a,b) => b.score - a.score || a.name.localeCompare(b.name,'de'));
    return {...d, employees};
  });
}

// Reine Vorschlags-Berechnung — keine DB, kein I/O, daher direkt testbar.
// employees: [{id,name}] — MUSS bereits auf Rotations-Teilnehmer gefiltert sein
//   (ausgenommene Mitarbeiter fließen weder in Score noch Kapazität noch
//   Vorschlag ein; sie werden separat im UI angezeigt, aber hier nicht übergeben).
// historyRows: [{employee_id,year,day_key,status}] (ALLE Jahre, auch von
//   ausgenommenen MA — deren Zeilen tauchen hier aber nicht in `employees` auf
//   und beeinflussen daher nichts).
// wishRows: [{employee_id,day_key,wants_off}] (nur aktuelles Jahr)
// shiftTypes: dp_shift_types-Zeilen (is_night unterscheidet Tag/Nacht)
// requirements: dp_shift_requirements-Zeilen
//
// Ablauf pro Tag/Schichtart:
//  1. Frei-Slots = Gesamt-MA − Schichtbedarf (nur Schichttypen der jeweiligen
//     Art). Von den MA mit Urlaubswunsch werden die mit dem HÖCHSTEN Score
//     (= hat in der Vergangenheit am meisten gearbeitet) bis zur Slot-Anzahl
//     als "Urlaub empfohlen" vorgeschlagen. Bei Score-Gleichstand entscheidet
//     alphabetisch der Name (transparent, nachvollziehbar — echtes Dienstalter
//     bräuchte ein bislang nicht vorhandenes "Mitarbeiter seit"-Feld). Alle
//     übrigen MA gelten als "Arbeit vorgeschlagen" (Schritt 1, wie bisher).
//  2. Innerhalb der "Arbeit vorgeschlagen"-Gruppe: Tauschversuch, um exakte
//     Wiederholungen zum Vorjahr zu vermeiden, ohne die Kapazität an einem
//     Tag zu verändern (applyAntiRepeatSwaps, Schritt 2/3 der Priorität).
function buildChristmasProposal(year, {employees, shiftTypes, requirements, historyRows, wishRows}) {
  const scores = computeChristmasScores(historyRows);
  const scoreOf = (empId, dayKey) => scores[empId]?.[dayKey] ?? 0;
  const lastYearWorkedSet = new Set(
    (historyRows||[])
      .filter(h => h.year === year - 1 && h.status === 'A')
      .map(h => `${h.employee_id}|${h.day_key}`)
  );

  const days = CHRISTMAS_DAYS.map(day => {
    const date = christmasDateFor(year, day.key);
    const holidays = getAustrianHolidays(year + day.yearOffset);
    const weekday = new Date(date).getDay();
    const dayInfo = {date, weekday, isWeekend: weekday===0||weekday===6, isHoliday: !!holidays[date]};

    const relevantShiftTypes = shiftTypes.filter(st => !!st.is_night === (day.shiftKind === 'night'));
    const requiredCount = relevantShiftTypes.reduce(
      (sum, st) => sum + getRequiredCount(requirements, st.id, dayInfo), 0
    );
    const totalEmployees = employees.length;
    const freeSlots = Math.max(0, totalEmployees - requiredCount);

    const wishedOffIds = new Set(
      (wishRows||[]).filter(w => w.day_key===day.key && w.wants_off).map(w => w.employee_id)
    );

    // Wünschende nach Score ABSTEIGEND sortieren (höchster Score zuerst) —
    // die ersten `freeSlots` bekommen den Freistellungs-Vorschlag.
    const wishers = employees
      .filter(e => wishedOffIds.has(e.id))
      .map(e => ({...e, score: scoreOf(e.id, day.key)}))
      .sort((a,b) => b.score - a.score || a.name.localeCompare(b.name,'de'));
    const offRecommendedIds = new Set(wishers.slice(0, freeSlots).map(e => e.id));

    const employeeRows = employees
      .map(e => ({
        id: e.id, name: e.name,
        score: scoreOf(e.id, day.key),
        wishedOff: wishedOffIds.has(e.id),
        recommendation: offRecommendedIds.has(e.id) ? 'off_recommended' : 'work_suggested',
      }))
      .sort((a,b) => b.score - a.score || a.name.localeCompare(b.name,'de'));

    return {
      dayKey: day.key, label: day.label, dateKey: day.dateKey, shiftKind: day.shiftKind,
      date, weekday, isWeekend: dayInfo.isWeekend, isHoliday: dayInfo.isHoliday,
      requiredCount, totalEmployees, freeSlots,
      wishCount: wishers.length,
      offRecommendedCount: offRecommendedIds.size,
      employees: employeeRows,
    };
  });

  // Anti-Wiederholungs-Tausch separat je Schichtart (Tag tauscht nur mit Tag,
  // Nacht nur mit Nacht) über die jeweils 5 Kalendertage.
  const dayShiftDays = days.filter(d => d.shiftKind === 'day');
  const nightShiftDays = days.filter(d => d.shiftKind === 'night');
  const swappedDay = applyAntiRepeatSwaps(dayShiftDays, lastYearWorkedSet, scoreOf);
  const swappedNight = applyAntiRepeatSwaps(nightShiftDays, lastYearWorkedSet, scoreOf);
  const byKey = {};
  [...swappedDay, ...swappedNight].forEach(d => { byKey[d.dayKey] = d; });
  return CHRISTMAS_DAYS.map(d => byKey[d.key]);
}

// ── SCHICHTBEDARF (Requirements) ──────────────────────────────────────────────
// Ermittelt die benötigte Anzahl Mitarbeiter für einen Schichttyp an einem Tag.
// Priorität: konkretes Datum > täglich > Feiertag/Wochenende > Wochentag (spezifisch) > Wochentag (allgemein).
// dayInfo: {date:'YYYY-MM-DD', weekday, isWeekend, isHoliday}
function getRequiredCount(requirements, shiftTypeId, dayInfo) {
  const date = dayInfo.date;
  const validReqs = requirements.filter(r => {
    const from = toISODate(r.valid_from);
    const until = toISODate(r.valid_until);
    if (from && from > date) return false;
    if (until && until < date) return false;
    return true;
  });
  const specific = validReqs.find(r=>r.shift_type_id===shiftTypeId && r.applies_to==='date' && r.specific_date?.toString().slice(0,10)===date);
  if (specific) return specific.slot_count;
  const daily = validReqs.find(r=>r.shift_type_id===shiftTypeId && r.applies_to==='daily');
  if (daily) return daily.slot_count;
  if (dayInfo.isHoliday) {
    const hol = validReqs.find(r=>r.shift_type_id===shiftTypeId && r.applies_to==='holiday');
    return hol ? hol.slot_count : 0;
  }
  if (dayInfo.isWeekend) {
    const we = validReqs.find(r=>r.shift_type_id===shiftTypeId && r.applies_to==='weekend');
    return we ? we.slot_count : 0;
  }
  const wdReq = validReqs.find(r=>r.shift_type_id===shiftTypeId && r.applies_to==='weekday' && r.weekday===dayInfo.weekday);
  if (wdReq) return wdReq.slot_count;
  const general = validReqs.find(r=>r.shift_type_id===shiftTypeId && r.applies_to==='weekday' && r.weekday===null);
  return general ? general.slot_count : 0;
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

// ── POST-GENERATION REBALANCING ───────────────────────────────────────────────
// Versuche nach der Generierung Dienste zwischen MA zu verschieben um Überstunden
// fair auszugleichen und MA mit Deficit zu bevorzugen
async function rebalanceOvertimeAssignments(
  assignments, empState, empParamMap, empQualMap, shiftTypes,
  AT_HOLIDAYS, plan, absenceSet
) {
  let improved = true;
  let iteration = 0;
  const maxIterations = 8;

  // Harte-Regeln-Prüfung für einen potenziellen Empfänger eines zu
  // verschiebenden Dienstes. Nutzt den ECHTEN checkRestPeriod (AZG §12)
  // statt der früheren "beide Dienste ≥10h"-Heuristik.
  const canReceive = (recipId, assignToMove) => {
    const recipQuals = empQualMap[recipId];
    if (!recipQuals?.has(assignToMove.shift_type_id)) return false;

    const dateStr = toISODate(assignToMove.date);

    // 1. Keine Abwesenheit an dem Tag
    if (absenceSet.has(`${recipId}_${dateStr}`)) return false;

    const recipAssignments = (empState[recipId]?.assignments || []).filter(a => a.id !== assignToMove.id);

    // 2. Keine andere Schicht an dem Tag
    if (recipAssignments.some(a => toISODate(a.date) === dateStr && a.shift_type_id && !a.absence_type_id)) return false;

    // 3. Wochenlimit
    const wk = getISOWeek(dateStr);
    const weeklyHours = recipAssignments
      .filter(a => getISOWeek(toISODate(a.date)) === wk && !a.absence_type_id)
      .reduce((sum, a) => sum + (parseFloat(a.hours_credited) || 0), 0);
    if (weeklyHours + (parseFloat(assignToMove.hours_credited) || 0) > MAX_WEEKLY_HOURS) return false;

    // 4. Echte 11h-Ruhezeitprüfung (AZG §12)
    const st = shiftTypes.find(s => s.id === assignToMove.shift_type_id);
    if (!st) return false;
    if (!checkRestPeriod(recipAssignments, {date: dateStr, shiftType: st}, shiftTypes)) return false;

    // 5. Nachtdienst-Ruheregeln (Folgetag frei, Doppelnacht etc.)
    if (checkNightHardRules({
      assignments: recipAssignments, slotDate: dateStr,
      slotIsNight: !!st.is_night,
      hasAbsenceOn: d => absenceSet.has(`${recipId}_${d}`),
    })) return false;

    // 6. Nachtdienst-Berechtigung
    if (st.is_night && !empParamMap[recipId]?.can_do_nights) return false;

    return true;
  };

  const moveAssignment = (assignToMove, fromId, toId) => {
    const idx = assignments.indexOf(assignToMove);
    if (idx === -1) return false;
    assignments[idx].employee_id = toId;
    empState[fromId].assignments = empState[fromId].assignments.filter(a => a.id !== assignToMove.id);
    empState[toId].assignments.push(assignToMove);
    return true;
  };

  while (improved && iteration < maxIterations) {
    improved = false;
    iteration++;

    // Saldo pro MA aus den AKTUELLEN Assignments (relativ zum individuellen Soll)
    const stats = {};
    for (const [empId, state] of Object.entries(empState)) {
      const totalHours = state.assignments
        .filter(a => !a.absence_type_id)
        .reduce((sum, a) => sum + (parseFloat(a.hours_credited) || 0), 0);
      const target = state.monthlyTarget;
      stats[empId] = {
        target,
        totalHours,
        ot: Math.max(0, totalHours - target),
        deficit: Math.max(0, target - totalHours),
        rel: target > 0 ? (totalHours - target) / target : 0, // relativer Saldo (§11: Teilzeit-fair)
      };
    }

    let donorIds = [];
    let recipientIds = [];

    const empIdsWithOT = Object.keys(stats).filter(id => stats[id].ot > 0);
    if (empIdsWithOT.length > 0) {
      // ── Phase A: klassischer OT-Ausgleich ──
      // Jeder MA mit Überstunden ist Spender, solange es Empfänger mit Deficit
      // gibt. Der Move-Guard unten (donorRelAfter >= Empfänger-Saldo) verhindert
      // Überschießen; eine avgOT-Schwelle würde den Fall "genau 1 MA mit OT"
      // fälschlich blockieren.
      donorIds = empIdsWithOT.filter(id => stats[id].ot > FAIRNESS_OT_TOLERANCE_H
        || Object.keys(stats).some(r => r !== id && stats[r].deficit > 2));
      recipientIds = Object.keys(stats).filter(id => stats[id].deficit > 2);
    } else {
      // ── Phase B (§11 Fall A): niemand über Soll — reine Minusstunden-Ungleichheit
      // relativ zum individuellen Soll angleichen. MA mit dem relativ kleinsten
      // Minus gibt ab, MA mit dem relativ größten Minus bekommt.
      const ids = Object.keys(stats).filter(id => stats[id].target > 0 && empState[id]);
      if (ids.length >= 2) {
        const maxRel = Math.max(...ids.map(id => stats[id].rel));
        const minRel = Math.min(...ids.map(id => stats[id].rel));
        // Angleichen, solange die relative Spreizung > 5 Prozentpunkte liegt
        if (maxRel - minRel > 0.05) {
          donorIds = ids.filter(id => stats[id].rel > minRel + (maxRel - minRel) / 2 && stats[id].totalHours > 0);
          recipientIds = ids.filter(id => stats[id].rel < maxRel - (maxRel - minRel) / 2);
        }
      }
    }

    if (donorIds.length === 0 || recipientIds.length === 0) break;

    // Spender mit dem höchsten relativen Saldo zuerst
    donorIds.sort((a, b) => stats[b].rel - stats[a].rel);

    outer:
    for (const donorId of donorIds) {
      const donorAssignments = assignments.filter(a =>
        a.employee_id === donorId && a.shift_type_id && !a.absence_type_id && !a.is_locked && a.source !== 'manual'
      );
      // Kleine Dienste zuerst — feinere Angleichung, leichter zu platzieren
      donorAssignments.sort((a, b) => (parseFloat(a.hours_credited) || 0) - (parseFloat(b.hours_credited) || 0));

      for (const assignToMove of donorAssignments) {
        const eligible = recipientIds.filter(rid => rid !== donorId && canReceive(rid, assignToMove));
        if (eligible.length === 0) continue;
        // Empfänger mit dem NIEDRIGSTEN relativen Saldo (am tiefsten im Minus) zuerst
        const bestRecipId = eligible.reduce((best, cur) => stats[cur].rel < stats[best].rel ? cur : best);
        // Verschieben darf die Ungleichheit nicht umkehren:
        // Nach dem Move muss der Spender-Saldo noch >= Empfänger-Saldo (vorher) bleiben
        const h = parseFloat(assignToMove.hours_credited) || 0;
        const donorRelAfter = stats[donorId].target > 0 ? (stats[donorId].totalHours - h - stats[donorId].target) / stats[donorId].target : 0;
        if (donorRelAfter < stats[bestRecipId].rel) continue;
        if (moveAssignment(assignToMove, donorId, bestRecipId)) {
          improved = true;
          break outer;
        }
      }
    }
  }

  return assignments;
}

// ── WEEKEND REBALANCING ───────────────────────────────────────────────────────
function rebalanceWeekendAssignments(newAssignments, empParams, empParamMap, shiftTypes, plan, absenceSet) {
  const daysInMonth = new Date(plan.year, plan.month, 0).getDate();
  const AT_HOLIDAYS = getAustrianHolidays(plan.year);

  for (let iter = 0; iter < 3; iter++) {
    // Calculate free weekends per employee
    const freeWE = {};
    for (const p of empParams) {
      const empId = p.employee_id;
      freeWE[empId] = 0;
      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(plan.year, plan.month-1, d);
        if (date.getDay() !== 6) continue;
        const satStr = date.toISOString().slice(0,10);
        const sun = new Date(plan.year, plan.month-1, d+1);
        const sunStr = sun.toISOString().slice(0,10);
        const satWork = newAssignments.some(a=>a.employee_id===empId&&a.date===satStr&&a.shift_type_id&&!a.absence_type_id);
        const sunWork = newAssignments.some(a=>a.employee_id===empId&&a.date===sunStr&&a.shift_type_id&&!a.absence_type_id);
        if (!satWork && !sunWork) freeWE[empId]++;
      }
    }
    const maxFree = Math.max(...Object.values(freeWE));
    const minFree = Math.min(...Object.values(freeWE));
    if (maxFree - minFree < 2) break;

    const richEmp = Object.keys(freeWE).find(id => freeWE[id] === maxFree);
    const poorEmp = Object.keys(freeWE).find(id => freeWE[id] === minFree);
    if (!richEmp || !poorEmp) break;

    let moved = false;

    for (const a of newAssignments.filter(a=>a.employee_id===poorEmp&&a.shift_type_id&&!a.absence_type_id)) {
      const wd = new Date(a.date).getDay();
      if (wd !== 0 && wd !== 6) continue; // only weekends
      if (absenceSet.has(`${richEmp}_${a.date}`)) continue;
      if (newAssignments.some(a2=>a2.employee_id===richEmp&&a2.date===a.date&&a2.shift_type_id)) continue;
      const st = shiftTypes.find(x=>x.id===a.shift_type_id);
      if (!st) continue;
      // Check weekly hours
      const wk = getISOWeek(a.date);
      const richWeekH = newAssignments.filter(a2=>a2.employee_id===richEmp&&getISOWeek(a2.date)===wk&&a2.shift_type_id&&!a2.absence_type_id).reduce((s,a2)=>s+parseFloat(a2.hours_credited||0),0);
      if (richWeekH + parseFloat(st.duration_hours||0) > MAX_WEEKLY_HOURS) continue;
      if (!checkRestPeriod(newAssignments.filter(a2=>a2.employee_id===richEmp), {date:a.date,shiftType:st}, shiftTypes)) continue;
      // Move: reassign from poorEmp to richEmp
      a.employee_id = richEmp;
      moved = true;
      break;
    }
    if (!moved) break;
  }
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
  // Schichtbedarf
  getRequiredCount,
  // Weihnachtsdienst-Rotation
  CHRISTMAS_DAYS, CHRISTMAS_DAY_KEYS, christmasDateFor, computeChristmasScores, buildChristmasProposal,
  CHRISTMAS_SCORE_WEIGHT, CHRISTMAS_WEIGHTED_DAY_KEYS, christmasScoreWeight, applyAntiRepeatSwaps,
  // Harte Regeln
  checkRestPeriod, getConsecutiveDays, getConsecutiveNights, checkNightHardRules,
  // Weiche Regeln
  checkNightGapSoft,
  // Fairness §11
  fairnessStats, clusterRatio, localDensity,
  // Post-Generation-Rebalancing
  rebalanceOvertimeAssignments, rebalanceWeekendAssignments,
};
