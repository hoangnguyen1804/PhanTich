import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { createAudio, cleanMusicName } from '../src/audio.mjs';

function fixture(t, settings = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vo-dai-audio-'));
  const events = [];
  const config = { mcEnabled: true, mcVolume: 65, mcRate: 15, musicEnabled: true, musicVolume: 30, ...settings };
  const musicDir = path.join(directory, 'nhac');
  const audio = createAudio({ dataDir: path.join(directory, 'data'), musicDir, offline: true, getSettings: () => config, onEvent: event => events.push(event) });
  t.after(() => { audio.close(); fs.rmSync(directory, { recursive: true, force: true }); });
  return { directory, musicDir, audio, events, config };
}
const mp3 = byte => { const buffer = Buffer.alloc(2048, byte); buffer.write('ID3'); return buffer; };

test('offline startup stays silent; explicit speech produces Vietnamese browser fallback with current settings', async t => {
  const { audio, events } = fixture(t);
  await nextTurn();
  assert.deepEqual(events, []);
  assert.equal(audio.say('Xin chào võ đài!').queued, true);
  await nextTurn();
  const speech = events.find(event => event.type === 'tts');
  assert.equal(speech.text, 'Xin chào võ đài!');
  assert.equal(speech.url, '');
  assert.equal(speech.fallback, true);
  assert.equal(speech.volume, 65);
  assert.equal(speech.rate, 15);
  assert.equal(speech.source, 'mc');
});

test('disabled automatic MC remains silent, while an explicit operator voice test is accepted', async t => {
  const { audio, events } = fixture(t, { mcEnabled: false });
  audio.announce({ type: 'hit', attacker: 'Đỏ', defender: 'Xanh', damage: 20, move: 'hook' }, { match: { phase: 'fighting' } });
  await nextTurn();
  assert.equal(events.length, 0);
  assert.equal(audio.say('Thử giọng theo yêu cầu').queued, true);
  await nextTurn();
  assert.equal(events.find(event => event.type === 'tts')?.text, 'Thử giọng theo yêu cầu');
});

test('KO commentary names the actual winner and interrupts lower priority play-by-play', async t => {
  const { audio, events } = fixture(t);
  const state = { match: { id: 'round-1', phase: 'fighting', fighters: { red: { name: 'Hỏa Quyền', hp: 500, maxHp: 1000 }, blue: { name: 'Bão Xanh', hp: 100, maxHp: 1000 } } } };
  audio.announce({ type: 'hit', attacker: 'Hỏa Quyền', defender: 'Bão Xanh', target: 'blue', damage: 40, move: 'hook' }, state);
  await nextTurn();
  audio.announce({ type: 'ko', winner: 'red', name: 'Hỏa Quyền' }, state);
  await nextTurn();
  assert.ok(events.some(event => event.type === 'ttsStop'));
  const speech = events.filter(event => event.type === 'tts').at(-1);
  assert.match(speech.text, /Hỏa Quyền chiến thắng/);
  assert.equal(speech.tag, 'ko');
});

test('music uploads preserve existing songs, expose usable URLs, and delete only the selected song', t => {
  const { audio, musicDir } = fixture(t);
  const first = audio.saveMusic('Bài hát.mp3', mp3(1));
  const second = audio.saveMusic('Bài hát.mp3', mp3(2));
  assert.equal(first.name, 'Bài hát.mp3');
  assert.equal(second.name, 'Bài hát (2).mp3');
  assert.equal(fs.readFileSync(path.join(musicDir, first.name))[100], 1);
  assert.equal(fs.readFileSync(path.join(musicDir, second.name))[100], 2);
  const listed = audio.music();
  assert.equal(listed.files.length, 2);
  assert.equal(listed.enabled, true);
  assert.equal(listed.volume, 30);
  assert.equal(decodeURIComponent(listed.files[0].url.slice('/music/'.length)), listed.files[0].name);
  audio.deleteMusic(first.name);
  assert.deepEqual(audio.music().files.map(file => file.name), [second.name]);
});

test('music rejects traversal, hidden files, unsupported suffixes and non-audio contents', t => {
  const { audio } = fixture(t);
  for (const name of ['../file.mp3', '..\\file.mp3', '.file.mp3', 'file.exe', '']) assert.throws(() => cleanMusicName(name));
  assert.throws(() => audio.saveMusic('not-music.mp3', Buffer.alloc(2048)));
  assert.throws(() => audio.saveMusic('small.mp3', Buffer.from('ID3')));
  assert.throws(() => audio.deleteMusic('../file.mp3'));
  assert.equal(audio.music().files.length, 0);
});

test('external symlink media is never listed or deleted through the music API', t => {
  const { audio, directory, musicDir } = fixture(t);
  const outside = path.join(directory, 'outside.mp3');
  fs.writeFileSync(outside, mp3(7));
  try { fs.symlinkSync(outside, path.join(musicDir, 'linked.mp3')); } catch (error) { t.skip(`Symlinks unavailable: ${error.code}`); return; }
  audio.scanMusic();
  assert.equal(audio.music().files.length, 0);
  assert.throws(() => audio.deleteMusic('linked.mp3'));
  assert.equal(fs.readFileSync(outside)[100], 7);
});

test('reset cancels old fight narration and closed audio never emits or accepts further work', async t => {
  const { audio, events } = fixture(t);
  audio.say('Lời trận trước');
  await nextTurn();
  audio.announce({ type: 'reset' }, {});
  assert.ok(events.some(event => event.type === 'ttsStop'));
  audio.close();
  const count = events.length;
  assert.equal(audio.say('Không được phát sau khi đóng').queued, false);
  assert.throws(() => audio.saveMusic('after-close.mp3', mp3(1)));
  await nextTurn();
  assert.equal(events.length, count);
});
