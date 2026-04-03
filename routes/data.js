'use strict';
const router = require('express').Router();
const { q, parseRoles, parseTags, canSeeTk, canEditTk } = require('../db');
const { auth, ok, bad } = require('../middleware');

router.get('/', auth, async (req, res) => {
  try {
    const { uid, p, tp } = req;
    const roles = parseRoles(req.user.roles);

    const [usersRaw, cats, tagsRaw, evRaw, tkRaw, notesRaw, allwRaw,
           msgsRaw, acksRaw, clTplRaw, clItemsRaw, clTkRaw, clTkItemsRaw] = await Promise.all([
      q('SELECT id,name,initials,roles,color,must_change_pw FROM users ORDER BY name'),
      q('SELECT * FROM categories ORDER BY sort_order,label'),
      q('SELECT * FROM tags ORDER BY label'),
      p.seeAllEntries
        ? q('SELECT * FROM events ORDER BY date_from')
        : q('SELECT * FROM events WHERE is_general=true OR user_id=$1 OR created_by=$1 ORDER BY date_from', [uid]),
      q('SELECT * FROM tickets ORDER BY created_at DESC'),
      q('SELECT * FROM ticket_notes ORDER BY created_at'),
      p.seeAllAllw ? q('SELECT * FROM allowances') : q('SELECT * FROM allowances WHERE user_id=$1', [uid]),
      q(`SELECT m.* FROM messages m WHERE m.to_department IS NULL OR m.to_department=ANY($1::text[]) OR m.from_user_id=$2 ORDER BY m.created_at DESC LIMIT 200`, [roles, uid]),
      q('SELECT * FROM message_acks WHERE user_id=$1', [uid]),
      q('SELECT * FROM checklist_templates ORDER BY name'),
      q('SELECT * FROM checklist_template_items ORDER BY template_id,sort_order'),
      q('SELECT * FROM ticket_checklists ORDER BY created_at'),
      q('SELECT * FROM ticket_checklist_items ORDER BY checklist_id,sort_order'),
    ]);

    // Note map
    const noteMap = {};
    notesRaw.forEach(n => (noteMap[n.ticket_id] = noteMap[n.ticket_id] || []).push({
      id: n.id, text: n.text, authorId: n.author_id, isSystem: n.is_system, createdAt: n.created_at,
    }));

    const ackedSet = new Set(acksRaw.map(a => a.message_id));

    // Events with anonymization logic
    const events = evRaw.map(ev => {
      if (ev.is_general) return {
        id: ev.id, isGeneral: true, dateFrom: ev.date_from, dateTo: ev.date_to,
        timeFrom: ev.time_from || '', timeTo: ev.time_to || '',
        category: ev.category, reason: ev.reason, approved: 'approved',
        createdBy: ev.created_by, createdAt: ev.created_at,
        _anon: false, _blurred: false, _canEdit: false, _canApprove: false,
      };
      const isOwn = ev.user_id === uid || ev.created_by === uid;
      const canSeeAll = p.canApproveEvents || isOwn;
      if (ev.approved === 'rejected' && !canSeeAll) return null;
      const anon = !canSeeAll && ev.approved !== 'approved';
      return {
        id: ev.id, isGeneral: false, dateFrom: ev.date_from, dateTo: ev.date_to,
        timeFrom: ev.time_from || '', timeTo: ev.time_to || '',
        userId: ev.user_id, category: anon ? null : ev.category,
        reason: anon ? '(Termin ausstehend)' : ev.reason,
        approved: ev.approved || 'pending', createdBy: ev.created_by, createdAt: ev.created_at,
        _anon: anon, _blurred: !anon && p.othersBlurred && !isOwn,
        _canEdit: isOwn, _canApprove: p.canApproveEvents,
      };
    }).filter(Boolean);

    // Checklists per ticket
    const clItemsByList = {};
    clTkItemsRaw.forEach(i => (clItemsByList[i.checklist_id] = clItemsByList[i.checklist_id] || []).push({
      id: i.id, text: i.text, checked: i.checked, checkedBy: i.checked_by, checkedAt: i.checked_at, sortOrder: i.sort_order,
    }));
    const clByTicket = {};
    clTkRaw.forEach(cl => (clByTicket[cl.ticket_id] = clByTicket[cl.ticket_id] || []).push({
      id: cl.id, templateId: cl.template_id, name: cl.name, createdBy: cl.created_by,
      items: clItemsByList[cl.id] || [],
    }));

    const tickets = tkRaw.filter(tk => canSeeTk(tp, tk, uid)).map(tk => ({
      id: tk.id, number: tk.number, title: tk.title, description: tk.description || '',
      department: tk.department, tags: parseTags(tk.tags), priority: tk.priority,
      status: tk.status, bucket: tk.bucket || '', isPublic: tk.is_public,
      assigneeId: tk.assignee_id, parentTicketId: tk.parent_ticket_id,
      createdBy: tk.created_by, createdAt: tk.created_at, updatedAt: tk.updated_at,
      notes: noteMap[tk.id] || [], checklists: clByTicket[tk.id] || [],
      _canEdit: canEditTk(tp, tk, uid),
    }));

    const clTemplates = clTplRaw
      .filter(t => p.isAdmin || roles.includes(t.department) || tp.myDepts.includes(t.department))
      .map(t => ({
        id: t.id, name: t.name, department: t.department, createdBy: t.created_by,
        items: clItemsRaw.filter(i => i.template_id === t.id)
          .map(i => ({ id: i.id, text: i.text, sortOrder: i.sort_order })),
      }));

    const messages = msgsRaw.map(m => ({
      id: m.id, fromUserId: m.from_user_id, toDepartment: m.to_department,
      title: m.title, body: m.body, createdAt: m.created_at,
      acked: ackedSet.has(m.id), isMine: m.from_user_id === uid,
    }));

    ok(res, {
      users: usersRaw.map(u => ({ id: u.id, name: u.name, initials: u.initials, roles: parseRoles(u.roles), color: u.color, mustChangePW: u.must_change_pw })),
      categories: cats, tags: tagsRaw, events, tickets,
      allowances: allwRaw.map(a => ({ id: a.id, userId: a.user_id, year: a.year, month: a.month, nd: a.nd, fd: a.fd, fw: a.fw, c10: a.c10 })),
      messages, clTemplates, currentUser: uid,
      permissions: { isDP: p.isDP, isAdmin: p.isAdmin, canApproveEvents: p.canApproveEvents, isStandard: tp.isStandard, myDepts: tp.myDepts, roles: p.roles, seeAllEntries: p.seeAllEntries, seeAllAllw: p.seeAllAllw, editAllw: p.editAllw, addGeneral: p.addGeneral, addForOthers: p.addForOthers, manageGeneral: p.manageGeneral, editAllPersonal: p.editAllPersonal, canSetPublic: tp.canSetPublic },
    });
  } catch (e) { console.error(e); bad(res, e.message, 500); }
});

router.get('/active-users', auth, async (req, res) => {
  try {
    ok(res, await q(`SELECT id,name,initials,color FROM users WHERE last_seen > NOW() - INTERVAL '10 minutes'`));
  } catch (e) { bad(res, e.message, 500); }
});

module.exports = router;
