import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createGiftAggregator, normalizeTikTokUser, createTikTok } from '../src/tiktok.mjs';
import { createArena } from '../src/arena.mjs';

function clock() {
  let time = 1000, seq = 0;
  const timers = new Map();
  return { timers, now: () => time, setTimer(fn) { const id = ++seq; timers.set(id, fn); return id; }, clearTimer(id) { timers.delete(id); }, advance(ms) { time += ms; }, flush() { const pending = [...timers]; timers.clear(); for (const [, fn] of pending) fn(); } };
}
const packet = { user: { idStr: '42', nickname: 'Võ sĩ A' }, giftId: '5655', giftDetails: { name: 'Hoa hồng', diamondCount: 1, giftType: 1 }, groupId: 'group1' };

function mockConnector(Type) {
  return { TikTokLiveConnection: Type, WebcastEvent: { CHAT: 'chat', GIFT: 'gift', MEMBER: 'member', LIKE: 'like', STREAM_END: 'streamEnd' }, ControlEvent: { ERROR: 'error', DISCONNECTED: 'disconnected' }, SignConfig: {} };
}

test('streak timeout followed by a late final only charges incremental count', () => {
  const c = clock(), events = [];
  const g = createGiftAggregator({ ...c, emit: (kind, payload) => events.push({ kind, ...payload }) });
  g.ingest({ ...packet, repeatCount: 3, msgId: 'a' });
  assert.equal(events.length, 0);
  c.flush(); assert.equal(events.length, 1); assert.equal(events[0].coins, 3);
  assert.equal(events[0].isStreakCorrection, false); assert.equal(events[0].streakCoins, 3);
  g.ingest({ ...packet, repeatCount: 3, repeatEnd: 1, msgId: 'b' });
  assert.equal(events.length, 1, 'late end does not charge the first three gifts again');
  g.ingest({ ...packet, repeatCount: 5, repeatEnd: 1, msgId: 'c' });
  assert.equal(events.length, 2); assert.equal(events[1].coins, 2);
  assert.equal(events[1].isStreakCorrection, true); assert.equal(events[1].streakCoins, 5);
  assert.equal(events[1].supportGroupId, events[0].supportGroupId);
  assert.notEqual(events[0].eventId, events[1].eventId);
  g.ingest({ ...packet, repeatCount: 5, repeatEnd: 1, msgId: 'c' });
  assert.equal(events.length, 2, 'identical packet replay is ignored');
  g.close();
});

test('closing a connection cancels all pending combo gifts', () => {
  const c = clock(), events = [];
  const g = createGiftAggregator({ ...c, emit: (k, p) => events.push(p) });
  g.ingest({ ...packet, repeatCount: 10, msgId: 'a' });
  assert.equal(c.timers.size, 1);
  g.close(); assert.equal(c.timers.size, 0);
  c.flush(); assert.equal(events.length, 0);
  g.ingest({ ...packet, repeatEnd: 1, repeatCount: 10, msgId: 'b' });
  assert.equal(events.length, 0);
});

test('non-streak gifts land immediately and distinct messages remain distinct', () => {
  const events = [], g = createGiftAggregator({ emit: (k, p) => events.push(p) });
  const one = { ...packet, giftDetails: { name: 'Tim', diamondCount: 5, giftType: 0 }, groupId: '0', repeatEnd: 1, repeatCount: 1 };
  g.ingest({ ...one, msgId: 'one' }); g.ingest({ ...one, msgId: 'two' });
  assert.equal(events.length, 2); assert.equal(events[0].coins, 5); assert.equal(events[1].coins, 5);
  g.close();
});

test('completed no-group streaks can be followed by another end-only gift', () => {
  const events = [], g = createGiftAggregator({ emit: (k, p) => events.push(p) });
  g.ingest({ ...packet, groupId: '0', repeatEnd: 1, repeatCount: 1, msgId: 'one' });
  g.ingest({ ...packet, groupId: '0', repeatEnd: 1, repeatCount: 1, msgId: 'two' });
  assert.equal(events.length, 2); assert.equal(events[0].coins + events[1].coins, 2);
  g.close();
});

