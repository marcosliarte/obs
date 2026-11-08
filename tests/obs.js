/* Teste do encaixe automático contra um OBS simulado (obs-websocket 5).
   Sobe um servidor WebSocket local com o mesmo protocolo (Hello → Identify
   com senha → requests), abre o painel no Chrome headless, conecta, encaixa
   e confere as transformações que o OBS receberia.
   npm run test:obs */
const http = require('node:http');
const crypto = require('node:crypto');
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

/* ---------------- OBS simulado ---------------- */
const PASSWORD = 'senha-teste';
const SALT = 'c2FsdA==', CHALLENGE = 'Y2hhbGxlbmdl';
const sha = s => crypto.createHash('sha256').update(s).digest('base64');
const EXPECTED_AUTH = sha(sha(PASSWORD + SALT) + CHALLENGE);

const ITEMS = [
  { sceneItemId: 1, sourceName: 'Overlay', inputKind: 'browser_source', isGroup: false, w: 1120, h: 800, url: 'https://x.github.io/obs/?obs=1&scene=game' },
  { sceneItemId: 2, sourceName: 'Webcam Logitech', inputKind: 'dshow_input', isGroup: false, w: 1920, h: 1080 },
  { sceneItemId: 3, sourceName: 'Jogo', inputKind: 'game_capture', isGroup: false, w: 2560, h: 1440 },
  { sceneItemId: 4, sourceName: 'Música', inputKind: 'wasapi_output_capture', isGroup: false, w: 0, h: 0 }
];
const calls = [];

function frame(str) {
  const data = Buffer.from(str);
  const head = data.length < 126 ? Buffer.from([0x81, data.length])
    : data.length < 65536 ? Buffer.from([0x81, 126, data.length >> 8, data.length & 255])
      : (() => { const b = Buffer.alloc(10); b[0] = 0x81; b[1] = 127; b.writeBigUInt64BE(BigInt(data.length), 2); return b; })();
  return Buffer.concat([head, data]);
}

function parseFrames(buf, onText) {
  let off = 0;
  while (buf.length - off >= 2) {
    const op = buf[off] & 15, masked = buf[off + 1] & 128;
    let len = buf[off + 1] & 127, p = off + 2;
    if (len === 126) { if (buf.length < p + 2) break; len = buf.readUInt16BE(p); p += 2; }
    else if (len === 127) { if (buf.length < p + 8) break; len = Number(buf.readBigUInt64BE(p)); p += 8; }
    const mask = masked ? buf.slice(p, p + 4) : null;
    if (masked) p += 4;
    if (buf.length < p + len) break;
    const payload = Buffer.from(buf.slice(p, p + len));
    if (mask) for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
    if (op === 1) onText(payload.toString());
    if (op === 8) return { rest: Buffer.alloc(0), closed: true };
    off = p + len;
  }
  return { rest: buf.slice(off) };
}

function respond(d) {
  const ok = data => ({ requestType: d.requestType, requestId: d.requestId, requestStatus: { result: true, code: 100 }, responseData: data });
  const item = id => ITEMS.find(i => i.sceneItemId === id);
  const rd = d.requestData || {};
  calls.push(d);
  switch (d.requestType) {
    case 'GetVideoSettings': return ok({ baseWidth: 1920, baseHeight: 1080, outputWidth: 1280, outputHeight: 720 });
    case 'GetSceneList': return ok({ currentProgramSceneName: 'Jogo', scenes: [{ sceneName: 'Jogo', sceneIndex: 1 }, { sceneName: 'React', sceneIndex: 0 }] });
    case 'GetSceneItemList': return ok({ sceneItems: ITEMS.map(({ w, h, url, ...i }) => i) });
    case 'GetInputSettings': return ok({ inputSettings: { url: (ITEMS.find(i => i.sourceName === rd.inputName) || {}).url || '' } });
    case 'GetSceneItemTransform': { const i = item(rd.sceneItemId); return ok({ sceneItemTransform: { sourceWidth: i.w, sourceHeight: i.h } }); }
    case 'SetSceneItemTransform': case 'SetSceneItemIndex': return ok({});
    default: return { requestType: d.requestType, requestId: d.requestId, requestStatus: { result: false, code: 204, comment: 'desconhecido' } };
  }
}

