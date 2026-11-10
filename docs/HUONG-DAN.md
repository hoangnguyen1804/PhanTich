# Hướng dẫn Võ Đài LIVE

## 1. Chuẩn bị

Có hai cách chạy:

- **Windows portable:** giải nén toàn bộ thư mục, giữ `node.exe`, `node_modules`, `src`, `public` và tệp gốc cùng nhau; mở `CHAY.bat`.
- **Mã nguồn:** cài Node.js ≥22, khuyến nghị 24.x; trong thư mục dự án chạy `npm ci --omit=dev --ignore-scripts`, sau đó `npm start`.

Địa chỉ mặc định: bảng điều khiển `http://localhost:3100/`, màn LIVE `http://localhost:3100/overlay.html`. Cổng bận sẽ tự thử các cổng tiếp theo. Lấy link đang dùng trong bảng Kết nối, không cố giữ cổng 3100 nếu terminal báo cổng khác.

Đặt thư mục tại nơi tài khoản có quyền ghi, ví dụ thư mục riêng trên Desktop/ổ dữ liệu. Không chạy trực tiếp trong cửa sổ xem ZIP. Không cần mở ứng dụng bằng quyền quản trị để chơi và lưu trạng thái.

## 2. Không có khóa bản quyền

Ứng dụng không có bước mua/nhập key, đăng ký máy, hết hạn giấy phép hay gọi dịch vụ bản quyền của bộ Thắp Sáng. Mở là dùng chức năng ứng dụng.

Có hai khái niệm khác:

- **RPC token nội bộ:** ứng dụng tự tạo trong `data/app-config.json`, dùng bảo vệ API. Trình duyệt trên máy nhận cookie tự động nên không cần nhập. Giữ riêng tệp cấu hình này.
- **API key EulerStream tùy chọn:** key của dịch vụ ký kết nối TikTok, dùng khi cần xử lý hạn mức. Đây không phải key bản quyền của Võ Đài LIVE. Có thể thử kết nối không nhập key, nhưng không thể hứa dịch vụ bên ngoài sẽ không giới hạn.

## 3. Demo và LIVE tách riêng

**DEMO** cho người vận hành thử trận, hiệu ứng, bình luận và quà. Bật demo tạo hai võ sĩ mẫu và một người chờ. Có thể chạy tự động hoặc dừng tự động rồi thử từng thao tác. Công cụ `sim.*` chỉ nhận khi đang ở DEMO.

**LIVE** sử dụng dữ liệu người xem thật. Ban đầu sàn trống, chờ người đăng ký; không tự chèn võ sĩ giả vào trận thật. Sự kiện `event.*` và TikTok chỉ được nhận ở chế độ LIVE. Chuyển vào DEMO sẽ ngắt TikTok để tránh trộn dữ liệu.

Hàng chờ, tổng xu và bảng xếp hạng DEMO không ghi vào bảng LIVE. Khi rời một trận LIVE để thử DEMO, võ sĩ đang đấu được đưa về đầu hàng chờ LIVE, không tự trao thưởng cho trận bị gián đoạn. Khi mở lại ứng dụng, một trận bị ngắt cũng trở về trạng thái chờ an toàn thay vì tiếp tục HP/timer cũ.

Sau khi dừng demo tự động, chế độ có thể vẫn là DEMO để bạn thử thủ công; cần chuyển rõ sang LIVE trước khi kết nối.

## 4. Luồng một trận

1. Người xem tặng đủ xu để đăng ký hoặc quản trị viên thêm người vào hàng chờ.
2. Khi có hai người và bật tự chuyển trận, hai người đầu hàng được mời lên sàn và đếm ngược.
3. Trong thời gian thi đấu, võ sĩ comment lệnh. Mỗi đòn mất thể lực, có hồi chiêu và gây sát thương đối thủ; HP không được xuống dưới 0.
4. Người cổ vũ chọn `đỏ` hoặc `xanh`, rồi tặng quà cho góc đó. Nếu đang là võ sĩ, quà của chính họ ưu tiên góc của họ.
5. Một bên hết HP thì KO. Hết giờ thì so tỷ lệ HP còn lại; nếu bằng nhau so sát thương gây ra; vẫn bằng là hòa.
6. Người thắng được giữ đài với HP/thể lực mới, người thách đấu kế tiếp lên. Trong trận mới người giữ đài được đặt ở góc đỏ, nên hãy nhìn tên võ sĩ trước khi chọn góc cổ vũ.

