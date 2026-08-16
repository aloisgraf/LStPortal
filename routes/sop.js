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
    for (const it of items) {
      await pool.query(
        `INSERT INTO sop_checklist_items (id,template_id,sort_order,text,required,item_type,hint) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [newId(),id,it.sort_order,it.text,it.required,it.item_type,it.hint]);
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
    const {text,required,itemType,hint} = req.body;
    if (!text?.trim()) return bad(res,'Text erforderlich');
    const maxOrd = await q1('SELECT MAX(sort_order) m FROM sop_checklist_items WHERE template_id=$1',[req.params.id]);
    const id = newId();
    await pool.query(
      `INSERT INTO sop_checklist_items (id,template_id,sort_order,text,required,item_type,hint) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [id,req.params.id,(parseInt(maxOrd.m)||0)+1,text.trim(),required!==false,itemType||'check',(hint||'').trim()]);
    ok(res,{id});
  } catch(e) { bad(res,'Serverfehler',500); }
});

router.put('/sop/templates/:id/items/:itemId', auth, async (req,res) => {
  try {
    if (!requireManage(req,res)) return;
    if (!(await assertDraft(res,req.params.id))) return;
    const {text,required,itemType,hint} = req.body;
    if (!text?.trim()) return bad(res,'Text erforderlich');
    await pool.query(
      `UPDATE sop_checklist_items SET text=$1,required=$2,item_type=$3,hint=$4 WHERE id=$5 AND template_id=$6`,
      [text.trim(),required!==false,itemType||'check',(hint||'').trim(),req.params.itemId,req.params.id]);
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

// ── DURCHLÄUFE ──────────────────────────────────────────────────────────────
router.post('/sop/runs', auth, async (req,res) => {
  try {
    const {templateId} = req.body;
    const tpl = await q1('SELECT * FROM sop_checklists WHERE id=$1',[templateId]);
    if (!tpl) return bad(res,'Checkliste nicht gefunden',404);
    if (tpl.status!=='approved'||!tpl.active) return bad(res,'Checkliste ist nicht freigegeben/aktiv');
    const id = newId();
    await pool.query(`INSERT INTO sop_checklist_runs (id,template_id,started_by,status) VALUES ($1,$2,$3,'running')`,[id,templateId,req.uid]);
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
    const {done,value} = req.body;
    await pool.query(
      `UPDATE sop_checklist_run_items SET done=$1,value=$2,updated_at=NOW(),updated_by=$3 WHERE run_id=$4 AND item_id=$5`,
      [!!done,value??'',req.uid,req.params.id,req.params.itemId]);
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

// ── AUSWERTUNG ──────────────────────────────────────────────────────────────
router.get('/sop/templates/:id/stats', auth, async (req,res) => {
  try {
    if (!requireManage(req,res)) return;
    const tpl = await q1('SELECT * FROM sop_checklists WHERE id=$1',[req.params.id]);
    if (!tpl) return bad(res,'Nicht gefunden',404);
    const runs = await q('SELECT * FROM sop_checklist_runs WHERE template_id=$1',[req.params.id]);
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
const TYPE_LABELS = {check:'Checkbox',text:'Texteingabe',yesno:'Ja/Nein',photo:'Foto-Upload'};
function printCss() {
  return `body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:0;padding:24px}
  .sop-doc{max-width:800px;margin:0 auto 40px;page-break-after:always}
  .sop-doc:last-child{page-break-after:auto}
  h1{font-size:20px;margin:0 0 2px}
  .meta{font-size:11px;color:#555;margin-bottom:14px;border-bottom:2px solid #111;padding-bottom:10px}
  .desc{font-size:12px;color:#333;margin-bottom:14px;white-space:pre-wrap}
  ol{list-style:none;margin:0;padding:0}
  li{display:flex;gap:10px;padding:10px 0;border-bottom:1px solid #ccc;align-items:flex-start}
  .box{width:20px;height:20px;border:2px solid #111;flex-shrink:0;margin-top:1px}
  .req{color:#b91c1c;font-weight:700}
  .txt{flex:1}
  .step-text{font-size:13px;font-weight:600}
  .hint{font-size:11px;color:#555;margin-top:2px}
  .fill-line{border-bottom:1px solid #999;display:inline-block;min-width:220px;height:14px;margin-top:4px}
  .time-note{font-size:10px;color:#777;margin-top:4px}
  @media print{.sop-doc{page-break-after:always}}
  `;
}
function renderSopDoc(tpl, items) {
  return `<div class="sop-doc">
    <h1>${esc(tpl.title)}</h1>
    <div class="meta">${esc(tpl.category||'Ohne Kategorie')} &middot; Version ${tpl.version} &middot; gedruckt am ${new Date().toLocaleString('de-AT')}</div>
    ${tpl.description?`<div class="desc">${esc(tpl.description)}</div>`:''}
    <ol>
      ${items.map((it,i)=>`<li>
        <div class="box"></div>
        <div class="txt">
          <div class="step-text">${i+1}. ${esc(it.text)}${it.required?' <span class="req">*</span>':''} <span style="font-size:10px;color:#888">(${TYPE_LABELS[it.item_type]||it.item_type})</span></div>
          ${it.hint?`<div class="hint">${esc(it.hint)}</div>`:''}
          ${it.item_type==='text'?`<div class="fill-line"></div>`:''}
          <div class="time-note">Uhrzeit: ______________&nbsp;&nbsp;&nbsp;Erledigt von: ______________________</div>
        </div>
      </li>`).join('')}
    </ol>
  </div>`;
}
router.get('/sop/templates/:id/print', auth, async (req,res) => {
  try {
    const tpl = await q1('SELECT * FROM sop_checklists WHERE id=$1',[req.params.id]);
    if (!tpl) return res.status(404).send('Nicht gefunden');
    if (!req.p.manageSop && !(tpl.status==='approved'&&tpl.active)) return res.status(403).send('Keine Berechtigung');
    const items = await q('SELECT * FROM sop_checklist_items WHERE template_id=$1 ORDER BY sort_order',[req.params.id]);
    pool.query('UPDATE sop_checklists SET last_printed_at=NOW() WHERE id=$1',[req.params.id]).catch(()=>{});
    res.set('Content-Type','text/html; charset=utf-8');
    res.send(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(tpl.title)}</title><style>${printCss()}</style></head><body>${renderSopDoc(tpl,items)}</body></html>`);
  } catch(e) { res.status(500).send('Serverfehler'); }
});

// Kompletter Satz aller aktuell freigegebenen/aktiven Checklisten zum
// routinemäßigen Ausdrucken (z.B. wöchentlich für den Ordner am Leitstellenplatz).
router.get('/sop/print-all', auth, async (req,res) => {
  try {
    const tpls = await q(`SELECT * FROM sop_checklists WHERE status='approved' AND active=true ORDER BY category,title`);
    const items = await q('SELECT * FROM sop_checklist_items WHERE template_id = ANY($1) ORDER BY sort_order',[tpls.map(t=>t.id)]);
    const byTpl = {}; items.forEach(it=>{(byTpl[it.template_id]=byTpl[it.template_id]||[]).push(it);});
    await pool.query(`UPDATE sop_checklists SET last_printed_at=NOW() WHERE status='approved' AND active=true`).catch(()=>{});
    res.set('Content-Type','text/html; charset=utf-8');
    res.send(`<!doctype html><html><head><meta charset="utf-8"><title>Notfall-Checklisten</title><style>${printCss()}</style></head><body>${tpls.map(t=>renderSopDoc(t,byTpl[t.id]||[])).join('')}</body></html>`);
  } catch(e) { res.status(500).send('Serverfehler'); }
});

module.exports = router;
