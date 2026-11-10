# Kiến trúc và tích hợp Võ Đài LIVE 1.1

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

Engine exports thêm `DEFAULT_SETTINGS`, `MOVES`, `GIFT_ACTIONS`. Trạng thái trận: waiting → countdown → fighting → rest → fighting … → finished. Hết hiệp chuyển rest, không chốt tỷ số; finished chỉ khi hạ đo ván hoặc trọng tài chỉ định đỏ/xanh. `match.finish` với null/không có winner bị từ chối; không có kết quả hòa. Paused giữ phase trước đó, thời gian đòn, buff/phòng thủ và clock còn lại. Reset thay match object, xóa trạng thái phòng thủ/cooldown; không để timer phần thưởng trận cũ tồn tại. Engine không tạo timer riêng.

Snapshot chứa mode, match/fighters/HP/stamina/energy, queue, leaderboard, supporters, stats, settings, recent. Server bổ sung app, connection, demo, music, audio, logs và `giftMenu` được giải từ luật xu theo góc.

Trường mới 1.1:

| Trường | Ý nghĩa |
|---|---|
| settings.cornerGifts | Mảng `{coins,side,action}`, tối đa 32, xu nguyên duy nhất từ 1 đến 100.000, red/blue, action hợp lệ |
| settings.autoSparring/restSeconds | Nhịp đấm tự động nhẹ và thời gian nghỉ 2–20 giây |
| match.round/pressure/healMultiplier/overtime | Hiệp hiện tại, áp lực, hệ số hồi máu và hiệp quyết định |
| match.activeActions | Đòn đang chuẩn bị, sequenceId, durationMs, impactAt |
| match.supportQueue | Số lượt hỗ trợ xếp chờ, gắn với match ID |
| fighter.powerMultiplier/buffRemainingMs | Tăng sát thương ×1,3 có thời hạn 12 giây |
| fighter.comebackUsed/guardRemainingMs | Một cơ hội giáp phản công khi thấp máu |

Người thắng giữ đúng góc trước đó, không tự chuyển người thắng xanh thành đỏ. Renderer hiển thị vương miện/danh hiệu theo streak, minh họa SVG 2D có khớp và cơ thể theo tỷ lệ người; không có model 3D/ảnh người thật.

`attack.start` phát khi bắt đầu liên hoàn/tuyệt kỹ. HP chỉ đổi khi engine đến `impactAt` và phát `hit` cùng `sequenceId`, `choreographed:true`. Flurry khoảng 1.400 ms, ultimate 2.400 ms. Browser không tự cộng sát thương và không replay cả choreography khi nhận hit đã choreographed. Pause dừng lịch, reset/mode/next xóa pending và queue để không gây sát thương vào trận mới. Attack thông thường có thể giải quyết ngay.

Tự so găng luân phiên 1,8 giây/lượt ở 70% sát thương jab; các đòn comment/quà vẫn qua luật server. Hiệp 3/4/5 nâng pressure 1,4/2/3, sau đó tăng tới 4. Hệ số hồi 1/0,65/0,35/0 từ hiệp 1–2/3/4/5; ngân sách mỗi 10 giây còn chia pressure. Bộ luật này làm hồi máu hữu ích đầu trận nhưng tránh khóa trận vô hạn bằng hồi liên tục. Trần giftDamageCap vẫn áp dụng sau buff/chí mạng/pressure. Snapshot/export là bản sao, UI không có tham chiếu trực tiếp để sửa engine.

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

`uid` ổn định quan trọng hơn tên hiển thị. `coins` là số xu **mới ghi nhận trong sự kiện chuẩn hóa**, không phải giá một món nếu combo có nhiều món. Với lượt chốt bình thường, đây là tổng xu của lượt, dùng để khớp bảng góc; engine không nhân lại `count`.

Adapter chốt theo repeatEnd hoặc timeout 8 giây. Lần phát đầu của group có `isStreakCorrection:false`; bổ sung muộn có `isStreakCorrection:true`, `streakCoins` là tổng hiện biết, `supportGroupId` ổn định. Correction chỉ cộng phần xu mới vào record/stats/supporter rồi return `creditedOnly`; không route thêm góc, không tạo đòn/vé mới. Bridge phải giữ ngữ nghĩa tương tự, không gửi lại tổng đã tính làm xu mới. `eventId` giúp dedup per-user trong cửa sổ 10 phút, bộ nhớ dedup bị giới hạn. Tên, text, avatar được giới hạn/làm sạch; engine từ chối giá xu không hữu hạn/không dương.

Nguồn `source:'live'` chỉ nhận ở mode live, `source:'demo'` chỉ ở demo. Bình luận của người không trên đài không trở thành cú đánh. `settings.cornerGifts` khớp **chính xác coins của lượt chốt bình thường** khi có đủ hai võ sĩ; route này ưu tiên hơn UID người tặng, góc đã chọn và mapping giftId. Default red/blue: flurry5/6, ultimate30/50, heal10/20, boost99/100. Một mức xu không được có hai dòng; cập nhật lỗi bị từ chối nguyên bảng.

Gift map cũ là object `{giftId: actionId}`, chỉ nhận ID số và hành động được phép, được dùng khi không khớp bảng riêng. Không có góc nhận thì đủ tổng xu có thể vào hàng chờ. Countdown/rest/paused xếp hỗ trợ đợi trận hoạt động; tối đa 12 lượt/góc và không chuyển qua trận mới. Xu của lượt tràn vẫn ghi nhận, response báo hàng đầy.

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

