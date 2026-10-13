'use strict';
const router = require('express').Router();
const { q, q1, newId, pool } = require('../db');
const { auth, ok, bad } = require('../middleware');

const requireManage = (req,res) => { if(!req.p.manageSop){ bad(res,'Keine Berechtigung',403); return false; } return true; };

// ── VORLAGEN ────────────────────────────────────────────────────────────────
router.post('/sop/templates', auth, async (req,res) => {
  try {
    if (!requireManage(req,res)) return;
    const {title,category,description} = req.body;
    if (!title?.trim()) return bad(res,'Titel erforderlich');
    const id = newId();
    await pool.query(
      `INSERT INTO sop_checklists (id,base_id,version,title,category,description,status,active,created_by)
       VALUES ($1,$1,1,$2,$3,$4,'draft',false,$5)`,
      [id,title.trim(),(category||'').trim(),(description||'').trim(),req.uid]);
    ok(res,{id});
  } catch(e) { bad(res,'Serverfehler',500); }
});

router.put('/sop/templates/:id', auth, async (req,res) => {
  try {
    if (!requireManage(req,res)) return;
    const tpl = await q1('SELECT * FROM sop_checklists WHERE id=$1',[req.params.id]);
    if (!tpl) return bad(res,'Nicht gefunden',404);
    if (tpl.status!=='draft') return bad(res,'Nur Entwürfe können bearbeitet werden — für eine freigegebene Checkliste zuerst eine neue Version anlegen');
    const {title,category,description} = req.body;
    if (!title?.trim()) return bad(res,'Titel erforderlich');
    await pool.query('UPDATE sop_checklists SET title=$1,category=$2,description=$3 WHERE id=$4',
      [title.trim(),(category||'').trim(),(description||'').trim(),req.params.id]);
    ok(res);
  } catch(e) { bad(res,'Serverfehler',500); }
});

router.delete('/sop/templates/:id', auth, async (req,res) => {
  try {
    if (!requireManage(req,res)) return;
    const tpl = await q1('SELECT * FROM sop_checklists WHERE id=$1',[req.params.id]);
    if (!tpl) return bad(res,'Nicht gefunden',404);
    if (tpl.status!=='draft') return bad(res,'Nur Entwürfe können gelöscht werden — freigegebene Versionen bleiben zur Nachvollziehbarkeit erhalten und können deaktiviert werden');
    const runCnt = await q1('SELECT COUNT(*) n FROM sop_checklist_runs WHERE template_id=$1',[req.params.id]);
    if (parseInt(runCnt.n)>0) return bad(res,'Es existieren bereits Durchläufe zu diesem Entwurf');
    await pool.query('DELETE FROM sop_checklists WHERE id=$1',[req.params.id]);
    ok(res);
  } catch(e) { bad(res,'Serverfehler',500); }
});

