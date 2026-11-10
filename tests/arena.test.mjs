import test from 'node:test';
import assert from 'node:assert/strict';
import { createArena } from '../src/arena.mjs';

function harness({ settings = {}, initial = {}, random = () => .5 } = {}) {
  let time = 1_000_000;
  const events = [], saves = [];
  const arena = createArena({ initial: { ...initial, settings: { autoNext: false, countdownSeconds: 0, ...initial.settings, ...settings } }, now: () => time, random, onEvent: e => events.push(e), onSave: s => saves.push(s) });
  const user = (uid, rest = {}) => ({ uid, name: uid, ...rest });
  return { arena, events, saves, user, advance: ms => { time += ms; return arena.tick(); },
    chat: (uid, text) => arena.ingest('chat', user(uid, { text })),
    gift: (uid, coins, rest = {}) => arena.ingest('gift', user(uid, { coins, ...rest })),
    ready() { arena.command('queue.add', user('A')); arena.command('queue.add', user('B')); arena.command('match.start'); return arena.snapshot(); },
  };
}
const hp = (h, side) => h.arena.snapshot().match.fighters[side].hp;

test('a fresh live arena has no synthetic players and needs no license', () => {
  const h = harness();
  assert.equal(h.arena.snapshot().mode, 'live');
  assert.equal(h.arena.snapshot().match.phase, 'waiting');
  assert.equal(h.arena.snapshot().match.fighters.red, null);
  assert.equal(h.arena.snapshot().queue.length, 0);
  assert.doesNotThrow(() => h.ready());
});

test('entry gifts accumulate, admission is FIFO, duplicates do not grant extra seats', () => {
  const h = harness({ settings: { entryCoins: 5 } });
  assert.equal(h.chat('A', 'lên đài').reason, 'entry_required');
  h.gift('A', 2); assert.equal(h.arena.snapshot().queue.length, 0);
  h.gift('B', 5); h.gift('A', 3); h.gift('A', 5);
  assert.deepEqual(h.arena.snapshot().queue.map(x => x.uid), ['B', 'A']);
  h.arena.command('match.start');
  assert.equal(h.arena.snapshot().match.fighters.red.uid, 'B');
  assert.equal(h.arena.snapshot().stats.coins, 15);
});

test('zero-price entry accepts the Vietnamese comment command', () => {
  const h = harness({ settings: { entryCoins: 0 } });
  assert.equal(h.chat('A', 'lên đài').queued, true);
  assert.equal(h.arena.snapshot().queue.length, 1);
});

test('two paid entrants automatically count down and start without fake combat', () => {
  const h = harness({ settings: { autoNext: true, countdownSeconds: 3 } });
  h.gift('A', 1); h.gift('B', 1);
  h.advance(1); assert.equal(h.arena.snapshot().match.phase, 'countdown');
  assert.equal(h.chat('A', 'đấm').reason, 'not_fighting');
  h.advance(3000); assert.equal(h.arena.snapshot().match.phase, 'fighting');
  assert.equal(hp(h, 'blue'), 1000);
});

test('only active fighters can attack and they can never damage themselves', () => {
  const h = harness(); h.ready();
  assert.equal(h.chat('audience', 'đấm móc').reason, 'spectator');
  const r = h.chat('A', 'đấm móc');
  assert.equal(r.side, 'red'); assert.equal(r.target, 'blue');
  assert.equal(hp(h, 'red'), 1000); assert.ok(hp(h, 'blue') < 1000);
});

test('Vietnamese aliases work with accents, without accents and uppercase', () => {
  const h = harness(); h.ready();
  for (const [input, move] of [['ĐẤM', 'jab'], ['dam moc', 'hook'], ['đấm bốc', 'uppercut'], ['đá', 'kick']]) {
    const r = h.chat('A', input); assert.equal(r.move, move); h.advance(2000);
  }
  assert.equal(h.chat('A', 'say hello').reason, 'unknown_command');
});

test('cooldown rejects spam before stamina or HP changes', () => {
  const h = harness(); h.ready();
  h.chat('A', 'đấm'); const before = h.arena.snapshot();
  for (let n = 0; n < 50; n++) assert.equal(h.chat('A', 'đấm móc').reason, 'cooldown');
  assert.deepEqual(h.arena.snapshot().match.fighters, before.match.fighters);
  assert.equal(h.arena.snapshot().stats.punches, 1);
});

