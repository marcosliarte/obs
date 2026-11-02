/* Testes das funções puras — rode com: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const SK = require('../js/core.js');

/* config real salva antes da v3 (formato antigo) */
const LEGACY = {
  SP: { current: null, enabled: false, clientId: 'abc' },
  bg: { type: 'none', angle: 135, color1: '#0a0a0c', color2: '#1a1a2e', imageUrl: '' },
  CHAT: { url: '', mode: 'kick', ytVideoId: '', kickChannel: 'liart3', kickChatroomId: '73203653' },
  state: { color: '#d6f24b', scene: 'react', format: 'landscape' },
  TWITCH: { channel: 'liarteee' },
  social: { tiktok: { on: false, handle: '' }, youtube: { on: false, handle: '' }, instagram: { on: false, handle: '' } },
  square: false,
  endState: { message: 'Foi incrível ter você aqui.' },
  hideLive: false,
  irlState: { kicker: 'EXPLORANDO', location: 'Praia de Copacabana' },
  gameState: { name: 'SEU JOGO AQUI', nick: '@seunick' },
  reactState: { note: '', type: 'movie', title: 'De olhos bem fechados', season: '2', episode: '2' }
};

test('normalizeConfig preserva a config antiga e adiciona os campos novos', () => {
  const c = SK.normalizeConfig(LEGACY);
  assert.equal(c.state.scene, 'react');
  assert.equal(c.CHAT.mode, 'kick');
  assert.equal(c.CHAT.kickChatroomId, '73203653');
  assert.equal(c.TWITCH.channel, 'liarteee');
  assert.equal(c.reactState.title, 'De olhos bem fechados');
  assert.equal(c.SP.clientId, 'abc');
  assert.equal(c.endState.message, 'Foi incrível ter você aqui.');
  assert.equal(c.alerts.enabled, false);
  assert.equal(c.goal.target, 50);
  assert.ok(c.texts.start.title);
  assert.equal(c.pinned, null);
});

test('normalizeConfig rejeita valores inválidos', () => {
  const c = SK.normalizeConfig({
    state: { scene: 'hack', format: 'square', color: 'red;}' },
    CHAT: { mode: 'evil', kickChannel: '@Meu Canal!', kickChatroomId: '12ab34' },
    TWITCH: { channel: '  @LiArTe ' },
    bg: { type: 'video', imageUrl: 'javascript:alert(1)', angle: 999 },
    alerts: { volume: 5, duration: 1 },
    goal: { current: -3, target: 0 },
    SP: { current: { title: 'Song', artist: 'X', cover: 'data:text/html,hi' } }
  });
  assert.equal(c.state.scene, 'game');
  assert.equal(c.state.format, 'landscape');
  assert.equal(c.state.color, '#d6f24b');
  assert.equal(c.CHAT.mode, 'none');
  assert.equal(c.CHAT.kickChannel, 'meucanal');
  assert.equal(c.CHAT.kickChatroomId, '1234');
  assert.equal(c.TWITCH.channel, 'liarte');
  assert.equal(c.bg.type, 'none');
  assert.equal(c.bg.imageUrl, '');
  assert.equal(c.bg.angle, 360);
  assert.equal(c.alerts.volume, 1);
  assert.equal(c.alerts.duration, 3);
  assert.equal(c.goal.current, 0);
  assert.equal(c.goal.target, 1);
  assert.equal(c.SP.current.cover, '');
});

test('normalizeConfig aceita números vindos como texto e ignora tipos errados', () => {
  const c = SK.normalizeConfig({ goal: { current: '12', target: 'abc', enabled: 'yes' } });
  assert.equal(c.goal.current, 12);
  assert.equal(c.goal.target, 50);
  assert.equal(c.goal.enabled, false);
});