// Neue Version einer bereits freigegebenen Checkliste anlegen (kopiert Titel/
// Kategorie/Beschreibung/Schritte in einen neuen Entwurf mit version+1);
// die freigegebene Version bleibt bis zur Freigabe der neuen unverändert aktiv.
router.post('/sop/templates/:id/new-version', auth, async (req,res) => {
  try {
    if (!requireManage(req,res)) return;
    const src = await q1('SELECT * FROM sop_checklists WHERE id=$1',[req.params.id]);
    if (!src) return bad(res,'Nicht gefunden',404);
    const maxV = await q1('SELECT MAX(version) v FROM sop_checklists WHERE base_id=$1',[src.base_id]);
    const newVersion = (parseInt(maxV.v)||src.version)+1;
    const id = newId();
    await pool.query(
      `INSERT INTO sop_checklists (id,base_id,version,title,category,description,status,active,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,'draft',false,$7)`,
      [id,src.base_id,newVersion,src.title,src.category,src.description,req.uid]);
    const items = await q('SELECT * FROM sop_checklist_items WHERE template_id=$1 ORDER BY sort_order',[src.id]);
    // Reihenfolge wichtig: Items zuerst OHNE branch_option_id anlegen (die
    // Optionen referenzieren per FK die neue Item-Zeile, die muss also schon
    // existieren); danach Optionen kopieren; danach branch_option_id auf den
    // Items nachträglich auf die neuen Options-IDs ummappen.
    const itemIdMap = {};
    items.forEach(it=>{ itemIdMap[it.id]=newId(); });
    for (const it of items) {
      await pool.query(
        `INSERT INTO sop_checklist_items (id,template_id,sort_order,text,required,item_type,hint,contact_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [itemIdMap[it.id],id,it.sort_order,it.text,it.required,it.item_type,it.hint,it.contact_id]);
    }
    const optionIdMap = {};
    for (const it of items) {
      const opts = await q('SELECT * FROM sop_checklist_item_branch_options WHERE item_id=$1 ORDER BY sort_order',[it.id]);
      for (const opt of opts) {
        const newOptId = newId();
        optionIdMap[opt.id] = newOptId;
        await pool.query(
          `INSERT INTO sop_checklist_item_branch_options (id,item_id,label,sort_order) VALUES ($1,$2,$3,$4)`,
          [newOptId, itemIdMap[it.id], opt.label, opt.sort_order]);
      }
    }
    for (const it of items) {
      if (it.branch_option_id) {
        await pool.query('UPDATE sop_checklist_items SET branch_option_id=$1 WHERE id=$2',
          [optionIdMap[it.branch_option_id]||null, itemIdMap[it.id]]);
      }
    }
    ok(res,{id});
  } catch(e) { bad(res,'Serverfehler',500); }
});

router.post('/sop/templates/:id/approve', auth, async (req,res) => {
  try {
    if (!requireManage(req,res)) return;
    const tpl = await q1('SELECT * FROM sop_checklists WHERE id=$1',[req.params.id]);
    if (!tpl) return bad(res,'Nicht gefunden',404);
    if (tpl.status!=='draft') return bad(res,'Bereits freigegeben');
    const itemCnt = await q1('SELECT COUNT(*) n FROM sop_checklist_items WHERE template_id=$1',[req.params.id]);
    if (parseInt(itemCnt.n)===0) return bad(res,'Checkliste braucht mindestens einen Schritt');
    await pool.query(`UPDATE sop_checklists SET status='approved',active=true,approved_by=$1,approved_at=NOW() WHERE id=$2`,[req.uid,req.params.id]);
    // Vorherige aktive Version derselben Checkliste wird durch die neue ersetzt.
    await pool.query('UPDATE sop_checklists SET active=false WHERE base_id=$1 AND id<>$2',[tpl.base_id,req.params.id]);
    ok(res);
  } catch(e) { bad(res,'Serverfehler',500); }
});

router.post('/sop/templates/:id/deactivate', auth, async (req,res) => {
  try {
    if (!requireManage(req,res)) return;
    await pool.query('UPDATE sop_checklists SET active=false WHERE id=$1',[req.params.id]);
    ok(res);
  } catch(e) { bad(res,'Serverfehler',500); }
});

router.post('/sop/templates/:id/reactivate', auth, async (req,res) => {
  try {
    if (!requireManage(req,res)) return;
    const tpl = await q1('SELECT * FROM sop_checklists WHERE id=$1',[req.params.id]);
    if (!tpl) return bad(res,'Nicht gefunden',404);
    if (tpl.status!=='approved') return bad(res,'Nur freigegebene Versionen können reaktiviert werden');
    await pool.query('UPDATE sop_checklists SET active=false WHERE base_id=$1',[tpl.base_id]);
    await pool.query('UPDATE sop_checklists SET active=true WHERE id=$1',[req.params.id]);
    ok(res);
  } catch(e) { bad(res,'Serverfehler',500); }
});

// ── SCHRITTE (nur im Entwurf editierbar) ───────────────────────────────────
async function assertDraft(res,id) {
  const tpl = await q1('SELECT * FROM sop_checklists WHERE id=$1',[id]);
  if (!tpl) { bad(res,'Nicht gefunden',404); return null; }
  if (tpl.status!=='draft') { bad(res,'Nur Entwürfe können bearbeitet werden'); return null; }
  return tpl;
}

router.post('/sop/templates/:id/items', auth, async (req,res) => {
  try {
    if (!requireManage(req,res)) return;
    if (!(await assertDraft(res,req.params.id))) return;
    const {text,required,itemType,hint,contactId,branchOptionId} = req.body;
    if (!text?.trim()) return bad(res,'Text erforderlich');
    const maxOrd = await q1('SELECT MAX(sort_order) m FROM sop_checklist_items WHERE template_id=$1',[req.params.id]);
    const id = newId();
    await pool.query(
      `INSERT INTO sop_checklist_items (id,template_id,sort_order,text,required,item_type,hint,contact_id,branch_option_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [id,req.params.id,(parseInt(maxOrd.m)||0)+1,text.trim(),required!==false,itemType||'check',(hint||'').trim(),itemType==='contact'?(contactId||null):null,branchOptionId||null]);
    ok(res,{id});
  } catch(e) { bad(res,'Serverfehler',500); }
});

router.put('/sop/templates/:id/items/:itemId', auth, async (req,res) => {
  try {
    if (!requireManage(req,res)) return;
    if (!(await assertDraft(res,req.params.id))) return;
    const {text,required,itemType,hint,contactId,branchOptionId} = req.body;
    if (!text?.trim()) return bad(res,'Text erforderlich');
    await pool.query(
      `UPDATE sop_checklist_items SET text=$1,required=$2,item_type=$3,hint=$4,contact_id=$5,branch_option_id=$6 WHERE id=$7 AND template_id=$8`,
      [text.trim(),required!==false,itemType||'check',(hint||'').trim(),itemType==='contact'?(contactId||null):null,branchOptionId||null,req.params.itemId,req.params.id]);
    ok(res);
  } catch(e) { bad(res,'Serverfehler',500); }
});

router.delete('/sop/templates/:id/items/:itemId', auth, async (req,res) => {
  try {
    if (!requireManage(req,res)) return;
    if (!(await assertDraft(res,req.params.id))) return;
    await pool.query('DELETE FROM sop_checklist_items WHERE id=$1 AND template_id=$2',[req.params.itemId,req.params.id]);
    ok(res);
  } catch(e) { bad(res,'Serverfehler',500); }
});

router.put('/sop/templates/:id/items-reorder', auth, async (req,res) => {
  try {
    if (!requireManage(req,res)) return;
    if (!(await assertDraft(res,req.params.id))) return;
    const {order} = req.body; // Array von item-ids in neuer Reihenfolge
    if (!Array.isArray(order)) return bad(res,'order erforderlich');
    for (let i=0;i<order.length;i++) {
      await pool.query('UPDATE sop_checklist_items SET sort_order=$1 WHERE id=$2 AND template_id=$3',[i,order[i],req.params.id]);
    }
    ok(res);
  } catch(e) { bad(res,'Serverfehler',500); }
});

// ── VERZWEIGUNGS-OPTIONEN (nur bei Schritt-Typ "branch") ───────────────────
router.post('/sop/templates/:id/items/:itemId/branch-options', auth, async (req,res) => {
  try {
    if (!requireManage(req,res)) return;
    if (!(await assertDraft(res,req.params.id))) return;
    const {label} = req.body;
    if (!label?.trim()) return bad(res,'Bezeichnung erforderlich');
    const maxOrd = await q1('SELECT MAX(sort_order) m FROM sop_checklist_item_branch_options WHERE item_id=$1',[req.params.itemId]);
    const id = newId();
    await pool.query(
      `INSERT INTO sop_checklist_item_branch_options (id,item_id,label,sort_order) VALUES ($1,$2,$3,$4)`,
      [id,req.params.itemId,label.trim(),(parseInt(maxOrd.m)||0)+1]);
    ok(res,{id});
  } catch(e) { bad(res,'Serverfehler',500); }
});
router.put('/sop/templates/:id/items/:itemId/branch-options/:optId', auth, async (req,res) => {
  try {
    if (!requireManage(req,res)) return;
    if (!(await assertDraft(res,req.params.id))) return;
    const {label} = req.body;
    if (!label?.trim()) return bad(res,'Bezeichnung erforderlich');
    await pool.query('UPDATE sop_checklist_item_branch_options SET label=$1 WHERE id=$2 AND item_id=$3',
      [label.trim(),req.params.optId,req.params.itemId]);
    ok(res);
  } catch(e) { bad(res,'Serverfehler',500); }
});
router.delete('/sop/templates/:id/items/:itemId/branch-options/:optId', auth, async (req,res) => {
  try {
    if (!requireManage(req,res)) return;
    if (!(await assertDraft(res,req.params.id))) return;
    // Schritte, die dieser Option zugeordnet waren, fallen automatisch auf
    // den Hauptpfad zurück (ON DELETE SET NULL), statt zu verwaisen.
    await pool.query('DELETE FROM sop_checklist_item_branch_options WHERE id=$1 AND item_id=$2',
      [req.params.optId,req.params.itemId]);
    ok(res);
  } catch(e) { bad(res,'Serverfehler',500); }
});

// ── DURCHLÄUFE ──────────────────────────────────────────────────────────────
router.post('/sop/runs', auth, async (req,res) => {
  try {
    const {templateId, isTest} = req.body;
    const tpl = await q1('SELECT * FROM sop_checklists WHERE id=$1',[templateId]);
    if (!tpl) return bad(res,'Checkliste nicht gefunden',404);
    // Ein Testdurchlauf dient dem Durchklicken eines NOCH NICHT freigegebenen
    // Entwurfs — nur wer Checklisten verwalten darf, darf ihn starten, und die
    // sonst nötige approved/active-Prüfung entfällt bewusst dafür.
    if (isTest) { if (!req.p.manageSop) return bad(res,'Keine Berechtigung',403); }
    else if (tpl.status!=='approved'||!tpl.active) return bad(res,'Checkliste ist nicht freigegeben/aktiv');
    const id = newId();
    await pool.query(`INSERT INTO sop_checklist_runs (id,template_id,started_by,status,is_test) VALUES ($1,$2,$3,'running',$4)`,[id,templateId,req.uid,!!isTest]);
    const items = await q('SELECT * FROM sop_checklist_items WHERE template_id=$1',[templateId]);
    for (const it of items) {
      await pool.query('INSERT INTO sop_checklist_run_items (id,run_id,item_id,done,value) VALUES ($1,$2,$3,false,$4)',[newId(),id,it.id,'']);
    }
    ok(res,{id});
  } catch(e) { bad(res,'Serverfehler',500); }
});

async function assertRunEditable(req,res) {
  const run = await q1('SELECT * FROM sop_checklist_runs WHERE id=$1',[req.params.id]);
  if (!run) { bad(res,'Nicht gefunden',404); return null; }
  if (run.status!=='running') { bad(res,'Durchlauf ist bereits abgeschlossen'); return null; }
  if (run.started_by!==req.uid && !req.p.manageSop) { bad(res,'Keine Berechtigung',403); return null; }
  return run;
}

router.put('/sop/runs/:id/items/:itemId', auth, async (req,res) => {
  try {
    if (!(await assertRunEditable(req,res))) return;
    const {done,value,note} = req.body;
    // COALESCE-artig: nur mitgeschickte Felder ändern — done/value (Checkbox/
    // Eingabe) und note (Dokumentations-Freitext) werden vom Frontend
    // unabhängig voneinander gespeichert (z.B. Checkbox-Klick vs. onBlur des
    // Notizfelds), ein volles Überschreiben würde sonst das jeweils andere
    // Feld mit einem veralteten Client-Stand zurücksetzen.
    const current = await q1('SELECT * FROM sop_checklist_run_items WHERE run_id=$1 AND item_id=$2',[req.params.id,req.params.itemId]);
    if (!current) return bad(res,'Nicht gefunden',404);
    await pool.query(
      `UPDATE sop_checklist_run_items SET done=$1,value=$2,note=$3,updated_at=NOW(),updated_by=$4 WHERE run_id=$5 AND item_id=$6`,
      [done!==undefined?!!done:current.done, value!==undefined?value:current.value, note!==undefined?note:current.note, req.uid, req.params.id, req.params.itemId]);
    ok(res);
  } catch(e) { bad(res,'Serverfehler',500); }
});

router.put('/sop/runs/:id/complete', auth, async (req,res) => {
  try {
    if (!(await assertRunEditable(req,res))) return;
    await pool.query(`UPDATE sop_checklist_runs SET status='completed',completed_at=NOW() WHERE id=$1`,[req.params.id]);
    ok(res);
  } catch(e) { bad(res,'Serverfehler',500); }
});

router.put('/sop/runs/:id/abort', auth, async (req,res) => {
  try {
    if (!(await assertRunEditable(req,res))) return;
    await pool.query(`UPDATE sop_checklist_runs SET status='aborted',completed_at=NOW() WHERE id=$1`,[req.params.id]);
    ok(res);
  } catch(e) { bad(res,'Serverfehler',500); }
});

router.delete('/sop/runs/:id', auth, async (req,res) => {
  try {
    const run = await q1('SELECT * FROM sop_checklist_runs WHERE id=$1',[req.params.id]);
    if (!run) return bad(res,'Nicht gefunden',404);
    if (!run.is_test) return bad(res,'Nur Testdurchläufe können gelöscht werden');
    if (run.started_by!==req.uid && !req.p.manageSop) return bad(res,'Keine Berechtigung',403);
    await pool.query('DELETE FROM sop_checklist_runs WHERE id=$1',[req.params.id]);
    ok(res);
  } catch(e) { bad(res,'Serverfehler',500); }
});

// ── AUSWERTUNG ──────────────────────────────────────────────────────────────
router.get('/sop/templates/:id/stats', auth, async (req,res) => {
  try {
    if (!requireManage(req,res)) return;
    const tpl = await q1('SELECT * FROM sop_checklists WHERE id=$1',[req.params.id]);
    if (!tpl) return bad(res,'Nicht gefunden',404);
    const runs = (await q('SELECT * FROM sop_checklist_runs WHERE template_id=$1',[req.params.id])).filter(r=>!r.is_test);
    const completed = runs.filter(r=>r.status==='completed');
    const durations = completed.map(r=>(new Date(r.completed_at)-new Date(r.started_at))/60000).filter(n=>n>=0);
    const avgDurationMin = durations.length ? durations.reduce((a,b)=>a+b,0)/durations.length : null;
    const items = await q('SELECT * FROM sop_checklist_items WHERE template_id=$1 ORDER BY sort_order',[req.params.id]);
    const runIds = completed.map(r=>r.id);
    let itemStats = items.map(it=>({id:it.id,text:it.text,itemType:it.item_type,notDoneCount:0,emptyCount:0}));
    if (runIds.length) {
      const runItems = await q(`SELECT * FROM sop_checklist_run_items WHERE run_id = ANY($1)`,[runIds]);
      itemStats = items.map(it=>{
        const mine = runItems.filter(ri=>ri.item_id===it.id);
        return {
          id:it.id, text:it.text, itemType:it.item_type,
          notDoneCount: mine.filter(ri=>!ri.done).length,
          emptyCount: mine.filter(ri=>!ri.value).length,
          totalRuns: mine.length,
        };
      });
    }
    ok(res, {
      totalRuns: runs.length,
      runningCount: runs.filter(r=>r.status==='running').length,
      completedCount: completed.length,
      abortedCount: runs.filter(r=>r.status==='aborted').length,
      avgDurationMin,
      items: itemStats,
    });
  } catch(e) { bad(res,'Serverfehler',500); }
});

// ── DRUCKANSICHT (serverseitig gerendertes, statisches HTML — funktioniert
// auch ohne Internetverbindung am Zielrechner: kein Client-JS, keine externen
// Ressourcen, druckt über den nativen Browser-Druckdialog "Als PDF speichern") ──
const esc = s => String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const TYPE_LABELS = {check:'Checkbox',text:'Texteingabe',yesno:'Ja/Nein',photo:'Foto-Upload',contact:'Kontakt'};
function printCss() {
  return `body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:0;padding:24px}
  .sop-doc{max-width:800px;margin:0 auto 40px;page-break-after:always}
  .sop-doc:last-child{page-break-after:auto}
  h1{font-size:20px;margin:0 0 2px}
  .meta{font-size:11px;color:#555;margin-bottom:14px;border-bottom:2px solid #111;padding-bottom:10px}
  .desc{font-size:12px;color:#333;margin-bottom:14px;white-space:pre-wrap}
  .steps{margin:0;padding:0}
  .step{display:flex;gap:10px;padding:10px 0;border-bottom:1px solid #ccc;align-items:flex-start}
  .box{width:20px;height:20px;border:2px solid #111;flex-shrink:0;margin-top:1px}
  .req{color:#b91c1c;font-weight:700}
  .txt{flex:1}
  .step-text{font-size:13px;font-weight:600}
  .hint{font-size:11px;color:#555;margin-top:2px}
  .fill-line{border-bottom:1px solid #999;display:inline-block;min-width:220px;height:14px;margin-top:4px}
  .time-note{font-size:10px;color:#777;margin-top:4px}
  .note-line{border-bottom:1px solid #999;display:block;height:16px;margin-top:6px}
  .contact-card{background:#f3f4f6;border:1px solid #ccc;border-radius:4px;padding:6px 8px;margin-top:4px;font-size:11px}
  .branch-header{font-size:11px;font-weight:700;color:#111;background:#eef2ff;border-left:3px solid #4338ca;padding:4px 8px;margin:6px 0 2px}
  @media print{.sop-doc{page-break-after:always}}
  `;
}
// Rendert Schritte rekursiv als Baum: Schritte OHNE branch_option_id (Haupt-
// pfad) immer, darunter je Option eines Verzweigungs-Schritts eingerückt nur
// dessen zugeordnete Schritte — auf Papier lassen sich Pfade nicht dynamisch
// ausblenden, daher werden hier ALLE möglichen Pfade sichtbar mit "Falls
// ..."-Überschriften dargestellt, statt nur einen aktiven Pfad zu zeigen.
function renderStepsTree(allItems, branchOptionId, contactsById, optionsByItemId, depth) {
  const group = allItems.filter(it => (it.branch_option_id||null) === branchOptionId);
  return group.map(it => {
    const c = it.item_type==='contact' ? contactsById[it.contact_id] : null;
    const opts = it.item_type==='branch' ? (optionsByItemId[it.id]||[]) : [];
    const indent = depth*22;
    let html = `<div class="step" style="margin-left:${indent}px">
      <div class="box"></div>
      <div class="txt">
        <div class="step-text">${esc(it.text)}${it.required?' <span class="req">*</span>':''} <span style="font-size:10px;color:#888">(${TYPE_LABELS[it.item_type]||it.item_type})</span></div>
        ${it.hint?`<div class="hint">${esc(it.hint)}</div>`:''}
        ${it.item_type==='text'?`<div class="fill-line"></div>`:''}
        ${c?`<div class="contact-card"><b>${esc(c.name)}</b>${c.title?' &middot; '+esc(c.title):''}${c.company?' &middot; '+esc(c.company):''}<br>${c.phone1?'Tel: '+esc(c.phone1)+' ':''}${c.phone2?'/ '+esc(c.phone2)+' ':''}${c.email?'&middot; '+esc(c.email):''}${c.availability?'<br>Erreichbar: '+esc(c.availability):''}</div>`:''}
        ${it.item_type==='contact'&&it.contact_id&&!c?`<div class="hint">(Verknüpfter Kontakt wurde gelöscht)</div>`:''}
        ${it.item_type!=='branch'?`<div class="time-note">Uhrzeit: ______________&nbsp;&nbsp;&nbsp;Erledigt von: ______________________</div>
        <div class="hint" style="margin-top:6px">Dokumentation:</div>
        <div class="note-line"></div>`:''}
      </div>
    </div>`;
    opts.forEach(o => {
      html += `<div class="branch-header" style="margin-left:${indent+22}px">&#8618; Falls &bdquo;${esc(o.label)}&ldquo;:</div>`
        + renderStepsTree(allItems, o.id, contactsById, optionsByItemId, depth+1);
    });
    return html;
  }).join('');
}
function renderSopDoc(tpl, items, contactsById, optionsByItemId) {
  contactsById = contactsById || {};
  optionsByItemId = optionsByItemId || {};
  return `<div class="sop-doc">
    <h1>${esc(tpl.title)}</h1>
    <div class="meta">${esc(tpl.category||'Ohne Kategorie')} &middot; Version ${tpl.version} &middot; gedruckt am ${new Date().toLocaleString('de-AT')}</div>
    ${tpl.description?`<div class="desc">${esc(tpl.description)}</div>`:''}
    <div class="steps">${renderStepsTree(items, null, contactsById, optionsByItemId, 0)}</div>
  </div>`;
}
async function loadContactsById(items) {
  const ids = [...new Set(items.filter(it=>it.item_type==='contact'&&it.contact_id).map(it=>it.contact_id))];
  if (!ids.length) return {};
  const rows = await q('SELECT * FROM contacts WHERE id = ANY($1)',[ids]);
  const map = {}; rows.forEach(c=>{map[c.id]={name:c.name,title:c.title,company:c.company,phone1:c.phone1,phone2:c.phone2,email:c.email,availability:c.availability};});
  return map;
}
async function loadOptionsByItemId(items) {
  const branchIds = items.filter(it=>it.item_type==='branch').map(it=>it.id);
  if (!branchIds.length) return {};
  const rows = await q('SELECT * FROM sop_checklist_item_branch_options WHERE item_id = ANY($1) ORDER BY item_id,sort_order',[branchIds]);
  const map = {}; rows.forEach(o=>{ (map[o.item_id]=map[o.item_id]||[]).push({id:o.id,label:o.label}); });
  return map;
}
router.get('/sop/templates/:id/print', auth, async (req,res) => {
  try {
    const tpl = await q1('SELECT * FROM sop_checklists WHERE id=$1',[req.params.id]);
    if (!tpl) return res.status(404).send('Nicht gefunden');
    if (!req.p.manageSop && !(tpl.status==='approved'&&tpl.active)) return res.status(403).send('Keine Berechtigung');
    const items = await q('SELECT * FROM sop_checklist_items WHERE template_id=$1 ORDER BY sort_order',[req.params.id]);
    const [contactsById,optionsByItemId] = await Promise.all([loadContactsById(items),loadOptionsByItemId(items)]);
    pool.query('UPDATE sop_checklists SET last_printed_at=NOW() WHERE id=$1',[req.params.id]).catch(()=>{});
    res.set('Content-Type','text/html; charset=utf-8');
    res.send(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(tpl.title)}</title><style>${printCss()}</style></head><body>${renderSopDoc(tpl,items,contactsById,optionsByItemId)}</body></html>`);
  } catch(e) { res.status(500).send('Serverfehler'); }
});

// Kompletter Satz aller aktuell freigegebenen/aktiven Checklisten zum
// routinemäßigen Ausdrucken (z.B. wöchentlich für den Ordner am Leitstellenplatz).
router.get('/sop/print-all', auth, async (req,res) => {
  try {
    const tpls = await q(`SELECT * FROM sop_checklists WHERE status='approved' AND active=true ORDER BY category,title`);
    const items = await q('SELECT * FROM sop_checklist_items WHERE template_id = ANY($1) ORDER BY sort_order',[tpls.map(t=>t.id)]);
    const byTpl = {}; items.forEach(it=>{(byTpl[it.template_id]=byTpl[it.template_id]||[]).push(it);});
    const [contactsById,optionsByItemId] = await Promise.all([loadContactsById(items),loadOptionsByItemId(items)]);
    await pool.query(`UPDATE sop_checklists SET last_printed_at=NOW() WHERE status='approved' AND active=true`).catch(()=>{});
    res.set('Content-Type','text/html; charset=utf-8');
    res.send(`<!doctype html><html><head><meta charset="utf-8"><title>Notfall-Checklisten</title><style>${printCss()}</style></head><body>${tpls.map(t=>renderSopDoc(t,byTpl[t.id]||[],contactsById,optionsByItemId)).join('')}</body></html>`);
  } catch(e) { res.status(500).send('Serverfehler'); }
});

module.exports = router;
