// Võ Đài LIVE — authoritative, transport-independent combat and match lifecycle.
// Monetary admission, event deduplication and rankings live here, never in the browser.
import { randomUUID } from 'node:crypto';

export const DEFAULT_SETTINGS = Object.freeze({
  title: 'VÕ ĐÀI LIVE', roundSeconds: 120, countdownSeconds: 4, maxHp: 1000,
  entryCoins: 1, commentCooldownMs: 1000, giftDamageCap: 300,
  autoNext: true, holdWinnerSeconds: 8, mcEnabled: true, mcVolume: 80,
  mcRate: 15, mcIdleSeconds: 35, musicEnabled: false, musicVolume: 25,
  sfxVolume: 70, theme: 'electric', showCommands: true, phoneEnabled: false,
  giftMap: Object.freeze({ '5655': 'jab', '5487': 'flurry', '5879': 'uppercut', '5587': 'ultimate' }),
});
export const MOVES = Object.freeze({
  jab: { label: 'Đấm thẳng', damage: 36, stamina: 10, hits: 1, energy: 12 },
  hook: { label: 'Đấm móc', damage: 64, stamina: 20, hits: 1, energy: 16 },
  uppercut: { label: 'Đấm bốc', damage: 86, stamina: 27, hits: 1, energy: 20 },
  kick: { label: 'Đá vòng', damage: 72, stamina: 24, hits: 1, energy: 18 },
  flurry: { label: 'Liên hoàn', damage: 132, stamina: 38, hits: 5, energy: 20 },
  ultimate: { label: 'Bão quyền', damage: 210, stamina: 45, hits: 8, energy: 0 },
});
export const GIFT_ACTIONS = Object.freeze([
  ...Object.entries(MOVES).map(([id, move]) => ({ id, label: move.label, emoji: ({ jab: '🥊', hook: '💥', uppercut: '⚡', kick: '🦵', flurry: '🔥', ultimate: '🌪️' })[id] })),
  { id: 'heal', label: 'Hồi máu', emoji: '💚' },
  { id: 'shield', label: 'Lá chắn', emoji: '🛡️' },
  { id: 'entry', label: 'Vé lên đài', emoji: '🎟️' },
]);

const SIDES = ['red', 'blue'];
const GIFT_IDS = new Set(GIFT_ACTIONS.map(a => a.id));
const clone = value => structuredClone(value);
const finite = (n, fallback = 0) => Number.isFinite(Number(n)) ? Number(n) : fallback;
const clamp = (n, min, max, fallback = min) => Math.max(min, Math.min(max, finite(n, fallback)));
const int = (n, min, max, fallback = min) => Math.round(clamp(n, min, max, fallback));
const own = (o, key) => Object.hasOwn(o, key);
const text = (s, max = 50) => String(s ?? '').normalize('NFKC').replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060-\u206f]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
const norm = s => text(s, 200).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
const safeAvatar = s => { try { const u = new URL(String(s)); return u.protocol === 'https:' && !u.username && !u.password ? u.href.slice(0, 600) : ''; } catch { return ''; } };
const opposite = side => side === 'red' ? 'blue' : 'red';
const error = message => { throw new Error(message); };
const makeStats = () => ({ matches: 0, punches: 0, coins: 0, viewers: 0 });
const makeMatch = number => ({ id: randomUUID(), number, phase: 'waiting', fighters: { red: null, blue: null }, result: null, remainingMs: 0, countdownMs: 0, deadline: 0, pausedPhase: '', pausedAt: 0, manualHold: false, nextAt: 0 });
const makeSession = () => ({ match: makeMatch(1), queue: [], records: {}, supporters: {}, stats: makeStats(), recent: [] });

function cleanSettings(input = {}, base = DEFAULT_SETTINGS) {
  const out = { ...base, giftMap: { ...base.giftMap } };
  if (!input || typeof input !== 'object' || Array.isArray(input)) return out;
  const ranges = {
    roundSeconds: [15, 900], countdownSeconds: [0, 15], maxHp: [100, 10000], entryCoins: [0, 100000],
    commentCooldownMs: [300, 10000], giftDamageCap: [10, 2000], holdWinnerSeconds: [2, 60],
    mcVolume: [0, 100], mcRate: [-50, 50], mcIdleSeconds: [15, 300], musicVolume: [0, 100], sfxVolume: [0, 100],
  };
  for (const [key, [min, max]] of Object.entries(ranges)) if (own(input, key)) out[key] = int(input[key], min, max, base[key]);
  for (const key of ['autoNext', 'mcEnabled', 'musicEnabled', 'showCommands', 'phoneEnabled']) if (typeof input[key] === 'boolean') out[key] = input[key];
  if (own(input, 'title')) out.title = text(input.title, 40) || DEFAULT_SETTINGS.title;
  if (['electric', 'ember', 'ice'].includes(input.theme)) out.theme = input.theme;
  if (input.giftMap && typeof input.giftMap === 'object' && !Array.isArray(input.giftMap)) {
    out.giftMap = {};
    for (const [id, move] of Object.entries(input.giftMap).slice(0, 150)) if (/^\d{1,20}$/.test(id) && GIFT_IDS.has(move)) out.giftMap[id] = move;
  }
  return out;
}

