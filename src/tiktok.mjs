// TikTok LIVE adapter. It never unlocks product features or contacts a licensing server.
// Only a user-requested connection imports the remote connector.
import crypto from 'node:crypto';

const MAX_COUNT = 10_000;
const MAX_UNIT_COINS = 1_000_000;
const bounded = (n, min, max, fallback = min) => Number.isFinite(Number(n)) ? Math.min(max, Math.max(min, Math.floor(Number(n)))) : fallback;
const clean = (s, max = 100) => String(s ?? '').normalize('NFKC').replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060-\u206f]/g, '').trim().slice(0, max);
const meaningful = v => v !== undefined && v !== null && String(v) !== '' && String(v) !== '0';
const first = (...values) => values.find(meaningful);
const picture = v => {
  const s = clean(v, 600);
  try { const u = new URL(s); return u.protocol === 'https:' ? u.href : ''; } catch { return ''; }
};

export function normalizeTikTokUser(data = {}) {
  const u = data.user || {};
  const id = first(u.userId, u.idStr, u.id, data.userId, u.uniqueId, u.displayId, data.uniqueId, u.nickname, data.nickname);
  if (!id) return null;
  const name = clean(first(u.nickname, data.nickname, u.uniqueId, u.displayId, data.uniqueId, 'Võ sĩ'), 40) || 'Võ sĩ';
  const avatar = picture(first(u.profilePictureUrl, data.profilePictureUrl, u.avatarThumb?.urlList?.[0], u.avatarThumb?.url?.[0], u.avatarMedium?.urlList?.[0], u.avatarLarge?.urlList?.[0], u.profilePicture?.urls?.[0], data.userDetails?.profilePictureUrls?.[0]));
  return { uid: 'tt:' + clean(id, 100), name, avatar };
}

const messageId = d => clean(first(d?.common?.msgId, d?.msgId, d?.eventId, d?.messageId, ''), 120);
const uniqueIdOf = value => {
  const valueString = String(value ?? '').trim();
  let uid = valueString;
  if (/^https?:\/\//i.test(uid)) {
    let u; try { u = new URL(uid); } catch { throw new Error('Đường dẫn TikTok không hợp lệ.'); }
    if (!/^(?:www\.)?tiktok\.com$/i.test(u.hostname)) throw new Error('Chỉ nhận tên kênh hoặc đường dẫn tiktok.com/@tenkenh.');
    uid = u.pathname.replace(/^\/@/, '').split('/')[0];
  }
  uid = uid.replace(/^@/, '').trim();
  if (!/^[A-Za-z0-9_.]{1,40}$/.test(uid)) throw new Error('Nhập đúng tên kênh TikTok, không có khoảng trắng (ví dụ @tenkenh).');
  return uid;
};

/**
 * Groups streak gifts by TikTok's group ID. Charges only the additional count,
 * so a late repeatEnd after the timeout cannot charge the same gift twice.
 * Injectable clock/timers allow local protocol tests without a TikTok account.
 */
