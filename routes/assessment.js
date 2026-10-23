'use strict';
// Assessment (Rolle "Assessment", siehe lib/roles.js). Ablauf: Start →
// Abschnitt für Abschnitt mit eigenem Zeitlimit → Auswertung. Jeder Abschnitt
// startet erst mit einem Klick auf „Weiter“. Die Uhr läuft serverseitig
// (section_started_at, gerechnet mit der Datenbankzeit): der Client zeigt nur
// einen Countdown an und gibt bei 0:00 automatisch ab. Kommt keine Abgabe (Browser zu, Netz
// weg), wird der Abschnitt beim nächsten Aufruf mit dem zuletzt
// zwischengespeicherten Stand (draft) gewertet. Lösungen und Auswertung
// sieht nur die Administration.
const router = require('express').Router();
const { q, q1, newId, pool, logAct } = require('../db');
const { auth, assessmentAccess, assessmentManage, adminOnly, ok, bad } = require('../middleware');
const A = require('../lib/assessment');

const parseJson = (t, fb) => { try { return t ? JSON.parse(t) : fb; } catch { return fb; } };
// elapsed = Sekunden seit Abschnittsbeginn, direkt in der Datenbank gerechnet.
// total_elapsed = Sekunden seit dem Start des Assessments (Gesamtzeit-Anzeige).
const SELECT_ATT = `SELECT *, EXTRACT(EPOCH FROM (NOW()-section_started_at))::float AS elapsed,
  EXTRACT(EPOCH FROM (NOW()-started_at))::float AS total_elapsed FROM assessment_attempts`;
const getAttempt = uid => q1(`${SELECT_ATT} WHERE user_id=$1 AND archived_at IS NULL`, [uid]);
// draft = { answers, block, blockAt } — block = Index des aktuellen Blocks
// („Fertig, weiter“), blockAt = Sekunden seit Abschnittsbeginn, zu denen ein
// Block begonnen wurde (für die Zeitauswertung je Block).
const draftOf = att => { const d = parseJson(att.draft, {}); return { answers: d.answers || {}, block: Number.isInteger(d.block) ? d.block : 0, blockAt: d.blockAt && typeof d.blockAt === 'object' ? d.blockAt : {} }; };
const timingOf = att => ({ used: att.elapsed, blockAt: draftOf(att).blockAt });

// Wertet einen Abschnitt aus und springt zum nächsten. expectedSection
// verhindert doppeltes Weiterschalten bei gleichzeitigen Abgaben.
async function finishSection(att, answers, late) {
  const idx = att.current_section;
  const results = parseJson(att.results, []);
  results.push(A.scoreSection(idx, answers, { late, ...timingOf(att) }));
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
  if (att && att.status === 'running' && att.section_started_at && A.isExpired(att.current_section, att.elapsed)) {
    await finishSection(att, draftOf(att).answers, true);
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
    submitted: parseJson(att.results, []).length,
    remainingSeconds: att.section_started_at ? Math.max(0, A.remainingSeconds(att.current_section, att.elapsed)) : null,
    // Gesamtzeit: läuft ab dem Start mit, nur zur Anzeige (gewertet wird je Abschnitt).
    totalRemainingSeconds: att.status === 'running' && att.total_elapsed != null ? Math.max(0, Math.round(A.TOTAL_MINUTES * 60 - att.total_elapsed)) : null,
    // Live-Ansicht der Administration: Restzeit des laufenden Abschnitts.
    version: att.version,
    startedAt: att.started_at, finishedAt: att.finished_at,
    sectionTitle: A.SECTIONS[att.current_section]?.title || null,
  };
}

// Laufende Durchgänge einer älteren Katalogversion passen nicht mehr zu den
// Abschnitten: archivieren (bereits abgegebene Abschnitte bleiben für die
// Administration einsehbar), der Mitarbeiter beginnt neu.
async function dropOutdated(att) {
  if (att && att.status === 'running' && att.version !== A.VERSION) {
    await pool.query('UPDATE assessment_attempts SET archived_at=NOW(), section_started_at=NULL WHERE id=$1', [att.id]);
    return null;
  }
  return att;
}