test('normalizeConfig valida pinned e alertTest', () => {
  const c = SK.normalizeConfig({
    pinned: { user: 'ana', platform: 'x', color: 'blue', segments: [{ type: 'emote', id: '1"><b>', name: 'x' }, { type: 'text', text: 'oi' }] },
    alertTest: { id: 123, type: 'nuke' }
  });
  assert.equal(c.pinned.platform, 'test');
  assert.match(c.pinned.color, /^#/);
  assert.equal(c.pinned.segments[0].type, 'text');
  assert.equal(c.alertTest.type, 'sub');
  assert.equal(SK.normalizeConfig({ alertTest: { type: 'sub' } }).alertTest, null);
});

test('escapeHtml escapa todos os caracteres perigosos', () => {
  assert.equal(SK.escapeHtml(`<img src=x onerror="a('b')">&`), '&lt;img src=x onerror=&quot;a(&#39;b&#39;)&quot;&gt;&amp;');
  assert.equal(SK.escapeHtml(null), '');
  assert.equal(SK.escapeHtml(42), '42');
});

test('safeUrl só aceita http(s)', () => {
  assert.equal(SK.safeUrl('https://example.com/a?b=1'), 'https://example.com/a?b=1');
  assert.equal(SK.safeUrl('javascript:alert(1)'), '');
  assert.equal(SK.safeUrl('data:text/html,x'), '');
  assert.equal(SK.safeUrl('não é url'), '');
});

test('cores: hexToRgba, contraste e cor de nome legível', () => {
  assert.equal(SK.hexToRgba('#fff', 0.5), 'rgba(255, 255, 255, 0.5)');
  assert.equal(SK.hexToRgba('lixo', 1), 'rgba(214, 242, 75, 1)');
  assert.equal(SK.contrastText('#d6f24b'), '#0b0c0e');
  assert.equal(SK.contrastText('#4f2bd9'), '#ffffff');
  assert.equal(SK.readableNameColor('#000000', 'ana'), SK.userColor('ana'));
  assert.equal(SK.readableNameColor('#FF0000', 'ana'), '#ff0000');
});

test('emotes da Twitch respeitam posições em code points', () => {
  const segs = SK.parseTwitchEmotes('oi Kappa 😀 Kappa', { 25: ['3-7', '11-15'] });
  assert.deepEqual(segs.map(s => s.type), ['text', 'emote', 'text', 'emote']);
  assert.equal(segs[1].name, 'Kappa');
  assert.equal(segs[2].text, ' 😀 ');
  assert.equal(segs[3].name, 'Kappa');
  assert.deepEqual(SK.parseTwitchEmotes('sem emote', null), [{ type: 'text', text: 'sem emote' }]);
  /* faixa inválida é ignorada sem quebrar */
  assert.equal(SK.segmentsToText(SK.parseTwitchEmotes('abc', { 1: ['5-9'] })), 'abc');
});

test('emotes do Kick viram imagens e o texto é escapado', () => {
  const segs = SK.parseKickContent('<b>oi</b> [emote:37226:KEKW]!');
  assert.equal(segs.length, 3);
  assert.equal(segs[1].id, '37226');
  const html = SK.segmentsToHtml(segs);
  assert.ok(html.startsWith('&lt;b&gt;oi&lt;/b&gt; <img class="emote" src="https://files.kick.com/emotes/37226/fullsize"'));
  assert.ok(html.endsWith('!'));
});

test('badges padronizados nas duas plataformas', () => {
  assert.deepEqual(SK.normalizeBadges('twitch', { broadcaster: '1', subscriber: '12' }), ['broadcaster', 'sub']);
  assert.deepEqual(SK.normalizeBadges('kick', [{ type: 'moderator' }, { type: 'og' }, { type: 'founder' }]), ['mod', 'sub']);
  assert.deepEqual(SK.normalizeBadges('twitch', null), []);
});

test('filtro do chat: comandos, bots e palavras bloqueadas', () => {
  const f = SK.defaults().chatFilter;
  const msg = (user, text) => ({ user, segments: [{ type: 'text', text }] });
  assert.equal(SK.shouldHideMessage(msg('ana', '!discord'), f), true);
  assert.equal(SK.shouldHideMessage(msg('Nightbot', 'link'), f), true);
  assert.equal(SK.shouldHideMessage(msg('ana', 'boa noite'), f), false);
  assert.equal(SK.shouldHideMessage(msg('ana', 'compre SPAM aqui'), Object.assign({}, f, { blocked: 'spam, golpe' })), true);
  assert.equal(SK.shouldHideMessage(msg('ana', '!cmd'), Object.assign({}, f, { hideCommands: false })), false);
});

test('parseNowPlaying', () => {
  assert.deepEqual(SK.parseNowPlaying('Song - Artist\nlixo'), { title: 'Song', artist: 'Artist', cover: '' });
  assert.deepEqual(SK.parseNowPlaying('Só título'), { title: 'Só título', artist: '', cover: '' });
  assert.equal(SK.parseNowPlaying('   '), null);
});

test('tempo: contagem regressiva e próximo horário', () => {
  assert.equal(SK.formatCountdown(65000), '01:05');
  assert.equal(SK.formatCountdown(3725000), '1:02:05');
  assert.equal(SK.formatCountdown(-5), '00:00');
  assert.equal(SK.formatCountdown(1), '00:01');
  const now = new Date(2026, 10, 1, 20, 0, 0).getTime();
  assert.equal(SK.nextTimeOccurrence('21:30', now), new Date(2026, 10, 1, 21, 30).getTime());
  assert.equal(SK.nextTimeOccurrence('19:00', now), new Date(2026, 10, 2, 19, 0).getTime());
  assert.equal(SK.nextTimeOccurrence('25:00', now), 0);
  assert.equal(SK.nextTimeOccurrence('', now), 0);
});

test('widgets: meta, letreiro e textos dos alertas', () => {
  assert.equal(SK.goalPercent(12, 50), 24);
  assert.equal(SK.goalPercent(80, 50), 100);
  assert.equal(SK.goalPercent(1, 0), 100);
  assert.deepEqual(SK.parseTicker(' a | | b |c '), ['a', 'b', 'c']);
  assert.equal(SK.alertCopy({ type: 'resub', user: 'x', months: 1 }).detail, '1 mês de apoio');
  assert.equal(SK.alertCopy({ type: 'gift', user: 'x', count: 5 }).detail, 'Presenteou 5 subs');
  assert.equal(SK.alertCopy({ type: 'raid', user: 'x', viewers: 1, platform: 'kick' }).label, 'Host');
  assert.equal(SK.alertCopy({ type: 'cheer', user: 'x', amount: 100, platform: 'kick' }).detail, 'Mandou 100 kicks');
  for (const t of SK.ALERT_TYPES) assert.equal(SK.sampleAlert(t).type, t);
});

test('buildSceneURL', () => {
  assert.equal(SK.buildSceneURL('https://a.io/obs/?x=1#y', 'game', 'portrait', 'default'), 'https://a.io/obs/?obs=1&scene=game&format=portrait');
  assert.equal(SK.buildSceneURL('https://a.io/obs/', 'end', 'landscape', 'canal2'), 'https://a.io/obs/?obs=1&scene=end&format=landscape&id=canal2');
});
