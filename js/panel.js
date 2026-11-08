/* =========================================================================
   Painel de controle
   Campos usam data-bind="caminho.na.config": a leitura, a escrita, o
   re-render e o salvamento são genéricos — nenhum campo esquece de salvar.
     data-bind="texts.$scene.title"   $scene = cena atual
     data-type="number"               converte para número
     data-clean="channel|digits"      normaliza o valor
     data-show="CHAT.mode=kick,multi" só aparece se o valor bater
     data-scenes="react react2cam"    seção só aparece nessas cenas
========================================================================= */
const SCENE_LABELS = {
  game: 'Jogo', react: 'React', reactfree: 'React livre', react2cam: 'React 2 cams', reactnochat: 'React sem chat',
  chatting: 'Just Chatting', irl: 'IRL', start: 'Começando', brb: 'Volto já', end: 'Encerramento'
};
const COLOR_PRESETS = ['#d6f24b', '#4f8cff', '#ff4d6d', '#ff8a3d', '#22c7a9', '#a77bff', '#f5f5f5'];
const WIDGET_PATHS = /^(goal|social|SP|recent)\.|^pinnedFor$/;

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function resolvePath(p) { return p.replace('$scene', cfg.state.scene); }
function getPath(path) { return resolvePath(path).split('.').reduce((o, k) => (o == null ? undefined : o[k]), cfg); }
function setPath(path, v) {
  const ks = resolvePath(path).split('.');
  const last = ks.pop();
  const obj = ks.reduce((o, k) => (o == null ? undefined : o[k]), cfg);
  if (obj && typeof obj === 'object') obj[last] = v;
}

/* ---------- render agendado (texto digitado não re-renderiza a cada tecla) ---------- */
let _renderTimer = null;
function renderSoon(delay) {
  clearTimeout(_renderTimer);
  _renderTimer = setTimeout(renderScene, delay);
}

function commit(opts = {}) {
  if (opts.widgetsOnly) renderWidgets();
  else renderSoon(opts.delay || 0);
  chatSync();
  updateVisibility();
  scheduleSave();
}

/* ---------- leitura dos campos ---------- */
function readField(el) {
  if (el.type === 'checkbox') return el.checked;
  let v = el.value;
  if (el.dataset.clean === 'channel') v = SK.cleanChannel(v);
  if (el.dataset.clean === 'digits') v = v.replace(/\D/g, '');
  if (el.dataset.type === 'number') {
    const n = parseFloat(v);
    return isFinite(n) ? n : getPath(el.dataset.bind);
  }
  return v;
}

function onFieldEvent(e) {
  const el = e.target.closest('[data-bind]');
  if (!el) return;
  const discrete = el.type === 'checkbox' || el.tagName === 'SELECT';
  if (discrete !== (e.type === 'change')) return;
  const path = el.dataset.bind;
  setPath(path, readField(el));
  afterFieldChange(path, el);
}

function afterFieldChange(path, el) {
  if (path === 'CHAT.kickChannel') { cfg.CHAT.kickChatroomId = ''; disconnectKick(); syncPanelFields(); }
  if (path === 'CHAT.kickChatroomId') disconnectKick();
  if (path === 'SP.enabled') spSync();
  if (path === 'state.color') markColor();
  if (path.startsWith('chatFilter.')) chatRepaint();
  if (path.startsWith('reactNoChat.')) updateRncUI();
  if (path === 'goal.type') {
    const titles = { subs: 'Meta de subs', followers: 'Meta de seguidores', custom: 'Meta' };
    if (Object.values(titles).includes(cfg.goal.title)) { cfg.goal.title = titles[cfg.goal.type]; syncPanelFields(); }
    followersSync();
  }
  if (path === 'goal.enabled') followersSync();
  if (path === 'chatFilter.showPlatform') chatRepaint();
  if (path === 'chatFilter.hideAfter' || path === 'chatFilter.highlightFirst') chatRepaint();
  const typing = el.type === 'text' || el.type === 'number' || el.tagName === 'TEXTAREA';
  commit({ widgetsOnly: WIDGET_PATHS.test(path), delay: typing ? 160 : 0 });
}

/* ---------- escrita nos campos ---------- */
function syncPanelFields() {
  if (isOBS) return;
  $$('[data-bind]').forEach(el => {
    if (el === document.activeElement && el.type !== 'checkbox') return;
    const v = getPath(el.dataset.bind);
    if (v === undefined) return;
    if (el.type === 'checkbox') el.checked = !!v;
    else if (String(el.value) !== String(v)) el.value = v;
  });
  $$('[data-scene]').forEach(b => b.classList.toggle('is-active', b.dataset.scene === cfg.state.scene));
  $$('[data-format]').forEach(b => b.classList.toggle('is-active', b.dataset.format === cfg.state.format));
  $$('[data-rtype]').forEach(b => b.classList.toggle('is-active', b.dataset.rtype === cfg.reactState.type));
  $('#resolution').textContent = cfg.state.format === 'portrait' ? '1080 × 1920' : '1920 × 1080';
  $('#sceneTitle').textContent = SCENE_LABELS[cfg.state.scene];
  markColor();
  updateVisibility();
  updateSpotifyUI();
  updatePinnedUI();
  updateCountdownUI();
  updateWriteKeyUI();
  updateRncUI();
  updateRecentUI();
}