router.get('/', auth, assessmentAccess, async (req,res) => {
  try {
    const att = await expireIfNeeded(await dropOutdated(await getAttempt(req.uid)));
    ok(res, { sections: A.overview(), totalMinutes: A.TOTAL_MINUTES, attempt: stateOf(att), isAdmin: !!req.p.manageAssessment, canDelete: !!req.p.manageUsers });
  } catch(e) { console.error('[assessment]', e.message); bad(res,'Serverfehler',500); }
});

router.post('/start', auth, assessmentAccess, async (req,res) => {
  try {
    await dropOutdated(await getAttempt(req.uid));
    // Admins können zum Testen ab einem bestimmten Abschnitt starten. Die
    // übersprungenen Minuten werden vom Startzeitpunkt abgezogen, damit die
    // Gesamtzeit-Anzeige stimmt.
    let from = 0;
    if (req.p.manageAssessment && req.body?.startSection !== undefined) {
      from = Number(req.body.startSection);
      if (!Number.isInteger(from) || from < 0 || from >= A.SECTIONS.length) return bad(res,'Ungültiger Abschnitt');
    }
    const skipped = A.SECTIONS.slice(0, from).reduce((n, s) => n + s.minutes, 0);
    await pool.query(`INSERT INTO assessment_attempts (id,user_id,version,current_section,started_at) VALUES ($1,$2,$3,$4,NOW()-make_interval(mins => $5))
      ON CONFLICT (user_id) WHERE archived_at IS NULL DO NOTHING`, [newId(), req.uid, A.VERSION, from, skipped]);
    const att = await getAttempt(req.uid);
    if (att.status !== 'running') return bad(res,'Das Assessment wurde bereits abgeschlossen',409);
    await logAct(req.uid, req.user.name, 'assessment_start', {});
    ok(res, stateOf(att));
  } catch(e) { console.error('[assessment/start]', e.message); bad(res,'Serverfehler',500); }
});

// Startet die Uhr des aktuellen Abschnitts (idempotent — nach einem Reload
// läuft die bereits gestartete Uhr einfach weiter) und liefert die Fragen.
router.post('/section/begin', auth, assessmentAccess, async (req,res) => {
  try {
    let att = await expireIfNeeded(await dropOutdated(await getAttempt(req.uid)));
    if (!att || att.status !== 'running') return bad(res,'Kein laufendes Assessment',409);
    if (!att.section_started_at) {
      await pool.query('UPDATE assessment_attempts SET section_started_at=NOW() WHERE id=$1 AND section_started_at IS NULL', [att.id]);
      att = await getAttempt(req.uid);
    }
    ok(res, { section: A.publicSection(att.current_section), state: stateOf(att), draft: draftOf(att) });
  } catch(e) { console.error('[assessment/begin]', e.message); bad(res,'Serverfehler',500); }
});

// Zwischenspeichern nach jeder Änderung (und bei „Fertig, weiter“). Der
// Block kann nur vorwärts gehen, abgeschlossene Texte bleiben gesperrt.
router.put('/section/draft', auth, assessmentAccess, async (req,res) => {
  try {
    const att = await getAttempt(req.uid);
    if (!att || att.status !== 'running' || !att.section_started_at) return bad(res,'Kein laufender Abschnitt',409);
    if (Number(req.body?.section) !== att.current_section) return bad(res,'Abschnitt ist bereits abgeschlossen',409);
    if (A.isExpired(att.current_section, att.elapsed)) return bad(res,'Zeit abgelaufen',409);
    const prev = draftOf(att);
    const answers = A.mergeAnswers(prev.answers, A.sanitizeAnswers(att.current_section, req.body?.answers));
    const nBlocks = A.SECTIONS[att.current_section].blocks.length;
    const reqBlock = Number(req.body?.block);
    const block = Number.isInteger(reqBlock) ? Math.min(Math.max(prev.block, reqBlock), Math.max(0, nBlocks - 1)) : prev.block;
    const blockAt = { ...prev.blockAt };
    if (block > prev.block) blockAt[block] = Math.round(att.elapsed);
    await pool.query('UPDATE assessment_attempts SET draft=$1 WHERE id=$2 AND current_section=$3 AND status=\'running\'',
      [JSON.stringify({ answers, block, blockAt }), att.id, att.current_section]);
    ok(res, { block });
  } catch(e) { console.error('[assessment/draft]', e.message); bad(res,'Serverfehler',500); }
});

