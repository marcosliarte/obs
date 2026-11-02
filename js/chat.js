/* =========================================================================
   Chat — Twitch (tmi.js, anônimo) + Kick (Pusher, anônimo)
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
  twitch: { client: null, channel: '', connecting: false, scriptPromise: null },
  kick: { ws: null, room: '', slug: '', pingTimer: null, retryTimer: null, seenEvents: new Map() },
  giftBombs: {}
};

const KICK_PUSHER = 'wss://ws-us2.pusher.com/app/32cbd69e4b950bf97679?protocol=7&client=js&version=8.4.0-rc2&flash=false';
const MOCK_USERS = ['marina_o', 'pedrohq', 'cafe_amargo', 'ju.design', 'rafa_dev', 'lis_pod', 'thomas.b', 'ana_bea', 'gui_santos', 'dudu99'];
const MOCK_TEXTS = ['salve, cheguei agora', 'que jogada', 'boa noite chat', 'primeira vez aqui, curtindo muito', 'manda mais disso', 'GG', 'isso merece um corte', 'concordo total', 'voltou com tudo hoje', 'qual a configuração do mouse?'];
const BADGE_LABEL = { broadcaster: 'Streamer', mod: 'Mod', vip: 'VIP', sub: 'Sub' };

const IFRAME_MODES = ['youtube', 'tiktok', 'url'];

function chatWants() {
  const mode = cfg.CHAT.mode;
  const alerts = cfg.alerts.enabled || (!isOBS && cfg.goal.autoSubs);
  return {
    twitch: !!cfg.TWITCH.channel && (mode === 'twitch' || mode === 'multi' || alerts),
    kick: !!cfg.CHAT.kickChannel && (mode === 'kick' || mode === 'multi' || alerts),
    showTwitch: mode === 'twitch' || mode === 'multi',
    showKick: mode === 'kick' || mode === 'multi',
    mock: mode === 'test'
  };
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

  if (w.mock && !Chat.mockTimer) mockTick();
  if (!w.mock && Chat.mockTimer) { clearTimeout(Chat.mockTimer); Chat.mockTimer = null; }

  /* descarta mensagens de plataformas que não aparecem mais */
  const before = Chat.history.length;
  Chat.history = Chat.history.filter(m =>
    (m.platform === 'twitch' && w.showTwitch) || (m.platform === 'kick' && w.showKick) || (m.platform === 'test' && w.mock));
  if (Chat.history.length !== before) chatRepaint();
}

