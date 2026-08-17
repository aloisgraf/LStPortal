'use strict';
const router = require('express').Router();
const { q, q1, newId, pool, getUser } = require('../db');
const { auth, ok, bad } = require('../middleware');

const pairIds = (a,b) => a < b ? [a,b] : [b,a];

router.post('/chat/threads', auth, async (req,res) => {
  try {
    const { otherUserId } = req.body;
    if (!otherUserId || otherUserId === req.uid) return bad(res,'Ungültiger Chatpartner');
    const other = await getUser(otherUserId);
    if (!other) return bad(res,'Benutzer nicht gefunden',404);
    const [u1,u2] = pairIds(req.uid, otherUserId);
    let thread = await q1('SELECT * FROM chat_threads WHERE user1_id=$1 AND user2_id=$2',[u1,u2]);
    if (!thread) {
      const id = newId();
      await pool.query('INSERT INTO chat_threads (id,user1_id,user2_id) VALUES ($1,$2,$3)',[id,u1,u2]);
      thread = { id };
    }
    ok(res,{id:thread.id});
  } catch(e) { bad(res,'Serverfehler',500); }
});

async function assertThreadMember(req,res) {
  const thread = await q1('SELECT * FROM chat_threads WHERE id=$1',[req.params.id]);
  if (!thread) { bad(res,'Nicht gefunden',404); return null; }
  if (thread.user1_id!==req.uid && thread.user2_id!==req.uid) { bad(res,'Keine Berechtigung',403); return null; }
  return thread;
}

router.post('/chat/threads/:id/messages', auth, async (req,res) => {
  try {
    const thread = await assertThreadMember(req,res); if (!thread) return;
    const text = (req.body.text||'').trim();
    if (!text) return bad(res,'Text erforderlich');
    if (text.length > 4000) return bad(res,'Nachricht zu lang');
    const id = newId();
    await pool.query('INSERT INTO chat_messages (id,thread_id,sender_id,text) VALUES ($1,$2,$3,$4)',[id,thread.id,req.uid,text]);
    await pool.query(
      `INSERT INTO chat_reads (thread_id,user_id,last_read_at) VALUES ($1,$2,NOW())
       ON CONFLICT (thread_id,user_id) DO UPDATE SET last_read_at=NOW()`,[thread.id,req.uid]);
    ok(res,{id});
  } catch(e) { bad(res,'Serverfehler',500); }
});

router.put('/chat/threads/:id/read', auth, async (req,res) => {
  try {
    const thread = await assertThreadMember(req,res); if (!thread) return;
    await pool.query(
      `INSERT INTO chat_reads (thread_id,user_id,last_read_at) VALUES ($1,$2,NOW())
       ON CONFLICT (thread_id,user_id) DO UPDATE SET last_read_at=NOW()`,[thread.id,req.uid]);
    ok(res);
  } catch(e) { bad(res,'Serverfehler',500); }
});

module.exports = router;
