# Kiến trúc và tích hợp Võ Đài LIVE

## 1. Tầng chương trình

```text
TikTok / JSON-RPC event.* / mô phỏng
               ↓ sự kiện chuẩn hóa
src/arena.mjs: nhận vé, hàng chờ, HP, phòng thủ, KO, thành tích
               ↓ event + snapshot                  ↓ export
server.mjs → WebSocket → overlay/control        storage → data/arena.json
               ↓
src/audio.mjs → kịch bản MC, TTS/cache, nhạc → overlay Audio/Web Audio
```

- `server.mjs`: lắp ráp, vòng tick 250ms, WebSocket, dispatch RPC, demo tự động, trạng thái kết nối, shutdown.
- `src/arena.mjs`: engine thuần theo clock/callback truyền vào, không tự mở timer; server là nguồn quyết định HP và kết quả.
- `src/tiktok.mjs`: kết nối TikTok, chuẩn hóa người/quà, gom combo, generation guard khi reconnect/disconnect; không chứa luật boxing.
- `src/catalog.mjs`: catalog quà đóng kèm `assets/gifts.json`, bản cập nhật người dùng trong data.
- `src/audio.mjs`: lời bình luận theo sự kiện, queue ưu tiên, TTS/cache, nhạc upload/quét/xóa.
- `src/http.mjs`: static, Range, body limits, auth local, headers bảo vệ, JSON-RPC và upload.
- `src/storage.mjs`: tách thư mục mã/dữ liệu, ghi JSON qua temp+rename, debounce lưu 400ms và flush.
- `public/index.html` + control JS/CSS: bảng vận hành.
- `public/overlay.html` + overlay/fighters/sound: renderer dọc, võ sĩ SVG/animation, FX, âm thanh và client push.

Không có backend database, frontend bundler, LLM, app license hoặc dịch vụ cập nhật thương mại bắt buộc. `node_modules` có dependencies của nhà cung cấp; đây không phải bằng chứng UI dùng React/TypeScript.

## 2. Engine API

```js
import { createArena } from './src/arena.mjs';
const arena = createArena({
  initial: {},
  onEvent: event => console.log(event.type),
  onSave: state => saveDurableState(state),
  now: Date.now,
  random: Math.random,
});

arena.command('queue.add', { uid: 'user-1', name: 'Hổ Đỏ' });
arena.ingest('chat', { uid: 'user-1', name: 'Hổ Đỏ', text: 'đấm móc' }, { source: 'live' });
arena.tick(); // server gọi mỗi 250ms
const forUI = arena.snapshot();
const forDisk = arena.export();
```

Engine exports thêm `DEFAULT_SETTINGS`, `MOVES`, `GIFT_ACTIONS`. Trạng thái trận: waiting → countdown → fighting → finished; paused giữ phase trước đó và clock còn lại. Reset thay match object, xóa trạng thái phòng thủ/cooldown; không để timer phần thưởng trận cũ tồn tại. Engine không tạo timer riêng.

Snapshot chứa mode, match/fighters/HP/stamina/energy, queue, leaderboard, supporters, stats, settings, recent. Server bổ sung app, connection, demo, music, audio, logs. Snapshot/export là bản sao, UI không có tham chiếu trực tiếp để sửa engine.

Export bền vững schema `v:1` chứa settings và LIVE. Demo dùng session riêng trong RAM, không xuất bảng demo vào phần live. Khi khôi phục một trận chưa kết thúc, các võ sĩ được trả hàng chờ; trận xong chỉ giữ người thắng chờ đấu tiếp, không tự phục hồi người thua.

## 3. Chuẩn sự kiện đầu vào

```json
{
  "uid": "stable-user-id",
  "name": "Tên hiển thị",
  "avatar": "https://example.org/avatar.jpg",
  "text": "đấm móc",
  "coins": 5,
  "giftId": "5487",
  "giftName": "Quà",
  "eventId": "provider-delivery-id"
}
```