test('block mitigates exactly one incoming attack and then is consumed', () => {
  const h = harness(); h.ready();
  assert.equal(h.chat('B', 'đỡ').move, 'block');
  const first = h.chat('A', 'móc'); assert.equal(first.blocked, true);
  h.advance(1100);
  const next = h.chat('A', 'móc'); assert.equal(next.blocked, false); assert.ok(first.damage < next.damage);
});

test('dodge prevents HP loss, consumes defense, and displays the dodge event', () => {
  const h = harness(); h.ready(); h.chat('B', 'né');
  const r = h.chat('A', 'đấm bốc');
  assert.equal(r.dodged, true); assert.equal(r.damage, 0); assert.equal(hp(h, 'blue'), 1000);
  assert.ok(h.events.some(e => e.type === 'defend' && e.move === 'dodge'));
});

test('stamina is finite, regenerates, and ultimate requires earned energy', () => {
  const h = harness({ settings: { commentCooldownMs: 300 } }); h.ready();
  assert.equal(h.chat('A', 'bão quyền').reason, 'energy');
  let tired = false;
  for (let i = 0; i < 10; i++) { const r = h.chat('A', 'đấm bốc'); if (r.reason === 'stamina') tired = true; h.advance(300); }
  assert.ok(tired);
  h.advance(2000); h.advance(2000);
  h.arena.ingest('like', h.user('A', { count: 10000 }));
  const before = h.arena.snapshot().match.fighters.red.energy;
  assert.ok(before <= 100);
  for (let i = 0; i < 15; i++) h.arena.ingest('like', h.user('A', { count: 100 }));
  assert.equal(h.arena.snapshot().match.fighters.red.energy, 100);
  assert.equal(h.chat('A', 'bão quyền').move, 'ultimate');
  assert.equal(h.arena.snapshot().match.fighters.red.energy, 0);
});

test('spectator corner selection routes gifts to a fighter instead of queue admission', () => {
  const h = harness(); h.ready();
  assert.equal(h.chat('Fan', 'xanh').support, 'blue');
  const gift = h.gift('Fan', 5);
  assert.equal(gift.side, 'blue'); assert.equal(gift.move, 'flurry');
  assert.ok(hp(h, 'red') < 1000); assert.equal(hp(h, 'blue'), 1000);
  assert.equal(h.arena.snapshot().queue.length, 0);
});

test('gift event IDs are idempotent per donor and do not multiply total coins twice', () => {
  const h = harness(); h.ready();
  h.chat('Fan', 'đỏ');
  h.gift('Fan', 30, { count: 99, eventId: 'delivery-1' });
  const after = h.arena.snapshot();
  const repeat = h.gift('Fan', 30, { count: 99, eventId: 'delivery-1' });
  assert.equal(repeat.reason, 'duplicate');
  assert.equal(hp(h, 'blue'), after.match.fighters.blue.hp);
  assert.equal(h.arena.snapshot().stats.coins, 30);
  h.gift('Other', 30, { eventId: 'delivery-1' });
  assert.equal(h.arena.snapshot().stats.coins, 60);
});

test('hard gift damage ceiling still applies to critical paid moves', () => {
  const h = harness({ settings: { giftDamageCap: 80 }, random: () => 0 }); h.ready();
  const result = h.gift('A', 1000000);
  assert.ok(result.damage <= 80); assert.equal(hp(h, 'blue'), 920);
});

test('gift mapping supports heal and shield without exceeding maximum HP', () => {
  const h = harness({ settings: { giftMap: { 100: 'heal', 101: 'shield' } } }); h.ready();
  h.chat('B', 'đấm'); assert.ok(hp(h, 'red') < 1000);
  h.gift('A', 5, { giftId: '100' }); assert.equal(hp(h, 'red'), 1000);
  h.gift('A', 5, { giftId: '100' }); assert.equal(hp(h, 'red'), 1000);
  h.gift('A', 5, { giftId: '101' }); h.advance(1100);
  assert.equal(h.chat('B', 'đấm').blocked, true);
});

