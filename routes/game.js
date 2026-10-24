'use strict';
// "Desk Empire" — kleines Idle-Spiel (Menüpunkt "Spiele" in der Kopfzeile).
// Design-Entscheidung: der Server ist die einzige Quelle der Wahrheit für
// Kontostand, Preise, Einnahmen und vergangene Zeit. Der Client schickt
// ausschließlich Absichten ("Klicks", "kaufe X", "stelle Y ein" usw.).
// Die Spiellogik steckt in lib/game-logic.js (zustandslos, getestet in
// test/game-logic.test.mjs); diese Datei ist nur die DB-/HTTP-Schicht:
// Spielstand in einer Transaktion sperren, Zeit fortschreiben, Aktion
// anwenden, speichern, Ansicht zurückgeben.
const router = require('express').Router();
const { pool } = require('../db');
const { auth, ok, bad } = require('../middleware');
const GL = require('../lib/game-logic');

// Führt eine Aktion auf dem gesperrten Spielstand aus (SELECT … FOR UPDATE),
// damit parallele Anfragen (schnelle Klicks, Doppelkäufe) sich nicht
// gegenseitig überschreiben.
async function withSave(uid, action){
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`INSERT INTO game_saves (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`, [uid]);
    const row = (await client.query('SELECT state, owned_items, total_earned FROM game_saves WHERE user_id=$1 FOR UPDATE', [uid])).rows[0];
    const now = Date.now();
    const loaded = GL.loadState(row?.state, now);
    const { state } = loaded;
    // Hinweis auch für Spielstände aus Version 1 (nur Einzelspalten, kein `state`)
    const reset = loaded.reset || (!row?.state && ((row?.owned_items && row.owned_items!=='{}') || (row?.total_earned||0) > 10));
    const tickInfo = GL.tick(state, now);
    let result, error = null;
    try { result = action(state, now); }
    catch(e){ if (e instanceof GL.GameError) error = e.message; else throw e; }
    const newAchievements = GL.checkAchievements(state, now);
    await client.query('UPDATE game_saves SET state=$1, updated_at=NOW() WHERE user_id=$2', [JSON.stringify(state), uid]);
    await client.query('COMMIT');
    return { error, payload: {
      ...GL.view(state, now),
      events: {
        reset,
        offlineEarnings: tickInfo.offline ? tickInfo.earned : 0,
        offlineSeconds: tickInfo.offline ? Math.round(tickInfo.gapMs/1000) : 0,
        leveledUp: tickInfo.leveledUp || null,
        order: tickInfo.orderEvent || null,
        newAchievements,
        result: result ?? null,
      },
    }};
  } catch(e){
    try { await client.query('ROLLBACK'); } catch(_){}
    throw e;
  } finally { client.release(); }
}
// Fehler einer Spielaktion (z. B. "Nicht genug Office Coins") gehen als 400
// an den Client; der Spielstand (Zeitfortschritt) ist trotzdem gespeichert.
function route(path, action){
  router.post('/game/'+path, auth, async (req, res) => {
    try {
      const { error, payload } = await withSave(req.uid, (s, now) => action(s, req.body||{}, now));
      if (error) return bad(res, error, 400);
      ok(res, payload);
    } catch(e){ bad(res, 'Serverfehler', 500); }
  });
}

router.get('/game/catalog', auth, (req, res) => ok(res, GL.CATALOG));
router.get('/game/state', auth, async (req, res) => {
  try { ok(res, (await withSave(req.uid, () => null)).payload); }
  catch(e){ bad(res, 'Serverfehler', 500); }
});

route('click',            (s, b, now) => GL.click(s, b.count, now));
route('buy-object',       (s, b)      => GL.buyObject(s, b.id));
route('sell-object',      (s, b, now) => GL.sellObject(s, b.index, now));
route('buy-policy',       (s, b)      => GL.buyPolicy(s, b.id));
route('buy-upgrade',      (s, b)      => GL.buyUpgrade(s, b.id));
route('hire',             (s, b, now) => GL.hire(s, b.classId, now));
route('fire',             (s, b)      => GL.fire(s, b.employeeId));
route('move',             (s)         => GL.moveStage(s));
route('teambuilding',     (s, b, now) => GL.startTeambuilding(s, now));
route('order/accept',     (s, b, now) => GL.acceptOrder(s, now));
route('order/decline',    (s, b, now) => GL.declineOrder(s, now));

module.exports = router;
