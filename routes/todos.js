'use strict';
const router = require('express').Router();
const { q, q1, newId } = require('../db');
const { auth, ok, bad } = require('../middleware');

// ── TODOS ─────────────────────────────────────────────────────────────────────

router.get('/todos', auth, async (req,res) => {
  try {
    const todos = await q('SELECT * FROM todos ORDER BY created_at DESC');
    const items = await q('SELECT * FROM todo_items ORDER BY sort_order, created_at');
    const result = todos.map(t => ({
      ...t,
      items: items.filter(i => i.todo_id === t.id),
    }));
    ok(res, result);
  } catch(e) { bad(res,'Serverfehler',500); }
});

router.post('/todos', auth, async (req,res) => {
  const {title, description, priority, dueDate, assignedTo} = req.body;
  if (!title?.trim()) return bad(res,'Titel erforderlich',400);
  try {
    const row = await q1(
      `INSERT INTO todos (id,title,description,priority,due_date,assigned_to,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [newId(), title.trim(), description||'', priority||'medium', dueDate||null, assignedTo||null, req.uid]
    );
    ok(res, {...row, items:[]});
  } catch(e) { bad(res,'Serverfehler',500); }
});

router.put('/todos/:id', auth, async (req,res) => {
  const {title, description, priority, dueDate, assignedTo, status} = req.body;
  try {
    const row = await q1(
      `UPDATE todos SET title=COALESCE($1,title), description=COALESCE($2,description),
       priority=COALESCE($3,priority), due_date=$4, assigned_to=$5,
       status=COALESCE($6,status), updated_at=NOW() WHERE id=$7 RETURNING *`,
      [title||null, description||null, priority||null, dueDate||null, assignedTo||null, status||null, req.params.id]
    );
    if (!row) return bad(res,'Nicht gefunden',404);
    ok(res, row);
  } catch(e) { bad(res,'Serverfehler',500); }
});

router.delete('/todos/:id', auth, async (req,res) => {
  try {
    await q('DELETE FROM todos WHERE id=$1', [req.params.id]);
    ok(res);
  } catch(e) { bad(res,'Serverfehler',500); }
});

// ── TODO ITEMS ────────────────────────────────────────────────────────────────

router.post('/todos/:id/items', auth, async (req,res) => {
  const {title, comment, sortOrder} = req.body;
  if (!title?.trim()) return bad(res,'Titel erforderlich',400);
  try {
    const row = await q1(
      `INSERT INTO todo_items (id,todo_id,title,comment,sort_order,created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [newId(), req.params.id, title.trim(), comment||'', sortOrder||0, req.uid]
    );
    ok(res, row);
  } catch(e) { bad(res,'Serverfehler',500); }
});

router.put('/todos/:todoId/items/:id', auth, async (req,res) => {
  const {title, comment, isDone, sortOrder} = req.body;
  try {
    const doneAt = isDone === true ? 'NOW()' : 'NULL';
    const doneBy = isDone === true ? req.uid : null;
    const row = await q1(
      `UPDATE todo_items SET
        title=COALESCE($1,title),
        comment=COALESCE($2,comment),
        is_done=COALESCE($3,is_done),
        done_by=CASE WHEN $3 IS NOT NULL THEN $4 ELSE done_by END,
        done_at=CASE WHEN $3=true THEN NOW() WHEN $3=false THEN NULL ELSE done_at END,
        sort_order=COALESCE($5,sort_order)
       WHERE id=$6 AND todo_id=$7 RETURNING *`,
      [title||null, comment!==undefined?comment:null, isDone!==undefined?isDone:null, doneBy, sortOrder||null, req.params.id, req.params.todoId]
    );
    if (!row) return bad(res,'Nicht gefunden',404);
    // Update parent todo updated_at
    await q('UPDATE todos SET updated_at=NOW() WHERE id=$1', [req.params.todoId]).catch(()=>{});
    ok(res, row);
  } catch(e) { bad(res,'Serverfehler',500); }
});

router.delete('/todos/:todoId/items/:id', auth, async (req,res) => {
  try {
    await q('DELETE FROM todo_items WHERE id=$1 AND todo_id=$2', [req.params.id, req.params.todoId]);
    ok(res);
  } catch(e) { bad(res,'Serverfehler',500); }
});

module.exports = router;
