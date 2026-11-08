/* =========================================================================
   Encaixe no OBS — obs-websocket 5 (já vem no OBS 28 ou mais novo)
   O painel conecta em ws://127.0.0.1:4455, lista as fontes da cena do OBS
   e ajusta posição, escala e corte de cada uma para preencher exatamente as
   janelas do overlay. Nada de recortar à mão com Alt.
   Endereço, senha e o mapeamento janela → fonte ficam só neste navegador
   (nunca vão para o Supabase).
========================================================================= */
const ObsWS = { ws: null, ok: false, pending: new Map(), seq: 0, video: null, scenes: [], items: [], itemsScene: '', error: '' };

const OBS_PREFS = 'sk_obs';
const CAM_KINDS = ['dshow_input', 'av_capture_input', 'macos-avcapture', 'v4l2_input'];
const GAME_KINDS = ['game_capture', 'window_capture', 'monitor_capture', 'display_capture', 'screen_capture', 'xcomposite_input', 'pipewire-screen-capture-source'];
const VIDEO_KINDS = ['browser_source', 'ffmpeg_source', 'vlc_source', 'window_capture', 'monitor_capture', 'display_capture', 'screen_capture'];

function obsPrefs() {
  const p = safeStorage(() => JSON.parse(localStorage.getItem(OBS_PREFS) || 'null'), null) || {};
  return { url: p.url || 'ws://127.0.0.1:4455', password: p.password || '', map: p.map || {} };
}
function obsSavePrefs(p) { safeStorage(() => localStorage.setItem(OBS_PREFS, JSON.stringify(p))); }
const obsMapKey = () => cfg.state.scene + '/' + cfg.state.format;