test('unknown gift price is not fabricated and catalog resolves packet omissions', () => {
  const events = [], logs = [];
  const unknown = createGiftAggregator({ emit: (k, p) => events.push(p), logger: s => logs.push(s) });
  unknown.ingest({ ...packet, giftDetails: { name: 'Mới', giftType: 0 }, repeatCount: 1 });
  assert.equal(events.length, 0); assert.equal(logs.length, 1); unknown.close();
  const known = createGiftAggregator({ emit: (k, p) => events.push(p), findGift: () => ({ name: 'Hoa hồng', coins: 5 }) });
  known.ingest({ ...packet, giftDetails: { giftType: 0 }, repeatCount: 3 });
  assert.equal(events[0].coins, 15); assert.equal(events[0].count, 3); known.close();
});

test('native user shape yields stable identity and safe remote avatar', () => {
  assert.equal(normalizeTikTokUser({ user: { idStr: '10', nickname: '<x>', avatarThumb: { urlList: ['javascript:bad'] } } }).avatar, '');
  assert.equal(normalizeTikTokUser({ user: { idStr: '10', nickname: 'A' } }).uid, normalizeTikTokUser({ user: { idStr: '10', nickname: 'B' } }).uid);
  assert.equal(normalizeTikTokUser({}), null);
});

test('adapter normalizes packets, dedupes replay and ignores retired connection packets', async () => {
  const instances = [], events = [];
  class Fake extends EventEmitter { constructor(room) { super(); this.room = room; instances.push(this); } async connect() { return {}; } async disconnect() {} }
  const adapter = createTikTok({ loadConnector: async () => mockConnector(Fake), onEvent: (kind, data) => events.push([kind, data]) });
  try {
    await adapter.connect('@boxer'); assert.equal(adapter.status().status, 'connected');
    const chat = { user: { idStr: '10', nickname: 'Tên' }, comment: 'móc', common: { msgId: '50' } };
    instances[0].emit('chat', chat); instances[0].emit('chat', chat);
    assert.equal(events.length, 1); assert.equal(events[0][1].text, 'móc');
    instances[0].emit('gift', { ...packet, repeatEnd: 1, repeatCount: 2, msgId: 'gift' });
    assert.equal(events[1][1].coins, 2);
    await adapter.disconnect(); instances[0].emit('chat', { ...chat, common: { msgId: '51' } });
    assert.equal(events.length, 2); assert.equal(adapter.status().status, 'idle');
  } finally { await adapter.disconnect(); }
});

test('offline and untrusted username URL do not import connector', async () => {
  let imports = 0;
  const adapter = createTikTok({ offline: true, loadConnector: async () => { imports++; throw Error('must not import'); } });
  await assert.rejects(adapter.connect('boxer'), /offline/);
  await assert.rejects(adapter.connect('https://evil.example/@boxer'), /tiktok.com/);
  assert.equal(imports, 0); await adapter.disconnect();
});

test('late completion from old room cannot replace newly selected room', async () => {
  let resolveA;
  class Slow extends EventEmitter { constructor(room) { super(); this.room = room; } connect() { return this.room === 'a' ? new Promise(r => { resolveA = r; }) : Promise.resolve(); } disconnect() { return Promise.resolve(); } }
  const adapter = createTikTok({ loadConnector: async () => mockConnector(Slow) });
  try {
    const a = adapter.connect('a');
    await new Promise(r => setTimeout(r, 0));
    await adapter.connect('b'); resolveA?.(); await a;
    assert.equal(adapter.status().uniqueId, 'b'); assert.equal(adapter.status().status, 'connected');
  } finally { await adapter.disconnect(); }
});

test('optional signing key is redacted from operational errors', async () => {
  const logs = [], key = 'very-secret-provider-key';
  class Rejected extends EventEmitter { async connect() { throw new Error('API Key is invalid: ' + key); } async disconnect() {} }
  const adapter = createTikTok({ loadConnector: async () => mockConnector(Rejected), getSignKey: () => key, logger: text => logs.push(text) });
  try {
    await adapter.connect('boxer'); assert.equal(adapter.status().status, 'error');
    assert(!JSON.stringify(adapter.status()).includes(key)); assert(!logs.join('\n').includes(key));
  } finally { await adapter.disconnect(); }
});


