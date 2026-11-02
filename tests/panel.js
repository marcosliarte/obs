/* Teste de interação do painel via Chrome DevTools Protocol (sem dependências).
   Simula o usuário digitando/clicando e confere config, preview e salvamento.
   npm run test:panel */
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const CHROME = [process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'
].filter(Boolean).find(p => fs.existsSync(p));
if (!CHROME) { console.error('Chrome/Edge não encontrado. Defina CHROME_PATH.'); process.exit(1); }

const PORT = 9300 + Math.floor(Math.random() * 500);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'streamkit-test-'));
const cfg = { CHAT: { mode: 'test' }, state: { scene: 'game' } };
const URL_ = pathToFileURL(path.join(__dirname, '..', 'index.html')).href + '?offline=1&cfg=' + encodeURIComponent(JSON.stringify(cfg));

const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--window-size=1600,1000', URL_], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));
const results = [];
const check = (name, ok, detail) => results.push({ name, ok: !!ok, detail });

async function connect() {
  for (let i = 0; i < 50; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find(t => t.type === 'page' && t.url.startsWith('file:'));
      if (page) return new WebSocket(page.webSocketDebuggerUrl);
    } catch (_) { /* ainda subindo */ }
    await sleep(200);
  }
  throw new Error('não conectou no Chrome');
}

