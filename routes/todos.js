'use strict';
const router = require('express').Router();
const { q, q1, newId } = require('../db');
const { auth, ok, bad } = require('../middleware');

// ── TODOS ─────────────────────────────────────────────────────────────────────

router.get('/todos', auth, async (req,res) => {
  try {
    const todos = await q('SELECT * FROM todos ORDER BY created_at DESC');
    const items = await q('SELECT * FROM todo_items ORDER BY sort_order, created_at');
    const assignees = await q('SELECT * FROM todo_item_assignees');
    const result = todos.map(t => ({
      ...t,
      items: items.filter(i => i.todo_id === t.id).map(i => ({
        ...i,
        assignees: assignees.filter(a => a.item_id === i.id),
      })),
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
    const old = await q1('SELECT * FROM todos WHERE id=$1',[req.params.id]);
    if (!old) return bad(res,'Nicht gefunden',404);
    const now = new Date().toISOString();
    const entry = {ts:now,by:req.uid,type:'updated',changes:{}};
    if(title!==undefined&&title!==old.title)entry.changes.title={from:old.title,to:title};
    if(description!==undefined&&description!==old.description)entry.changes.description={from:old.description,to:description};
    if(priority!==undefined&&priority!==old.priority)entry.changes.priority={from:old.priority,to:priority};
    if(dueDate!==undefined&&dueDate!==old.due_date)entry.changes.dueDate={from:old.due_date,to:dueDate};
    if(assignedTo!==undefined&&assignedTo!==old.assigned_to)entry.changes.assignedTo={from:old.assigned_to,to:assignedTo};
    if(status!==undefined&&status!==old.status)entry.changes.status={from:old.status,to:status};
    if(Object.keys(entry.changes).length>0){
      const protokoll = (()=>{try{return JSON.parse(old.protokoll||'[]');}catch{return [];}})();
      protokoll.push(entry);
      await q('UPDATE todos SET protokoll=$1 WHERE id=$2',[JSON.stringify(protokoll),req.params.id]);
    }
    const row = await q1(
      `UPDATE todos SET title=COALESCE($1,title), description=COALESCE($2,description),
       priority=COALESCE($3,priority), due_date=$4, assigned_to=$5,
       status=COALESCE($6,status), updated_at=NOW() WHERE id=$7 RETURNING *`,
      [title||null, description||null, priority||null, dueDate||null, assignedTo||null, status||null, req.params.id]
    );
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
    const itemId = newId();
    const row = await q1(
      `INSERT INTO todo_items (id,todo_id,title,comment,sort_order,created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [itemId, req.params.id, title.trim(), comment||'', sortOrder||0, req.uid]
    );
    // Auto-assign creator as default assignee
    await q1(
      `INSERT INTO todo_item_assignees (id,item_id,user_id,assigned_by) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
      [newId(), itemId, req.uid, req.uid]
    ).catch(()=>{});
    ok(res, {...row, assignees:[{item_id:itemId,user_id:req.uid,assigned_by:req.uid}]});
  } catch(e) { bad(res,'Serverfehler',500); }
});

router.put('/todos/:todoId/items/:id', auth, async (req,res) => {
  const {title, comment, isDone, sortOrder} = req.body;
  try {
    const todo = await q1('SELECT * FROM todos WHERE id=$1',[req.params.todoId]);
    if(!todo) return bad(res,'Todo nicht gefunden',404);
    const isAssignee = await q1('SELECT id FROM todo_item_assignees WHERE item_id=$1 AND user_id=$2',[req.params.id,req.uid]);
    if(!req.p.manageUsers && todo.created_by!==req.uid && !isAssignee) return bad(res,'Keine Berechtigung',403);
    const old = await q1('SELECT * FROM todo_items WHERE id=$1',[req.params.id]);
    if(!old) return bad(res,'Punkt nicht gefunden',404);
    const now = new Date().toISOString();
    const entry = {ts:now,by:req.uid,type:'updated',changes:{}};
    if(title!==undefined&&title!==old.title)entry.changes.title={from:old.title,to:title};
    if(comment!==undefined&&comment!==old.comment)entry.changes.comment={from:old.comment,to:comment};
    if(isDone!==undefined&&isDone!==old.is_done)entry.changes.isDone={from:old.is_done,to:isDone};
    if(sortOrder!==undefined&&sortOrder!==old.sort_order)entry.changes.sortOrder={from:old.sort_order,to:sortOrder};
    if(Object.keys(entry.changes).length>0){
      const protokoll = (()=>{try{return JSON.parse(todo.protokoll||'[]');}catch{return [];}})();
      protokoll.push(entry);
      await q('UPDATE todos SET protokoll=$1 WHERE id=$2',[JSON.stringify(protokoll),req.params.todoId]);
      // Notify todo creator if comment was added or item marked done
      if((comment!==undefined||isDone===true) && todo.created_by!==req.uid){
        const notifType = comment!==undefined?'comment':'completed';
        await q1(`INSERT INTO todo_item_notifications (id,item_id,user_id,notified_by,type) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,[newId(),req.params.id,todo.created_by,req.uid,notifType]).catch(()=>{});
      }
    }
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
    const todo2 = await q1('SELECT * FROM todos WHERE id=$1',[req.params.todoId]);
    if(todo2 && !req.p.manageUsers && todo2.created_by!==req.uid) return bad(res,'Keine Berechtigung',403);
    await q('DELETE FROM todo_items WHERE id=$1 AND todo_id=$2', [req.params.id, req.params.todoId]);
    ok(res);
  } catch(e) { bad(res,'Serverfehler',500); }
});

// ── TODO ITEM ASSIGNEES ───────────────────────────────────────────────────────

router.post('/todos/:todoId/items/:itemId/assignees', auth, async (req,res) => {
  const {userId} = req.body;
  if (!userId) return bad(res,'Benutzer erforderlich',400);
  try {
    const todo = await q1('SELECT * FROM todos WHERE id=$1',[req.params.todoId]);
    if(!todo) return bad(res,'Todo nicht gefunden',404);
    const now = new Date().toISOString();
    const entry = {ts:now,by:req.uid,type:'assignee_added',userId};
    const protokoll = (()=>{try{return JSON.parse(todo.protokoll||'[]');}catch{return [];}})();
    protokoll.push(entry);
    await q('UPDATE todos SET protokoll=$1 WHERE id=$2',[JSON.stringify(protokoll),req.params.todoId]);
    const row = await q1(
      `INSERT INTO todo_item_assignees (id,item_id,user_id,assigned_by)
       VALUES ($1,$2,$3,$4) ON CONFLICT (item_id, user_id) DO UPDATE SET assigned_at=NOW() RETURNING *`,
      [newId(), req.params.itemId, userId, req.uid]
    );
    ok(res, row);
  } catch(e) { bad(res,'Serverfehler',500); }
});

router.delete('/todos/:todoId/items/:itemId/assignees/:userId', auth, async (req,res) => {
  try {
    const todo = await q1('SELECT * FROM todos WHERE id=$1',[req.params.todoId]);
    if(!todo) return bad(res,'Todo nicht gefunden',404);
    const now = new Date().toISOString();
    const entry = {ts:now,by:req.uid,type:'assignee_removed',userId:req.params.userId};
    const protokoll = (()=>{try{return JSON.parse(todo.protokoll||'[]');}catch{return [];}})();
    protokoll.push(entry);
    await q('UPDATE todos SET protokoll=$1 WHERE id=$2',[JSON.stringify(protokoll),req.params.todoId]);
    await q('DELETE FROM todo_item_assignees WHERE item_id=$1 AND user_id=$2', [req.params.itemId, req.params.userId]);
    ok(res);
  } catch(e) { bad(res,'Serverfehler',500); }
});

// POST mark todo item notifications as read
router.post('/todos/:todoId/mark-read', auth, async (req,res) => {
  try {
    const todo = await q1('SELECT * FROM todos WHERE id=$1',[req.params.todoId]);
    if(!todo) return bad(res,'Todo nicht gefunden',404);
    const items = await q('SELECT id FROM todo_items WHERE todo_id=$1',[req.params.todoId]);
    for(const item of items){
      await q('UPDATE todo_item_notifications SET read_at=NOW() WHERE item_id=$1 AND user_id=$2 AND read_at IS NULL',[item.id,req.uid]);
    }
    ok(res);
  } catch(e) { bad(res,'Serverfehler',500); }
});

module.exports = router;
