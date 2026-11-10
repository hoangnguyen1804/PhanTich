// MC theo sự kiện, giọng Nam Minh, cache cục bộ và nhạc nền. Không có dịch vụ bản quyền.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const MUSIC_MAX = 50 * 1024 * 1024;
const MAX_SYNTH_BYTES = 2 * 1024 * 1024;
const MUSIC_EXT = /\.(mp3|m4a|ogg|wav|aac)$/i;
const VOICE = 'vi-VN-NamMinhNeural';
const cleanText = (value, max = 320) => String(value ?? '').normalize('NFKC').replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060-\u206f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const number = (value, fallback, low, high) => Number.isFinite(Number(value)) ? Math.max(low, Math.min(high, Number(value))) : fallback;
const escapeXml = text => text.replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));
const sample = list => list[Math.floor(Math.random() * list.length)];
const moveNames = { jab: 'đấm thẳng', hook: 'đấm móc', uppercut: 'móc ngược', kick: 'đá vòng', flurry: 'liên hoàn đấm', ultimate: 'tuyệt kỹ' };

export function cleanMusicName(raw) {
  const input = String(raw ?? '').normalize('NFC');
  if (!input || input.includes('/') || input.includes('\\') || input.includes('\0')) throw new Error('Tên bài nhạc không hợp lệ.');
  const name = input.replace(/[^\p{L}\p{N} ._()\-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 120);
  if (!name || name.startsWith('.') || !MUSIC_EXT.test(name)) throw new Error('Chỉ nhận nhạc MP3, M4A, OGG, WAV hoặc AAC.');
  return name;
}

function isAudio(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 128) return false;
  return buffer.toString('ascii', 0, 3) === 'ID3'
    || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)
    || buffer.toString('ascii', 0, 4) === 'OggS'
    || (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WAVE')
    || buffer.toString('ascii', 4, 8) === 'ftyp';
}