// Protokolliert, wenn der Vollbildmodus verlassen oder der Tab gewechselt
// wird (verhindern kann das keine Webseite). Höchstens 500 Einträge.
// Gerätestatus für die Live-Ansicht der Administration: Akkustand in Prozent
// und ob geladen wird. Browser ohne Battery-API (Safari, Firefox) melden
// level=null.
router.put('/device', auth, assessmentAccess, async (req,res) => {
  try {
    const lv = req.body?.level;
    const level = typeof lv === 'number' && lv >= 0 && lv <= 1 ? Math.round(lv * 100) : null;
    const dev = JSON.stringify({ level, charging: req.body?.charging === true, fullscreen: req.body?.fullscreen === true, focused: req.body?.focused !== false, at: new Date().toISOString() });
    await pool.query(`UPDATE assessment_attempts SET device=$1 WHERE user_id=$2 AND archived_at IS NULL AND status='running'`, [dev, req.uid]);
    ok(res);
  } catch(e) { console.error('[assessment/device]', e.message); bad(res,'Serverfehler',500); }
});

const EVENT_TYPES = ['fullscreen_exit', 'tab_hidden', 'window_blur', 'shortcut_blocked'];
router.post('/section/event', auth, assessmentAccess, async (req,res) => {
  try {
    const type = req.body?.type;
    if (!EVENT_TYPES.includes(type)) return bad(res,'Unbekanntes Ereignis');
    const att = await getAttempt(req.uid);
    if (!att || att.status !== 'running') return ok(res);
    const ev = JSON.stringify([{ type, section: att.current_section, at: new Date().toISOString() }]);
    await pool.query(`UPDATE assessment_attempts SET events=(events::jsonb || $1::jsonb)::text
      WHERE id=$2 AND jsonb_array_length(events::jsonb) < 500`, [ev, att.id]);
    ok(res);
  } catch(e) { console.error('[assessment/event]', e.message); bad(res,'Serverfehler',500); }
});

// Abgabe: gewertet wird der Zwischenstand zusammen mit den mitgeschickten
// Antworten. Kommt die Abgabe zu spät, zählt nur der Zwischenstand.
router.post('/section/submit', auth, assessmentAccess, async (req,res) => {
  try {
    const att = await getAttempt(req.uid);
    if (!att || att.status !== 'running' || !att.section_started_at) return bad(res,'Kein laufender Abschnitt',409);
    if (Number(req.body?.section) !== att.current_section) return bad(res,'Abschnitt ist bereits abgeschlossen',409);
    const sec = A.SECTIONS[att.current_section];
    if (sec.kind === 'pause' && !req.p.manageAssessment && A.remainingSeconds(att.current_section, att.elapsed) > 2) return bad(res,'Die Pause läuft noch',409);
    const late = A.isExpired(att.current_section, att.elapsed);
    const stored = draftOf(att).answers;
    const answers = late ? stored : A.mergeAnswers(stored, A.sanitizeAnswers(att.current_section, req.body?.answers));
    await finishSection(att, answers, late);
    const next = await getAttempt(req.uid);
    if (next.status === 'finished') await logAct(req.uid, req.user.name, 'assessment_finish', {});
    ok(res, stateOf(next));
  } catch(e) { console.error('[assessment/submit]', e.message); bad(res,'Serverfehler',500); }
});

// ── ADMINISTRATION ───────────────────────────────────────────────────────────
router.get('/results', auth, assessmentManage, async (req,res) => {
  try {
    const rows = await q(`SELECT a.*, EXTRACT(EPOCH FROM (NOW()-a.section_started_at))::float AS elapsed,
      EXTRACT(EPOCH FROM (NOW()-a.started_at))::float AS total_elapsed, u.name AS user_name
      FROM assessment_attempts a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.started_at DESC`);
    const candidates = await q(`SELECT id, name FROM users WHERE roles ? 'assessment' AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text(roles) r WHERE r NOT IN ('assessment','standard')) ORDER BY name`);
    const original = await abschriftOriginal();
    const out = [];
    for (const r of rows) {
      const att = r.version === A.VERSION && !r.archived_at ? await expireIfNeeded(r) : r;
      const overrides = parseJson(att.overrides, {});
      const results = A.applyRatings(A.applyOverrides(parseJson(att.results, []), overrides), parseJson(att.ratings, {}), { original });
      out.push({
        id: att.id, userId: att.user_id, userName: r.user_name || '?', ...stateOf(att),
        outdated: att.version !== A.VERSION, results, summary: A.summarize(results),
        events: parseJson(att.events, []), archivedAt: att.archived_at, device: parseJson(att.device, {}),
      });
    }
    ok(res, { attempts: out, candidates: candidates.map(c => ({ id: c.id, name: c.name })), abschriftOriginal: original });
  } catch(e) { console.error('[assessment/results]', e.message); bad(res,'Serverfehler',500); }
});

