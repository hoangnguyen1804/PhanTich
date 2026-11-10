# Hướng dẫn Võ Đài LIVE 1.1

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
4. Mọi khán giả tặng đúng tổng xu trong bảng đỏ/xanh để hỗ trợ góc đó; không cần bình luận chọn góc. Bảng xu riêng ưu tiên cả khi người tặng là võ sĩ ở góc đối diện.
5. Hết hiệp thì nghỉ rồi đấu hiệp tiếp. **Không có hòa hoặc xử thắng bằng tỷ số hết giờ.** Một bên về 0 HP thì hạ đo ván; trọng tài chỉ được chốt rõ góc đỏ hoặc xanh thắng.
6. Người thắng được giữ đài với HP/thể lực mới và **giữ nguyên góc của mình**. Người thách đấu lên góc còn lại. Danh hiệu trên đầu giữ cùng chuỗi thắng: Vua Võ Đài, Bá Chủ Võ Đài, Độc Cô Cầu Bại, Huyền Thoại Bất Bại.

**Mặc định bản 1.1:** 1.600 HP, 120 giây/hiệp, nghỉ 8 giây, đếm ngược 4 giây, hồi lệnh comment 1.000ms, vé vào đài 1 xu, trần sát thương quà 180 HP, đợi vinh danh 8 giây rồi gọi trận tiếp nếu bật tự động. Cài đặt 1.0 đã lưu được giữ; nút **Áp dụng luật đề xuất** lưu bộ thông số mới cho trận sau.

### Nhịp trận và chống bế tắc

- **Tự so găng:** mặc định bật, hai góc luân phiên nhịp đấm thẳng nhẹ khoảng 1,8 giây/lượt để trận có hoạt động ngay cả khi ít bình luận. Có thể tắt trong Quà & luật. Bình luận/quà vẫn là hành động có tác động rõ vào kết quả; đây không phải dự đoán người thắng từ trước.
- **Liên hoàn/tuyệt kỹ có chuẩn bị:** khoảng 1,4 giây hoặc 2,4 giây hoạt họa trước khi máy chủ áp dụng sát thương. Không bấm dồn để vượt hồi đòn. Các lượt hỗ trợ đang chờ bị giới hạn và gắn với trận hiện tại.
- **Cơ hội phản công:** lần đầu xuống không quá 25% HP mà chưa bị hạ, võ sĩ có giáp giảm sát thương trong 8 giây và hồi thêm thể lực. Chỉ một lần/trận.
- **Nghỉ giữa hiệp:** hai hiệp đầu có hồi 4% HP và thêm thể lực, giới hạn bởi HP tối đa; hiệp sau không tự hồi HP lúc nghỉ.
- **Áp lực tăng:** hiệp 1–2 hệ số 1, hiệp 3 ×1,4, hiệp 4 ×2, hiệp 5 ×3; sau đó tăng 0,25 mỗi hiệp, tối đa ×4. Trần sát thương quà vẫn được giữ.
- **Hồi máu giảm dần:** ngân sách tối đa trong mỗi cửa sổ 10 giây là `15% HP tối đa × hệ số hồi / áp lực`. Hệ số hồi ở hiệp 1–2 là 1, hiệp 3 là 0,65, hiệp 4 là 0,35, từ hiệp 5 là 0. Hiệp quyết định vì vậy không thể kéo vô hạn bằng quà hồi máu.

Mốc thời gian như khoảng 4–5 phút khi không có người can thiệp chỉ là quan sát trên kịch bản mô phỏng xác định; trận thật thay đổi theo quà, lệnh, phòng thủ và thông số, không cam kết thời lượng cố định.

### Hàng chờ và vé

Xu vào đài được cộng dồn theo người trong buổi LIVE hiện tại. Khi chưa đủ hai võ sĩ hoặc quà không khớp bảng xu riêng và chưa có góc nhận, tổng đã đạt phí cho phép người đó vào hàng chờ. Quà không nhân xu thêm theo `count` ở tầng engine: adapter cung cấp số xu mới ghi nhận của lượt đã chốt.

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
| `đỏ`, `red`; `xanh`, `blue` | Chọn góc cho quà không khớp bảng xu riêng; không thay đổi góc của mức xu đã gán |
| `lên đài`, `tham gia`, `join` | Đăng ký theo điều kiện vào đài |

Chấp nhận nhiều lệnh không dấu. Để phân biệt rõ, nên dùng **`đỏ`** khi chọn góc và **`đỡ`** khi phòng thủ. Chỉ võ sĩ hiện tại được ra đòn bằng bình luận; khán giả không thể giả comment để điều khiển người khác.

