'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// WEIHNACHTSDIENST-ROTATION — Score-Modell
//
// Reine Vorschlags-Funktion (lib/dp-rules.js: buildChristmasProposal): liefert
// für die fünf Weihnachts-/Neujahrs-Tage einen fairness-basierten Score je
// Mitarbeiter (+1 pro Jahr Tag-/Nachtdienst gearbeitet — Nachtdienst an 24.12./
// 31.12. mit Faktor 1,5 —, −1 pro Jahr Urlaub, EINE Dimension je Kalendertag,
// über beliebig viele erfasste Jahre) und darauf aufbauend einen Vorschlag:
// Freiwillige (Wunsch TD/ND) decken den Schichtbedarf zuerst, fehlende Plätze
// werden score-basiert (niedrigster Score zuerst) aufgefüllt, der Rest mit
// Wunsch U erhält "Urlaub empfohlen" nach höchstem Score. Schreibt NIE in
// dp_plans/dp_assignments — nur Lesevorschlag, keine automatische Übernahme.
//
// Mitarbeiter- und Schichtbedarfs-Daten werden aus den bestehenden DP-Tabellen
// referenziert (dp_employee_params, dp_shift_types, dp_shift_requirements) —
// keine Datenduplikate. Neu sind nur die Historieneinträge (eine Spalte je
// Kalendertag, Zellwert TD/ND/UR/–) und die Urlaubswünsche fürs aktuelle Jahr
// (eine Spalte je Kalendertag, Wert U/TD/ND).
// ─────────────────────────────────────────────────────────────────────────────
const router = require('express').Router();
const { q, q1, newId, pool } = require('../db');
const { auth, ok, bad } = require('../middleware');
const { CHRISTMAS_CALENDAR_DAY_KEYS, buildChristmasProposal, computeChristmasScores } = require('../lib/dp-rules');
const { isUserActive } = require('../db');

// Liefert ALLE Mitarbeiter mit DP-Parametern inkl. Rotations-Teilnahme-Flag
// (xmasParticipant) und abgeleitetem Aktiv-Status (isActive, aus Ein-/Austritts-
// datum — siehe db.isUserActive). Weder ausgenommene (xmasParticipant=false)
// noch inaktive Mitarbeiter werden hier herausgefiltert — das erledigt der
// jeweilige Aufrufer, je nachdem ob er die volle Liste (Matrix-Anzeige, ausgegraut)
// oder nur aktive Teilnehmer (Score/Vorschlag/Kapazität) braucht.
async function getEmployees() {
  const [empParams, users] = await Promise.all([
    q(`SELECT DISTINCT ON (employee_id) employee_id, xmas_rotation_participant
       FROM dp_employee_params ORDER BY employee_id, valid_from DESC NULLS LAST`),
    q('SELECT id,name,hire_date,termination_date FROM users'),
  ]);
  const userMap = {};
  for (const u of users) userMap[u.id] = u;
  return empParams
    .map(e => {
      const u = userMap[e.employee_id];
      return {
        id: e.employee_id,
        name: u ? u.name : null,
        xmasParticipant: e.xmas_rotation_participant !== false,
        isActive: u ? isUserActive(u) : false,
        // Für die "gesperrte Zellen"-Darstellung im Matrix-UI (Zellen außerhalb
        // des Dienstverhältnisses) — rohe Daten, Ableitung liegt beim Frontend.
        hireDate: u?.hire_date ? new Date(u.hire_date).toISOString().slice(0,10) : null,
        terminationDate: u?.termination_date ? new Date(u.termination_date).toISOString().slice(0,10) : null,
      };
    })
    .filter(e => e.name) // nur (noch) existierende Mitarbeiter
    .sort((a,b) => a.name.localeCompare(b.name,'de'));
}

// ── HISTORIE (manuelle Erfassung U/A, beliebig viele Jahre) ──────────────────

router.get('/christmas/history', auth, async (req,res) => {
  try {
    const years = (req.query.years||'').split(',').map(y=>parseInt(y)).filter(Boolean);
    if (!years.length) return ok(res, []);
    const rows = await q(
      'SELECT employee_id,year,day_key,status FROM dp_christmas_history WHERE year=ANY($1::int[])',
      [years]
    );
    ok(res, rows);
  } catch(e) { bad(res,'Serverfehler',500); }
});

router.put('/christmas/history', auth, async (req,res) => {
  if (!req.p.manageUsers) return bad(res,'Keine Berechtigung',403);
  try {
    const {employeeId, year, dayKey, status} = req.body;
    if (!employeeId || !year || !CHRISTMAS_CALENDAR_DAY_KEYS.includes(dayKey))
      return bad(res,'employeeId, year und dayKey erforderlich (z.B. 24.12/31.12/01.01)');
    // Eine Spalte je Kalendertag, Schichtart steckt im Zellwert:
    // TD (Tagdienst), ND (Nachtdienst), UR (Urlaub), '–' (regulär frei, neutral).
    // Zyklus im UI: — (leer) → TD → ND → UR → '–' → …
    if (status && status!=='TD' && status!=='ND' && status!=='UR' && status!=='–')
      return bad(res,'status muss TD, ND, UR, "–" oder leer sein');

    if (!status) {
      // Leerer Status = Zelle löschen (kein Eintrag = "keine Angabe", trägt 0 zum Score bei)
      await pool.query(
        'DELETE FROM dp_christmas_history WHERE employee_id=$1 AND year=$2 AND day_key=$3',
        [employeeId, year, dayKey]
      );
      return ok(res, {deleted:true});
    }
    const row = await q1(
      `INSERT INTO dp_christmas_history (id,employee_id,year,day_key,status,created_by)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (employee_id,year,day_key) DO UPDATE SET status=$5,updated_at=NOW()
       RETURNING *`,
      [newId(), employeeId, year, dayKey, status, req.uid]
    );
    ok(res, row);
  } catch(e) { bad(res,'Serverfehler',500); }
});

