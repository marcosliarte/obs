/* =========================================================================
   Chat — Twitch (IRC oficial, anônimo) + Kick (Pusher, anônimo) + YouTube (API)
   As conexões vivem fora da cena: trocar/re-renderizar a cena não derruba
   o chat nem perde mensagens (o histórico é repintado).
   Também captura eventos (sub, gift, raid, bits) para os alertas.
========================================================================= */
const Chat = {
  history: [],
  maxHistory: 40,
  containers: new Set(),
  seen: new Set(),
  mockTimer: null,
  twitch: { ws: null, channel: '', gen: 0, retry: null, fails: 0 },
  kick: { ws: null, room: '', slug: '', pingTimer: null, retryTimer: null, fails: 0, keyIdx: 0, seenEvents: new Map() },
  /* emotes 7TV / BTTV / FFZ: globais + canais conectados */
  ext: { global: null, channels: {}, map: {} },
  /* YouTube: API oficial por polling (cota diária) — só consulta com a página visível */
  yt: { vid: '', key: '', chatId: '', page: '', timer: null, gen: 0, status: '' },
};

/* No OBS, cada cena tem sua fonte Navegador e todas ficam abertas. Fora do
   ar a página fica "hidden": usamos isso para não gastar a cota do YouTube
   com 9 overlays ao mesmo tempo. */
let pageActive = typeof document === 'undefined' || document.visibilityState !== 'hidden';
document.addEventListener('visibilitychange', () => { pageActive = document.visibilityState !== 'hidden'; });
window.addEventListener('obsSourceActiveChanged', e => { pageActive = !!(e.detail && e.detail.active); });

const PLATFORM_ICONS = {
  twitch: '<svg viewBox="0 0 24 24"><path d="M4.3 3 3 6.4v13.4h4.6V22h2.6l2.4-2.2h3.7l5-4.9V3H4.3zm15.5 11.1-2.9 2.9h-4.6l-2.5 2.4V17H6V4.9h13.8v9.2zM17 8.4h-1.8v5H17v-5zm-5 0h-1.8v5H12v-5z"/></svg>',
  kick: '<svg viewBox="0 0 24 24"><path d="M3 3h6.5v5h2V5.5h2V3H21v6.5h-2.5V12H16v.1h2.5v2.4H21V21h-7.5v-2.5h-2V16h-2v5H3V3z"/></svg>',
  youtube: '<svg viewBox="0 0 24 24"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8zM9.6 15.6V8.4l6.2 3.6-6.2 3.6z"/></svg>'
};
const PLATFORM_NAMES = { twitch: 'Twitch', kick: 'Kick', youtube: 'YouTube' };

/* espera entre tentativas: 3s, 6s, 12s… até 60s */
function retryDelay(fails) { return Math.min(60000, 3000 * Math.pow(2, Math.max(0, fails - 1))); }

/* A Kick troca a chave do Pusher de tempos em tempos (a última vez em out/2026).
   Ordem: chave colada no painel (se houver) → atual → antiga. Se o Pusher
   responder 4001 ("not in this cluster"), passa para a próxima. */
const KICK_KEYS = ['34bf7a0ff419a2a775b9', '32cbd69e4b950bf97679'];
function kickKeys() { return [...new Set([cfg.CHAT.kickKey, ...KICK_KEYS].filter(Boolean))]; }
const kickPusherUrl = key => `wss://ws-us2.pusher.com/app/${key}?protocol=7&client=js&version=8.4.0-rc2&flash=false`;
const MOCK_USERS = ['marina_o', 'pedrohq', 'cafe_amargo', 'ju.design', 'rafa_dev', 'lis_pod', 'thomas.b', 'ana_bea', 'gui_santos', 'dudu99'];
const MOCK_TEXTS = ['salve, cheguei agora', 'que jogada', 'boa noite chat', 'primeira vez aqui, curtindo muito', 'manda mais disso', 'GG', 'isso merece um corte', 'concordo total', 'voltou com tudo hoje', 'qual a configuração do mouse?'];
const BADGE_LABEL = { broadcaster: 'Streamer', mod: 'Mod', vip: 'VIP', sub: 'Sub' };