// Zurücksetzen: der aktive Durchgang wird archiviert, der Mitarbeiter kann
// neu beginnen und sieht den alten nicht mehr. Die Administration sieht ihn
// weiterhin in den Ergebnissen.
router.post('/users/:uid/reset', auth, assessmentManage, async (req,res) => {
  try {
    const u = await q1('SELECT id, name FROM users WHERE id=$1', [req.params.uid]);
    if (!u) return bad(res,'Nicht gefunden',404);
    const r = await pool.query('UPDATE assessment_attempts SET archived_at=NOW() WHERE user_id=$1 AND archived_at IS NULL', [u.id]);
    if (!r.rowCount) return bad(res,'Kein Durchgang zum Zurücksetzen',409);
    await logAct(req.uid, req.user.name, 'assessment_reset', { userId: u.id, userName: u.name });
    ok(res);
  } catch(e) { console.error('[assessment/reset]', e.message); bad(res,'Serverfehler',500); }
});

// Nachbewertung einer einzelnen Antwort. correct=true/false setzt die Wertung,
// correct=null nimmt die Korrektur zurück.
router.put('/attempts/:id/override', auth, assessmentManage, async (req,res) => {
  try {
    const { section, qid, correct } = req.body || {};
    if (typeof section !== 'string' || typeof qid !== 'string' || ![true, false, null].includes(correct)) return bad(res,'Ungültige Angaben');
    const att = await q1('SELECT a.id, a.results, a.overrides, u.name AS user_name FROM assessment_attempts a LEFT JOIN users u ON u.id=a.user_id WHERE a.id=$1', [req.params.id]);
    if (!att) return bad(res,'Nicht gefunden',404);
    const r = parseJson(att.results, []).find(x => x.key === section);
    const d = r && (r.blocks || []).flatMap(b => b.details || []).find(x => x.id === qid);
    if (!d || !A.OVERRIDABLE.includes(d.type)) return bad(res,'Diese Antwort kann nicht nachbewertet werden',409);
    const overrides = parseJson(att.overrides, {});
    const key = A.overrideKey(section, qid);
    if (correct === null || correct === d.correct) delete overrides[key];
    else overrides[key] = { correct, by: req.user.name, at: new Date().toISOString() };
    await pool.query('UPDATE assessment_attempts SET overrides=$1 WHERE id=$2', [JSON.stringify(overrides), att.id]);
    await logAct(req.uid, req.user.name, 'assessment_override', { attemptId: att.id, userName: att.user_name, section, qid, correct });
    ok(res);
  } catch(e) { console.error('[assessment/override]', e.message); bad(res,'Serverfehler',500); }
});

// Bewertungsraster: value 1–5 setzt ein Kriterium, null entfernt die Bewertung.
router.put('/attempts/:id/rating', auth, assessmentManage, async (req,res) => {
  try {
    const { section, qid, criterion, value } = req.body || {};
    const q = typeof section === 'string' && typeof qid === 'string' && A.rubricOf(section, qid);
    if (!q || !q.rubric.some(c => c.key === criterion)) return bad(res,'Ungültige Angaben');
    if (value !== null && !(Number.isInteger(value) && value >= A.RATING_MIN && value <= A.RATING_MAX)) return bad(res,'Ungültige Punkte');
    const att = await q1('SELECT a.id, a.results, a.ratings, u.name AS user_name FROM assessment_attempts a LEFT JOIN users u ON u.id=a.user_id WHERE a.id=$1', [req.params.id]);
    if (!att) return bad(res,'Nicht gefunden',404);
    const r = parseJson(att.results, []).find(x => x.key === section);
    if (!r || !(r.blocks || []).some(b => (b.details || []).some(d => d.id === qid))) return bad(res,'Dieser Text wurde noch nicht abgegeben',409);
    const ratings = parseJson(att.ratings, {});
    const key = A.overrideKey(section, qid);
    const scores = { ...(ratings[key]?.scores || {}) };
    if (value === null) delete scores[criterion]; else scores[criterion] = value;
    if (Object.keys(scores).length) ratings[key] = { scores, by: req.user.name, at: new Date().toISOString() };
    else delete ratings[key];
    await pool.query('UPDATE assessment_attempts SET ratings=$1 WHERE id=$2', [JSON.stringify(ratings), att.id]);
    await logAct(req.uid, req.user.name, 'assessment_rating', { attemptId: att.id, userName: att.user_name, section, qid, criterion, value });
    ok(res);
  } catch(e) { console.error('[assessment/rating]', e.message); bad(res,'Serverfehler',500); }
});

