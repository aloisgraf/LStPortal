'use strict';
// Assessment (Rolle "Assessment", siehe lib/roles.js). Ablauf: Start →
// Abschnitt für Abschnitt mit eigenem Zeitlimit → Auswertung. Die Uhr läuft
// serverseitig (section_started_at): der Client zeigt nur einen Countdown an
// und gibt bei 0:00 automatisch ab. Kommt keine Abgabe (Browser zu, Netz
// weg), wird der Abschnitt beim nächsten Aufruf mit dem zuletzt
// zwischengespeicherten Stand (draft) gewertet. Lösungen und Auswertung
// sieht nur die Administration.
const router = require('express').Router();
const { q, q1, newId, pool, logAct } = require('../db');
const { auth, assessmentAccess, adminOnly, ok, bad } = require('../middleware');
const A = require('../lib/assessment');

const parseJson = (t, fb) => { try { return t ? JSON.parse(t) : fb; } catch { return fb; } };
const getAttempt = uid => q1('SELECT * FROM assessment_attempts WHERE user_id=$1', [uid]);

// Wertet einen Abschnitt aus und springt zum nächsten. expectedSection
// verhindert doppeltes Weiterschalten bei gleichzeitigen Abgaben.
async function finishSection(att, answers, late) {
  const idx = att.current_section;
  const results = parseJson(att.results, []);
  results.push(A.scoreSection(idx, answers, { late }));
  const last = idx + 1 >= A.SECTIONS.length;
  const r = await pool.query(
    `UPDATE assessment_attempts SET results=$1, draft='{}', section_started_at=NULL,
       current_section=$2, status=$3, finished_at=${last ? 'NOW()' : 'NULL'}
     WHERE id=$4 AND current_section=$5 AND status='running'`,
    [JSON.stringify(results), idx + 1, last ? 'finished' : 'running', att.id, idx]);
  return r.rowCount > 0;
}

// Abgelaufene Abschnitte (inkl. Kulanzzeit) mit dem Zwischenstand abschließen.
async function expireIfNeeded(att) {
  if (att && att.status === 'running' && att.section_started_at && A.isExpired(att.current_section, att.section_started_at)) {
    await finishSection(att, parseJson(att.draft, {}), true);
    return getAttempt(att.user_id);
  }
  return att;
}

function stateOf(att) {
  if (!att) return null;
  return {
    status: att.status,
    currentSection: att.current_section,
    sectionStarted: !!att.section_started_at,
    remainingSeconds: att.section_started_at ? Math.max(0, A.remainingSeconds(att.current_section, att.section_started_at)) : null,
    startedAt: att.started_at, finishedAt: att.finished_at,
  };
}

router.get('/', auth, assessmentAccess, async (req,res) => {
  try {
    const att = await expireIfNeeded(await getAttempt(req.uid));
    ok(res, { sections: A.overview(), totalMinutes: A.TOTAL_MINUTES, attempt: stateOf(att), isAdmin: !!req.p.manageUsers });
  } catch(e) { console.error('[assessment]', e.message); bad(res,'Serverfehler',500); }
});

router.post('/start', auth, assessmentAccess, async (req,res) => {
  try {
    await pool.query(`INSERT INTO assessment_attempts (id,user_id) VALUES ($1,$2) ON CONFLICT (user_id) DO NOTHING`, [newId(), req.uid]);
    const att = await getAttempt(req.uid);
    if (att.status === 'finished') return bad(res,'Das Assessment wurde bereits abgeschlossen',409);
    await logAct(req.uid, req.user.name, 'assessment_start', {});
    ok(res, stateOf(att));
  } catch(e) { console.error('[assessment/start]', e.message); bad(res,'Serverfehler',500); }
});