/* chat por iframe: widgets externos, ou YouTube sem chave da API */
function chatUsesIframe() {
  const mode = cfg.CHAT.mode;
  return mode === 'tiktok' || mode === 'url' || (mode === 'youtube' && !cfg.CHAT.ytApiKey);
}

function chatWants() {
  const mode = cfg.CHAT.mode;
  const alerts = cfg.alerts.enabled || (!isOBS && cfg.goal.autoSubs);
  const yt = !!cfg.CHAT.ytApiKey && !!SK.ytVideoId(cfg.CHAT.ytVideoId);
  return {
    twitch: !!cfg.TWITCH.channel && (mode === 'twitch' || mode === 'multi' || alerts),
    kick: !!cfg.CHAT.kickChannel && (mode === 'kick' || mode === 'multi' || alerts),
    youtube: yt && (mode === 'youtube' || mode === 'multi'),
    showTwitch: mode === 'twitch' || mode === 'multi',
    showKick: mode === 'kick' || mode === 'multi',
    showYoutube: (mode === 'youtube' && !!cfg.CHAT.ytApiKey) || mode === 'multi',
    mock: mode === 'test'
  };
}

function chatShows(platform, w) {
  return (platform === 'twitch' && w.showTwitch) || (platform === 'kick' && w.showKick)
    || (platform === 'youtube' && w.showYoutube) || (platform === 'test' && w.mock);
}

/* Liga/desliga conexões conforme a config atual. Idempotente. */
function chatSync() {
  const w = chatWants();
  if (w.twitch) {
    if (Chat.twitch.channel !== cfg.TWITCH.channel) disconnectTwitch();
    connectTwitch(cfg.TWITCH.channel);
  } else disconnectTwitch();

  if (w.kick) connectKick(cfg.CHAT.kickChannel);
  else disconnectKick();

  if (w.youtube) connectYoutube();
  else disconnectYoutube();

  followersSync();

  if (cfg.chatFilter.extEmotes && (w.twitch || w.kick || w.mock)) loadGlobalEmotes();

  if (w.mock && !Chat.mockTimer) mockTick();
  if (!w.mock && Chat.mockTimer) { clearTimeout(Chat.mockTimer); Chat.mockTimer = null; }

  /* descarta mensagens de plataformas que não aparecem mais */
  const before = Chat.history.length;
  Chat.history = Chat.history.filter(m => chatShows(m.platform, w));
  if (Chat.history.length !== before) chatRepaint();
}

/* ---------- containers (janelas de chat da cena) ---------- */
function chatAttach(el) {
  if (chatUsesIframe()) {
    const src = chatIframeUrl();
    if (src) {
      el.innerHTML = `<iframe class="chat-iframe" src="${SK.escapeHtml(src)}" allowtransparency="true" frameborder="0" scrolling="no"></iframe>`;
      el.classList.add('is-iframe');
      return;
    }
  }
  Chat.containers.add(el);
  paintContainer(el);
}

function chatDetachAll() { Chat.containers.clear(); }

function chatIframeUrl() {
  const ytVid = SK.ytVideoId(cfg.CHAT.ytVideoId);
  if (cfg.CHAT.mode === 'youtube' && ytVid) {
    const vid = encodeURIComponent(ytVid);
    const domain = location.hostname || 'localhost';
    return `https://www.youtube.com/live_chat?v=${vid}&embed_domain=${encodeURIComponent(domain)}`;
  }
  if (cfg.CHAT.mode === 'tiktok' || cfg.CHAT.mode === 'url') return SK.safeUrl(cfg.CHAT.url);
  return '';
}

function chatHintText() {
  const mode = cfg.CHAT.mode;
  const w = chatWants();
  if (mode === 'none') return 'Chat desativado';
  if (mode === 'twitch' && !cfg.TWITCH.channel) return 'Informe o canal da Twitch';
  if (mode === 'kick' && !cfg.CHAT.kickChannel) return 'Informe o canal do Kick';
  if (mode === 'youtube' && !SK.ytVideoId(cfg.CHAT.ytVideoId)) return 'Informe o link da live do YouTube';
  if (mode === 'multi' && !cfg.TWITCH.channel && !cfg.CHAT.kickChannel && !w.youtube) return 'Informe ao menos um canal';
  if (chatUsesIframe()) return 'Informe a URL do widget';
  const who = [w.showTwitch && cfg.TWITCH.channel && 'Twitch/' + cfg.TWITCH.channel,
    w.showKick && cfg.CHAT.kickChannel && 'Kick/' + cfg.CHAT.kickChannel, w.youtube && 'YouTube'].filter(Boolean).join(' + ');
  if (Chat.yt.status) return 'YouTube: ' + Chat.yt.status + (who ? ' · ' + who : '');
  return who ? 'Aguardando mensagens — ' + who : '';
}