## 6. Quà và hành động

### Bảng xu riêng cho hai góc — luật ưu tiên

Khi hai võ sĩ đã lên đài, bất kỳ người xem nào cũng có thể tặng đúng mức để hỗ trợ trực tiếp, không cần đang đấu hoặc bình luận chọn bên trước:

| Tác dụng | Góc đỏ | Góc xanh |
|---|---:|---:|
| Liên hoàn đấm | 5 xu | 6 xu |
| Tuyệt kỹ bão quyền | 30 xu | 50 xu |
| Hồi máu | 10 xu | 20 xu |
| Tăng sát thương ×1,3 trong 12 giây | 99 xu | 100 xu |

Ví dụ: khán giả chưa tương tác tặng đúng 6 xu thì góc xanh ra liên hoàn. Võ sĩ xanh tặng 5 xu vẫn giúp góc đỏ. Đây là **khớp tổng xu một lượt quà**, không phải số dư tích lũy, không cộng các lượt độc lập để đoán mức và không chỉ nhìn ID quà.

Vào **Quà & luật → Mức xu dành riêng cho hai góc** để sửa/thêm/xóa, sau đó bấm **Lưu bảng xu**. Tối đa 32 dòng, xu nguyên 1–100.000; không được gán trùng mức xu. Bản nháp chưa lưu không thay đổi LIVE, lỗi lưu không áp dụng một phần bảng. Bảng tương ứng được hiện trên overlay; mức xu chỉ thay luật game, không đổi giá quà TikTok.

### Thứ tự xử lý và chuỗi quà

1. Nếu đủ hai võ sĩ và tổng xu khớp `cornerGifts`, dùng góc/hành động của dòng đó, ưu tiên hơn UID người tặng, comment đỏ/xanh hoặc mapping ID quà.
2. Nếu không khớp, dùng góc của võ sĩ tặng hoặc góc khán giả đã chọn; hành động từ mapping ID quà, rồi mức xu mặc định.
3. Khi không có góc nhận hoặc hành động là vé, quà được dùng cho điều kiện hàng chờ. Khi chưa đủ hai võ sĩ, bảng xu riêng chưa route vào góc.

Mapping ID quà cũ vẫn có thể chọn trong catalog: vé, đấm, móc, bốc, đá, liên hoàn, tuyệt kỹ, hồi máu, tăng sát thương, lá chắn. Nếu không gán, các bậc 1–4/5–29/30–99/từ 100 xu tương ứng đấm thẳng/liên hoàn/đấm bốc/tuyệt kỹ. Luật này chỉ áp dụng **sau** bảng xu riêng.

TikTok có thể gửi chuỗi quà nhiều gói. App chốt khi kết thúc chuỗi; nếu 8 giây không có gói tiếp thì chốt theo tổng đã biết. Nếu gói cuối đến muộn có xu bổ sung, app chỉ cộng phần xu mới vào thống kê, **không kích hoạt thêm đòn hay chuyển sang góc khác**. Vì vậy một chuỗi đã chốt 5 xu không thể đánh đỏ lần đầu rồi đánh xanh vì 6 xu bổ sung đến muộn. Các lượt quà độc lập bình thường vẫn được xử lý riêng.

Trong countdown/nghỉ/tạm dừng, lượt hỗ trợ có thể xếp chờ, tối đa 12 lượt/góc; tràn hàng được báo, xu vẫn ghi nhận. Lượt chờ và đòn chuẩn bị gắn với match ID, bị hủy khi reset/kết thúc/đổi trận, không đánh sang đối thủ mới. Trận đã kết thúc chỉ ghi nhận xu, không ra thêm đòn.

Hồi máu không vượt HP và chịu ngân sách theo hiệp; tăng sát thương luôn ×1,3 trong 12 giây, tặng tiếp làm mới thời hạn, không cộng dồn hệ số vô hạn. Lá chắn bảo vệ một đòn trong cửa sổ 5 giây. Sát thương quà chịu trần kể cả lúc có tăng sức mạnh/chí mạng/áp lực. Quà không cam kết thắng ngay.

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
| Kết thúc | Trọng tài phải chốt rõ đỏ hoặc xanh thắng; không chấp nhận hòa |
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

MC dùng kịch bản tiếng Việt theo cú đánh, phòng thủ, chuẩn bị tuyệt kỹ, hạ đo ván, nghỉ hiệp, phản công và tình hình trận; có lời mời cổ vũ/quà theo khoảng nghỉ. Lời bình gọi góc đỏ/xanh thay vì đọc tùy tiện username tiếng Anh, không gọi LLM sinh hội thoại. Giọng cloud cố định Microsoft Nam Minh qua `msedge-tts`, có cache và hàng đợi ưu tiên. Nhịp lời nhiệt hơn không có nghĩa là bản sao giọng một bình luận viên có thật.