const server = http.createServer();
server.on('upgrade', (req, sock) => {
  const accept = crypto.createHash('sha1').update(req.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n'
    + `Sec-WebSocket-Accept: ${accept}\r\nSec-WebSocket-Protocol: obswebsocket.json\r\n\r\n`);
  const send = o => sock.write(frame(JSON.stringify(o)));
  send({ op: 0, d: { obsWebSocketVersion: '5.5.0', rpcVersion: 1, authentication: { challenge: CHALLENGE, salt: SALT } } });
  let buf = Buffer.alloc(0);
  sock.on('data', chunk => {
    const r = parseFrames(Buffer.concat([buf, chunk]), text => {
      const m = JSON.parse(text);
      if (m.op === 1) {
        if (m.d.authentication !== EXPECTED_AUTH) {
          sock.end(Buffer.from([0x88, 2, 0x0f, 0xa9]));   /* close 4009 */
          return;
        }
        send({ op: 2, d: { negotiatedRpcVersion: 1 } });
      }
      if (m.op === 6) send({ op: 7, d: respond(m.d) });
    });
    buf = r.rest;
    if (r.closed) sock.end();
  });
  sock.on('error', () => {});
});

/* ---------------- painel no Chrome ---------------- */
const sleep = ms => new Promise(r => setTimeout(r, ms));
const results = [];
const check = (name, ok, detail) => results.push({ name, ok: !!ok, detail });

