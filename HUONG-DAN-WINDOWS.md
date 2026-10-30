# SAsistant Windows 0.4.1

## Sử dụng

Ứng dụng đã cài trên máy có thể được cập nhật bằng `SAsistant-Setup-0.4.1-x64.exe`. Thư mục dữ liệu và phiên đăng nhập đã chọn được giữ lại. Không cần Node.js trên máy sử dụng.

- Thanh tài khoản phía trên có dấu trạng thái và số tin chưa đọc. Chọn **Tất cả** để xem hội thoại của mọi tài khoản, hoặc chọn từng tài khoản. **Chưa đọc** lọc những hội thoại có tin mới app đã nhận. Tin cũ vừa nhập không bị tính thành tin mới.
- Phần thêm/xóa/đăng nhập tài khoản và chọn thư mục nằm trong **Quản lý**, không chiếm cột chat. Màn hình chính chỉ có danh sách hội thoại và khung nội dung toàn chiều cao.
- App hiển thị tên nhóm từ `getGroupInfo`, tên người từ `getUserInfo` khi Zalo cho phép. Mỗi tin nhóm có tên người gửi riêng, không dùng tên nhóm làm người gửi. Nếu chưa có tên, hiển thị tên/ID mà Zalo trả về.
- Ảnh được xem trong chat, bấm để phóng to. Video và tin thoại có trình phát; tệp có nút **Lưu tệp**. Chỉ tải nội dung từ các CDN Zalo được hỗ trợ, không tự mở/chạy tệp đã tải. Tệp hết hạn, không có URL hoặc định dạng lạ sẽ báo chưa xem được.
- Tin văn bản nhận được giữ tối đa 50.000 ký tự/tin. App giữ tối đa 5.000 tin gần nhất/tài khoản, kho mã hóa tối đa 256 MB. Gửi văn bản vẫn giới hạn 2.000 ký tự. Những tin bị cắt hoặc bỏ nội dung đa phương tiện ở bản cũ chỉ có thể khôi phục nếu Zalo trả lại dữ liệu khi tải lịch sử.
- Bấm **↻** để tải thêm tin cũ cho các tài khoản đang lọc. Trong hội thoại có **Tin cũ**; với nhóm, app thử API lịch sử riêng. API này có thể bị Zalo từ chối hoặc chỉ trả một phần. Không bảo đảm đồng bộ toàn bộ lịch sử cloud, nhất là hội thoại riêng.

## Hẹn giờ

1. Chọn đúng hội thoại. Dòng dưới khung chat cho biết tài khoản sẽ gửi.
2. Bấm **Hẹn giờ**, nhập nội dung, chọn ngày giờ hoặc mốc sau 10 phút/1 giờ.
3. Kiểm tra tên người/nhóm và tài khoản trong hộp thoại rồi bấm **Xác nhận lịch gửi**.
4. Theo dõi trong **Lịch gửi**; có thể hủy khi lịch còn chờ.

Lịch được mã hóa cùng kho dữ liệu. **App phải đang mở, máy thức và có mạng**. Nếu tài khoản chưa sẵn sàng lúc đến giờ, lịch đợi tối đa 10 phút rồi chuyển Quá giờ, không tự gửi muộn. Bản này chưa có dịch vụ chạy nền khi đã thoát app hoặc tự đánh thức máy.

App ghi trạng thái Đang gửi xuống ổ đĩa trước khi gọi Zalo. Nếu bị tắt/crash trong lúc gửi hoặc phản hồi không rõ, lịch chuyển **Cần kiểm tra** và không tự gửi lại. Kiểm tra Zalo trước khi tạo lịch mới. “Đã gửi” là theo phản hồi API, không đồng nghĩa người nhận đã đọc. Lịch gửi hiện chỉ hỗ trợ văn bản.

## Lưu trữ và phiên

Kho `du-lieu.sasistant`, bản trước `.bak` và tệp tạm `.tmp` nằm trong thư mục ông chọn. Hộp thư, liên kết đa phương tiện, phiên, trạng thái đã đọc và lịch gửi đều được mã hóa bằng AES-256-GCM; khóa dữ liệu được Windows DPAPI bảo vệ và lưu kèm kho, không phụ thuộc khóa bộ nhớ đệm Chromium. File cấu hình đường dẫn và bộ nhớ đệm giao diện vẫn ở `%APPDATA%\sasistant-desktop`.

Đóng app bình thường để lưu xong. Mở lại sẽ thử khôi phục phiên. Đổi thư mục mở kho độc lập, không tự di chuyển/gộp kho. Xóa tài khoản khỏi app không đảm bảo thu hồi phiên bên Zalo; dùng quản lý thiết bị đăng nhập của Zalo nếu cần thu hồi. Bản dự phòng trước đó có thể còn phiên/hộp thư. Gỡ app không tự xóa thư mục dữ liệu.

Sao lưu khi app đã đóng, giữ cả cấu hình ứng dụng Windows. Chép kho sang máy hoặc tài khoản Windows khác không bảo đảm giải mã được. Mã hóa không bảo vệ trước phần mềm độc hại chạy cùng tài khoản Windows. Không đưa kho, QR, cookie hay dữ liệu khách hàng vào GitHub/issue. Bộ cài thử nghiệm chưa có chữ ký số nhà phát hành.

## Kiểm chứng và giới hạn

- 19 kiểm thử tự động: tin cũ/mới, metadata người/nhóm, đa phương tiện, chống trùng, chưa đọc, lưu mã hóa, lịch gửi đúng một lần, hủy, quá giờ, lỗi ổ đĩa và kết quả chưa rõ.
- Đã kiểm tra giao diện với dữ liệu giả: ảnh mẫu, tên người gửi, dấu chưa đọc và tạo lịch mẫu. Kiểm thử không gửi tin Zalo thật theo lịch.
- Người dùng đã xác nhận bản 0.3.2 có hai tài khoản và nhận được hội thoại. Lịch sử, tên và đa phương tiện ở 0.4.1 còn phụ thuộc dữ liệu Zalo trả về; video/âm thanh/tệp từng định dạng chưa được kiểm chứng đầy đủ bằng tài khoản thật.
- Chưa hỗ trợ gửi ảnh/video/tệp, lên lịch đa phương tiện, AI hoặc đồng bộ trọn lịch sử Zalo.
- Đây là kết nối không chính thức, có rủi ro hạn chế/khóa tài khoản. Thử tài khoản phụ trước.

## Phát triển

Node.js 22+: `npm ci`, `npm test`, `npm start`, `npm run dist:win`.
Nguồn tham chiếu: mã zca-js 2.2.0 (`listen.ts`, `Message.ts`, `getGroupInfo.ts`, `getUserInfo.ts`, `getGroupChatHistory.ts`, `sendVideo.ts`, `sendVoice.ts`), [zca-js](https://github.com/RFS-ADRENO/zca-js), [Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage).

## Tương thích kho mã hóa cũ

Bản 0.4.1 thay cơ chế giữ khóa sau khi phát hiện một kho dùng safeStorage cũ không giải mã được khi mở lại, kể cả bằng bản 0.3.2. Kiểm thử trước đó chỉ đọc lại trong cùng tiến trình nên chưa đủ. Bản mới đã kiểm thử ghi và đọc qua các tiến trình Windows độc lập. Với kho cũ còn giải mã được, app đọc qua bộ tương thích rồi lưu định dạng mới. Nếu không giải mã được, không ghi đè kho gốc; cần giữ cả file chính và .bak, chọn kho mới riêng và quét QR lại. Chưa bảo đảm khôi phục được nội dung từ kho không còn khóa phù hợp.
