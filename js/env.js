/* =========================================================================
   Ambiente, constantes e estado global da configuração
   URL:
     ?obs=1           modo OBS (sem painel, fundo transparente)
     ?scene= &format= cena e formato (só no modo OBS)
     ?id=nome         usa outra linha de config no Supabase (vários overlays)
     ?offline=1       não acessa a rede (testes)
     ?debug=1         mostra selo de versão no canto
========================================================================= */
/* erros ficam registrados no <html> para o teste de fumaça conferir */
window.__skErrors = [];
function recordError(msg) {
  window.__skErrors.push(String(msg));
  document.documentElement.dataset.skErrors = window.__skErrors.join(' | ');
}
window.addEventListener('error', e => recordError(e.message));
window.addEventListener('unhandledrejection', e => recordError(e.reason && e.reason.message || e.reason));

const params = new URLSearchParams(location.search);
const isOBS = params.get('obs') === '1';
const OFFLINE = params.get('offline') === '1';
const DEBUG = params.get('debug') === '1';
const OVERLAY_ID = (params.get('id') || 'default').replace(/[^\w-]/g, '').slice(0, 40) || 'default';
const APP_VERSION = '3.1.0';   /* mantenha igual ao package.json e aos ?v= do index.html (o teste confere) */
/* identifica este painel: outro painel aberto que salvar é reconhecido */
const EDITOR_ID = Math.random().toString(36).slice(2, 10);

/* Supabase — chave "publishable" (pública por natureza). A escrita deve ser
   protegida pela chave de escrita: veja supabase/setup.sql */
const SUPABASE_URL = 'https://lzfkwdirmwcuwgrgiguq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_PeRkBtbqIR4XK5jvkrVz_g_MVVVWYPQ';
const POLL_INTERVAL = 2500;

let cfg = SK.normalizeConfig({});

/* parâmetros de URL que têm prioridade sobre o Supabase (só no OBS,
   para o painel não gravar esses valores na config compartilhada) */
function applyUrlOverrides() {
  if (!isOBS) return;
  const scene = params.get('scene'), format = params.get('format');
  if (SK.SCENES.includes(scene)) cfg.state.scene = scene;
  if (SK.FORMATS.includes(format)) cfg.state.format = format;

  const t = params.get('twitch'), k = params.get('kick'), m = params.get('chat'), room = params.get('kickroom');
  if (t) cfg.TWITCH.channel = SK.cleanChannel(t);
  if (k) {
    const kc = SK.cleanChannel(k);
    if (kc !== cfg.CHAT.kickChannel) cfg.CHAT.kickChatroomId = '';
    cfg.CHAT.kickChannel = kc;
  }
  if (room) cfg.CHAT.kickChatroomId = room.replace(/\D/g, '');
  if (SK.CHAT_MODES.includes(m)) cfg.CHAT.mode = m;
  else if (t && k) cfg.CHAT.mode = 'multi';
  else if (t) cfg.CHAT.mode = 'twitch';
  else if (k) cfg.CHAT.mode = 'kick';

  if (params.get('hide_live') === '1') cfg.hideLive = true;
  if (params.get('square') === '1') cfg.square = true;
}

function setConfig(raw) {
  cfg = SK.normalizeConfig(raw);
  applyUrlOverrides();
}

function safeStorage(fn, fallback) {
  try { return fn(); } catch (_) { return fallback; }
}
