import { connect } from './client.js';

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
const number = value => new Intl.NumberFormat('vi-VN').format(Number(value) || 0);
const time = value => new Date(value || Date.now()).toLocaleTimeString('vi-VN', { hour12: false });
const initial = name => [...String(name || '?').trim()][0]?.toUpperCase() || '?';
const safeImage = url => { try { const parsed = new URL(url); return parsed.protocol === 'https:' ? parsed.href : ''; } catch { return ''; } };
const phaseLabels = { waiting: 'CHỜ LÊN ĐÀI', countdown: 'CHUẨN BỊ', fighting: 'ĐANG THI ĐẤU', paused: 'TẠM DỪNG', finished: 'KẾT THÚC TRẬN' };
const moveLabels = { jab: 'Đấm thẳng', hook: 'Đấm móc', uppercut: 'Bốc cằm', kick: 'Cú đá', flurry: 'Liên hoàn', ultimate: 'Tuyệt chiêu', heal: 'Hồi máu', shield: 'Khiên phòng thủ', energy: 'Nạp năng lượng' };
const pages = {
  'tong-quan': ['Tổng quan', 'Phòng điều khiển', 'Biến mỗi bình luận thành một khoảnh khắc trên võ đài.'],
  'dieu-khien': ['Điều khiển', 'Làm chủ trận đấu', 'Từng cú đấm, từng lượt thách đấu. Tất cả trong tầm tay.'],
  'qua-luat': ['Quà & luật chơi', 'Luật của võ đài', 'Định hình cuộc chơi và tạo dấu ấn cho kênh của bạn.'],
  'am-thanh': ['MC & âm thanh', 'Nghe thấy sức nóng', 'Lời bình, tiếng va chạm và nhạc nền làm nên bầu không khí.'],
  'ket-noi': ['Kết nối LIVE', 'Đưa võ đài lên sóng', 'Kết nối TikTok, lấy nguồn OBS và kiểm tra trước giờ lên đài.'],
  'nhat-ky': ['Nhật ký', 'Mọi khoảnh khắc đều có dấu', 'Theo dõi trận đấu và xử lý tình huống ngay tại đây.'],
};
let state = null;
let connected = false;
let logs = [];
let catalog = { gifts: [], actions: [], map: {} };
let giftAction = '';
let previewMuted = true;
let cachedMusic = [];
let latestLinks = null;
let catalogLoading = false;
let lastConnectionError = '';
let lastPeopleSignature = '';
let lastGiftMapSignature = '';
let lastMusicSignature = '';
const logTimes = new Map();

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = String(text);
  return node;
}
function toast(message, isError = false) {
  const node = element('div', `toast${isError ? ' error' : ''}`, message);
  $('#toasts').append(node);
  while ($('#toasts').children.length > 4) $('#toasts').firstElementChild.remove();
  setTimeout(() => node.remove(), isError ? 7000 : 3800);
}
function log(message, level = 'info', dedupe = '') {
  if (dedupe) {
    const previous = logTimes.get(dedupe) || 0;
    if (Date.now() - previous < 1500) return;
    logTimes.set(dedupe, Date.now());
    if (logTimes.size > 200) logTimes.delete(logTimes.keys().next().value);
  }
  const entry = { at: Date.now(), text: String(message).slice(0, 800), level };
  logs.push(entry);
  if (logs.length > 500) logs.shift();
  const line = element('div', `log-line ${level}`);
  line.append(element('span', 'log-time', time(entry.at)), element('span', '', entry.text));
  $('#eventLog').append(line);
  while ($('#eventLog').children.length > 500) $('#eventLog').firstElementChild.remove();
  if ($('#logAutoScroll').checked) $('#eventLog').scrollTop = $('#eventLog').scrollHeight;
}
async function call(method, params = {}, { success = '', button = null, silent = false } = {}) {
  if (button?.dataset.busy === '1') return;
  const disabled = button?.disabled;
  if (button) { button.dataset.busy = '1'; button.disabled = true; button.setAttribute('aria-busy', 'true'); }
  try {
    const result = await client.call(method, params);
    if (result?.ok === false) throw new Error(result.message || result.error || 'Thao tác chưa hoàn tất.');
    if (success) toast(success);
    return result;
  } catch (error) {
    const message = String(error?.message || error || 'Không thực hiện được thao tác.');
    if (!silent) toast(message, true);
    log(`${method}: ${message}`, 'error');
    throw error;
  } finally {
    if (button) { button.dataset.busy = ''; button.disabled = !!disabled; button.removeAttribute('aria-busy'); }
  }
}
const run = promise => Promise.resolve(promise).catch(() => {});
function empty(container, message, icon = '◌') {
  const node = element('div', 'empty-state');
  node.append(element('span', 'empty-icon', icon), document.createTextNode(message));
  container.replaceChildren(node);
}
function avatar(container, person) {
  const name = person?.name || '?';
  container.replaceChildren(document.createTextNode(initial(name)));
  const url = safeImage(person?.avatar);
  if (url) {
    const image = new Image();
    image.alt = ''; image.loading = 'lazy'; image.referrerPolicy = 'no-referrer';
    image.onerror = () => container.replaceChildren(document.createTextNode(initial(name)));
    image.src = url;
    container.replaceChildren(image);
  }
}
function personRow(person, index, { remove = false, ranking = false } = {}) {
  const row = element('div', 'person-row');
  if (ranking) row.append(element('span', `rank-number${index === 0 ? ' first' : ''}`, String(index + 1).padStart(2, '0')));
  const av = element('span', 'person-avatar'); avatar(av, person); row.append(av);
  const details = element('div', 'person-details');
  details.append(element('strong', '', person.name || 'Người xem'));
  details.append(element('small', '', ranking ? `${number(person.wins)} thắng · ${number(person.kos)} KO` : `Vị trí ${index + 1} · ${number(person.coins)} xu`));
  row.append(details);
  if (ranking) row.append(element('span', 'person-value', `${number(person.streak)} chuỗi`));
  else if (remove) {
    const button = element('button', 'icon-button', '×');
    button.setAttribute('aria-label', `Xóa ${person.name} khỏi hàng chờ`);
    button.addEventListener('click', () => run(call('queue.remove', { uid: person.uid }, { button })));
    row.append(button);
  }
  return row;
}
function renderPeople(s) {
  const signature = JSON.stringify([s.queue, s.leaderboard, s.recent]);
  if (signature === lastPeopleSignature) return;
  lastPeopleSignature = signature;
  const queue = s.queue || [];
  $('#queueCount').textContent = queue.length;
  const overview = $('#overviewQueue');
  if (!queue.length) empty(overview, 'Chưa có ai chờ lên đài.');
  else overview.replaceChildren(...queue.slice(0, 4).map((p, i) => personRow(p, i)));
  const full = $('#queueList');
  if (!queue.length) empty(full, 'Người tặng quà đủ điều kiện sẽ được xếp hàng tại đây.');
  else full.replaceChildren(...queue.map((p, i) => personRow(p, i, { remove: true })));
  const champions = $('#leaderboard');
  if (!s.leaderboard?.length) empty(champions, 'Danh hiệu đầu tiên đang chờ chủ nhân.', '♛');
  else champions.replaceChildren(...s.leaderboard.slice(0, 5).map((p, i) => personRow(p, i, { ranking: true })));
  const recent = $('#recentActivity');
  if (!s.recent?.length) empty(recent, 'Những diễn biến đầu tiên sẽ xuất hiện tại đây.', 'ϟ');
  else recent.replaceChildren(...s.recent.slice(-5).reverse().map(event => {
    const row = element('div', 'activity-row');
    row.append(element('span', 'activity-dot'), element('span', 'activity-text', event.text || moveLabels[event.type] || event.type), element('time', '', time(event.at)));
    return row;
  }));
}
function renderSettings(settings) {
  $$('[data-setting]').forEach(input => {
    const key = input.dataset.setting;
    if (!(key in settings)) return;
    if (document.activeElement === input && input.type !== 'checkbox') return;
    if (input.type === 'checkbox') input.checked = !!settings[key];
    else input.value = settings[key];
    updateOutput(input);
  });
}
function renderState(s) {
  if (!s || !s.match) return;
  state = s;
  $('#modeLive').setAttribute('aria-pressed', String(s.mode === 'live'));
  $('#modeDemo').setAttribute('aria-pressed', String(s.mode === 'demo'));
  $('#heroMode').textContent = s.mode === 'demo' ? 'DEMO ARENA' : 'LIVE ARENA';
  $('#heroMode').classList.toggle('lime-pill', s.mode === 'demo');
  $('#heroDescription').replaceChildren(document.createTextNode(s.mode === 'demo' ? 'Phòng thử đang hoạt động. Mọi diễn biến ở đây được tách khỏi dữ liệu LIVE thật.' : 'Kết nối TikTok, đón người thách đấu. Chạy Phòng thử để kiểm tra hình và tiếng trước giờ lên sóng.'));
  $('#heroMatch').textContent = `TRẬN ĐẤU #${String(s.match.number || 1).padStart(2, '0')}`;
  $('.hero-stamp strong').textContent = String(s.match.number || 1).padStart(2, '0');
  $('#heroDemo').textContent = s.demo?.running ? 'Ⅱ Dừng trận mẫu' : '▶ Chạy trận mẫu';
  $('#overviewDemoToggle').textContent = $('#demoToggle').textContent = s.demo?.running ? 'Ⅱ Dừng demo tự động' : '▶ Bật demo tự động';
  $('#statViewers').textContent = number(s.stats?.viewers);
  $('#statCoins').textContent = number(s.stats?.coins);
  $('#statPunches').textContent = number(s.stats?.punches);
  $('#statMatches').textContent = number(s.stats?.matches);
  $('#phaseBadge').textContent = $('#operatorPhase').textContent = phaseLabels[s.match.phase] || s.match.phase;
  $('#roundLabel').textContent = `TRẬN ${String(s.match.number || 1).padStart(2, '0')}`;
  const duration = s.match.phase === 'countdown' ? s.match.countdownMs : s.match.remainingMs;
  const seconds = Math.max(0, Math.ceil((duration || 0) / 1000));
  $('#matchTimer').textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  for (const side of ['red', 'blue']) {
    const person = s.match.fighters?.[side];
    const prefix = side[0].toUpperCase() + side.slice(1);
    const av = $(`#${side}Avatar`);
    if (av.dataset.identity !== `${person?.uid}|${person?.avatar}|${person?.name}`) {
      avatar(av, person); av.dataset.identity = `${person?.uid}|${person?.avatar}|${person?.name}`;
    }
    $(`#${side}Name`).textContent = person?.name || 'Chờ võ sĩ';
    $(`#operator${prefix}Name`).textContent = person?.name || 'Chưa có võ sĩ';
    $(`#${side}HpBar`).style.width = `${Math.max(0, Math.min(100, 100 * (person?.hp || 0) / (person?.maxHp || 1)))}%`;
    $(`#${side}Hp`).textContent = person ? `${number(person.hp)} / ${number(person.maxHp)} HP` : '— / — HP';
    $(`#operator${prefix}Hp`).textContent = person ? `${number(person.hp)} HP` : '— HP';
    $$(`.move-grid[data-side="${side}"] button`).forEach(button => button.disabled = !person || s.match.phase !== 'fighting');
    $(`[data-heal="${side}"]`).disabled = !person;
  }
  $('#matchResult').hidden = !s.match.result;
  $('#matchResult').textContent = s.match.result ? `${s.match.result.winner ? `${s.match.result.name || s.match.fighters?.[s.match.result.winner]?.name || 'Võ sĩ'} chiến thắng` : 'Hai võ sĩ hòa nhau'} · ${s.match.result.reason || 'Trận đấu kết thúc'}` : '';
  $$('[data-rpc="match.pause"]').forEach(button => button.disabled = !['fighting', 'countdown'].includes(s.match.phase));
  $$('[data-rpc="match.resume"]').forEach(button => button.disabled = s.match.phase !== 'paused');
  const demo = s.mode === 'demo';
  $('#simFields').disabled = !demo;
  $('#simNotice').hidden = demo;
  $('#simName').disabled = $('#simActor').value !== 'custom';
  $('#footerMode').textContent = `${demo ? 'PHÒNG THỬ · DỮ LIỆU RIÊNG' : 'LIVE THẬT'} · ${connected ? 'MÁY CHỦ ĐÃ KẾT NỐI' : 'ĐANG NỐI LẠI'}`;
  $('#version').textContent = s.app?.version ? `v${s.app.version}` : 'VÕ ĐÀI LIVE';
  renderPeople(s);
  renderSettings(s.settings || {});
  const map = s.settings?.giftMap || catalog.map || {};
  const mapSignature = JSON.stringify([map, catalog.gifts.length, catalog.actions]);
  if (mapSignature !== lastGiftMapSignature) {
    lastGiftMapSignature = mapSignature;
    catalog.map = map;
    renderGiftMappings();
    if ($('#giftDialog').open) renderGiftPicker();
  }
  renderConnection(s.connection || {});
  if (s.music) renderMusic(s.music);
  if (typeof s.settings?.phoneEnabled === 'boolean') $('#phoneEnabled').checked = s.settings.phoneEnabled;
}
function renderConnection(connection) {
  const labels = { idle: 'CHƯA KẾT NỐI', connecting: 'ĐANG KẾT NỐI', connected: 'ĐANG NHẬN LIVE', error: 'LỖI KẾT NỐI', reconnecting: 'ĐANG NỐI LẠI', disconnected: 'ĐÃ NGẮT' };
  const active = connection.status === 'connected';
  $('#tiktokStatus').textContent = labels[connection.status] || labels.idle;
  $('#tiktokStatus').classList.toggle('lime-pill', active);
  $('#tiktokMessage').textContent = connection.error || (active ? `Đang nhận tương tác từ @${connection.uniqueId}.` : connection.status === 'connecting' ? `Đang kết nối @${connection.uniqueId || ''}…` : 'Bắt đầu LIVE trên TikTok rồi bấm Kết nối.');
  $('#tiktokMessage').classList.toggle('error', !!connection.error);
  if (connection.uniqueId && document.activeElement !== $('#tiktokId')) $('#tiktokId').value = connection.uniqueId;
  $('#connectButton').disabled = connection.status === 'connecting';
  $('#disconnectButton').disabled = !['connected', 'connecting', 'reconnecting'].includes(connection.status);
  $('#signStatus').textContent = connection.hasSignKey ? 'Đã lưu API key dịch vụ. Giá trị khóa không được trả ra trình duyệt.' : 'Chưa cấu hình API key dịch vụ. Ứng dụng không yêu cầu key bản quyền.';
  if (connection.error && connection.error !== lastConnectionError) log(`TikTok: ${connection.error}`, 'error');
  lastConnectionError = connection.error || '';
}
function onEvent(event) {
  if (!event?.type) return;
  if (event.type === 'music') return renderMusic(event);
  if (event.type === 'connection') return renderConnection(event);
  let message = event.text || event.message || '';
  if (event.type === 'hit') message = `${event.attacker || event.side} → ${event.defender || event.target}: ${moveLabels[event.move] || event.move}, −${number(event.damage)} HP${event.critical ? ' · CHÍ MẠNG' : ''}${event.dodged ? ' · NÉ THÀNH CÔNG' : ''}`;
  else if (event.type === 'gift') message = `${event.name || 'Khán giả'} tặng ${number(event.coins)} xu${event.move ? ` → ${moveLabels[event.move] || event.move}` : ''}`;
  else if (event.type === 'ko') message = `KẾT THÚC: ${event.name || 'Võ sĩ'} chiến thắng · ${event.reason || 'KO'}`;
  else if (event.type === 'queue') message = `${event.name || 'Người xem'} · ${event.action || 'cập nhật hàng chờ'}`;
  else if (event.type === 'match') message = `Trận đấu: ${phaseLabels[event.phase] || event.phase || event.action || 'đã cập nhật'}`;
  else if (event.type === 'defend') message = `${event.side === 'red' ? 'Góc đỏ' : 'Góc xanh'} ${event.move === 'dodge' ? 'né đòn' : 'phòng thủ'}`;
  if (message && !['tts'].includes(event.type)) log(message, event.type === 'ko' ? 'success' : 'info', event.type === 'announcement' ? message : '');
}
function onStatus(ok) {
  const firstConnection = !connected && ok;
  connected = ok;
  const pill = $('#serverStatus');
  pill.className = `connection-pill ${ok ? 'connected' : 'offline'}`;
  pill.replaceChildren(element('i'), document.createTextNode(ok ? 'Máy chủ đã kết nối' : 'Mất kết nối · đang nối lại'));
  const warning = $('#persistentWarning');
  warning.hidden = ok;
  warning.textContent = 'Mất kết nối máy chủ. Giao diện đang giữ hình gần nhất và sẽ tự nối lại. Kiểm tra cửa sổ chạy ứng dụng.';
  if (firstConnection) {
    log('Đã nối máy chủ cục bộ.', 'success');
    run(loadCatalog()); run(loadLinks()); run(loadMusic());
  } else if (!ok) log('Mất kết nối máy chủ, đang thử lại…', 'error', 'server-offline');
}
const client = connect({ role: 'control', onState: renderState, onEvent, onStatus });

