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
const moveNames = { jab: 'đấm thẳng', hook: 'đấm móc', uppercut: 'móc ngược', kick: 'đá vòng', flurry: 'liên hoàn đấm', ultimate: 'tuyệt kỹ bão quyền', heal: 'hồi máu', boost: 'tăng sức mạnh', shield: 'lá chắn phòng thủ' };
const cornerName = side => side === 'red' ? 'Góc đỏ' : side === 'blue' ? 'Góc xanh' : 'Võ sĩ';

// Follow inherited HTTP proxy settings without exposing proxy credentials in logs.
// NO_PROXY is evaluated only for the fixed Microsoft destination, never user input.
export function resolveSpeechProxy(env = process.env) {
  const hostname = 'speech.platform.bing.com', port = '443';
  const bypass = String(env.no_proxy || env.NO_PROXY || '').split(/[\s,]+/).filter(Boolean).some(raw => {
    const entry = raw.trim().toLowerCase();
    if (entry === '*') return true;
    const match = /^(.*?)(?::(\d+))?$/.exec(entry);
    if (!match || (match[2] && match[2] !== port)) return false;
    let host = match[1];
    if (host.startsWith('*.')) host = host.slice(1);
    if (host.startsWith('.')) return hostname === host.slice(1) || hostname.endsWith(host);
    return hostname === host || hostname.endsWith('.' + host);
  });
  if (bypass) return '';
  const proxy = String(env.https_proxy || env.HTTPS_PROXY || env.http_proxy || env.HTTP_PROXY || '').trim();
  if (!proxy) return '';
  try { const url = new URL(proxy); if (!['http:', 'https:'].includes(url.protocol)) throw new Error(); }
  catch { throw new Error('Cấu hình proxy HTTPS chưa hợp lệ; dùng proxy HTTP hoặc HTTPS để kết nối giọng tiếng Việt.'); }
  return proxy;
}

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
  let lastMatchKey = '', synthUnavailableUntil = 0, synthesized = 0, lastBigAt = 0, lastSpecialAt = 0, lastSynthesisAt = 0;
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
    lastSynthesisAt = Date.now();
    let timer, voice, proxyAgent, expired = false;
    try {
      const job = (async () => {
        const { MsEdgeTTS, OUTPUT_FORMAT } = await import('msedge-tts');
        if (closed) throw new Error('Kênh âm thanh đã đóng.');
        const proxyUrl = resolveSpeechProxy();
        if (proxyUrl) {
          const module = await import('https-proxy-agent');
          const Agent = module.HttpsProxyAgent || module.default?.HttpsProxyAgent || module.default;
          proxyAgent = new Agent(proxyUrl);
        }
        if (closed || expired) throw new Error('Đã bỏ câu đọc cũ.');
        voice = new MsEdgeTTS({ connectionTimeoutMs: 3000, synthesisTimeoutMs: 4000, agent: proxyAgent });
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
      latestError = 'Chưa kết nối được giọng Nam Minh tiếng Việt. Chỉ dùng giọng dự phòng nếu máy có giọng Việt; nếu không MC sẽ hiện chữ.';
      synthUnavailableUntil = Date.now() + 30_000;
      logger(latestError);
      emit({ type: 'voice.status', provider: 'microsoft-edge', language: 'vi-VN', vietnameseOnly: true, fallback: true, warning: latestError });
      return { url: '', bytes: 0, fallback: true };
    } finally {
      clearTimeout(timer);
      cancelSynthesis = null;
      try { voice?.close(); } catch {}
      try { proxyAgent?.destroy(); } catch {}
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
    if (priority >= 80 && current && current.priority < priority) interrupt();
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
        emit({ type: 'announcement', text: item.text, priority: item.priority, tag: item.tag, language: 'vi-VN' });
        const result = await synthesize(item.text, s.rate);
        if (closed || item.cancelled) continue;
        const durationMs = Math.round(Math.max(1500, Math.min(15000, result.bytes ? result.bytes / 12 : item.text.length / (14 * (1 + s.rate / 100)) * 1000)));
        emit({ type: 'tts', url: result.url, text: item.text, priority: item.priority, tag: item.tag, volume: s.volume, rate: s.rate, durationMs, fallback: !!result.fallback, language: 'vi-VN', voice: VOICE, vietnameseOnly: true });
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
    if (['reset', 'mode'].includes(event.type) || ['session.reset', 'match.reset', 'mode.set'].includes(event.action)) {
      queue = []; interrupt(); lastHitAt = 0; lastQueueAt = 0; lastDefenseAt = 0; lastBigAt = 0; lastSpecialAt = 0; lastMatchKey = ''; return;
    }
    if (!settings().enabled) return;
    const at = Date.now(), match = state?.match || {};
    // Corner names are intentional: user handles can contain English, emoji or abusive text.
    // They remain visible in game UI but are never read automatically by the commentator.
    const attacker = cornerName(event.side), defender = cornerName(event.target || (event.side === 'red' ? 'blue' : event.side === 'blue' ? 'red' : ''));
    if (event.type === 'ko') {
      if (!['red', 'blue'].includes(event.winner)) return;
      const title = cornerName(event.winner);
      enqueue(`${title} chiến thắng! Hạ đo ván rồi! Một màn kết thúc đầy uy lực! Nhà vô địch tiếp tục giữ đài. Ai đủ bản lĩnh bước lên thách đấu?`, { priority: 95, tag: 'ko' }); return;
    }
    if (event.type === 'match') {
      const key = `${match.id || ''}:${event.phase}:${match.round || 1}`;
      if (key === lastMatchKey) return;
      lastMatchKey = key;
      if (event.phase === 'countdown') enqueue('Hai võ sĩ đã bước lên đài! Góc đỏ, góc xanh, vào tư thế! Khán giả sẵn sàng cổ vũ nào!', { priority: 75, tag: 'start' });
      else if (event.phase === 'fighting') enqueue(`Chuông đã vang! Hiệp ${Math.max(1, Math.round(Number(match.round) || 1))} bắt đầu! Giữ chắc găng, chọn thời điểm phản công!`, { priority: 80, tag: 'bell' });
      else if (event.phase === 'rest') enqueue('Hết hiệp! Hai góc tranh thủ hồi sức. Trận đấu chưa kết thúc, phải có một người giành chiến thắng!', { priority: 70, tag: 'rest' });
      else if (event.phase === 'paused') enqueue('Võ đài tạm dừng theo hiệu lệnh trọng tài. Hai bên giữ vị trí!', { priority: 65, tag: 'pause' });
      return;
    }
    if (event.type === 'attack.start' && at - lastBigAt > 3500) {
      lastBigAt = at;
      if (event.move === 'ultimate') enqueue(`${attacker} đang dồn toàn bộ sức mạnh! Tuyệt kỹ bão quyền! ${defender} phải giữ găng thật chắc!`, { priority: 72, tag: 'special' });
      else if (event.move === 'flurry') enqueue(`${attacker} áp sát! Một, hai, ba! Liên hoàn đấm đang kéo tới!`, { priority: 58, tag: 'special' });
    } else if (event.type === 'hit' && at - lastHitAt > 4000) {
      lastHitAt = at;
      let line;
      if (event.dodged) line = `${defender} lách người rất đẹp! Né trọn cú đánh! ${attacker} cần bình tĩnh hơn!`;
      else if (event.blocked) line = `${defender} dựng găng kịp lúc! Một tình huống phòng thủ quá chắc chắn!`;
      else if (event.move === 'ultimate' || event.move === 'flurry') line = `${attacker} tung ${moveNames[event.move]} trúng đích! ${defender} mất ${Math.max(0, Math.round(Number(event.damage) || 0))} máu. Khán giả ơi, sức nóng đang tăng rồi!`;
      else line = sample([
        `${attacker} ra ${moveNames[event.move] || 'đòn'}! Trúng đích! ${defender} phải lùi lại một nhịp!`,
        `${event.critical ? 'Một cú đánh chí mạng! ' : ''}${attacker} áp sát! Đấm nhanh, thoát góc, không cho đối thủ kịp trở tay!`,
        `${defender} đang chịu sức ép! Một pha nối đòn rất sắc của ${attacker.toLocaleLowerCase('vi')}!`,
      ]);
      const target = match.fighters?.[event.target];
      if (!event.dodged && target?.hp > 0 && target.hp / target.maxHp < .25) line += ` ${defender} đang ít máu! Cơ hội lật ngược vẫn còn!`;
      enqueue(line, { priority: event.gift ? 55 : 20, tag: 'hit' });
    } else if (event.type === 'gift') {
      const coins = Math.max(0, Math.round(Number(event.coins) || 0)); if (!coins) return;
      const corner = event.side === 'red' ? 'góc đỏ' : event.side === 'blue' ? 'góc xanh' : '';
      const move = event.action || event.move;
      const effect = move === 'heal' ? 'nhận lượt tiếp sức hồi máu, sẵn sàng bám trụ!' : move === 'boost' ? 'nhận lượt tăng sức mạnh, chờ thời điểm phản công!' : move === 'shield' ? 'nhận lá chắn bảo vệ!' : `sẵn sàng tung ${moveNames[move] || 'đòn đặc biệt'}!`;
      enqueue(`Cảm ơn phần cổ vũ ${coins} xu! ${corner ? `${corner} ${effect}` : 'Thêm một người thách đấu đã đăng ký. Võ đài đang chờ bạn!'}`, { priority: 60, tag: 'gift' });
    } else if (['heal', 'boost', 'buff', 'comeback', 'pressure', 'overtime'].includes(event.type) && at - lastSpecialAt > 4500) {
      if (event.type === 'heal' && (event.limited || Number(event.amount) <= 0)) return;
      lastSpecialAt = at;
      const lines = {
        heal: `${attacker} vừa được tiếp sức hồi máu! Trận đấu lại nóng lên!`,
        boost: `${attacker} bùng nổ sức mạnh! Đừng bỏ lỡ thời cơ ra đòn!`,
        buff: `${attacker} được tăng sức mạnh! Đối thủ cần giữ khoảng cách!`,
        comeback: `${attacker} đang phản kháng! Ít máu chưa có nghĩa là hết cơ hội. Một cú lật kèo có thể đến bất cứ lúc nào!`,
        pressure: 'Trận đấu bước vào thời khắc quyết định! Áp lực tăng cao, từng cú đấm đều có thể kết thúc cuộc so găng!',
        overtime: 'Hiệp quyết định đã tới! Không còn chỗ cho sự do dự, phải có một nhà vô địch trên võ đài!',
      };
      enqueue(lines[event.type], { priority: 64, tag: 'tactics' });
    } else if (event.type === 'queue' && event.action !== 'remove' && at - lastQueueAt > 6000) {
      lastQueueAt = at;
      enqueue('Thêm một người thách đấu vào hàng chờ! Nhà vô địch sẽ phải bảo vệ ngôi vị trước những đối thủ mới!', { priority: 35, tag: 'queue' });
    } else if (event.type === 'defend' && at - lastDefenseAt > 12000) {
      lastDefenseAt = at;
      enqueue(`${attacker} ${event.move === 'dodge' ? 'di chuyển né đòn' : 'dựng găng phòng thủ'}. Giữ thể lực, chờ một cú phản công thật sắc!`, { priority: 15, tag: 'defend' });
    }
    if (match.phase === 'fighting' && at - lastInviteAt > settings().idle * 1000 && !busy && queue.length === 0) {
      lastInviteAt = at;
      const entry = Math.max(0, Math.round(Number(state?.settings?.entryCoins) || 0));
      enqueue(sample([
        'Khán giả chọn góc đỏ hay góc xanh? Tặng đúng mức xu trên bảng cổ vũ để kích hoạt liên hoàn, tuyệt kỹ, hồi máu hoặc tăng sức mạnh cho góc mình yêu thích!',
        entry ? `Muốn tự mình so găng? Tặng đủ ${entry} xu để đăng ký thách đấu. Danh hiệu giữ đài đang chờ chủ nhân tiếp theo!` : 'Muốn lên đài? Bình luận lên đài để đăng ký. Hãy thử bản lĩnh của chính mình!',
        'Sức mạnh cần đúng thời điểm! Một lượt hồi máu hay một tuyệt kỹ đúng lúc có thể đảo ngược trận đấu. Cổ vũ theo bảng xu của từng góc nhé!',
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
    status: () => ({ enabled: settings().enabled, voice: VOICE, provider: 'microsoft-edge', language: 'vi-VN', vietnameseOnly: true, offline, busy, queued: queue.length, fallback: offline || Date.now() < synthUnavailableUntil, lastSynthesisAt, error: latestError || (offline ? 'Đang ngoại tuyến: chỉ dùng giọng Việt trên máy; nếu chưa cài thì MC hiện chữ.' : '') }),
    scanMusic,
  };
}