// Originaltext der Abschrift (liegt den Bewerbern auf Papier vor). Dient nur
// dem automatischen Vergleich in den Details.
async function abschriftOriginal() {
  const r = await q1(`SELECT value FROM assessment_config WHERE key='abschrift_original'`);
  return r ? r.value : '';
}
router.put('/config/abschrift', auth, assessmentManage, async (req,res) => {
  try {
    const text = req.body?.text;
    if (typeof text !== 'string' || text.length > 20000) return bad(res,'Ungültiger Text');
    await pool.query(`INSERT INTO assessment_config (key,value,updated_at) VALUES ('abschrift_original',$1,NOW())
      ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW()`, [text.trim()]);
    await logAct(req.uid, req.user.name, 'assessment_config', { key: 'abschrift_original' });
    ok(res);
  } catch(e) { console.error('[assessment/config]', e.message); bad(res,'Serverfehler',500); }
});

// Löschen: abgeschlossene, abgebrochene und archivierte Durchgänge werden
// endgültig entfernt. Ein laufender Durchgang muss vorher abgebrochen werden.
router.delete('/attempts/:id', auth, adminOnly, async (req,res) => {
  try {
    const att = await q1('SELECT a.id, a.status, a.archived_at, u.name AS user_name FROM assessment_attempts a LEFT JOIN users u ON u.id=a.user_id WHERE a.id=$1', [req.params.id]);
    if (!att) return bad(res,'Nicht gefunden',404);
    if (att.status === 'running' && !att.archived_at) return bad(res,'Laufende Durchgänge zuerst abbrechen',409);
    await pool.query('DELETE FROM assessment_attempts WHERE id=$1', [att.id]);
    await logAct(req.uid, req.user.name, 'assessment_delete', { attemptId: att.id, userName: att.user_name });
    ok(res);
  } catch(e) { console.error('[assessment/delete]', e.message); bad(res,'Serverfehler',500); }
});

// Abbrechen: ein laufender Durchgang wird sofort beendet (Status „aborted“).
// Ein begonnener Abschnitt wird mit dem Zwischenstand gewertet. Der
// Mitarbeiter sieht danach nur noch den Hinweis; mit „Zurücksetzen“ kann er
// neu beginnen.
router.post('/users/:uid/abort', auth, assessmentManage, async (req,res) => {
  try {
    const u = await q1('SELECT id, name FROM users WHERE id=$1', [req.params.uid]);
    if (!u) return bad(res,'Nicht gefunden',404);
    const att = await getAttempt(u.id);
    if (!att || att.status !== 'running') return bad(res,'Kein laufender Durchgang',409);
    const results = parseJson(att.results, []);
    if (att.section_started_at && att.version === A.VERSION) results.push(A.scoreSection(att.current_section, draftOf(att).answers, { late: false, aborted: true, ...timingOf(att) }));
    const ev = JSON.stringify([{ type: 'aborted', section: att.current_section, at: new Date().toISOString(), by: req.user.name }]);
    const r = await pool.query(`UPDATE assessment_attempts SET status='aborted', results=$1, draft='{}', section_started_at=NULL,
        finished_at=NOW(), events=(events::jsonb || $2::jsonb)::text WHERE id=$3 AND status='running'`,
      [JSON.stringify(results), ev, att.id]);
    if (!r.rowCount) return bad(res,'Kein laufender Durchgang',409);
    await logAct(req.uid, req.user.name, 'assessment_abort', { userId: u.id, userName: u.name });
    ok(res);
  } catch(e) { console.error('[assessment/abort]', e.message); bad(res,'Serverfehler',500); }
});

module.exports = router;