function showPage() {
  let slug = location.hash.slice(1);
  if (!pages[slug]) {
    try { slug = localStorage.getItem('vdl.page') || 'tong-quan'; } catch { slug = 'tong-quan'; }
    if (!pages[slug]) slug = 'tong-quan';
  }
  $$('.page').forEach(page => page.hidden = page.dataset.page !== slug);
  $$('[data-page-link]').forEach(link => {
    const current = link.dataset.pageLink === slug;
    link.classList.toggle('active', current);
    if (current) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  });
  $('#pageName').textContent = pages[slug][0];
  $('#pageTitle').textContent = pages[slug][1];
  $('#pageSubtitle').textContent = pages[slug][2];
  document.title = `${pages[slug][0]} · Võ Đài LIVE`;
  try { localStorage.setItem('vdl.page', slug); } catch {}
  window.scrollTo({ top: 0, behavior: 'instant' });
}
addEventListener('hashchange', showPage); showPage();
function refreshClock() { $('#clock').textContent = new Date().toLocaleTimeString('vi-VN', { hour12: false }); }
refreshClock(); setInterval(refreshClock, 1000);
function updateOutput(input) {
  const output = $(`#${input.id}Value`);
  if (output) output.textContent = `${input.value}%`;
}
$$('[data-setting]').forEach(input => {
  input.addEventListener('input', () => updateOutput(input));
  input.addEventListener('change', () => {
    if (!input.checkValidity()) { input.reportValidity(); return; }
    const value = input.type === 'checkbox' ? input.checked : ['number', 'range'].includes(input.type) ? Number(input.value) : input.value;
    run(call('settings.set', { settings: { [input.dataset.setting]: value } }, { success: 'Đã lưu cài đặt.' }).catch(error => {
      renderSettings(state?.settings || {}); throw error;
    }));
  });
});
$$('[data-rpc]').forEach(button => button.addEventListener('click', () => run(call(button.dataset.rpc, {}, { button }))));
$$('[data-finish]').forEach(button => button.addEventListener('click', () => {
  const winner = button.dataset.finish === 'draw' ? null : button.dataset.finish;
  if (!confirm(winner ? `Kết thúc trận và trao chiến thắng cho góc ${winner === 'red' ? 'đỏ' : 'xanh'}?` : 'Kết thúc trận với kết quả hòa?')) return;
  run(call('match.finish', { winner }, { button }));
}));
$$('[data-move]').forEach(button => button.addEventListener('click', () => run(call('fighter.attack', { side: button.closest('[data-side]').dataset.side, move: button.dataset.move }, { button }))));
$$('[data-heal]').forEach(button => button.addEventListener('click', () => run(call('fighter.heal', { side: button.dataset.heal, amount: 100 }, { button }))));
$('#resetMatch').onclick = () => { if (confirm('Đặt lại trận hiện tại? Trận đang chạy sẽ được hủy.')) run(call('match.reset', {}, { success: 'Đã đặt lại trận.', button: $('#resetMatch') })); };
$('#resetSession').onclick = () => { if (confirm('Bắt đầu buổi LIVE mới và xóa dữ liệu của phiên hiện tại? Hãy xuất dữ liệu trước nếu cần.')) run(call('session.reset', {}, { success: 'Đã tạo phiên mới.', button: $('#resetSession') })); };
$('#clearQueue').onclick = () => { if (confirm('Xóa toàn bộ người đang chờ lên đài?')) run(call('queue.clear', {}, { button: $('#clearQueue') })); };
$('#queueForm').onsubmit = event => {
  event.preventDefault();
  const name = $('#queueName').value.trim(); if (!name) return;
  const uid = $('#queueUid').value.trim() || `manual_${crypto.randomUUID?.() || Date.now().toString(36)}`;
  run(call('queue.add', { uid, name }, { success: 'Đã thêm người thách đấu.', button: $('#queueForm button[type=submit]') }).then(() => { $('#queueName').value = ''; $('#queueUid').value = ''; }));
};
async function setMode(mode) {
  if (state?.mode === mode) return;
  const message = mode === 'live' ? 'Chuyển sang LIVE thật? Trận mô phỏng sẽ dừng; dữ liệu LIVE riêng được khôi phục.' : 'Chuyển sang Phòng thử? Tương tác LIVE thật sẽ không đi vào trận mô phỏng.';
  if (!confirm(message)) return;
  await call('mode.set', { mode }, { success: mode === 'demo' ? 'Đã vào Phòng thử.' : 'Đã vào LIVE thật.' });
}
$('#modeLive').onclick = () => run(setMode('live'));
$('#modeDemo').onclick = () => run(setMode('demo'));
async function toggleDemo({ hero = false } = {}) {
  const running = !!state?.demo?.running;
  if (state?.mode !== 'demo') {
    if (!hero && !confirm('Chuyển sang Phòng thử và chạy trận mẫu? Tương tác LIVE thật sẽ được tách riêng.')) return;
    await call('mode.set', { mode: 'demo' });
  }
  await call('demo.set', { on: !running }, { success: running ? 'Đã dừng demo tự động.' : 'Demo tự động đang chạy.' });
}
$('#heroDemo').onclick = () => run(toggleDemo({ hero: true }));
$('#overviewDemoToggle').onclick = () => run(toggleDemo());
$('#demoToggle').onclick = () => run(toggleDemo());
$('#simActor').onchange = () => $('#simName').disabled = $('#simActor').value !== 'custom';
function simPerson() {
  const actor = $('#simActor').value;
  const fighter = state?.match.fighters?.[actor];
  if (actor !== 'custom' && !fighter) throw new Error('Góc này chưa có võ sĩ. Bắt đầu trận mẫu hoặc chọn khách tùy chọn.');
  return fighter ? { uid: fighter.uid, name: fighter.name } : { uid: `sim_${$('#simName').value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w]/g, '_').slice(0, 60) || 'khach'}`, name: $('#simName').value.trim() || 'Khách thử' };
}
async function simulate(kind, payload = {}) {
  if (state?.mode !== 'demo') throw new Error('Mô phỏng chỉ sử dụng trong Phòng thử.');
  let person;
  try { person = simPerson(); } catch (error) { toast(error.message, true); return; }
  await call(`sim.${kind}`, { ...person, ...payload });
}
$('#simChatForm').onsubmit = event => { event.preventDefault(); run(simulate('chat', { text: $('#simText').value })); };
$$('[data-chat]').forEach(button => button.onclick = () => { $('#simText').value = button.dataset.chat; run(simulate('chat', { text: button.dataset.chat })); });
$('#simGift').onclick = () => {
  if (!$('#simCoins').checkValidity()) { $('#simCoins').reportValidity(); return; }
  run(simulate('gift', { coins: Number($('#simCoins').value), giftName: 'Quà thử', count: 1, eventId: `sim_gift_${crypto.randomUUID?.() || Date.now()}` }));
};
$('#simLike').onclick = () => run(simulate('like', { count: 10 }));
$('#simJoin').onclick = () => run(simulate('join'));

