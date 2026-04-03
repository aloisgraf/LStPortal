'use strict';
const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const { q, getUser, parseRoles, pool } = require('../db');
const { auth, ok, bad } = require('../middleware');

router.get('/api/auth/users', async (req,res) => {
  try {
    const users = await q('SELECT id,name,initials,color,roles FROM users ORDER BY name');
    console.log('[auth/users] Benutzer gefunden:', users.length);
    ok(res, users.map(u=>({id:u.id,name:u.name,initials:u.initials,color:u.color,roles:parseRoles(u.roles)})));
  } catch(e) {
    console.error('[auth/users] Fehler:', e.message);
    bad(res,e.message,500);
  }
});
router.post('/api/auth/login', async (req,res) => {
  try {
    const {userId,password} = req.body;
    if (!userId||!password) return bad(res,'Benutzername und Passwort erforderlich');
    const user = await getUser(userId);
    if (!user||!(await bcrypt.compare(password,user.pw_hash))) return bad(res,'Falsches Passwort',401);
    req.session.userId = user.id;
    await new Promise((resolve, reject) => req.session.save(e => e ? reject(e) : resolve()));
    ok(res, {userId:user.id, mustChangePW: user.must_change_pw===true});
  } catch(e) { bad(res,e.message,500); }
});
router.post('/api/auth/logout', (req,res) => req.session.destroy(()=>ok(res)));
router.get('/api/auth/me', auth, (req,res) => ok(res, {userId:req.uid, mustChangePW:req.user.must_change_pw===true}));
router.post('/api/auth/change-password', auth, async (req,res) => {
  try {
    const {currentPassword,newPassword} = req.body;
    if (!req.user.must_change_pw && !(await bcrypt.compare(currentPassword||'',req.user.pw_hash)))
      return bad(res,'Aktuelles Passwort falsch');
    if (!newPassword||newPassword.length<6) return bad(res,'Mindestens 6 Zeichen');
    await pool.query('UPDATE users SET pw_hash=$1,must_change_pw=false WHERE id=$2',
      [await bcrypt.hash(newPassword,10), req.uid]);
    ok(res);
  } catch(e) { bad(res,e.message,500); }
});

module.exports = router;
