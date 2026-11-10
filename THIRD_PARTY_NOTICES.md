# Third-party notices và nguồn tham khảo

Tài liệu này ghi nhận dependencies và tài nguyên có trong dự án. Nó không gán quyền sở hữu đối với mã/tài nguyên do người dùng cung cấp và không tuyên bố toàn bộ ứng dụng có một giấy phép nguồn mở chung.

## Nguồn cảm hứng và dữ liệu đầu vào

Người dùng cung cấp các archive của **Thắp Sáng Bản Đồ Việt Nam**, được phân tích trước khi tạo Võ Đài LIVE. Dự án mới giữ ý tưởng kiến trúc nhiều tầng: ingest TikTok, logic server, JSON-RPC/WebSocket, overlay, control, MC/nhạc và lưu JSON. Luật boxing và giao diện được phát triển cho chủ đề mới. Không mang theo cơ chế key/activation, key người dùng, giấy phép máy, dữ liệu buổi LIVE, nhạc thương mại hoặc profile Edge của bộ mẫu.

`assets/gifts.json` bắt nguồn từ catalog quà TikTok trong bộ người dùng cung cấp. Tên quà, logo/ảnh quà và avatar người xem có thể thuộc TikTok hoặc chủ thể tương ứng. URL ảnh là tài nguyên bên ngoài, không được hiểu là chuyển giao bản quyền ảnh. Chưa có thông tin chứng minh quyền sở hữu/giấy phép riêng của người đóng gói catalog; không tạo tuyên bố tác giả hoặc giấy phép giả cho dữ liệu này.

Thiết kế võ sĩ và hiệu ứng của bản boxing dùng các hình/animation trong source và âm thanh tổng hợp của trình duyệt, không kèm nhạc trong bộ phân tích gốc. Nếu thêm nhạc, hình ảnh hay mô hình mới, cần giữ nguồn/giấy phép tương ứng. Tên TikTok, Microsoft, OBS và các thương hiệu dùng để mô tả tích hợp, không hàm ý được bảo trợ.

## Dependencies trực tiếp

| Package | Phiên bản khai báo | Metadata license |
|---|---:|---|
| tiktok-live-connector | 2.5.0 | AGPL-3.0-only |
| msedge-tts | 2.1.1 | MIT |
| ws | 8.22.2 | MIT |

Xem `package-lock.json` để biết chính xác dependencies bắc cầu và integrity của bản cài; các package con có thông báo và license riêng. Ví dụ `tiktok-live-proto` thuộc AGPL-3.0-only; SDK TikTok LIVE API và nhiều thư viện khác dùng MIT. Không mặc định mọi package bắc cầu đều MIT.

### AGPL dependencies

- [tiktok-live-connector](https://github.com/zerodytrash/TikTok-Live-Connector)
- `tiktok-live-proto`, được cài theo lockfile của connector.
- Giấy phép: [GNU Affero General Public License version 3](https://www.gnu.org/licenses/agpl-3.0.html), SPDX `AGPL-3.0-only` theo metadata package được sử dụng.

Khi phân phối hoặc triển khai một bản liên quan tới các thư viện AGPL, cần xem phạm vi áp dụng và thực hiện các yêu cầu về notice, giấy phép và mã nguồn tương ứng theo giấy phép. Việc phát hành dạng thư mục portable không tự bỏ các điều kiện đó. Các file LICENSE/copyright do upstream đóng gói nằm trong package khi cài dependencies; giữ chúng khi phân phối `node_modules`. Đường dẫn/repository upstream có thể thay đổi; lockfile và package thực tế là căn cứ xác định bản đã dùng.

### MIT dependencies

MIT cho phép dùng, sửa và phân phối với điều kiện giữ copyright notice và permission notice của upstream, kèm điều khoản không bảo đảm trong bản giấy phép. Giữ các LICENSE/copyright có sẵn trong `node_modules/msedge-tts`, `node_modules/ws` và các package con tương ứng. Không thay notice upstream bằng tên dự án Võ Đài LIVE.

## Node.js runtime

Dự án nguồn yêu cầu Node.js ≥22 và khuyến nghị 24.x. Node.js và các thành phần tích hợp có thông báo/giấy phép riêng: [Node.js LICENSE](https://github.com/nodejs/node/blob/main/LICENSE).

Script đóng gói chỉ đưa `node.exe` từ đường dẫn người đóng gói cung cấp vào portable. Nếu dùng runtime lấy từ bộ upload trước đó, metadata/hash chỉ nhận diện tệp đó, không đủ xác minh publisher hoặc giấy phép phân phối runtime đi kèm. Khi phát hành độc lập nên dùng bản Node Windows chính thức, giữ các notice runtime cần thiết và kiểm chữ ký/checksum từ nguồn tin cậy.

## Dịch vụ ngoài và voice

- TikTok LIVE/ảnh quà: theo điều kiện dịch vụ và quyền tài nguyên của nhà cung cấp.
- EulerStream: dịch vụ ký kết nối tùy chọn; key, quota và điều kiện thuộc nhà cung cấp.
- Microsoft Edge TTS (`vi-VN-NamMinhNeural`) qua msedge-tts: là tích hợp dịch vụ ngoài, không phải mô hình giọng được phân phối trong source.
- SpeechSynthesis/Web Audio: API trình duyệt; tính khả dụng và voice tùy môi trường.

Không có license key ứng dụng trong Võ Đài LIVE. Điều đó không thay thế điều kiện của các dependencies, dịch vụ hoặc tài nguyên bên thứ ba.

## Runtime của gói bàn giao 1.0.0

Runtime Windows x64 đóng kèm có SHA-256 `ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32`, đã đối chiếu đúng mục `win-x64/node.exe` trong SHASUMS256 lấy qua HTTPS chính thức Node v24.21.0. `assets/NODE-LICENSE.txt` giữ thông báo runtime và `assets/node-v24.21.0-SHASUMS256.txt` giữ danh sách checksum đối chiếu. Đây là kiểm chứng checksum, không phải xác nhận đã thực thi runtime hoặc kiểm chữ ký Authenticode trên Windows.