async function loadCatalog() {
  if (catalogLoading) return;
  catalogLoading = true;
  try {
    const response = await call('gift.catalog', {}, { silent: true });
    catalog = { gifts: Array.isArray(response?.gifts) ? response.gifts : [], actions: Array.isArray(response?.actions) ? response.actions : [], map: response?.map || state?.settings?.giftMap || {} };
    lastGiftMapSignature = '';
    renderGiftMappings();
    $('#catalogInfo').textContent = `${number(catalog.gifts.length)} quà trong catalog · tìm bằng tên Việt, tên Anh hoặc mã quà.`;
  } catch {
    $('#catalogInfo').textContent = 'Chưa đọc được catalog quà. Kiểm tra kết nối máy chủ hoặc thử tải lại trang.';
  } finally { catalogLoading = false; }
}
function renderGiftMappings() {
  const container = $('#giftMappings');
  if (!catalog.actions.length) { empty(container, 'Đang đọc các hành động quà…', '✧'); return; }
  const byId = new Map(catalog.gifts.map(gift => [String(gift.id), gift]));
  container.replaceChildren(...catalog.actions.map(action => {
    const row = element('div', 'gift-map-row');
    row.append(element('span', 'gift-map-icon', action.emoji || '✧'));
    const main = element('div', 'gift-map-main'); main.append(element('strong', '', action.label || moveLabels[action.id] || action.id));
    const chips = element('div', 'gift-chips');
    const ids = Object.entries(catalog.map || {}).filter(([, value]) => value === action.id).map(([id]) => id);
    if (!ids.length) chips.append(element('span', 'gift-none', 'Chưa gán quà cụ thể'));
    for (const id of ids) {
      const gift = byId.get(id), chip = element('span', 'gift-chip');
      const imageUrl = safeImage(gift?.img);
      if (imageUrl) { const image = new Image(); image.alt = ''; image.loading = 'lazy'; image.referrerPolicy = 'no-referrer'; image.src = imageUrl; image.onerror = () => image.remove(); chip.append(image); }
      chip.append(document.createTextNode(gift ? `${gift.name} · ${number(gift.coins)} xu` : `Quà #${id}`));
      const remove = element('button', '', '×'); remove.setAttribute('aria-label', `Bỏ gán quà ${gift?.name || id}`);
      remove.onclick = () => { const map = { ...catalog.map }; delete map[id]; run(saveGiftMap(map)); };
      chip.append(remove); chips.append(chip);
    }
    main.append(chips); row.append(main);
    const choose = element('button', 'button secondary small', '＋ Chọn quà');
    choose.onclick = () => {
      giftAction = action.id; $('#giftDialogTitle').textContent = action.label || action.id;
      $('#giftSearch').value = ''; renderGiftPicker(); $('#giftDialog').showModal(); $('#giftSearch').focus();
    };
    row.append(choose); return row;
  }));
}
async function saveGiftMap(map) {
  const response = await call('gift.map', { map }, { success: 'Đã lưu hành động quà.' });
  catalog.map = response?.map || response?.giftMap || map;
  renderGiftMappings(); if ($('#giftDialog').open) renderGiftPicker();
}
const normalize = text => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase();
function renderGiftPicker() {
  const search = normalize($('#giftSearch').value).trim();
  const matches = catalog.gifts.filter(gift => !search || normalize(`${gift.name} ${gift.en} ${gift.id}`).includes(search));
  const shown = matches.slice(0, 150);
  $('#giftPickerInfo').textContent = `${number(matches.length)} kết quả${matches.length > shown.length ? ` · hiển thị ${shown.length} quà đầu, gõ thêm để thu hẹp` : ''}. Bấm quà để gán hoặc bỏ gán.`;
  $('#giftPickerGrid').replaceChildren(...shown.map(gift => {
    const selected = catalog.map?.[String(gift.id)] === giftAction;
    const button = element('button', `gift-pick${selected ? ' selected' : ''}`);
    button.setAttribute('aria-pressed', String(selected)); button.title = `${gift.en || gift.name} · mã ${gift.id}`;
    const imageUrl = safeImage(gift.img);
    if (imageUrl) {
      const image = new Image(); image.src = imageUrl; image.alt = ''; image.loading = 'lazy'; image.referrerPolicy = 'no-referrer';
      image.onerror = () => image.replaceWith(element('span', 'gift-fallback', '✧'));
      button.append(image);
    } else button.append(element('span', 'gift-fallback', '✧'));
    button.append(element('strong', '', gift.name), element('small', '', `${number(gift.coins)} xu`));
    if (selected) button.append(element('span', 'selected-check', '✓'));
    button.onclick = () => {
      const map = { ...catalog.map };
      if (selected) delete map[String(gift.id)]; else map[String(gift.id)] = giftAction;
      run(saveGiftMap(map));
    };
    return button;
  }));
  if (!shown.length) empty($('#giftPickerGrid'), 'Không có quà khớp từ khóa.');
}
$('#giftSearch').oninput = renderGiftPicker;
$('#closeGiftDialog').onclick = () => $('#giftDialog').close();
$('#giftDialog').onclick = event => { if (event.target === $('#giftDialog')) { const rect = $('#giftDialog').getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) $('#giftDialog').close(); } };
$('#giftRefresh').onclick = () => run(call('gift.refresh', {}, { success: 'Đã cập nhật catalog.', button: $('#giftRefresh') }).then(loadCatalog));