export function createGiftAggregator({ emit, findGift = () => null, logger = () => {}, now = Date.now, setTimer = setTimeout, clearTimer = clearTimeout, graceMs = 8_000 } = {}) {
  const groups = new Map();
  const seen = new Map();
  let closed = false;
  let sequence = 0;
  const trim = () => {
    const at = now();
    for (const [id, until] of seen) if (until < at) seen.delete(id);
    for (const [key, entry] of groups) if (!entry.timer && at - entry.updated > 120_000) groups.delete(key);
    while (seen.size > 5_000) seen.delete(seen.keys().next().value);
    while (groups.size > 2_000) {
      const key = groups.keys().next().value;
      clearTimer(groups.get(key).timer); groups.delete(key);
    }
  };
  function finish(entry, reason) {
    clearTimer(entry.timer); entry.timer = null;
    if (closed) return;
    entry.completedBy = reason;
    const additional = Math.max(0, entry.count - entry.charged);
    if (!additional) return;
    const before = entry.charged;
    entry.charged = entry.count;
    entry.updated = now();
    const coins = Math.min(100_000_000, additional * entry.unitCoins);
    if (coins <= 0) {
      logger(`Chưa biết giá quà ${entry.giftName}. Chưa tính xu; cập nhật danh sách quà để nhận đúng giá.`);
      return;
    }
    emit?.('gift', {
      ...entry.user, count: additional, coins,
      giftId: entry.giftId, giftName: entry.giftName,
      eventId: `tt-gift:${entry.key}:${before}-${entry.charged}`,
      completion: reason,
    });
  }
  function ingest(d = {}) {
    if (closed) return;
    trim();
    const user = normalizeTikTokUser(d);
    if (!user) return;
    const mid = messageId(d);
    if (mid) {
      if (seen.has(mid)) return;
      seen.set(mid, now() + 120_000);
    }
    const giftId = clean(first(d.giftId, d.gift?.id, d.gift?.gift_id, d.giftDetails?.id, ''), 40);
    let catalog = null;
    try { catalog = findGift(giftId, first(d.giftName, d.giftDetails?.name, d.extendedGiftInfo?.name, d.gift?.name, '')); } catch { /* fallback to packet */ }
    const giftName = clean(first(catalog?.name, d.giftName, d.giftDetails?.name, d.extendedGiftInfo?.name, d.gift?.name, giftId ? `Quà #${giftId}` : 'Quà TikTok'), 60);
    const unitCoins = bounded(first(d.diamondCount, d.giftDetails?.diamondCount, d.extendedGiftInfo?.diamond_count, d.gift?.diamondCount, d.gift?.diamond_count, catalog?.coins, 0), 0, MAX_UNIT_COINS, 0);
    const count = bounded(first(d.repeatCount, d.comboCount, d.gift?.repeat_count, 1), 1, MAX_COUNT);
    const isEnd = [true, 1, '1'].includes(d.repeatEnd) || [true, 1, '1'].includes(d.repeat_end) || [true, 1, '1'].includes(d.gift?.repeat_end);
    const giftType = Number(first(d.giftType, d.giftDetails?.giftType, d.extendedGiftInfo?.gift_type, d.gift?.gift_type, 0));
    const groupId = clean(first(d.groupId, d.giftGroupId, d.giftExtra?.groupId, ''), 120);
    const pair = `${user.uid}:${giftId || giftName}`;
    // Non-streak gifts have a unique packet ID and should land immediately.
    if (giftType !== 1) {
      const key = `${pair}:single:${mid || `${now()}:${++sequence}`}`;
      const entry = { key, user, giftId, giftName, unitCoins, count, charged: 0, updated: now(), timer: null };
      finish(entry, 'single');
      return;
    }
    let key = groupId ? `${pair}:group:${groupId}` : `${pair}:fallback`;
    let entry = groups.get(key);
    // When no group ID is supplied a new explicit streak start (count=1)
    // after a completed run gets a fresh generation. End-only packets within
    // the grace period remain deduped, preferring under-count to double billing.
    if (entry && !groupId && entry.charged > 0 && ((isEnd && entry.completedBy === 'end') || (!isEnd && count === 1 && (entry.completedBy === 'end' || now() - entry.updated > 1_000)))) {
      clearTimer(entry.timer); groups.delete(key); entry = null;
    }
    if (!entry) {
      entry = { key: `${key}:${crypto.randomBytes(4).toString('hex')}`, user, giftId, giftName, unitCoins, count, charged: 0, updated: now(), timer: null };
      groups.set(key, entry);
    }
    entry.user = user; entry.giftName = giftName;
    if (unitCoins > 0) entry.unitCoins = unitCoins;
    entry.count = Math.max(entry.count, count);
    entry.updated = now();
    clearTimer(entry.timer); entry.timer = null;
    if (isEnd || giftType !== 1) finish(entry, 'end');
    else {
      entry.timer = setTimer(() => finish(entry, 'timeout'), graceMs);
      entry.timer?.unref?.();
    }
  }
  return {
    ingest,
    close() {
      closed = true;
      for (const entry of groups.values()) clearTimer(entry.timer);
      groups.clear(); seen.clear();
    },
  };
}

/**
 * Generation-based lifecycle: a late connect or packet from a cancelled room
 * cannot mutate a newly selected room. Optional API key belongs to the external
 * signing provider, never to this app's product licensing.
 */
