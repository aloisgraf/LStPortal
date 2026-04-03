// ══ AUTH ══
let _lu=[];
async function loadLoginUsers(){
  try{_lu=await api('GET','/auth/users');}catch(e){_lu=[];}
  const sel=document.getElementById('luSel');
  sel.innerHTML='<option value="">— Benutzer wählen —</option>'+_lu.map(u=>`<option value="${u.id}">${u.name}  (${(u.roles||['standard']).map(r=>getRD(r).icon).join('')})</option>`).join('');
  document.getElementById('lpw').value='';
  document.getElementById('lerr').style.display='none';
}
async function doLogin(){
  const sel=document.getElementById('luSel').value;
  if(!sel){toast('⚠️ Bitte Benutzer wählen!');return;}
  try{
    loading(true);
    const res=await api('POST','/auth/login',{userId:sel,password:document.getElementById('lpw').value});
    S.currentUser=res.userId;
    if(res.mustChangePW){
      document.getElementById('LS').classList.remove('open');
      document.getElementById('np1').value='';document.getElementById('np2').value='';
      document.getElementById('CPWS').classList.add('open');
    }else{await fetchData();loginOK();}
  }catch(e){document.getElementById('lerr').style.display='block';document.getElementById('lpw').value='';}
  finally{loading(false);}
}
async function doForcePW(){
  const p1=document.getElementById('np1').value,p2=document.getElementById('np2').value;
  if(p1.length<6){toast('⚠️ Min. 6 Zeichen!');return;}
  if(p1!==p2){toast('⚠️ Passwörter stimmen nicht überein!');return;}
  try{
    loading(true);
    await fetch('/api/auth/change-password',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({currentPassword:'',newPassword:p1})});
    document.getElementById('CPWS').classList.remove('open');
    await fetchData();loginOK();
  }catch(e){toast('⚠️ '+e.message);}
  finally{loading(false);}
}
function loginOK(){
  document.getElementById('LS').classList.remove('open');
  document.getElementById('hdr').style.display='flex';
  document.getElementById('APP').style.display='grid';
  const u=getU(S.currentUser);
  document.getElementById('pillNm').textContent=u?.name||'?';
  const pa=document.getElementById('pillAv');
  pa.textContent=u?.initials||'?';pa.style.background=(u?.color||'#888')+'22';pa.style.color=u?.color||'#888';
  document.getElementById('ni-admin').style.display=S.permissions.isAdmin?'flex':'none';
  setView('dashboard');
  toast(`👋 Willkommen, ${u?.name||''}!`);
  setInterval(pollActive,60000);pollActive();
}
async function logout(){
  loading(true);try{await api('POST','/auth/logout');}catch(e){}finally{loading(false);}
  S.currentUser=null;
  document.getElementById('hdr').style.display='none';document.getElementById('APP').style.display='none';
  await loadLoginUsers();document.getElementById('LS').classList.add('open');
}
async function doChangePW(){
  const c=document.getElementById('cpw0').value,n=document.getElementById('cpw1').value,n2=document.getElementById('cpw2').value;
  if(n.length<6){toast('⚠️ Min. 6 Zeichen!');return;}
  if(n!==n2){toast('⚠️ Passwörter stimmen nicht!');return;}
  try{await api('POST','/auth/change-password',{currentPassword:c,newPassword:n});closeModal('pwModal');toast('✅ Passwort geändert!');}
  catch(e){toast('⚠️ '+e.message,'err');}
}
async function pollActive(){
  try{S.activeUsers=await api('GET','/active-users');}catch(e){S.activeUsers=[];}
  if(S.view==='dashboard')renderMain();
}

// ══ NAVIGATION ══
function toggleNS(id){
  document.getElementById(id+'Hdr').classList.toggle('open');
  document.getElementById(id+'Sub').classList.toggle('open');
}
function setView(v){
  S.view=v;
  ['dashboard','schedule','allw','tickets','tickets_closed','checklists','messages'].forEach(x=>{
    const el=document.getElementById('ni-'+x);if(el)el.classList.toggle('active',x===v);
  });
  renderSBF();renderMain();closeMob();
}

