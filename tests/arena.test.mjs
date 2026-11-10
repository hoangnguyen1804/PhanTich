import test from 'node:test';
import assert from 'node:assert/strict';
import { createArena, DEFAULT_CORNER_GIFTS } from '../src/arena.mjs';

function harness({ settings = {}, initial = {}, random = () => .5 } = {}) {
  let time = 1_000_000;
  const events = [], saves = [];
  const arena = createArena({ initial: { ...initial, settings: { autoNext: false, autoSparring:false,maxHp:1000,cornerGifts:[],countdownSeconds: 0, ...initial.settings, ...settings } }, now: () => time, random, onEvent: e => events.push(e), onSave: s => saves.push(s) });
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
  const gift = h.gift('Fan', 5);h.advance(1400);
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
  h.gift('A', 1000000);h.advance(2400);
  const result=h.events.findLast(e=>e.type==='hit');assert.ok(result.damage <= 80); assert.equal(hp(h, 'blue'), 920);
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
  h.gift('B', 100);h.advance(2400);
  const s = h.arena.snapshot(); assert.equal(s.match.phase, 'finished'); assert.equal(s.match.result.winner, 'blue');
  assert.equal(s.stats.matches, 1); assert.equal(s.leaderboard.find(r => r.uid === 'B').wins, 1);
  assert.equal(s.leaderboard.find(r => r.uid === 'B').kos, 1);
  assert.equal(h.chat('B', 'đấm').reason, 'not_fighting');
  assert.throws(() => h.arena.command('match.finish', { winner: 'blue' }));
  assert.equal(h.arena.snapshot().stats.matches, 1);
});

test('winning fighter stays and queued challenger rotates into next match', () => {
  const h = harness({ settings: { maxHp: 100, giftDamageCap: 1000, autoNext: true, holdWinnerSeconds: 2 } }); h.ready();
  h.arena.command('queue.add', h.user('C')); h.gift('B', 100);h.advance(2400);
  h.advance(2100); const s = h.arena.snapshot();
  assert.equal(s.match.phase, 'fighting'); assert.equal(s.match.number, 2);
  assert.equal(s.match.fighters.blue.uid, 'B'); assert.equal(s.match.fighters.red.uid, 'C');
  assert.equal(s.match.fighters.blue.hp, 100); assert.equal(s.match.fighters.blue.streak, 1);
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
  h.advance(29900); assert.equal(h.arena.snapshot().match.phase, 'rest');
});