/* onde encaixar a webcam no OBS (muda com tamanho, canto e faixa do @) */
function updateRncUI() {
  const el = $('#rncPos');
  if (!el) return;
  const { cam: [l, t, w, h] } = rncGeom(cfg.state.format);
  el.textContent = `Webcam no OBS: posição ${l}, ${t} · tamanho ${w} × ${h}`;
}

function updateVisibility() {
  $$('[data-scenes]').forEach(el => { el.hidden = !el.dataset.scenes.split(' ').includes(cfg.state.scene); });
  $$('[data-show]').forEach(el => {
    const [path, vals] = el.dataset.show.split('=');
    el.hidden = !vals.split(',').includes(String(getPath(path)));
  });
}

function markColor() {
  $$('[data-color]').forEach(b => b.classList.toggle('is-active', b.dataset.color.toLowerCase() === cfg.state.color.toLowerCase()));
}

function updateSpotifyUI() {
  const btn = $('#spotifyAuth'), status = $('#spotifyStatus');
  const connected = !!SP.accessToken;
  btn.textContent = connected ? 'Desconectar' : 'Conectar ao Spotify';
  status.textContent = connected ? 'Conectado' : (cfg.SP.clientId ? 'Não conectado' : 'Informe o Client ID');
  status.dataset.kind = connected ? 'ok' : 'idle';
  $('#spotifyRedirect').textContent = spRedirectUri();
}

function updatePinnedUI() {
  const box = $('#pinnedBox');
  const p = cfg.pinned;
  box.hidden = !p;
  if (p) $('#pinnedText').innerHTML = `<b>${SK.escapeHtml(p.user)}</b> ${SK.segmentsToHtml(p.segments)}`;
}

/* destaque com tempo: quando expira, sai também da config */
function expirePinned() {
  if (cfg.pinned && !SK.pinnedActive(cfg.pinned, cfg.pinnedFor, Date.now())) {
    cfg.pinned = null;
    updatePinnedUI();
    commit({ widgetsOnly: true });
  }
}

function updateRecentUI() {
  const el = $('#recentState');
  if (!el) return;
  const n = recentList().length;
  el.textContent = n ? `${n} ${n === 1 ? 'apoio registrado' : 'apoios registrados'} nesta live` : 'Nenhum apoio registrado ainda';
}

function updateCountdownUI() {
  const el = $('#countdownState');
  const left = cfg.countdown.endsAt - Date.now();
  el.textContent = cfg.countdown.endsAt && left > 0
    ? 'Termina às ' + SK.formatClock(new Date(cfg.countdown.endsAt))
    : 'Nenhuma contagem ativa';
}

function updateWriteKeyUI() {
  const has = !!Store.writeKey();
  $('#writeKeyState').textContent = has ? 'Chave salva neste navegador' : 'Sem chave — escrita direta (sem proteção)';
  $('#writeKeyState').dataset.kind = has ? 'ok' : 'warn';
}

/* ---------- avisos ---------- */
let _toastTimer = null;
function panelToast(msg, kind = 'ok') {
  const el = $('#toast');
  if (!el) return;
  el.textContent = msg;
  el.dataset.kind = kind;
  el.hidden = false;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { el.hidden = true; }, 3200);
}

function copyText(text, okMsg) {
  const done = () => panelToast(okMsg || 'Copiado');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
  } else fallbackCopy(text, done);
}
function fallbackCopy(text, done) {
  const ta = document.createElement('textarea');
  ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); done(); } catch (_) { panelToast('Não foi possível copiar', 'err'); }
  ta.remove();
}

/* ---------- links do OBS ---------- */
function renderLinks() {
  const fmt = cfg.state.format;
  $('#linksFormat').textContent = fmt === 'portrait' ? 'TikTok 9:16 · 1080 × 1920' : 'Twitch 16:9 · 1920 × 1080';
  $('#linksList').innerHTML = SK.SCENES.map(scene => {
    const url = SK.buildSceneURL(location.href, scene, fmt, OVERLAY_ID);
    return `
      <div class="link-row">
        <span class="link-name">${SCENE_LABELS[scene]}</span>
        <code class="link-url" title="${SK.escapeHtml(url)}">${SK.escapeHtml(url.replace(/^https?:\/\//, ''))}</code>
        <button class="btn btn-sm" data-copy-url="${SK.escapeHtml(url)}">Copiar</button>
      </div>`;
  }).join('');
}