$('#sayForm').onsubmit = event => {
  event.preventDefault(); const text = $('#sayText').value.trim(); if (!text) return;
  run(call('mc.say', { text }, { success: 'Đã gửi câu vào hàng đợi MC.', button: $('#sayForm button[type=submit]') }).then(() => $('#sayText').value = ''));
};
$('#voiceTest').onclick = () => run(call('mc.test', {}, { success: 'Đã gửi câu thử giọng. Mở tiếng overlay để nghe.', button: $('#voiceTest') }));
function renderMusic(music) {
  const files = Array.isArray(music?.files) ? music.files : [];
  const normalized = files.map(file => typeof file === 'string' ? { name: decodeURIComponent(file.split('/').pop()), url: file, size: 0 } : file);
  const signature = JSON.stringify(normalized);
  if (signature === lastMusicSignature) return;
  lastMusicSignature = signature; cachedMusic = normalized;
  $('#musicCount').textContent = `${normalized.length} bài`;
  const container = $('#musicList');
  if (!normalized.length) { empty(container, 'Chưa có nhạc. Thêm bản nhạc bạn có quyền phát.', '♫'); return; }
  container.replaceChildren(...normalized.map(file => {
    const row = element('div', 'music-row'); row.append(element('span', 'music-icon', '♫'));
    const details = element('div', 'person-details');
    details.append(element('strong', '', file.name || 'Nhạc nền'), element('small', '', file.size ? `${(file.size / 1048576).toFixed(1)} MiB` : 'Tệp âm thanh'));
    row.append(details);
    const remove = element('button', 'button danger small', 'Xóa');
    remove.setAttribute('aria-label', `Xóa nhạc ${file.name}`);
    remove.onclick = () => { if (confirm(`Xóa bài “${file.name}” khỏi thư mục nhạc?`)) run(call('music.delete', { name: file.name }, { success: 'Đã xóa bài nhạc.', button: remove }).then(loadMusic)); };
    row.append(remove); return row;
  }));
}
async function loadMusic() { try { const result = await call('music.list', {}, { silent: true }); if (result) renderMusic(result); } catch {} }
$('#chooseMusic').onclick = () => $('#musicFiles').click();
$('#musicFiles').onchange = () => { run(uploadMusic([...$('#musicFiles').files])); $('#musicFiles').value = ''; };
const drop = $('#musicDrop');
for (const event of ['dragenter', 'dragover']) drop.addEventListener(event, e => { e.preventDefault(); drop.classList.add('dragging'); });
for (const event of ['dragleave', 'drop']) drop.addEventListener(event, e => { e.preventDefault(); drop.classList.remove('dragging'); });
drop.addEventListener('drop', e => run(uploadMusic([...e.dataTransfer.files])));
function uploadFile(file) {
  return new Promise(resolve => {
    const row = element('div', 'upload-row'), name = element('span', '', file.name), progress = document.createElement('progress'), result = element('small', '', '0%');
    progress.max = 100; progress.value = 0; row.append(name, progress, result); $('#uploadProgress').append(row);
    const xhr = new XMLHttpRequest(); xhr.open('POST', '/upload/music'); xhr.setRequestHeader('X-File-Name', encodeURIComponent(file.name)); xhr.setRequestHeader('Content-Type', 'application/octet-stream'); xhr.timeout = 180000;
    xhr.upload.onprogress = e => { if (e.lengthComputable) { const value = Math.round(e.loaded / e.total * 100); progress.value = value; result.textContent = `${value}%`; } };
    xhr.onload = () => {
      let response; try { response = JSON.parse(xhr.responseText); } catch {}
      const ok = xhr.status >= 200 && xhr.status < 300;
      result.textContent = ok ? '✓ Xong' : '✗ Lỗi';
      if (!ok) { const message = response?.error || response?.message || `Tải lên lỗi HTTP ${xhr.status}`; toast(`${file.name}: ${message}`, true); log(`Upload ${file.name}: ${message}`, 'error'); }
      else { log(`Đã thêm nhạc: ${file.name}`, 'success'); setTimeout(() => row.remove(), 4500); }
      resolve(ok);
    };
    const failed = () => { result.textContent = '✗ Mất kết nối'; toast(`Không tải được ${file.name}. Kiểm tra kết nối rồi thử lại.`, true); resolve(false); };
    xhr.onerror = failed; xhr.ontimeout = failed; xhr.onabort = failed; xhr.send(file);
  });
}
async function uploadMusic(files) {
  const accepted = [];
  for (const file of files) {
    if (!/\.(mp3|m4a|ogg|wav|aac)$/i.test(file.name)) { toast(`${file.name}: định dạng nhạc chưa được hỗ trợ.`, true); continue; }
    if (file.size > 50 * 1024 * 1024) { toast(`${file.name}: vượt giới hạn 50 MiB.`, true); continue; }
    accepted.push(file);
  }
  let cursor = 0;
  const worker = async () => { while (cursor < accepted.length) { const file = accepted[cursor++]; await uploadFile(file); } };
  await Promise.all(Array.from({ length: Math.min(3, accepted.length) }, worker));
  await loadMusic();
}