function userOf(payload) {
  const uid = text(payload?.uid ?? payload?.userId ?? '', 100);
  if (!uid || ['__proto__', 'constructor', 'prototype'].includes(uid)) error('Thiếu mã người xem hợp lệ.');
  return { uid, name: text(payload?.name ?? payload?.nickname ?? uid, 40) || 'Khán giả', avatar: safeAvatar(payload?.avatar), joinedAt: 0 };
}

function cleanRecord(r, uid) {
  return { uid, name: text(r?.name || uid, 40), avatar: safeAvatar(r?.avatar), wins: int(r?.wins, 0, 1e8), kos: int(r?.kos, 0, 1e8), coins: int(r?.coins, 0, 1e12), streak: int(r?.streak, 0, 1e8), seenAt: finite(r?.seenAt) };
}

export function createArena({ initial = {}, onEvent = () => {}, onSave = () => {}, now = Date.now, random = Math.random } = {}) {
  let settings = cleanSettings(initial.settings);
  let mode = initial.mode === 'demo' ? 'demo' : 'live';
  let sessions = { live: restore(initial.live || initial.session), demo: makeSession() };
  let transient = freshTransient();
  let dirty = false;
  let lastTick = now();
  let lastSnapshotSecond = -1;
  let eventSeq = 0;

  function freshTransient() { return { viewers: new Set(), selections: new Map(), cooldowns: new Map(), attacks: new Map(), defense: new Map(), gifts: new Map(), matchEventAt: 0 }; }
  function current() { return sessions[mode]; }
  function restore(saved = {}) {
    const result = makeSession();
    if (!saved || typeof saved !== 'object') return result;
    for (const key of Object.keys(result.stats)) result.stats[key] = int(saved.stats?.[key], 0, 1e12);
    result.match.number = int(saved.match?.number, 1, 1e8, 1);
    result.recent = Array.isArray(saved.recent) ? saved.recent.slice(-60).map(r => ({ id: text(r.id, 100), type: text(r.type, 30), text: text(r.text, 250), at: finite(r.at) })) : [];
    if (saved.records && typeof saved.records === 'object') for (const [uid, record] of Object.entries(saved.records).slice(0, 5000)) {
      try { userOf({ uid }); result.records[uid] = cleanRecord(record, uid); } catch { /* corrupt local entry */ }
    }
    const queued = [];
    // A restart never resurrects half a fight. Paid active fighters keep their place.
    for (const side of SIDES) if (saved.match?.fighters?.[side] && (saved.match.phase !== 'finished' || saved.match.result?.winner === side)) queued.push(saved.match.fighters[side]);
    if (Array.isArray(saved.queue)) queued.push(...saved.queue);
    const used = new Set();
    for (const p of queued) {
      try { const u = userOf(p); if (used.has(u.uid)) continue; used.add(u.uid); result.queue.push({ ...u, coins: int(p.coins ?? saved.records?.[u.uid]?.coins, 0, 1e12), joinedAt: finite(p.joinedAt, now()) }); } catch { /* ignore bad saved queue row */ }
      if (result.queue.length >= 100) break;
    }
    if (saved.supporters && typeof saved.supporters === 'object') for (const [uid, p] of Object.entries(saved.supporters).slice(0, 5000)) {
      try { const u = userOf({ ...p, uid }); result.supporters[uid] = { uid, name: u.name, coins: int(p.coins, 0, 1e12) }; } catch {}
    }
    return result;
  }
  function emit(type, details = {}) { onEvent({ type, ...details }); }
  function log(type, message) {
    const s = current();
    s.recent.push({ id: `${now()}-${++eventSeq}`, type, text: text(message, 250), at: now() });
    if (s.recent.length > 60) s.recent.splice(0, s.recent.length - 60);
    dirty = true;
  }
  function save() { dirty = false; onSave(exportState()); }
  function changed() { dirty = true; save(); }
  function exportState() {
    return clone({ v: 1, mode, settings, live: sessions.live });
  }
  function record(user) {
    const s = current();
    const r = own(s.records, user.uid) ? s.records[user.uid] : (s.records[user.uid] = cleanRecord(user, user.uid));
    r.name = user.name; r.avatar = user.avatar || r.avatar; r.seenAt = now();
    if (Object.keys(s.records).length > 5000) {
      const protectedIds = new Set([...s.queue.map(p => p.uid), ...SIDES.map(side => s.match.fighters[side]?.uid)]);
      const old = Object.values(s.records).sort((a, b) => a.seenAt - b.seenAt);
      for (const row of old) { if (!protectedIds.has(row.uid)) { delete s.records[row.uid]; break; } }
    }
    return r;
  }
  function sideOf(uid) { return SIDES.find(side => current().match.fighters[side]?.uid === uid); }
  function addQueue(user, { announce = true } = {}) {
    const s = current();
    const existing = s.queue.find(p => p.uid === user.uid);
    if (sideOf(user.uid)) return { ok: true, active: true, position: 0 };
    if (existing) { existing.name = user.name; existing.avatar = user.avatar || existing.avatar; existing.coins = s.records[user.uid]?.coins || existing.coins; return { ok: true, queued: true, position: s.queue.indexOf(existing) + 1 }; }
    if (s.queue.length >= 100) return { ok: false, reason: 'queue_full', message: 'Hàng chờ đã đủ 100 người, chờ một chỗ trống nhé.' };
    record(user);
    s.queue.push({ ...user, coins: s.records[user.uid]?.coins || 0, joinedAt: now() });
    if (announce) { emit('queue', { uid: user.uid, name: user.name, action: 'join', position: s.queue.length }); log('queue', `${user.name} đã vào hàng chờ — vị trí ${s.queue.length}.`); }
    dirty = true;
    return { ok: true, queued: true, position: s.queue.length };
  }
  function fighter(user) {
    const r = record(user);
    return { uid: user.uid, name: user.name, avatar: user.avatar || '', hp: settings.maxHp, maxHp: settings.maxHp, stamina: 100, maxStamina: 100, energy: 0, damage: 0, combo: 0, wins: r.wins, streak: r.streak };
  }
  function clearCombat() { transient.cooldowns.clear(); transient.attacks.clear(); transient.defense.clear(); }
  function makeNewMatch({ keepWinner = false, keepBoth = false } = {}) {
    const s = current(), previous = s.match;
    let red = null, blue = null;
    if (keepBoth) { red = previous.fighters.red; blue = previous.fighters.blue; }
    else if (keepWinner && previous.result?.winner) red = previous.fighters[previous.result.winner];
    s.match = makeMatch(previous.number + (previous.phase === 'finished' ? 1 : 0));
    if (red) s.match.fighters.red = fighter(red);
    if (blue) s.match.fighters.blue = fighter(blue);
    clearCombat();
    fillCorners();
  }
  function fillCorners() {
    const s = current(), m = s.match;
    if (m.phase !== 'waiting') return;
    for (const side of SIDES) {
      if (m.fighters[side]) continue;
      while (s.queue.length) {
        const person = s.queue.shift();
        if (sideOf(person.uid)) continue;
        m.fighters[side] = fighter(person); break;
      }
    }
  }
  function sufficientNext() { const s = current(); return s.queue.length + (s.match.result?.winner ? 1 : 0) >= 2; }
  function beginMatch() {
    const m = current().match;
    if (!['waiting', 'finished'].includes(m.phase)) error('Trận đang diễn ra. Hãy tạm dừng, kết thúc hoặc reset trước.');
    if (m.phase === 'finished') {
      if (!sufficientNext()) error('Cần người thách đấu trong hàng chờ để bắt đầu trận tiếp theo.');
      makeNewMatch({ keepWinner: true });
    }
    fillCorners();
    const next = current().match;
    if (!next.fighters.red || !next.fighters.blue) error('Cần đủ hai võ sĩ để bắt đầu. Thêm người vào hàng chờ.');
    next.result = null; next.manualHold = false; next.remainingMs = settings.roundSeconds * 1000;
    next.countdownMs = settings.countdownSeconds * 1000;
    next.phase = next.countdownMs > 0 ? 'countdown' : 'fighting';
    next.deadline = now() + (next.countdownMs || next.remainingMs);
    next.nextAt = 0;
    clearCombat();
    log('match', `${next.fighters.red.name} đối đầu ${next.fighters.blue.name}.`);
    emit('match', { phase: next.phase, number: next.number, red: next.fighters.red.name, blue: next.fighters.blue.name });
    dirty = true;
    return { ok: true, phase: next.phase };
  }
  function finishMatch(winner, reason = 'decision') {
    const s = current(), m = s.match;
    if (!['fighting', 'paused', 'countdown'].includes(m.phase)) error('Hiện chưa có trận để kết thúc.');
    if (winner !== null && !SIDES.includes(winner)) error('Góc thắng phải là đỏ, xanh hoặc hòa.');
    const winningFighter = winner ? m.fighters[winner] : null;
    if (winner && !winningFighter) error('Góc thắng không có võ sĩ.');
    m.phase = 'finished'; m.remainingMs = 0; m.countdownMs = 0; m.deadline = 0;
    m.result = { winner, reason, name: winningFighter?.name || 'Hòa trận' };
    m.nextAt = now() + settings.holdWinnerSeconds * 1000;
    s.stats.matches++;
    if (winner) {
      const w = record(winningFighter); w.wins++; w.streak++;
      if (reason === 'ko') w.kos++;
      winningFighter.wins = w.wins; winningFighter.streak = w.streak;
      const losingFighter = m.fighters[opposite(winner)];
      if (losingFighter) { record(losingFighter).streak = 0; losingFighter.streak = 0; }
    } else for (const side of SIDES) if (m.fighters[side]) record(m.fighters[side]).streak = 0;
    clearCombat();
    log('match', winner ? `${winningFighter.name} thắng ${reason === 'ko' ? 'KNOCK-OUT' : 'trận đấu'}!` : 'Hai võ sĩ hòa điểm sau trận đấu.');
    emit('ko', { winner, loser: winner ? opposite(winner) : null, name: winningFighter?.name || '', reason });
    emit('match', { phase: 'finished', winner, reason });
    dirty = true;
    return { ok: true, result: clone(m.result) };
  }
  function validSide(side) { if (!SIDES.includes(side)) error('Chọn góc đỏ hoặc xanh.'); return side; }
  function attack(side, move, opts = {}) {
    validSide(side);
    const s = current(), m = s.match;
    if (m.phase !== 'fighting') return { ok: false, reason: 'not_fighting', message: 'Chờ tiếng chuông bắt đầu trận.' };
    const a = m.fighters[side], target = opposite(side), d = m.fighters[target];
    if (!a || !d) return { ok: false, reason: 'no_opponent' };
    if (!MOVES[move]) return { ok: false, reason: 'invalid_move' };
    const model = MOVES[move], time = now(), prev = transient.attacks.get(a.uid);
    if (!opts.gift) {
      if (time - (transient.cooldowns.get(a.uid) ?? -Infinity) < settings.commentCooldownMs) return { ok: false, reason: 'cooldown', message: 'Đòn đang hồi, hãy chờ nhịp tiếp theo.' };
      if (move === 'ultimate' && a.energy < 100) return { ok: false, reason: 'energy', message: 'Cần đầy 100 năng lượng để tung Bão quyền.' };
      if (a.stamina < model.stamina) return { ok: false, reason: 'stamina', message: 'Thể lực thấp, hãy nghỉ hoặc đỡ đòn.' };
      a.stamina = Math.max(0, a.stamina - model.stamina);
      transient.cooldowns.set(a.uid, time);
      a.energy = move === 'ultimate' ? 0 : Math.min(100, a.energy + model.energy);
    }
    a.combo = prev && time - prev.at <= 3200 ? Math.min(20, a.combo + 1) : 1;
    transient.attacks.set(a.uid, { at: time, move });
    const defense = transient.defense.get(d.uid);
    const dodged = !!(defense?.move === 'dodge' && defense.until > time);
    const blocked = !dodged && !!(defense?.move === 'block' && defense.until > time);
    // Consumed defense cannot make a fighter invulnerable to a long paid burst.
    if (defense && defense.until > time) transient.defense.delete(d.uid);
    const critical = !dodged && !blocked && random() < 0.1;
    const baseDamage = opts.gift ? clamp(opts.damage, 1, settings.giftDamageCap) : model.damage * (1 + Math.min(a.combo - 1, 4) * 0.04);
    let damage = dodged ? 0 : Math.round(baseDamage * (critical ? 1.3 : 1) * (blocked ? 0.28 : 1));
    // Coins never bypass the hard gift ceiling, including a critical hit.
    damage = Math.min(d.hp, opts.gift ? Math.min(settings.giftDamageCap, damage) : damage);
    damage = Math.max(0, damage);
    d.hp = Math.max(0, d.hp - damage); a.damage += damage;
    d.energy = Math.min(100, d.energy + (blocked || dodged ? 14 : 6));
    if (dodged) d.stamina = Math.min(100, d.stamina + 5);
    const hits = opts.hits || model.hits;
    s.stats.punches += hits;
    emit('hit', { side, target, move, damage, hits, critical, blocked, dodged, combo: a.combo, gift: !!opts.gift, attacker: a.name, defender: d.name });
    if (opts.gift || critical || a.combo >= 3 || damage === 0) log('hit', `${a.name}: ${model.label}${opts.gift ? ' từ quà' : ''} ${dodged ? '— đối thủ né thành công' : blocked ? `— bị đỡ, ${damage} sát thương` : `— ${damage} sát thương`}.`);
    dirty = true;
    if (d.hp <= 0) finishMatch(side, 'ko');
    return { ok: true, damage, move, side, target, blocked, dodged, critical };
  }
  function defend(side, move) {
    const m = current().match;
    if (m.phase !== 'fighting') return { ok: false, reason: 'not_fighting' };
    const f = m.fighters[validSide(side)];
    if (!f) return { ok: false, reason: 'no_fighter' };
    const at = now(), cost = move === 'dodge' ? 16 : 8;
    if (at - (transient.cooldowns.get(f.uid) ?? -Infinity) < settings.commentCooldownMs) return { ok: false, reason: 'cooldown' };
    if (f.stamina < cost) return { ok: false, reason: 'stamina' };
    transient.cooldowns.set(f.uid, at); f.stamina -= cost;
    transient.defense.set(f.uid, { move, until: at + (move === 'dodge' ? 1400 : 2500) });
    emit('defend', { side, move, name: f.name });
    dirty = true;
    return { ok: true, side, move };
  }
  function admitGift(user, payload) {
    const s = current(), at = now();
    if (!Number.isFinite(Number(payload.coins)) || Number(payload.coins) <= 0) return { ok: false, reason: 'invalid_coins', message: 'Số xu quà phải lớn hơn 0.' };
    const coins = int(payload.coins, 1, 1000000, 1);
    const eventId = text(payload.eventId, 200);
    if (eventId) {
      const key = `${user.uid}|${eventId}`;
      const previous = transient.gifts.get(key);
      if (previous && at - previous < 10 * 60_000) return { ok: false, reason: 'duplicate' };
      transient.gifts.set(key, at || 1);
      if (transient.gifts.size > 10000) transient.gifts.delete(transient.gifts.keys().next().value);
    }
    const r = record(user); r.coins += coins; s.stats.coins += coins;
    const supporter = own(s.supporters, user.uid) ? s.supporters[user.uid] : (s.supporters[user.uid] = { uid: user.uid, name: user.name, coins: 0 });
    supporter.name = user.name; supporter.coins += coins;
    if (Object.keys(s.supporters).length > 5000) {
      const least = Object.values(s.supporters).sort((a, b) => a.coins - b.coins)[0]; if (least) delete s.supporters[least.uid];
    }
    const ownSide = sideOf(user.uid), selected = transient.selections.get(user.uid);
    const side = ownSide || (selected && s.match.fighters[selected] ? selected : null);
    const giftId = String(payload.giftId || '').replace(/\D/g, '').slice(0, 20);
    const mapped = settings.giftMap[giftId];
    const move = mapped || (coins >= 100 ? 'ultimate' : coins >= 30 ? 'uppercut' : coins >= 5 ? 'flurry' : 'jab');
    let result;
    if (!side || move === 'entry') {
      // Admission uses cumulative coins for this session, never arbitrary comment text.
      if (r.coins >= settings.entryCoins) result = addQueue(user);
      else result = { ok: true, remainingCoins: Math.max(0, settings.entryCoins - r.coins) };
    } else if (s.match.phase === 'fighting') {
      if (move === 'heal') {
        const f = s.match.fighters[side], amount = Math.min(settings.giftDamageCap, Math.round(f.maxHp * 0.15));
        const healed = Math.min(f.maxHp - f.hp, amount); f.hp += healed;
        emit('heal', { side, amount: healed, name: f.name }); result = { ok: true, healed };
      } else if (move === 'shield') {
        const f = s.match.fighters[side]; transient.defense.set(f.uid, { move: 'block', until: at + 5000 });
        emit('defend', { side, move: 'block', name: f.name, gift: true }); result = { ok: true, shield: true };
      } else {
        const damage = Math.min(settings.giftDamageCap, coins >= 1000 ? 300 : coins >= 100 ? 240 : coins >= 30 ? 160 : coins >= 5 ? 105 : 45);
        result = attack(side, move, { gift: true, damage });
      }
    } else result = { ok: true, pending: true, message: 'Quà đã được ghi nhận; đòn chỉ được tung trong thời gian thi đấu.' };
    emit('gift', { uid: user.uid, name: user.name, coins, giftId, giftName: text(payload.giftName || 'Quà tặng', 60), move, side });
    log('gift', `${user.name} tặng ${coins} xu${side ? ` cho góc ${side === 'red' ? 'đỏ' : 'xanh'}` : ' để lên đài'}.`);
    dirty = true;
    return { ...result, coins, move, side };
  }
  function parseChat(user, payload) {
    const raw = text(payload.text, 200).toLowerCase();
    const line = norm(raw), side = sideOf(user.uid);
    const redSelect = line === 'red' || raw === 'đỏ' || (!side && line === 'do' && raw !== 'đỡ');
    if (redSelect || line === 'xanh' || line === 'blue') {
      const chosen = redSelect ? 'red' : 'blue'; transient.selections.set(user.uid, chosen);
      if (transient.selections.size > 5000) transient.selections.delete(transient.selections.keys().next().value);
      return { ok: true, support: chosen, message: `Đã chọn cổ vũ góc ${chosen === 'red' ? 'đỏ' : 'xanh'}.` };
    }
    if (['len dai', 'tham gia', 'join', 'vao dai'].includes(line)) {
      const r = current().records[user.uid];
      if (settings.entryCoins > 0 && (r?.coins || 0) < settings.entryCoins) return { ok: false, reason: 'entry_required', message: `Tặng đủ ${settings.entryCoins} xu để đăng ký lên đài.` };
      return addQueue(user);
    }
    if (!side) return { ok: false, reason: 'spectator', message: 'Bạn chưa ở trên đài. Chọn đỏ/xanh để cổ vũ hoặc đăng ký thách đấu.' };
    if (['do', 'do don', 'chan', 'block', 'phong thu'].includes(line)) return defend(side, 'block');
    if (['ne', 'dodge', 'ne don'].includes(line)) return defend(side, 'dodge');
    const aliases = { 'dam': 'jab', 'dam thang': 'jab', thang: 'jab', jab: 'jab', moc: 'hook', 'dam moc': 'hook', hook: 'hook', 'dam boc': 'uppercut', boc: 'uppercut', uppercut: 'uppercut', da: 'kick', kick: 'kick', 'da vong': 'kick', 'lien hoan': 'flurry', combo: 'flurry', flurry: 'flurry', 'bao quyen': 'ultimate', ultimate: 'ultimate', 'tuyet chieu': 'ultimate' };
    return aliases[line] ? attack(side, aliases[line]) : { ok: false, reason: 'unknown_command' };
  }
  function ingest(kind, payload = {}, { source = 'live' } = {}) {
    if (!['live', 'demo'].includes(source) || source !== mode) return { ok: false, reason: 'wrong_mode' };
    if (!['chat', 'like', 'gift', 'join'].includes(kind)) return { ok: false, reason: 'unknown_event' };
    let user;
    try { user = userOf(payload); } catch { return { ok: false, reason: 'invalid_user' }; }
    if (!transient.viewers.has(user.uid)) { transient.viewers.add(user.uid); current().stats.viewers++; if (transient.viewers.size > 30000) transient.viewers.delete(transient.viewers.values().next().value); }
    record(user);
    let result = { ok: true };
    if (kind === 'chat') result = parseChat(user, payload);
    else if (kind === 'gift') result = admitGift(user, payload);
    else if (kind === 'like') {
      const side = sideOf(user.uid) || transient.selections.get(user.uid);
      if (side && current().match.phase === 'fighting') {
        const f = current().match.fighters[side];
        if (f) { const gain = Math.min(8, Math.max(1, int(payload.count, 1, 10000) / 5)); f.energy = Math.min(100, f.energy + gain); result = { ok: true, side, energy: gain }; }
      }
    }
    changed();
    return result;
  }
  function snapshot() {
    const s = current(), m = s.match, time = now();
    const timeLeft = phase => m.phase === phase ? Math.max(0, m.deadline - time) : m.phase === 'paused' && m.pausedPhase === phase ? (phase === 'countdown' ? m.countdownMs : m.remainingMs) : 0;
    return clone({
      mode, now: time,
      match: { id: m.id, number: m.number, phase: m.phase, remainingMs: timeLeft('fighting') || (['waiting', 'countdown'].includes(m.phase) ? m.remainingMs : 0), countdownMs: timeLeft('countdown'), fighters: m.fighters, result: m.result },
      queue: s.queue, leaderboard: Object.values(s.records).filter(r => r.wins > 0 || r.coins > 0).sort((a, b) => b.wins - a.wins || b.kos - a.kos || b.coins - a.coins).slice(0, 20).map(({ seenAt, ...row }) => row),
      supporters: Object.values(s.supporters).sort((a, b) => b.coins - a.coins).slice(0, 10), stats: s.stats, settings,
      recent: s.recent,
    });
  }
  function suspendSession(s) {
    const players = SIDES.map(side => s.match.fighters[side]).filter(Boolean);
    const champion = s.match.result?.winner ? s.match.fighters[s.match.result.winner] : null;
    if (s.match.phase === 'finished') { if (champion && !s.queue.some(p => p.uid === champion.uid)) s.queue.unshift({ ...champion, coins: s.records[champion.uid]?.coins || 0, joinedAt: now() }); }
    else for (const p of players.reverse()) if (!s.queue.some(q => q.uid === p.uid)) s.queue.unshift({ uid: p.uid, name: p.name, avatar: p.avatar, coins: s.records[p.uid]?.coins || 0, joinedAt: now() });
    s.queue = s.queue.slice(0, 100); s.match = makeMatch(s.match.number);
  }
  function command(method, params = {}) {
    const s = current(), m = s.match;
    let result = { ok: true };
    if (method === 'settings.set') {
      const p = params.settings;
      if (!p || typeof p !== 'object' || Array.isArray(p)) error('Cần gửi đối tượng cài đặt.');
      settings = cleanSettings(p, settings);
      if (m.phase === 'waiting') for (const side of SIDES) if (m.fighters[side]) m.fighters[side] = fighter(m.fighters[side]);
      result = { ...settings, giftMap: { ...settings.giftMap } };
      emit('settings', { settings: clone(settings) });
    } else if (method === 'mode.set') {
      if (!['live', 'demo'].includes(params.mode)) error('Chế độ phải là LIVE hoặc mô phỏng.');
      if (params.mode === mode) return { ok: true, mode };
      suspendSession(sessions[mode]); mode = params.mode; transient = freshTransient(); lastTick = now();
      if (mode === 'demo') {
        sessions.demo = makeSession();
        addQueue({ uid: 'demo_red', name: 'HỔ ĐỎ', avatar: '' }, { announce: false });
        addQueue({ uid: 'demo_blue', name: 'SẤM XANH', avatar: '' }, { announce: false });
        addQueue({ uid: 'demo_next', name: 'BÃO ĐÊM', avatar: '' }, { announce: false });
        beginMatch();
      }
      emit('reset', { mode }); log('mode', mode === 'demo' ? 'Mô phỏng đang bật — dữ liệu tách biệt LIVE.' : 'Đã về LIVE — dữ liệu mô phỏng không được cộng vào bảng thật.');
      result = { ok: true, mode };
    } else if (method === 'queue.add') {
      const user = userOf(params); result = addQueue(user);
    } else if (method === 'queue.remove') {
      const uid = text(params.uid, 100); const index = s.queue.findIndex(p => p.uid === uid);
      if (index < 0) error('Không tìm thấy người này trong hàng chờ.');
      const [removed] = s.queue.splice(index, 1); emit('queue', { uid, name: removed.name, action: 'remove' }); log('queue', `Đã gỡ ${removed.name} khỏi hàng chờ.`);
    } else if (method === 'queue.clear') {
      s.queue = []; log('queue', 'Đã xóa hàng chờ.');
    } else if (method === 'match.start') result = beginMatch();
    else if (method === 'match.pause') {
      if (!['countdown', 'fighting'].includes(m.phase)) error('Chỉ tạm dừng khi trận đang diễn ra.');
      m.pausedPhase = m.phase; m.pausedAt = now();
      if (m.phase === 'countdown') m.countdownMs = Math.max(0, m.deadline - now()); else m.remainingMs = Math.max(0, m.deadline - now());
      m.phase = 'paused'; emit('match', { phase: 'paused' }); log('match', 'Trận đấu đang tạm dừng.');
    } else if (method === 'match.resume') {
      if (m.phase !== 'paused') error('Trận chưa được tạm dừng.');
      const pausedDuration = Math.max(0, now() - m.pausedAt);
      for (const defense of transient.defense.values()) defense.until += pausedDuration;
      for (const [uid, at] of transient.cooldowns) transient.cooldowns.set(uid, at + pausedDuration);
      for (const move of transient.attacks.values()) move.at += pausedDuration;
      m.pausedAt = 0;
      m.phase = m.pausedPhase || 'fighting'; m.deadline = now() + (m.phase === 'countdown' ? m.countdownMs : m.remainingMs); m.pausedPhase = ''; lastTick = now();
      emit('match', { phase: m.phase }); log('match', 'Trận đấu tiếp tục.');
    } else if (method === 'match.finish') result = finishMatch(params.winner ?? null, 'referee');
    else if (method === 'match.next') {
      if (!['finished', 'waiting'].includes(m.phase)) error('Hãy kết thúc trận hiện tại trước khi gọi người tiếp theo.');
      if (m.phase === 'finished') makeNewMatch({ keepWinner: true });
      else fillCorners();
      emit('reset', { mode });
      if (current().match.fighters.red && current().match.fighters.blue) result = beginMatch();
    } else if (method === 'match.reset') {
      const players = SIDES.map(side => m.fighters[side]).filter(Boolean);
      s.match = makeMatch(m.number); s.match.manualHold = true; clearCombat();
      for (let i = players.length - 1; i >= 0; i--) if (!s.queue.some(p => p.uid === players[i].uid)) s.queue.unshift({ ...players[i], joinedAt: now(), coins: s.records[players[i].uid]?.coins || 0 });
      // Explicit reset keeps paid seats but waits for manual start, avoiding an instant restart.
      log('match', 'Đã reset trận; hai võ sĩ trở về đầu hàng chờ.'); emit('reset', { mode });
    } else if (method === 'session.reset') {
      sessions[mode] = makeSession(); transient = freshTransient(); lastTick = now(); emit('reset', { mode }); log('session', 'Buổi mới đã bắt đầu: xóa trận, hàng chờ và bảng xếp hạng của chế độ hiện tại.');
    } else if (method === 'fighter.heal') {
      if (!['fighting', 'paused'].includes(m.phase)) error('Chỉ hồi máu trong trận.');
      const side = validSide(params.side), f = m.fighters[side];
      if (!f) error('Góc này chưa có võ sĩ.');
      const amount = int(params.amount, 1, settings.maxHp, 100), healed = Math.min(f.maxHp - f.hp, amount);
      f.hp += healed; emit('heal', { side, amount: healed, name: f.name }); result = { ok: true, healed };
    } else if (method === 'fighter.attack') {
      const side = validSide(params.side), move = params.move || 'jab';
      result = ['block', 'dodge'].includes(move) ? defend(side, move) : attack(side, move);
    } else error(`Lệnh chưa được hỗ trợ: ${text(method, 60)}`);
    changed(); return result;
  }
  function tick() {
    const time = now(), elapsed = clamp(time - lastTick, 0, 2000); lastTick = time;
    const s = current(), m = s.match;
    if (m.phase === 'countdown' && time >= m.deadline) {
      m.phase = 'fighting'; m.countdownMs = 0; m.deadline = time + m.remainingMs;
      emit('match', { phase: 'fighting', red: m.fighters.red?.name, blue: m.fighters.blue?.name, number: m.number }); log('match', 'TIẾNG CHUÔNG! Hai võ sĩ bắt đầu thi đấu.'); dirty = true;
    } else if (m.phase === 'fighting') {
      for (const side of SIDES) {
        const f = m.fighters[side]; if (!f) continue;
        f.stamina = Math.min(100, f.stamina + elapsed / 1000 * 12);
        const a = transient.attacks.get(f.uid);
        if (a && time - a.at > 3200) f.combo = 0;
      }
      if (time >= m.deadline) {
        const r = m.fighters.red, b = m.fighters.blue;
        const winner = r.hp / r.maxHp === b.hp / b.maxHp ? (r.damage === b.damage ? null : r.damage > b.damage ? 'red' : 'blue') : r.hp / r.maxHp > b.hp / b.maxHp ? 'red' : 'blue';
        finishMatch(winner, 'time');
      }
    } else if (m.phase === 'finished' && settings.autoNext && time >= m.nextAt) {
      makeNewMatch({ keepWinner: true });
      if (s.match.fighters.red && s.match.fighters.blue) beginMatch();
      else { emit('match', { phase: 'waiting' }); dirty = true; }
    } else if (m.phase === 'waiting' && settings.autoNext && !m.manualHold && (s.queue.length + SIDES.filter(side => !!m.fighters[side]).length >= 2)) {
      fillCorners(); beginMatch();
    }
    // Expire dedup and defense state in bounded memory even through long live sessions.
    for (const [key, at] of transient.gifts) if (time - at > 10 * 60_000) transient.gifts.delete(key);
    for (const [key, defense] of transient.defense) if (m.phase !== 'paused' && defense.until <= time) transient.defense.delete(key);
    const second = Math.floor(time / 1000);
    if (second !== lastSnapshotSecond) { lastSnapshotSecond = second; emit('clock', { now: time }); }
    if (dirty) save();
    return snapshot();
  }

  // Persisting a demonstration never makes its fighter names or wins real on restart.
  if (mode === 'demo') {
    mode = 'live';
  }
  return { snapshot, export: exportState, ingest, command, tick };
}
