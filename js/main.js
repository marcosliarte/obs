/* =========================================================================
   Inicialização + polling do OBS
========================================================================= */

/* partes da config que só mexem em widgets — mudar isso não recria a cena */
function structuralKey(c) {
  const { SP, goal, pinned, pinnedFor, alertTest, countdown, recent, _editor, ...rest } = c;
  return JSON.stringify(rest) + '|' + SP.enabled;
}

/* aplica uma config recebida do Supabase (OBS, ou outro painel que salvou) */
let _lastRaw = '', _lastKey = '';
function applyRemote(fresh) {
  const str = JSON.stringify(fresh);
  if (str === _lastRaw) return false;
  _lastRaw = str;
  setConfig(fresh);
  const key = structuralKey(cfg);
  if (key !== _lastKey) { _lastKey = key; renderScene(); chatSync(); }
  else { renderWidgets(); tickClocks(); }
  checkAlertTest();
  return true;
}

/* OBS: Realtime avisa na hora; polling rápido só se o Realtime cair */
function startObsSync() {
  let busy = false;
  const pull = async () => {
    if (busy) return;
    busy = true;
    try { const fresh = await Store.load(); if (fresh) applyRemote(fresh); } finally { busy = false; }
  };
  Store.realtime(pull);
  const loop = async () => {
    await pull();
    setTimeout(loop, Store.rt.joined ? 15000 : POLL_INTERVAL);
  };
  setTimeout(loop, POLL_INTERVAL);
}

/* Painel: se outro painel (PC, celular) salvar, adota a versão dele em vez
   de sobrescrever na próxima edição */
function startPanelSync() {
  const pull = async () => {
    if (_saveTimer || Date.now() - Store.lastSaveAt < 3000) return;   /* edição local pendente */
    const fresh = await Store.load();
    const ed = fresh && fresh._editor;
    if (!ed || !ed.id || ed.id === EDITOR_ID || ed.at <= cfg._editor.at) return;
    const spEnabled = cfg.SP.enabled;
    if (applyRemote(fresh)) {
      syncPanelFields();
      if (cfg.SP.enabled !== spEnabled) spSync();
      Store.status('ok', 'Atualizado por outro painel');
    }
  };
  Store.realtime(pull);
  setInterval(() => { if (!Store.rt.joined) pull(); }, 15000);
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

  _lastRaw = JSON.stringify(raw);
  _lastKey = structuralKey(cfg);
  if (!OFFLINE) {
    if (isOBS) startObsSync();
    else startPanelSync();
  }

  document.documentElement.dataset.skReady = '1';
}

boot();
