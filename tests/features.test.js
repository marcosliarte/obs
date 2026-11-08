/* Testes dos recursos da v3.1 — rodam junto no npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const SK = require('../js/core.js');

test('versão igual no package.json, env.js e nos ?v= do index.html', () => {
  const root = path.join(__dirname, '..');
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
  const env = /APP_VERSION = '([^']+)'/.exec(fs.readFileSync(path.join(root, 'js/env.js'), 'utf8'))[1];
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.equal(env, pkg);
  const local = [...html.matchAll(/(?:src|href)="((?:js|css)\/[^"]+)"/g)].map(m => m[1]);
  assert.ok(local.length >= 10);
  for (const f of local) assert.ok(f.endsWith('?v=' + pkg), f + ' sem ?v=' + pkg);
});

test('textos editáveis: negrito seguro e modelo de episódio', () => {
  assert.equal(SK.richText('Reagindo com o *chat*'), 'Reagindo com o <b>chat</b>');
  assert.equal(SK.richText('<i>*x*</i>'), '&lt;i&gt;<b>x</b>&lt;/i&gt;');
  assert.equal(SK.fillTemplate('T{t} · E{e}', { t: '3', e: '7' }), 'T3 · E7');
  assert.equal(SK.fillTemplate('Ep. {e} {x}', { e: '<b>' }), 'Ep. &lt;b&gt; {x}');
  const c = SK.normalizeConfig({ labels: { freeTitle: 'x'.repeat(200), live: 42 }, layout: { camAspect: '5:4' } });
  assert.equal(c.labels.freeTitle.length, 80);
  assert.equal(c.labels.live, '42');
  assert.equal(c.labels.chat, 'Chat');
  assert.equal(c.layout.camAspect, '4:3');
});

test('emotes 7TV/BTTV/FFZ: parse das APIs e aplicação no texto', () => {
  const bttv = SK.parseExtEmotes('bttv', { channelEmotes: [{ id: '5f1b0186cf6d2144653d2970', code: 'catJAM' }], sharedEmotes: [{ id: 'abc', code: 'pepeD' }] });
  const ffz = SK.parseExtEmotes('ffz', [{ id: 123, code: 'LULW' }]);
  const stv = SK.parseExtEmotes('7tv', { emote_set: { emotes: [{ id: '01F6MZGCNG000255K4X1K96XKX', name: 'Clap' }, { id: 'bad id!', name: 'X' }] } });
  const map = SK.emoteMap([bttv, ffz, stv, null, { name: 'x' }, ['lixo']]);   /* entradas inválidas são ignoradas */
  assert.ok(map.catJAM && map.LULW && map.Clap && !map.X);
  const segs = SK.applyEmoteMap([{ type: 'text', text: 'oi catJAM  LULW!' }, { type: 'emote', id: '25', name: 'Kappa', platform: 'twitch' }], map);
  assert.deepEqual(segs.map(s => s.type), ['text', 'emote', 'text', 'emote']);
  assert.equal(segs[2].text, '  LULW!');      /* só palavra inteira vira emote */
  assert.match(SK.emoteUrl(segs[1]), /cdn\.betterttv\.net\/emote\/5f1b/);
  assert.match(SK.emoteUrl({ id: '01F6', platform: '7tv' }), /cdn\.7tv\.app/);
  assert.equal(SK.isEmoteOnly(SK.applyEmoteMap([{ type: 'text', text: 'catJAM catJAM ' }], map)), true);
  assert.equal(SK.isEmoteOnly([{ type: 'text', text: 'oi' }]), false);
  /* emote externo sobrevive ao normalizeConfig (destaque) */
  const c = SK.normalizeConfig({ pinned: { user: 'a', segments: [segs[1]] } });
  assert.equal(c.pinned.segments[0].platform, 'bttv');
});