// Startet die Uhr des aktuellen Abschnitts (idempotent — nach einem Reload
// läuft die bereits gestartete Uhr einfach weiter) und liefert die Fragen.
router.post('/section/begin', auth, assessmentAccess, async (req,res) => {
  try {
    let att = await expireIfNeeded(await getAttempt(req.uid));
    if (!att || att.status !== 'running') return bad(res,'Kein laufendes Assessment',409);
    if (!att.section_started_at) {
      await pool.query('UPDATE assessment_attempts SET section_started_at=NOW() WHERE id=$1 AND section_started_at IS NULL', [att.id]);
      att = await getAttempt(req.uid);
    }
    ok(res, { section: A.publicSection(att.current_section), state: stateOf(att), draft: parseJson(att.draft, {}) });
  } catch(e) { console.error('[assessment/begin]', e.message); bad(res,'Serverfehler',500); }
});

router.put('/section/draft', auth, assessmentAccess, async (req,res) => {
  try {
    const att = await getAttempt(req.uid);
    if (!att || att.status !== 'running' || !att.section_started_at) return bad(res,'Kein laufender Abschnitt',409);
    if (Number(req.body?.section) !== att.current_section) return bad(res,'Abschnitt ist bereits abgeschlossen',409);
    if (A.isExpired(att.current_section, att.section_started_at)) return bad(res,'Zeit abgelaufen',409);
    const answers = A.sanitizeAnswers(att.current_section, req.body?.answers);
    await pool.query('UPDATE assessment_attempts SET draft=$1 WHERE id=$2 AND current_section=$3', [JSON.stringify(answers), att.id, att.current_section]);
    ok(res);
  } catch(e) { console.error('[assessment/draft]', e.message); bad(res,'Serverfehler',500); }
});

router.post('/section/submit', auth, assessmentAccess, async (req,res) => {
  try {
    const att = await getAttempt(req.uid);
    if (!att || att.status !== 'running' || !att.section_started_at) return bad(res,'Kein laufender Abschnitt',409);
    if (Number(req.body?.section) !== att.current_section) return bad(res,'Abschnitt ist bereits abgeschlossen',409);
    const late = A.isExpired(att.current_section, att.section_started_at);
    await finishSection(att, late ? parseJson(att.draft, {}) : req.body?.answers, late);
    const next = await getAttempt(req.uid);
    if (next.status === 'finished') await logAct(req.uid, req.user.name, 'assessment_finish', {});
    ok(res, stateOf(next));
  } catch(e) { console.error('[assessment/submit]', e.message); bad(res,'Serverfehler',500); }
});

// ── ADMINISTRATION ───────────────────────────────────────────────────────────
router.get('/results', auth, adminOnly, async (req,res) => {
  try {
    const rows = await q(`SELECT a.*, u.name AS user_name FROM assessment_attempts a
      LEFT JOIN users u ON u.id=a.user_id ORDER BY a.started_at DESC`);
    const out = [];
    for (const r of rows) {
      const att = await expireIfNeeded(r);
      const results = parseJson(att.results, []);
      out.push({
        id: att.id, userId: att.user_id, userName: r.user_name || '?', ...stateOf(att),
        results, summary: A.summarize(results),
      });
    }
    ok(res, out);
  } catch(e) { console.error('[assessment/results]', e.message); bad(res,'Serverfehler',500); }
});

// Zurücksetzen: löscht den Durchgang, der Mitarbeiter kann neu beginnen.
router.delete('/attempts/:id', auth, adminOnly, async (req,res) => {
  try {
    const att = await q1('SELECT a.user_id, u.name FROM assessment_attempts a LEFT JOIN users u ON u.id=a.user_id WHERE a.id=$1', [req.params.id]);
    if (!att) return bad(res,'Nicht gefunden',404);
    await pool.query('DELETE FROM assessment_attempts WHERE id=$1', [req.params.id]);
    await logAct(req.uid, req.user.name, 'assessment_reset', { userId: att.user_id, userName: att.name });
    ok(res);
  } catch(e) { console.error('[assessment/reset]', e.message); bad(res,'Serverfehler',500); }
});

module.exports = router;