async function main() {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const WS_PORT = server.address().port;
  const PORT = 9800 + Math.floor(Math.random() * 500);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'streamkit-obs-'));
  const cfg = { state: { scene: 'game', format: 'landscape' }, layout: { camAspect: '4:3' } };
  const URL_ = pathToFileURL(path.join(__dirname, '..', 'index.html')).href + '?offline=1&cfg=' + encodeURIComponent(JSON.stringify(cfg));
  const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--window-size=1600,1000', URL_], { stdio: 'ignore' });

  try {
    let ws;
    for (let i = 0; i < 50 && !ws; i++) {
      try {
        const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
        const page = list.find(t => t.type === 'page' && t.url.startsWith('file:'));
        if (page) ws = new WebSocket(page.webSocketDebuggerUrl);
      } catch (_) { /* subindo */ }
      if (!ws) await sleep(200);
    }
    if (!ws) throw new Error('não conectou no Chrome');
    await new Promise(r => ws.addEventListener('open', r, { once: true }));
    let seq = 0;
    const pending = new Map();
    ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
    const run = body => new Promise(res => {
      const id = ++seq; pending.set(id, res);
      ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression: `(async () => { ${body} })()`, awaitPromise: true, returnByValue: true } }));
    }).then(r => { if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception.description); return r.result.result.value; });

    for (let i = 0; i < 80; i++) { if (await run(`return document.documentElement.dataset.skReady === '1'`).catch(() => false)) break; await sleep(100); }
    const T = `const $ = s => document.querySelector(s); const sleep = ms => new Promise(r => setTimeout(r, ms));`;

    check('senha errada é recusada com aviso', await run(`${T}
      $('#obsUrl').value = 'ws://127.0.0.1:${WS_PORT}'; $('#obsPass').value = 'errada';
      $('[data-action="obs-connect"]').click();
      for (let i = 0; i < 40 && !ObsWS.error; i++) await sleep(100);
      return !ObsWS.ok && /Senha incorreta/.test($('#obsState').textContent)`));

    check('conecta com a senha e lista cenas e fontes', await run(`${T}
      $('#obsPass').value = '${PASSWORD}';
      $('[data-action="obs-connect"]').click();
      for (let i = 0; i < 40 && !ObsWS.ok; i++) await sleep(100);
      await sleep(300);
      return ObsWS.ok && !$('#obsTools').hidden && $('#obsScene').options.length === 2 && $('#obsScene').value === 'Jogo'`));

    check('sugere webcam e jogo; esconde o próprio overlay', await run(`${T}
      const cam = $('[data-fit-src="cam"]'), game = $('[data-fit-src="game"]');
      return cam.value === 'Webcam Logitech' && game.value === 'Jogo'
        && ![...cam.options].some(o => o.value === 'Overlay')`));

    check('senha não fica no campo nem na config', await run(`${T}
      return $('#obsPass').value === '' && !JSON.stringify(cfg).includes('${PASSWORD}')`));

    await run(`${T} $('[data-action="obs-fit"]').click(); await sleep(800); return true`);
    const sets = calls.filter(c => c.requestType === 'SetSceneItemTransform');
    const byId = id => (sets.find(c => c.requestData.sceneItemId === id) || {}).requestData;
    const cam = byId(2), game = byId(3), overlay = byId(1);
    check('webcam: posição 1480,40 e corte lateral para 4:3', cam && cam.sceneItemTransform.positionX === 1480
      && cam.sceneItemTransform.positionY === 40 && cam.sceneItemTransform.cropLeft === 240 && cam.sceneItemTransform.cropTop === 0,
      JSON.stringify(cam));
    check('jogo: 1400×788 em 40,40 (escala de 2560×1440)', game && game.sceneItemTransform.positionX === 40
      && Math.abs(game.sceneItemTransform.scaleX * (2560 - 2 * game.sceneItemTransform.cropLeft) - 1400) < 0.01
      && Math.abs(game.sceneItemTransform.scaleY * (1440 - 2 * game.sceneItemTransform.cropTop) - 788) < 0.01, JSON.stringify(game));
    check('overlay 1120×800 ocupa o canvas (corta 170 embaixo) e vai para o topo', overlay
      && Math.abs(overlay.sceneItemTransform.scaleX * 1120 - 1920) < 0.01 && overlay.sceneItemTransform.cropBottom === 170
      && calls.some(c => c.requestType === 'SetSceneItemIndex' && c.requestData.sceneItemId === 1 && c.requestData.sceneItemIndex === 3));
    check('fonte sem imagem não é tocada', !byId(4));
    check('toast informa o resultado', await run(`return document.querySelector('#toast').textContent`).then(t => /2 fontes encaixadas/.test(t) && /1920×1080 para ficar nítida/.test(t)),
      await run(`return document.querySelector('#toast').textContent`));

    check('webcam 16:9 recalcula sem corte', await run(`${T}
      const sel = document.querySelector('[data-bind="layout.camAspect"]');
      sel.value = '16:9'; sel.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(300);
      $('[data-action="obs-fit"]').click(); await sleep(800); return true`) && (() => {
      const last = calls.filter(c => c.requestType === 'SetSceneItemTransform' && c.requestData.sceneItemId === 2).pop().requestData.sceneItemTransform;
      return last.cropLeft === 0 && last.cropTop === 0 && Math.abs(last.scaleX * 1920 - 400) < 0.01;
    })());

    check('nenhum erro de JS', await run(`return window.__skErrors.length === 0`), await run(`return window.__skErrors.join(' | ')`));
    ws.close();
  } finally {
    proc.kill();
    server.close();
    setTimeout(() => { try { fs.rmSync(profile, { recursive: true, force: true }); } catch (_) {} }, 500);
  }
}

main()
  .catch(e => check('execução', false, e.message))
  .finally(() => {
    for (const r of results) console.log(r.ok ? '✔' : '✖', r.name, !r.ok && r.detail ? '— ' + r.detail : '');
    const failed = results.filter(r => !r.ok).length;
    console.log(`\n${results.length - failed}/${results.length} verificações passaram`);
    process.exit(failed ? 1 : 0);
  });
