/* =========================================================================
   Alertas — sub, resub, sub de presente, raid/host, bits/kicks
   Fila: um alerta por vez. O painel dispara testes via config.alertTest,
   que o OBS recebe pelo polling.
========================================================================= */
const Alerts = { queue: [], showing: false, lastTestId: undefined, audio: null };

/* últimos apoios: o OBS guarda os que ele mesmo viu (o painel pode estar
   fechado) e junta com a lista salva pelo painel */
const Recent = { local: [] };
function recentList() { return SK.mergeRecent(cfg.recent.list, Recent.local); }

function recordRecent(a) {
  const item = SK.recentFromEvent(a, Date.now());
  if (!item) return;
  if (isOBS) { Recent.local = SK.mergeRecent([item], Recent.local); return; }
  cfg.recent.list = SK.mergeRecent([item], cfg.recent.list);
  if (cfg.recent.enabled) { renderWidgets(); scheduleSave(); }
}

function onStreamEvent(a) {
  recordRecent(a);
  if (!isOBS && cfg.goal.autoSubs && ['sub', 'resub', 'gift'].includes(a.type)) {
    cfg.goal.current += a.type === 'gift' ? (a.count || 1) : 1;
    syncPanelFields();
    renderWidgets();
    scheduleSave();
  }
  if (!cfg.alerts.enabled || !cfg.alerts.types[a.type]) return;
  alertPush(a);
}

function alertPush(a) {
  Alerts.queue.push(a);
  if (Alerts.queue.length > 30) Alerts.queue.shift();
  alertPump();
}

/* recebe o teste disparado no painel (só se for novo e recente) */
function checkAlertTest() {
  const t = cfg.alertTest;
  const id = t ? t.id : null;
  const first = Alerts.lastTestId === undefined;
  if (id === Alerts.lastTestId) return;
  Alerts.lastTestId = id;
  if (first || !t || !isOBS) return;
  if (Math.abs(Date.now() - t.id) < 60000) alertPush(SK.sampleAlert(t.type));
}

function alertLayer() {
  return document.getElementById('alertLayer');
}

function alertPump() {
  if (Alerts.showing || !Alerts.queue.length) return;
  const layer = alertLayer();
  if (!layer) return;
  const a = Alerts.queue.shift();
  const copy = SK.alertCopy(a);
  Alerts.showing = true;

  const el = document.createElement('div');
  el.className = `alert alert-${a.type} plat-${a.platform || 'twitch'}`;
  el.innerHTML = `
    <div class="alert-label"><span class="alert-mark"></span>${SK.escapeHtml(copy.label)}</div>
    <div class="alert-title">${SK.escapeHtml(copy.title)}</div>
    ${copy.detail ? `<div class="alert-detail">${SK.escapeHtml(copy.detail)}</div>` : ''}
    <div class="alert-timer"><i style="animation-duration:${cfg.alerts.duration}s"></i></div>`;
  layer.appendChild(el);
  if (cfg.alerts.sound) playChime(a.type);

  setTimeout(() => {
    el.classList.add('is-leaving');
    setTimeout(() => {
      el.remove();
      Alerts.showing = false;
      alertPump();
    }, 450);
  }, cfg.alerts.duration * 1000);
}

/* som curto gerado na hora — não depende de arquivo de áudio */
function playChime(type) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = Alerts.audio || (Alerts.audio = new Ctx());
    if (ctx.state === 'suspended') ctx.resume();
    const notes = type === 'raid' ? [392, 523.25, 659.25, 783.99] : type === 'cheer' ? [659.25, 987.77] : [523.25, 783.99];
    const vol = Math.max(0.0001, cfg.alerts.volume * 0.35);
    notes.forEach((f, i) => {
      const t0 = ctx.currentTime + i * 0.11;
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.6);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.65);
    });
  } catch (_) { /* sem áudio, sem problema */ }
}