Câu mới cần Internet để tạo giọng Microsoft. Khi dịch vụ chậm/offline, trình duyệt chỉ được chọn **một voice có mã tiếng Việt rõ ràng**, có chờ ngắn nếu danh sách voice tải chậm. Nếu chỉ có giọng Anh hoặc không có giọng, ứng dụng **không gọi giọng mặc định**, giữ phụ đề và báo “chưa có giọng tiếng Việt”. Bật Internet để dùng Nam Minh hoặc cài giọng tiếng Việt trong cài đặt ngôn ngữ/giọng nói Windows rồi mở lại nguồn. Bảng MC & âm thanh có chẩn đoán của máy chủ và preview. Không cần API key TTS, nhưng dịch vụ ngoài vẫn có thể lỗi/chặn mạng.

Trong môi trường phát triển hiện tại, kết nối tới Microsoft bị proxy trả CONNECT 403; do đó không tuyên bố đã nghe/kiểm chứng giọng Nam Minh thật ở đây. Bản sửa đã kiểm chứng cơ chế không rơi sang giọng Anh. Khi dùng mạng công ty, adapter giọng hỗ trợ biến HTTPS_PROXY/HTTP_PROXY và NO_PROXY; không tắt kiểm tra TLS để chữa lỗi.

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

Để cập nhật thủ công lên 1.1: đóng ứng dụng, sao lưu, giải nén `VoDaiLive-1.1.0-Windows-Portable.zip` ra thư mục mới, chuyển đúng `data/` + `nhac/` của bạn hoặc thay mã nhưng giữ hai thư mục này; nếu dùng nguồn thì chạy `npm ci --omit=dev --ignore-scripts` theo lockfile mới. Cài đặt HP/thời lượng đã lưu được giữ; dùng **Áp dụng luật đề xuất** để lưu bộ thông số mới cho trận tiếp theo. Bảng xu mới được bổ sung khi dữ liệu cũ chưa có `cornerGifts`; bạn có thể sửa và lưu lại. Không copy dữ liệu của bộ Thắp Sáng cũ vào đây; schema game khác nhau. Runtime `node.exe` phải cập nhật từ bản phân phối tin cậy khi cần.

## 13. Xử lý sự cố nhanh

| Hiện tượng | Kiểm tra |
|---|---|
| Không mở được control | Server còn chạy không, cổng thực tế trong terminal, mở trên chính máy server |
| Sàn chờ trống | LIVE chưa đủ hai người; thêm hàng chờ hoặc mở DEMO để thử |
| Comment không ra đòn | Đúng võ sĩ chưa, đang thi đấu chưa, còn thể lực/năng lượng, hết hồi đòn chưa |
| Quà không đánh | Đã đủ hai võ sĩ chưa, tổng xu có khớp bảng riêng không, đang chờ chuỗi đòn/nghỉ/paused hay trận đã xong, có phải correction của chuỗi cũ không |
| Không nghe MC | Mở tiếng overlay/OBS, kiểm tra chẩn đoán, mạng Microsoft và giọng Việt trên Windows; thiếu giọng Việt sẽ hiện chữ thay vì đọc Anh |
| Tiếng lặp | Chỉ để một overlay phát tiếng; mute preview/nguồn trùng |
| TikTok báo lỗi/limit | Tài khoản thực sự LIVE, username đúng, không ở ARENA_OFFLINE, kiểm tra provider |
| Mất kết nối overlay | Server/WS còn sống; client tự thử nối lại, kiểm tra banner offline |
| Nhạc vừa chép chưa thấy | Chờ chu kỳ scan 15 giây hoặc upload qua UI |
| Trận không hết khi đồng hồ về 0 | Đây là đồng hồ hiệp; trận tiếp tục đến khi có người thắng, không xử hòa |
| Hồi máu không tăng HP | Đã đầy máu, chạm ngân sách 10 giây hoặc đang ở hiệp quyết định; xem luật áp lực/hồi máu |
| Đổi máy mất cấu hình | Sao chép thư mục dữ liệu đúng ARENA_HOME; không chia sẻ nó công khai |

Kiểm thử kỹ thuật: `npm test`, `npm run check`. Bài test local/demo không chứng minh TikTok/Windows/OBS/điện thoại thật đã chạy; hãy kiểm tra hình và tiếng trong phần mềm phát trước giờ lên sóng.