test('round time never awards a winner or draw, and rest leads to the next round', () => {
  const h=harness({settings:{roundSeconds:15,restSeconds:2}});h.ready();h.chat('A','đấm');h.advance(15000);
  let m=h.arena.snapshot().match;assert.equal(m.phase,'rest');assert.equal(m.result,null);assert.equal(m.round,1);
  h.advance(2000);m=h.arena.snapshot().match;assert.equal(m.phase,'fighting');assert.equal(m.round,2);assert.equal(m.result,null);
  assert.throws(()=>h.arena.command('match.finish',{winner:null}),/không có kết quả hòa/);
  assert.throws(()=>h.arena.command('match.finish',{}),/không có kết quả hòa/);
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

test('manual finish requires one winner and retains that champion for the next challenger', () => {
  const h=harness();h.ready();h.arena.command('queue.add',h.user('C'));
  assert.throws(()=>h.arena.command('match.finish',{winner:null}));assert.equal(h.arena.snapshot().match.phase,'fighting');
  h.arena.command('match.finish',{winner:'blue'});h.arena.command('match.start');
  assert.equal(h.arena.snapshot().match.fighters.blue.uid,'B');assert.equal(h.arena.snapshot().match.fighters.red.uid,'C');
});

test('new installation defaults to 1600 HP and exact routed corner gifts',()=>{
 const a=createArena();assert.equal(a.snapshot().settings.maxHp,1600);assert.deepEqual(a.snapshot().settings.cornerGifts,DEFAULT_CORNER_GIFTS);
});
test('exact coin amount routes any spectator without selection or admission',()=>{
 const h=harness({settings:{cornerGifts:DEFAULT_CORNER_GIFTS}});h.ready();
 const gift=h.gift('Outsider',6);assert.equal(gift.side,'blue');assert.equal(gift.move,'flurry');assert.equal(h.arena.snapshot().queue.length,0);
 assert.equal(hp(h,'red'),1000);const start=h.events.findLast(e=>e.type==='attack.start');assert.equal(start.side,'blue');
 h.advance(1400);assert.ok(hp(h,'red')<1000);assert.equal(hp(h,'blue'),1000);
});
test('exact route overrides donor fighter side, selected corner and gift ID map',()=>{
 const h=harness({settings:{cornerGifts:DEFAULT_CORNER_GIFTS,giftMap:{123:'heal'}}});h.ready();h.chat('B','xanh');
 const g=h.gift('B',5,{giftId:123});assert.equal(g.side,'red');assert.equal(g.move,'flurry');h.advance(1400);assert.ok(hp(h,'blue')<1000);assert.equal(hp(h,'red'),1000);
});
test('coin routes compare total event coins exactly, never multiplied by repeat count',()=>{
 const h=harness({settings:{cornerGifts:DEFAULT_CORNER_GIFTS}});h.ready();
 const x=h.gift('Outsider',11,{count:6});assert.equal(x.queued,true);assert.equal(h.arena.snapshot().queue.length,1);assert.equal(h.events.filter(e=>e.type==='attack.start').length,0);
 const y=h.gift('Other',6,{count:999});assert.equal(y.side,'blue');assert.equal(h.arena.snapshot().stats.coins,17);
});
test('late combo correction credits coins once without routing opposite corner or admitting again',()=>{
 const h=harness({settings:{cornerGifts:DEFAULT_CORNER_GIFTS}});h.ready();h.gift('Fan',5,{eventId:'initial'});
 const result=h.gift('Fan',6,{eventId:'correction',streakCoins:11,isStreakCorrection:true});
 assert.equal(result.creditedOnly,true);assert.equal(h.arena.snapshot().stats.coins,11);assert.equal(h.arena.snapshot().queue.length,0);
 assert.equal(h.events.filter(e=>e.type==='attack.start').length,1);assert.equal(h.events.find(e=>e.type==='attack.start').side,'red');
 assert.equal(h.gift('Fan',6,{eventId:'correction',isStreakCorrection:true}).reason,'duplicate');assert.equal(h.arena.snapshot().stats.coins,11);
});
test('duplicate or malformed route settings are rejected atomically',()=>{
 const h=harness({settings:{cornerGifts:DEFAULT_CORNER_GIFTS}});const before=h.arena.snapshot().settings;
 for(const cornerGifts of [[{coins:5,side:'red',action:'heal'},{coins:5,side:'blue',action:'flurry'}],[{coins:5.5,side:'red',action:'heal'}],[{coins:5,side:'green',action:'heal'}],[{coins:5,side:'red',action:'entry'}],Array(33).fill({coins:4,side:'red',action:'heal'})]){
  assert.throws(()=>h.arena.command('settings.set',{settings:{maxHp:333,cornerGifts}}));assert.deepEqual(h.arena.snapshot().settings,before);
 }
 const result=h.arena.command('settings.set',{settings:{cornerGifts:[{coins:42,side:'blue',action:'boost'}]}});result.cornerGifts[0].side='red';assert.equal(h.arena.snapshot().settings.cornerGifts[0].side,'blue');
});
test('big attack windup precedes damage and final hit matches animation sequence',()=>{
 const h=harness({settings:{cornerGifts:DEFAULT_CORNER_GIFTS}});h.ready();const g=h.gift('Fan',30);
 assert.equal(g.durationMs,2400);assert.equal(h.events.filter(e=>e.type==='hit').length,0);h.advance(2399);assert.equal(hp(h,'blue'),1000);
 h.advance(1);const hit=h.events.findLast(e=>e.type==='hit');assert.equal(hit.sequenceId,g.sequenceId);assert.equal(hit.choreographed,true);assert.ok(hit.damage>0);
});
test('pending big attacks pause exactly and cannot apply during pause',()=>{
 const h=harness({settings:{cornerGifts:DEFAULT_CORNER_GIFTS}});h.ready();h.gift('Fan',30);h.advance(1000);h.arena.command('match.pause');
 h.advance(60000);assert.equal(hp(h,'blue'),1000);h.arena.command('match.resume');h.advance(1399);assert.equal(hp(h,'blue'),1000);h.advance(1);assert.ok(hp(h,'blue')<1000);
});
test('same-corner support queues after current animation, with FIFO execution',()=>{
 const h=harness({settings:{cornerGifts:DEFAULT_CORNER_GIFTS}});h.ready();h.gift('Fan',30);const queued=h.gift('Other',5);assert.equal(queued.queued,true);
 h.advance(2400);const after=hp(h,'blue');assert.equal(h.events.filter(e=>e.type==='attack.start').length,2);h.advance(1399);assert.equal(hp(h,'blue'),after);h.advance(1);assert.ok(hp(h,'blue')<after);
});
test('support queue is bounded and reset discards every old sequence and pending effect',()=>{
 const h=harness({settings:{cornerGifts:DEFAULT_CORNER_GIFTS}});h.ready();h.gift('Fan',30);
 for(let i=0;i<12;i++)assert.equal(h.gift('Fan'+i,5).queued,true);
 assert.equal(h.gift('Overflow',5).reason,'support_queue_full');assert.equal(h.arena.snapshot().match.supportQueue,12);
 h.arena.command('match.reset');h.arena.command('match.start');h.advance(5000);assert.equal(hp(h,'blue'),1000);assert.equal(h.arena.snapshot().match.activeActions.length,0);assert.equal(h.arena.snapshot().match.supportQueue,0);
});
test('support during countdown and rest is delayed and tied to the current match',()=>{
 const h=harness({settings:{cornerGifts:DEFAULT_CORNER_GIFTS,countdownSeconds:1,roundSeconds:15,restSeconds:2}});h.ready();
 assert.equal(h.gift('Fan',5).queued,true);assert.equal(h.events.filter(e=>e.type==='attack.start').length,0);
 h.advance(1000);h.advance(1);assert.equal(h.events.filter(e=>e.type==='attack.start').length,1);h.advance(1400);assert.ok(hp(h,'blue')<1000);
 h.advance(14000);assert.equal(h.arena.snapshot().match.phase,'rest');const before=hp(h,'red');h.gift('Fan',6);h.advance(1999);assert.equal(hp(h,'red'),before);h.advance(1);h.advance(1);h.advance(1400);assert.ok(hp(h,'red')<before);
});
test('power boost refreshes a capped multiplier and expires after active paused time',()=>{
 const h=harness({settings:{cornerGifts:DEFAULT_CORNER_GIFTS}});h.ready();h.gift('Fan',99);h.gift('Other',99);
 assert.equal(h.arena.snapshot().match.fighters.red.powerMultiplier,1.3);assert.equal(h.chat('A','đấm').damage,47);
 h.advance(1000);h.arena.command('match.pause');h.advance(60000);assert.equal(h.arena.snapshot().match.fighters.red.buffRemainingMs,11000);assert.equal(h.arena.snapshot().match.fighters.red.powerMultiplier,1.3);
 h.arena.command('match.resume');h.advance(11001);assert.equal(h.arena.snapshot().match.fighters.red.powerMultiplier,1);assert.equal(h.chat('A','đấm').damage,36);
});
test('healing has a per-side ten-second budget, cannot overflow HP, and pause freezes budget',()=>{
 const h=harness({settings:{cornerGifts:DEFAULT_CORNER_GIFTS}});h.ready();h.gift('Fan',6);h.advance(1400);h.gift('Fan',6);h.advance(1400);
 assert.equal(hp(h,'red'),780);assert.equal(h.gift('Fan',10).healed,150);assert.equal(h.gift('Fan',10).healed,0);
 h.arena.command('match.pause');h.advance(20000);h.arena.command('match.resume');assert.equal(h.gift('Fan',10).healed,0);
 h.advance(10001);assert.equal(h.gift('Fan',10).healed,70);assert.equal(hp(h,'red'),1000);
});
test('low-health comeback shield activates once and mitigates the next pressure',()=>{
 const h=harness({settings:{maxHp:200,cornerGifts:DEFAULT_CORNER_GIFTS}});h.ready();h.gift('Fan',30);h.advance(2400);
 let b=h.arena.snapshot().match.fighters.blue;assert.equal(b.hp,25);assert.equal(b.comebackUsed,true);assert.equal(b.guardRemainingMs,8000);
 const hit=h.chat('A','đấm');assert.equal(hit.damage,24);assert.equal(hp(h,'blue'),1);assert.equal(h.events.filter(e=>e.type==='comeback').length,1);
});
test('round pressure grows after two rounds and rests never end a match by score',()=>{
 const h=harness({settings:{roundSeconds:15,restSeconds:2}});h.ready();
 for(let i=0;i<2;i++){h.advance(15000);assert.equal(h.arena.snapshot().match.result,null);h.advance(2000);}
 const m=h.arena.snapshot().match;assert.equal(m.round,3);assert.equal(m.overtime,true);assert.equal(m.pressure,1.4);assert.equal(m.phase,'fighting');
 h.advance(15000);assert.equal(h.arena.snapshot().match.phase,'rest');h.arena.command('match.finish',{winner:'red'});assert.equal(h.arena.snapshot().match.result.winner,'red');
});
test('gentle autopilot keeps an idle arena fighting until a single KO winner',()=>{
 const h=harness({settings:{autoSparring:true,roundSeconds:15,restSeconds:2}});h.ready();
 for(let i=0;i<3000&&h.arena.snapshot().match.phase!=='finished';i++)h.advance(250);
 const s=h.arena.snapshot();assert.equal(s.match.phase,'finished');assert.ok(['red','blue'].includes(s.match.result.winner));assert.equal(s.match.result.reason,'ko');assert.ok(h.events.some(e=>e.type==='hit'&&e.auto));assert.ok(s.match.round>1);
});

 test('continuous paid healing cannot lock the arena forever: late fatigue resolves KO within ten minutes',()=>{
 const h=harness({settings:{maxHp:1600,autoSparring:true,roundSeconds:120,restSeconds:8,cornerGifts:DEFAULT_CORNER_GIFTS}});h.ready();
 for(let i=0;i<2400&&h.arena.snapshot().match.phase!=='finished';i++){
  if(i%4===0){h.gift('Red supporter',10,{eventId:'r'+i});h.gift('Blue supporter',20,{eventId:'b'+i});}
  h.advance(250);
 }
 const s=h.arena.snapshot();assert.equal(s.match.phase,'finished');assert.equal(s.match.result.reason,'ko');assert.ok(['red','blue'].includes(s.match.result.winner));assert.ok(s.match.round<=5);
 });