function chatVisibleNow(m, now) {
  const secs = cfg.chatFilter.hideAfter;
  return !secs || now - m.at < secs * 1000;
}

function paintContainer(el) {
  el.innerHTML = '';
  const now = Date.now();
  const list = Chat.history.slice(-25).filter(m => chatVisibleNow(m, now));
  for (const m of list) el.prepend(messageEl(m));
  if (!list.length && !isOBS) {
    const hint = chatHintText();
    if (hint) el.innerHTML = `<div class="chat-hint">${SK.escapeHtml(hint)}</div>`;
  }
}

function chatRepaint() {
  for (const el of Chat.containers) {
    if (!el.isConnected) { Chat.containers.delete(el); continue; }
    paintContainer(el);
  }
}

/* mensagens somem depois de X segundos (opcional) — chamado a cada 1s */
function chatSweep() {
  const secs = cfg.chatFilter.hideAfter;
  if (!secs) return;
  const limit = Date.now() - secs * 1000;
  for (const el of Chat.containers) {
    el.querySelectorAll('.msg:not(.is-out)').forEach(n => {
      if (+n.dataset.at < limit) { n.classList.add('is-out'); setTimeout(() => n.remove(), 500); }
    });
  }
}

function messageEl(m) {
  const el = document.createElement('div');
  const first = m.first && cfg.chatFilter.highlightFirst;
  el.className = 'msg' + (m.action ? ' is-action' : '') + (m.highlight ? ' is-highlight' : '')
    + (first ? ' is-first' : '') + (SK.isEmoteOnly(m.segments) ? ' is-emote-only' : '');
  el.dataset.id = m.id;
  el.dataset.user = m.userKey;
  el.dataset.at = m.at;
  el.style.setProperty('--name', m.color);
  const plat = cfg.chatFilter.showPlatform && cfg.CHAT.mode === 'multi' && PLATFORM_ICONS[m.platform]
    ? `<span class="msg-plat ${m.platform}" title="${PLATFORM_NAMES[m.platform]}">${PLATFORM_ICONS[m.platform]}</span>` : '';
  const badges = cfg.chatFilter.showBadges
    ? m.badges.map(b => `<span class="msg-badge b-${b}">${BADGE_LABEL[b]}</span>`).join('') : '';
  const firstTag = first ? `<span class="msg-first">${SK.escapeHtml(cfg.labels.first)}</span>` : '';
  el.innerHTML = `${firstTag}${plat}${badges}<span class="msg-name">${SK.escapeHtml(m.user)}</span><span class="msg-text">${SK.segmentsToHtml(m.segments)}</span>`;
  return el;
}

/* ---------- entrada de mensagens ---------- */
function chatPush(m) {
  if (Chat.seen.has(m.id)) return;
  Chat.seen.add(m.id);
  if (Chat.seen.size > 500) Chat.seen = new Set([...Chat.seen].slice(-250));

  const w = chatWants();
  const visible = chatShows(m.platform, w) || m.platform === 'test';
  if (!visible || SK.shouldHideMessage(m, cfg.chatFilter)) return;

  m.color = SK.readableNameColor(m.color, m.user);
  if (cfg.chatFilter.extEmotes) m.segments = SK.applyEmoteMap(m.segments, Chat.ext.map);
  Chat.history.push(m);
  if (Chat.history.length > Chat.maxHistory) Chat.history.shift();

  for (const el of Chat.containers) {
    if (!el.isConnected) { Chat.containers.delete(el); continue; }
    el.querySelectorAll('.chat-hint').forEach(h => h.remove());
    el.prepend(messageEl(m));
    while (el.children.length > 25) el.lastChild.remove();
  }
}

function chatRemove(pred) {
  const removed = Chat.history.filter(pred);
  if (!removed.length) return;
  Chat.history = Chat.history.filter(m => !pred(m));
  const ids = new Set(removed.map(m => m.id));
  for (const el of Chat.containers) {
    el.querySelectorAll('.msg').forEach(n => { if (ids.has(n.dataset.id)) n.remove(); });
  }
}