**Mặc định:** 1.000 HP, 120 giây/trận, đếm ngược 4 giây, hồi lệnh comment 1.000ms, vé vào đài 1 xu, đợi vinh danh 8 giây rồi gọi trận tiếp nếu bật tự động. Có thể chỉnh trong Quà & luật.

### Hàng chờ và vé

Xu vào đài được cộng dồn theo người trong buổi LIVE hiện tại. Khi tổng đã đạt phí và chưa chọn góc cổ vũ, người đó được thêm hàng chờ. Quà không nhân xu thêm theo `count` ở tầng engine: adapter phải cung cấp tổng xu sự kiện đã chốt combo.

Nếu phí = 0, comment `lên đài` là đăng ký được. Nếu phí > 0, chỉ comment chưa đủ điều kiện sẽ không được tự vào. Quản trị viên vẫn có quyền thêm trực tiếp. Hàng chờ tối đa 100 người, FIFO; một người không chiếm hai vị trí cùng lúc.

Một người đã chọn góc cổ vũ có thể comment `lên đài` sau khi đã đủ tổng xu để đăng ký. Chọn góc không có nghĩa mọi lần tặng đều tự mở thêm vé.

### Thể lực, năng lượng và phòng thủ

- Đấm thẳng ít tốn thể lực; móc, bốc, đá và combo tốn nhiều hơn.
- Thể lực hồi theo thời gian thi đấu. Spam lệnh trong thời gian hồi không làm mất thêm thể lực hoặc máu đối thủ.
- Năng lượng tăng từ đòn đánh, nhận đòn và tim cổ vũ. Tuyệt kỹ cần 100 năng lượng và tiêu hết thanh.
- `đỡ` giảm mạnh sát thương của một đòn kế tiếp trong cửa sổ ngắn; `né` có thể tránh hoàn toàn một đòn. Phòng thủ được tiêu thụ khi chạm đòn, không tạo bất tử dài hạn.
- Có chí mạng và chuỗi combo; sát thương quà luôn bị chặn bởi giới hạn cài đặt, kể cả khi chí mạng.

## 5. Các lệnh comment

| Lệnh | Hành động |
|---|---|
| `đấm`, `đấm thẳng`, `jab` | Đấm thẳng |
| `móc`, `đấm móc`, `hook` | Đấm móc |
| `đấm bốc`, `bốc`, `uppercut` | Móc ngược |
| `đá`, `đá vòng`, `kick` | Đá vòng arcade |
| `liên hoàn`, `combo`, `flurry` | Chuỗi nhiều cú đấm |
| `bão quyền`, `tuyệt chiêu`, `ultimate` | Tuyệt kỹ cần đủ năng lượng |
| `đỡ`, `chặn`, `block` | Phòng thủ |
| `né`, `né đòn`, `dodge` | Né tránh |
| `đỏ`, `red`; `xanh`, `blue` | Khán giả chọn góc cổ vũ |
| `lên đài`, `tham gia`, `join` | Đăng ký theo điều kiện vào đài |

Chấp nhận nhiều lệnh không dấu. Để phân biệt rõ, nên dùng **`đỏ`** khi chọn góc và **`đỡ`** khi phòng thủ. Chỉ võ sĩ hiện tại được ra đòn bằng bình luận; khán giả không thể giả comment để điều khiển người khác.

## 6. Quà và hành động

Quà có thể gán các hành động: vé lên đài, đấm thẳng, móc, bốc, đá, liên hoàn, tuyệt kỹ, hồi máu hoặc lá chắn. Vào Quà & luật để chọn quà từ catalog, xem giá xu và sửa mapping. Một ID quà ánh xạ một hành động. Catalog đóng kèm dùng được để thử khi offline; nút cập nhật danh sách cần truy cập TikTok.

Nếu không gán riêng, hiệu ứng mặc định theo tổng xu mỗi sự kiện: 1–4 xu đấm thẳng, 5–29 xu liên hoàn, 30–99 xu đấm bốc, từ 100 xu tuyệt kỹ. Sát thương tăng theo các bậc nhưng có trần `giftDamageCap`, mặc định 300. Quà không phải cam kết thắng ngay hoặc tỷ lệ chuyển xu thành tiền trong game.

Người chưa ở trên đài/chưa chọn góc dùng quà để đăng ký khi đủ điều kiện. Quà có tác dụng chiến đấu khi trận đang thi đấu; lúc đếm ngược/tạm dừng/vinh danh chỉ ghi nhận xu, không âm thầm đánh mất máu đối thủ. Hồi máu không vượt HP tối đa, lá chắn bảo vệ một đòn trong thời gian hữu hạn.

## 7. Bảng điều khiển