`uid` ổn định quan trọng hơn tên hiển thị. `coins` là **tổng xu sự kiện quà đã chốt**, không phải giá một món nếu combo có nhiều món. Engine không nhân lại `count`; adapter phải gom/chốt đúng một lần. `eventId` giúp dedup per-user trong cửa sổ 10 phút, bộ nhớ dedup bị giới hạn. Tên, text, avatar được giới hạn/làm sạch; engine từ chối giá xu không hữu hạn/không dương.

Nguồn `source:'live'` chỉ nhận ở mode live, `source:'demo'` chỉ ở demo. Bình luận của người không trên đài không trở thành cú đánh. Gift map là object `{giftId: actionId}`, chỉ nhận ID số và hành động được phép.

## 4. HTTP/WS và token nội bộ

Bảng điều khiển được cấp cookie `arena_session` HttpOnly/SameSite Strict khi mở trên loopback. RPC còn nhận header `Authorization: Bearer ...` hoặc `X-Access-Token`. Token lưu cục bộ `data/app-config.json`; không đưa vào URL OBS, stream hoặc ảnh chụp màn hình.

Host/Origin phải nằm trong allowlist của cổng hiện tại. Control/RPC chỉ loopback ngay cả khi bật LAN. Overlay qua LAN là read-only. HTTP có CSP, nosniff, referrer policy, chống nhúng khác origin; WS có max payload và cắt client gửi chậm để hạn chế buffer phình.

```text
GET  /                    Bảng điều khiển local
GET  /overlay.html        Overlay chỉ xem
GET  /health              Kiểm tra tiến trình
POST /rpc                 JSON-RPC 2.0, cần token/cookie local
GET  /ws?role=overlay     WebSocket push (upgrade)
GET  /ws?role=control     Push + RPC, cần cookie/token
POST /upload/music        Body nhị phân, header X-File-Name; local authenticated
GET  /download/state      Export game JSON; local authenticated
GET  /audio/<file>.mp3    Cache giọng an toàn
GET  /music/<name>        Nhạc, hỗ trợ Range
```

WebSocket thông báo `{type:'state',state:{...}}` và các event `{type:'hit',...}`, `ko`, `defend`, `heal`, `match`, `queue`, `gift`, `tts`, `music`, `connection`, `log`. Client dùng `public/js/client.js`, tự thử nối lại sau 1,5 giây. Overlay không được gửi lệnh điều khiển; control gửi JSON-RPC qua fetch cùng cookie hoặc WebSocket đã xác thực.

RPC tối đa 64 KiB, batch 1–20 lệnh được xử lý tuần tự, upload nhạc tối đa 50 MiB. Các giới hạn bảo vệ local app, không biến nó thành dịch vụ game công khai qua Internet.

## 5. Tích hợp Streamer.bot/TikFinity/script

Ứng dụng cung cấp JSON-RPC, không tự nhận mọi định dạng webhook của phần mềm bên ngoài. Chạy bridge trên **cùng máy**, lấy token cục bộ một cách riêng tư, gửi request:

```http
POST /rpc HTTP/1.1
Host: localhost:3100
Content-Type: application/json
Authorization: Bearer <RPC_TOKEN_NOI_BO>

{"jsonrpc":"2.0","id":1,"method":"event.chat","params":{"uid":"viewer-123","name":"Khách LIVE","text":"đấm móc"}}
```