function makeMessage(platform, { id, user, color, badges, segments, action, highlight, first }) {
  const name = SK.clampText(user || 'usuário', 32);
  return {
    id: platform + ':' + (id || Date.now() + Math.random()),
    platform,
    user: name,
    userKey: platform + ':' + name.toLowerCase(),
    color: SK.isHexColor(color) ? color : SK.userColor(name),
    badges: badges || [],
    segments: segments || [],
    action: !!action,
    highlight: !!highlight,
    first: !!first,
    at: Date.now()
  };
}

/* ---------- simulado ---------- */
function mockTick() {
  const user = MOCK_USERS[Math.random() * MOCK_USERS.length | 0];
  const text = MOCK_TEXTS[Math.random() * MOCK_TEXTS.length | 0];
  const roll = Math.random();
  const badges = roll < 0.12 ? ['mod'] : roll < 0.4 ? ['sub'] : [];
  chatPush(makeMessage('test', { user, badges, segments: [{ type: 'text', text }], first: Math.random() < 0.06 }));
  Chat.mockTimer = setTimeout(mockTick, 1400 + Math.random() * 2200);
}

/* ---------- emotes 7TV / BTTV / FFZ ---------- */
function extFetch(url) {
  return fetch(url).then(r => (r.ok ? r.json() : null)).catch(() => null);
}

function rebuildEmoteMap() {
  /* global = [ffz, bttv, 7tv]; cada canal = uma lista */
  const lists = [...(Chat.ext.global || []), ...Object.values(Chat.ext.channels)];
  Chat.ext.map = SK.emoteMap(lists);
}

async function loadGlobalEmotes() {
  if (OFFLINE || Chat.ext.global) return;
  Chat.ext.global = [];
  const [bttv, ffz, stv] = await Promise.all([
    extFetch('https://api.betterttv.net/3/cached/emotes/global'),
    extFetch('https://api.betterttv.net/3/cached/frankerfacez/emotes/global'),
    extFetch('https://7tv.io/v3/emote-sets/global')
  ]);
  Chat.ext.global = [SK.parseExtEmotes('ffz', ffz), SK.parseExtEmotes('bttv', bttv), SK.parseExtEmotes('7tv', stv)];
  rebuildEmoteMap();
}

/* key: "twitch:<room-id>" ou "kick:<user_id>" — cada canal carrega uma vez */
async function loadChannelEmotes(key) {
  if (OFFLINE || !cfg.chatFilter.extEmotes || Chat.ext.channels[key]) return;
  Chat.ext.channels[key] = [];
  const [plat, id] = key.split(':');
  if (!/^\d+$/.test(id)) return;
  let lists;
  if (plat === 'twitch') {
    const [bttv, ffz, stv] = await Promise.all([
      extFetch(`https://api.betterttv.net/3/cached/users/twitch/${id}`),
      extFetch(`https://api.betterttv.net/3/cached/frankerfacez/users/twitch/${id}`),
      extFetch(`https://7tv.io/v3/users/twitch/${id}`)
    ]);
    lists = [SK.parseExtEmotes('ffz', ffz), SK.parseExtEmotes('bttv', bttv), SK.parseExtEmotes('7tv', stv)];
  } else {
    lists = [SK.parseExtEmotes('7tv', await extFetch(`https://7tv.io/v3/users/kick/${id}`))];
  }
  Chat.ext.channels[key] = [].concat(...lists);
  rebuildEmoteMap();
  console.log(`[emotes] ${Chat.ext.channels[key].length} emotes de ${key}`);
}

/* ---------- YOUTUBE (Data API v3) ----------
   1 consulta para achar o chat da live (videos) + 1 a cada ~6 s no OBS
   (15 s no painel). A cota grátis (10.000/dia) dá ~3 h de live por dia;
   peça aumento no Google Cloud se precisar. */
const YT_API = 'https://www.googleapis.com/youtube/v3/';

function disconnectYoutube() {
  const y = Chat.yt;
  y.gen++;
  clearTimeout(y.timer);
  Object.assign(y, { timer: null, chatId: '', page: '', vid: '', key: '', status: '' });
}

