/* =========================================================================
   Cenas — layouts desenhados em pixels na resolução nativa
   (1920×1080 / 1080×1920). O palco é escalado para caber na tela, então o
   preview do painel é idêntico ao que o OBS mostra.

   Janelas com .hole ficam transparentes: é ali que entram as fontes reais
   do OBS (webcam, captura de jogo, vídeo). Os "slots" recebem os widgets
   (Spotify, redes, meta, destaque).
========================================================================= */
const esc = SK.escapeHtml;
let stageScale = 1;

const px = (l, t, w, h) => `left:${l}px;top:${t}px;width:${w}px;height:${h}px;`;

const liveBadge = (extra = '') => cfg.hideLive ? '' : `<div class="live-badge${extra}"><i></i>${esc(cfg.labels.live)}</div>`;

/* data-key/data-label: o painel lista as janelas para encaixar as fontes no OBS */
function hole(kind, pos, label, hint, opts = {}) {
  const live = opts.live ? liveBadge() : '';
  const key = opts.key || kind;
  return `
    <div class="win win-${kind}${opts.accent ? ' is-accent' : ''}${opts.bare ? ' is-bare' : ''}" style="${pos}">
      <div class="win-body hole" data-key="${key}" data-label="${esc(opts.title || label)}">
        <div class="ph"><span class="ph-label">${label}</span><span class="ph-hint">${hint}</span></div>
        ${live}
        ${opts.name ? `<div class="cam-name">${esc(opts.name)}</div>` : ''}
      </div>
    </div>`;
}

const camWin = (pos, label = 'Webcam', key = 'cam', name = '') => hole('cam', pos, label, 'Dispositivo de captura de vídeo', { accent: true, live: true, key, name });
const gameWin = pos => hole('game', pos, 'Captura de jogo', 'Game capture · 16:9', { title: 'Jogo' });
const videoWin = pos => hole('video', pos, reactPlaceholder(), 'Navegador · mídia · captura de tela', { title: 'Vídeo' });

function chatWin(pos) {
  return `
    <div class="win win-chat" style="${pos}">
      <div class="win-bar"><span class="bar-mark"></span><span class="bar-label">${esc(cfg.labels.chat)}</span><span class="bar-meta" data-clock></span></div>
      <div class="win-body"><div class="chat" data-chat></div></div>
    </div>`;
}

function infoStrip(pos, tag, titleHtml) {
  return `
    <div class="info" style="${pos}">
      <span class="info-tag">${esc(tag)}</span>
      <span class="info-title">${titleHtml}</span>
      ${cfg.layout.showNick ? `<span class="info-meta">${esc(cfg.gameState.nick)}</span>` : ''}
    </div>`;
}

function footerRow(pos) {
  return `
    <div class="footer-row" style="${pos}">
      <div class="slot" data-slot="spotify"></div>
      <div class="slot" data-slot="social"></div>
      <div class="slot" data-slot="recent"></div>
      <div class="grow"></div>
      <div class="slot" data-slot="goal"></div>
    </div>`;
}

const slot = (name, pos) => `<div class="slot slot-abs" data-slot="${name}" style="${pos}"></div>`;

/* ---------- textos da cena React ---------- */
function reactPlaceholder() {
  const r = cfg.reactState;
  return r.type === 'free' ? 'Tela, vídeo ou qualquer fonte' : esc(r.title || 'Janela de vídeo');
}
function reactTag() {
  return cfg.labels[cfg.reactState.type];
}
/* todos os textos vêm de cfg.labels (editáveis no painel) */
function reactTitleHtml() {
  const r = cfg.reactState, L = cfg.labels;
  if (r.type === 'free') return SK.richText(L.freeTitle);
  const prefix = L.reactPrefix.trim();
  let h = `${prefix ? esc(prefix) + ' ' : ''}<b>${esc(r.title || '—')}</b>`;
  if (r.type === 'series' && L.episode.trim()) h += `<span class="sep"></span>${SK.fillTemplate(L.episode, { t: r.season || '1', e: r.episode || '1' })}`;
  if (r.note) h += `<span class="sep"></span><span class="dim">${esc(r.note)}</span>`;
  return h;
}

