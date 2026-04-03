'use strict';
const router = require('express').Router();
const { q, q1, parseRoles, parseTags, canSeeTk, canEditTk, canSeeMsg, pool } = require('../db');
const { auth, ok, bad } = require('../middleware');

// DATA
router.get('/', auth, async (req,res) => {
  try {
    const uid=req.uid, p=req.p, tp=req.tp, roles=p.roles;
    const [usersRaw,cats,tagsRaw,evRaw,evConfirmsRaw,tkRaw,notesRaw,allwRaw,clTmpls,clItems,
           tkClRaw,tkClItemsRaw,msgsRaw,readsRaw,notifsRaw,einspRaw,hoRaw,dpRaw,tkViewsRaw] = await Promise.all([
      q('SELECT id,name,initials,roles,color,must_change_pw,last_seen FROM users ORDER BY name'),
      q('SELECT * FROM categories ORDER BY sort_order,label'),
      q('SELECT * FROM tags ORDER BY label'),
      p.canApproveEvents
        ? q('SELECT * FROM events ORDER BY date_from')
        : q('SELECT * FROM events WHERE is_general=true OR user_id=$1 OR created_by=$1 ORDER BY date_from',[uid]),
      q('SELECT event_id FROM event_confirms WHERE user_id=$1',[uid]),
      q('SELECT * FROM tickets ORDER BY created_at DESC'),
      q('SELECT * FROM ticket_notes ORDER BY created_at'),
      p.seeAllAllw ? q('SELECT * FROM allowances') : q('SELECT * FROM allowances WHERE user_id=$1',[uid]),
      q('SELECT * FROM checklist_templates ORDER BY name'),
      q('SELECT * FROM checklist_template_items ORDER BY sort_order'),
      q('SELECT * FROM ticket_checklists'),
      q('SELECT ticket_id, viewed_at FROM ticket_views WHERE user_id=$1',[uid]),
      q('SELECT * FROM ticket_checklist_items ORDER BY sort_order'),
      q('SELECT * FROM messages ORDER BY created_at DESC').catch(()=>[]),
      q('SELECT message_id, pinned, read_at FROM message_reads WHERE user_id=$1',[uid]),
      q('SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50',[uid]),
      p.seeAllAbrechnung ? q('SELECT * FROM abrechnung_einspringer ORDER BY edate DESC')
        : q('SELECT * FROM abrechnung_einspringer WHERE user_id=$1 ORDER BY edate DESC',[uid]),
      p.seeAllAbrechnung ? q('SELECT * FROM abrechnung_homeoffice ORDER BY year DESC,month DESC')
        : q('SELECT * FROM abrechnung_homeoffice WHERE user_id=$1 ORDER BY year DESC,month DESC',[uid]),
      q('SELECT id,month,year,label,version,filename,is_archived,archived_at,created_by,created_at FROM dienstplaene ORDER BY year DESC,month DESC,version DESC'),
    ]);

    const tkViewMap = new Map((tkViewsRaw||[]).map(v=>[v.ticket_id, v.viewed_at]));
    const noteMap={}, clItemMap={}, tkClItemMap={}, tkClMap={};
    notesRaw.forEach(n=>{ if(!noteMap[n.ticket_id]) noteMap[n.ticket_id]=[]; noteMap[n.ticket_id].push({id:n.id,text:n.text,authorId:n.author_id,noteType:n.note_type,createdAt:n.created_at}); });
    clItems.forEach(i=>{ if(!clItemMap[i.template_id]) clItemMap[i.template_id]=[]; clItemMap[i.template_id].push({id:i.id,text:i.text,itemType:i.item_type||'check',sortOrder:i.sort_order}); });
    tkClItemsRaw.forEach(i=>{ if(!tkClItemMap[i.checklist_id]) tkClItemMap[i.checklist_id]=[]; tkClItemMap[i.checklist_id].push({id:i.id,text:i.text,itemType:i.item_type||'check',sortOrder:i.sort_order,completedBy:i.completed_by,completedAt:i.completed_at,userNote:i.user_note||''}); });
    tkClRaw.forEach(c=>{ if(!tkClMap[c.ticket_id]) tkClMap[c.ticket_id]=[]; tkClMap[c.ticket_id].push({id:c.id,templateId:c.template_id,name:c.name,createdBy:c.created_by,items:tkClItemMap[c.id]||[]}); });

    const fiveMinAgo = new Date(Date.now() - 5*60*1000);
    const readIds = new Set(readsRaw.map(r=>r.message_id));
    const confirmedEventIds = new Set(evConfirmsRaw.map(r=>r.event_id));

    ok(res, {
      currentUser: uid,
      permissions: {
        canApproveEvents:p.canApproveEvents, canSendMessages:p.canSendMessages,
        seeAllEntries:true, editAllPersonal:p.editAllPersonal,
        addForOthers:p.addForOthers, addGeneral:p.addGeneral,
        manageUsers:p.manageUsers, seeAllAllw:p.seeAllAllw, editAllw:p.editAllw,
        seeAllAbrechnung:p.seeAllAbrechnung,
        myDepts:tp.myDepts, seeAllTickets:tp.seeAll,
        canSetPublic:tp.canSetPublic, canAssign:tp.canAssign,
      },
      users: usersRaw.map(u=>({
        id:u.id, name:u.name, initials:u.initials, roles:parseRoles(u.roles),
        color:u.color, mustChangePW:u.must_change_pw,
        isOnline: !!(u.last_seen && new Date(u.last_seen) > fiveMinAgo),
      })),
      categories: cats,
      tags: tagsRaw,
      events: evRaw.map(ev=>{
        const concernsMe = !ev.is_general && ev.user_id === uid;
        const createdByMe = ev.created_by === uid;
        // Dienstplanung/Admin sehen alles klar; alle anderen nur eigene
        const anonymize = !p.canApproveEvents && !ev.is_general && ev.user_id !== uid && !createdByMe;
        const confirmed = ev.is_general || createdByMe || confirmedEventIds.has(ev.id);
        return {
          id:ev.id, isGeneral:ev.is_general, dateFrom:ev.date_from, dateTo:ev.date_to,
          timeFrom:ev.time_from||'', timeTo:ev.time_to||'',
          userId: anonymize ? null : ev.user_id,
          category:ev.category, reason: anonymize ? null : ev.reason,
          approvalStatus:ev.approval_status,
          createdBy: anonymize ? null : ev.created_by, createdAt:ev.created_at,
          _anonymized: anonymize,
          _concernsMe: concernsMe,
          _confirmed: confirmed,
          _isNew: concernsMe && !createdByMe && !confirmedEventIds.has(ev.id),
          _canEdit: !ev.is_general && createdByMe && !ev.approval_status,
        };
      }),
      tickets: tkRaw.filter(tk=>canSeeTk(tp,tk,uid)).map(tk=>({
        id:tk.id, number:tk.number, title:tk.title, description:tk.description||'',
        department:tk.department, tags:parseTags(tk.tags), priority:tk.priority,
        status:tk.status, bucket:tk.bucket||'', isPublic:tk.is_public,
        assigneeId:tk.assignee_id, parentTicketId:tk.parent_ticket_id,
        createdBy:tk.created_by, createdAt:tk.created_at, updatedAt:tk.updated_at,lastViewedAt:tkViewMap.get(tk.id)||null,
        notes:noteMap[tk.id]||[], checklists:tkClMap[tk.id]||[],
        _canEdit:canEditTk(tp,tk,uid),
      })),
      allowances: allwRaw.map(a=>({id:a.id,userId:a.user_id,year:a.year,month:a.month,nd:a.nd,fd:a.fd,fw:a.fw,c10:a.c10})),
      checklists: clTmpls.map(t=>({id:t.id,name:t.name,department:t.department,createdBy:t.created_by,items:clItemMap[t.id]||[]})),
      messages: msgsRaw.filter(m=>canSeeMsg(m,uid,roles)).map(m=>({
        id:m.id,title:m.title,body:m.body,senderId:m.sender_id,
        targetType:m.target_type,targetValue:m.target_value,
        createdAt:m.created_at, isRead:readIds.has(m.id),
      })),
      notifications: notifsRaw.map(n=>({
        id:n.id, type:n.type, title:n.title, ticketId:n.ticket_id,
        noteId:n.note_id, eventId:n.event_id, createdBy:n.created_by, createdAt:n.created_at,
        isRead:!!n.read_at,
      })),
      abrechnung: {
        einspringer: einspRaw.map(e=>({id:e.id,userId:e.user_id,date:e.edate,note:e.note||'',rejectedBy:e.rejected_by,rejectedReason:e.rejected_reason,rejectedAt:e.rejected_at,createdAt:e.created_at})),
        homeoffice:  hoRaw.map(h=>({id:h.id,userId:h.user_id,year:h.year,month:h.month,days:h.days})),
      },
      dienstplaene: dpRaw.map(d=>({id:d.id,month:d.month,year:d.year,label:d.label,version:d.version,filename:d.filename,isArchived:d.is_archived,archivedAt:d.archived_at,createdBy:d.created_by,createdAt:d.created_at})),
    });
  } catch(e) { console.error(e); bad(res,e.message,500); }
});

// EVENTS
module.exports = router;