test('late combo total carries accounting-only correction instead of a new corner amount', () => {
  const c = clock(), events = [];
  const g = createGiftAggregator({ ...c, emit: (_kind, payload) => events.push(payload) });
  g.ingest({ ...packet, repeatCount: 5, msgId: 'first-five' });
  c.flush();
  g.ingest({ ...packet, repeatCount: 11, repeatEnd: true, msgId: 'late-eleven' });
  assert.equal(events.length, 2);
  assert.deepEqual(events.map(p => p.coins), [5, 6]);
  assert.deepEqual(events.map(p => p.streakCoins), [5, 11]);
  assert.deepEqual(events.map(p => p.isStreakCorrection), [false, true]);
  assert.equal(events[0].supportGroupId, events[1].supportGroupId);
  assert.equal(events.reduce((sum, p) => sum + p.coins, 0), 11, 'actual credit must remain eleven coins');
  g.ingest({ ...packet, repeatCount: 11, repeatEnd: true, msgId: 'late-eleven-new-packet' });
  assert.equal(events.length, 2, 'same total does not generate another support or accounting event');
  g.close();
});

test('normal completed combo routes its full total once and independent gifts get independent groups', () => {
  const events = [], g = createGiftAggregator({ emit: (_kind, payload) => events.push(payload) });
  g.ingest({ ...packet, repeatCount: 30, repeatEnd: true, msgId: 'thirty' });
  g.ingest({ ...packet, groupId: 'other-group', repeatCount: 6, repeatEnd: true, msgId: 'six' });
  assert.deepEqual(events.map(p => p.coins), [30, 6]);
  assert.deepEqual(events.map(p => p.isStreakCorrection), [false, false]);
  assert.notEqual(events[0].supportGroupId, events[1].supportGroupId);
  g.close();
});

test('unknown-priced streak is not marked charged and can be credited after its price arrives', () => {
  const events = [], g = createGiftAggregator({ emit: (_kind, payload) => events.push(payload) });
  const noPrice = { ...packet, giftDetails: { name: 'Quà mới', giftType: 1 } };
  g.ingest({ ...noPrice, repeatCount: 3, repeatEnd: true, msgId: 'without-price' });
  assert.equal(events.length, 0);
  g.ingest({ ...noPrice, diamondCount: 5, repeatCount: 3, repeatEnd: true, msgId: 'with-price' });
  assert.equal(events.length, 1);
  assert.equal(events[0].coins, 15);
  assert.equal(events[0].streakCoins, 15);
  assert.equal(events[0].isStreakCorrection, false);
  g.close();
});


test('adapter late correction cannot activate the opposite corner rule in the arena', () => {
  const c = clock(), combat = [];
  const arena = createArena({ now: c.now, random: () => 0.5,
    initial: { settings: { countdownSeconds: 0, autoSparring: false, autoNext: false } },
    onEvent: event => combat.push(event) });
  arena.command('queue.add', { uid: 'fighter-red', name: 'Góc đỏ' });
  arena.command('queue.add', { uid: 'fighter-blue', name: 'Góc xanh' });
  arena.command('match.start');
  const g = createGiftAggregator({ ...c, emit: (kind, payload) => arena.ingest(kind, payload) });
  g.ingest({ ...packet, repeatCount: 5, msgId: 'timeout-red-five' }); c.flush();
  assert.equal(combat.filter(e => e.type === 'attack.start').length, 1);
  assert.equal(combat.find(e => e.type === 'attack.start').side, 'red');
  g.ingest({ ...packet, repeatCount: 11, repeatEnd: true, msgId: 'late-six-extra' });
  assert.equal(arena.snapshot().stats.coins, 11);
  assert.equal(arena.snapshot().queue.length, 0);
  assert.equal(combat.filter(e => e.type === 'attack.start').length, 1, 'six additional coins are reconciliation, not a blue combo');
  c.advance(1400); arena.tick();
  const fighters = arena.snapshot().match.fighters;
  assert.equal(fighters.red.hp, fighters.red.maxHp);
  assert.ok(fighters.blue.hp < fighters.blue.maxHp);
  g.close();
});