/* ---------- containers (janelas de chat da cena) ---------- */
function chatAttach(el) {
  if (IFRAME_MODES.includes(cfg.CHAT.mode)) {
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
  if (cfg.CHAT.mode === 'youtube' && cfg.CHAT.ytVideoId.trim()) {
    const vid = encodeURIComponent(cfg.CHAT.ytVideoId.trim());
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
  if ((mode === 'twitch' || mode === 'multi') && !cfg.TWITCH.channel) return 'Informe o canal da Twitch';
  if ((mode === 'kick' || mode === 'multi') && !cfg.CHAT.kickChannel) return 'Informe o canal do Kick';
  if (IFRAME_MODES.includes(mode)) return mode === 'youtube' ? 'Informe o ID da live do YouTube' : 'Informe a URL do widget';
  if (w.showTwitch || w.showKick) {
    const who = [w.showTwitch && 'Twitch/' + cfg.TWITCH.channel, w.showKick && 'Kick/' + cfg.CHAT.kickChannel].filter(Boolean).join(' + ');
    return 'Aguardando mensagens — ' + who;
  }
  return '';
}

function paintContainer(el) {
  el.innerHTML = '';
  const list = Chat.history.slice(-25);
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

function messageEl(m) {
  const el = document.createElement('div');
  el.className = 'msg' + (m.action ? ' is-action' : '') + (m.highlight ? ' is-highlight' : '');
  el.dataset.id = m.id;
  el.dataset.user = m.userKey;
  el.style.setProperty('--name', m.color);
  const plat = cfg.CHAT.mode === 'multi' && m.platform !== 'test'
    ? `<span class="msg-plat ${m.platform}">${m.platform === 'kick' ? 'K' : 'T'}</span>` : '';
  const badges = cfg.chatFilter.showBadges
    ? m.badges.map(b => `<span class="msg-badge b-${b}">${BADGE_LABEL[b]}</span>`).join('') : '';
  el.innerHTML = `${plat}${badges}<span class="msg-name">${SK.escapeHtml(m.user)}</span><span class="msg-text">${SK.segmentsToHtml(m.segments)}</span>`;
  return el;
}

/* ---------- entrada de mensagens ---------- */
function chatPush(m) {
  if (Chat.seen.has(m.id)) return;
  Chat.seen.add(m.id);
  if (Chat.seen.size > 500) Chat.seen = new Set([...Chat.seen].slice(-250));

  const w = chatWants();
  const visible = (m.platform === 'twitch' && w.showTwitch) || (m.platform === 'kick' && w.showKick) || m.platform === 'test';
  if (!visible || SK.shouldHideMessage(m, cfg.chatFilter)) return;

  m.color = SK.readableNameColor(m.color, m.user);
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

function makeMessage(platform, { id, user, color, badges, segments, action, highlight }) {
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
    highlight: !!highlight
  };
}

/* ---------- simulado ---------- */
function mockTick() {
  const user = MOCK_USERS[Math.random() * MOCK_USERS.length | 0];
  const text = MOCK_TEXTS[Math.random() * MOCK_TEXTS.length | 0];
  const roll = Math.random();
  const badges = roll < 0.12 ? ['mod'] : roll < 0.4 ? ['sub'] : [];
  chatPush(makeMessage('test', { user, badges, segments: [{ type: 'text', text }] }));
  Chat.mockTimer = setTimeout(mockTick, 1400 + Math.random() * 2200);
}

/* ---------- TWITCH ---------- */
function loadTmi() {
  if (Chat.twitch.scriptPromise) return Chat.twitch.scriptPromise;
  Chat.twitch.scriptPromise = new Promise((resolve, reject) => {
    if (window.tmi) return resolve(window.tmi);
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/tmi.js@1.8.5/dist/tmi.min.js';
    s.onload = () => resolve(window.tmi);
    s.onerror = () => { Chat.twitch.scriptPromise = null; reject(new Error('falha ao carregar tmi.js')); };
    document.head.appendChild(s);
  });
  return Chat.twitch.scriptPromise;
}

function disconnectTwitch() {
  const t = Chat.twitch;
  if (t.client) { try { t.client.disconnect(); } catch (_) {} }
  t.client = null; t.channel = ''; t.connecting = false;
}

async function connectTwitch(channel) {
  const t = Chat.twitch;
  if (OFFLINE || !channel || t.connecting || t.client) return;
  t.connecting = true;
  t.channel = channel;
  try {
    await loadTmi();
    if (t.channel !== channel) return;
    const client = new window.tmi.Client({
      channels: [channel],
      connection: { reconnect: true, secure: true },
      options: { skipUpdatingEmotesets: true }
    });
    const live = () => client === t.client;
    const twitchMsg = (tags, text, extra) => makeMessage('twitch', Object.assign({
      id: tags.id,
      user: tags['display-name'] || tags.username,
      color: tags.color,
      badges: SK.normalizeBadges('twitch', tags.badges),
      segments: SK.parseTwitchEmotes(text, tags.emotes)
    }, extra));

    client.on('message', (ch, tags, text, self) => {
      if (!live() || self || tags['message-type'] === 'whisper') return;
      chatPush(twitchMsg(tags, text, { action: tags['message-type'] === 'action' }));
    });
    client.on('cheer', (ch, tags, text) => {
      if (!live()) return;
      chatPush(twitchMsg(tags, text, { highlight: true }));
      onStreamEvent({ type: 'cheer', platform: 'twitch', user: tags['display-name'] || tags.username, amount: +tags.bits || 0 });
    });
    client.on('subscription', (ch, user, methods, msg, tags) => {
      if (live()) onStreamEvent({ type: 'sub', platform: 'twitch', user: (tags && tags['display-name']) || user });
    });
    client.on('resub', (ch, user, months, msg, tags) => {
      if (live()) onStreamEvent({ type: 'resub', platform: 'twitch', user: (tags && tags['display-name']) || user, months: +(tags && tags['msg-param-cumulative-months']) || months || 0 });
    });
    client.on('submysterygift', (ch, user, count, methods, tags) => {
      if (!live()) return;
      Chat.giftBombs[String(user).toLowerCase()] = (Chat.giftBombs[String(user).toLowerCase()] || 0) + (+count || 0);
      onStreamEvent({ type: 'gift', platform: 'twitch', user: (tags && tags['display-name']) || user, count: +count || 1 });
    });
    client.on('subgift', (ch, user, streak, recipient, methods, tags) => {
      if (!live()) return;
      const key = String(user).toLowerCase();
      /* subs individuais de uma "gift bomb" já foram anunciados no alerta agrupado */
      if (Chat.giftBombs[key] > 0) { Chat.giftBombs[key]--; return; }
      onStreamEvent({ type: 'gift', platform: 'twitch', user: (tags && tags['display-name']) || user, count: 1, recipient });
    });
    client.on('raided', (ch, user, viewers) => {
      if (live()) onStreamEvent({ type: 'raid', platform: 'twitch', user, viewers: +viewers || 0 });
    });
    client.on('messagedeleted', (ch, user, msg, tags) => {
      const id = 'twitch:' + (tags && tags['target-msg-id']);
      chatRemove(m => m.id === id);
    });
    const removeUser = (ch, user) => {
      const key = 'twitch:' + String(user).toLowerCase();
      chatRemove(m => m.userKey === key);
    };
    client.on('timeout', removeUser);
    client.on('ban', removeUser);
    client.on('clearchat', () => chatRemove(m => m.platform === 'twitch'));

    t.client = client;
    await client.connect();
    console.log('[twitch] conectado em #' + channel);
  } catch (e) {
    console.warn('[twitch] falhou:', e);
    t.client = null; t.channel = '';
  } finally {
    t.connecting = false;
  }
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
  if (!room || cfg.CHAT.kickChannel !== slug) return;
  if (k.ws && k.room === room) return;
  disconnectKick();
  k.slug = slug; k.room = room;

  const ws = new WebSocket(KICK_PUSHER);
  k.ws = ws;
  ws.onopen = () => {
    for (const channel of [`chatrooms.${room}.v2`, `chatroom_${room}`]) {
      ws.send(JSON.stringify({ event: 'pusher:subscribe', data: { auth: '', channel } }));
    }
    k.pingTimer = setInterval(() => { try { ws.send(JSON.stringify({ event: 'pusher:ping', data: {} })); } catch (_) {} }, 60000);
    console.log('[kick] conectado na sala ' + room);
  };
  ws.onmessage = ev => {
    let msg; try { msg = JSON.parse(ev.data); } catch (_) { return; }
    if (msg.event === 'pusher:ping') { ws.send(JSON.stringify({ event: 'pusher:pong', data: {} })); return; }
    if (!msg.event || msg.event.startsWith('pusher')) return;
    let d; try { d = typeof msg.data === 'string' ? JSON.parse(msg.data) : msg.data; } catch (_) { return; }
    if (!d) return;
    handleKickEvent(msg.event.replace(/^App\\Events\\/, ''), d);
  };
  ws.onclose = () => {
    clearInterval(k.pingTimer);
    if (k.ws !== ws) return;
    k.ws = null;
    k.retryTimer = setTimeout(() => { if (chatWants().kick) connectKick(cfg.CHAT.kickChannel); }, 5000);
  };
}

function handleKickEvent(name, d) {
  switch (name) {
    case 'ChatMessageEvent': {
      const s = d.sender || {};
      const id = s.identity || {};
      chatPush(makeMessage('kick', {
        id: d.id, user: s.username, color: id.color,
        badges: SK.normalizeBadges('kick', id.badges),
        segments: SK.parseKickContent(d.content)
      }));
      break;
    }
    case 'MessageDeletedEvent': {
      const id = 'kick:' + ((d.message && d.message.id) || d.id);
      chatRemove(m => m.id === id);
      break;
    }
    case 'UserBannedEvent': {
      const key = 'kick:' + String((d.user && d.user.username) || '').toLowerCase();
      chatRemove(m => m.userKey === key);
      break;
    }
    case 'ChatroomClearEvent':
      chatRemove(m => m.platform === 'kick');
      break;
    case 'SubscriptionEvent':
      if (!kickEventSeen('sub:' + d.username + ':' + d.months))
        onStreamEvent({ type: (+d.months > 1 ? 'resub' : 'sub'), platform: 'kick', user: d.username, months: +d.months || 0 });
      break;
    case 'GiftedSubscriptionsEvent': {
      const n = Array.isArray(d.gifted_usernames) ? d.gifted_usernames.length : 1;
      if (!kickEventSeen('gift:' + d.gifter_username + ':' + n))
        onStreamEvent({ type: 'gift', platform: 'kick', user: d.gifter_username || 'Anônimo', count: n, recipient: n === 1 ? d.gifted_usernames[0] : '' });
      break;
    }
    case 'StreamHostEvent':
      if (!kickEventSeen('host:' + d.host_username))
        onStreamEvent({ type: 'raid', platform: 'kick', user: d.host_username, viewers: +d.number_viewers || 0 });
      break;
    case 'KicksGifted': {
      const user = (d.sender && d.sender.username) || d.username;
      const amount = +((d.gift && d.gift.amount) || d.amount) || 0;
      if (user && !kickEventSeen('kicks:' + user + ':' + amount + ':' + (d.gift && d.gift.gift_id)))
        onStreamEvent({ type: 'cheer', platform: 'kick', user, amount });
      break;
    }
  }
}