- **Tổng quan:** tình trạng trận, thông số buổi, hàng chờ/bảng xếp hạng và preview.
- **Điều khiển:** bắt đầu, tạm dừng/tiếp tục, kết thúc theo trọng tài, gọi trận tiếp, reset trận/buổi và thao tác thử.
- **Quà & luật:** gán quà, thời gian, HP, phí, hồi đòn, sát thương quà và tự chuyển trận.
- **MC & âm thanh:** bật/tắt MC, tốc độ/âm lượng, đọc câu nhập, nhạc nền, âm lượng hiệu ứng, tải/xóa nhạc.
- **Kết nối:** username TikTok, trạng thái, API key dịch vụ tùy chọn, link OBS, cửa sổ Edge và Wi-Fi.
- **Nhật ký:** dòng vận hành và lỗi để xử lý khi cần.

Thao tác reset ảnh hưởng dữ liệu:

| Thao tác | Kết quả |
|---|---|
| Tạm dừng | Giữ thời gian và HP; ngừng nhận đòn trong trận |
| Kết thúc | Trọng tài chốt người thắng/hòa và ghi thành tích |
| Trận tiếp | Người thắng giữ đài; dùng người trong hàng chờ |
| Reset trận | Hủy trạng thái trận, đưa người đang đấu về đầu hàng, chờ bấm bắt đầu; không trao thưởng |
| Buổi mới | Xóa trận, hàng chờ và bảng buổi của chế độ hiện tại |

## 8. Kết nối TikTok thật

1. Hoàn thành demo trước, chuyển về LIVE.
2. Bắt đầu phát trực tiếp trên TikTok/LIVE Studio trước.
3. Nhập username kênh, không phải tên hiển thị tùy ý; bấm Kết nối.
4. Kiểm tra trạng thái báo nhận LIVE; dùng một người xem thật comment/tặng thử để xác nhận.
5. Nếu bị rate limit, chờ theo thông báo; có thể cấu hình key EulerStream cá nhân ở phần nâng cao. Không thử kết nối liên tục cùng một lỗi.

Không có bảo đảm kết nối khi tài khoản không đang LIVE, API TikTok thay đổi, provider từ chối hoặc mạng chặn. Dữ liệu API key dịch vụ được giữ cục bộ; không chia sẻ `data/app-config.json`. Không bật demo cùng lúc để giả kết quả LIVE thật.

Nếu dùng TikFinity/Streamer.bot, xem API trong tài liệu kiến trúc. Công cụ ngoài chạy trên máy cần gửi JSON-RPC đúng schema và token nội bộ; không có endpoint TikFinity cấu hình sẵn mặc định.

## 9. OBS và LIVE Studio

- Thêm Browser Source/Link; dùng link đang hiện trong bảng Kết nối.
- Khung dọc **1080 × 1920**; overlay sẽ giữ tỷ lệ nếu cửa sổ khác cỡ.
- OBS: bật **Control audio via OBS** để đưa âm thanh vào mixer, kiểm tra mức tiếng và monitoring.
- Nền trong suốt: `http://localhost:3100/overlay.html?bg=transparent` (thay cổng thực tế nếu khác).
- Không muốn nguồn có tiếng: thêm `?mute=1`; nếu đã có query khác, nối `&mute=1`.
- Nếu nguồn Link không hoạt động, mở overlay trong cửa sổ Edge riêng bằng nút ứng dụng Windows, rồi dùng Window Capture. Cần Edge được cài.

Mở hai overlay có tiếng đồng thời sẽ phát hai lượt MC/nhạc. Giữ preview tắt tiếng khi OBS đang phát. Trình duyệt có thể yêu cầu click **Bật âm thanh** trước; đây là chính sách autoplay, không phải lỗi giấy phép.

## 10. MC và nhạc

MC bình luận theo cú đánh, phòng thủ, KO, người lên đài và tình hình trận, có lời mời cổ vũ/quà theo khoảng nghỉ. Dùng kịch bản theo sự kiện, không gọi LLM sinh hội thoại. Có hàng đợi ưu tiên, hạn chế đọc dồn, giọng Microsoft Nam Minh qua `msedge-tts` và cache MP3 cục bộ.

Câu mới cần Internet để tạo giọng Microsoft. Khi dịch vụ chậm hoặc đang offline, ứng dụng có thể gửi chữ để trình duyệt đọc dự phòng. Giọng dự phòng phụ thuộc voice đã có trong OS/trình duyệt; có máy không có giọng Việt. Khi đó vẫn xem được phụ đề MC. Không cần mua API key TTS trong cấu hình này; điều đó không đảm bảo endpoint bên ngoài luôn hoạt động.