/* ---------- React sem chat: moldura da webcam ---------- */
const RNC_SIZE = { s: [400, 225], m: [480, 270], l: [640, 360] };

/* posição da webcam (sem a faixa do @) — o painel mostra isso para encaixar no OBS */
function rncGeom(fmt) {
  const r = cfg.reactNoChat;
  const strip = r.showHandle ? (fmt === 'portrait' ? 68 : 52) : 0;
  if (fmt === 'portrait') return { cam: [40, 627, 1000, 563], strip };
  const [w, h] = RNC_SIZE[r.size];
  const right = r.corner.endsWith('r'), bottom = r.corner.startsWith('b');
  return { cam: [right ? 1920 - 40 - w : 40, bottom ? 1080 - 40 - strip - h : 40, w, h], strip };
}

function rncHandle() {
  const r = cfg.reactNoChat;
  return (r.handle.trim() || cfg.gameState.nick).trim().replace(/^@+/, '');
}

function rncFrame(fmt) {
  const r = cfg.reactNoChat;
  const { cam: [l, t, w, h], strip } = rncGeom(fmt);
  const vars = `--rnc-c:${r.color};--rnc-on:${SK.contrastText(r.color)};--rnc-b:${r.border}px;--rnc-strip:${strip}px;`;
  return `
    <div class="rnc" style="${px(l, t, w, h + strip)}${vars}">
      <div class="rnc-cam hole" data-key="cam" data-label="Webcam" style="height:${h}px">
        <div class="ph"><span class="ph-label">Webcam</span><span class="ph-hint">${w} × ${h}</span></div>
      </div>
      ${strip ? `<div class="rnc-handle"><span class="rnc-at">@</span><span class="rnc-name">${esc(rncHandle())}</span></div>` : ''}
    </div>`;
}

/* ---------- layouts ---------- */
const L = {
  /* paisagem: janela principal 16:9 (1400×788) + coluna direita 400px */
  main: px(40, 40, 1400, 788),
  cam: px(1480, 40, 400, 300),
  chat: px(1480, 364, 400, 676),
  info: px(40, 852, 1400, 72),
  footer: px(40, 948, 1400, 92),
  pinned: 'left:72px;top:72px;max-width:640px;',
  /* retrato: blocos empilhados de 1000px de largura */
  pTop: px(40, 40, 1000, 563),
  pMid: px(40, 627, 1000, 563),
  pInfo: px(40, 1214, 1000, 80),
  pFooter: px(40, 1310, 1000, 172),
  pChat: px(40, 1560, 1000, 320),
  pPinned: 'left:72px;top:72px;max-width:760px;'
};

/* coluna direita (paisagem): webcam na proporção escolhida, chat ocupa o resto */
function sideColumn() {
  const h = SK.CAM_ASPECTS[cfg.layout.camAspect] || 300;
  return { cam: px(1480, 40, 400, h), chat: px(1480, 40 + h + 24, 400, 1080 - 40 - (40 + h + 24)) };
}

/* React com várias webcams: [left, top, width, height] de cada pessoa */
function reactCamRects(fmt) {
  const three = cfg.reactCams.count === 3;
  if (fmt === 'landscape') return three
    ? [40, 382, 724].map(t => [1480, t, 400, 316])
    : [40, 552].map(t => [1480, t, 400, 488]);
  return three
    ? [40, 382, 724].map(l => [l, 627, 316, 421])
    : [40, 552].map(l => [l, 627, 488, 663]);
}

