'use strict';
const { getUser, getP, getTP } = require('./db');

async function auth(req, res, next) {
  if (!req.session?.userId)
    return res.status(401).json({ success: false, error: 'Nicht angemeldet' });

  try {
    const user = await getUser(req.session.userId);
    if (!user) {
      req.session.destroy(() => {});
      return res.status(401).json({ success: false, error: 'Benutzer nicht gefunden' });
    }
    req.uid  = user.id;
    req.user = user;
    req.p    = await getP(user.id);
    req.tp   = await getTP(user.id);
    // req.ip is a read-only getter in Express – use req.clientIp for logging
    req.clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || '';
    // Update last_seen (non-blocking, errors ignored)
    require('./db').pool.query('UPDATE users SET last_seen=NOW() WHERE id=$1', [user.id]).catch(() => {});
    next();
  } catch (err) {
    console.error('[AUTH ERROR]', err.message);
    return res.status(500).json({ success: false, error: 'Serverfehler bei der Authentifizierung' });
  }
}

const adminOnly = (req, res, next) =>
  req.p?.manageUsers ? next() : res.status(403).json({ success: false, error: 'Keine Berechtigung' });

const dpOnly = (req, res, next) =>
  req.p?.canApproveEvents ? next() : res.status(403).json({ success: false, error: 'Keine Berechtigung' });

const ok  = (res, data) => res.json({ success: true, data: data ?? null });
const bad = (res, msg, code = 400) => res.status(code).json({ success: false, error: msg });

module.exports = { auth, adminOnly, dpOnly, ok, bad };
