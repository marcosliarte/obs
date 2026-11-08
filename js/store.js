/* =========================================================================
   Persistência no Supabase (REST)
   - Leitura: SELECT público (o OBS lê a cada POLL_INTERVAL)
   - Escrita: RPC streamkit_save com chave de escrita, se configurada;
     senão PATCH direto (modo antigo, sem proteção)
========================================================================= */
const Store = {
  lastStatus: null,
  lastSaveAt: 0,
  rt: { ws: null, joined: false, ref: 0, hb: null, retry: null, fails: 0 },

  writeKey() { return safeStorage(() => localStorage.getItem('sk_write_key') || '', ''); },
  setWriteKey(v) { safeStorage(() => v ? localStorage.setItem('sk_write_key', v) : localStorage.removeItem('sk_write_key')); },

  headers(extra) {
    return Object.assign({
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY
    }, extra || {});
  },

  /* kind: 'ok' | 'warn' | 'err' */
  status(kind, msg) {
    this.lastStatus = { kind, msg };
    const el = document.getElementById('syncStatus');
    if (!el) return;
    el.dataset.kind = kind;
    el.querySelector('.sync-text').textContent = msg;
  },

  async load() {
    if (OFFLINE) {
      /* testes: ?offline=1&cfg=<json> injeta uma config sem tocar na rede */
      this.status('warn', 'Offline');
      return safeStorage(() => JSON.parse(params.get('cfg') || 'null'), null);
    }
    try {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/streamkit_config?id=eq.${encodeURIComponent(OVERLAY_ID)}&select=config`,
        { headers: this.headers(), cache: 'no-store' }
      );
      if (!r.ok) { this.status('err', 'Erro ao carregar (' + r.status + ')'); return null; }
      const rows = await r.json();
      this.status('ok', 'Conectado');
      return rows && rows[0] && rows[0].config ? rows[0].config : null;
    } catch (e) {
      this.status('err', 'Sem conexão');
      console.warn('[store] falha ao carregar:', e);
      return null;
    }
  },

  /* Realtime do Supabase: avisa na hora que a linha mudou (o polling vira
     reserva). Só usamos o aviso para recarregar — o conteúdo vem do SELECT.
     Requer a tabela na publicação supabase_realtime (supabase/setup.sql). */
  realtime(onChange) {
    if (OFFLINE || typeof WebSocket === 'undefined') return;
    const rt = this.rt;
    const url = SUPABASE_URL.replace(/^http/, 'ws') + '/realtime/v1/websocket?apikey=' + encodeURIComponent(SUPABASE_KEY) + '&vsn=1.0.0';
    const topic = 'realtime:streamkit-' + OVERLAY_ID;
    let ws;
    try { ws = new WebSocket(url); } catch (_) { return; }
    rt.ws = ws;
    const send = (t, event, payload) => { try { ws.send(JSON.stringify({ topic: t, event, payload, ref: String(++rt.ref) })); } catch (_) {} };
    ws.onopen = () => {
      send(topic, 'phx_join', { config: { broadcast: { self: false }, presence: { key: '' },
        postgres_changes: [{ event: '*', schema: 'public', table: 'streamkit_config', filter: 'id=eq.' + OVERLAY_ID }] } });
      rt.hb = setInterval(() => send('phoenix', 'heartbeat', {}), 25000);
    };
    ws.onmessage = e => {
      let m; try { m = JSON.parse(e.data); } catch (_) { return; }
      if (m.topic !== topic) return;
      if (m.event === 'phx_reply' && m.payload && m.payload.status === 'ok') { rt.joined = true; rt.fails = 0; }
      if (m.event === 'postgres_changes') onChange();
    };
    ws.onclose = () => {
      clearInterval(rt.hb);
      rt.joined = false;
      if (rt.ws !== ws) return;
      rt.fails++;
      rt.retry = setTimeout(() => this.realtime(onChange), Math.min(60000, 2000 * Math.pow(2, rt.fails)));
    };
  },

  async save(config) {
    if (OFFLINE) { this.status('warn', 'Offline — não salvo'); return false; }
    this.lastSaveAt = Date.now();
    const key = this.writeKey();
    try {
      if (key) {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/streamkit_save`, {
          method: 'POST',
          headers: this.headers(),
          body: JSON.stringify({ p_id: OVERLAY_ID, p_key: key, p_config: config })
        });
        if (r.ok) { this.status('ok', 'Salvo'); return true; }
        if (r.status !== 404) {
          this.status('err', r.status === 401 || r.status === 403 ? 'Chave de escrita inválida' : 'Erro ao salvar (' + r.status + ')');
          console.warn('[store] rpc falhou:', r.status, await r.text());
          return false;
        }
        /* 404: função ainda não criada no banco → cai no modo antigo */
      }
      const body = JSON.stringify({ config, updated_at: new Date().toISOString() });
      const r = await fetch(`${SUPABASE_URL}/rest/v1/streamkit_config?id=eq.${encodeURIComponent(OVERLAY_ID)}`, {
        method: 'PATCH',
        headers: this.headers({ 'Prefer': 'return=representation' }),
        body
      });
      if (r.ok) {
        const rows = await r.json().catch(() => []);
        if (Array.isArray(rows) && rows.length) { this.status('ok', 'Salvo'); return true; }
        /* nenhuma linha atualizada: a linha não existe ainda → cria */
        const rp = await fetch(`${SUPABASE_URL}/rest/v1/streamkit_config`, {
          method: 'POST',
          headers: this.headers({ 'Prefer': 'return=minimal' }),
          body: JSON.stringify({ id: OVERLAY_ID, config, updated_at: new Date().toISOString() })
        });
        this.status(rp.ok ? 'ok' : 'err', rp.ok ? 'Salvo' : 'Sem permissão para salvar');
        return rp.ok;
      }
      this.status('err', r.status === 401 || r.status === 403 ? 'Escrita bloqueada — informe a chave' : 'Erro ao salvar (' + r.status + ')');
      return false;
    } catch (e) {
      this.status('err', 'Sem conexão');
      console.warn('[store] falha ao salvar:', e);
      return false;
    }
  }
};

let _saveTimer = null;
function scheduleSave() {
  if (isOBS) return;
  Store.status('warn', 'Salvando…');
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    _saveTimer = null;
    cfg._editor = { id: EDITOR_ID, at: Date.now() };
    Store.save(cfg);
  }, 500);
}