const Scenes = {
  game(fmt) {
    const g = cfg.gameState, L2 = cfg.labels;
    const title = `${esc(L2.playing)} <b>${esc(g.name)}</b>`;
    const side = sideColumn();
    if (fmt === 'landscape') return gameWin(L.main) + camWin(side.cam) + chatWin(side.chat)
      + infoStrip(L.info, L2.now, title) + footerRow(L.footer) + slot('pinned', L.pinned);
    return camWin(L.pTop) + gameWin(L.pMid) + infoStrip(L.pInfo, L2.now, title)
      + footerRow(L.pFooter) + chatWin(L.pChat) + slot('pinned', 'left:72px;top:659px;max-width:760px;');
  },

  react(fmt) {
    const side = sideColumn();
    if (fmt === 'landscape') return videoWin(L.main) + camWin(side.cam) + chatWin(side.chat)
      + infoStrip(L.info, reactTag(), reactTitleHtml()) + footerRow(L.footer) + slot('pinned', L.pinned);
    return videoWin(L.pTop) + camWin(L.pMid) + infoStrip(L.pInfo, reactTag(), reactTitleHtml())
      + footerRow(L.pFooter) + chatWin(L.pChat) + slot('pinned', L.pPinned);
  },

  reactfree(fmt) {
    const title = SK.richText(cfg.labels.freeTitle), tag = cfg.labels.free;
    const video = pos => hole('video', pos, 'Tela, vídeo ou qualquer fonte', 'Navegador · mídia · captura de tela', { title: 'Vídeo' });
    const side = sideColumn();
    if (fmt === 'landscape') return video(L.main) + camWin(side.cam) + chatWin(side.chat)
      + infoStrip(L.info, tag, title) + footerRow(L.footer) + slot('pinned', L.pinned);
    return video(L.pTop) + camWin(L.pMid) + infoStrip(L.pInfo, tag, title)
      + footerRow(L.pFooter) + chatWin(L.pChat) + slot('pinned', L.pPinned);
  },

  react2cam(fmt) {
    const showInfo = cfg.reactState.type !== 'free';
    const rects = reactCamRects(fmt);
    const cams = rects.map(([l, t, w, h], i) =>
      camWin(px(l, t, w, h), `Webcam ${i + 1}`, `cam${i + 1}`, cfg.reactCams[`name${i + 1}`].trim())).join('');
    if (fmt === 'landscape') return videoWin(L.main) + cams
      + (showInfo ? infoStrip(L.info, reactTag(), reactTitleHtml()) : '')
      + footerRow(showInfo ? L.footer : px(40, 852, 1400, 92)) + slot('pinned', L.pinned);
    const y = rects[0][1] + rects[0][3] + 24;   /* logo abaixo das webcams */
    return videoWin(L.pTop) + cams
      + (showInfo ? infoStrip(px(40, y, 1000, 80), reactTag(), reactTitleHtml()) : '')
      + footerRow(px(40, showInfo ? y + 104 : y, 1000, 172)) + slot('pinned', L.pPinned);
  },

  /* vídeo sem moldura + webcam com borda fina e faixa do @ (sem chat, sem "Ao vivo") */
  reactnochat(fmt) {
    const video = pos => hole('video', pos, 'Vídeo ou qualquer fonte', 'Sem borda · encaixe livre', { bare: true, title: 'Vídeo' });
    if (fmt === 'landscape') return video(px(0, 0, 1920, 1080)) + rncFrame(fmt);
    const { cam: [, t, , h], strip } = rncGeom(fmt);
    return video(L.pTop) + rncFrame(fmt) + footerRow(px(40, t + h + strip + 24, 1000, 172));
  },

  chatting(fmt) {
    const L2 = cfg.labels;
    const title = `${L2.chatting.trim() ? esc(L2.chatting) + '<span class="sep"></span>' : ''}<b>${esc(cfg.texts.chatting.topic)}</b>`;
    if (fmt === 'landscape') return hole('cam', L.main, 'Webcam principal', 'Dispositivo de captura de vídeo', { accent: true, live: true })
      + chatWin(px(1480, 40, 400, 1000)) + infoStrip(L.info, L2.chattingTag, title)
      + footerRow(L.footer) + slot('pinned', 'left:72px;bottom:284px;max-width:640px;');
    return hole('cam', px(40, 40, 1000, 1100), 'Webcam principal', 'Dispositivo de captura de vídeo', { accent: true, live: true })
      + infoStrip(px(40, 1164, 1000, 80), L2.chattingTag, title) + footerRow(px(40, 1268, 1000, 172))
      + chatWin(px(40, 1518, 1000, 362)) + slot('pinned', 'left:72px;bottom:812px;max-width:760px;');
  },

  irl(fmt) {
    const land = fmt === 'landscape';
    const live = liveBadge(' live-irl');
    return `
      <div class="win win-irl" style="left:0;top:0;width:100%;height:100%;">
        <div class="win-body hole" data-key="irl" data-label="Câmera IRL">
          <div class="ph"><span class="ph-label">Câmera IRL</span><span class="ph-hint">Webcam, celular ou câmera de ação</span></div>
        </div>
      </div>
      ${live}
      <div class="irl-location" style="${land ? 'left:40px;bottom:40px;' : 'left:40px;bottom:260px;'}">
        <span class="irl-pin"><svg viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"/></svg></span>
        <span class="irl-text"><span class="irl-kicker">${esc(cfg.irlState.kicker)}</span><span class="irl-name">${esc(cfg.irlState.location || 'Sua localização')}</span></span>
      </div>
      ${slot('spotify', 'right:40px;top:40px;')}
      ${slot('social', land ? 'right:40px;bottom:40px;' : 'right:40px;top:136px;')}
      ${slot('goal', land ? 'right:40px;top:136px;width:420px;' : 'left:40px;bottom:400px;width:620px;')}
      ${slot('pinned', land ? 'left:40px;top:120px;max-width:640px;' : 'left:40px;top:120px;max-width:760px;')}`;
  },

  start: () => fullscreen('start'),
  brb: () => fullscreen('brb'),
  end: () => fullscreen('end')
};