$('#connectForm').onsubmit = event => {
  event.preventDefault(); const uniqueId = $('#tiktokId').value.trim(); if (!uniqueId) return;
  const perform = async () => {
    if (state?.mode === 'demo') {
      if (!confirm('Bạn đang ở Phòng thử. Chuyển sang LIVE thật và kết nối TikTok?')) return;
      await call('mode.set', { mode: 'live' });
    }
    await call('tiktok.connect', { uniqueId }, { button: $('#connectButton') });
    log(`Đã yêu cầu kết nối TikTok @${uniqueId.replace(/^@/, '')}.`);
  };
  run(perform());
};
$('#disconnectButton').onclick = () => run(call('tiktok.disconnect', {}, { success: 'Đã ngắt TikTok.', button: $('#disconnectButton') }));
$('#signForm').onsubmit = event => {
  event.preventDefault(); const key = $('#signKey').value.trim(); if (!key) { toast('Nhập API key dịch vụ hoặc chọn Xóa.', true); return; }
  run(call('sign.set', { key }, { success: 'Đã lưu API key dịch vụ.', button: $('#signForm button[type=submit]') }).then(() => $('#signKey').value = ''));
};
$('#clearSign').onclick = () => { if (confirm('Xóa API key dịch vụ đã lưu?')) run(call('sign.set', { key: '' }, { success: 'Đã xóa API key dịch vụ.', button: $('#clearSign') })); };
async function loadLinks() {
  try {
    latestLinks = await call('obs.links', {}, { silent: true });
    const local = Array.isArray(latestLinks?.local) ? latestLinks.local[0] : latestLinks?.local;
    $('#overlayLink').value = local || `${location.origin}/overlay.html`;
    $('#phoneEnabled').checked = !!latestLinks?.phoneEnabled;
    const container = $('#phoneLinks');
    if (!latestLinks?.phoneEnabled) empty(container, 'Bật LAN để tạo đường dẫn xem trên điện thoại.', '↗');
    else if (!latestLinks.phone?.length) empty(container, 'Chưa tìm thấy địa chỉ mạng. Kiểm tra Wi-Fi hoặc cấu hình máy chủ.');
    else container.replaceChildren(...latestLinks.phone.map(url => {
      const row = element('div', 'phone-link'), value = element('code', '', url), button = element('button', 'button secondary small', 'Sao chép');
      button.onclick = () => run(copy(url)); row.append(value, button); return row;
    }));
  } catch { $('#overlayLink').value = `${location.origin}/overlay.html`; }
}
async function copy(text) {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const field = element('textarea', ''); field.value = text; field.style.position = 'fixed'; field.style.opacity = '0'; document.body.append(field); field.select();
    const ok = document.execCommand('copy'); field.remove();
    if (!ok) { toast('Trình duyệt chưa cho sao chép. Chọn và sao chép đường dẫn trong ô.', true); return; }
  }
  toast('Đã sao chép đường dẫn.');
}
$('#copyOverlay').onclick = () => run(copy($('#overlayLink').value || `${location.origin}/overlay.html`));
$('#copyTransparent').onclick = () => {
  const url = new URL($('#overlayLink').value || '/overlay.html', location.origin); url.searchParams.set('bg', 'transparent'); run(copy(url.href));
};
$('#phoneEnabled').onchange = () => {
  const on = $('#phoneEnabled').checked;
  run(call('phone.set', { on }, { success: on ? 'Đã bật xem overlay qua LAN.' : 'Đã tắt xem qua LAN.' }).then(loadLinks).catch(error => { $('#phoneEnabled').checked = !on; throw error; }));
};
$('#openWindow').onclick = () => run(call('obs.open', {}, { button: $('#openWindow') }).catch(() => {
  window.open('/overlay.html', '_blank', 'noopener');
}));
$('#previewSound').onclick = () => {
  previewMuted = !previewMuted;
  $('#previewSound').textContent = previewMuted ? '♩ Tắt tiếng' : '♫ Có tiếng';
  $('#previewSound').setAttribute('aria-pressed', String(!previewMuted));
  $('#overlayPreview').src = previewMuted ? '/overlay.html?mute=1' : '/overlay.html';
  if (!previewMuted) toast('Đã cho phép tiếng preview. Chạm nút mở âm thanh trong khung xem trước; tắt một nguồn nếu OBS đang phát tiếng.');
};
$('#topExport').onclick = () => { const link = element('a'); link.href = '/download/state'; link.download = ''; document.body.append(link); link.click(); link.remove(); };
$('#clearLogs').onclick = () => { logs = []; $('#eventLog').replaceChildren(); log('Đã xóa nhật ký trên màn hình.'); };
$('#downloadLogs').onclick = () => {
  const blob = new Blob([logs.map(entry => `[${new Date(entry.at).toISOString()}] ${entry.level.toUpperCase()} ${entry.text}`).join('\n')], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob), link = element('a'); link.href = url; link.download = `vo-dai-live-nhat-ky-${new Date().toISOString().slice(0, 10)}.txt`; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
};
addEventListener('beforeunload', () => client.close?.());
log('Phòng điều khiển đã mở. Chọn Phòng thử để kiểm tra trước khi LIVE.');
