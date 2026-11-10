# Kiểm chứng bản 1.0.0

Đây là kết quả thực hiện trên môi trường phát triển Linux, Node.js 24.22.1 và Chromium; không thay cho kiểm tra thiết bị phát sóng của người vận hành.

## Đã thực hiện

- `npm run check`: cú pháp JS/MJS hợp lệ.
- `npm test`: 59 kiểm thử đạt, 0 lỗi, 0 bỏ qua. Bao gồm luật chiến đấu/cooldown/stamina/đỡ/né/quà/KO/hàng chờ, demo riêng, lưu/khôi phục, adapter TikTok giả lập và lifecycle, combo đến muộn, âm thanh ngoại tuyến, upload nhạc, HTTP/JSON-RPC/WebSocket và LAN chỉ xem.
- Phiên mở thứ hai cùng thư mục dữ liệu bị từ chối; phiên đang chạy giữ nguyên. Lock tự dọn khi thoát bình thường và phát hiện PID cũ đã chết.
- WebSocket frame quá lớn bị đóng, máy chủ vẫn trả health. Host/Origin/token sai bị chặn. Từ IP LAN, overlay mở được nhưng bảng điều khiển và RPC bị chặn kể cả có token.
- Trình duyệt thực: mở 6 tab, demo bằng nút trên UI, pause/resume, comment móc làm mất HP, quà gây sát thương/hiệu ứng, thêm tên chứa markup vẫn là văn bản, tìm catalog 695 quà và 9 loại hành động, lưu luật, đổi theme, nền trong suốt và màn hình 390px không tràn ngang.
- Chạy gift thực qua API mô phỏng đến khi HP về 0: result có reason=ko và hình K.O. hiển thị. Particle hết vòng đời và dữ liệu LIVE vẫn sạch sau demo.
- Chọn nhạc WAV qua input UI, phát sinh danh sách/URL rồi xóa. Chủ động mở âm thanh: AudioContext running và đòn đánh tạo thêm oscillator/noise source. Câu MC nhập tay hiển thị đúng khi tắt MC tự động. Không khẳng định đã nghe giọng Microsoft từ thử nghiệm này.
- Đã đối chiếu `node.exe` đóng kèm với SHASUMS256 trên HTTPS chính thức Node v24.21.0: SHA-256 `ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32`, đúng mục `win-x64/node.exe`. Notice runtime và danh sách checksum nằm trong assets. Không tuyên bố đã kiểm tra Authenticode hoặc thực thi Windows.
- Gói ZIP được kiểm CRC và kiểm chạy lại mã nguồn sau giải nén. Gói không mang data, key, browser profile hoặc nhạc cá nhân.

## Chưa thực hiện

- Tài khoản TikTok đang LIVE thật và signing API của nhà cung cấp.
- Tổng hợp giọng Microsoft thật qua Internet; test dùng fallback ngoại tuyến. Voice SpeechSynthesis tùy hệ điều hành/trình duyệt.
- Thực thi node.exe/BAT trên Windows, phát nguồn trong OBS/LIVE Studio, điện thoại vật lý, chạy tải lớn nhiều giờ.

Ứng dụng không khóa các tính năng này; người vận hành kiểm tra nguồn hình/tiếng và kết nối kênh trên máy LIVE trước khi lên sóng. Không có khóa bản quyền, máy chủ license hay dịch vụ update riêng.

## Chạy lại kiểm tra giao diện

Hai script Python trong `scripts/` cần Playwright và Chromium (chỉ là công cụ kiểm thử, không cần cho người dùng Windows). Chúng có thao tác reset nên chỉ chạy trên server thử riêng:

```sh
ARENA_HOME=/tmp/vo-dai-qa ARENA_OFFLINE=1 PORT=3100 npm start
# Terminal khác, sau khi cài Playwright/Chromium:
ARENA_ALLOW_TEST_RESET=1 python3 scripts/browser-smoke.py
ARENA_ALLOW_TEST_RESET=1 python3 scripts/browser-media.py
```

Có thể đặt `ARENA_BROWSER_URL` nếu cổng khác. Script yêu cầu `audio.offline=true` và biến cho phép reset; không chạy trên buổi LIVE thật. Ảnh và JSON kết quả được lưu `evidence/`, không đóng kèm dữ liệu cá nhân vào portable.