function fullscreen(kind) {
  const t = cfg.texts[kind];
  const sub = kind === 'end' ? cfg.endState.message : t.sub;
  const items = SK.parseTicker(t.ticker);
  const tickerItems = items.map(i => `<span>${esc(i)}</span>`).join('');
  const duration = Math.max(18, items.join('').length * 0.35);
  const countdown = kind === 'end' ? '' : `
    <div class="fs-countdown" data-countdown hidden>
      <span class="cd-label">${esc(kind === 'start' ? cfg.labels.startIn : cfg.labels.backIn)}</span>
      <span class="cd-value">00:00</span>
    </div>`;
  return `
    <div class="fs fs-${kind}">
      <div class="fs-top">
        <span class="fs-brand"><span class="fs-mark"></span>${esc(cfg.gameState.nick)}</span>
        <span class="fs-clock" data-clock></span>
      </div>
      <div class="fs-main">
        <div class="fs-kicker">${esc(t.kicker)}</div>
        <h1 class="fs-title"><span>${esc(t.title)}</span><em>${esc(t.highlight)}</em></h1>
        ${sub ? `<p class="fs-sub">${esc(sub)}</p>` : ''}
        ${countdown}
        ${kind === 'end' ? '<div class="slot" data-slot="credits"></div>' : ''}
        <div class="slot fs-socials" data-slot="social"></div>
      </div>
      ${items.length ? `
      <div class="ticker">
        <div class="ticker-track"><div class="ticker-move" style="animation-duration:${duration}s">${tickerItems}${tickerItems}</div></div>
      </div>` : ''}
    </div>`;
}

