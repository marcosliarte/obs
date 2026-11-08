/* =========================================================================
   Spotify — OAuth PKCE no painel (sem backend)
   O painel consulta a faixa atual e grava em cfg.SP.current; o OBS só lê
   a config, sem precisar de token.
   Plano B: arquivo now-playing.txt ("Música - Artista") ao lado do HTML.
========================================================================= */
const SP = { accessToken: null, refreshToken: null, tokenExpiry: 0, pollTimer: null, testText: '' };

function spRedirectUri() { return location.origin + location.pathname; }

function b64url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function spLogin() {
  const cid = cfg.SP.clientId.trim();
  if (!cid) {
    panelToast('Informe o Client ID do Spotify. Redirect URI do app: ' + spRedirectUri(), 'err');
    return;
  }
  const arr = new Uint8Array(64);
  crypto.getRandomValues(arr);
  const verifier = b64url(arr);
  const challenge = b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
  sessionStorage.setItem('sp_v', verifier);
  sessionStorage.setItem('sp_cid', cid);
  const p = new URLSearchParams({
    response_type: 'code', client_id: cid,
    scope: 'user-read-currently-playing user-read-playback-state',
    redirect_uri: spRedirectUri(), code_challenge_method: 'S256', code_challenge: challenge
  });
  location.href = 'https://accounts.spotify.com/authorize?' + p;
}

async function spExchangeCode(code) {
  const v = sessionStorage.getItem('sp_v');
  const cid = sessionStorage.getItem('sp_cid') || cfg.SP.clientId;
  if (!v || !cid) return false;
  try {
    const r = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: cid, grant_type: 'authorization_code', code, redirect_uri: spRedirectUri(), code_verifier: v })
    });
    const d = await r.json();
    if (!d.access_token) return false;
    cfg.SP.clientId = cid;
    spSetTokens(d);
    sessionStorage.removeItem('sp_v'); sessionStorage.removeItem('sp_cid');
    return true;
  } catch (_) { return false; }
  finally {
    /* tira ?code= da URL, preservando os outros parâmetros */
    const p = new URLSearchParams(location.search);
    p.delete('code'); p.delete('state');
    history.replaceState({}, '', location.pathname + (p.toString() ? '?' + p : ''));
  }
}

function spSetTokens(d) {
  SP.accessToken = d.access_token;
  if (d.refresh_token) SP.refreshToken = d.refresh_token;
  SP.tokenExpiry = Date.now() + (d.expires_in || 3600) * 1000;
  safeStorage(() => localStorage.setItem('sp_auth', JSON.stringify({ c: cfg.SP.clientId, a: SP.accessToken, r: SP.refreshToken, e: SP.tokenExpiry })));
}

function spLoadTokens() {
  const d = safeStorage(() => JSON.parse(localStorage.getItem('sp_auth') || 'null'), null);
  if (!d) return;
  if (d.c && !cfg.SP.clientId) cfg.SP.clientId = d.c;
  SP.accessToken = d.a || null; SP.refreshToken = d.r || null; SP.tokenExpiry = d.e || 0;
}

async function spRefresh() {
  if (!SP.refreshToken || !cfg.SP.clientId) return false;
  try {
    const r = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: SP.refreshToken, client_id: cfg.SP.clientId })
    });
    const d = await r.json();
    if (!d.access_token) return false;
    spSetTokens(d);
    return true;
  } catch (_) { return false; }
}

function spDisconnect() {
  SP.accessToken = SP.refreshToken = null; SP.tokenExpiry = 0;
  safeStorage(() => localStorage.removeItem('sp_auth'));
  spSetCurrent(null);
  syncPanelFields();
}

/* Só salva quando a faixa muda. `until` = quando a faixa acaba: se o painel
   for fechado com música tocando, o OBS esconde o widget sozinho. */
function spSetCurrent(track) {
  const cur = cfg.SP.current;
  const same = cur && track && cur.title === track.title && cur.artist === track.artist && cur.cover === track.cover;
  if (!cur && !track) return;
  if (same && Math.abs((cur.until || 0) - (track.until || 0)) < 15000) return;
  cfg.SP.current = track;
  renderWidgets();
  scheduleSave();
}

async function spFetchFile() {
  try {
    const r = await fetch('now-playing.txt?t=' + Date.now(), { cache: 'no-store' });
    const t = r.ok ? SK.parseNowPlaying(await r.text()) : null;
    /* arquivo não diz quando acaba: validade em blocos de 10 min */
    if (t) t.until = Math.ceil(Date.now() / 600000) * 600000 + 600000;
    spSetCurrent(t);
  } catch (_) { spSetCurrent(null); }
}

async function spPoll() {
  if (!cfg.SP.enabled || isOBS) return;
  if (SP.testText) { spSetCurrent(SK.parseNowPlaying(SP.testText)); return; }
  if (!SP.accessToken) { if (location.protocol !== 'file:') spFetchFile(); return; }
  if (Date.now() > SP.tokenExpiry - 60000 && !(await spRefresh())) { spFetchFile(); return; }
  try {
    const r = await fetch('https://api.spotify.com/v1/me/player/currently-playing', { headers: { Authorization: 'Bearer ' + SP.accessToken } });
    if (r.status === 204) { spSetCurrent(null); return; }
    if (!r.ok) return;
    const d = await r.json();
    if (!d.is_playing || !d.item) { spSetCurrent(null); return; }
    const imgs = (d.item.album && d.item.album.images) || [];
    const cover = (imgs.find(i => i.width && i.width <= 300) || imgs[imgs.length - 1] || {}).url || '';
    const left = Math.max(0, (d.item.duration_ms || 0) - (d.progress_ms || 0));
    spSetCurrent({ title: d.item.name, artist: (d.item.artists || []).map(a => a.name).join(', '), cover, until: Date.now() + left + 8000 });
  } catch (_) { /* rede instável — tenta no próximo ciclo */ }
}

function spSync() {
  if (isOBS || OFFLINE) return;
  clearInterval(SP.pollTimer);
  SP.pollTimer = null;
  if (!cfg.SP.enabled) { spSetCurrent(null); return; }
  spPoll();
  SP.pollTimer = setInterval(spPoll, 5000);
}
