'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// WEIHNACHTSDIENST-ROTATION
//
// Reine Vorschlags-Funktion (lib/dp-rules.js: buildChristmasProposal): liefert
// für die fünf Weihnachts-/Neujahrs-Tage je einen Bedarfs- vs.
// Verpflichtungs-Abgleich, basierend auf einer manuell erfassten Historie
// (U=Urlaub / A=Arbeit) der letzten Jahre. Schreibt NIE in dp_plans/
// dp_assignments — nur Lesevorschlag, keine automatische Übernahme in den
// Dienstplan (siehe Anforderung).
//
// Mitarbeiter- und Schichtbedarfs-Daten werden aus den bestehenden DP-Tabellen
// referenziert (dp_employee_params, dp_shift_types, dp_shift_requirements) —
// keine Datenduplikate, nur die reinen U/A-Historieneinträge sind neu.
// ─────────────────────────────────────────────────────────────────────────────
const router = require('express').Router();
const { q, q1, newId, pool } = require('../db');
const { auth, ok, bad } = require('../middleware');
const { CHRISTMAS_DAY_KEYS, buildChristmasProposal } = require('../lib/dp-rules');

// ── HISTORIE (manuelle Erfassung U/A) ─────────────────────────────────────────

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
      return bad(res,'employeeId, year und dayKey (24.12/25.12/26.12/31.12/01.01) erforderlich');
    if (status && status!=='U' && status!=='A')
      return bad(res,'status muss U, A oder leer sein');

    if (!status) {
      // Leerer Status = Zelle löschen (kein Eintrag = "keine Angabe")
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

// ── VORSCHLAG (aktuelles Rotationsjahr) ───────────────────────────────────────

router.get('/christmas/proposal', auth, async (req,res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const lookback = Math.max(1, parseInt(req.query.lookback) || 2);

    const [empParams, users, shiftTypes, requirements, historyRows] = await Promise.all([
      q('SELECT DISTINCT ON (employee_id) employee_id FROM dp_employee_params ORDER BY employee_id'),
      q('SELECT id,name FROM users'),
      q('SELECT * FROM dp_shift_types'),
      q('SELECT * FROM dp_shift_requirements'),
      q('SELECT employee_id,year,day_key,status FROM dp_christmas_history WHERE year=ANY($1::int[])',
        [Array.from({length: lookback}, (_,i) => year - 1 - i)]),
    ]);

    const userMap = {};
    for (const u of users) userMap[u.id] = u.name;
    const employees = empParams
      .map(e => ({id: e.employee_id, name: userMap[e.employee_id] || null}))
      .filter(e => e.name) // nur (noch) existierende Mitarbeiter
      .sort((a,b) => a.name.localeCompare(b.name,'de'));

    const days = buildChristmasProposal(year, {employees, shiftTypes, requirements, historyRows});
    ok(res, {year, lookback, employeeCount: employees.length, days});
  } catch(e) { console.error('[christmas/proposal]', e.message); bad(res,'Serverfehler',500); }
});

module.exports = router;
