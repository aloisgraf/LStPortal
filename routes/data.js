'use strict';
const router = require('express').Router();
const { q, q1, parseRoles, parseTags, canSeeTk, canEditTk, canSeeMsg, pool } = require('../db');
const { auth, ok, bad } = require('../middleware');

// DATA
router.get('/', auth, async (req,res) => {
  try {
    const uid=req.uid, p=req.p, tp=req.tp, roles=p.roles;
    const [usersRaw,cats,tagsRaw,evRaw,evConfirmsRaw,tkRaw,notesRaw,allwRaw,clTmpls,clItems,
           tkClRaw,tkClItemsRaw,msgsRaw,readsRaw,notifsRaw,einspRaw,hoRaw,dpRaw,tkViewsRaw,dtRaw,dtReadsRaw,hoSlotsRaw,hoConfigRaw,hoBoxesRaw,hoDiensteRaw,vacCfgRaw,tkSubcatsRaw,noteTmplsRaw,stShiftsRaw,stSessionsRaw,tkFilesRaw,docCatsRaw,docsRaw,linksRaw,stOutagesRaw,rolePermsRaw,meetingsRaw,instancesRaw,itemsRaw,partRaw,dpShiftTypesRaw,dpAbsenceTypesRaw,dpPlansRaw] = await Promise.all([
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
      q('SELECT * FROM ticket_checklist_items ORDER BY sort_order'),
      q('SELECT * FROM messages ORDER BY created_at DESC').catch(()=>[]),
      q('SELECT message_id, pinned, read_at FROM message_reads WHERE user_id=$1',[uid]),
      q('SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50',[uid]),
      p.seeAllAbrechnung ? q('SELECT * FROM abrechnung_einspringer ORDER BY edate DESC')
        : q('SELECT * FROM abrechnung_einspringer WHERE user_id=$1 ORDER BY edate DESC',[uid]),
      p.seeAllAbrechnung ? q('SELECT * FROM abrechnung_homeoffice ORDER BY year DESC,month DESC')
        : q('SELECT * FROM abrechnung_homeoffice WHERE user_id=$1 ORDER BY year DESC,month DESC',[uid]),
      q('SELECT id,month,year,label,version,filename,is_archived,archived_at,created_by,created_at FROM dienstplaene ORDER BY year DESC,month DESC,version DESC'),
      q('SELECT ticket_id, viewed_at FROM ticket_views WHERE user_id=$1',[uid]).catch(()=>[]),
      q('SELECT * FROM diensttausch ORDER BY created_at DESC LIMIT 100').catch(()=>[]),
      q('SELECT diensttausch_id FROM diensttausch_reads WHERE user_id=$1',[uid]).catch(()=>[]),
      q('SELECT * FROM homeoffice_slots ORDER BY date').catch(()=>[]),
      q('SELECT * FROM homeoffice_config ORDER BY date').catch(()=>[]),
      q('SELECT * FROM homeoffice_boxes ORDER BY sort_order,label').catch(()=>[]),
      q('SELECT * FROM homeoffice_dienste ORDER BY sort_order,label').catch(()=>[]),
      q('SELECT * FROM vacation_config ORDER BY date').catch(()=>[]),
      q('SELECT * FROM ticket_subcategories ORDER BY department,sort_order,label').catch(()=>[]),
      q('SELECT * FROM note_templates ORDER BY sort_order,label').catch(()=>[]),
      q('SELECT * FROM station_shifts ORDER BY sort_order,label').catch(()=>[]),
      q('SELECT * FROM station_sessions ORDER BY logged_in_at').catch(()=>[]),
      q('SELECT id,ticket_id,original_name,mime_type,size_bytes,uploaded_by,created_at FROM ticket_files ORDER BY created_at DESC').catch(()=>[]),
      q('SELECT * FROM doc_categories ORDER BY sort_order,name').catch(()=>[]),
      q('SELECT id,category_id,title,description,original_name,mime_type,size_bytes,current_version,uploaded_by,created_at,updated_at FROM documents ORDER BY created_at DESC').catch(()=>[]),
      q('SELECT * FROM portal_links ORDER BY sort_order,label').catch(()=>[]),
      q('SELECT * FROM station_outages WHERE end_at IS NULL OR end_at > NOW() ORDER BY created_at').catch(()=>[]),
      q('SELECT * FROM role_permissions').catch(()=>[]),
      q('SELECT * FROM meetings ORDER BY created_at DESC').catch(()=>[]),
      q('SELECT * FROM meeting_instances ORDER BY date DESC').catch(()=>[]),
      q('SELECT * FROM discussion_items ORDER BY sort_order,created_at').catch(()=>[]),
      q('SELECT * FROM discussion_participants').catch(()=>[]),
      q('SELECT * FROM dp_shift_types ORDER BY sort_order, name').catch(()=>[]),
      q('SELECT * FROM dp_absence_types ORDER BY sort_order, label').catch(()=>[]),
      q('SELECT * FROM dp_plans ORDER BY year DESC, month DESC').catch(()=>[]),
    ]);

    const tkViewMap = new Map((tkViewsRaw||[]).map(v=>[v.ticket_id, v.viewed_at]));
    const tkFileMap = {};
    (tkFilesRaw||[]).forEach(f=>{ if(!tkFileMap[f.ticket_id]) tkFileMap[f.ticket_id]=[]; tkFileMap[f.ticket_id].push({id:f.id,originalName:f.original_name,mimeType:f.mime_type,sizeBytes:f.size_bytes,uploadedBy:f.uploaded_by,createdAt:f.created_at}); });
    const noteMap={}, clItemMap={}, tkClItemMap={}, tkClMap={};
    notesRaw.forEach(n=>{ if(!noteMap[n.ticket_id]) noteMap[n.ticket_id]=[]; noteMap[n.ticket_id].push({id:n.id,text:n.text,authorId:n.author_id,noteType:n.note_type,createdAt:n.created_at,mentionedUsers:(()=>{try{return JSON.parse(n.mentioned_users||'[]');}catch{return [];}})()}); });
    clItems.forEach(i=>{ if(!clItemMap[i.template_id]) clItemMap[i.template_id]=[]; clItemMap[i.template_id].push({id:i.id,text:i.text,itemType:i.item_type||'check',sortOrder:i.sort_order}); });
    tkClItemsRaw.forEach(i=>{ if(!tkClItemMap[i.checklist_id]) tkClItemMap[i.checklist_id]=[]; tkClItemMap[i.checklist_id].push({id:i.id,text:i.text,itemType:i.item_type||'check',sortOrder:i.sort_order,completedBy:i.completed_by,completedAt:i.completed_at,userNote:i.user_note||''}); });
    tkClRaw.forEach(c=>{ if(!tkClMap[c.ticket_id]) tkClMap[c.ticket_id]=[]; tkClMap[c.ticket_id].push({id:c.id,templateId:c.template_id,name:c.name,createdBy:c.created_by,items:tkClItemMap[c.id]||[]}); });

    const partMap={};
    (partRaw||[]).forEach(p=>{if(!partMap[p.item_id])partMap[p.item_id]=[];partMap[p.item_id].push({id:p.id,userId:p.user_id,role:p.role});});
    const itemMap={};
    (itemsRaw||[]).forEach(it=>{if(!itemMap[it.instance_id])itemMap[it.instance_id]=[];itemMap[it.instance_id].push({id:it.id,instanceId:it.instance_id,title:it.title,description:it.description,status:it.status,dueDate:it.due_date,meetingDate:it.meeting_date,parentId:it.parent_id,delegatedTo:it.delegated_to,result:it.result,sortOrder:it.sort_order,createdBy:it.created_by,createdAt:it.created_at,participants:partMap[it.id]||[]});});
    const instMap={};
    (instancesRaw||[]).forEach(inst=>{if(!instMap[inst.meeting_id])instMap[inst.meeting_id]=[];instMap[inst.meeting_id].push({id:inst.id,meetingId:inst.meeting_id,date:inst.date,time:inst.time||'',status:inst.status,notes:inst.notes||'',createdBy:inst.created_by,createdAt:inst.created_at,items:itemMap[inst.id]||[]});});
    const fiveMinAgo = new Date(Date.now() - 5*60*1000);
    const readIds  = new Set(readsRaw.map(r=>r.message_id));
    const readSet   = new Set(readsRaw.filter(r=>r.read_at).map(r=>r.message_id));  // nur wirklich bestätigt
    const pinnedSet = new Map(readsRaw.map(r=>[r.message_id, r.pinned||false]));
    const confirmedEventIds = new Set(evConfirmsRaw.map(r=>r.event_id));

    const dtSeenSet = new Set(dtReadsRaw.map(r=>r.diensttausch_id));
    const myNameForDt = (usersRaw.find(u=>u.id===uid)?.name||'').toLowerCase();
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
        roles: p.roles,
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
        // Sichtbarkeit: Dienstplanung/Admin/Leitung sehen alles
        // Andere: eigene + die für sie erstellt wurden + allgemeine
        const canSeeAll = roles.includes('admin') || roles.includes('leitung') || p.canApproveEvents;
        const isForMe = ev.user_id === uid;
        // Anonymisieren wenn: kein Vollzugriff, nicht allgemein, nicht eigener Eintrag, nicht für mich erstellt
        const anonymize = !canSeeAll && !ev.is_general && !isForMe && !createdByMe;
        // Löschen darf: Admin, Ersteller (wenn ausstehend)
        const canDelete = roles.includes('admin') || (createdByMe && (!ev.approval_status || ev.approval_status === 'pending'));
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
          _canDelete: canDelete,
        };
      }),
      tickets: tkRaw.filter(tk=>canSeeTk(tp,tk,uid)).map(tk=>({
        id:tk.id, number:tk.number, title:tk.title, description:tk.description||'',
        department:tk.department, subcategory:tk.subcategory||'', tags:parseTags(tk.tags), priority:tk.priority,
        status:tk.status, bucket:tk.bucket||'', isPublic:tk.is_public,
        isDeleted:!!tk.is_deleted, deletedAt:tk.deleted_at||null, deletedBy:tk.deleted_by||null,
        assigneeId:tk.assignee_id, parentTicketId:tk.parent_ticket_id,
        dueDate:tk.due_date?(typeof tk.due_date==='string'?tk.due_date.slice(0,10):tk.due_date.toISOString().slice(0,10)):null,
        snoozedUntil:tk.snoozed_until?(typeof tk.snoozed_until==='string'?tk.snoozed_until.slice(0,10):tk.snoozed_until.toISOString().slice(0,10)):null,
        createdBy:tk.created_by, createdAt:tk.created_at, updatedAt:tk.updated_at, lastViewedAt:tkViewMap.get(tk.id)||null,
        mentionedUsers:[...new Set((noteMap[tk.id]||[]).flatMap(n=>n.mentionedUsers||[]))].filter(Boolean),
        notes:noteMap[tk.id]||[], checklists:tkClMap[tk.id]||[], files:tkFileMap[tk.id]||[],
        _canEdit:canEditTk(tp,tk,uid),
      })),
      allowances: allwRaw.map(a=>({id:a.id,userId:a.user_id,year:a.year,month:a.month,nd:a.nd,fd:a.fd,fw:a.fw,c10:a.c10})),
      checklists: clTmpls.map(t=>({id:t.id,name:t.name,department:t.department,createdBy:t.created_by,items:clItemMap[t.id]||[]})),
      messages: msgsRaw.filter(m=>{
        if(!m.sender_id) return true;             // alte Nachrichten → alle sehen
        if(m.sender_id===uid) return true;        // eigene gesendete
        if(!m.target_type||m.target_type==='all') return true;  // an alle
        if(m.target_type==='user') return m.target_value===uid; // direkt an mich
        const isPriv=roles.includes('admin')||roles.includes('leitung');
        return isPriv||roles.includes(m.target_value); // an Fachbereich
      }).map(m=>({
        id:m.id, title:m.title, body:m.body,
        senderId:m.sender_id,
        targetType:m.target_type||'all',
        targetValue:m.target_value||null,
        createdAt:m.created_at,
        isRead:readSet.has(m.id),
        pinned:pinnedSet.get(m.id)||false,
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
      homeoffice: {
        slots: hoSlotsRaw.map(s=>({id:s.id,date:typeof s.date==='string'?s.date.slice(0,10):(s.date instanceof Date?s.date.toISOString().slice(0,10):String(s.date).slice(0,10)),userId:s.user_id,box:s.box,dienst:s.dienst,createdAt:s.created_at})),
        config: hoConfigRaw.map(c=>({date:typeof c.date==='string'?c.date.slice(0,10):(c.date instanceof Date?c.date.toISOString().slice(0,10):String(c.date).slice(0,10)),maxSlots:c.max_slots})),
        boxes: hoBoxesRaw,
        dienste: hoDiensteRaw,
      },
      vacationConfig: (vacCfgRaw||[]).map(c=>({
        date:typeof c.date==='string'?c.date.slice(0,10):(c.date instanceof Date?c.date.toISOString().slice(0,10):String(c.date).slice(0,10)),
        maxSlots:c.max_slots, note:c.note||'',
      })),
      diensttausch: dtRaw.filter(dt => {
        // Dienstplanung/Admin sieht alles
        if (p.canApproveEvents) return true;
        // Alle anderen: nur eigene + Erwähnungen
        if (dt.created_by === uid) return true;
        if (myNameForDt && dt.text.toLowerCase().includes('@'+myNameForDt)) return true;
        return false;
      }).map(dt => ({
        id:dt.id, text:dt.text, createdBy:dt.created_by, createdAt:dt.created_at,
        status:dt.status, decidedBy:dt.decided_by, decidedAt:dt.decided_at,
        rejectReason:dt.reject_reason, isSeen:dtSeenSet.has(dt.id),
        isRelevant: dt.created_by===uid ||
          (myNameForDt && dt.text.toLowerCase().includes('@'+myNameForDt)) ||
          (p.canApproveEvents && dt.status==='pending'),
      })),
      ticketSubcategories: (tkSubcatsRaw||[]).map(s=>({id:s.id,department:s.department,label:s.label,sortOrder:s.sort_order})),
      noteTemplates: (noteTmplsRaw||[]).map(t=>({id:t.id,label:t.label,body:t.body})),
      stationShifts: (stShiftsRaw||[]).map(s=>({id:s.id,label:s.label,sortOrder:s.sort_order,serviceStart:s.service_start||'',serviceEnd:s.service_end||'',hasBreak:s.has_break!==false})),
      stationSessions: (stSessionsRaw||[]).map(s=>({id:s.id,stationName:s.station_name,userId:s.user_id,shiftId:s.shift_id,loggedInAt:s.logged_in_at,breakTime:s.break_time||null})),
      docCategories: (docCatsRaw||[]).map(c=>({id:c.id,name:c.name,icon:c.icon,color:c.color,sortOrder:c.sort_order})),
      docs: (docsRaw||[]).map(d=>({id:d.id,categoryId:d.category_id,title:d.title,description:d.description||'',originalName:d.original_name,mimeType:d.mime_type,sizeBytes:d.size_bytes,currentVersion:d.current_version,uploadedBy:d.uploaded_by,createdAt:d.created_at,updatedAt:d.updated_at})),
      portalLinks: (linksRaw||[]).map(l=>({id:l.id,label:l.label,url:l.url,icon:l.icon,description:l.description,sortOrder:l.sort_order})),
      stationOutages: (stOutagesRaw||[]).map(o=>({id:o.id,stationName:o.station_name,reason:o.reason,startAt:o.start_at,endAt:o.end_at,createdBy:o.created_by})),
      rolePermissions: (rolePermsRaw||[]).map(r=>({role:r.role,permission:r.permission,granted:r.granted})),
      meetings: (meetingsRaw||[]).map(m=>({id:m.id,title:m.title,type:m.type,rhythm:m.rhythm,rhythmDay:m.rhythm_day,rhythmTime:m.rhythm_time||'',description:m.description||'',createdBy:m.created_by,createdAt:m.created_at,instances:instMap[m.id]||[]})),
      dpShiftTypes: dpShiftTypesRaw||[],
      dpAbsenceTypes: dpAbsenceTypesRaw||[],
      dpPlans: dpPlansRaw||[],
    });
  } catch(e) { console.error('[/api/data FEHLER]', e.message, e.stack?.split('\n')[1]); bad(res,'Serverfehler',500); }
});

// EVENTS
module.exports = router;
