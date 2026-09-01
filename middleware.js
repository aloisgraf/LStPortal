'use strict';
const { getUser, getP, getTP } = require('./db');

let _rolePermsCache = null;
let _rolePermsCacheTime = 0;
async function getRolePerms() {
  if(_rolePermsCache && Date.now()-_rolePermsCacheTime < 300000) return _rolePermsCache;
  try {
    const { q } = require('./db');
    _rolePermsCache = await q('SELECT * FROM role_permissions');
    _rolePermsCacheTime = Date.now();
    return _rolePermsCache;
  } catch(e) { return []; }
}
// Wird nach jeder Änderung an role_permissions (POST/DELETE-Route) aufgerufen,
// damit neue Rechte sofort greifen statt erst nach bis zu 5 Minuten Cache.
function invalidateRolePermsCache() { _rolePermsCache = null; }

async function auth(req, res, next) {
  if (!req.session?.userId)
    return res.status(401).json({ success:false, error:'Nicht angemeldet' });
  try {
    const realUser = await getUser(req.session.userId);
    if (!realUser) { req.session.destroy(()=>{}); return res.status(401).json({ success:false, error:'Benutzer nicht gefunden' }); }
    const overrides = await getRolePerms();
    const realP = await getP(realUser.id, realUser, overrides);
    req.realUid = realUser.id;
    req.realUser = realUser;
    req.realIsAdmin = !!realP.manageUsers;

    // "Ansicht als": ein Admin kann testweise die komplette Sitzung (Lesen
    // UND Schreiben) aus Sicht eines dediziert als "Testuser" markierten
    // Kontos erleben, um Sichtbarkeiten/Rechte zu prüfen — echte Mitarbeiter-
    // konten sind als Ziel ausgeschlossen. req.realUid/-User/-IsAdmin bleiben
    // dabei immer die tatsächliche Person, für die Steuerung der Funktion
    // selbst (Start/Stop) und die Banner-Anzeige im Frontend.
    let effUser = realUser, effP = realP;
    if (req.session.viewAsUserId && req.realIsAdmin) {
      const target = await getUser(req.session.viewAsUserId);
      if (target && target.is_test_user) {
        effUser = target;
        effP = await getP(target.id, target, overrides);
      } else {
        delete req.session.viewAsUserId;
      }
    }
    req.uid  = effUser.id;
    req.user = effUser;
    req.p    = effP;
    req.tp   = await getTP(effUser.id, effUser);
    req.clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || '';
    require('./db').pool.query('UPDATE users SET last_seen=NOW() WHERE id=$1',[effUser.id]).catch(()=>{});
    next();
  } catch(e) {
    console.error('[auth]', e.message);
    res.status(500).json({ success:false, error:'Serverfehler' });
  }
}

const adminOnly = (req,res,next) => req.p?.manageUsers ? next() : res.status(403).json({success:false,error:'Keine Berechtigung'});
const ok  = (res, data) => res.json({ success:true, data: data??null });
const bad = (res, msg, code=400) => res.status(code).json({ success:false, error:msg });

module.exports = { auth, adminOnly, ok, bad, invalidateRolePermsCache };
