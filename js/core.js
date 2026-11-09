/* =========================================================================
   StreamKit — núcleo (funções puras, sem DOM)
   Roda no navegador (window.SK) e no Node (require) para os testes.
========================================================================= */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SK = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SCENES = ['game', 'react', 'reactfree', 'react2cam', 'reactnochat', 'chatting', 'irl', 'start', 'brb', 'end'];
  const FORMATS = ['landscape', 'portrait'];
  const CHAT_MODES = ['none', 'test', 'twitch', 'kick', 'multi', 'youtube', 'tiktok', 'url'];
  const BG_TYPES = ['none', 'solid', 'gradient', 'image'];
  const REACT_TYPES = ['movie', 'series', 'free'];
  const RNC_CORNERS = ['br', 'bl', 'tr', 'tl'];
  const RNC_SIZES = ['s', 'm', 'l'];
  const ALERT_TYPES = ['sub', 'resub', 'gift', 'raid', 'cheer'];
  const CAM_ASPECTS = { '16:9': 225, '4:3': 300, '1:1': 400 };
  const EMOTE_PLATFORMS = ['twitch', 'kick', 'bttv', 'ffz', '7tv'];
  const CHAT_PLATFORMS = ['twitch', 'kick', 'youtube'];
  const GOAL_TYPES = ['subs', 'followers', 'custom'];
  const SIZES = { landscape: [1920, 1080], portrait: [1080, 1920] };

  const DEFAULT_BOTS = 'nightbot, streamelements, streamlabs, moobot, fossabot, wizebot, botrix, botrixoficial, kickbot';

  function defaults() {
    return {
      state: { color: '#d6f24b', scene: 'game', format: 'landscape' },
      reactState: { type: 'movie', title: 'Nome do filme', season: '1', episode: '1', note: '' },
      gameState: { name: 'Seu jogo aqui', nick: '@seunick' },
      /* React sem chat: config própria da moldura da webcam (handle vazio = nick exibido) */
      reactNoChat: { handle: '', showHandle: true, color: '#ffffff', border: 2, size: 'm', corner: 'br' },
      /* React com várias webcams: 2 ou 3 pessoas; nome vazio = sem etiqueta */
      reactCams: { count: 2, name1: '', name2: '', name3: '' },
      irlState: { kicker: 'Explorando', location: 'Sua localização' },
      social: {
        tiktok: { on: false, handle: '' },
        instagram: { on: false, handle: '' },
        youtube: { on: false, handle: '' }
      },
      SP: { enabled: false, clientId: '', current: null },
      /* todos os textos fixos do overlay; *palavra* vira negrito */
      labels: {
        now: 'Agora', playing: 'Jogando',
        movie: 'Filme', series: 'Série', free: 'React',
        reactPrefix: 'Reagindo a', episode: 'T{t} · E{e}', freeTitle: 'Reagindo com o *chat*',
        chattingTag: 'Ao vivo', chatting: 'Just Chatting',
        live: 'Ao vivo', chat: 'Chat', pinned: 'Destaque do chat', nowPlaying: 'Tocando agora',
        first: 'Primeira vez', startIn: 'Começa em', backIn: 'Volto em', countdownDone: 'Agora',
        recent: 'Último apoio', credits: 'Valeu pelo apoio'
      },
      layout: { camAspect: '4:3', showNick: true },
      endState: { message: 'Obrigado por assistir. Até a próxima live.' },
      CHAT: { mode: 'none', url: '', kickChannel: '', kickChatroomId: '', ytVideoId: '', ytApiKey: '', kickKey: '' },
      TWITCH: { channel: '' },
      bg: { type: 'none', color1: '#0a0a0c', color2: '#1a1a2e', angle: 135, imageUrl: '' },
      hideLive: false,
      square: false,
      chatFilter: {
        hideCommands: true, hideBots: true, bots: DEFAULT_BOTS, blocked: '', showBadges: true,
        extEmotes: true, highlightFirst: true, hideAfter: 0, showPlatform: true
      },
      alerts: {
        enabled: false, sound: true, volume: 0.5, duration: 7,
        types: { sub: true, resub: true, gift: true, raid: true, cheer: true }
      },
      goal: { enabled: false, type: 'subs', title: 'Meta de subs', current: 0, target: 50, autoSubs: false },
      countdown: { endsAt: 0 },
      texts: {
        start: { kicker: 'A live já vai começar', title: 'Começando', highlight: 'em instantes', sub: 'Pega a água, ajeita a cadeira. Já já a gente entra no ar.', ticker: 'Deixa o follow | Ativa as notificações | Chama a galera' },
        brb: { kicker: 'Pausa rápida', title: 'Volto', highlight: 'já', sub: 'Não sai daí. Volto em poucos minutos.', ticker: 'Pausa rápida | Já volto | Aproveita pra chamar alguém' },
        end: { kicker: 'Fim da transmissão', title: 'Valeu por', highlight: 'assistir', ticker: 'Obrigado pela companhia | Até a próxima live | Me segue nas redes' },
        chatting: { topic: 'Papo solto' }
      },
      pinned: null,
      pinnedFor: 0,
      recent: { enabled: false, list: [] },
      alertTest: null,
      _editor: { id: '', at: 0 }
    };
  }

  /* ---------------------------------------------------------------------
     Texto / HTML
  --------------------------------------------------------------------- */
  const HTML_ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, c => HTML_ESC[c]);
  }

  function clampText(s, n) {
    s = String(s == null ? '' : s);
    return s.length > n ? s.slice(0, n) : s;
  }

  /* texto do usuário com *negrito* (escapa antes, então é seguro) */
  function richText(str) {
    return escapeHtml(str).replace(/\*([^*]+)\*/g, '<b>$1</b>');
  }

  /* "T{t} · E{e}" + { t: '3', e: '7' } → "T3 · E7" (valores escapados) */
  function fillTemplate(tpl, vals) {
    return escapeHtml(tpl).replace(/\{(\w+)\}/g, (m, k) => (k in vals ? escapeHtml(vals[k]) : m));
  }

  /* canal Twitch/Kick: minúsculo, sem @, só caracteres válidos */
  function cleanChannel(v) {
    return String(v || '').trim().toLowerCase().replace(/^@+/, '').replace(/[^a-z0-9_-]/g, '').slice(0, 40);
  }

  /* só http(s) — bloqueia javascript:, data: etc. em iframes e imagens */
  function safeUrl(url) {
    const s = String(url || '').trim();
    if (!s) return '';
    try {
      const u = new URL(s);
      return (u.protocol === 'https:' || u.protocol === 'http:') ? u.href : '';
    } catch (_) { return ''; }
  }

  /* ---------------------------------------------------------------------
     Cores
  --------------------------------------------------------------------- */
  function isHexColor(s) { return typeof s === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s); }

  function expandHex(hex) {
    if (!isHexColor(hex)) return null;
    let h = hex.slice(1);
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    return h.toLowerCase();
  }

  function hexToRgb(hex) {
    const h = expandHex(hex);
    if (!h) return null;
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function hexToRgba(hex, a) {
    const rgb = hexToRgb(hex) || [214, 242, 75];
    return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${a})`;
  }

  /* cor de texto legível em cima da cor de destaque */
  function contrastText(hex) {
    const rgb = hexToRgb(hex);
    if (!rgb) return '#0b0c0e';
    const lum = rgb.map(v => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    const L = 0.2126 * lum[0] + 0.7152 * lum[1] + 0.0722 * lum[2];
    return L > 0.36 ? '#0b0c0e' : '#ffffff';
  }

  const CHAT_COLORS = ['#a78bfa', '#fbbf24', '#f472b6', '#34d399', '#60a5fa', '#fb923c', '#22d3ee', '#f87171'];
  function userColor(name) {
    let h = 0;
    const s = String(name || '');
    for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
    return CHAT_COLORS[Math.abs(h) % CHAT_COLORS.length];
  }

  /* cores muito escuras somem no fundo escuro do chat */
  function readableNameColor(hex, name) {
    const rgb = hexToRgb(hex);
    if (!rgb) return userColor(name);
    const brightness = (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000;
    return brightness < 70 ? userColor(name) : '#' + expandHex(hex);
  }

  /* ---------------------------------------------------------------------
     Config: mescla com os padrões e valida tipos/valores
  --------------------------------------------------------------------- */
  function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }

  function mergeShape(def, src) {
    if (!isObj(src)) return def;
    const out = {};
    for (const k of Object.keys(def)) {
      const d = def[k], s = src[k];
      if (isObj(d)) out[k] = mergeShape(d, s);
      else if (d === null) out[k] = s === undefined ? null : s;
      else if (typeof d === 'number') out[k] = (typeof s === 'number' && isFinite(s)) ? s : (typeof s === 'string' && s.trim() !== '' && isFinite(+s) ? +s : d);
      else if (typeof d === 'string') out[k] = (typeof s === 'string' || typeof s === 'number') ? String(s) : d;
      else if (typeof d === 'boolean') out[k] = typeof s === 'boolean' ? s : d;
      else out[k] = d;
    }
    return out;
  }

  function oneOf(v, list, fallback) { return list.includes(v) ? v : fallback; }
  function clampNum(v, min, max) { return Math.min(max, Math.max(min, v)); }

  function normalizeSegments(list) {
    if (!Array.isArray(list)) return [];
    return list.slice(0, 80).map(s => {
      if (s && s.type === 'emote' && /^[\w-]{1,40}$/.test(String(s.id))) {
        return { type: 'emote', id: String(s.id), name: clampText(s.name, 60), platform: oneOf(s.platform, EMOTE_PLATFORMS, 'twitch') };
      }
      return { type: 'text', text: clampText(s && s.text, 500) };
    });
  }

  function normalizeRecent(list) {
    if (!Array.isArray(list)) return [];
    return list.filter(isObj).slice(0, 20).map(a => ({
      type: oneOf(a.type, ALERT_TYPES, 'sub'),
      platform: oneOf(a.platform, CHAT_PLATFORMS, 'twitch'),
      user: clampText(a.user, 40),
      count: Math.max(0, Math.round(+a.count || 0)),
      at: +a.at || 0
    })).filter(a => a.user);
  }

  function normalizeConfig(raw) {
    const def = defaults();
    const c = mergeShape(def, isObj(raw) ? raw : {});

    c.state.scene = oneOf(c.state.scene, SCENES, def.state.scene);
    c.state.format = oneOf(c.state.format, FORMATS, def.state.format);
    if (!isHexColor(c.state.color)) c.state.color = def.state.color;

    c.reactState.type = oneOf(c.reactState.type, REACT_TYPES, 'movie');
    const rnc = c.reactNoChat;
    if (!isHexColor(rnc.color)) rnc.color = def.reactNoChat.color;
    rnc.border = clampNum(Math.round(rnc.border), 1, 8);
    rnc.size = oneOf(rnc.size, RNC_SIZES, 'm');
    rnc.corner = oneOf(rnc.corner, RNC_CORNERS, 'br');
    rnc.handle = clampText(rnc.handle, 40);
    const rc = c.reactCams;
    rc.count = oneOf(rc.count, [2, 3], 2);
    for (const k of ['name1', 'name2', 'name3']) rc[k] = clampText(rc[k], 30);

    for (const k of Object.keys(c.labels)) c.labels[k] = clampText(c.labels[k], 80);
    c.layout.camAspect = oneOf(c.layout.camAspect, Object.keys(CAM_ASPECTS), '4:3');
    c.chatFilter.hideAfter = clampNum(Math.round(c.chatFilter.hideAfter), 0, 600);
    c.pinnedFor = clampNum(Math.round(c.pinnedFor), 0, 3600);
    c.recent.list = normalizeRecent(raw && raw.recent && raw.recent.list);
    c._editor = { id: clampText(c._editor.id, 40), at: Math.max(0, c._editor.at) };

    c.CHAT.mode = oneOf(c.CHAT.mode, CHAT_MODES, 'none');
    c.CHAT.kickChannel = cleanChannel(c.CHAT.kickChannel);
    c.CHAT.kickChatroomId = String(c.CHAT.kickChatroomId).replace(/\D/g, '');
    c.TWITCH.channel = cleanChannel(c.TWITCH.channel);

    c.bg.type = oneOf(c.bg.type, BG_TYPES, 'none');
    if (!isHexColor(c.bg.color1)) c.bg.color1 = def.bg.color1;
    if (!isHexColor(c.bg.color2)) c.bg.color2 = def.bg.color2;
    c.bg.angle = clampNum(c.bg.angle, 0, 360);
    c.bg.imageUrl = safeUrl(c.bg.imageUrl);

    c.alerts.volume = clampNum(c.alerts.volume, 0, 1);
    c.alerts.duration = clampNum(c.alerts.duration, 3, 20);
    c.goal.type = oneOf(c.goal.type, GOAL_TYPES, 'subs');
    c.CHAT.ytApiKey = String(c.CHAT.ytApiKey).replace(/[^\w-]/g, '').slice(0, 60);
    c.CHAT.kickKey = String(c.CHAT.kickKey).toLowerCase().replace(/[^a-f0-9]/g, '').slice(0, 32);
    c.goal.current = Math.max(0, Math.round(c.goal.current));
    c.goal.target = Math.max(1, Math.round(c.goal.target));
    c.countdown.endsAt = Math.max(0, c.countdown.endsAt);

    const cur = raw && raw.SP && raw.SP.current;
    c.SP.current = isObj(cur) && cur.title
      ? { title: clampText(cur.title, 200), artist: clampText(cur.artist, 200), cover: safeUrl(cur.cover), until: Math.max(0, +cur.until || 0) }
      : null;

    const p = raw && raw.pinned;
    c.pinned = isObj(p) && (p.user || Array.isArray(p.segments))
      ? {
          user: clampText(p.user, 40),
          platform: oneOf(p.platform, CHAT_PLATFORMS.concat('test'), 'test'),
          color: isHexColor(p.color) ? p.color : userColor(p.user),
          segments: normalizeSegments(p.segments),
          at: +p.at || 0
        }
      : null;

    const t = raw && raw.alertTest;
    c.alertTest = isObj(t) && +t.id ? { id: +t.id, type: oneOf(t.type, ALERT_TYPES, 'sub') } : null;
    return c;
  }

  /* ---------------------------------------------------------------------
     Chat: emotes, badges e filtros
  --------------------------------------------------------------------- */
  /* tags.emotes da Twitch: { "25": ["0-4", "12-16"] } — posições em code points */
  function parseTwitchEmotes(message, emotes) {
    const chars = Array.from(String(message || ''));
    const ranges = [];
    if (isObj(emotes)) {
      for (const id of Object.keys(emotes)) {
        for (const r of [].concat(emotes[id] || [])) {
          const m = /^(\d+)-(\d+)$/.exec(r);
          if (m) ranges.push({ id, start: +m[1], end: +m[2] });
        }
      }
    }
    ranges.sort((a, b) => a.start - b.start);
    const out = [];
    let i = 0;
    for (const r of ranges) {
      if (r.start < i || r.end >= chars.length) continue;
      if (r.start > i) out.push({ type: 'text', text: chars.slice(i, r.start).join('') });
      out.push({ type: 'emote', id: r.id, name: chars.slice(r.start, r.end + 1).join(''), platform: 'twitch' });
      i = r.end + 1;
    }
    if (i < chars.length) out.push({ type: 'text', text: chars.slice(i).join('') });
    return out;
  }

  /* conteúdo do Kick: "oi [emote:37226:KEKW] tudo" */
  function parseKickContent(content) {
    const s = String(content || '');
    const out = [];
    const re = /\[emote:(\d+):([^\]]*)\]/g;
    let last = 0, m;
    while ((m = re.exec(s))) {
      if (m.index > last) out.push({ type: 'text', text: s.slice(last, m.index) });
      out.push({ type: 'emote', id: m[1], name: m[2], platform: 'kick' });
      last = re.lastIndex;
    }
    if (last < s.length) out.push({ type: 'text', text: s.slice(last) });
    return out;
  }

  function emoteUrl(seg) {
    const id = String(seg.id);
    if (!/^[\w-]+$/.test(id)) return '';
    switch (seg.platform) {
      case 'kick': return `https://files.kick.com/emotes/${id}/fullsize`;
      case 'bttv': return `https://cdn.betterttv.net/emote/${id}/2x`;
      case 'ffz': return `https://cdn.frankerfacez.com/emote/${id}/2`;
      case '7tv': return `https://cdn.7tv.app/emote/${id}/2x.webp`;
      default: return `https://static-cdn.jtvnw.net/emoticons/v2/${id}/default/dark/2.0`;
    }
  }

  /* ---------------------------------------------------------------------
     Emotes de terceiros (7TV, BTTV, FFZ): resposta da API → lista
     { name, id, platform }; depois aplicados palavra a palavra no texto
  --------------------------------------------------------------------- */
  function parseExtEmotes(platform, json) {
    if (platform === 'bttv') {
      const list = Array.isArray(json) ? json : isObj(json) ? [].concat(json.channelEmotes || [], json.sharedEmotes || []) : [];
      return list.filter(isObj).map(e => ({ name: e.code, id: e.id, platform: 'bttv' }));
    }
    if (platform === 'ffz') {
      return (Array.isArray(json) ? json : []).filter(isObj).map(e => ({ name: e.code, id: e.id, platform: 'ffz' }));
    }
    if (platform === '7tv') {
      const set = isObj(json) && (json.emote_set || json);
      const list = isObj(set) && Array.isArray(set.emotes) ? set.emotes : [];
      return list.filter(isObj).map(e => ({ name: e.name, id: e.id, platform: '7tv' }));
    }
    return [];
  }

  /* listas → mapa nome → emote (só entradas válidas; a última lista vence) */
  function emoteMap(lists) {
    const map = Object.create(null);
    for (const list of lists) for (const e of Array.isArray(list) ? list : []) {
      if (!isObj(e)) continue;
      const name = String(e.name || ''), id = String(e.id || '');
      if (name && name.length <= 60 && !/\s/.test(name) && /^[\w-]{1,40}$/.test(id)) map[name] = { id, platform: e.platform };
    }
    return map;
  }

  function applyEmoteMap(segments, map) {
    if (!map || !Object.keys(map).length) return segments;
    const out = [];
    for (const s of segments) {
      if (s.type !== 'text') { out.push(s); continue; }
      let buf = '';
      for (const part of s.text.split(/(\s+)/)) {
        const e = part && map[part];
        if (e) {
          if (buf) out.push({ type: 'text', text: buf });
          buf = '';
          out.push({ type: 'emote', id: e.id, name: part, platform: e.platform });
        } else buf += part;
      }
      if (buf) out.push({ type: 'text', text: buf });
    }
    return out;
  }

  /* só emotes (e espaços), até 6 → mostrados maiores */
  function isEmoteOnly(segments) {
    let n = 0;
    for (const s of segments || []) {
      if (s.type === 'emote') n++;
      else if (String(s.text).trim()) return false;
    }
    return n > 0 && n <= 6;
  }

  function segmentsToHtml(segments) {
    return (segments || []).map(s => {
      if (s.type === 'emote') {
        const url = emoteUrl(s);
        return url
          ? `<img class="emote" src="${url}" alt="${escapeHtml(s.name)}" title="${escapeHtml(s.name)}">`
          : escapeHtml(s.name);
      }
      return escapeHtml(s.text);
    }).join('');
  }

  function segmentsToText(segments) {
    return (segments || []).map(s => s.type === 'emote' ? s.name : s.text).join('');
  }

  /* badges → lista padronizada: broadcaster, mod, vip, sub */
  function normalizeBadges(platform, raw) {
    const out = [];
    const add = b => { if (!out.includes(b)) out.push(b); };
    if (platform === 'twitch' && isObj(raw)) {
      if (raw.broadcaster) add('broadcaster');
      if (raw.moderator) add('mod');
      if (raw.vip) add('vip');
      if (raw.subscriber || raw.founder) add('sub');
    }
    if (platform === 'kick' && Array.isArray(raw)) {
      for (const b of raw) {
        const t = b && b.type;
        if (t === 'broadcaster') add('broadcaster');
        else if (t === 'moderator') add('mod');
        else if (t === 'vip') add('vip');
        else if (t === 'subscriber' || t === 'founder' || t === 'og') add('sub');
      }
    }
    return out;
  }

  function splitList(s) {
    return String(s || '').split(/[,\n]/).map(x => x.trim().toLowerCase()).filter(Boolean);
  }

  /* true = mensagem não deve aparecer no overlay */
  function shouldHideMessage(msg, filter) {
    if (!filter) return false;
    const text = segmentsToText(msg.segments).trim();
    if (filter.hideCommands && text.startsWith('!')) return true;
    if (filter.hideBots && splitList(filter.bots).includes(String(msg.user || '').toLowerCase())) return true;
    const blocked = splitList(filter.blocked);
    if (blocked.length) {
      const low = text.toLowerCase();
      if (blocked.some(w => low.includes(w))) return true;
    }
    return false;
  }

  /* "Música - Artista" (formato do Snip / now-playing.txt) */
  function parseNowPlaying(text) {
    if (!text) return null;
    const line = String(text).trim().split('\n')[0].trim();
    if (!line) return null;
    const idx = line.indexOf(' - ');
    if (idx > 0) return { title: line.slice(0, idx).trim(), artist: line.slice(idx + 3).trim(), cover: '' };
    return { title: line, artist: '', cover: '' };
  }

  /* ---------------------------------------------------------------------
     Tempo
  --------------------------------------------------------------------- */
  const pad2 = n => String(n).padStart(2, '0');

  function formatClock(d) { return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }

  function formatCountdown(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
    return h ? `${h}:${pad2(m)}:${pad2(s)}` : `${pad2(m)}:${pad2(s)}`;
  }

  /* "21:30" → timestamp da próxima ocorrência desse horário */
  function nextTimeOccurrence(hhmm, now) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim());
    if (!m || +m[1] > 23 || +m[2] > 59) return 0;
    const base = new Date(now);
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate(), +m[1], +m[2], 0, 0);
    if (d.getTime() <= now) d.setDate(d.getDate() + 1);
    return d.getTime();
  }

  /* ---------------------------------------------------------------------
     Widgets
  --------------------------------------------------------------------- */
  function goalPercent(current, target) {
    const t = Math.max(1, +target || 1);
    return clampNum(Math.round(((+current || 0) / t) * 100), 0, 100);
  }

  function parseTicker(str) {
    return String(str || '').split('|').map(s => s.trim()).filter(Boolean).slice(0, 12);
  }

  /* evento do Pusher do Kick → ação padronizada (o chat.js executa) */
  function kickEvent(name, d) {
    d = isObj(d) ? d : {};
    switch (name) {
      case 'ChatMessageEvent': {
        const s = d.sender || {}, id = s.identity || {};
        return { kind: 'message', id: d.id, user: s.username, color: id.color,
          badges: normalizeBadges('kick', id.badges), segments: parseKickContent(d.content) };
      }
      case 'MessageDeletedEvent': return { kind: 'delete', id: (d.message && d.message.id) || d.id };
      case 'UserBannedEvent': return { kind: 'ban', user: String((d.user && d.user.username) || '').toLowerCase() };
      case 'ChatroomClearEvent': return { kind: 'clear' };
      case 'SubscriptionEvent':
        return { kind: 'event', key: 'sub:' + d.username + ':' + d.months,
          event: { type: +d.months > 1 ? 'resub' : 'sub', platform: 'kick', user: d.username, months: +d.months || 0 } };
      case 'GiftedSubscriptionsEvent': {
        const names = Array.isArray(d.gifted_usernames) ? d.gifted_usernames : [];
        const n = names.length || 1;
        return { kind: 'event', key: 'gift:' + d.gifter_username + ':' + n,
          event: { type: 'gift', platform: 'kick', user: d.gifter_username || 'Anônimo', count: n, recipient: n === 1 ? (names[0] || '') : '' } };
      }
      case 'StreamHostEvent':
        return { kind: 'event', key: 'host:' + d.host_username,
          event: { type: 'raid', platform: 'kick', user: d.host_username, viewers: +d.number_viewers || 0 } };
      case 'KicksGifted': {
        const user = (d.sender && d.sender.username) || d.username;
        const amount = +((d.gift && d.gift.amount) || d.amount) || 0;
        if (!user) return null;
        return { kind: 'event', key: 'kicks:' + user + ':' + amount + ':' + (d.gift && d.gift.gift_id),
          event: { type: 'cheer', platform: 'kick', user, amount } };
      }
    }
    return null;
  }

  /* ---------------------------------------------------------------------
     Twitch IRC (WebSocket oficial, anônimo) — sem biblioteca externa
  --------------------------------------------------------------------- */
  const IRC_UNESCAPE = { s: ' ', ':': ';', '\\': '\\', r: '\r', n: '\n' };
  function parseIrc(line) {
    let s = String(line || ''), tags = {}, prefix = '';
    if (s[0] === '@') {
      const sp = s.indexOf(' ');
      for (const kv of s.slice(1, sp).split(';')) {
        const eq = kv.indexOf('=');
        const k = eq < 0 ? kv : kv.slice(0, eq), v = eq < 0 ? '' : kv.slice(eq + 1);
        tags[k] = v.replace(/\\(.)/g, (m, c) => IRC_UNESCAPE[c] !== undefined ? IRC_UNESCAPE[c] : c);
      }
      s = s.slice(sp + 1);
    }
    if (s[0] === ':') { const sp = s.indexOf(' '); prefix = s.slice(1, sp); s = s.slice(sp + 1); }
    const ti = s.indexOf(' :');
    const trailing = ti >= 0 ? s.slice(ti + 2) : null;
    const params = (ti >= 0 ? s.slice(0, ti) : s).split(' ').filter(Boolean);
    const command = params.shift() || '';
    if (trailing !== null) params.push(trailing);
    return { tags, prefix, command, params, nick: prefix.split('!')[0] };
  }

  /* "25:0-4,12-16/1902:6-10" → { 25: ['0-4', '12-16'], 1902: ['6-10'] } */
  function ircEmotes(tag) {
    const out = {};
    for (const part of String(tag || '').split('/')) {
      const [id, ranges] = part.split(':');
      if (id && ranges) out[id] = ranges.split(',');
    }
    return out;
  }
  /* "broadcaster/1,subscriber/12" → { broadcaster: '1', subscriber: '12' } */
  function ircBadges(tag) {
    const out = {};
    for (const b of String(tag || '').split(',')) { const [k, v] = b.split('/'); if (k) out[k] = v || '1'; }
    return out;
  }

  function twitchIrc(m) {
    if (!m || !m.command) return null;
    const t = m.tags || {};
    const user = t['display-name'] || t.login || m.nick;
    switch (m.command) {
      case 'PRIVMSG': {
        let text = m.params[1] || '', action = false;
        const am = /^\u0001ACTION (.*)\u0001$/.exec(text);
        if (am) { text = am[1]; action = true; }
        const bits = +t.bits || 0;
        return {
          kind: 'message', id: t.id, user, color: t.color, action, highlight: bits > 0,
          first: t['first-msg'] === '1', badges: normalizeBadges('twitch', ircBadges(t.badges)),
          segments: parseTwitchEmotes(text, ircEmotes(t.emotes)),
          event: bits > 0 ? { type: 'cheer', platform: 'twitch', user, amount: bits } : null
        };
      }
      case 'USERNOTICE': {
        const id = t['msg-id'];
        let event = null;
        if (id === 'sub') event = { type: 'sub', platform: 'twitch', user };
        else if (id === 'resub') event = { type: 'resub', platform: 'twitch', user, months: +t['msg-param-cumulative-months'] || 0 };
        else if (id === 'submysterygift') event = { type: 'gift', platform: 'twitch', user, count: +t['msg-param-mass-gift-count'] || 1 };
        /* subs individuais de uma "gift bomb" já vêm no submysterygift */
        else if (id === 'subgift' && !t['msg-param-community-gift-id'])
          event = { type: 'gift', platform: 'twitch', user, count: 1, recipient: t['msg-param-recipient-display-name'] || '' };
        else if (id === 'raid') event = { type: 'raid', platform: 'twitch', user: t['msg-param-displayName'] || user, viewers: +t['msg-param-viewerCount'] || 0 };
        if (!event) return null;
        const text = m.params[1] || '';
        return text
          ? { kind: 'message', id: t.id, user, color: t.color, highlight: true, badges: normalizeBadges('twitch', ircBadges(t.badges)),
              segments: parseTwitchEmotes(text, ircEmotes(t.emotes)), event }
          : { kind: 'event', event };
      }
      case 'CLEARMSG': return { kind: 'delete', id: t['target-msg-id'] || '' };
      case 'CLEARCHAT': return m.params[1] ? { kind: 'ban', user: String(m.params[1]).toLowerCase() } : { kind: 'clear' };
      case 'ROOMSTATE': return t['room-id'] ? { kind: 'room', roomId: t['room-id'] } : null;
      case '366': return { kind: 'joined' };
    }
    return null;
  }

  /* ID do vídeo do YouTube a partir do ID, do link watch/live/youtu.be */
  function ytVideoId(input) {
    const s = String(input || '').trim();
    if (/^[\w-]{11}$/.test(s)) return s;
    const m = /(?:[?&]v=|youtu\.be\/|\/live\/|\/shorts\/|\/embed\/)([\w-]{11})/.exec(s);
    return m ? m[1] : '';
  }

  /* item de liveChatMessages (YouTube Data API v3) → ação padronizada */
  function youtubeItem(it) {
    if (!isObj(it) || !isObj(it.snippet)) return null;
    const sn = it.snippet, au = isObj(it.authorDetails) ? it.authorDetails : {};
    const user = au.displayName || 'usuário';
    const badges = [];
    if (au.isChatOwner) badges.push('broadcaster');
    if (au.isChatModerator) badges.push('mod');
    if (au.isChatSponsor) badges.push('sub');
    const text = sn.displayMessage || (sn.textMessageDetails && sn.textMessageDetails.messageText) || '';
    const at = Date.parse(sn.publishedAt) || 0;
    const msg = extra => Object.assign({ kind: 'message', id: it.id, user, badges, at, segments: text ? [{ type: 'text', text }] : [] }, extra);
    switch (sn.type) {
      case 'textMessageEvent': return msg({});
      case 'superChatEvent': case 'superStickerEvent': {
        const d = sn.superChatDetails || sn.superStickerDetails || {};
        return Object.assign(msg({ highlight: true }), {
          event: { type: 'cheer', platform: 'youtube', user, amountText: d.amountDisplayString || '', amount: Math.round((+d.amountMicros || 0) / 1e6) }
        });
      }
      case 'newSponsorEvent': return { kind: 'event', at, event: { type: 'sub', platform: 'youtube', user } };
      case 'memberMilestoneChatEvent': {
        const months = +((sn.memberMilestoneChatDetails || {}).memberMonth) || 0;
        return Object.assign(text ? msg({ highlight: true }) : { kind: 'event', at }, { event: { type: 'resub', platform: 'youtube', user, months } });
      }
      case 'membershipGiftingEvent': {
        const n = +((sn.membershipGiftingDetails || {}).giftMembershipsCount) || 1;
        return { kind: 'event', at, event: { type: 'gift', platform: 'youtube', user, count: n } };
      }
      case 'messageDeletedEvent': return { kind: 'delete', id: (sn.messageDeletedDetails || {}).deletedMessageId || '' };
      case 'userBannedEvent': return { kind: 'ban', user: String(((sn.userBannedDetails || {}).bannedUserDetails || {}).displayName || '').toLowerCase() };
    }
    return null;
  }

  /* ---------------------------------------------------------------------
     Expiração de widgets
  --------------------------------------------------------------------- */
  /* Spotify: o painel grava até quando a faixa toca; painel fechado → some */
  function trackActive(cur, now) { return !!cur && (!cur.until || now < cur.until); }
  function pinnedActive(p, seconds, now) { return !!p && (!seconds || !p.at || now - p.at < seconds * 1000); }

  /* últimos apoios: junta listas (painel + OBS) sem duplicar, mais novo primeiro */
  function recentKey(a) { return [a.type, a.platform, String(a.user).toLowerCase(), a.count, Math.floor(a.at / 60000)].join('|'); }
  function mergeRecent(...lists) {
    const seen = new Set(), out = [];
    for (const a of [].concat(...lists).sort((x, y) => y.at - x.at)) {
      const k = recentKey(a);
      if (seen.has(k)) continue;
      seen.add(k); out.push(a);
    }
    return out.slice(0, 20);
  }
  function recentFromEvent(a, now) {
    const count = a.count || a.amount || a.viewers || a.months || 0;
    return normalizeRecent([{ type: a.type, platform: a.platform, user: a.user, count, at: now }])[0] || null;
  }
  function recentText(a) {
    if (!a) return '';
    switch (a.type) {
      case 'gift': return a.count > 1 ? `${a.count} subs de presente` : 'sub de presente';
      case 'resub': return a.count ? `resub · ${plural(a.count, 'mês', 'meses')}` : 'resub';
      case 'raid': return a.count ? `${a.platform === 'kick' ? 'host' : 'raid'} · ${a.count}` : (a.platform === 'kick' ? 'host' : 'raid');
      case 'cheer': return a.platform === 'youtube' ? 'super chat' : `${a.count} ${a.platform === 'kick' ? 'kicks' : 'bits'}`;
      default: return 'sub';
    }
  }

  /* ---------------------------------------------------------------------
     Encaixe de fontes no OBS (obs-websocket)
     box: janela do overlay em pixels do canvas do OBS
     src: tamanho nativo da fonte. 'cover' corta o excesso (sem barras),
     'contain' cabe inteira (sobra fundo). Crop é em pixels da fonte.
  --------------------------------------------------------------------- */
  function fitTransform(box, src, mode) {
    const sw = +src.width, sh = +src.height;
    if (!(sw > 0 && sh > 0 && box.w > 0 && box.h > 0)) return null;
    const base = { rotation: 0, alignment: 5, boundsType: 'OBS_BOUNDS_NONE', cropLeft: 0, cropRight: 0, cropTop: 0, cropBottom: 0 };
    if (mode === 'contain') {
      const s = Math.min(box.w / sw, box.h / sh);
      return Object.assign(base, {
        positionX: box.x + (box.w - sw * s) / 2, positionY: box.y + (box.h - sh * s) / 2, scaleX: s, scaleY: s
      });
    }
    const s = Math.max(box.w / sw, box.h / sh);
    const cx = Math.max(0, Math.floor((sw - box.w / s) / 2)), cy = Math.max(0, Math.floor((sh - box.h / s) / 2));
    return Object.assign(base, {
      positionX: box.x, positionY: box.y,
      scaleX: box.w / (sw - 2 * cx), scaleY: box.h / (sh - 2 * cy),
      cropLeft: cx, cropRight: cx, cropTop: cy, cropBottom: cy
    });
  }

  /* Fonte Navegador do overlay: a página desenha o palco W×H no canto
     superior esquerdo, escalado para caber na fonte (sw×sh). Mapeia esse
     palco para o canvas inteiro do OBS, cortando a sobra à direita/embaixo. */
  function overlayTransform(canvas, src, W, H) {
    const sw = +src.width, sh = +src.height;
    if (!(sw > 0 && sh > 0)) return null;
    const s = Math.min(sw / W, sh / H);
    const vw = Math.round(W * s), vh = Math.round(H * s);
    return {
      rotation: 0, alignment: 5, boundsType: 'OBS_BOUNDS_NONE', positionX: 0, positionY: 0,
      scaleX: canvas.width / vw, scaleY: canvas.height / vh,
      cropLeft: 0, cropTop: 0, cropRight: Math.max(0, sw - vw), cropBottom: Math.max(0, sh - vh)
    };
  }

  /* proporção legível: 400×225 → "16:9" */
  function aspectLabel(w, h) {
    const known = [['16:9', 16 / 9], ['9:16', 9 / 16], ['4:3', 4 / 3], ['3:4', 3 / 4], ['1:1', 1], ['21:9', 21 / 9]];
    const r = w / h, hit = known.find(([, v]) => Math.abs(v - r) / v < 0.015);
    return hit ? hit[0] : r.toFixed(2) + ':1';
  }

  function plural(n, one, many) { return `${n} ${n === 1 ? one : many}`; }

  /* textos do alerta para cada tipo de evento */
  function alertCopy(a) {
    const kick = a.platform === 'kick';
    if (a.platform === 'youtube') {
      if (a.type === 'cheer') return { label: 'Super Chat', title: a.user, detail: a.amountText ? `Mandou ${a.amountText}` : 'Mandou um Super Chat' };
      if (a.type === 'sub') return { label: 'Novo membro', title: a.user, detail: 'Bem-vindo ao clube' };
      if (a.type === 'gift') return { label: 'Assinatura de presente', title: a.user, detail: a.count > 1 ? `Presenteou ${plural(a.count, 'assinatura', 'assinaturas')}` : 'Presenteou uma assinatura' };
    }
    switch (a.type) {
      case 'sub': return { label: 'Novo inscrito', title: a.user, detail: a.message || 'Bem-vindo ao time' };
      case 'resub': return { label: 'Reinscrição', title: a.user, detail: a.months ? plural(a.months, 'mês', 'meses') + ' de apoio' : 'Continua no time' };
      case 'gift': return {
        label: 'Sub de presente', title: a.user,
        detail: a.count > 1 ? `Presenteou ${plural(a.count, 'sub', 'subs')}` : (a.recipient ? `Presenteou ${a.recipient}` : 'Presenteou um sub')
      };
      case 'raid': return { label: kick ? 'Host' : 'Raid', title: a.user, detail: a.viewers ? `Chegou com ${plural(a.viewers, 'pessoa', 'pessoas')}` : 'Chegou com a galera' };
      case 'cheer': return { label: kick ? 'Kicks' : 'Bits', title: a.user, detail: `Mandou ${a.amount || 0} ${kick ? 'kicks' : 'bits'}` };
      default: return { label: 'Alerta', title: a.user || '', detail: '' };
    }
  }

  function sampleAlert(type) {
    const base = { user: 'Visitante_42', platform: 'twitch' };
    return Object.assign(base, {
      sub: { type: 'sub' },
      resub: { type: 'resub', months: 14 },
      gift: { type: 'gift', count: 5 },
      raid: { type: 'raid', viewers: 87 },
      cheer: { type: 'cheer', amount: 500 }
    }[type] || { type: 'sub' });
  }

  function buildSceneURL(base, scene, format, id) {
    const p = new URLSearchParams();
    p.set('obs', '1');
    p.set('scene', scene);
    p.set('format', format);
    if (id && id !== 'default') p.set('id', id);
    return String(base).split('?')[0].split('#')[0] + '?' + p.toString();
  }

  return {
    SCENES, FORMATS, CHAT_MODES, BG_TYPES, ALERT_TYPES, SIZES, CAM_ASPECTS, GOAL_TYPES,
    defaults, normalizeConfig, mergeShape,
    escapeHtml, richText, fillTemplate, clampText, cleanChannel, safeUrl,
    parseExtEmotes, emoteMap, applyEmoteMap, isEmoteOnly, kickEvent, ytVideoId, youtubeItem, parseIrc, twitchIrc,
    trackActive, pinnedActive, mergeRecent, recentFromEvent, recentText, fitTransform, overlayTransform, aspectLabel,
    isHexColor, hexToRgb, hexToRgba, contrastText, userColor, readableNameColor,
    parseTwitchEmotes, parseKickContent, segmentsToHtml, segmentsToText, emoteUrl,
    normalizeBadges, splitList, shouldHideMessage, parseNowPlaying,
    formatClock, formatCountdown, nextTimeOccurrence,
    goalPercent, parseTicker, alertCopy, sampleAlert, buildSceneURL
  };
});