/* =========================================================================
   Widgets
========================================================================= */
const SOCIAL_ICONS = {
  tiktok: '<svg viewBox="0 0 24 24"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43V9.36a8.16 8.16 0 0 0 4.77 1.52V7.42c.01 0-.69-.04-1.84-.73z"/></svg>',
  instagram: '<svg viewBox="0 0 24 24"><path d="M12 2.16c3.2 0 3.58 0 4.85.07 3.25.15 4.77 1.69 4.92 4.92.06 1.27.07 1.65.07 4.85s0 3.58-.07 4.85c-.15 3.23-1.66 4.77-4.92 4.92-1.27.06-1.64.07-4.85.07s-3.58 0-4.85-.07c-3.26-.15-4.77-1.7-4.92-4.92-.06-1.27-.07-1.64-.07-4.85s0-3.58.07-4.85C2.38 3.92 3.9 2.38 7.15 2.23 8.42 2.18 8.8 2.16 12 2.16zM12 0C8.74 0 8.33.01 7.05.07c-4.35.2-6.78 2.62-6.98 6.98C.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.2 4.35 2.62 6.78 6.98 6.98C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c4.35-.2 6.78-2.62 6.98-6.98.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.2-4.35-2.63-6.78-6.98-6.98C15.67.01 15.26 0 12 0zm0 5.84a6.16 6.16 0 1 0 0 12.32 6.16 6.16 0 0 0 0-12.32zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.41-11.85a1.44 1.44 0 1 0 0 2.88 1.44 1.44 0 0 0 0-2.88z"/></svg>',
  youtube: '<svg viewBox="0 0 24 24"><path d="M23.5 6.2a3 3 0 0 0-2.12-2.12C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.53A3 3 0 0 0 .5 6.2C0 8.07 0 12 0 12s0 3.93.5 5.8a3 3 0 0 0 2.12 2.12c1.88.53 9.38.53 9.38.53s7.5 0 9.38-.53a3 3 0 0 0 2.12-2.12c.5-1.87.5-5.8.5-5.8s0-3.93-.5-5.8zM9.55 15.57V8.43L15.82 12l-6.27 3.57z"/></svg>'
};
const MUSIC_ICON = '<svg viewBox="0 0 24 24"><path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/></svg>';

function activeSocials() {
  return ['tiktok', 'instagram', 'youtube']
    .filter(k => cfg.social[k].on && cfg.social[k].handle.trim())
    .map(k => ({ key: k, handle: cfg.social[k].handle.trim().replace(/^@/, '') }));
}

function socialHtml() {
  const list = activeSocials();
  if (!list.length) {
    if (cfg.state.scene !== 'end') return '';
    return `<div class="socials"><span class="soc soc-nick"><span class="soc-icon">@</span><span>${esc(cfg.gameState.nick.replace(/^@/, ''))}</span></span></div>`;
  }
  return `<div class="socials">${list.map(s =>
    `<span class="soc soc-${s.key}"><span class="soc-icon">${SOCIAL_ICONS[s.key]}</span><span>@${esc(s.handle)}</span></span>`).join('')}</div>`;
}

function spotifyHtml() {
  const cur = cfg.SP.current;
  if (!cfg.SP.enabled || !SK.trackActive(cur, Date.now())) return '';
  const cover = cur.cover ? `<img src="${esc(cur.cover)}" alt="">` : MUSIC_ICON;
  return `
    <div class="np">
      <span class="np-cover">${cover}</span>
      <span class="np-text">
        <span class="np-kicker"><span class="eq"><i></i><i></i><i></i></span>${esc(cfg.labels.nowPlaying)}</span>
        <span class="np-title">${esc(cur.title)}</span>
        ${cur.artist ? `<span class="np-artist">${esc(cur.artist)}</span>` : ''}
      </span>
    </div>`;
}

function goalHtml() {
  const g = cfg.goal;
  if (!g.enabled) return '';
  /* seguidores: número ao vivo da Kick quando disponível */
  const current = g.type === 'followers' && Followers.kick != null ? Followers.kick : g.current;
  const pct = SK.goalPercent(current, g.target);
  return `
    <div class="goal${pct >= 100 ? ' is-done' : ''}">
      <div class="goal-head"><span class="goal-title">${esc(g.title)}</span><span class="goal-count">${current}<span>/${g.target}</span></span></div>
      <div class="goal-track"><i style="width:${pct}%"></i></div>
    </div>`;
}

function pinnedHtml() {
  const p = cfg.pinned;
  if (!SK.pinnedActive(p, cfg.pinnedFor, Date.now())) return '';
  return `
    <div class="pin" style="--name:${esc(SK.readableNameColor(p.color, p.user))}">
      <div class="pin-head"><span class="pin-tag">${esc(cfg.labels.pinned)}</span><span class="pin-name">${esc(p.user)}</span></div>
      <div class="pin-text">${SK.segmentsToHtml(p.segments)}</div>
    </div>`;
}

