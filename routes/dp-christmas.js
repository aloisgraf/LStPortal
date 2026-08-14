'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// WEIHNACHTSDIENST-ROTATION — Score-Modell
//
// Reine Vorschlags-Funktion (lib/dp-rules.js: buildChristmasProposal): liefert
// für die fünf Weihnachts-/Neujahrs-Tage einen fairness-basierten Score je
// Mitarbeiter (+1 pro Jahr gearbeitet, −1 pro Jahr Urlaub — je Tag-Typ separat,
// über beliebig viele erfasste Jahre) und darauf aufbauend einen Freistellungs-
// vorschlag für die Mitarbeiter, die für das aktuelle Jahr einen Urlaubswunsch
// hinterlegt haben. Schreibt NIE in dp_plans/dp_assignments — nur Lesevorschlag,
// keine automatische Übernahme in den Dienstplan.
//
// Mitarbeiter- und Schichtbedarfs-Daten werden aus den bestehenden DP-Tabellen
// referenziert (dp_employee_params, dp_shift_types, dp_shift_requirements) —
// keine Datenduplikate. Neu sind nur die reinen U/A-Historieneinträge und die
// Urlaubswünsche fürs aktuelle Jahr.
// ─────────────────────────────────────────────────────────────────────────────
const router = require('express').Router();
const { q, q1, newId, pool } = require('../db');
const { auth, ok, bad } = require('../middleware');
const { CHRISTMAS_DAY_KEYS, buildChristmasProposal, computeChristmasScores } = require('../lib/dp-rules');

// Liefert ALLE Mitarbeiter mit DP-Parametern inkl. Rotations-Teilnahme-Flag
// (xmasParticipant). Ausgenommene Mitarbeiter (xmasParticipant=false) werden
// hier NICHT herausgefiltert — das erledigt der jeweilige Aufrufer, je nachdem
// ob er die volle Liste (Matrix-Anzeige) oder nur Teilnehmer (Score/Vorschlag/
// Kapazität) braucht.
async function getEmployees() {
  const [empParams, users] = await Promise.all([
    q(`SELECT DISTINCT ON (employee_id) employee_id, xmas_rotation_participant
       FROM dp_employee_params ORDER BY employee_id, valid_from DESC NULLS LAST`),
    q('SELECT id,name FROM users'),
  ]);
  const userMap = {};
  for (const u of users) userMap[u.id] = u.name;
  return empParams
    .map(e => ({
      id: e.employee_id,
      name: userMap[e.employee_id] || null,
      xmasParticipant: e.xmas_rotation_participant !== false,
    }))
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
    if (!employeeId || !year || !CHRISTMAS_DAY_KEYS.includes(dayKey))
      return bad(res,'employeeId, year und dayKey erforderlich (z.B. 24.12-T/24.12-N)');
    // '–' = explizit "regulär frei" (dokumentiert, trägt aber wie ein leerer
    // Eintrag 0 zum Score bei) — Zyklus im UI: — (leer) → U → A → '–' → …
    if (status && status!=='U' && status!=='A' && status!=='–')
      return bad(res,'status muss U, A, "–" oder leer sein');

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

router.get('/christmas/wishes', auth, async (req,res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const rows = await q(
      'SELECT employee_id,day_key,wants_off FROM dp_christmas_wishes WHERE year=$1',
      [year]
    );
    ok(res, rows);
  } catch(e) { bad(res,'Serverfehler',500); }
});

router.put('/christmas/wishes', auth, async (req,res) => {
  try {
    const {employeeId, year, dayKey, wantsOff} = req.body;
    if (!employeeId || !year || !CHRISTMAS_DAY_KEYS.includes(dayKey))
      return bad(res,'employeeId, year und dayKey (24.12/25.12/26.12/31.12/01.01) erforderlich');
    // Mitarbeiter dürfen ihren eigenen Wunsch eintragen, Planer (manageUsers) für alle
    if (!req.p.manageUsers && employeeId!==req.uid) return bad(res,'Keine Berechtigung',403);

    if (!wantsOff) {
      await pool.query(
        'DELETE FROM dp_christmas_wishes WHERE employee_id=$1 AND year=$2 AND day_key=$3',
        [employeeId, year, dayKey]
      );
      return ok(res, {deleted:true});
    }
    const row = await q1(
      `INSERT INTO dp_christmas_wishes (id,employee_id,year,day_key,wants_off,created_by)
       VALUES ($1,$2,$3,$4,true,$5)
       ON CONFLICT (employee_id,year,day_key) DO UPDATE SET wants_off=true,updated_at=NOW()
       RETURNING *`,
      [newId(), employeeId, year, dayKey, req.uid]
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
      q('SELECT employee_id,day_key,wants_off FROM dp_christmas_wishes WHERE year=$1', [year]),
    ]);

    // Ausgenommene Mitarbeiter (xmasParticipant=false) fließen weder in Score
    // noch Kapazität noch Vorschlag ein — werden hier vor der Berechnung
    // herausgefiltert, tauchen aber weiterhin in der Mitarbeiterverwaltung und
    // im Matrix-Endpoint (getEmployees) auf.
    const employees = allEmployees.filter(e => e.xmasParticipant);
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