Bật âm thanh tại overlay và kiểm tra mixer. Bật/tắt MC hoặc thay âm lượng trong dashboard. Âm thanh cú đấm/chuông được tổng hợp bằng trình duyệt, không lấy từ tệp có bản quyền trong bộ mẫu.

Nhạc hỗ trợ MP3, M4A, OGG, WAV, AAC; tối đa **50 MiB/bài**. Upload qua dashboard hoặc chép vào `nhac/` (tự quét mỗi 15 giây). Upload trùng tên sẽ được thêm số để giữ bài cũ. Bộ phát hành không kèm bốn bài hát của bộ gốc; hãy dùng nhạc bạn có quyền phát LIVE.

## 11. Xem overlay bằng điện thoại

Bật xem qua Wi-Fi ở bảng Kết nối hoặc launcher điện thoại Windows. Điện thoại và máy tính phải cùng mạng, dùng link IP LAN mà ứng dụng hiển thị. Mở link, chạm bật âm thanh/fullscreen nếu thiết bị yêu cầu.

Bảng điều khiển vẫn chỉ dùng trên máy tính chạy server. Điện thoại không gửi lệnh trọng tài/reset qua API được. Nếu không mở được, kiểm tra:

1. Cả hai thiết bị cùng Wi-Fi, không dùng guest network tách máy.
2. Server đã bật chế độ điện thoại, link đúng IP/cổng hiện tại.
3. Firewall cho phép Node hoặc TCP cổng thực tế từ mạng riêng/local subnet.
4. Không có VPN/adapter khác khiến bạn chọn nhầm IP.

Ứng dụng không tự thay firewall/hosts của hệ điều hành. Chỉ cho phép trong mạng tin cậy; không cần port forwarding trên router.

## 12. Dữ liệu, sao lưu và cập nhật

Ứng dụng ghi `data/app-config.json` (cấu hình/token), `data/arena.json` (LIVE, cài đặt), `data/audio/` (cache), `data/runtime.json`; nhạc ở `nhac/`. Có thể đặt `ARENA_HOME` để toàn bộ dữ liệu và nhạc nằm tại thư mục khác, còn mã vẫn ở thư mục chương trình.

Tắt ứng dụng trước khi sao lưu/copy. Giữ riêng cả `data/` và `nhac/`; dữ liệu chứa tên/ảnh người xem và API key dịch vụ nếu bạn nhập, không dùng như tệp demo công khai. Nút xuất trạng thái lấy dữ liệu game, không xuất API key/cấu hình xác thực; bản game export vẫn có tên/ảnh người chơi.

Để cập nhật thủ công: đóng ứng dụng, sao lưu, giải nén mã mới, giữ `data/` + `nhac/`, chạy lại dependencies theo lockfile nếu dùng bản nguồn. Không copy dữ liệu của bộ Thắp Sáng cũ vào đây; schema game khác nhau. Runtime `node.exe` phải cập nhật từ bản phân phối tin cậy khi cần.

## 13. Xử lý sự cố nhanh

| Hiện tượng | Kiểm tra |
|---|---|
| Không mở được control | Server còn chạy không, cổng thực tế trong terminal, mở trên chính máy server |
| Sàn chờ trống | LIVE chưa đủ hai người; thêm hàng chờ hoặc mở DEMO để thử |
| Comment không ra đòn | Đúng võ sĩ chưa, đang thi đấu chưa, còn thể lực/năng lượng, hết hồi đòn chưa |
| Quà không đánh | Người chưa chọn góc thì có thể dùng để vào hàng; trận phải đang fighting |
| Không nghe MC | Bật tiếng overlay/OBS, MC đang bật, mixer đúng; kiểm tra mạng/giọng hệ thống |
| Tiếng lặp | Chỉ để một overlay phát tiếng; mute preview/nguồn trùng |
| TikTok báo lỗi/limit | Tài khoản thực sự LIVE, username đúng, không ở ARENA_OFFLINE, kiểm tra provider |
| Mất kết nối overlay | Server/WS còn sống; client tự thử nối lại, kiểm tra banner offline |
| Nhạc vừa chép chưa thấy | Chờ chu kỳ scan 15 giây hoặc upload qua UI |
| Đổi máy mất cấu hình | Sao chép thư mục dữ liệu đúng ARENA_HOME; không chia sẻ nó công khai |

Kiểm thử kỹ thuật: `npm test`, `npm run check`. Bài test local/demo không chứng minh TikTok/Windows/OBS/điện thoại thật đã chạy; hãy kiểm tra hình và tiếng trong phần mềm phát trước giờ lên sóng.