/* último apoio no rodapé */
function recentHtml() {
  if (!cfg.recent.enabled) return '';
  const a = recentList()[0];
  if (!a) return '';
  return `
    <div class="recent plat-${a.platform}">
      <span class="recent-tag">${esc(cfg.labels.recent)}</span>
      <span class="recent-text"><b>${esc(a.user)}</b><span>${esc(SK.recentText(a))}</span></span>
    </div>`;
}

/* agradecimento a quem apoiou na live (tela de encerramento) */
function creditsHtml() {
  if (!cfg.recent.enabled) return '';
  const names = [...new Set(recentList().filter(a => a.type !== 'raid').map(a => a.user))].slice(0, 12);
  if (!names.length) return '';
  return `<div class="credits"><span class="credits-tag">${esc(cfg.labels.credits)}</span><span class="credits-names">${names.map(esc).join('<i></i>')}</span></div>`;
}

function renderWidgets() {
  const scene = document.getElementById('scene');
  if (!scene) return;
  const fill = (name, html) => scene.querySelectorAll(`[data-slot="${name}"]`).forEach(el => {
    if (el.dataset.html !== html) { el.innerHTML = html; el.dataset.html = html; }
  });
  fill('social', socialHtml());
  fill('spotify', spotifyHtml());
  fill('goal', goalHtml());
  fill('pinned', pinnedHtml());
  fill('recent', recentHtml());
  fill('credits', creditsHtml());
}

/* =========================================================================
   Render principal
========================================================================= */
function applyTheme() {
  const root = document.documentElement.style;
  root.setProperty('--accent', cfg.state.color);
  root.setProperty('--accent-a', SK.hexToRgba(cfg.state.color, 0.16));
  root.setProperty('--on-accent', SK.contrastText(cfg.state.color));
}

function renderScene() {
  const stage = document.getElementById('stage');
  const scene = document.getElementById('scene');
  const { format, scene: name } = cfg.state;
  applyTheme();
  stage.className = `stage ${format} scene-${name}`
    + (cfg.square ? ' is-square' : '')
    + (cfg.bg.type !== 'none' ? ' has-bg' : '');

  chatDetachAll();
  scene.innerHTML = (Scenes[name] || Scenes.game)(format);
  scene.querySelectorAll('[data-chat]').forEach(chatAttach);
  renderWidgets();
  tickClocks();
  fitStage();
  applyBackground();
  if (!isOBS) obsRenderUI();
}

function fitStage() {
  const stage = document.getElementById('stage');
  const frame = document.getElementById('previewFrame');
  const [W, H] = SK.SIZES[cfg.state.format];
  let availW, availH;
  if (isOBS) {
    availW = window.innerWidth; availH = window.innerHeight;
  } else {
    const box = document.getElementById('previewBox');
    availW = box.clientWidth;
    availH = Math.max(320, window.innerHeight - box.getBoundingClientRect().top - 24);
  }
  stageScale = Math.min(availW / W, availH / H) || 1;
  stage.style.width = W + 'px';
  stage.style.height = H + 'px';
  stage.style.transform = `scale(${stageScale})`;
  frame.style.width = Math.round(W * stageScale) + 'px';
  frame.style.height = Math.round(H * stageScale) + 'px';
}

/* relógios e contagem regressiva */
function tickClocks() {
  const now = Date.now();
  renderWidgets();
  chatSweep();
  const clock = SK.formatClock(new Date(now));
  document.querySelectorAll('[data-clock]').forEach(el => { if (el.textContent !== clock) el.textContent = clock; });

  const endsAt = cfg.countdown.endsAt;
  document.querySelectorAll('[data-countdown]').forEach(el => {
    const left = endsAt - now;
    /* depois de zerar, mostra "Agora" por 10 minutos e some */
    const visible = endsAt > 0 && left > -10 * 60 * 1000;
    el.hidden = !visible;
    if (!visible) return;
    el.classList.toggle('is-over', left <= 0);
    const v = el.querySelector('.cd-value');
    const text = left > 0 ? SK.formatCountdown(left) : cfg.labels.countdownDone;
    if (v.textContent !== text) v.textContent = text;
  });
}