function connectYoutube() {
  const y = Chat.yt, vid = SK.ytVideoId(cfg.CHAT.ytVideoId), key = cfg.CHAT.ytApiKey;
  if (OFFLINE || (y.timer && y.vid === vid && y.key === key)) return;
  disconnectYoutube();
  y.vid = vid; y.key = key;
  ytLoop(y.gen);
}

async function ytLoop(gen) {
  const y = Chat.yt;
  if (gen !== y.gen) return;
  let wait = 3000;                              /* fora do ar: só confere de novo */
  if (pageActive) {
    try { wait = Math.max(isOBS ? 6000 : 15000, await ytFetch(gen)); }
    catch (e) {
      y.status = e.message; wait = e.wait || 60000;
      console.warn('[youtube]', e.message);
      chatRepaintHints();
    }
  }
  if (gen === y.gen) y.timer = setTimeout(() => ytLoop(gen), wait);
}

async function ytGet(path, params) {
  const r = await fetch(YT_API + path + '?' + new URLSearchParams(Object.assign({ key: Chat.yt.key }, params)));
  const j = await r.json().catch(() => ({}));
  if (r.ok) return j;
  const reason = (((j.error || {}).errors || [])[0] || {}).reason || String(r.status);
  const msg = { quotaExceeded: 'a cota diária da API acabou', liveChatEnded: 'a live terminou', liveChatNotFound: 'chat da live não encontrado',
    keyInvalid: 'chave da API inválida', forbidden: 'chave sem permissão para este site' }[reason] || 'erro da API (' + reason + ')';
  const err = new Error(msg);
  err.wait = reason === 'quotaExceeded' ? 15 * 60000 : reason === 'keyInvalid' ? 10 * 60000 : 60000;
  if (reason === 'liveChatEnded' || reason === 'liveChatNotFound') { Chat.yt.chatId = ''; Chat.yt.page = ''; }
  throw err;
}

async function ytFetch(gen) {
  const y = Chat.yt;
  if (!y.chatId) {
    const v = await ytGet('videos', { part: 'liveStreamingDetails', id: y.vid });
    const det = v.items && v.items[0] && v.items[0].liveStreamingDetails;
    if (!det || !det.activeLiveChatId) { const e = new Error('esse vídeo não está ao vivo'); e.wait = 60000; throw e; }
    if (gen !== y.gen) return 0;
    y.chatId = det.activeLiveChatId;
  }
  const backlog = !y.page;
  const d = await ytGet('liveChat/messages', Object.assign(
    { liveChatId: y.chatId, part: 'snippet,authorDetails', maxResults: '200' }, y.page ? { pageToken: y.page } : {}));
  if (gen !== y.gen) return 0;
  y.page = d.nextPageToken || y.page;
  if (y.status) { y.status = ''; chatRepaintHints(); }
  const items = d.items || [];
  for (const it of backlog ? items.slice(-15) : items) handleYoutubeItem(it);
  return d.pollingIntervalMillis || 5000;
}

function handleYoutubeItem(it) {
  const a = SK.youtubeItem(it);
  if (!a) return;
  if (a.kind === 'message') chatPush(makeMessage('youtube', a));
  else if (a.kind === 'delete') { const id = 'youtube:' + a.id; chatRemove(m => m.id === id); }
  else if (a.kind === 'ban') { const key = 'youtube:' + a.user; chatRemove(m => m.userKey === key); }
  /* alerta só de evento recente: ao voltar ao ar, a página busca o que perdeu */
  if (a.event && Date.now() - (a.at || 0) < 30000) onStreamEvent(a.event);
}

function chatRepaintHints() {
  if (isOBS) return;
  for (const el of Chat.containers) if (el.querySelector('.chat-hint') || !el.children.length) paintContainer(el);
}

/* ---------- SEGUIDORES (Kick, público) para a meta ---------- */
const Followers = { kick: null, slug: '', timer: null, gen: 0 };

