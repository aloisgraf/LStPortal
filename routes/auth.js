'use strict';
const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const { q, getUser, getUserByUsername, parseRoles, pool, logAct } = require('../db');
const { auth, ok, bad } = require('../middleware');

async function logActivity(pool, uid, name, action, details={}, ip='') {
  const {newId} = require('../db');
  await pool.query(
    'INSERT INTO activity_log (id,user_id,user_name,action,details,ip,created_at) VALUES ($1,$2,$3,$4,$5,$6,NOW())',
    [newId(), uid, name, action, JSON.stringify(details), ip]
  ).catch(()=>{});
}

router.post('/login', async (req,res) => {
  try {
    const {username,password} = req.body;
    if (!username || !password || typeof username!=='string' || typeof password!=='string')
      return bad(res,'Benutzername und Passwort erforderlich');
    if (username.length > 200 || password.length > 200)
      return bad(res,'Ungültige Eingabe',400);
    const user = await getUserByUsername(username.trim());
    // Always run bcrypt to prevent timing attacks
    const hash = user?.pw_hash || '$2a$10$invalidhashpaddingtopreventimenumerabilityx';
    const valid = await bcrypt.compare(password, hash);
    if (!user || !valid) return bad(res,'Benutzername oder Passwort falsch',401);
    req.session.userId = user.id;
    await new Promise((resolve, reject) => req.session.save(e => e ? reject(e) : resolve()));
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || '';
    await logAct(user.id, user.name, 'login', {ip});
    ok(res, {userId:user.id, mustChangePW: user.must_change_pw===true});
  } catch(e) { bad(res,'Serverfehler',500); }
});
router.post('/logout', (req,res) => req.session.destroy(()=>ok(res)));
router.get('/me', auth, (req,res) => ok(res, {userId:req.uid, mustChangePW:req.user.must_change_pw===true}));
router.post('/change-password', auth, async (req,res) => {
  try {
    const {currentPassword,newPassword} = req.body;
    if (!req.user.must_change_pw && !(await bcrypt.compare(currentPassword||'',req.user.pw_hash)))
      return bad(res,'Aktuelles Passwort falsch');
    if (!newPassword || newPassword.length < 8) return bad(res,'Mindestens 8 Zeichen');
    await pool.query('UPDATE users SET pw_hash=$1,must_change_pw=false WHERE id=$2',
      [await bcrypt.hash(newPassword,10), req.uid]);
    ok(res);
  } catch(e) { bad(res,'Serverfehler',500); }
});

module.exports = router;