test('eventos do Kick viram ações padronizadas', () => {
  const msg = SK.kickEvent('ChatMessageEvent', { id: 'm1', content: 'oi [emote:1:KEKW]', sender: { username: 'ana', identity: { color: '#ff0000', badges: [{ type: 'moderator' }] } } });
  assert.equal(msg.kind, 'message');
  assert.deepEqual(msg.badges, ['mod']);
  assert.equal(msg.segments[1].platform, 'kick');
  assert.deepEqual(SK.kickEvent('MessageDeletedEvent', { message: { id: 'm1' } }), { kind: 'delete', id: 'm1' });
  assert.equal(SK.kickEvent('UserBannedEvent', { user: { username: 'Troll' } }).user, 'troll');
  assert.equal(SK.kickEvent('SubscriptionEvent', { username: 'bia', months: 3 }).event.type, 'resub');
  const gift = SK.kickEvent('GiftedSubscriptionsEvent', { gifter_username: 'zé', gifted_usernames: ['a', 'b', 'c'] });
  assert.equal(gift.event.count, 3);
  assert.equal(SK.kickEvent('KicksGifted', { sender: { username: 'lu' }, gift: { amount: 100 } }).event.amount, 100);
  assert.equal(SK.kickEvent('KicksGifted', {}), null);
  assert.equal(SK.kickEvent('Desconhecido', {}), null);
});

test('expiração: música e destaque', () => {
  const now = 1e12;
  assert.equal(SK.trackActive({ title: 'a', until: now + 1 }, now), true);
  assert.equal(SK.trackActive({ title: 'a', until: now - 1 }, now), false);
  assert.equal(SK.trackActive({ title: 'a', until: 0 }, now), true);
  assert.equal(SK.trackActive(null, now), false);
  assert.equal(SK.pinnedActive({ at: now - 5000 }, 10, now), true);
  assert.equal(SK.pinnedActive({ at: now - 15000 }, 10, now), false);
  assert.equal(SK.pinnedActive({ at: now - 15000 }, 0, now), true);
  const c = SK.normalizeConfig({ SP: { current: { title: 'x', until: '123' } } });
  assert.equal(c.SP.current.until, 123);
});

test('últimos apoios: junta painel + OBS sem duplicar', () => {
  const t = 1e12;
  const a = SK.recentFromEvent({ type: 'gift', platform: 'twitch', user: 'Ana', count: 5 }, t);
  const b = SK.recentFromEvent({ type: 'raid', platform: 'kick', user: 'Bia', viewers: 30 }, t + 1000);
  assert.equal(a.count, 5);
  const merged = SK.mergeRecent([a], [Object.assign({}, a, { at: t + 10 }), b]);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].user, 'Bia');
  assert.equal(SK.recentText(a), '5 subs de presente');
  assert.equal(SK.recentText(b), 'host · 30');
  const list = SK.normalizeConfig({ recent: { list: [{ user: '', type: 'sub' }, { user: 'x', type: 'hack' }] } }).recent.list;
  assert.equal(list.length, 1);
  assert.equal(list[0].type, 'sub');
});

test('encaixe no OBS: preencher corta o excesso, caber centraliza', () => {
  /* webcam 1920×1080 numa janela 4:3 de 400×300 em 1480,40 */
  const t = SK.fitTransform({ x: 1480, y: 40, w: 400, h: 300 }, { width: 1920, height: 1080 }, 'cover');
  assert.equal(t.cropLeft, 240);
  assert.equal(t.cropRight, 240);
  assert.equal(t.cropTop, 0);
  assert.equal(t.positionX, 1480);
  assert.equal(t.positionY, 40);
  assert.ok(Math.abs((1920 - 480) * t.scaleX - 400) < 1e-9);
  assert.ok(Math.abs(1080 * t.scaleY - 300) < 1e-9);
  assert.equal(t.boundsType, 'OBS_BOUNDS_NONE');
  assert.equal(t.alignment, 5);
  /* mesma proporção: sem corte */
  const same = SK.fitTransform({ x: 0, y: 0, w: 400, h: 225 }, { width: 1920, height: 1080 }, 'cover');
  assert.equal(same.cropLeft + same.cropTop, 0);
  /* caber: sobra em cima e embaixo */
  const fit = SK.fitTransform({ x: 0, y: 0, w: 400, h: 300 }, { width: 1920, height: 1080 }, 'contain');
  assert.equal(fit.cropLeft, 0);
  assert.ok(Math.abs(fit.positionY - 37.5) < 1e-9);
  assert.equal(SK.fitTransform({ x: 0, y: 0, w: 1, h: 1 }, { width: 0, height: 0 }, 'cover'), null);
  /* overlay numa fonte 1120×800: palco 1120×630 no topo, corta 170 embaixo */
  const ov = SK.overlayTransform({ width: 1920, height: 1080 }, { width: 1120, height: 800 }, 1920, 1080);
  assert.equal(ov.cropBottom, 170);
  assert.equal(ov.cropRight, 0);
  assert.ok(Math.abs(ov.scaleX * 1120 - 1920) < 1e-9 && Math.abs(ov.scaleY * 630 - 1080) < 1e-9);
  const ov2 = SK.overlayTransform({ width: 1920, height: 1080 }, { width: 1920, height: 1080 }, 1920, 1080);
  assert.equal(ov2.scaleX, 1); assert.equal(ov2.cropBottom, 0);
  assert.equal(SK.aspectLabel(400, 225), '16:9');
  assert.equal(SK.aspectLabel(1400, 788), '16:9');
  assert.equal(SK.aspectLabel(400, 676), '0.59:1');
});