function followersSync() {
  const want = !OFFLINE && cfg.goal.enabled && cfg.goal.type === 'followers' && !!cfg.CHAT.kickChannel;
  if (!want) {
    Followers.gen++; clearTimeout(Followers.timer);
    Object.assign(Followers, { timer: null, slug: '', kick: null });
    return;
  }
  if (Followers.slug === cfg.CHAT.kickChannel) return;
  Followers.gen++; clearTimeout(Followers.timer);
  Followers.slug = cfg.CHAT.kickChannel; Followers.kick = null;
  const gen = Followers.gen;
  const tick = async () => {
    try {
      const r = await fetch(`https://kick.com/api/v2/channels/${encodeURIComponent(Followers.slug)}`, { headers: { Accept: 'application/json' } });
      const j = r.ok ? await r.json() : null;
      if (gen === Followers.gen && j && typeof j.followers_count === 'number') setFollowers(j.followers_count);
    } catch (_) { /* Kick bloqueou ou sem rede — tenta no próximo minuto */ }
    if (gen === Followers.gen) Followers.timer = setTimeout(tick, 60000);
  };
  tick();
}

function setFollowers(n) {
  Followers.kick = n;
  if (!isOBS && cfg.goal.current !== n) { cfg.goal.current = n; syncPanelFields(); scheduleSave(); }
  renderWidgets();
}

/* ---------- TWITCH (IRC por WebSocket, anônimo) ----------
   Conexão direta com o chat oficial: sem biblioteca de CDN que possa sumir.
   Se cair, tenta de novo sozinho (3 s, 6 s, 12 s… até 1 min). */
function disconnectTwitch() {
  const t = Chat.twitch;
  t.gen++;
  clearTimeout(t.retry); t.retry = null;
  if (t.ws) { t.ws.onclose = null; try { t.ws.close(); } catch (_) {} }
  t.ws = null; t.channel = '';
}

function connectTwitch(channel) {
  const t = Chat.twitch;
  if (OFFLINE || !channel || t.ws || t.retry) return;
  const gen = ++t.gen;
  t.channel = channel;
  let ws;
  try { ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443'); } catch (_) { return; }
  t.ws = ws;
  ws.onopen = () => {
    ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
    ws.send('NICK justinfan' + (10000 + Math.floor(Math.random() * 80000)));
    ws.send('JOIN #' + channel);
  };
  ws.onmessage = e => {
    if (gen !== t.gen) return;
    for (const line of String(e.data).split('\r\n')) {
      if (!line) continue;
      if (line.startsWith('PING')) { ws.send('PONG' + line.slice(4)); continue; }
      handleTwitchLine(line);
    }
  };
  ws.onclose = () => {
    if (t.ws !== ws) return;
    t.ws = null;
    t.fails++;
    const wait = retryDelay(t.fails);
    console.warn(`[twitch] conexão caiu; nova tentativa em ${wait / 1000}s`);
    t.retry = setTimeout(() => {
      t.retry = null;
      if (chatWants().twitch) connectTwitch(cfg.TWITCH.channel);
    }, wait);
  };
}

function handleTwitchLine(line) {
  const a = SK.twitchIrc(SK.parseIrc(line));
  if (!a) return;
  switch (a.kind) {
    case 'joined':
      Chat.twitch.fails = 0;
      console.log('[twitch] conectado em #' + Chat.twitch.channel);
      break;
    case 'room':
      loadChannelEmotes('twitch:' + a.roomId);
      break;
    case 'message':
      chatPush(makeMessage('twitch', a));
      break;
    case 'delete': {
      const id = 'twitch:' + a.id;
      chatRemove(m => m.id === id);
      break;
    }
    case 'ban': {
      const key = 'twitch:' + a.user;
      chatRemove(m => m.userKey === key);
      break;
    }
    case 'clear':
      chatRemove(m => m.platform === 'twitch');
      break;
  }
  if (a.event) onStreamEvent(a.event);
}

/* ---------- KICK ---------- */
async function resolveKickChatroom(slug) {
  if (cfg.CHAT.kickChatroomId) return cfg.CHAT.kickChatroomId;
  for (const url of [`https://kick.com/api/v2/channels/${slug}`, `https://kick.com/api/v1/channels/${slug}`]) {
    try {
      const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!r.ok) continue;
      const j = await r.json();
      const id = j && j.chatroom && j.chatroom.id;
      if (j && j.user_id) loadChannelEmotes('kick:' + j.user_id);
      if (id) {
        cfg.CHAT.kickChatroomId = String(id);
        if (!isOBS) { syncPanelFields(); scheduleSave(); }
        return cfg.CHAT.kickChatroomId;
      }
    } catch (_) { /* CORS/Cloudflare — tenta o próximo */ }
  }
  console.warn('[kick] não consegui descobrir o chatroom de "' + slug + '". Preencha manualmente no painel.');
  return '';
}

