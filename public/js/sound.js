// Browser-only audio mixer. Every sound requires an explicit user gesture.
// The arena owns combat timing; audio can never block a hit or a match.
const bounded = (value, min, max, fallback) => Number.isFinite(Number(value)) ? Math.max(min, Math.min(max, Number(value))) : fallback;
const cleanText = value => String(value ?? '').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 420);
const textKey = value => cleanText(value).toLocaleLowerCase('vi');
const PRIORITY = { low: 10, normal: 30, high: 70, urgent: 90, ko: 95 };

export const isVietnameseVoice = voice => /^vi(?:[-_]|$)/i.test(String(voice?.lang || '').trim());

export function createSound({ onCaption = () => {}, onReady = () => {}, onVoiceStatus = () => {}, voiceWaitMs = 1200 } = {}) {
  let unlocked = false, muted = false, closed = false, lastCaption = '', cancelVoiceWait = null;
  let voiceStatus = { mode: 'idle', voice: '', language: 'vi-VN', warning: '' };
  function updateVoiceStatus(mode, voice = '', warning = '') { voiceStatus = { mode, voice, language: 'vi-VN', warning }; try { onVoiceStatus({ ...voiceStatus }); } catch {} }
  let context = null, master = null, noiseBuffer = null;
  let opts = { mcEnabled: true, mcVolume: 80, mcRate: 15, musicEnabled: false, musicVolume: 25, sfxVolume: 70 };
  let music = null, voice = null, voiceActive = false, currentCancel = null, speechGeneration = 0;
  let playlist = [], musicIndex = -1, musicFailures = 0, nextMusicTimer = null;
  const queue = [], pending = new Map(), spoken = new Map(), timers = new Set(), nodes = new Set();
  const canPlay = () => unlocked && !muted && !closed;
  const isManual = item => item?.manual === true || item?.tag === 'manual';
  const canSpeak = item => canPlay() && (opts.mcEnabled || isManual(item));
  const caption = (text, details = {}) => { const cleaned = cleanText(text); if (cleaned) lastCaption = cleaned; try { onCaption(cleaned, { warning: voiceStatus.warning, ...details }); } catch {} };
  const later = (fn, ms) => {
    const id = setTimeout(() => { timers.delete(id); if (!closed) fn(); }, ms);
    timers.add(id); return id;
  };
  const cancelTimer = id => { clearTimeout(id); timers.delete(id); };
  const safeUrl = raw => {
    try {
      const base = typeof location === 'object' ? location.origin : 'http://localhost';
      const u = new URL(String(raw || ''), base);
      if (u.origin !== base || u.username || u.password || !/^\/(audio|music|nhac)\/[A-Za-z0-9_%(). -]+\.(mp3|m4a|ogg|wav|aac)$/i.test(u.pathname)) return '';
      return u.href;
    } catch { return ''; }
  };
  const makeAudio = () => {
    if (typeof Audio !== 'function') return null;
    const audio = new Audio(); audio.preload = 'none';
    audio.setAttribute?.('playsinline', ''); return audio;
  };
  function pruneSpoken() {
    const cutoff = Date.now() - 45_000;
    for (const [key, at] of spoken) if (at < cutoff) spoken.delete(key);
    while (spoken.size > 100) spoken.delete(spoken.keys().next().value);
  }
  function setMusicVolume() {
    if (music) music.volume = canPlay() ? Math.min(1, opts.musicVolume / 100) * (voiceActive ? 0.22 : 1) : 0;
  }
  function stopVoice() {
    currentCancel?.(); currentCancel = null;
    if (voice) { voice.pause(); voice.removeAttribute('src'); voice.load?.(); }
    try { globalThis.speechSynthesis?.cancel(); } catch {}
    voiceActive = false; setMusicVolume();
  }
  function clearSpeech() {
    speechGeneration++;
    cancelVoiceWait?.();
    queue.length = 0;
    for (const item of pending.values()) cancelTimer(item.timer);
    pending.clear(); stopVoice();
  }
  function nextTrack() {
    if (!canPlay() || !opts.musicEnabled || !playlist.length) return;
    music ||= makeAudio(); if (!music) return;
    if (nextMusicTimer) { cancelTimer(nextMusicTimer); nextMusicTimer = null; }
    let next = Math.floor(Math.random() * playlist.length);
    if (playlist.length > 1 && next === musicIndex) next = (next + 1) % playlist.length;
    musicIndex = next; music.src = playlist[next].url;
    music.onended = () => { musicFailures = 0; nextTrack(); };
    music.onerror = () => {
      if (++musicFailures <= playlist.length) nextMusicTimer = later(nextTrack, 1000);
    };
    setMusicVolume();
    music.play().then(() => { musicFailures = 0; }).catch(() => {
      // Browser policy can refuse a track even after the first user gesture.
      // Keep the sound button usable; never retry in a tight loop.
    });
  }
  function updateMusic(event = {}) {
    if (Array.isArray(event.files)) {
      const next = event.files.map(item => {
        const raw = typeof item === 'string' ? item : item?.url;
        return { name: typeof item === 'string' ? item : String(item?.name || ''), url: safeUrl(raw) };
      }).filter(item => item.url).slice(0, 200);
      const changed = next.map(item => item.url).join('|') !== playlist.map(item => item.url).join('|');
      playlist = next;
      if (changed) { musicFailures = 0; musicIndex = -1; }
      if (music && !playlist.some(item => item.url === music.src)) { music.pause(); music.removeAttribute('src'); }
    }
    if (typeof event.enabled === 'boolean') opts.musicEnabled = event.enabled;
    if (event.volume != null) opts.musicVolume = bounded(event.volume, 0, 100, 25);
    if (!canPlay() || !opts.musicEnabled || !playlist.length) music?.pause();
    else if (!music || !music.src) nextTrack();
    else if (music.paused) music.play().catch(() => {});
    setMusicVolume();
  }
  function tone(frequency, duration, volume = 0.2, type = 'sine', delay = 0, endFrequency = frequency) {
    if (!context || !master || !canPlay() || nodes.size > 30) return;
    const oscillator = context.createOscillator(), gain = context.createGain();
    const at = context.currentTime + delay;
    oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, at);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), at + duration);
    gain.gain.setValueAtTime(0.0001, at); gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), at + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    oscillator.connect(gain); gain.connect(master); nodes.add(oscillator);
    oscillator.onended = () => { nodes.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
    oscillator.start(at); oscillator.stop(at + duration + 0.02);
  }
  function noise(duration = 0.12, volume = 0.25, frequency = 1200, delay = 0) {
    if (!context || !master || !noiseBuffer || !canPlay() || nodes.size > 30) return;
    const source = context.createBufferSource(), filter = context.createBiquadFilter(), gain = context.createGain();
    const at = context.currentTime + delay;
    source.buffer = noiseBuffer; filter.type = 'lowpass'; filter.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, at); gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    source.connect(filter); filter.connect(gain); gain.connect(master); nodes.add(source);
    source.onended = () => { nodes.delete(source); source.disconnect(); filter.disconnect(); gain.disconnect(); };
    source.start(at); source.stop(at + duration + 0.02);
  }
  function sfx(event) {
    if (!canPlay() || opts.sfxVolume <= 0) return;
    try {
      if (event.type === 'attack.start') {
        const duration = bounded(event.durationMs, 300, 3000, 1400) / 1000;
        tone(event.move === 'ultimate' ? 90 : 160, duration * .7, .12, 'sine', 0, event.move === 'ultimate' ? 420 : 280);
        noise(.12, .1, 4200, Math.max(0, duration - .22));
      } else if (event.type === 'hit') {
        if (event.dodged) { noise(0.16, 0.12, 3700); return; }
        if (event.blocked) { noise(0.08, 0.16, 1800); tone(240, 0.09, 0.16, 'triangle', 0, 70); return; }
        const heavy = ['uppercut', 'kick', 'ultimate'].includes(event.move) || event.critical;
        const hits = ['flurry', 'ultimate'].includes(event.move) ? Math.min(6, bounded(event.hits, 2, 6, 4)) : 1;
        for (let i = 0; i < hits; i++) {
          const delay = i * 0.075;
          noise(heavy ? 0.19 : 0.1, heavy ? 0.36 : 0.22, heavy ? 1900 : 2700, delay);
          tone(heavy ? 110 : 175, heavy ? 0.2 : 0.12, heavy ? 0.45 : 0.24, 'sine', delay, 35);
        }
        if (event.critical) tone(740, 0.13, 0.07, 'triangle', 0.03, 280);
      } else if (event.type === 'ko') {
        noise(0.35, 0.35, 2400); tone(85, 0.85, 0.5, 'sine', 0, 24);
        for (let i = 0; i < 3; i++) { tone(840, 0.6, 0.1, 'triangle', i * 0.22); tone(1660, 0.38, 0.04, 'sine', i * 0.22); }
      } else if (event.type === 'match' && event.phase === 'fighting') {
        for (let i = 0; i < 2; i++) { tone(1050, 0.55, 0.11, 'triangle', i * 0.3); tone(2100, 0.42, 0.05, 'sine', i * 0.3); }
      } else if (event.type === 'defend') noise(0.12, 0.09, 3900);
      else if (event.type === 'gift') { tone(660, 0.16, 0.05, 'sine'); tone(990, 0.25, 0.06, 'sine', 0.08); }
    } catch { /* Visual combat continues if the audio device disappears. */ }
  }
  function vietnameseVoice() {
    let voices = [];
    try { voices = globalThis.speechSynthesis?.getVoices?.() || []; } catch {}
    const candidates = voices.filter(isVietnameseVoice);
    return candidates.find(v => /nam.?minh/i.test(v.name || '')) || candidates[0] || null;
  }
  function waitForVietnameseVoice(generation) {
    const ready = vietnameseVoice();
    if (ready) return Promise.resolve(ready);
    return new Promise(resolve => {
      const synth = globalThis.speechSynthesis;
      let finished = false, timeout, poll, previous;
      const finish = voice => {
        if (finished) return; finished = true;
        cancelTimer(timeout); clearInterval(poll);
        if (synth?.removeEventListener) synth.removeEventListener('voiceschanged', check);
        else if (synth && synth.onvoiceschanged === changed) synth.onvoiceschanged = previous;
        if (cancelVoiceWait === cancel) cancelVoiceWait = null;
        resolve(voice);
      };
      const check = () => {
        if (!canSpeak({ manual: true }) || generation !== speechGeneration) return finish(null);
        const voice = vietnameseVoice(); if (voice) finish(voice);
      };
      const changed = event => { try { previous?.call(synth, event); } catch {} check(); };
      const cancel = () => finish(null);
      cancelVoiceWait = cancel;
      if (synth?.addEventListener) synth.addEventListener('voiceschanged', check);
      else if (synth) { previous = synth.onvoiceschanged; synth.onvoiceschanged = changed; }
      timeout = later(() => finish(vietnameseVoice()), bounded(voiceWaitMs, 0, 3000, 1200));
      poll = setInterval(check, 100);
      check();
    });
  }
  async function browserSpeech(item) {
    if (!canSpeak(item)) return;
    const generation = speechGeneration;
    const hasApi = globalThis.speechSynthesis && typeof SpeechSynthesisUtterance === 'function';
    const vietnamese = hasApi ? await waitForVietnameseVoice(generation) : null;
    if (generation !== speechGeneration || !canSpeak(item)) return;
    if (!vietnamese) {
      const warning = 'Chưa có giọng tiếng Việt trên máy. MC đang hiện chữ; bật Internet để dùng giọng Nam Minh hoặc cài giọng tiếng Việt trong Windows.';
      updateVoiceStatus('unavailable', '', warning);
      caption(item.text, { speaking: false, source: 'voice-unavailable', status: 'no-vietnamese-voice', warning });
      return;
    }
    // Never let the OS select an English/default voice, even if lang is set to vi-VN.
    return new Promise(resolve => {
      const utterance = new SpeechSynthesisUtterance(item.text);
      utterance.voice = vietnamese;
      utterance.lang = 'vi-VN'; utterance.rate = bounded(1 + opts.mcRate / 100, 0.7, 1.45, 1.15); utterance.volume = opts.mcVolume / 100;
      updateVoiceStatus('vietnamese', vietnamese.name || 'Giọng tiếng Việt');
      let settled = false;
      const done = () => { if (settled) return; settled = true; cancelTimer(timeout); currentCancel = null; resolve(); };
      const timeout = later(() => { try { globalThis.speechSynthesis.cancel(); } catch {} done(); }, 28_000);
      currentCancel = () => { try { globalThis.speechSynthesis.cancel(); } catch {} done(); };
      utterance.onend = done;
      utterance.onerror = () => { updateVoiceStatus('unavailable', '', 'Giọng tiếng Việt trên máy chưa phát được. MC vẫn hiển thị chữ.'); done(); };
      caption(item.text, { speaking: true, source: 'speech' });
      try { globalThis.speechSynthesis.speak(utterance); } catch { done(); }
    });
  }
  function playVoice(item) {
    return new Promise(resolve => {
      if (!canSpeak(item)) { resolve(); return; }
      const url = safeUrl(item.url);
      voice ||= makeAudio();
      if (!url || !voice) { browserSpeech(item).then(resolve); return; }
      let settled = false, started = false;
      const finish = () => { if (settled) return; settled = true; cancelTimer(timeout); currentCancel = null; voice.onended = null; voice.onerror = null; resolve(); };
      const fallback = () => {
        if (settled) return;
        settled = true; cancelTimer(timeout); voice.pause(); voice.onended = null; voice.onerror = null; currentCancel = null;
        browserSpeech(item).then(resolve);
      };
      const timeout = later(() => { if (started) { voice.pause(); finish(); } else fallback(); }, 28_000);
      voice.volume = opts.mcVolume / 100; voice.src = url;
      voice.onended = finish; voice.onerror = fallback;
      currentCancel = () => { voice.pause(); finish(); };
      caption(item.text, { speaking: true, source: 'tts' });
      voice.play().then(() => { started = true; updateVoiceStatus('cloud', 'Nam Minh · tiếng Việt'); }).catch(fallback);
    });
  }
  async function pump() {
    if (voiceActive || !queue.length || !canSpeak(queue[0])) return;
    voiceActive = true; setMusicVolume();
    const generation = speechGeneration;
    const item = queue.shift();
    spoken.set(item.key, Date.now());
    try { await playVoice(item); } catch {}
    if (generation !== speechGeneration || closed) return;
    voiceActive = false; currentCancel = null; setMusicVolume();
    caption(item.text, { speaking: false, source: 'complete' });
    if (queue.length) later(pump, 100);
  }
  function enqueue(event) {
    const text = cleanText(event.text); if (!text || !canSpeak(event)) return;
    pruneSpoken(); const key = textKey(text);
    if (spoken.has(key) || queue.some(item => item.key === key)) return;
    const priority = typeof event.priority === 'string' ? PRIORITY[event.priority] || 30 : bounded(event.priority, 1, 100, 30);
    const item = { text, key, url: event.url || '', priority, manual: isManual(event), tag: event.tag || '', at: Date.now() };
    // Preserve the most relevant moment, never read a minute-old play-by-play.
    while (queue.length && Date.now() - queue[0].at > 12_000) queue.shift();
    if (queue.length >= 4) {
      const least = queue.findIndex(old => old.priority <= priority);
      if (least < 0) return; queue.splice(least, 1);
    }
    const before = queue.findIndex(old => old.priority < priority);
    queue.splice(before < 0 ? queue.length : before, 0, item);
    pump();
  }
  function announcement(event) {
    const text = cleanText(event.text); if (!text) return;
    caption(text, { speaking: false, source: 'announcement' });
    if (!canSpeak(event)) return;
    const key = textKey(text), old = pending.get(key); if (old) cancelTimer(old.timer);
    if (pending.size >= 8) { const oldest = pending.keys().next().value; cancelTimer(pending.get(oldest).timer); pending.delete(oldest); }
    const timer = later(() => { pending.delete(key); enqueue({ ...event, text }); }, event.fallback === true || event.offline === true ? 100 : 7000);
    pending.set(key, { timer });
  }
  function settings(next = {}) {
    const wasMcEnabled = opts.mcEnabled;
    opts = {
      ...opts,
      mcEnabled: typeof next.mcEnabled === 'boolean' ? next.mcEnabled : opts.mcEnabled,
      musicEnabled: typeof next.musicEnabled === 'boolean' ? next.musicEnabled : opts.musicEnabled,
      mcVolume: bounded(next.mcVolume ?? opts.mcVolume, 0, 100, 80),
      mcRate: bounded(next.mcRate ?? opts.mcRate, -50, 60, 15),
      musicVolume: bounded(next.musicVolume ?? opts.musicVolume, 0, 100, 25),
      sfxVolume: bounded(next.sfxVolume ?? opts.sfxVolume, 0, 100, 70),
    };
    if (master && context) master.gain.setTargetAtTime(opts.sfxVolume / 100 * 0.55, context.currentTime, 0.03);
    if (!opts.mcEnabled && wasMcEnabled) clearSpeech();
    if (voice) voice.volume = opts.mcVolume / 100;
    updateMusic();
  }
  async function unlock() {
    if (closed || muted) return false;
    unlocked = true;
    try {
      const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (AudioContextClass && !context) {
        context = new AudioContextClass(); master = context.createGain();
        master.gain.value = opts.sfxVolume / 100 * 0.55;
        const limiter = context.createDynamicsCompressor(); limiter.threshold.value = -10; limiter.ratio.value = 8;
        master.connect(limiter); limiter.connect(context.destination);
        noiseBuffer = context.createBuffer(1, Math.ceil(context.sampleRate * 0.5), context.sampleRate);
        const noiseData = noiseBuffer.getChannelData(0);
        for (let i = 0; i < noiseData.length; i++) noiseData[i] = Math.random() * 2 - 1;
      }
      if (context?.state === 'suspended') await context.resume();
    } catch { /* HTML Audio/speech can still work without Web Audio. */ }
    updateMusic();
    try { onReady(true); } catch {}
    return true;
  }
  function setMuted(value) {
    muted = !!value;
    if (muted) { clearSpeech(); music?.pause(); }
    else if (unlocked) updateMusic();
    setMusicVolume();
  }
  function event(event = {}) {
    if (closed) return;
    if (event.type === 'announcement') announcement(event);
    else if (event.type === 'tts') {
      const text = cleanText(event.text), key = textKey(text), old = pending.get(key);
      if (old) { cancelTimer(old.timer); pending.delete(key); }
      caption(text, { speaking: false, source: 'tts-ready' }); enqueue({ ...event, text });
    } else if (event.type === 'music') updateMusic(event);
    else if (['reset', 'mode', 'ttsStop'].includes(event.type)) {
      clearSpeech();
      if (event.type !== 'ttsStop') spoken.clear();
      caption(lastCaption, { speaking: false, source: 'stop' });
    }
    else sfx(event);
  }
  function close() {
    if (closed) return;
    clearSpeech(); closed = true;
    for (const id of timers) clearTimeout(id); timers.clear(); pending.clear();
    for (const node of nodes) { try { node.stop(); } catch {} } nodes.clear();
    music?.pause(); if (music) { music.removeAttribute('src'); music.load?.(); }
    context?.close().catch(() => {});
  }
  return { unlock, setMuted, settings, event, close, get voiceStatus() { return { ...voiceStatus }; }, get isUnlocked() { return unlocked && !muted; } };
}