async function main() {
  const ws = await connect();
  await new Promise(r => ws.addEventListener('open', r, { once: true }));
  let seq = 0;
  const pending = new Map();
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  });
  const send = (method, params = {}) => new Promise(res => {
    const id = ++seq; pending.set(id, res);
    ws.send(JSON.stringify({ id, method, params }));
  });
  const run = async body => {
    const r = await send('Runtime.evaluate', { expression: `(async () => { ${body} })()`, awaitPromise: true, returnByValue: true });
    if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception.description);
    return r.result.result.value;
  };

  /* espera o app iniciar e instala helpers */
  const ready = () => run(`return !!document.documentElement && document.documentElement.dataset.skReady === '1'`).catch(() => false);
  for (let i = 0; i < 80 && !(await ready()); i++) await sleep(100);
  await run(`
    window.T = {
      sleep: ms => new Promise(r => setTimeout(r, ms)),
      $: s => document.querySelector(s),
      type(sel, v) { const el = this.$(sel); el.focus(); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.blur(); },
      toggle(sel, v) { const el = this.$(sel); el.checked = v; el.dispatchEvent(new Event('change', { bubbles: true })); },
      select(sel, v) { const el = this.$(sel); el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); },
      click(sel) { this.$(sel).click(); },
      saves: 0
    };
    const orig = Store.save.bind(Store);
    Store.save = c => { T.saves++; return orig(c); };`);

  check('abrir o painel não salva nada', await run(`await T.sleep(800); return T.saves === 0 && Store.lastStatus.msg === 'Offline'`));

  check('nome do jogo atualiza o preview e salva', await run(`
    T.type('[data-bind="gameState.name"]', 'Hades II');
    await T.sleep(800);
    return cfg.gameState.name === 'Hades II' && T.$('#scene').textContent.includes('Hades II') && T.saves === 1`));

  check('redes sociais salvam (bug antigo)', await run(`
    const before = T.saves;
    T.toggle('[data-bind="social.tiktok.on"]', true);
    T.type('[data-bind="social.tiktok.handle"]', 'liarte');
    await T.sleep(800);
    return cfg.social.tiktok.on && !!T.$('#scene .soc-tiktok') && T.saves > before`));

  check('editor React funciona na cena React 2 cams (bug antigo)', await run(`
    T.click('[data-scene="react2cam"]');
    await T.sleep(50);
    const visible = !T.$('[data-bind="reactState.title"]').closest('[data-scenes]').hidden;
    T.type('[data-bind="reactState.title"]', 'Interestelar');
    await T.sleep(600);
    return visible && T.$('#scene').textContent.includes('Interestelar')`));

  check('tipo Série mostra temporada/episódio', await run(`
    T.click('[data-rtype="series"]');
    T.type('[data-bind="reactState.season"]', '4');
    await T.sleep(400);
    return !T.$('[data-bind="reactState.season"]').closest('[data-show]').hidden && T.$('#scene').textContent.includes('T4 · E')`));

  check('meta: botão +5 atualiza o widget', await run(`
    T.toggle('[data-bind="goal.enabled"]', true);
    T.click('[data-action="goal-add"][data-n="5"]');
    await T.sleep(100);
    return cfg.goal.current === 5 && T.$('#scene .goal-count').textContent.startsWith('5')`));

  check('alerta de teste aparece e é enviado ao OBS', await run(`
    T.click('[data-action="alert-test"][data-type="raid"]');
    await T.sleep(200);
    const el = T.$('#alertLayer .alert');
    return !!el && el.textContent.includes('Raid') && cfg.alertTest && cfg.alertTest.type === 'raid'`));

  check('clicar numa mensagem destaca na tela', await run(`
    T.click('[data-scene="game"]');
    await T.sleep(50);
    for (let i = 0; i < 40 && !T.$('#scene .msg'); i++) await T.sleep(100);
    T.click('#scene .msg');
    await T.sleep(100);
    return !!cfg.pinned && !!T.$('#scene .pin') && !T.$('#pinnedBox').hidden`));

  check('remover destaque', await run(`
    T.click('[data-action="unpin"]');
    await T.sleep(100);
    return cfg.pinned === null && !T.$('#scene .pin')`));

  check('textos da tela Começando + contagem regressiva', await run(`
    T.click('[data-scene="start"]');
    await T.sleep(50);
    T.type('[data-bind="texts.$scene.title"]', 'Já vai');
    T.click('[data-action="countdown-min"][data-min="5"]');
    await T.sleep(1300);
    const cd = T.$('#scene .fs-countdown');
    return cfg.texts.start.title === 'Já vai' && T.$('#scene .fs-title').textContent.includes('Já vai')
      && !cd.hidden && /^0[45]:\\d\\d$/.test(cd.querySelector('.cd-value').textContent)`));

  check('o mesmo campo edita a tela Volto já separadamente', await run(`
    T.click('[data-scene="brb"]');
    await T.sleep(50);
    return T.$('[data-bind="texts.$scene.title"]').value === cfg.texts.brb.title && cfg.texts.start.title === 'Já vai'`));

  check('trocar canal do Kick limpa o chatroom ID', await run(`
    cfg.CHAT.kickChatroomId = '123';
    T.type('[data-bind="CHAT.kickChannel"]', '@Outro_Canal');
    await T.sleep(50);
    return cfg.CHAT.kickChannel === 'outro_canal' && cfg.CHAT.kickChatroomId === ''`));

  check('campos condicionais seguem o modo do chat', await run(`
    T.select('[data-bind="CHAT.mode"]', 'youtube');
    await T.sleep(50);
    const yt = !T.$('[data-bind="CHAT.ytVideoId"]').closest('[data-show]').hidden;
    const kick = T.$('[data-bind="CHAT.kickChatroomId"]').closest('[data-show]').hidden;
    T.select('[data-bind="CHAT.mode"]', 'test');
    return yt && kick`));

  check('cor de destaque aplica no tema', await run(`
    T.click('[data-color="#4f8cff"]');
    await T.sleep(50);
    return getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() === '#4f8cff'
      && T.$('[data-color="#4f8cff"]').classList.contains('is-active')`));

  check('formato 9:16 muda resolução e preview', await run(`
    T.click('[data-format="portrait"]');
    await T.sleep(50);
    return T.$('#resolution').textContent === '1080 × 1920' && T.$('#stage').classList.contains('portrait')`));

  check('menu de links lista as 9 cenas no formato atual', await run(`
    T.click('[data-action="links-toggle"]');
    await T.sleep(50);
    const rows = document.querySelectorAll('#linksList .link-row');
    const ok = rows.length === 9 && [...rows].every(r => r.querySelector('[data-copy-url]').dataset.copyUrl.includes('format=portrait'));
    document.body.click();
    await T.sleep(50);
    return ok && T.$('#linksPop').hidden`));

  check('nenhum erro de JS durante a sessão', await run(`return window.__skErrors.length === 0`),
    await run(`return window.__skErrors.join(' | ')`));

  ws.close();
}

main()
  .catch(e => check('execução', false, e.message))
  .finally(() => {
    proc.kill();
    setTimeout(() => { try { fs.rmSync(profile, { recursive: true, force: true }); } catch (_) {} }, 500);
    for (const r of results) console.log(r.ok ? '✔' : '✖', r.name, !r.ok && r.detail ? '— ' + r.detail : '');
    const failed = results.filter(r => !r.ok).length;
    console.log(`\n${results.length - failed}/${results.length} verificações passaram`);
    process.exitCode = failed ? 1 : 0;
  });
