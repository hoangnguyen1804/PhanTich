# Kiểm chứng bản 1.1.0

Môi trường: Linux, Node.js24.22.1, Chromium. Không dùng tài khoản/key hoặc dữ liệu cá nhân của bộ mẫu. Kiểm thử trình duyệt chạy trên thư mục ARENA_HOME riêng và chặn tài nguyên mạng ngoài.

## Kết quả tự động

- `npm run check`:20 tệp JavaScript/MJS hợp lệ.
- `npm test`:99 kiểm thử đạt,0 lỗi,0 bỏ qua. Bao gồm46 ca engine,13 âm thanh máy chủ,10 giọng trình duyệt,14 adapterTikTok và16 ca máy chủ/tích hợp.
- Exactcoin: khách chưa lên đài/chưa chọn góc vẫn kích hoạt đúng đỏ/xanh; mức xu ưu tiên hơn UID và góc đã chọn; giá trùng bị từ chối không đổi luật đang chạy; chuỗi quà sửa muộn chỉ ghi phần xu bổ sung.
- Đòn lớn: phát attack.start trước; HP chỉ giảm khi hết thời gian ra chiêu. Pause giữ timeline, reset/mode/trận mới hủy hiệu ứng cũ. Quà hỗ trợ xếp hàng có giới hạn theo trận.
- Không hòa: API trọng tài không chấp nhận winner=null; hết giờ chuyển nghỉ rồi hiệp tiếp; KO trao thưởng đúng một lần. Người thắng giữ đúng góc cũ. Boost giới hạn, giáp phản công, ngân sách hồi máu và áp lực hiệp muộn được kiểm tra bằng đồng hồ giả lập.
- Trong kịch bản xác định random=.5, mặc định1600HP/hiệp120s/nghỉ8s: không có tương tác kết thúc bằng KO khoảng4phút44giây; hồi cả hai góc mỗi giây vẫn kết thúc khoảng9phút4giây, ở hiệp5. Đây là kết quả mô phỏng cho cấu hình cụ thể, không cam kết thời lượng mọi trận.
- Giọng: danh sách chỉ có tiếng Anh hoặc không có voice không được gọi speak; danh sách tiếng Việt xuất hiện muộn được nhận, đặt explicit voice vi-VN. Test lỗi cloud, reset/close khi chờ voice, không có speechAPI, lời MC tiếng Việt không đọc handle tiếng Anh, proxy/NO_PROXY.
- Auth/Host/Origin/LAN/WS/frame quá lớn, upload/xóa/range nhạc, chống mở hai phiên và khôi phục dữ liệu qua restart vẫn qua hồi quy.

## Kiểm tra Chromium thực tế

`scripts/browser-upgrade.py` kiểm tra qua nút/UI và máy chủ cục bộ:

-6 tab đều mở; không còn nút hòa.
- Bảng đỏ/xanh hiển thị8 mức mặc định, sửa/lưu/hoàn tác và lỗi giá trùng đúng.
- Nút khách ngoài đài5xu cho đỏ,6xu cho xanh,99xu tăng sức mạnh đỏ,20xu hồi xanh.
- HP không giảm trong lấy đà; combo/tuyệt kỹ có chuyển động và sát thương đúng thời điểm. Dừng giữa tuyệt kỹ hơn thời lượng đòn vẫn không mất HP; tiếp tục thì đòn mới chạm.
- Danh hiệu lớn phía trên người thắng; sang trận mới vẫn còn, võ sĩ xanh giữ đúng góc xanh.
- Đồng hồ thật15giây vào nghỉ, sau nghỉ sang hiệp2, không có kết quả thắng/hoà theo điểm.
- Tặng quà qua API mô phỏng đến khi HP=0 tạo kết quả reason=ko và màn hình hạ gục.
- Trình duyệt cài danh sách giọng giả chỉ tiếng Anh không phát bất kỳ câu nào, hiện cảnh báo thiếu giọng Việt.
-390px không tràn ngang, overlay giữ tỷ lệ, nền trong suốt hoạt động. Dữ liệu LIVE không nhận xu/thành tích demo. Không có pageerror trong lượt kiểm tra.

Ảnh trong docs/images dùng tên giả của phòng thử, không phải tài khoản TikTok thật.

## Phạm vi chưa xác minh

- TikTok LIVE thật/signingAPI, OBS/LIVEStudio trên Windows và điện thoại vật lý.
- Nghe giọng Microsoft thực tế: môi trường hiện tại trả CONNECT403 khi tới speech.platform.bing.com, nên không thể xác nhận âm thanh cloud ở đây. Đã giữ xác minhTLS và proxy đúng, không vô hiệu bảo mật để vượt chặn. Khi dùng tại máy người vận hành, Nam Minh cần Internet; fallback chỉ dùng giọng Việt cài trên máy, nếu thiếu thì hiển thị chữ và cảnh báo. Windows/OBS có thể có danh sách voice khác nhau.
- Thực thi node.exe/BAT trên Windows và chạy tải lớn liên tục nhiều giờ.

Runtime Windows đóng kèm vẫn là Node24.21.0x64, SHA-256 ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32, đã khớp SHASUMS256 HTTPS chính thức. Notice và checksum ở assets. Kiểm checksum không đồng nghĩa đã kiểm Authenticode hoặc chạy trên Windows.

## Chạy lại

```sh
ARENA_HOME=/tmp/vo-dai-qa ARENA_OFFLINE=1 PORT=33410 npm start
# terminal khác, có PythonPlaywright và Chromium:
ARENA_ALLOW_TEST_RESET=1 ARENA_BROWSER_URL=http://127.0.0.1:33410 python3 scripts/browser-upgrade.py
```

Script yêu cầu cho phép reset rõ ràng và kiểm tra audio.offline=true. Chỉ chạy trên fixture riêng vì nó sẽ reset trạng thái. Hai tên browser-smoke.py và browser-media.py là entrypoint tương thích của workflow1.1. File kết quả/ảnh nằm evidence/1.1 và không được đóng gói thành dữ liệu người dùng.