/* =========================================================================
   Fundo
   Painel: CSS no palco. OBS: canvas com recortes transparentes nas janelas
   .hole, para as fontes reais aparecerem por baixo.
========================================================================= */
let _bgImg = null;

function bgCss() {
  const b = cfg.bg;
  if (b.type === 'solid') return { backgroundColor: b.color1, backgroundImage: 'none' };
  if (b.type === 'gradient') return { backgroundColor: b.color1, backgroundImage: `linear-gradient(${b.angle}deg, ${b.color1}, ${b.color2})` };
  if (b.type === 'image' && b.imageUrl) return { backgroundColor: '#000', backgroundImage: `url("${b.imageUrl.replace(/"/g, '%22')}")` };
  return { backgroundColor: 'transparent', backgroundImage: 'none' };
}

function applyBackground() {
  const stage = document.getElementById('stage');
  let canvas = document.getElementById('bgCanvas');

  if (!isOBS) {
    if (canvas) canvas.remove();
    Object.assign(stage.style, bgCss(), { backgroundSize: 'cover', backgroundPosition: 'center' });
    return;
  }

  stage.style.backgroundColor = 'transparent';
  stage.style.backgroundImage = 'none';
  if (cfg.bg.type === 'none' || (cfg.bg.type === 'image' && !cfg.bg.imageUrl)) { if (canvas) canvas.remove(); return; }

  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'bgCanvas';
    stage.insertBefore(canvas, stage.firstChild);
  }
  const [W, H] = SK.SIZES[cfg.state.format];
  canvas.width = W; canvas.height = H;

  if (cfg.bg.type === 'image') {
    const url = cfg.bg.imageUrl;
    if (_bgImg && _bgImg.dataset.url === url && _bgImg.complete) paintCanvas(canvas, _bgImg);
    else {
      const img = new Image();
      img.dataset.url = url;
      img.onload = () => { _bgImg = img; paintCanvas(canvas, img); };
      img.onerror = () => console.warn('[bg] falha ao carregar imagem:', url);
      img.src = url;
    }
  } else paintCanvas(canvas, null);
}

/* janelas transparentes da cena em pixels do overlay (sem escala) */
function holeRects() {
  const stage = document.getElementById('stage');
  if (!stage) return [];
  const sr = stage.getBoundingClientRect();
  return Array.from(document.querySelectorAll('#scene .hole')).map(el => {
    const r = el.getBoundingClientRect();
    return {
      key: el.dataset.key || 'win', label: el.dataset.label || 'Janela',
      x: Math.round((r.left - sr.left) / stageScale), y: Math.round((r.top - sr.top) / stageScale),
      w: Math.round(r.width / stageScale), h: Math.round(r.height / stageScale)
    };
  });
}

function paintCanvas(canvas, img) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height, b = cfg.bg;
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, W, H);
  if (img) {
    const s = Math.max(W / img.naturalWidth, H / img.naturalHeight);
    ctx.drawImage(img, (W - img.naturalWidth * s) / 2, (H - img.naturalHeight * s) / 2, img.naturalWidth * s, img.naturalHeight * s);
  } else if (b.type === 'solid') {
    ctx.fillStyle = b.color1; ctx.fillRect(0, 0, W, H);
  } else if (b.type === 'gradient') {
    const rad = b.angle * Math.PI / 180, len = Math.sqrt(W * W + H * H) / 2;
    const dx = Math.sin(rad), dy = -Math.cos(rad);
    const g = ctx.createLinearGradient(W / 2 - len * dx, H / 2 - len * dy, W / 2 + len * dx, H / 2 + len * dy);
    g.addColorStop(0, b.color1); g.addColorStop(1, b.color2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  /* recortes: coordenadas sem escala (divide pelo scale do palco) */
  ctx.globalCompositeOperation = 'destination-out';
  holeRects().forEach(r => ctx.fillRect(r.x, r.y, r.w, r.h));
  ctx.globalCompositeOperation = 'source-over';
}
