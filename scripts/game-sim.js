'use strict';
// Balancing-Simulation für Desk Empire: ein gieriger Bot spielt mit der
// echten Spiellogik (lib/game-logic.js) und protokolliert, wann er welche
// Etappe erreicht. Aufruf: node scripts/game-sim.js [aktiv|gelegentlich] [Stunden Datei]
// Mit Stunden und Datei wird der Spielstand zu diesem Zeitpunkt als
// Client-Ansicht (JSON) gespeichert, z.B. für Screenshots der Oberfläche.
const GL = require('../lib/game-logic');
const mode = process.argv[2] || 'aktiv';
const CLICKS_PER_SEC = 3;
// aktiv: 8 Stunden durchgehend online. gelegentlich: 4× täglich 30 Min.
// online (alle 6 Stunden), 14 Tage lang.
const T0 = Date.UTC(2026,0,1);
const online = t => mode==='aktiv' ? true : (((t-T0)/60000) % 360) < 30;

const clone = s => JSON.parse(JSON.stringify(s));
function steadyNet(s, now){
  const c = clone(s);
  const f0 = GL.financials(c, now);
  for (let i=0;i<4;i++) for (const e of c.employees) GL.tickEmployeeWellbeing(e, 30, f0.agg, c.employees.length, false);
  const f = GL.financials(c, now);
  return f.netPerMinute + (online(now) ? CLICKS_PER_SEC*60*f.fx.clickValue : 0);
}
function candidates(s){
  const out=[];
  for (const o of GL.OBJECTS) if (o.cat!=='platz') out.push({k:'obj', id:o.id, run:x=>GL.buyObject(x,o.id)});
  for (const p of GL.POLICIES) out.push({k:'pol', id:p.id, run:x=>GL.buyPolicy(x,p.id)});
  for (const u of GL.UPGRADES) out.push({k:'upg', id:u.id, run:x=>GL.buyUpgrade(x,u.id)});
  for (const c of GL.EMPLOYEE_CLASSES){
    out.push({k:'hire', id:c.id, run:(x,now)=>GL.hire(x,c.id,now)});
    for (const d of ['desk','desk_ergo','desk_dbl']) out.push({k:'desk+hire', id:d+'+'+c.id, run:(x,now)=>{GL.buyObject(x,d);GL.hire(x,c.id,now);}});
  }
  return out;
}
function bestMove(s, now){
  const base = steadyNet(s, now);
  let best=null;
  for (const c of candidates(s)){
    const x = clone(s); const coins0 = x.coins;
    x.coins = 1e15;
    let sold = null;
    // Kein Platz frei? Dann das schwächste Deko-Stück ersetzen (Verkauf zählt mit)
    if (x.layout.length >= GL.stageSlots(x.stage) && (c.k==='obj' || c.k==='desk+hire')) {
      const w = x.layout.map((id,i)=>({id,i,o:GL.OBJECTS_BY_ID[id]})).filter(y=>y.o.cat==='deko').sort((a,b)=>a.o.income-b.o.income)[0];
      if (!w || w.id===c.id) continue;
      GL.sellObject(x, w.i, now); sold = w.i;
    }
    try { c.run(x, now); } catch(e){ continue; }
    const cost = 1e15 - x.coins; x.coins = coins0 - cost;
    const gain = steadyNet(x, now) - base;
    if (gain <= 0) continue;
    const score = cost/gain; // Amortisation in Minuten
    if (!best || score < best.score) best = { ...c, cost, gain, score, sold };
  }
  return best;
}
let now = T0;
let s = GL.newState(now);
const T_END = now + (mode==='aktiv' ? 8 : 14*24)*3600e3;
let lastMove = 0;
const dumpAt = process.argv[3] ? T0 + parseFloat(process.argv[3])*3600e3 : null;
const marks = {};
const log = (m)=>console.log(((now-T0)/3600e3).toFixed(2).padStart(7)+' h  '+m);
let lastReport = 0, wait = null;
while (now < T_END){
  if (dumpAt && now >= dumpAt){ require('fs').writeFileSync(process.argv[4], JSON.stringify(GL.view(s, now))); console.log('gespeichert: '+process.argv[4]); break; }
  const step = online(now) ? 5000 : 300000;
  now += step;
  GL.tick(s, now);
  if (online(now)){
    GL.click(s, CLICKS_PER_SEC*step/1000, now);
    if (s.order && !s.order.active) { if (s.order.type==='clicks' && s.order.target > CLICKS_PER_SEC*110) GL.declineOrder(s, now); else GL.acceptOrder(s, now); }
    // Umzug hat Vorrang, sobald möglich
    const nx = GL.STAGES.find(x=>x.id===s.stage+1);
    if (nx && s.level>=nx.minLevel){
      if (s.coins>=nx.cost){ GL.moveStage(s); log('UMZUG → '+nx.name+' (Level '+s.level+')'); }
    } else if (now - lastMove >= 30000) {
      lastMove = now;
      for (let k=0;k<5;k++){
        const m = bestMove(s, now);
        if (!m) break;
        // Platz voll? schwächstes Deko-Objekt verkaufen, wenn das Neue besser ist
        if (s.coins < m.cost) break;
        if (m.sold !== null) GL.sellObject(s, m.sold, now);
        try { m.run(s, now); } catch(e){ break; }
      }
    }
  }
  GL.checkAchievements(s, now);
  if (now - lastReport >= (mode==='aktiv' ? 1800e3 : 24*3600e3)){
    lastReport = now;
    const f = GL.financials(s, now);
    log(`Lvl ${s.level} Etappe ${s.stage} Plätze ${s.layout.length}/${GL.stageSlots(s.stage)} MA ${s.employees.length} netto ${Math.round(f.netPerMinute)}/min Konto ${Math.round(s.coins)} ⌀G ${Math.round(s.employees.reduce((a,e)=>a+e.health,0)/(s.employees.length||1))} ⌀Z ${Math.round(s.employees.reduce((a,e)=>a+e.satisfaction,0)/(s.employees.length||1))} Aufträge ${s.stats.ordersDone}`);
  }
}
console.log('Objekte:', JSON.stringify(s.objects)); console.log('Team:', JSON.stringify(s.employees.reduce((a,e)=>(a[e.classId]=(a[e.classId]||0)+1,a),{}))); console.log('Upgrades:', s.upgrades.join(','), 'Regelungen:', Object.keys(s.policies).join(','));