test('KO creates one result and awards a winner exactly once', () => {
  const h = harness({ settings: { maxHp: 100, giftDamageCap: 1000 } }); h.ready();
  h.gift('B', 100);
  const s = h.arena.snapshot(); assert.equal(s.match.phase, 'finished'); assert.equal(s.match.result.winner, 'blue');
  assert.equal(s.stats.matches, 1); assert.equal(s.leaderboard.find(r => r.uid === 'B').wins, 1);
  assert.equal(s.leaderboard.find(r => r.uid === 'B').kos, 1);
  assert.equal(h.chat('B', 'đấm').reason, 'not_fighting');
  assert.throws(() => h.arena.command('match.finish', { winner: 'blue' }));
  assert.equal(h.arena.snapshot().stats.matches, 1);
});

test('winning fighter stays and queued challenger rotates into next match', () => {
  const h = harness({ settings: { maxHp: 100, giftDamageCap: 1000, autoNext: true, holdWinnerSeconds: 2 } }); h.ready();
  h.arena.command('queue.add', h.user('C')); h.gift('B', 100);
  h.advance(2100); const s = h.arena.snapshot();
  assert.equal(s.match.phase, 'fighting'); assert.equal(s.match.number, 2);
  assert.equal(s.match.fighters.red.uid, 'B'); assert.equal(s.match.fighters.blue.uid, 'C');
  assert.equal(s.match.fighters.red.hp, 100); assert.equal(s.match.fighters.red.streak, 1);
  assert.ok(!s.queue.some(x => x.uid === 'A'));
});

test('countdown pause/resume preserves exact remaining time', () => {
  const h = harness({ settings: { countdownSeconds: 4 } }); h.ready(); h.advance(1500);
  h.arena.command('match.pause'); const paused = h.arena.snapshot();
  assert.equal(paused.match.countdownMs, 2500);
  h.advance(60000); assert.equal(h.arena.snapshot().match.countdownMs, 2500);
  h.arena.command('match.resume'); h.advance(2499); assert.equal(h.arena.snapshot().match.phase, 'countdown');
  h.advance(1); assert.equal(h.arena.snapshot().match.phase, 'fighting');
});

test('combat pause freezes clock, attacks and defensive windows', () => {
  const h = harness({ settings: { roundSeconds: 30 } }); h.ready();
  h.chat('B', 'đỡ'); h.advance(100); h.arena.command('match.pause');
  assert.equal(h.chat('A', 'đấm').reason, 'not_fighting');
  h.advance(60000); assert.equal(h.arena.snapshot().match.remainingMs, 29900);
  h.arena.command('match.resume'); assert.equal(h.chat('A', 'đấm').blocked, true);
  h.advance(29900); assert.equal(h.arena.snapshot().match.phase, 'finished');
});

test('time limit awards healthier fighter and equal scores create a draw', () => {
  const a = harness({ settings: { roundSeconds: 15 } }); a.ready(); a.chat('A', 'đấm'); a.advance(15000);
  assert.equal(a.arena.snapshot().match.result.winner, 'red'); assert.equal(a.arena.snapshot().match.result.reason, 'time');
  const b = harness({ settings: { roundSeconds: 15 } }); b.ready(); b.advance(15000);
  assert.equal(b.arena.snapshot().match.result.winner, null);
});

test('match reset cancels all prior timers and waits for manual restart', () => {
  const h = harness({ settings: { autoNext: true } }); h.ready();
  h.gift('A', 30); h.arena.command('match.reset'); h.advance(999999);
  const s = h.arena.snapshot(); assert.equal(s.match.phase, 'waiting'); assert.equal(s.stats.matches, 0);
  assert.equal(s.match.fighters.red, null); assert.equal(s.queue.length, 2);
  h.arena.command('match.start'); assert.equal(hp(h, 'blue'), 1000);
});

test('session reset discards the match and prevents stale rewards in the new session', () => {
  const h = harness(); h.ready(); h.chat('A', 'đấm');
  h.arena.command('session.reset'); h.advance(999999);
  const s = h.arena.snapshot(); assert.equal(s.match.phase, 'waiting'); assert.equal(s.stats.matches, 0);
  assert.equal(s.stats.punches, 0); assert.deepEqual(s.leaderboard, []);
});

