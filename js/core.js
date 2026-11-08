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
  const SIZES = { landscape: [1920, 1080], portrait: [1080, 1920] };

  const DEFAULT_BOTS = 'nightbot, streamelements, streamlabs, moobot, fossabot, wizebot, botrix, botrixoficial, kickbot';

  function defaults() {
    return {
      state: { color: '#d6f24b', scene: 'game', format: 'landscape' },
      reactState: { type: 'movie', title: 'Nome do filme', season: '1', episode: '1', note: '' },
      gameState: { name: 'Seu jogo aqui', nick: '@seunick' },
      /* React sem chat: config própria da moldura da webcam (handle vazio = nick exibido) */
      reactNoChat: { handle: '', showHandle: true, color: '#ffffff', border: 2, size: 'm', corner: 'br' },
      irlState: { kicker: 'Explorando', location: 'Sua localização' },
      social: {
        tiktok: { on: false, handle: '' },
        instagram: { on: false, handle: '' },
        youtube: { on: false, handle: '' }
      },
      SP: { enabled: false, clientId: '', current: null },
      endState: { message: 'Obrigado por assistir. Até a próxima live.' },
      CHAT: { mode: 'none', url: '', kickChannel: '', kickChatroomId: '', ytVideoId: '' },
      TWITCH: { channel: '' },
      bg: { type: 'none', color1: '#0a0a0c', color2: '#1a1a2e', angle: 135, imageUrl: '' },
      hideLive: false,
      square: false,
      chatFilter: { hideCommands: true, hideBots: true, bots: DEFAULT_BOTS, blocked: '', showBadges: true },
      alerts: {
        enabled: false, sound: true, volume: 0.5, duration: 7,
        types: { sub: true, resub: true, gift: true, raid: true, cheer: true }
      },
      goal: { enabled: false, title: 'Meta de subs', current: 0, target: 50, autoSubs: false },
      countdown: { endsAt: 0 },
      texts: {
        start: { kicker: 'A live já vai começar', title: 'Começando', highlight: 'em instantes', sub: 'Pega a água, ajeita a cadeira. Já já a gente entra no ar.', ticker: 'Deixa o follow | Ativa as notificações | Chama a galera' },
        brb: { kicker: 'Pausa rápida', title: 'Volto', highlight: 'já', sub: 'Não sai daí. Volto em poucos minutos.', ticker: 'Pausa rápida | Já volto | Aproveita pra chamar alguém' },
        end: { kicker: 'Fim da transmissão', title: 'Valeu por', highlight: 'assistir', ticker: 'Obrigado pela companhia | Até a próxima live | Me segue nas redes' },
        chatting: { topic: 'Papo solto' }
      },
      pinned: null,
      alertTest: null
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
        return { type: 'emote', id: String(s.id), name: clampText(s.name, 60), platform: s.platform === 'kick' ? 'kick' : 'twitch' };
      }
      return { type: 'text', text: clampText(s && s.text, 500) };
    });
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
    c.goal.current = Math.max(0, Math.round(c.goal.current));
    c.goal.target = Math.max(1, Math.round(c.goal.target));
    c.countdown.endsAt = Math.max(0, c.countdown.endsAt);

    const cur = raw && raw.SP && raw.SP.current;
    c.SP.current = isObj(cur) && cur.title
      ? { title: clampText(cur.title, 200), artist: clampText(cur.artist, 200), cover: safeUrl(cur.cover) }
      : null;

    const p = raw && raw.pinned;
    c.pinned = isObj(p) && (p.user || Array.isArray(p.segments))
      ? {
          user: clampText(p.user, 40),
          platform: oneOf(p.platform, ['twitch', 'kick', 'test'], 'test'),
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
    if (!/^[\w-]+$/.test(String(seg.id))) return '';
    return seg.platform === 'kick'
      ? `https://files.kick.com/emotes/${seg.id}/fullsize`
      : `https://static-cdn.jtvnw.net/emoticons/v2/${seg.id}/default/dark/2.0`;
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

  function plural(n, one, many) { return `${n} ${n === 1 ? one : many}`; }

  /* textos do alerta para cada tipo de evento */
  function alertCopy(a) {
    const kick = a.platform === 'kick';
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
    SCENES, FORMATS, CHAT_MODES, BG_TYPES, ALERT_TYPES, SIZES,
    defaults, normalizeConfig, mergeShape,
    escapeHtml, clampText, cleanChannel, safeUrl,
    isHexColor, hexToRgb, hexToRgba, contrastText, userColor, readableNameColor,
    parseTwitchEmotes, parseKickContent, segmentsToHtml, segmentsToText, emoteUrl,
    normalizeBadges, splitList, shouldHideMessage, parseNowPlaying,
    formatClock, formatCountdown, nextTimeOccurrence,
    goalPercent, parseTicker, alertCopy, sampleAlert, buildSceneURL
  };
});