export function createTikTok({ onEvent = () => {}, onStatus = () => {}, getSignKey = () => '', findGift = () => null, offline = false, logger = () => {}, loadConnector = () => import('tiktok-live-connector') } = {}) {
  let generation = 0;
  let connection = null;
  let room = '';
  let wanted = false;
  let retryTimer = null;
  let aggregator = null;
  let controller = null;
  let reconnectFailures = 0;
  let attemptSequence = 0;
  let state = { status: 'idle', uniqueId: '', error: '', hasSignKey: false };
  const seenMessages = new Map();
  const safeKey = () => { try { return clean(getSignKey(), 300); } catch { return ''; } };
  const current = gen => wanted && gen === generation;
  const status = () => ({ ...state, hasSignKey: !!safeKey() });
  function update(changes) {
    state = { ...state, ...changes, hasSignKey: !!safeKey() };
    onStatus(status());
  }
  function errorText(error) {
    const key = safeKey();
    let text = clean(error?.message || error?.info || error || 'Không kết nối được TikTok.', 500);
    if (key) text = text.split(key).join('[ẩn key]');
    text = text.replace(/([?&](?:api_?key|token|signature)=)[^&\s]+/gi, '$1[ẩn]').replace(/(?:Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, 'Bearer [ẩn]');
    return text;
  }
  async function retire(c) {
    if (!c) return;
    try {
      await Promise.race([Promise.resolve(c.disconnect?.()).catch(() => {}), new Promise(resolve => {
        const t = setTimeout(resolve, 2_000); t.unref?.();
      })]);
    } catch { /* disconnect is best effort */ }
    c.removeAllListeners?.();
    c.on?.('error', () => {}); // ignore late shutdown errors from an already retired transport
  }
  function stopPending() {
    clearTimeout(retryTimer); retryTimer = null;
    controller?.abort(); controller = null;
    aggregator?.close(); aggregator = null;
    seenMessages.clear();
  }
  function schedule(gen, delay, message) {
    if (!current(gen)) return;
    clearTimeout(retryTimer);
    update({ status: 'reconnecting', error: message });
    retryTimer = setTimeout(() => {
      retryTimer = null;
      if (current(gen)) void attempt(gen);
    }, delay);
    retryTimer.unref?.();
  }
  function packet(gen, kind, d) {
    if (!current(gen) || state.status !== 'connected') return;
    const user = normalizeTikTokUser(d);
    if (!user) return;
    const id = messageId(d);
    if (id) {
      const at = Date.now();
      if (seenMessages.has(`${kind}:${id}`)) return;
      seenMessages.set(`${kind}:${id}`, at);
      if (seenMessages.size > 3_000) {
        for (const [k, t] of seenMessages) if (at - t > 120_000) seenMessages.delete(k);
        while (seenMessages.size > 3_000) seenMessages.delete(seenMessages.keys().next().value);
      }
    }
    if (kind === 'chat') onEvent('chat', { ...user, text: clean(first(d.comment, d.content, d.text, ''), 300), eventId: id ? `tt-chat:${id}` : '' });
    else if (kind === 'like') onEvent('like', { ...user, count: bounded(first(d.likeCount, d.count, 1), 1, 10_000), eventId: id ? `tt-like:${id}` : '' });
    else onEvent('join', { ...user, eventId: id ? `tt-join:${id}` : '' });
  }
  async function attempt(gen) {
    if (!current(gen)) return status();
    const run = ++attemptSequence;
    let disposed = false;
    const activeAttempt = () => !disposed && current(gen) && run === attemptSequence;
    controller?.abort(); controller = null;
    aggregator?.close();
    const previous = connection; connection = null;
    await retire(previous);
    if (!activeAttempt()) return status();
    update({ status: 'connecting', uniqueId: room, error: '' });
    controller = new AbortController();
    const attemptAbort = controller;
    let c, gift;
    try {
      const lib = await loadConnector();
      if (!activeAttempt()) return status();
      const key = safeKey();
      if (lib.SignConfig) {
        lib.SignConfig.apiKey = key || undefined;
        if (lib.SignConfig.baseOptions?.headers) delete lib.SignConfig.baseOptions.headers['X-Api-Key'];
        lib.SignConfig.cachedInstance = undefined;
      }
      c = new lib.TikTokLiveConnection(room, {
        enableExtendedGiftInfo: false,
        processInitialData: false,
        ...(key ? { signApiKey: key } : {}),
        webClientOptions: { timeout: { request: 20_000 }, retry: { limit: 0 } },
      });
      connection = c;
      gift = createGiftAggregator({ emit: (kind, payload) => { if (activeAttempt() && connection === c && state.status === 'connected') onEvent(kind, payload); }, findGift, logger });
      aggregator = gift;
      const webcast = lib.WebcastEvent || {};
      const control = lib.ControlEvent || {};
      c.on(webcast.CHAT || 'chat', d => { if (activeAttempt() && connection === c) packet(gen, 'chat', d); });
      c.on(webcast.MEMBER || 'member', d => { if (activeAttempt() && connection === c) packet(gen, 'join', d); });
      c.on(webcast.LIKE || 'like', d => { if (activeAttempt() && connection === c) packet(gen, 'like', d); });
      c.on(webcast.GIFT || 'gift', d => { if (activeAttempt() && connection === c && state.status === 'connected') gift.ingest(d); });
      c.on(control.ERROR || 'error', e => {
        if (!activeAttempt()) return;
        logger('TikTok: ' + errorText(e));
      });
      c.on(webcast.STREAM_END || 'streamEnd', () => {
        if (!activeAttempt() || connection !== c) return;
        wanted = false; stopPending(); connection = null;
        update({ status: 'idle', error: 'Buổi LIVE đã kết thúc.' });
        void retire(c);
      });
      c.on(control.DISCONNECTED || 'disconnected', () => {
        if (!activeAttempt() || connection !== c) return;
        gift.close(); disposed = true;
        if (controller === attemptAbort) { controller = null; attemptAbort.abort(); }
        connection = null; void retire(c);
        reconnectFailures++;
        schedule(gen, Math.min(60_000, 5_000 * reconnectFailures), 'Mất kết nối LIVE. Đang đợi để kết nối lại…');
      });
      let timer, abort;
      try {
        await new Promise((resolve, reject) => {
          timer = setTimeout(() => reject(new Error('TikTok không trả lời sau 30 giây. Kiểm tra tên kênh và trạng thái LIVE.')), 30_000);
          abort = () => reject(new Error('Đã hủy kết nối.'));
          attemptAbort.signal.addEventListener('abort', abort, { once: true });
          Promise.resolve(c.connect()).then(resolve, reject);
        });
      } finally { clearTimeout(timer); attemptAbort.signal.removeEventListener('abort', abort); }
      if (!activeAttempt() || connection !== c) { await retire(c); return status(); }
      clearTimeout(retryTimer); retryTimer = null;
      reconnectFailures = 0;
      update({ status: 'connected', uniqueId: room, error: '' });
      logger(`Đã kết nối TikTok @${room}.`);
    } catch (e) {
      if (connection === c) connection = null;
      gift?.close();
      await retire(c);
      if (!activeAttempt()) return status();
      const raw = errorText(e);
      const badKey = /401|api.?key.{0,30}(?:invalid|denied|unauthor)|invalid.{0,20}api.?key/i.test(raw);
      const limited = /429|rate.?limit|too many/i.test(raw);
      const notLive = /not.{0,10}live|offline|live.{0,12}(?:ended|not found)|room.{0,12}not found/i.test(raw);
      let message = raw;
      if (badKey) message = 'Dịch vụ ký từ chối API key tùy chọn. Kiểm tra key EulerStream hoặc xóa key rồi thử lại.';
      else if (limited) message = 'TikTok/dịch vụ ký đang giới hạn lượt kết nối. Tự thử lại sau 5 phút; không cần key bản quyền ứng dụng.';
      else if (notLive) message = 'Kênh chưa LIVE hoặc không tìm thấy phòng. Bắt đầu LIVE trên TikTok trước rồi thử lại.';
      logger('Kết nối TikTok: ' + message);
      reconnectFailures++;
      if (badKey) {
        wanted = false;
        update({ status: 'error', error: message });
      } else schedule(gen, limited ? 300_000 : notLive ? 30_000 : Math.min(60_000, 8_000 * reconnectFailures), message);
    }
    return status();
  }
  return {
    status,
    async connect(value) {
      const nextRoom = uniqueIdOf(value);
      if (offline) {
        update({ status: 'error', uniqueId: nextRoom, error: 'Đang chạy chế độ kiểm tra offline. Tắt ARENA_OFFLINE rồi mở lại để kết nối TikTok thật.' });
        throw new Error(state.error);
      }
      if (wanted && nextRoom === room && ['connected', 'connecting'].includes(state.status)) return status();
      wanted = false; generation++;
      const gen = generation;
      stopPending();
      const c = connection; connection = null; await retire(c);
      if (gen !== generation) return status();
      room = nextRoom; wanted = true;
      reconnectFailures = 0;
      return attempt(gen);
    },
    async disconnect() {
      wanted = false; generation++; stopPending();
      const c = connection; connection = null;
      update({ status: 'idle', uniqueId: '', error: '' });
      await retire(c);
      return status();
    },
  };
}
