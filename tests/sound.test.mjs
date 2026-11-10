import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as nextTurn, setTimeout as delay } from 'node:timers/promises';
import { createSound, isVietnameseVoice } from '../public/js/sound.js';

async function until(predicate, message) {
  const deadline = Date.now() + 1000;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await delay(5);
  }
  assert.fail(message || 'Expected audio state was not reached');
}

function fixture(t, voices = [], options = {}) {
  const keys = ['speechSynthesis', 'SpeechSynthesisUtterance', 'Audio', 'AudioContext', 'webkitAudioContext', 'location'];
  const original = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  class MockSpeech extends EventTarget {
    constructor() { super(); this.voices = voices; this.spoken = []; this.cancelled = 0; }
    getVoices() { return this.voices.slice(); }
    speak(utterance) { this.spoken.push(utterance); queueMicrotask(() => utterance.onend?.()); }
    cancel() { this.cancelled++; }
    load(next) { this.voices = next; this.dispatchEvent(new Event('voiceschanged')); }
  }
  const synthesis = new MockSpeech();
  const globals = {
    speechSynthesis: synthesis,
    SpeechSynthesisUtterance: class { constructor(text) { this.text = text; this.voice = null; this.lang = ''; } },
    Audio: undefined, AudioContext: undefined, webkitAudioContext: undefined,
    location: { origin: 'http://localhost' },
  };
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  const captions = [], statuses = [];
  const sound = createSound({ voiceWaitMs: 20, onCaption: (text, info) => captions.push({ text, ...info }), onVoiceStatus: status => statuses.push(status), ...options });
  t.after(async () => {
    sound.close();
    await nextTurn();
    for (const [key, descriptor] of original) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  const say = (text = 'Góc đỏ tung một cú đấm móc!', extra = {}) => sound.event({ type: 'tts', text, url: '', tag: 'manual', priority: 100, ...extra });
  return { sound, synthesis, captions, statuses, say };
}

test('Vietnamese voice detection accepts vi variants and rejects English/default voices', () => {
  for (const lang of ['vi', 'vi-VN', 'vi_VN', 'VI-vn']) assert.equal(isVietnameseVoice({ lang }), true, lang);
  for (const lang of ['en-US', 'fr-FR', '', undefined, 'vietnamese', 'en-vi']) assert.equal(isVietnameseVoice({ lang, name: 'Vietnamese voice' }), false, String(lang));
  assert.equal(isVietnameseVoice(null), false);
});

test('an empty voice list never falls back to the operating system default language', async t => {
  const { sound, synthesis, captions, say } = fixture(t);
  await sound.unlock(); say();
  await until(() => sound.voiceStatus.mode === 'unavailable', 'Missing Vietnamese voice must be reported');
  assert.equal(synthesis.spoken.length, 0);
  assert.ok(captions.some(caption => caption.source === 'voice-unavailable' && caption.warning));
  assert.match(sound.voiceStatus.warning, /Việt/);
});

test('English-only voices display Vietnamese captions without speaking English', async t => {
  const { sound, synthesis, captions, say } = fixture(t, [{ name: 'Default English', lang: 'en-US', default: true }]);
  await sound.unlock(); say('Góc xanh đang phản công!');
  await until(() => sound.voiceStatus.mode === 'unavailable');
  assert.equal(synthesis.spoken.length, 0);
  assert.ok(captions.some(caption => caption.text === 'Góc xanh đang phản công!' && caption.warning));
});

test('lazy-loaded Vietnamese voices are explicitly selected after voiceschanged', async t => {
  const english = { name: 'Default English', lang: 'en-US', default: true };
  const vietnamese = { name: 'Giọng Việt', lang: 'vi-VN', default: false };
  const { sound, synthesis, say } = fixture(t, [english], { voiceWaitMs: 200 });
  await sound.unlock(); say();
  await nextTurn();
  assert.equal(synthesis.spoken.length, 0);
  synthesis.load([english, vietnamese]);
  await until(() => synthesis.spoken.length === 1);
  assert.equal(synthesis.spoken[0].voice, vietnamese);
  assert.equal(synthesis.spoken[0].lang, 'vi-VN');
  assert.equal(sound.voiceStatus.mode, 'vietnamese');
});

test('an existing Vietnamese voice wins over the default English voice', async t => {
  const vietnamese = { name: 'Nam Minh', lang: 'vi_VN' };
  const { sound, synthesis, say } = fixture(t, [{ name: 'Default', lang: 'en-US', default: true }, vietnamese]);
  await sound.unlock(); say();
  await until(() => synthesis.spoken.length === 1);
  assert.equal(synthesis.spoken[0].voice, vietnamese);
});

test('reset cancels a pending voice lookup so old fight narration cannot play later', async t => {
  const { sound, synthesis, say } = fixture(t, [], { voiceWaitMs: 100 });
  await sound.unlock(); say(); await nextTurn();
  sound.event({ type: 'reset' });
  synthesis.load([{ name: 'Giọng Việt', lang: 'vi-VN' }]);
  await delay(130);
  assert.equal(synthesis.spoken.length, 0);
});

test('close cancels pending voice lookup and ignores later voiceschanged', async t => {
  const { sound, synthesis, say } = fixture(t, [], { voiceWaitMs: 100 });
  await sound.unlock(); say(); await nextTurn();
  sound.close();
  synthesis.load([{ name: 'Giọng Việt', lang: 'vi-VN' }]);
  await delay(130);
  assert.equal(synthesis.spoken.length, 0);
});

test('mute also cancels pending speech before a Vietnamese voice becomes available', async t => {
  const { sound, synthesis, say } = fixture(t, [], { voiceWaitMs: 100 });
  await sound.unlock(); say(); await nextTurn();
  sound.setMuted(true);
  synthesis.load([{ name: 'Giọng Việt', lang: 'vi' }]);
  await delay(130);
  assert.equal(synthesis.spoken.length, 0);
});

test('a failed cloud audio request cannot fall through to an English-only OS voice', async t => {
  const { sound, synthesis, say } = fixture(t, [{ name: 'Default English', lang: 'en-US', default: true }]);
  globalThis.Audio = class {
    setAttribute() {}
    pause() {}
    removeAttribute() {}
    load() {}
    play() { return Promise.reject(new Error('Cloud audio unavailable')); }
  };
  await sound.unlock(); say('Góc đỏ tung tuyệt kỹ!', { url: '/audio/1234567890abcdef1234567890abcdef.mp3' });
  await until(() => sound.voiceStatus.mode === 'unavailable');
  assert.equal(synthesis.spoken.length, 0);
});

test('a browser without a speech API preserves captions and reports unavailable Vietnamese audio', async t => {
  const { sound, synthesis, captions, say } = fixture(t);
  globalThis.SpeechSynthesisUtterance = undefined;
  await sound.unlock(); say('Hiệp đấu tiếp tục!');
  await until(() => sound.voiceStatus.mode === 'unavailable');
  assert.equal(synthesis.spoken.length, 0);
  assert.ok(captions.some(caption => caption.text === 'Hiệp đấu tiếp tục!' && caption.warning));
});