async function sha256b64(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function obsCall(requestType, requestData) {
  return new Promise((res, rej) => {
    if (!ObsWS.ok) { rej(new Error('OBS desconectado')); return; }
    const requestId = 'sk' + (++ObsWS.seq);
    ObsWS.pending.set(requestId, { res, rej });
    ObsWS.ws.send(JSON.stringify({ op: 6, d: { requestType, requestId, requestData: requestData || {} } }));
  });
}

function obsDisconnect() {
  if (ObsWS.ws) { try { ObsWS.ws.close(); } catch (_) {} }
  ObsWS.ws = null; ObsWS.ok = false;
}

function obsConnect(url, password) {
  obsDisconnect();
  return new Promise((resolve, reject) => {
    let ws;
    try { ws = new WebSocket(url, 'obswebsocket.json'); } catch (_) { reject(new Error('Endereço inválido')); return; }
    ObsWS.ws = ws;
    let authFail = false;
    const timer = setTimeout(() => { reject(new Error('O OBS não respondeu')); try { ws.close(); } catch (_) {} }, 6000);
    ws.onmessage = async e => {
      let m; try { m = JSON.parse(e.data); } catch (_) { return; }
      if (m.op === 0) {                       /* Hello */
        const d = { rpcVersion: 1, eventSubscriptions: 0 };
        const a = m.d && m.d.authentication;
        if (a) {
          if (!password) { authFail = true; ws.close(); return; }
          d.authentication = await sha256b64((await sha256b64(password + a.salt)) + a.challenge);
        }
        ws.send(JSON.stringify({ op: 1, d }));
      } else if (m.op === 2) {                /* Identified */
        clearTimeout(timer);
        ObsWS.ok = true;
        resolve();
      } else if (m.op === 7) {                /* RequestResponse */
        const p = ObsWS.pending.get(m.d.requestId);
        if (!p) return;
        ObsWS.pending.delete(m.d.requestId);
        const st = m.d.requestStatus || {};
        if (st.result) p.res(m.d.responseData || {});
        else p.rej(new Error(st.comment || 'erro ' + st.code));
      }
    };
    ws.onclose = e => {
      clearTimeout(timer);
      const wasOk = ObsWS.ok;
      if (ObsWS.ws === ws) { ObsWS.ws = null; ObsWS.ok = false; }
      for (const p of ObsWS.pending.values()) p.rej(new Error('Conexão com o OBS fechada'));
      ObsWS.pending.clear();
      if (!wasOk) reject(new Error(authFail ? 'O OBS pede senha' : e.code === 4009 ? 'Senha incorreta'
        : 'Não conectou. No OBS: Ferramentas → Configurações do servidor WebSocket → Ativar'));
      else panelToast('OBS desconectado', 'err');
      obsRenderUI();
    };
  });
}

/* cenas, resolução do canvas e fontes da cena escolhida */
async function obsRefresh() {
  ObsWS.video = await obsCall('GetVideoSettings');
  const list = await obsCall('GetSceneList');
  ObsWS.scenes = (list.scenes || []).slice().sort((a, b) => b.sceneIndex - a.sceneIndex).map(s => s.sceneName);
  const prefs = obsPrefs(), saved = prefs.map[obsMapKey()];
  const scene = saved && ObsWS.scenes.includes(saved.obsScene) ? saved.obsScene : list.currentProgramSceneName || ObsWS.scenes[0];
  await obsLoadItems(scene);
}

async function obsLoadItems(sceneName) {
  ObsWS.itemsScene = sceneName;
  ObsWS.items = [];
  if (!sceneName) return;
  const r = await obsCall('GetSceneItemList', { sceneName });
  ObsWS.itemCount = (r.sceneItems || []).length;
  const items = (r.sceneItems || []).filter(i => !i.isGroup);
  /* reconhece a fonte Navegador do próprio overlay (URL com obs=1) */
  for (const it of items) {
    if (it.inputKind !== 'browser_source') continue;
    try {
      const s = await obsCall('GetInputSettings', { inputName: it.sourceName });
      it.isOverlay = /[?&]obs=1/.test(String((s.inputSettings || {}).url || ''));
    } catch (_) { /* fonte sem configurações legíveis */ }
  }
  ObsWS.items = items;
}

/* sugestão inicial: webcam → captura de vídeo, jogo → captura de jogo… */
function obsGuess(key, used) {
  const kinds = key.startsWith('cam') || key === 'irl' ? CAM_KINDS : key === 'game' ? GAME_KINDS : VIDEO_KINDS;
  for (const kind of kinds) {
    const it = ObsWS.items.find(i => i.inputKind === kind && !i.isOverlay && !used.has(i.sourceName));
    if (it) return it.sourceName;
  }
  return '';
}

function obsCurrentMap() {
  const prefs = obsPrefs();
  const saved = prefs.map[obsMapKey()];
  const map = saved && saved.obsScene === ObsWS.itemsScene ? saved : { obsScene: ObsWS.itemsScene, items: {} };
  if (ObsWS.ok) {
    const used = new Set(Object.values(map.items).map(i => i.source).filter(Boolean));
    for (const r of holeRects()) {
      if (map.items[r.key]) continue;
      const source = obsGuess(r.key, used);
      if (source) used.add(source);
      map.items[r.key] = { source, mode: 'cover' };
    }
  }
  return map;
}

function obsStoreMap(map) {
  const prefs = obsPrefs();
  prefs.map[obsMapKey()] = map;
  obsSavePrefs(prefs);
}

/* ---------- UI no painel ---------- */
function obsRenderUI() {
  const list = $('#fitList');
  if (!list || isOBS) return;
  const [W, H] = SK.SIZES[cfg.state.format];
  const connected = ObsWS.ok;
  const map = obsCurrentMap();
  const sources = ObsWS.items.filter(i => !i.isOverlay);
  const opts = sel => `<option value="">— não mexer —</option>` + sources.map(i =>
    `<option value="${SK.escapeHtml(i.sourceName)}"${i.sourceName === sel ? ' selected' : ''}>${SK.escapeHtml(i.sourceName)}</option>`).join('');

  const rects = holeRects();
  list.innerHTML = rects.length ? rects.map(r => {
    const m = map.items[r.key] || { source: '', mode: 'cover' };
    return `
      <div class="fit-row">
        <div class="fit-head"><b>${SK.escapeHtml(r.label)}</b><span class="mono">${r.x}, ${r.y} · ${r.w} × ${r.h} · ${SK.aspectLabel(r.w, r.h)}</span></div>
        ${connected ? `
        <div class="fit-ctl">
          <select data-fit-src="${r.key}">${opts(m.source)}</select>
          <select data-fit-mode="${r.key}">
            <option value="cover"${m.mode !== 'contain' ? ' selected' : ''}>Preencher (corta)</option>
            <option value="contain"${m.mode === 'contain' ? ' selected' : ''}>Caber inteira</option>
          </select>
        </div>` : ''}
      </div>`;
  }).join('') : '<p class="note">Esta cena não tem janelas para fontes.</p>';

  $('#fitCanvas').textContent = `Overlay ${W} × ${H}` + (ObsWS.video ? ` · canvas do OBS ${ObsWS.video.baseWidth} × ${ObsWS.video.baseHeight}` : '');
  $('#obsTools').hidden = !connected;
  $('#obsConnectBtn').textContent = connected ? 'Desconectar' : 'Conectar ao OBS';
  const st = $('#obsState');
  st.textContent = connected ? 'Conectado' : ObsWS.error || 'Desconectado';
  st.dataset.kind = connected ? 'ok' : ObsWS.error ? 'warn' : 'idle';
  if (connected) {
    $('#obsScene').innerHTML = ObsWS.scenes.map(s =>
      `<option value="${SK.escapeHtml(s)}"${s === ObsWS.itemsScene ? ' selected' : ''}>${SK.escapeHtml(s)}</option>`).join('');
  }
  const prefs = obsPrefs();
  if (document.activeElement !== $('#obsUrl')) $('#obsUrl').value = prefs.url;
}

async function obsToggle() {
  if (ObsWS.ok) { obsDisconnect(); ObsWS.error = ''; obsRenderUI(); return; }
  const prefs = obsPrefs();
  prefs.url = $('#obsUrl').value.trim() || 'ws://127.0.0.1:4455';
  if ($('#obsPass').value) prefs.password = $('#obsPass').value;
  obsSavePrefs(prefs);
  $('#obsState').textContent = 'Conectando…';
  try {
    await obsConnect(prefs.url, prefs.password);
    await obsRefresh();
    ObsWS.error = '';
    $('#obsPass').value = '';
    panelToast('Conectado ao OBS');
  } catch (e) {
    ObsWS.error = e.message;
    obsDisconnect();
  }
  obsRenderUI();
}

/* aplica o encaixe de todas as janelas mapeadas da cena atual */
async function obsFitNow() {
  if (!ObsWS.ok) return;
  try {
    ObsWS.video = await obsCall('GetVideoSettings');
    await obsLoadItems(ObsWS.itemsScene);
  } catch (e) { panelToast('OBS: ' + e.message, 'err'); return; }
  const sceneName = ObsWS.itemsScene;
  const [W, H] = SK.SIZES[cfg.state.format];
  const kx = ObsWS.video.baseWidth / W, ky = ObsWS.video.baseHeight / H;
  const map = obsCurrentMap();
  obsStoreMap(map);
  const problems = [];
  let done = 0;

  for (const r of holeRects()) {
    const m = map.items[r.key];
    const it = m && m.source && ObsWS.items.find(i => i.sourceName === m.source);
    if (!it) continue;
    try {
      const { sceneItemTransform: tr } = await obsCall('GetSceneItemTransform', { sceneName, sceneItemId: it.sceneItemId });
      const t = SK.fitTransform({ x: r.x * kx, y: r.y * ky, w: r.w * kx, h: r.h * ky },
        { width: tr.sourceWidth, height: tr.sourceHeight }, m.mode);
      if (!t) { problems.push(`${m.source} está sem imagem (ligue a fonte)`); continue; }
      await obsCall('SetSceneItemTransform', { sceneName, sceneItemId: it.sceneItemId, sceneItemTransform: t });
      done++;
    } catch (e) { problems.push(`${m.source}: ${e.message}`); }
  }

  /* o overlay fica no topo e ocupa o canvas inteiro */
  const overlay = ObsWS.items.find(i => i.isOverlay);
  if (overlay) {
    try {
      const { sceneItemTransform: tr } = await obsCall('GetSceneItemTransform', { sceneName, sceneItemId: overlay.sceneItemId });
      const t = SK.overlayTransform({ width: ObsWS.video.baseWidth, height: ObsWS.video.baseHeight },
        { width: tr.sourceWidth, height: tr.sourceHeight }, W, H);
      if (t) await obsCall('SetSceneItemTransform', { sceneName, sceneItemId: overlay.sceneItemId, sceneItemTransform: t });
      /* fonte menor que o overlay: funciona, mas o texto fica borrado */
      if (tr.sourceWidth < W || tr.sourceHeight < H)
        problems.push(`a fonte "${overlay.sourceName}" está em ${tr.sourceWidth}×${tr.sourceHeight}; mude para ${W}×${H} para ficar nítida`);
      await obsCall('SetSceneItemIndex', { sceneName, sceneItemId: overlay.sceneItemId, sceneItemIndex: ObsWS.itemCount - 1 });
    } catch (e) { problems.push('overlay: ' + e.message); }
  } else problems.push('não achei a fonte Navegador do overlay nesta cena');

  if (Math.abs(kx - ky) > 0.01) problems.push(`o canvas do OBS não é ${SK.aspectLabel(W, H)}`);
  panelToast(`${done} ${done === 1 ? 'fonte encaixada' : 'fontes encaixadas'}` + (problems.length ? ' · ' + problems.join(' · ') : ''),
    problems.length && !done ? 'err' : 'ok');
}

function initObsPanel() {
  const sec = $('#fitSec');
  if (!sec) return;
  sec.addEventListener('change', async e => {
    const t = e.target;
    if (t.id === 'obsScene') {
      try { await obsLoadItems(t.value); } catch (err) { panelToast('OBS: ' + err.message, 'err'); }
      obsRenderUI();
      return;
    }
    const key = t.dataset.fitSrc || t.dataset.fitMode;
    if (!key) return;
    const map = obsCurrentMap();
    map.items[key] = map.items[key] || { source: '', mode: 'cover' };
    if (t.dataset.fitSrc) map.items[key].source = t.value;
    else map.items[key].mode = t.value;
    obsStoreMap(map);
  });
  obsRenderUI();
}
