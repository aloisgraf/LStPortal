'use strict';
const router = require('express').Router();
const { q, newId, pool } = require('../db');
const { auth, ok, bad } = require('../middleware');

// VAPID-Schlüsselpaar: einmalig generiert, gehört in die .env des Servers
// (NICHT ins Repo). Ohne konfigurierte Schlüssel bleibt Push einfach
// deaktiviert — kein Fehler, die App funktioniert unverändert weiter.
// .trim() schützt gegen den mit Abstand häufigsten Fehler: eine
// Zeilenumbruch/Leerzeichen-Verunreinigung beim Reinkopieren des Schlüssels
// in die .env — das würde sonst zu "Vapid private key should be 32 bytes
// long when decoded" führen, obwohl der Schlüssel an sich korrekt ist.
// Manche Hosting-Panels/Docker-Env-Dateien entfernen umschließende
// Anführungszeichen NICHT (anders als dotenv) — daher zusätzlich strippen.
const _cleanVapid = v => v?.trim().replace(/^['"]|['"]$/g,'');
const VAPID_PUBLIC = _cleanVapid(process.env.VAPID_PUBLIC_KEY);
const VAPID_PRIVATE = _cleanVapid(process.env.VAPID_PRIVATE_KEY);
let webpush = null;
if (VAPID_PUBLIC && VAPID_PRIVATE) {
  try {
    webpush = require('web-push');
  } catch(e) { console.error('[push] web-push nicht installiert — npm install ausführen:', e.message); }
  if (webpush) {
    try {
      webpush.setVapidDetails('mailto:admin@lstportal.local', VAPID_PUBLIC, VAPID_PRIVATE);
    } catch(e) {
      // Byte-Längen mitloggen (nicht die Keys selbst) — public muss 65,
      // private muss 32 Bytes ergeben. So lässt sich ohne den Wert
      // preiszugeben sehen, ob z.B. ein Zeichen beim Kopieren verloren ging.
      let pubLen = '?', privLen = '?';
      try { pubLen = Buffer.from(VAPID_PUBLIC, 'base64url').length; } catch(e2) {}
      try { privLen = Buffer.from(VAPID_PRIVATE, 'base64url').length; } catch(e2) {}
      console.error(`[push] VAPID-Keys ungültig (public=${pubLen} Bytes, sollte 65 sein; private=${privLen} Bytes, sollte 32 sein). Länge der .env-Strings: public=${VAPID_PUBLIC.length} (sollte 87), private=${VAPID_PRIVATE.length} (sollte 43). Bitte exakt neu kopieren.`, e.message);
      webpush = null;
    }
  }
}

router.get('/push/vapid-public-key', auth, (req,res) => {
  if (!VAPID_PUBLIC) return bad(res,'Push nicht konfiguriert',503);
  ok(res, { publicKey: VAPID_PUBLIC });
});

router.post('/push/subscribe', auth, async (req,res) => {
  try {
    const { endpoint, keys } = req.body || {};
    if (!endpoint || !keys?.p256dh || !keys?.auth) return bad(res,'Ungültiges Abonnement');
    await pool.query(
      `INSERT INTO push_subscriptions (id,user_id,endpoint,p256dh,auth) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (endpoint) DO UPDATE SET user_id=$2,p256dh=$4,auth=$5`,
      [newId(), req.uid, endpoint, keys.p256dh, keys.auth]);
    ok(res);
  } catch(e) { bad(res,'Serverfehler',500); }
});

router.post('/push/unsubscribe', auth, async (req,res) => {
  try {
    const { endpoint } = req.body || {};
    if (endpoint) await pool.query('DELETE FROM push_subscriptions WHERE endpoint=$1 AND user_id=$2',[endpoint, req.uid]);
    ok(res);
  } catch(e) { bad(res,'Serverfehler',500); }
});

// Von anderen Routen (z.B. routes/chat.js) aufgerufen, um eine Push-
// Benachrichtigung an alle Geräte eines Nutzers zu schicken. Tote
// Subscriptions (Nutzer hat die App deinstalliert o.ä.) räumt sich dabei
// selbst auf — der Push-Dienst antwortet in dem Fall mit 404/410.
async function sendPushToUser(userId, payload) {
  if (!webpush) return;
  try {
    const subs = await q('SELECT * FROM push_subscriptions WHERE user_id=$1',[userId]);
    for (const s of subs) {
      const sub = { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } };
      webpush.sendNotification(sub, JSON.stringify(payload)).catch(async err => {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await pool.query('DELETE FROM push_subscriptions WHERE endpoint=$1',[s.endpoint]).catch(()=>{});
        }
      });
    }
  } catch(e) {}
}

module.exports = { router, sendPushToUser };