/* ---------- ações (botões) ---------- */
const ACTIONS = {
  'goal-add': el => { cfg.goal.current = Math.max(0, cfg.goal.current + (+el.dataset.n || 1)); syncPanelFields(); commit({ widgetsOnly: true }); },
  'goal-reset': () => { cfg.goal.current = 0; syncPanelFields(); commit({ widgetsOnly: true }); },
  'countdown-min': el => { cfg.countdown.endsAt = Date.now() + (+el.dataset.min) * 60000; afterCountdown(); },
  'countdown-time': () => {
    const at = SK.nextTimeOccurrence($('#countdownTime').value, Date.now());
    if (!at) { panelToast('Informe um horário válido', 'err'); return; }
    cfg.countdown.endsAt = at; afterCountdown();
  },
  'countdown-clear': () => { cfg.countdown.endsAt = 0; afterCountdown(); },
  'alert-test': el => {
    const type = el.dataset.type;
    cfg.alertTest = { id: Date.now(), type };
    Alerts.lastTestId = cfg.alertTest.id;
    alertPush(SK.sampleAlert(type));
    scheduleSave();
  },
  'recent-clear': () => { cfg.recent.list = []; Recent.local = []; updateRecentUI(); commit({ widgetsOnly: true }); },
  'obs-connect': () => obsToggle(),
  'obs-fit': () => obsFitNow(),
  'unpin': () => { cfg.pinned = null; updatePinnedUI(); commit({ widgetsOnly: true }); },
  'spotify-auth': () => { if (SP.accessToken) spDisconnect(); else spLogin(); },
  'links-toggle': () => {
    const pop = $('#linksPop');
    pop.hidden = !pop.hidden;
    if (!pop.hidden) renderLinks();
  },
  'copy-scene': () => copyText(SK.buildSceneURL(location.href, cfg.state.scene, cfg.state.format, OVERLAY_ID), 'Link da cena copiado'),
  'write-key-save': () => {
    Store.setWriteKey($('#writeKey').value.trim());
    $('#writeKey').value = '';
    updateWriteKeyUI();
    panelToast(Store.writeKey() ? 'Chave salva' : 'Chave removida');
    Store.save(cfg);
  }
};

function afterCountdown() { updateCountdownUI(); tickClocks(); scheduleSave(); }

function onClick(e) {
  const t = e.target;

  const sceneBtn = t.closest('[data-scene]');
  if (sceneBtn) { cfg.state.scene = sceneBtn.dataset.scene; syncPanelFields(); commit(); return; }
  const fmtBtn = t.closest('[data-format]');
  if (fmtBtn) { cfg.state.format = fmtBtn.dataset.format; syncPanelFields(); commit(); if (!$('#linksPop').hidden) renderLinks(); return; }
  const rBtn = t.closest('[data-rtype]');
  if (rBtn) { cfg.reactState.type = rBtn.dataset.rtype; syncPanelFields(); commit(); return; }
  const colorBtn = t.closest('[data-color]');
  if (colorBtn) { cfg.state.color = colorBtn.dataset.color; syncPanelFields(); commit(); return; }
  const copyBtn = t.closest('[data-copy-url]');
  if (copyBtn) { copyText(copyBtn.dataset.copyUrl, 'Link copiado'); return; }
  const act = t.closest('[data-action]');
  if (act && ACTIONS[act.dataset.action]) { ACTIONS[act.dataset.action](act); return; }

  /* clique numa mensagem do chat no preview → destaca na tela */
  const msg = t.closest('#scene .msg');
  if (msg) {
    const m = Chat.history.find(x => x.id === msg.dataset.id);
    if (m) {
      cfg.pinned = { user: m.user, platform: m.platform, color: m.color, segments: m.segments, at: Date.now() };
      updatePinnedUI();
      commit({ widgetsOnly: true });
      panelToast('Mensagem em destaque');
    }
    return;
  }

  /* fecha o popover de links ao clicar fora */
  const pop = $('#linksPop');
  if (!pop.hidden && !t.closest('#linksPop') && !t.closest('[data-action="links-toggle"]')) pop.hidden = true;
}

function buildStaticUI() {
  $('#sceneTabs').innerHTML = SK.SCENES.map(s => `<button class="tab" data-scene="${s}">${SCENE_LABELS[s]}</button>`).join('');
  $('#colorPresets').innerHTML = COLOR_PRESETS.map(c =>
    `<button class="swatch" data-color="${c}" style="--c:${c}" title="${c}" aria-label="Cor ${c}"></button>`).join('');
  $('#overlayId').textContent = OVERLAY_ID;
  $('#appVersion').textContent = 'v' + APP_VERSION;
}

function initPanel() {
  buildStaticUI();
  document.addEventListener('input', onFieldEvent);
  document.addEventListener('change', onFieldEvent);
  document.addEventListener('click', onClick);
  $('#spotifyTest').addEventListener('input', e => {
    SP.testText = e.target.value.trim();
    if (cfg.SP.enabled) spPoll();
  });
  setInterval(updateCountdownUI, 15000);
  setInterval(() => { expirePinned(); updateRecentUI(); }, 2000);
  initObsPanel();
}
