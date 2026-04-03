// ══ BOOT – wird als letztes geladen, alle anderen Scripts sind bereits verfügbar ══
document.addEventListener('keydown', e => {
  if (e.key === 'Escape')
    ['evtOv','pwModal','allwOv','tkFormOv','tkDetOv','admOv','ufOv','cfOv','tfOv','clFormOv','msgFormOv']
      .forEach(closeModal);
});
['evtOv','pwModal','allwOv','tkFormOv','tkDetOv','admOv','ufOv','cfOv','tfOv','clFormOv','msgFormOv']
  .forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', e => { if (e.target === el) closeModal(id); });
  });

(async () => {
  // Theme
  const theme = localStorage.getItem('lst_theme') || 'light';
  document.documentElement.setAttribute('data-theme', theme);
  document.getElementById('thBtn').textContent = theme === 'dark' ? '☀️' : '🌙';

  // Login-Dropdown befüllen
  await loadLoginUsers();
  document.getElementById('LS').classList.add('open');

  // Prüfen ob noch eine Session aktiv ist
  try {
    loading(true);
    const me = await api('GET', '/auth/me');
    if (me?.userId) {
      S.currentUser = me.userId;
      await fetchData();
      loginOK();
    }
  } catch (e) {
    // Keine aktive Session – Login-Screen bleibt sichtbar
  } finally {
    loading(false);
  }
})();