function scheduleKickRetry() {
  const k = Chat.kick;
  clearTimeout(k.retryTimer);
  k.fails++;
  const wait = retryDelay(k.fails);
  k.retryTimer = setTimeout(() => { if (chatWants().kick) connectKick(cfg.CHAT.kickChannel); }, wait);
}

function disconnectKick() {
  const k = Chat.kick;
  clearInterval(k.pingTimer); clearTimeout(k.retryTimer);
  if (k.ws) { k.ws.onclose = null; try { k.ws.close(); } catch (_) {} }
  k.ws = null; k.room = ''; k.slug = '';
}

/* o mesmo evento pode chegar por mais de um canal Pusher */
function kickEventSeen(key) {
  const now = Date.now(), seen = Chat.kick.seenEvents;
  for (const [k, t] of seen) if (now - t > 15000) seen.delete(k);
  if (seen.has(key)) return true;
  seen.set(key, now);
  return false;
}

async function connectKick(slug) {
  const k = Chat.kick;
  if (OFFLINE || !slug) return;
  if (k.ws && k.slug === slug && k.room === cfg.CHAT.kickChatroomId) return;
  if (k.slug === slug && k.resolving) return;
  k.resolving = true;
  const room = await resolveKickChatroom(slug);
  k.resolving = false;
  if (cfg.CHAT.kickChannel !== slug) return;
  if (!room) { scheduleKickRetry(); return; }
  if (k.ws && k.room === room) return;
  disconnectKick();
  k.slug = slug; k.room = room;

  const keys = kickKeys();
  const key = keys[k.keyIdx % keys.length];
  const ws = new WebSocket(kickPusherUrl(key));
  k.ws = ws;
  ws.onopen = () => {
    for (const channel of [`chatrooms.${room}.v2`, `chatroom_${room}`]) {
      ws.send(JSON.stringify({ event: 'pusher:subscribe', data: { auth: '', channel } }));
    }
    k.fails = 0;
    k.pingTimer = setInterval(() => { try { ws.send(JSON.stringify({ event: 'pusher:ping', data: {} })); } catch (_) {} }, 60000);
    console.log('[kick] conectado na sala ' + room);
  };
  ws.onmessage = ev => {
    let msg; try { msg = JSON.parse(ev.data); } catch (_) { return; }
    if (msg.event === 'pusher:ping') { ws.send(JSON.stringify({ event: 'pusher:pong', data: {} })); return; }
    if (msg.event === 'pusher:error') {
      const d = typeof msg.data === 'string' ? (() => { try { return JSON.parse(msg.data); } catch (_) { return {}; } })() : (msg.data || {});
      /* 4001 = chave inválida/aposentada → tenta a próxima já */
      if (d.code === 4001) { k.keyIdx++; k.fails = 0; console.warn('[kick] chave ' + key + ' recusada; tentando outra'); }
      return;
    }
    if (!msg.event || msg.event.startsWith('pusher')) return;
    let d; try { d = typeof msg.data === 'string' ? JSON.parse(msg.data) : msg.data; } catch (_) { return; }
    if (!d) return;
    handleKickEvent(msg.event.replace(/^App\\Events\\/, ''), d);
  };
  ws.onclose = () => {
    clearInterval(k.pingTimer);
    if (k.ws !== ws) return;
    k.ws = null;
    scheduleKickRetry();
  };
}

function handleKickEvent(name, d) {
  const a = SK.kickEvent(name, d);
  if (!a) return;
  switch (a.kind) {
    case 'message':
      chatPush(makeMessage('kick', a));
      break;
    case 'delete': {
      const id = 'kick:' + a.id;
      chatRemove(m => m.id === id);
      break;
    }
    case 'ban': {
      const key = 'kick:' + a.user;
      chatRemove(m => m.userKey === key);
      break;
    }
    case 'clear':
      chatRemove(m => m.platform === 'kick');
      break;
    case 'event':
      if (!kickEventSeen(a.key)) onStreamEvent(a.event);
      break;
  }
}