// Score-Übersicht: aggregiert ALLE erfassten Jahre (nicht auf ein Fenster
// beschränkt) — für die Matrix-Ansicht und zur Transparenz für Mitarbeiter.
router.get('/christmas/scores', auth, async (req,res) => {
  try {
    const historyRows = await q('SELECT employee_id,year,day_key,status FROM dp_christmas_history');
    ok(res, computeChristmasScores(historyRows));
  } catch(e) { bad(res,'Serverfehler',500); }
});

// ── URLAUBSWÜNSCHE (aktuelles Jahr) ───────────────────────────────────────────
// EIN Wunsch je Kalendertag (nicht je Schichtart): 'U' (möchte frei/Urlaub),
// 'TD' (möchte gern Tagdienst), 'ND' (möchte gern Nachtdienst), oder kein
// Eintrag = kein besonderer Wunsch. Fließt NICHT direkt in den Score ein —
// erst der später eingetragene, finale Historien-Wert wirkt auf den Score.

router.get('/christmas/wishes', auth, async (req,res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const rows = await q(
      'SELECT employee_id,day_key,wish FROM dp_christmas_wishes WHERE year=$1',
      [year]
    );
    ok(res, rows);
  } catch(e) { bad(res,'Serverfehler',500); }
});

router.put('/christmas/wishes', auth, async (req,res) => {
  try {
    const {employeeId, year, dayKey, wish} = req.body;
    if (!employeeId || !year || !CHRISTMAS_CALENDAR_DAY_KEYS.includes(dayKey))
      return bad(res,'employeeId, year und dayKey (24.12/25.12/26.12/31.12/01.01) erforderlich');
    if (wish && wish!=='U' && wish!=='TD' && wish!=='ND')
      return bad(res,'wish muss U, TD, ND oder leer sein');
    // Mitarbeiter dürfen ihren eigenen Wunsch eintragen, Planer (manageUsers) für alle
    if (!req.p.manageUsers && employeeId!==req.uid) return bad(res,'Keine Berechtigung',403);

    if (!wish) {
      await pool.query(
        'DELETE FROM dp_christmas_wishes WHERE employee_id=$1 AND year=$2 AND day_key=$3',
        [employeeId, year, dayKey]
      );
      return ok(res, {deleted:true});
    }
    const row = await q1(
      `INSERT INTO dp_christmas_wishes (id,employee_id,year,day_key,wants_off,wish,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (employee_id,year,day_key) DO UPDATE SET wants_off=$5,wish=$6,updated_at=NOW()
       RETURNING *`,
      [newId(), employeeId, year, dayKey, wish==='U', wish, req.uid]
      // wants_off wird nur noch als Alt-Spalte mitgeschrieben (nicht mehr
      // gelesen) — vermeidet einen NOT-NULL-Konflikt für Bestandszeilen.
    );
    ok(res, row);
  } catch(e) { bad(res,'Serverfehler',500); }
});

// ── VORSCHLAG (aktuelles Rotationsjahr) ───────────────────────────────────────

router.get('/christmas/proposal', auth, async (req,res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();

    const [allEmployees, shiftTypes, requirements, historyRows, wishRows] = await Promise.all([
      getEmployees(),
      q('SELECT * FROM dp_shift_types'),
      q('SELECT * FROM dp_shift_requirements'),
      // Score fließt aus ALLEN erfassten Jahren ein, kein Lookback-Fenster
      q('SELECT employee_id,year,day_key,status FROM dp_christmas_history'),
      q('SELECT employee_id,day_key,wish FROM dp_christmas_wishes WHERE year=$1', [year]),
    ]);

    // Ausgenommene (xmasParticipant=false) UND inaktive Mitarbeiter (isActive=false,
    // z.B. noch nicht eingetreten oder bereits ausgetreten) fließen weder in
    // Score noch Kapazität noch Vorschlag ein — werden hier vor der Berechnung
    // herausgefiltert, tauchen aber weiterhin in der Mitarbeiterverwaltung und
    // im Matrix-Endpoint (getEmployees) auf (dort ausgegraut).
    const employees = allEmployees.filter(e => e.xmasParticipant && e.isActive);
    const days = buildChristmasProposal(year, {employees, shiftTypes, requirements, historyRows, wishRows});
    ok(res, {year, employeeCount: employees.length, excludedCount: allEmployees.length - employees.length, days});
  } catch(e) { console.error('[christmas/proposal]', e.message); bad(res,'Serverfehler',500); }
});

// Vollständige Mitarbeiterliste inkl. Rotations-Teilnahme-Flag — für die
// Matrix-Ansicht (zeigt auch ausgenommene MA, aber ausgegraut/filterbar).
router.get('/christmas/employees', auth, async (req,res) => {
  try { ok(res, await getEmployees()); }
  catch(e) { bad(res,'Serverfehler',500); }
});

module.exports = router;
