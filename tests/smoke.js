/* Teste de fumaça no navegador real (Chrome/Edge headless).
   Abre o overlay em modo offline com uma config de exemplo, para cada cena
   e formato, e confere o DOM gerado e a ausência de erros de JS.

   npm run test:browser
   node tests/smoke.js --shots pasta   (salva screenshots para revisão)
   CHROME_PATH=... para indicar o navegador manualmente */
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'
].filter(Boolean);
const CHROME = CANDIDATES.find(p => fs.existsSync(p));
if (!CHROME) { console.error('Chrome/Edge não encontrado. Defina CHROME_PATH.'); process.exit(1); }

const INDEX = pathToFileURL(path.join(__dirname, '..', 'index.html')).href;
const shotsArg = process.argv.indexOf('--shots');
const SHOTS = shotsArg > -1 ? path.resolve(process.argv[shotsArg + 1]) : null;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

const FIXTURE = {
  state: { color: '#d6f24b', scene: 'game', format: 'landscape' },
  gameState: { name: 'Elden Ring', nick: '@liarte' },
  reactState: { type: 'series', title: 'Breaking Bad', season: '3', episode: '7', note: 'rewatch' },
  CHAT: { mode: 'test' },
  social: { tiktok: { on: true, handle: 'liarte' }, instagram: { on: true, handle: 'liarte' }, youtube: { on: false, handle: '' } },
  SP: { enabled: true, current: { title: 'Midnight City', artist: 'M83' } },
  goal: { enabled: true, title: 'Meta de subs', current: 32, target: 50 },
  countdown: { endsAt: Date.now() + 5 * 60 * 1000 },
  pinned: { user: 'marina_o', platform: 'twitch', color: '#a78bfa', segments: [{ type: 'text', text: 'Essa jogada foi absurda!' }] },
  irlState: { kicker: 'Explorando', location: 'Avenida Paulista' }
};

function url(query, cfg) {
  const p = new URLSearchParams(Object.assign({ offline: '1' }, query));
  if (cfg) p.set('cfg', JSON.stringify(cfg));
  return INDEX + '?' + p.toString();
}

function chrome(args) {
  return execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
    '--virtual-time-budget=2500', ...args], { encoding: 'utf8', timeout: 60000, stdio: ['ignore', 'pipe', 'ignore'] });
}

function load(u, size, shotName) {
  const dom = chrome([`--window-size=${size}`, '--dump-dom', u]);
  if (SHOTS && shotName) {
    chrome([`--window-size=${size}`, `--screenshot=${path.join(SHOTS, shotName + '.png')}`, u]);
  }
  return dom;
}

/* o headless desconta ~100px de "barra" da janela, então só exigimos que
   o palco caiba na janela e ocupe uma boa parte dela */
const stageScale = dom => +((/id="stage"[^>]*transform: scale\(([\d.]+)\)/.exec(dom) || [])[1] || 0);
function fitsWindow(dom, size, format) {
  const [ww, wh] = size.split(',').map(Number);
  const [W, H] = format === 'portrait' ? [1080, 1920] : [1920, 1080];
  const s = stageScale(dom), max = Math.min(ww / W, wh / H);
  return s > 0 && s <= max + 1e-6 && s >= max * 0.8;
}

const count = (dom, re) => (dom.match(re) || []).length;
const results = [];
function check(name, cond, detail) { results.push({ name, ok: !!cond, detail }); }

function baseChecks(label, dom) {
  check(`${label}: inicializou`, /data-sk-ready="1"/.test(dom));
  const err = /data-sk-errors="([^"]*)"/.exec(dom);
  check(`${label}: sem erros de JS`, !err, err && err[1]);
}

const EXPECT = {
  game:      ['class="win win-cam', 'class="win win-game', 'data-chat', 'class="info"', 'class="goal', 'class="np"', 'class="soc ', 'class="pin"', 'class="msg'],
  react:     ['class="win win-video', 'Breaking Bad', 'T3 · E7', 'data-chat', 'class="goal', 'class="np"'],
  reactfree: ['class="win win-video', 'Reagindo <b>ao vivo</b>', 'data-chat'],
  react2cam: ['Webcam 1', 'Webcam 2', 'class="goal', 'class="np"'],
  reactnochat: ['class="win win-video is-bare', 'class="rnc"', 'class="rnc-handle"'],
  chatting:  ['Webcam principal', 'data-chat', 'class="goal'],
  irl:       ['class="irl-location"', 'Avenida Paulista', 'class="np"', 'class="goal', 'class="soc '],
  start:     ['class="fs fs-start"', 'class="fs-countdown"', 'class="ticker"', 'class="soc '],
  brb:       ['class="fs fs-brb"', 'class="fs-countdown"', 'class="soc '],
  end:       ['class="fs fs-end"', 'class="soc ']
};