test('demo and live have separate queue, coins, rankings and ingest sources', () => {
  const h = harness(); h.gift('Real', 5); const original = h.arena.export();
  h.arena.command('mode.set', { mode: 'demo' });
  assert.equal(h.arena.snapshot().match.fighters.red.uid, 'demo_red');
  assert.equal(h.gift('Real', 500).reason, 'wrong_mode');
  h.arena.ingest('gift', h.user('DemoFan', { coins: 100 }), { source: 'demo' });
  assert.equal(h.arena.snapshot().stats.coins, 100);
  assert.deepEqual(h.arena.export().live.records, original.live.records);
  h.arena.command('mode.set', { mode: 'live' });
  assert.equal(h.arena.snapshot().stats.coins, 5);
  assert.deepEqual(h.arena.snapshot().queue.map(x => x.uid), ['Real']);
  assert.ok(!JSON.stringify(h.arena.export().live).includes('DemoFan'));
});

test('switching away from a live fight preserves paid seats without adding awards', () => {
  const h = harness(); h.ready(); h.gift('A', 30);
  h.arena.command('mode.set', { mode: 'demo' }); h.arena.command('mode.set', { mode: 'live' });
  const s = h.arena.snapshot(); assert.equal(s.match.phase, 'waiting');
  assert.deepEqual(s.queue.map(x => x.uid), ['A', 'B']); assert.equal(s.stats.matches, 0);
});

test('restart restores stats and queues interrupted fighters but never resumes a damaged match', () => {
  const h = harness(); h.ready(); h.gift('A', 30); const saved = h.arena.export();
  const restored = harness({ initial: saved }); const s = restored.arena.snapshot();
  assert.equal(s.stats.coins, 30); assert.equal(s.match.phase, 'waiting'); assert.equal(s.match.fighters.red, null);
  assert.deepEqual(s.queue.map(x => x.uid), ['A', 'B']);
  restored.arena.command('match.start'); assert.equal(hp(restored, 'blue'), 1000);
});

test('restart of a completed match does not resurrect the defeated fighter', () => {
  const h = harness(); h.ready(); h.arena.command('match.finish', { winner: 'red' });
  const restored = harness({ initial: h.arena.export() });
  assert.deepEqual(restored.arena.snapshot().queue.map(x => x.uid), ['A']);
  assert.equal(restored.arena.snapshot().leaderboard.find(x => x.uid === 'A').wins, 1);
});

test('malformed users and hostile object keys do not corrupt dictionaries', () => {
  const h = harness();
  assert.equal(h.arena.ingest('gift', { uid: '__proto__', coins: 5 }).reason, 'invalid_user');
  assert.equal(h.arena.ingest('gift', { uid: '', coins: 5 }).reason, 'invalid_user');
  assert.equal(h.gift('toString', 1).ok, true);
  assert.equal(h.arena.snapshot().queue[0].uid, 'toString');
  assert.equal(h.arena.snapshot().stats.coins, 1);
});

test('settings validate types and bounds; callers cannot mutate exported state', () => {
  const h = harness();
  h.arena.command('settings.set', { settings: { maxHp: -20, roundSeconds: Infinity, entryCoins: -1, autoNext: 'true', giftMap: { 123: 'nope', 456: 'flurry' } } });
  const s = h.arena.snapshot(); assert.equal(s.settings.maxHp, 100); assert.equal(s.settings.roundSeconds, 120);
  assert.equal(s.settings.entryCoins, 0); assert.equal(s.settings.autoNext, false);
  assert.deepEqual(s.settings.giftMap, { 456: 'flurry' });
  s.settings.maxHp = 999; s.queue.push({ uid: 'X' });
  assert.equal(h.arena.snapshot().settings.maxHp, 100); assert.equal(h.arena.snapshot().queue.length, 0);
});

test('malformed monetary events never grant admission, coins or consume valid dedup IDs', () => {
  const h = harness();
  for (const coins of [0, -1, NaN, Infinity, 'bad', undefined]) {
    assert.equal(h.gift('A', coins, { eventId: 'bad-then-valid' }).reason, 'invalid_coins');
  }
  assert.equal(h.arena.snapshot().stats.coins, 0); assert.equal(h.arena.snapshot().queue.length, 0);
  assert.equal(h.gift('A', 1, { eventId: 'bad-then-valid' }).queued, true);
});

test('a drawn match rotates to two queued challengers without requiring a winner', () => {
  const h = harness(); h.ready();
  h.arena.command('queue.add', h.user('C')); h.arena.command('queue.add', h.user('D'));
  h.arena.command('match.finish', { winner: null }); h.arena.command('match.start');
  const s = h.arena.snapshot(); assert.equal(s.match.fighters.red.uid, 'C'); assert.equal(s.match.fighters.blue.uid, 'D');
});
