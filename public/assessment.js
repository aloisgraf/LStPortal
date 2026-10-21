// ASSESSMENT (routes/assessment.js, lib/assessment.js) — Ablauf: Übersicht →
// Abschnitt für Abschnitt, jeder startet erst mit „Weiter“ → Abschluss. Die
// Uhr läuft serverseitig; hier wird nur angezeigt, nach jeder Änderung
// zwischengespeichert und bei 0:00 automatisch abgegeben. Innerhalb eines
// Abschnitts geht es Block für Block mit „Fertig, weiter“ (außer freeOrder).
// Administratoren sehen zusätzlich die Ergebnisse aller Mitarbeiter.
// Nutzt die globalen Helfer aus app.js (api, esc, toast, fdt, S).
const ASM={info:null,section:null,answers:{},block:0,deadline:0,timer:null,draftTimer:null,submitting:false,warned:{},results:null,openResult:null,memoUntil:{},prevText:{}};
function asmStopTimers(){if(ASM.timer){clearInterval(ASM.timer);ASM.timer=null;}if(ASM.draftTimer){clearTimeout(ASM.draftTimer);ASM.draftTimer=null;}}
const asmFmt=s=>{s=Math.max(0,Math.ceil(s));return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');};
const asmWords=t=>(String(t||'').trim().match(/\S+/g)||[]).length;
const asmQuestions=sec=>sec.blocks.flatMap(b=>b.questions);
function asmIsAnswered(q){
  const v=ASM.answers[q.id];
  if(v===undefined||v===null||v==='')return false;
  if(q.type==='markwords')return Object.keys(v).length>0;
  if(q.type==='writing')return !!v.text?.trim();
  return true;
}

async function renderAssessment(){
  asmStopTimers();
  const main=document.getElementById('main');
  main.innerHTML='<div class="empty">⏳ Lade Assessment…</div>';
  try{
    ASM.info=await api('GET','/assessment');
    if(ASM.info.isAdmin){try{ASM.results=await api('GET','/assessment/results');}catch(e){ASM.results=[];}}
  }catch(e){main.innerHTML=`<div class="empty">⚠️ ${esc(e.message)}</div>`;return;}
  const att=ASM.info.attempt;
  if(att&&att.status==='running'&&att.sectionStarted)return asmBeginSection();
  asmRenderOverview();
}
function asmRenderOverview(){
  const {sections,totalMinutes,attempt:att,isAdmin}=ASM.info;
  let body;
  if(!att){
    body=`<div class="dash-card asm-intro">
      <div style="font-size:15px;font-weight:700;margin-bottom:6px">Willkommen zum Assessment</div>
      <div style="font-size:13px;color:var(--mu);margin-bottom:12px">Das Assessment besteht aus ${sections.length} Abschnitten und dauert insgesamt ca. <b>${totalMinutes} Minuten</b>. Jeder Abschnitt hat ein eigenes Zeitlimit. Läuft die Zeit ab, wird der Abschnitt automatisch abgegeben. Der nächste Abschnitt beginnt erst, wenn du auf „Weiter“ klickst.</div>
      ${asmSectionList(sections,-1)}
      <ul class="asm-rules">
        <li>Pro Frage nur eine Antwort. Unbearbeitete Aufgaben zählen 0 Punkte, Raten lohnt sich (außer bei den Protokollfehlern in Teil 1).</li>
        <li>Innerhalb eines Abschnitts geht es mit „Fertig, weiter“ zum nächsten Block. Zurück geht es nicht.</li>
        <li>Deine Antworten werden laufend gespeichert. Wenn die Verbindung abbricht, melde dich einfach wieder an, die Uhr läuft weiter.</li>
        <li>Handy und weitere Hilfsmittel bleiben weg, es sei denn, die Prüfungsleitung erlaubt etwas anderes.</li>
      </ul>
      <button class="btn-p" onclick="asmStart()">▶ Assessment starten</button>
    </div>`;
  }else if(att.status==='running'){
    const s=sections[att.currentSection];
    const pause=s.kind==='pause';
    body=`<div class="dash-card asm-intro">
      ${att.currentSection>0?`<div class="asm-done-note">✓ Abschnitt ${att.currentSection} ist abgegeben.</div>`:''}
      <div style="font-size:11px;color:var(--mu);font-weight:600">Als Nächstes: Abschnitt ${att.currentSection+1} von ${sections.length}</div>
      <div style="font-size:17px;font-weight:800;margin:2px 0 6px">${pause?'☕ ':''}${esc(s.title)}</div>
      <div style="font-size:13px;color:var(--mu);margin-bottom:10px">${esc(s.description)}</div>
      <div class="asm-meta"><span>⏱ ${s.minutes} Minuten</span>${s.count?`<span>❓ ${s.count} Aufgaben</span>`:''}</div>
      ${asmSectionList(sections,att.currentSection)}
      <button class="btn-p" onclick="asmBeginSection(true)">${pause?'☕ Pause beginnen':'▶ Weiter'}</button>
    </div>`;
  }else{
    body=`<div class="dash-card asm-intro" style="border-top-color:var(--ok)">
      <div style="font-size:18px;font-weight:800;margin-bottom:6px">✅ Assessment abgeschlossen</div>
      <div style="font-size:13px;color:var(--mu)">Vielen Dank! Alle Abschnitte wurden abgegeben (${fdt(att.finishedAt)}). Die Auswertung erfolgt durch die Administration.</div>
    </div>`;
  }
  document.getElementById('main').innerHTML=`<div class="ph"><div class="pt">📝 Assessment</div></div>${body}${isAdmin?asmResultsHtml():''}`;
}
function asmSectionList(sections,current){
  return `<div class="asm-sec-list">${sections.map((s,i)=>`<div class="asm-sec-row ${i<current?'done':i===current?'cur':''} ${s.kind==='pause'?'pause':''}"><span class="asm-sec-num">${i<current?'✓':s.kind==='pause'?'☕':i+1}</span><span style="flex:1">${esc(s.title)}</span><span style="color:var(--mu)">${s.minutes} Min.</span></div>`).join('')}</div>`;
}
async function asmStart(){
  if(!confirm('Assessment jetzt starten?'))return;
  try{await api('POST','/assessment/start');await renderAssessment();}catch(e){toast('⚠️ '+e.message,'err');}
}
async function asmBeginSection(){
  asmStopTimers();
  try{
    const r=await api('POST','/assessment/section/begin');
    ASM.section=r.section;ASM.answers=r.draft?.answers||{};ASM.block=r.draft?.block||0;
    ASM.warned={};ASM.submitting=false;ASM.memoUntil={};ASM.prevText={};
    ASM.deadline=Date.now()+(r.state.remainingSeconds||0)*1000;
    ASM.sectionStart=ASM.deadline-r.section.minutes*60*1000;
    asmRenderSection();
    if(r.state.remainingSeconds>=r.section.minutes*60-2){document.getElementById('main').scrollTop=0;window.scrollTo(0,0);}
    ASM.timer=setInterval(asmTick,250);
  }catch(e){toast('⚠️ '+e.message,'err');renderAssessment();}
}

// ── Abschnitt anzeigen ──
function asmCurrentBlocks(){
  const sec=ASM.section;
  return sec.freeOrder?sec.blocks.map((b,i)=>[b,i]):[[sec.blocks[ASM.block],ASM.block]];
}
function asmMemorizing(bi){
  const b=ASM.section.blocks[bi];
  if(!b?.memorize)return false;
  if(ASM.memoUntil[bi]===undefined)ASM.memoUntil[bi]=Date.now()+b.memorize.seconds*1000;
  return Date.now()<ASM.memoUntil[bi];
}
function asmRenderSection(){
  const sec=ASM.section,total=ASM.info.sections.length;
  const head=`<div class="asm-bar" id="asmBar"><div class="asm-bar-row">
      <div><div style="font-size:11px;color:var(--mu);font-weight:600">Abschnitt ${sec.index+1} von ${total}${!sec.freeOrder&&sec.blocks.length>1?` · Block ${ASM.block+1} von ${sec.blocks.length}`:''}</div><div style="font-weight:800">${esc(sec.title)}</div></div>
      <div class="asm-progress" id="asmProgress"></div>
      <div class="asm-timer" id="asmTimer">--:--</div>
    </div><div class="asm-timebar"><div id="asmTimeFill"></div></div></div>`;
  let body;
  if(sec.kind==='pause'){
    body=`<div class="dash-card asm-intro asm-pause"><div style="font-size:40px">☕</div>
      <div style="font-size:18px;font-weight:800;margin:6px 0">Pause</div>
      <div style="font-size:13px;color:var(--mu);margin-bottom:14px">${esc(sec.description)}</div>
      <button class="btn-p" id="asmPauseBtn" disabled onclick="asmSubmit(true)">▶ Weiter</button></div>`;
  }else{
    let num=0;
    sec.blocks.forEach((b,bi)=>{if(!sec.freeOrder&&bi<ASM.block)num+=b.questions.length;});
    body=asmCurrentBlocks().map(([b,bi])=>{
      let h=`<div class="asm-block"><div class="asm-block-title">${esc(b.title)}</div>${b.instruction?`<div class="asm-block-ins">${esc(b.instruction)}</div>`:''}`;
      if(asmMemorizing(bi)){
        h+=`<div class="dash-card asm-memo"><div style="font-weight:700;margin-bottom:8px">🧠 ${esc(b.memorize.text)}</div>
          <ul>${b.memorize.facts.map(f=>`<li>${esc(f)}</li>`).join('')}</ul>
          <div style="font-size:12px;color:var(--mu)">Die Angaben verschwinden in <b id="asmMemoLeft"></b> Sekunden.</div></div></div>`;
        num+=b.questions.length;
        return h;
      }
      h+=b.questions.map(q=>asmQuestionHtml(q,sec,++num)).join('');
      return h+'</div>';
    }).join('');
    const last=sec.freeOrder||ASM.block>=sec.blocks.length-1;
    const onlyFinalWriting=asmQuestions(sec).every(q=>q.type==='writing'&&q.final);
    if(!asmCurrentBlocks().some(([,bi])=>asmMemorizing(bi))&&!onlyFinalWriting)
      body+=`<div class="asm-next">${last?`<button class="btn-p" onclick="asmSubmit(false)">✔ Abschnitt abgeben</button>`:`<button class="btn-p" onclick="asmNextBlock()">Fertig, weiter ▶</button>`}</div>`;
  }
  // Scrollposition behalten (je nach Layout scrollt <main> oder das Fenster).
  const main=document.getElementById('main'),y=window.scrollY,my=main.scrollTop;
  main.innerHTML=head+body;
  document.querySelectorAll('.asm-write').forEach(asmBindWriting);
  main.scrollTop=my;window.scrollTo(0,y);
  asmTick();
}
function asmQuestionHtml(q,sec,num){
  if(q.type==='writing')return asmWritingHtml(q);
  if(q.type==='markwords')return asmMarkwordsHtml(q);
  return `<div class="asm-q ${q.compact?'compact':''} ${asmIsAnswered(q)?'answered':''}" id="asmQ_${q.id}">
    <div class="asm-q-main"><span class="asm-q-num">${num}</span><div class="asm-q-text">${esc(q.text)}${q.hint?`<div class="asm-q-hint">Hinweis: ${esc(q.hint)}</div>`:''}</div></div>
    ${q.pre?`<pre class="asm-pre">${esc(q.pre)}</pre>`:''}${asmInputHtml(q,sec)}</div>`;
}
function asmInputHtml(q,sec){
  const v=ASM.answers[q.id];
  if(q.type==='choice')return `<div class="asm-opts ${q.compact?'compact':''}">${q.options.map((o,i)=>`<label class="asm-opt"><input type="radio" name="asm_${q.id}" ${v===i?'checked':''} onchange="asmSet('${q.id}',${i})"><span>${esc(o)}</span></label>`).join('')}</div>`;
  if(q.type==='number')return `<input type="text" inputmode="decimal" class="asm-num" placeholder="Antwort" autocomplete="off" value="${esc(v??'')}" oninput="asmSet('${q.id}',this.value)" onkeydown="if(event.key==='Enter')event.preventDefault()">`;
  if(q.type==='text')return `<input type="text" class="asm-num asm-txt" placeholder="Fachwort" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" value="${esc(v??'')}" oninput="asmSet('${q.id}',this.value)" onkeydown="if(event.key==='Enter')event.preventDefault()">`;
  const scale=sec.scale||['1','2','3','4','5'];
  return `<div class="asm-likert">${scale.map((l,i)=>`<label class="asm-lk"><input type="radio" name="asm_${q.id}" ${v===i+1?'checked':''} onchange="asmSet('${q.id}',${i+1})"><b>${i+1}</b><span>${esc(l)}</span></label>`).join('')}</div>`;
}
function asmSet(id,val){
  ASM.answers[id]=val;
  const el=document.getElementById('asmQ_'+id);if(el)el.classList.toggle('answered',val!==''&&val!==undefined);
  asmUpdateProgress();
  asmQueueDraft(500);
}

// ── Fehler im Text markieren (markwords) ──
function asmMarkwordsHtml(q){
  const marks=ASM.answers[q.id]||{};
  const text=q.tokens.map((t,i)=>/\S/.test(t)?`<span class="asm-w ${marks[i]!==undefined?'on':''}" onclick="asmToggleMark('${q.id}',${i})">${esc(t)}</span>`:esc(t)).join('');
  const list=Object.keys(marks).map(Number).sort((a,b)=>a-b).map(i=>`<div class="asm-mark-row"><span class="asm-mark-word">${esc(q.tokens[i].replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu,''))}</span><span>→</span>
    <input type="text" id="asmMk_${q.id}_${i}" class="asm-num asm-txt" placeholder="richtige Schreibweise" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" value="${esc(marks[i])}" oninput="asmSetMark('${q.id}',${i},this.value)">
    <button class="btn-s" title="Markierung entfernen" onclick="asmToggleMark('${q.id}',${i})">✕</button></div>`).join('');
  return `<div class="asm-q" id="asmQ_${q.id}"><div class="asm-mark-text" spellcheck="false">${text}</div>
    <div class="asm-mark-list"><div style="font-size:12px;font-weight:700;margin-bottom:4px">Markierte Wörter (${Object.keys(marks).length})</div>${list||'<div style="font-size:12px;color:var(--mu)">Noch nichts markiert. Tippe ein Wort im Text an.</div>'}</div></div>`;
}
function asmToggleMark(qid,i){
  const marks={...(ASM.answers[qid]||{})};
  if(marks[i]!==undefined)delete marks[i];else marks[i]='';
  ASM.answers[qid]=marks;
  // Nur diese Aufgabe neu zeichnen: Scrollposition und andere Eingaben bleiben.
  const el=document.getElementById('asmQ_'+qid),q=asmQuestions(ASM.section).find(x=>x.id===qid);
  if(el&&q)el.outerHTML=asmMarkwordsHtml(q);
  if(marks[i]!==undefined)document.getElementById(`asmMk_${qid}_${i}`)?.focus({preventScroll:true});
  asmUpdateProgress();
  asmQueueDraft(300);
}
function asmSetMark(qid,i,val){
  const marks=ASM.answers[qid]||{};marks[i]=val;ASM.answers[qid]=marks;
  asmQueueDraft(500);
}

// ── Freitext (writing): jede Änderung wird als [ms, Position, gelöscht,
// eingefügt] protokolliert. lockWords: was vor dem letzten Leerraum steht,
// ist gesperrt, Markieren ist nicht möglich. Einfügen ist immer gesperrt.
function asmWritingHtml(q){
  const a=ASM.answers[q.id]||{text:'',log:[],done:false};
  const done=!!a.done;
  return `<div class="asm-q asm-write-wrap" id="asmQ_${q.id}">
    <div class="asm-q-text">${esc(q.text)}</div>
    <textarea class="asm-write ${q.lockWords?'locked':''}" data-q="${q.id}" rows="12" spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="off" ${done?'readonly':''} placeholder="${done?'':'Hier schreiben…'}">${esc(a.text)}</textarea>
    <div class="asm-write-foot"><span id="asmWc_${q.id}">${asmWords(a.text)} Wörter${q.targetWords?` (Ziel: ca. ${q.targetWords})`:''}</span>
      ${done?'<span class="asm-locked">🔒 Abgeschlossen</span>':q.final?`<button class="btn-p" onclick="asmFinishWriting('${q.id}')">✔ Abschließen</button>`:''}</div></div>`;
}
function asmBindWriting(el){
  const qid=el.dataset.q,q=asmQuestions(ASM.section).find(x=>x.id===qid);
  ASM.prevText[qid]=el.value;
  const toEnd=()=>{const n=el.value.length;if(el.selectionStart!==n||el.selectionEnd!==n)el.setSelectionRange(n,n);};
  ['paste','drop','cut'].forEach(ev=>el.addEventListener(ev,e=>{e.preventDefault();if(ev!=='cut')toast('Einfügen ist hier nicht erlaubt.');}));
  el.addEventListener('dragstart',e=>e.preventDefault());
  if(q.lockWords){
    el.addEventListener('mousedown',e=>{e.preventDefault();el.focus();toEnd();});
    el.addEventListener('touchend',()=>setTimeout(toEnd,0));
    el.addEventListener('focus',()=>setTimeout(toEnd,0));
    el.addEventListener('select',toEnd);
    el.addEventListener('keyup',toEnd);
    el.addEventListener('keydown',e=>{
      const nav=['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'];
      if(nav.includes(e.key)||((e.ctrlKey||e.metaKey)&&['a','z','y','x','v'].includes(e.key.toLowerCase()))||e.key==='Delete'){e.preventDefault();return;}
      if(e.key==='Backspace'){const v=el.value;if(!v.length||/\s/.test(v[v.length-1])){e.preventDefault();}}
    });
  }
  el.addEventListener('input',()=>asmWritingInput(el,q));
}
function asmWritingInput(el,q){
  const qid=q.id,prev=ASM.prevText[qid]??'',next=el.value;
  const a=ASM.answers[qid]||{text:'',log:[],done:false};
  if(a.done){el.value=prev;return;}
  if(q.lockWords){
    const m=prev.match(/^[\s\S]*\s/);const locked=m?m[0]:'';
    if(!next.startsWith(locked)){el.value=prev;el.setSelectionRange(prev.length,prev.length);return;}
  }
  a.log=a.log||[];a.log.push([Math.max(0,Date.now()-ASM.sectionStart),...asmDiff(prev,next,el.selectionEnd)]);
  a.text=next;ASM.answers[qid]=a;ASM.prevText[qid]=next;
  const wc=document.getElementById('asmWc_'+qid);if(wc)wc.textContent=`${asmWords(next)} Wörter${q.targetWords?` (Ziel: ca. ${q.targetWords})`:''}`;
  asmQueueDraft(1200);
}
// Änderung zwischen zwei Textständen als [Position, gelöscht, eingefügt].
// Die Cursorposition entscheidet, wo getippt wurde (bei „Menschen“ → „Menschegen“
// wäre sonst unklar, welches „n“ neu ist); sonst gemeinsamer Anfang/Ende.
function asmDiff(prev,next,caret){
  const delta=next.length-prev.length;
  if(delta>0&&caret>=delta&&next.slice(0,caret-delta)+next.slice(caret)===prev)return [caret-delta,'',next.slice(caret-delta,caret)];
  if(delta<0&&caret<=next.length&&next===prev.slice(0,caret)+prev.slice(caret-delta))return [caret,prev.slice(caret,caret-delta),''];
  let p=0;while(p<prev.length&&p<next.length&&prev[p]===next[p])p++;
  let e1=prev.length,e2=next.length;while(e1>p&&e2>p&&prev[e1-1]===next[e2-1]){e1--;e2--;}
  return [p,prev.slice(p,e1),next.slice(p,e2)];
}
async function asmFinishWriting(qid){
  const a=ASM.answers[qid]||{text:'',log:[]};
  if(!a.text?.trim()){toast('⚠️ Der Text ist noch leer.','err');return;}
  if(!confirm('Text jetzt abschließen? Danach kann er nicht mehr verändert werden.'))return;
  a.done=true;ASM.answers[qid]=a;
  const qs=asmQuestions(ASM.section);
  if(qs.every(q=>q.type!=='writing'||!q.final||ASM.answers[q.id]?.done))return asmSubmit(true);
  await asmSaveDraft();asmRenderSection();
}

// ── Speichern, Blöcke, Uhr, Abgabe ──
function asmQueueDraft(ms){
  if(ASM.draftTimer)clearTimeout(ASM.draftTimer);
  ASM.draftTimer=setTimeout(asmSaveDraft,ms);
}
async function asmSaveDraft(){
  if(ASM.draftTimer){clearTimeout(ASM.draftTimer);ASM.draftTimer=null;}
  if(!ASM.section||ASM.submitting)return;
  try{await api('PUT','/assessment/section/draft',{section:ASM.section.index,block:ASM.block,answers:ASM.answers});}
  catch(e){if(!ASM.saveWarned){ASM.saveWarned=1;toast('⚠️ Speichern fehlgeschlagen: '+e.message,'err');}return false;}
  ASM.saveWarned=0;return true;
}
async function asmNextBlock(){
  const b=ASM.section.blocks[ASM.block];
  const open=b.questions.filter(q=>!asmIsAnswered(q)).length;
  if(open&&!confirm(`Noch ${open} Aufgabe(n) in diesem Block unbeantwortet. Trotzdem weiter? Zurück geht es nicht.`))return;
  ASM.block++;
  await asmSaveDraft();
  asmRenderSection();
  document.getElementById('main').scrollTop=0;window.scrollTo(0,0);
}
function asmUpdateProgress(){
  const el=document.getElementById('asmProgress');if(!el||!ASM.section)return;
  if(ASM.section.kind==='pause'){el.textContent='';return;}
  const qs=asmQuestions(ASM.section).filter(q=>q.type!=='writing');
  if(!qs.length){el.textContent='';return;}
  const n=qs.filter(asmIsAnswered).length;
  el.textContent=`${n} / ${qs.length} bearbeitet`;
}
function asmTick(){
  if(S.view!=='assessment'||!ASM.section){asmStopTimers();return;}
  const left=(ASM.deadline-Date.now())/1000;
  const total=ASM.section.minutes*60;
  const t=document.getElementById('asmTimer'),fill=document.getElementById('asmTimeFill'),bar=document.getElementById('asmBar');
  if(t)t.textContent=asmFmt(left);
  if(fill)fill.style.width=Math.max(0,Math.min(100,left/total*100))+'%';
  if(ASM.section.kind==='pause'){
    const btn=document.getElementById('asmPauseBtn');if(btn&&left<=0)btn.disabled=false;
    return;
  }
  if(bar){bar.classList.toggle('warn',left<=120&&left>30);bar.classList.toggle('crit',left<=30);}
  if(left<=120&&left>30&&!ASM.warned[120]){ASM.warned[120]=1;toast('⏱ Noch 2 Minuten in diesem Abschnitt!');}
  if(left<=30&&!ASM.warned[30]){ASM.warned[30]=1;toast('⚠️ Noch 30 Sekunden!','err');}
  const memoLeft=document.getElementById('asmMemoLeft');
  if(memoLeft){const bi=asmCurrentBlocks().map(([,i])=>i).find(i=>ASM.memoUntil[i]!==undefined);const ml=(ASM.memoUntil[bi]-Date.now())/1000;if(ml<=0){asmRenderSection();return;}memoLeft.textContent=Math.ceil(ml);}
  asmUpdateProgress();
  if(left<=0)asmSubmit(true,true);
}
async function asmSubmit(confirmed,timeout){
  if(ASM.submitting||!ASM.section)return;
  if(!confirmed){
    const open=asmQuestions(ASM.section).filter(q=>!asmIsAnswered(q)).length;
    if(!confirm(open?`Noch ${open} Aufgabe(n) unbeantwortet. Abschnitt trotzdem abgeben?`:'Abschnitt abgeben? Danach sind keine Änderungen mehr möglich.'))return;
  }
  ASM.submitting=true;asmStopTimers();
  if(timeout)toast('⏱ Zeit abgelaufen – Abschnitt wurde abgegeben.');
  try{await api('POST','/assessment/section/submit',{section:ASM.section.index,answers:ASM.answers});}
  catch(e){toast('⚠️ '+e.message,'err');}
  ASM.section=null;
  renderAssessment();
}

// ── Ergebnisse (nur Administration) ──
function asmPctCell(r){
  if(!r)return '<td style="color:var(--di)">–</td>';
  if(!r.scored)return `<td style="font-size:11px;color:var(--mu)">${r.kind==='pause'?'☕':'✓'}</td>`;
  const c=r.percent>=70?'var(--ok)':r.percent>=50?'var(--warn)':'var(--danger)';
  return `<td><span style="font-weight:700;color:${c}">${r.percent} %</span><div style="font-size:10px;color:var(--mu)">${r.points}/${r.max}${r.late?' · Zeit':''}</div></td>`;
}
function asmResultsHtml(){
  const list=ASM.results||[];
  const secs=ASM.info.sections.filter(s=>s.kind!=='pause');
  const rows=list.map(a=>{
    const byKey={};(a.results||[]).forEach(r=>byKey[r.key]=r);
    const pers=(a.results||[]).find(r=>r.dims);
    const ctrl=pers?.dims?.find(d=>d.control);
    const status=a.status==='finished'?`✅ ${fdt(a.finishedAt)}`:`⏳ läuft (Abschnitt ${a.currentSection+1})`;
    const open=ASM.openResult===a.id;
    return `<tr><td style="text-align:left;font-weight:600">${esc(a.userName)}</td><td style="text-align:left;font-size:11px">${status}${a.outdated?'<div style="color:var(--warn)">alte Version</div>':''}</td>
      ${a.outdated?`<td colspan="${secs.length}" style="font-size:11px;color:var(--mu)">Durchgang mit dem früheren Fragenkatalog</td>`:secs.map(s=>asmPctCell(byKey[s.key])).join('')}
      <td>${a.summary.percent!==null?`<b>${a.summary.percent} %</b><div style="font-size:10px;color:var(--mu)">${a.summary.points}/${a.summary.max}</div>`:'–'}</td>
      <td style="font-size:11px">${ctrl?.level?asmLevelBadge(ctrl.level):'–'}</td>
      <td style="white-space:nowrap"><button class="btn-s" style="font-size:11px" onclick="ASM.openResult=${open?'null':`'${a.id}'`};asmRenderOverview()">${open?'Schließen':'Details'}</button>
        <button class="btn-d" style="font-size:11px" title="Zurücksetzen" onclick="asmReset('${a.id}','${esc(a.userName).replace(/'/g,'')}')">↺</button></td></tr>
      ${open?`<tr><td colspan="${secs.length+5}" style="text-align:left;background:var(--sf2)">${asmDetailHtml(a)}</td></tr>`:''}`;
  }).join('');
  return `<div class="dash-card" style="border-top-color:var(--info)">
    <div style="font-size:15px;font-weight:700;margin-bottom:4px">📊 Ergebnisse (nur für Administratoren sichtbar)</div>
    <div style="font-size:12px;color:var(--mu);margin-bottom:10px">„Zeit“ = Abschnitt wurde durch Zeitablauf beendet. „Kontrolle“ = Ehrlichkeitskontrolle der Persönlichkeitsfragen. Unter „Details“ siehst du jede Antwort, die Persönlichkeitsprofile und bei den Texten jede einzelne Korrektur.</div>
    ${list.length?`<div style="overflow-x:auto"><table class="rm-table asm-res"><thead><tr><th style="text-align:left">Mitarbeiter</th><th style="text-align:left">Status</th>${secs.map(s=>`<th>${esc(s.short||s.title)}</th>`).join('')}<th>Gesamt</th><th>Kontrolle</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`:'<div class="empty" style="padding:16px">Noch keine Durchgänge.</div>'}
  </div>`;
}
function asmLevelBadge(l){
  const c=l==='unauffällig'?'var(--ok)':l==='auffällig'?'var(--warn)':'var(--danger)';
  return `<span style="font-weight:700;color:${c}">${esc(l)}</span>`;
}
const asmMark=ok=>ok?'<span class="rm-yes">✓</span>':'<span style="color:var(--danger);font-weight:700">✗</span>';
const asmNone='<i style="color:var(--di)">keine Antwort</i>';
function asmDetailHtml(a){
  if(a.outdated)return '<i>Details sind für Durchgänge mit dem früheren Fragenkatalog nicht verfügbar.</i>';
  return (a.results||[]).filter(r=>r.kind!=='pause').map(r=>{
    const head=`<div class="asm-det-head"><b>${esc(r.title)}</b>${r.scored?` – ${r.points}/${r.max} Punkte (${r.percent} %)`:''}${r.late?' · durch Zeitablauf beendet':''}</div>`;
    const dims=r.dims?asmDimsHtml(r.dims):'';
    const blocks=(r.blocks||[]).map(b=>{
      const scoredRows=b.details.filter(d=>d.type!=='writing'&&d.type!=='markwords');
      let h=(r.blocks.length>1?`<div class="asm-det-block">${esc(b.title)}${b.max?` – ${b.points}/${b.max}`:''}</div>`:'');
      b.details.filter(d=>d.type==='markwords').forEach(d=>h+=asmMarkwordsDetail(d));
      b.details.filter(d=>d.type==='writing').forEach(d=>h+=asmWritingDetail(d));
      if(scoredRows.length)h+=`<table class="asm-det"><tbody>${scoredRows.map(d=>d.type==='likert'
        ?`<tr><td></td><td>${esc(d.text)}</td><td>${d.given===null?asmNone:`<b>${d.given}</b>`}</td><td></td></tr>`
        :`<tr><td>${asmMark(d.correct)}</td><td>${esc(d.text)}</td><td>${d.given===null?asmNone:esc(d.given)}</td><td style="color:var(--mu)">${d.correct?'':'richtig: '+esc(d.expected)}</td></tr>`).join('')}</tbody></table>`;
      return h;
    }).join('');
    return `<div class="asm-det-sec">${head}${dims}${blocks}</div>`;
  }).join('')||'<i>Noch keine Abschnitte abgegeben.</i>';
}
function asmDimsHtml(dims){
  return `<div class="asm-dims">${dims.map(d=>d.control
    ?`<div class="asm-dim ctrl"><span>${esc(d.label)}</span><span>Ø ${d.score??'–'} ${d.level?'· '+asmLevelBadge(d.level):''}</span></div>`
    :`<div class="asm-dim"><span class="asm-dim-l">${esc(d.a)}</span><div class="asm-dim-bar">${d.score!==null?`<i style="left:${(d.score-1)/4*100}%"></i>`:''}</div><span class="asm-dim-r">${esc(d.b)}</span><b>${d.score??'–'}</b><span class="asm-dim-name">${esc(d.label)}</span></div>`).join('')}</div>
    <div style="font-size:11px;color:var(--mu);margin:2px 0 8px">Skala 1 (linker Pol) bis 5 (rechter Pol), 3 = ausgeglichen. Ehrlichkeitskontrolle: hohe Zustimmung zu kaum erfüllbaren Aussagen deutet auf sozial erwünschtes Antworten hin.</div>`;
}
function asmMarkwordsDetail(d){
  return `<table class="asm-det"><thead><tr><th></th><th>Fehler</th><th>richtig</th><th>Markiert</th><th>Verbesserung</th></tr></thead><tbody>
    ${d.found.map(f=>`<tr><td>${asmMark(f.marked&&f.corrected)}</td><td>${esc(f.wrong)}</td><td>${esc(f.right)}</td><td>${f.marked?'ja':'<span style="color:var(--danger)">nein</span>'}</td><td>${f.marked?(f.given?esc(f.given):asmNone)+(f.corrected?'':' <span style="color:var(--danger)">✗</span>'):''}</td></tr>`).join('')}
    ${d.falseMarks.map(f=>`<tr><td><span style="color:var(--danger);font-weight:700">−1</span></td><td colspan="2">zu Unrecht markiert: <b>${esc(f.word)}</b></td><td></td><td>${esc(f.given||'')}</td></tr>`).join('')}
  </tbody></table><div style="font-size:11px;color:var(--mu);margin-bottom:8px">${d.points}/${d.max} Punkte (je Fehler 1 fürs Markieren, 1 fürs Verbessern, −1 je falscher Markierung)</div>`;
}
// Korrektur-Ansicht: alle getippten Zeichen; gelöschte rot durchgestrichen,
// nachträglich mitten im Text eingefügte grün.
function asmReplay(log,upto){
  const chars=[];
  const n=upto===undefined?log.length:upto;
  for(let k=0;k<n;k++){
    const [,p,d,i]=log[k];
    const vis=[];chars.forEach((c,idx)=>{if(c.s!=='del')vis.push(idx);});
    for(let j=0;j<d.length;j++){const idx=vis[p+j];if(idx!==undefined)chars[idx].s='del';}
    const at=p<vis.length?vis[p]:chars.length;
    const late=p<vis.length-d.length;
    chars.splice(at,0,...[...i].map(c=>({c,s:late?'late':'n'})));
  }
  return chars;
}
function asmCharsHtml(chars){
  let h='',cur=null,buf='';
  const flush=()=>{if(!buf)return;h+=cur==='del'?`<del>${esc(buf)}</del>`:cur==='late'?`<ins>${esc(buf)}</ins>`:esc(buf);buf='';};
  chars.forEach(c=>{if(c.s!==cur){flush();cur=c.s;}buf+=c.c;});
  flush();return h;
}
function asmWritingDetail(d){
  const s=d.stats||{},log=d.log||[];
  const id='asmRp_'+d.id+'_'+Math.random().toString(36).slice(2,7);
  ASM._logs=ASM._logs||{};ASM._logs[id]=log;
  return `<div class="asm-wd">
    <div class="asm-wd-q">${esc(d.text)}</div>
    <div class="asm-wd-stats"><span>${s.words||0} Wörter</span><span>${s.chars||0} Zeichen</span><span>${s.corrections||0} Korrekturen</span><span>${s.deletedChars||0} gelöschte Zeichen</span><span>Schreibzeit ${asmFmt(s.seconds||0)}</span><span>${d.done?'🔒 abgeschlossen':'⏱ nicht abgeschlossen (Zeitablauf)'}</span></div>
    <div class="asm-wd-label">Endtext</div><div class="asm-wd-text">${d.given?esc(d.given):asmNone}</div>
    <div class="asm-wd-label">Korrekturen <span style="font-weight:400">(<del>gelöscht</del>, <ins>nachträglich eingefügt</ins>)</span></div><div class="asm-wd-text">${log.length?asmCharsHtml(asmReplay(log)):asmNone}</div>
    ${log.length?`<div class="asm-wd-label">Wiedergabe des Schreibprozesses</div>
    <div class="asm-wd-play"><button class="btn-s" onclick="asmPlay('${id}')">▶ Abspielen</button><input type="range" min="0" max="${log.length}" value="${log.length}" id="${id}_r" oninput="asmShowStep('${id}',+this.value)"><span id="${id}_t" style="font-size:11px;color:var(--mu)"></span></div>
    <div class="asm-wd-text" id="${id}">${asmCharsHtml(asmReplay(log))}</div>`:''}
  </div>`;
}
function asmShowStep(id,k){
  const log=ASM._logs?.[id];if(!log)return;
  const el=document.getElementById(id),t=document.getElementById(id+'_t'),r=document.getElementById(id+'_r');
  if(el)el.innerHTML=asmCharsHtml(asmReplay(log,k));
  if(t)t.textContent=k?asmFmt(log[k-1][0]/1000):'00:00';
  if(r&&+r.value!==k)r.value=k;
}
function asmPlay(id){
  const log=ASM._logs?.[id];if(!log)return;
  if(ASM._play)clearInterval(ASM._play);
  let k=0;
  ASM._play=setInterval(()=>{k=Math.min(log.length,k+Math.max(1,Math.ceil(log.length/400)));asmShowStep(id,k);if(k>=log.length||!document.getElementById(id)){clearInterval(ASM._play);ASM._play=null;}},40);
}
async function asmReset(id,name){
  if(!confirm(`Assessment von ${name} zurücksetzen? Alle Antworten werden gelöscht und der Mitarbeiter kann neu beginnen.`))return;
  try{await api('DELETE','/assessment/attempts/'+id);toast('✅ Zurückgesetzt');renderAssessment();}catch(e){toast('⚠️ '+e.message,'err');}
}