export function createAudio({ dataDir, musicDir, onEvent = () => {}, getSettings = () => ({}), offline = false, logger = () => {} } = {}) {
  if (!dataDir || !musicDir) throw new Error('Thiếu thư mục dữ liệu âm thanh.');
  const audioDir = path.join(dataDir, 'audio');
  fs.mkdirSync(audioDir, { recursive: true });
  fs.mkdirSync(musicDir, { recursive: true });
  let closed = false, busy = false, queue = [], current = null, currentTts = null;
  let nextSequence = 0, cancelPlayback = null, cancelSynthesis = null, latestError = '', lastHitAt = 0, lastQueueAt = 0, lastInviteAt = 0, lastDefenseAt = 0, musicFiles = [], musicSignature = '';
  let lastMatchKey = '', synthUnavailableUntil = 0, synthesized = 0;
  const settings = () => {
    const s = getSettings() || {};
    return { enabled: s.mcEnabled !== false, volume: number(s.mcVolume, 80, 0, 100), rate: number(s.mcRate, 15, -40, 60), idle: number(s.mcIdleSeconds, 35, 15, 300), musicEnabled: !!s.musicEnabled, musicVolume: number(s.musicVolume, 25, 0, 100) };
  };
  const emit = event => { if (!closed) { try { onEvent({ ...event, source: 'mc' }); } catch (error) { logger('Không gửi được sự kiện âm thanh: ' + cleanText(error.message)); } } };

  function pruneCache() {
    try {
      const files = fs.readdirSync(audioDir).filter(name => /^[a-f0-9]{32}\.mp3$/.test(name)).map(name => ({ name, ...fs.statSync(path.join(audioDir, name)) })).sort((a, b) => b.mtimeMs - a.mtimeMs);
      let bytes = 0;
      for (let i = 0; i < files.length; i++) {
        bytes += files[i].size;
        if (i >= 240 || bytes > 40 * 1024 * 1024) fs.rmSync(path.join(audioDir, files[i].name), { force: true });
      }
    } catch { /* cache is expendable */ }
  }
  pruneCache();

  function scanMusic(notify = true) {
    let list = [];
    try {
      list = fs.readdirSync(musicDir).filter(name => !name.startsWith('.') && MUSIC_EXT.test(name)).slice(0, 500).flatMap(name => {
        try {
          const stat = fs.lstatSync(path.join(musicDir, name));
          return stat.isFile() ? [{ name, url: '/music/' + encodeURIComponent(name), size: stat.size }] : [];
        } catch { return []; }
      }).sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    } catch { /* folder can be temporarily unavailable */ }
    const signature = list.map(file => `${file.name}:${file.size}`).join('|');
    const changed = signature !== musicSignature;
    musicSignature = signature; musicFiles = list;
    if (changed && notify) emit({ type: 'music', ...music() });
    return list;
  }
  function music() {
    const s = settings();
    return { files: musicFiles.map(file => ({ ...file })), enabled: s.musicEnabled, volume: s.musicVolume };
  }
  scanMusic(false);
  const musicTimer = setInterval(() => scanMusic(), 15_000);
  musicTimer.unref?.();

  function saveMusic(rawName, buffer) {
    if (closed) throw new Error('Kênh âm thanh đã đóng.');
    let name = cleanMusicName(rawName);
    if (!Buffer.isBuffer(buffer) || buffer.length > MUSIC_MAX) throw new Error('Mỗi bài nhạc tối đa 50 MB.');
    if (!isAudio(buffer)) throw new Error('Nội dung tệp không phải âm thanh hợp lệ.');
    // Keep an existing song when the user uploads another file with the same name.
    const ext = path.extname(name), stem = name.slice(0, -ext.length);
    let index = 2;
    while (fs.existsSync(path.join(musicDir, name))) {
      if (index > 1000) throw new Error('Có quá nhiều bài trùng tên. Hãy đổi tên bài nhạc.');
      name = `${stem} (${index++})${ext}`;
    }
    const temporary = path.join(musicDir, '.upload-' + crypto.randomUUID());
    try {
      fs.writeFileSync(temporary, buffer, { flag: 'wx' });
      fs.renameSync(temporary, path.join(musicDir, name));
    } finally { try { fs.rmSync(temporary, { force: true }); } catch {} }
    scanMusic(); logger('Đã thêm nhạc: ' + name);
    return { name, size: buffer.length, ...music() };
  }
  function deleteMusic(rawName) {
    const name = cleanMusicName(rawName);
    if (name !== rawName) throw new Error('Tên bài nhạc không hợp lệ.');
    const full = path.join(musicDir, name);
    const stat = fs.lstatSync(full, { throwIfNoEntry: false });
    if (!stat?.isFile()) throw new Error('Không tìm thấy bài nhạc.');
    fs.unlinkSync(full); scanMusic(); logger('Đã xóa nhạc: ' + name);
    return { ok: true, ...music() };
  }

  async function synthesize(text, rate) {
    const file = crypto.createHash('sha256').update(`${VOICE}|${rate}|${text}`).digest('hex').slice(0, 32) + '.mp3';
    const full = path.join(audioDir, file);
    try {
      const stat = fs.lstatSync(full);
      if (stat.isFile() && stat.size >= 1024 && stat.size <= MAX_SYNTH_BYTES) return { url: '/audio/' + file, bytes: stat.size, cached: true };
    } catch { /* cache miss */ }
    if (offline || Date.now() < synthUnavailableUntil || closed) return { url: '', bytes: 0, fallback: true };
    let timer, voice, expired = false;
    try {
      const job = (async () => {
        const { MsEdgeTTS, OUTPUT_FORMAT } = await import('msedge-tts');
        if (closed) throw new Error('Kênh âm thanh đã đóng.');
        voice = new MsEdgeTTS({ connectionTimeoutMs: 3000, synthesisTimeoutMs: 4000 });
        currentTts = voice;
        await voice.setMetadata(VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
        if (closed) throw new Error('Kênh âm thanh đã đóng.');
        const { audioStream } = voice.toStream(escapeXml(text), { rate: `${rate >= 0 ? '+' : ''}${rate}%`, volume: '+0%', pitch: '+0Hz' });
        const chunks = []; let size = 0;
        await new Promise((resolve, reject) => {
          audioStream.on('data', chunk => {
            size += chunk.length;
            if (size > MAX_SYNTH_BYTES) { reject(new Error('Giọng đọc vượt giới hạn dung lượng.')); voice.close(); return; }
            chunks.push(chunk);
          });
          audioStream.once('end', resolve);
          audioStream.once('close', resolve);
          audioStream.once('error', reject);
        });
        const buffer = Buffer.concat(chunks);
        if (buffer.length < 1024) throw new Error('Dịch vụ chưa trả âm thanh.');
        if (closed || expired) throw new Error('Đã bỏ câu đọc cũ.');
        const temporary = full + '.' + crypto.randomUUID() + '.tmp';
        try { fs.writeFileSync(temporary, buffer); fs.renameSync(temporary, full); }
        finally { try { fs.rmSync(temporary, { force: true }); } catch {} }
        if (++synthesized % 12 === 0) pruneCache();
        latestError = '';
        return { url: '/audio/' + file, bytes: buffer.length, cached: false };
      })();
      // One synthesis at a time. Timeout also closes the underlying socket in finally.
      return await Promise.race([job, new Promise((_, reject) => {
        timer = setTimeout(() => { expired = true; reject(new Error('Dịch vụ giọng đọc phản hồi chậm.')); }, 7500);
        cancelSynthesis = () => { expired = true; reject(Object.assign(new Error('Đã bỏ câu đọc cũ.'), { cancelled: true })); };
      })]);
    } catch (error) {
      if (error?.cancelled) return { url: '', bytes: 0, fallback: true };
      latestError = cleanText(error?.message || 'Dịch vụ giọng đọc chưa sẵn sàng.', 120);
      synthUnavailableUntil = Date.now() + 30_000;
      logger('MC dùng giọng trình duyệt/chữ trong 30 giây vì giọng Microsoft chưa sẵn sàng.');
      return { url: '', bytes: 0, fallback: true };
    } finally {
      clearTimeout(timer);
      cancelSynthesis = null;
      try { voice?.close(); } catch {}
      if (currentTts === voice) currentTts = null;
    }
  }

  function interrupt() {
    if (!current) return;
    current.cancelled = true;
    cancelSynthesis?.();
    try { currentTts?.close(); } catch {}
    emit({ type: 'ttsStop' });
    cancelPlayback?.();
  }
  function enqueue(text, { priority = 10, tag = 'commentary', manual = false } = {}) {
    text = cleanText(text);
    if (!text || closed) return { queued: false };
    if (!manual && !settings().enabled) return { queued: false, reason: 'disabled' };
    const now = Date.now();
    queue = queue.filter(item => now - item.at < (item.priority >= 80 ? 30_000 : 10_000));
    if (priority < 30 && (queue.length > 1 || busy && current?.priority >= 50)) return { queued: false, reason: 'busy' };
    if (priority >= 80) queue = queue.filter(item => item.priority >= 80);
    while (queue.length >= 6) {
      const lowest = queue.findLastIndex(item => item.priority < priority);
      if (lowest < 0) return { queued: false, reason: 'busy' };
      queue.splice(lowest, 1);
    }
    const item = { text, priority, tag, manual, at: now, id: ++nextSequence, cancelled: false };
    const position = queue.findIndex(other => other.priority < priority);
    if (position < 0) queue.push(item); else queue.splice(position, 0, item);
    if (priority >= 90 && current && current.priority < priority) interrupt();
    void pump();
    return { queued: true, text, id: item.id };
  }
  async function pump() {
    if (busy || closed || !queue.length) return;
    busy = true;
    try {
      while (!closed && queue.length) {
        const item = queue.shift();
        if (!item.manual && !settings().enabled) continue;
        if (Date.now() - item.at > (item.priority >= 80 ? 30_000 : 10_000)) continue;
        current = item;
        const s = settings();
        const result = await synthesize(item.text, s.rate);
        if (closed || item.cancelled) continue;
        const durationMs = Math.round(Math.max(1500, Math.min(15000, result.bytes ? result.bytes / 12 : item.text.length / (14 * (1 + s.rate / 100)) * 1000)));
        emit({ type: 'announcement', text: item.text, priority: item.priority, tag: item.tag });
        emit({ type: 'tts', url: result.url, text: item.text, priority: item.priority, tag: item.tag, volume: s.volume, rate: s.rate, durationMs, fallback: !!result.fallback });
        await new Promise(resolve => {
          const timer = setTimeout(resolve, durationMs + 180);
          cancelPlayback = () => { clearTimeout(timer); resolve(); };
          timer.unref?.();
        });
        cancelPlayback = null;
      }
    } catch (error) { logger('MC: ' + cleanText(error?.message || 'Không đọc được câu này.')); }
    finally { busy = false; current = null; if (!closed && queue.length) void pump(); }
  }

  function say(text) { return enqueue(text, { priority: 100, tag: 'manual', manual: true }); }
  function announce(event, state) {
    if (closed || !event || event.source === 'mc') return;
    // A new session or mode must never inherit old fight commentary.
    if (['reset', 'mode'].includes(event.type) || ['session.reset', 'match.reset', 'mode.set'].includes(event.action)) {
      queue = []; interrupt(); lastHitAt = 0; lastQueueAt = 0; lastDefenseAt = 0; lastMatchKey = ''; return;
    }
    if (!settings().enabled) return;
    const at = Date.now(), match = state?.match || {};
    const attacker = cleanText(event.attacker || match.fighters?.[event.side]?.name || 'Võ sĩ', 40);
    const defender = cleanText(event.defender || match.fighters?.[event.target]?.name || 'đối thủ', 40);
    const name = cleanText(event.name || event.winnerName || 'Võ sĩ', 40);
    if (event.type === 'ko') {
      const winner = cleanText(event.name || match.fighters?.[event.winner]?.name || '', 40);
      const text = event.winner ? `${winner || 'Võ sĩ'} chiến thắng! Một pha kết thúc bùng nổ trên Võ Đài LIVE. Ai sẽ là người thách đấu tiếp theo?` : 'Trận đấu khép lại với kết quả hòa! Cả hai võ sĩ đã cống hiến một trận đấu tuyệt vời.';
      enqueue(text, { priority: 95, tag: 'ko' }); return;
    }
    if (event.type === 'match') {
      const key = `${match.id || ''}:${event.phase}`;
      if (key === lastMatchKey) return;
      lastMatchKey = key;
      if (event.phase === 'countdown') {
        const red = cleanText(match.fighters?.red?.name || 'góc đỏ', 40), blue = cleanText(match.fighters?.blue?.name || 'góc xanh', 40);
        enqueue(`${red} đối đầu ${blue}. Hai góc đã sẵn sàng! Bình luận đấm, móc, đá, đỡ hoặc né để ra chiêu.`, { priority: 75, tag: 'start' });
      } else if (event.phase === 'fighting') enqueue('Chuông đã vang! Trận đấu bắt đầu!', { priority: 80, tag: 'bell' });
      return;
    }
    if (event.type === 'hit' && at - lastHitAt > 4000) {
      lastHitAt = at;
      let text;
      if (event.dodged) text = `${defender} né đòn rất kịp thời! ${attacker} cần chọn thời điểm tốt hơn.`;
      else if (event.blocked) text = `${defender} đỡ được đòn của ${attacker}. Phòng thủ chắc chắn!`;
      else if (event.move === 'ultimate' || event.move === 'flurry') text = `${attacker} tung ${moveNames[event.move]}! ${Number(event.hits) > 1 ? `${Math.min(20, Number(event.hits))} cú đánh dồn dập, ` : ''}${defender} mất ${Math.max(0, Math.round(Number(event.damage) || 0))} máu!`;
      else text = sample([
        `${attacker} tung ${moveNames[event.move] || 'cú đấm'} trúng đích! ${Math.max(0, Math.round(Number(event.damage) || 0))} sát thương cho ${defender}.`,
        `${event.critical ? 'Chí mạng! ' : ''}${attacker} áp sát với một cú ${moveNames[event.move] || 'đấm'} đầy uy lực!`,
        `${defender} đang chịu sức ép. ${attacker} nối nhịp tấn công rất tốt!`,
      ]);
      const target = match.fighters?.[event.target];
      if (!event.dodged && target?.hp > 0 && target.hp / target.maxHp < 0.25) text += ` ${defender} đang rất ít máu!`;
      enqueue(text, { priority: event.gift ? 55 : 20, tag: 'hit' });
    } else if (event.type === 'gift') {
      const coins = Math.max(0, Math.round(Number(event.coins) || 0));
      if (!coins) return;
      const corner = event.side === 'red' ? 'góc đỏ' : event.side === 'blue' ? 'góc xanh' : '';
      enqueue(`Cảm ơn ${name} tặng ${coins} xu! ${corner ? `${corner} nhận thêm sức mạnh${event.move ? ` cho đòn ${moveNames[event.move] || 'đặc biệt'}` : ''}!` : 'Võ đài đang chờ màn xuất hiện của bạn!'}`, { priority: 60, tag: 'gift' });
    } else if (event.type === 'queue' && event.action !== 'remove' && at - lastQueueAt > 6000) {
      lastQueueAt = at;
      enqueue(`${name} đã vào hàng chờ thách đấu. Ai sẽ giữ được ngôi vương trên võ đài?`, { priority: 35, tag: 'queue' });
    } else if (event.type === 'defend' && at - lastDefenseAt > 12000) {
      lastDefenseAt = at;
      enqueue(`${attacker} ${event.move === 'dodge' ? 'di chuyển né đòn' : 'dựng găng phòng thủ'}. Giữ thể lực để phản công!`, { priority: 15, tag: 'defend' });
    } else if (event.type === 'announcement' && event.text) {
      enqueue(event.text, { priority: number(event.priority, 30, 1, 85), tag: 'arena' });
    }
    if (match.phase === 'fighting' && at - lastInviteAt > settings().idle * 1000 && !busy && queue.length === 0) {
      lastInviteAt = at;
      const entry = Math.max(0, Math.round(Number(state?.settings?.entryCoins) || 0));
      enqueue(sample([
        'Cổ vũ góc đỏ hay góc xanh? Bình luận chọn góc, rồi tặng quà để kích hoạt combo theo bảng quà trên màn hình!',
        entry ? `Muốn trực tiếp so găng? Tặng đủ ${entry} xu để vào hàng chờ thách đấu. Luật quà được hiển thị công khai ở bảng điều khiển.` : 'Muốn lên đài? Bình luận lên đài để tham gia hàng chờ. Hãy so tài phản xạ với các đối thủ!',
        'Đòn mạnh cần đúng thời điểm! Theo dõi thanh năng lượng, bình luận ra chiêu và cổ vũ cho võ sĩ bạn yêu thích!',
      ]), { priority: 5, tag: 'invite' });
    }
  }
  function close() {
    if (closed) return;
    queue = [];
    interrupt();
    closed = true;
    clearInterval(musicTimer);
    cancelPlayback?.();
    try { currentTts?.close(); } catch {}
  }
  return { announce, say, music, saveMusic, deleteMusic, close,
    status: () => ({ enabled: settings().enabled, voice: VOICE, offline, busy, queued: queue.length, fallback: offline || Date.now() < synthUnavailableUntil, error: latestError }),
    scanMusic,
  };
}