Quà đã tổng hợp:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "event.gift",
  "params": {
    "uid": "viewer-123",
    "name": "Khách LIVE",
    "giftId": "5487",
    "coins": 5,
    "eventId": "gift-delivery-unique"
  }
}
```

Dùng `event.chat/gift/like/join` khi live; `sim.chat/gift/like/join` chỉ demo. Không kết nối TikTok trực tiếp và bridge cùng nguồn sự kiện một lúc nếu bridge không có cơ chế loại trùng ID; hai đường có thể coi cùng quà là hai sự kiện khác nhau.

### Nhóm phương thức RPC

| Nhóm | Phương thức |
|---|---|
| Đọc/cấu hình | state.get, state.export, settings.set |
| Trận | match.start, match.pause, match.resume, match.finish, match.next, match.reset, session.reset |
| Võ sĩ | fighter.attack, fighter.heal |
| Hàng chờ | queue.add, queue.remove, queue.clear |
| Chế độ | mode.set, demo.set |
| TikTok | tiktok.connect, tiktok.disconnect, sign.set |
| Quà | gift.catalog, gift.refresh, gift.map |
| MC/nhạc | mc.say, mc.test, music.list, music.delete |
| Phát sóng | obs.links, obs.open, phone.set |
| Sự kiện | event.chat/like/gift/join, sim.chat/like/gift/join |

Một số phương thức thành công có thể trả thông tin nghiệp vụ thay vì chỉ `{ok:true}`. JSON-RPC error là lỗi yêu cầu/phương thức; event không phù hợp phase/nguồn có thể bị engine bỏ qua theo luật. Không dựa vào một response transport thành công để tự suy đã có sát thương; hãy kiểm tra snapshot/event.

## 6. Âm thanh và tài nguyên

MC chọn câu dựa move/critical/block/dodge/combo/KO, tên và trạng thái, không gọi LLM. `msedge-tts` tạo MP3 Nam Minh, cache theo text+voice+rate. Có timeout, backoff khi dịch vụ lỗi, queue ưu tiên và giới hạn cache. Server gửi URL âm thanh cho overlay; tiếng được phát ở browser/OBS, không phát trực tiếp từ console Node.

Khi không có MP3, event vẫn có chữ để UI/giọng hệ thống dự phòng. `ARENA_OFFLINE=1` chặn hoạt động TikTok/TTS/catalog refresh trong tích hợp, không phải sandbox mạng toàn tiến trình. Ảnh quà/avatar HTTPS bên ngoài có thể được trình duyệt tải nếu không chặn mạng riêng trong test.

Nhạc không được đính kèm mặc định. Upload kiểm tên file và chữ ký âm thanh; trùng tên tạo tên mới. Không sử dụng `data` hoặc profile người dùng của bộ mẫu. Với bản portable, dependencies/runtime được chép vào ZIP; dữ liệu và nhạc cá nhân không được gom.

## 7. Biến vận hành

| Biến | Tác dụng |
|---|---|
| PORT | Cổng ưu tiên thay 3100 |
| HOST | Địa chỉ bind local override; dùng cẩn thận, không thay auth policy |
| ARENA_HOME | Gốc dữ liệu/nhạc tách khỏi mã |
| ARENA_OFFLINE=1 | Không gọi TikTok/TTS/catalog refresh trong chế độ kiểm tra |
| ARENA_PHONE=1 | Yêu cầu bật chế độ xem điện thoại khi khởi chạy Windows |
| ARENA_LAN_HOST | Địa chỉ bind LAN override; hữu ích cho kiểm thử |

Không đưa key dịch vụ hoặc RPC token vào mã nguồn, lockfile, README hoặc gói phát hành.

## 8. Kiểm thử và giới hạn xác minh

`npm test` chạy node:test, có clock/random giả cho luật game. Các ca quan trọng: admission FIFO, chống spam, phòng thủ tiêu thụ một đòn, thể lực/năng lượng, gift damage cap và dedup, KO một lần, pause/resume, reset không tạo thưởng cũ, phân tách demo/live, restart và đầu vào không hợp lệ. Các module tích hợp/HTTP/âm thanh có test riêng trong `tests` khi được bàn giao.

`npm run check` kiểm cú pháp ứng dụng; kiểm tra trình duyệt xác minh render và thao tác local. Test mô phỏng không khẳng định một tài khoản TikTok đang LIVE nhận được sự kiện, endpoint Microsoft hiện có tiếng, hoặc Windows/firewall/OBS/iPhone/Android thật đã chạy.

Phát hành: `npm run package` tạo source ZIP; thêm `--runtime /path/node.exe` tạo Windows portable. Có checksum ZIP nhưng checksum tự tạo chỉ giúp phát hiện thay đổi so tệp checksum đã cung cấp, không tự xác minh danh tính nhà phát hành. Cập nhật thủ công giữ dữ liệu/nhạc; không có dịch vụ auto-update riêng.