console.log('Navegador:', CHROME);

/* 1. painel */
{
  const dom = load(url({}, FIXTURE), '1600,1000', 'painel');
  baseChecks('painel', dom);
  check('painel: 10 abas de cena', count(dom, /class="tab[^"]*" data-scene=/g) === 10);
  check('painel: campo do jogo preenchido', /data-bind="gameState.name"/.test(dom));
  check('painel: links não aparecem antes do clique', /id="linksPop" hidden/.test(dom));
}

/* 2. todas as cenas, nos dois formatos, em modo OBS */
for (const format of ['landscape', 'portrait']) {
  for (const scene of Object.keys(EXPECT)) {
    const size = format === 'landscape' ? '1920,1080' : '1080,1920';
    const dom = load(url({ obs: '1', scene, format }, FIXTURE), size, `obs-${scene}-${format}`);
    const label = `${scene}/${format}`;
    baseChecks(label, dom);
    check(`${label}: modo OBS ativo`, /<body class="obs">/.test(dom));
    check(`${label}: palco cabe na janela`, fitsWindow(dom, size, format));
    for (const needle of EXPECT[scene]) check(`${label}: contém ${needle}`, dom.includes(needle));
  }
}

/* 3. segurança: texto da config nunca vira HTML */
{
  const evil = '<img src=x onerror=alert(1)>';
  const dom = load(url({ obs: '1', scene: 'irl', format: 'landscape' },
    { irlState: { kicker: evil, location: evil }, gameState: { nick: evil }, CHAT: { mode: 'url', url: 'javascript:alert(1)' } }), '1920,1080');
  baseChecks('xss', dom);
  check('xss: rótulo IRL escapado', dom.includes('&lt;img src=x onerror=alert(1)&gt;'));
  check('xss: nenhuma tag injetada', !/<img src="?x"? onerror/i.test(dom));
}

/* 4. config antiga (antes da v3) continua funcionando */
{
  const legacy = { state: { color: '#ff5b7f', scene: 'react', format: 'landscape' }, CHAT: { mode: 'kick', kickChannel: 'liart3', kickChatroomId: '73203653' },
    reactState: { type: 'movie', title: 'De olhos bem fechados', season: '2', episode: '2', note: '' }, gameState: { name: 'SEU JOGO AQUI', nick: '@seunick' } };
  const dom = load(url({ obs: '1', scene: 'react', format: 'landscape' }, legacy), '1920,1080');
  baseChecks('legado', dom);
  check('legado: título do react', dom.includes('De olhos bem fechados'));
  check('legado: cor aplicada', dom.includes('--accent: #ff5b7f'));
}

/* 5. opções de URL */
{
  const dom = load(url({ obs: '1', scene: 'game', format: 'landscape', hide_live: '1', square: '1' }, FIXTURE), '1920,1080');
  baseChecks('url', dom);
  check('url: hide_live remove o selo', !dom.includes('class="live-badge'));
  check('url: square aplicado', /class="stage landscape scene-game is-square/.test(dom));
}

/* 6. OBS em tamanho diferente de 1920×1080 escala o palco */
{
  const dom = load(url({ obs: '1', scene: 'game', format: 'landscape' }, FIXTURE), '1280,720');
  check('escala: 1280×720 reduz o palco para caber', fitsWindow(dom, '1280,720', 'landscape') && stageScale(dom) < 0.67);
}

const failed = results.filter(r => !r.ok);
for (const r of results) if (!r.ok) console.log('✖', r.name, r.detail ? '— ' + r.detail : '');
console.log(`\n${results.length - failed.length}/${results.length} verificações passaram`);
if (SHOTS) console.log('Screenshots em', SHOTS);
process.exit(failed.length ? 1 : 0);