WebSocket thông báo `{type:'state',state:{...}}` và các event `{type:'hit',...}`, `attack.start`, `ko`, `defend`, `heal`, `boost`, `comeback`, `match`, `queue`, `gift`, `gift.correction`, `tts`, `ttsStop`, `voice.status`, `music`, `connection`, `log`. Client dùng `public/js/client.js`, tự thử nối lại sau 1,5 giây. Overlay không được gửi lệnh điều khiển; control gửi JSON-RPC qua fetch cùng cookie hoặc WebSocket đã xác thực.

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
| MC/nhạc | mc.say, mc.test, mc.status, music.list, music.delete |
| Phát sóng | obs.links, obs.open, phone.set |
| Sự kiện | event.chat/like/gift/join, sim.chat/like/gift/join |

Một số phương thức thành công có thể trả thông tin nghiệp vụ thay vì chỉ `{ok:true}`. JSON-RPC error là lỗi yêu cầu/phương thức; event không phù hợp phase/nguồn có thể bị engine bỏ qua theo luật. Không dựa vào một response transport thành công để tự suy đã có sát thương; hãy kiểm tra snapshot/event.

## 6. Âm thanh và tài nguyên

MC chọn câu kịch bản tiếng Việt theo move/critical/block/dodge/choreography/hạ đo ván/hiệp/boost/comeback, gọi góc đỏ/xanh thay vì đọc tùy tiện handle tiếng Anh, không gọi LLM. `msedge-tts` tạo MP3 Nam Minh, cache theo text+voice+rate. Có timeout, backoff khi dịch vụ lỗi, queue ưu tiên và giới hạn cache. Server gửi URL âm thanh cho overlay; tiếng được phát ở browser/OBS, không phát trực tiếp từ console Node.

Khi không có MP3, event vẫn có chữ. Browser đợi bounded `voiceschanged`, lọc voice bằng mã `/^vi(?:-|_|$)/` và gán voice Việt tường minh; chỉ có voice Anh hoặc không có voice thì **không gọi speak**, báo `no-vietnamese-voice` và giữ phụ đề. `lang='vi-VN'` một mình không đủ, vì đó từng là nguyên nhân OS dùng giọng Anh mặc định.

`mc.status`/snapshot.audio trả provider, language, vietnameseOnly, fallback/error, busy/queued và lastSynthesisAt; đây là metadata Node, không chứng minh browser có voice Việt. Overlay/preview có diagnostics riêng cho nguồn phát. `https-proxy-agent` 5.0.1 dùng proxy kế thừa cho đích Microsoft cố định, tôn trọng NO_PROXY, không in URL chứa credentials, không tắt TLS. Endpoint Microsoft bị CONNECT 403 trong môi trường phát triển hiện tại; kiểm chứng local không xác nhận đã nghe giọng cloud thật. `ARENA_OFFLINE=1` chặn hoạt động TikTok/TTS/catalog refresh trong tích hợp, không phải sandbox mạng toàn tiến trình. Ảnh quà/avatar HTTPS bên ngoài có thể được trình duyệt tải nếu không chặn mạng riêng trong test.

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
| HTTPS_PROXY / HTTP_PROXY / NO_PROXY | Proxy/bỏ qua proxy cho giọng Microsoft; giữ riêng nếu URL chứa credential |

Không đưa key dịch vụ hoặc RPC token vào mã nguồn, lockfile, README hoặc gói phát hành.

## 8. Kiểm thử và giới hạn xác minh

`npm test` chạy node:test, có clock/random giả cho luật game. Các ca quan trọng: admission FIFO, chống spam, phòng thủ tiêu thụ một đòn, thể lực/năng lượng, gift damage cap và dedup, KO một lần, pause/resume, reset không tạo thưởng cũ, phân tách demo/live, restart và đầu vào không hợp lệ. Các module tích hợp/HTTP/âm thanh có test riêng trong `tests` khi được bàn giao.

`npm run check` kiểm cú pháp ứng dụng; kiểm tra trình duyệt xác minh render và thao tác local. Test mô phỏng không khẳng định một tài khoản TikTok đang LIVE nhận được sự kiện, endpoint Microsoft hiện có tiếng, hoặc Windows/firewall/OBS/iPhone/Android thật đã chạy.

Phát hành: `npm run package` tạo `dist/VoDaiLive-1.1.0-Source.zip`; thêm `--runtime /path/node.exe` tạo `dist/VoDaiLive-1.1.0-Windows-Portable.zip`. Script lấy version từ package.json; link phát hành dùng nhánh `release/vo-dai-live-1.0.0` của kho, tên nhánh giữ nguyên để nâng cấp từ bản trước. Có checksum ZIP nhưng checksum tự tạo chỉ giúp phát hiện thay đổi so tệp checksum đã cung cấp, không tự xác minh danh tính nhà phát hành. Cập nhật thủ công giữ dữ liệu/nhạc; không có dịch vụ auto-update riêng.

## 9. Nâng cấp dữ liệu từ 1.0

Schema export hiện vẫn `v:1`; cấu hình cũ thiếu trường mới nhận default. Thông số người dùng đã lưu như maxHp được giữ, không tự coi 1.000 HP là lỗi. Bấm Áp dụng luật đề xuất trong dashboard để lưu 1.600 HP, 120 giây/hiệp, nghỉ 8 giây, autoSparring và trần 180 cho trận sau. Bảng cornerGifts có thể sửa/lưu riêng. Giữ data/nhac của người vận hành; không mang dữ liệu QA vào ZIP. Xem docs/KIEM-THU.md cho kết quả xác minh và phạm vi chưa kiểm tra.
