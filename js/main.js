/* =========================================================================
   Inicialização + polling do OBS
========================================================================= */

/* partes da config que só mexem em widgets — mudar isso não recria a cena */
function structuralKey(c) {
  const { SP, goal, pinned, alertTest, countdown, ...rest } = c;
  return JSON.stringify(rest) + '|' + SP.enabled;
}

async function boot() {
  if (isOBS) {
    document.documentElement.classList.add('obs');
    document.body.classList.add('obs');
  }

  const raw = await Store.load();
  setConfig(raw || {});

  if (!isOBS) {
    spLoadTokens();
    initPanel();
    const code = params.get('code');
    if (code && await spExchangeCode(code)) { panelToast('Spotify conectado'); scheduleSave(); }
    syncPanelFields();
  }

  renderScene();
  chatSync();
  checkAlertTest();
  spSync();

  setInterval(tickClocks, 1000);
  window.addEventListener('resize', () => { fitStage(); applyBackground(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (isOBS) applyBackground(); });

  if (DEBUG) {
    const tag = document.createElement('div');
    tag.className = 'debug-tag';
    tag.textContent = `v${APP_VERSION} · ${OVERLAY_ID} · ${new Date().toLocaleTimeString()}`;
    document.body.appendChild(tag);
  }

  if (isOBS && !OFFLINE) {
    let lastRaw = JSON.stringify(raw);
    let lastKey = structuralKey(cfg);
    setInterval(async () => {
      const fresh = await Store.load();
      if (!fresh) return;
      const str = JSON.stringify(fresh);
      if (str === lastRaw) return;
      lastRaw = str;
      setConfig(fresh);
      const key = structuralKey(cfg);
      if (key !== lastKey) { lastKey = key; renderScene(); chatSync(); }
      else { renderWidgets(); tickClocks(); }
      checkAlertTest();
    }, POLL_INTERVAL);
  }

  document.documentElement.dataset.skReady = '1';
}

boot();