test('YouTube: ID do vídeo a partir de qualquer link', () => {
  assert.equal(SK.ytVideoId('dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(SK.ytVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1'), 'dQw4w9WgXcQ');
  assert.equal(SK.ytVideoId('https://youtube.com/live/dQw4w9WgXcQ?si=abc'), 'dQw4w9WgXcQ');
  assert.equal(SK.ytVideoId('https://youtu.be/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(SK.ytVideoId('não é link'), '');
});

test('YouTube: itens do chat viram mensagens, eventos e moderação', () => {
  const t = '2026-11-08T03:00:00Z';
  const msg = SK.youtubeItem({ id: 'y1', snippet: { type: 'textMessageEvent', publishedAt: t, displayMessage: 'salve <b>' },
    authorDetails: { displayName: 'Ana', isChatModerator: true, isChatSponsor: true } });
  assert.equal(msg.kind, 'message');
  assert.deepEqual(msg.badges, ['mod', 'sub']);
  assert.equal(msg.segments[0].text, 'salve <b>');
  assert.equal(msg.at, Date.parse(t));
  const sc = SK.youtubeItem({ id: 'y2', snippet: { type: 'superChatEvent', displayMessage: 'toma', superChatDetails: { amountMicros: '5000000', amountDisplayString: 'R$ 5,00' } }, authorDetails: { displayName: 'Bia' } });
  assert.equal(sc.highlight, true);
  assert.deepEqual([sc.event.type, sc.event.platform, sc.event.amountText], ['cheer', 'youtube', 'R$ 5,00']);
  assert.equal(SK.alertCopy(sc.event).label, 'Super Chat');
  assert.equal(SK.alertCopy(sc.event).detail, 'Mandou R$ 5,00');
  assert.equal(SK.youtubeItem({ snippet: { type: 'newSponsorEvent' }, authorDetails: { displayName: 'Cris' } }).event.type, 'sub');
  assert.equal(SK.youtubeItem({ snippet: { type: 'membershipGiftingEvent', membershipGiftingDetails: { giftMembershipsCount: 5 } }, authorDetails: {} }).event.count, 5);
  assert.deepEqual(SK.youtubeItem({ snippet: { type: 'messageDeletedEvent', messageDeletedDetails: { deletedMessageId: 'y1' } } }), { kind: 'delete', id: 'y1' });
  assert.equal(SK.youtubeItem({ snippet: { type: 'userBannedEvent', userBannedDetails: { bannedUserDetails: { displayName: 'Troll' } } } }).user, 'troll');
  assert.equal(SK.youtubeItem({ snippet: { type: 'pollEvent' } }), null);
  assert.equal(SK.youtubeItem(null), null);
});

test('meta: tipo validado e plataforma YouTube aceita', () => {
  assert.equal(SK.normalizeConfig({ goal: { type: 'followers' } }).goal.type, 'followers');
  assert.equal(SK.normalizeConfig({ goal: { type: 'hack' } }).goal.type, 'subs');
  assert.equal(SK.normalizeConfig({ CHAT: { ytApiKey: 'AIza_x-1"><script>' } }).CHAT.ytApiKey, 'AIza_x-1script');
  assert.equal(SK.normalizeConfig({ pinned: { user: 'a', platform: 'youtube', segments: [] } }).pinned.platform, 'youtube');
  const r = SK.recentFromEvent({ type: 'cheer', platform: 'youtube', user: 'Bia', amount: 5 }, 1e12);
  assert.equal(r.platform, 'youtube');
  assert.equal(SK.recentText(r), 'super chat');
});

test('Twitch IRC: mensagens, emotes, selos, ações e escapes', () => {
  const line = '@badges=broadcaster/1,subscriber/6;color=#FF0000;display-name=Ana\\sB;emotes=25:6-10;first-msg=1;id=abc;room-id=123 '
    + ':ana!ana@ana.tmi.twitch.tv PRIVMSG #liarteee :salve Kappa';
  const m = SK.parseIrc(line);
  assert.equal(m.tags['display-name'], 'Ana B');
  assert.equal(m.command, 'PRIVMSG');
  const a = SK.twitchIrc(m);
  assert.equal(a.kind, 'message');
  assert.equal(a.user, 'Ana B');
  assert.equal(a.first, true);
  assert.deepEqual(a.badges, ['broadcaster', 'sub']);
  assert.deepEqual(a.segments.map(x => x.type), ['text', 'emote']);
  assert.equal(a.event, null);
  const act = SK.twitchIrc(SK.parseIrc(':ana!ana@ana PRIVMSG #c :\u0001ACTION dança\u0001'));
  assert.equal(act.action, true);
  assert.equal(act.segments[0].text, 'dança');
  const bits = SK.twitchIrc(SK.parseIrc('@bits=100;display-name=Bia;id=b1 :bia!bia@bia PRIVMSG #c :cheer100 toma'));
  assert.deepEqual([bits.highlight, bits.event.type, bits.event.amount], [true, 'cheer', 100]);
});

test('Twitch IRC: subs, gift bomb sem duplicar, raid e moderação', () => {
  const ev = l => SK.twitchIrc(SK.parseIrc(l));
  assert.equal(ev('@msg-id=sub;display-name=Cris :tmi.twitch.tv USERNOTICE #c').event.type, 'sub');
  const re = ev('@msg-id=resub;msg-param-cumulative-months=14;display-name=Cris;id=r1 :tmi.twitch.tv USERNOTICE #c :14 meses!');
  assert.deepEqual([re.kind, re.event.type, re.event.months, re.highlight], ['message', 'resub', 14, true]);
  assert.equal(ev('@msg-id=submysterygift;msg-param-mass-gift-count=5;display-name=Zé :tmi.twitch.tv USERNOTICE #c').event.count, 5);
  assert.equal(ev('@msg-id=subgift;msg-param-community-gift-id=99;display-name=Zé :tmi.twitch.tv USERNOTICE #c'), null);
  assert.equal(ev('@msg-id=subgift;msg-param-recipient-display-name=Lu;display-name=Zé :tmi.twitch.tv USERNOTICE #c').event.recipient, 'Lu');
  assert.deepEqual(ev('@msg-id=raid;msg-param-displayName=Outro;msg-param-viewerCount=42 :tmi.twitch.tv USERNOTICE #c').event,
    { type: 'raid', platform: 'twitch', user: 'Outro', viewers: 42 });
  assert.deepEqual(ev('@target-msg-id=abc :tmi.twitch.tv CLEARMSG #c :x'), { kind: 'delete', id: 'abc' });
  assert.deepEqual(ev(':tmi.twitch.tv CLEARCHAT #c :Troll'), { kind: 'ban', user: 'troll' });
  assert.deepEqual(ev(':tmi.twitch.tv CLEARCHAT #c'), { kind: 'clear' });
  assert.deepEqual(ev('@room-id=123 :tmi.twitch.tv ROOMSTATE #c'), { kind: 'room', roomId: '123' });
  assert.deepEqual(ev(':justinfan1.tmi.twitch.tv 366 justinfan1 #c :End of /NAMES list'), { kind: 'joined' });
  assert.equal(ev(':tmi.twitch.tv CAP * ACK :twitch.tv/tags'), null);
});

test('Kick: chave do Pusher colada no painel é validada', () => {
  assert.equal(SK.normalizeConfig({ CHAT: { kickKey: ' 34BF7a0ff419a2a775b9"><' } }).CHAT.kickKey, '34bf7a0ff419a2a775b9');
  assert.equal(SK.normalizeConfig({}).CHAT.kickKey, '');
});
