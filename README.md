<!-- Bản desktop hiện tại: 0.4.1; các mô tả demo/connector cũ bên dưới chỉ mang tính lịch sử. -->
# SAsistant – VT Zalo AI (MVP 1.0)

## Ứng dụng Windows v0.4.1

Đã bổ sung ứng dụng desktop độc lập: mở cửa sổ riêng, chọn thư mục dữ liệu bằng hộp thoại Windows, tự lưu phiên và hộp thư mã hóa, tự thử khôi phục phiên khi mở lại. Không cần chạy connector riêng, không cần mã ghép nối, không mở cổng HTTP. Xem [hướng dẫn cài và sử dụng](HUONG-DAN-WINDOWS.md).

Bộ cài tạo tại `release/SAsistant-Setup-0.4.1-x64.exe`; file này không đưa vào Git. Mã nguồn desktop nằm trong `desktop/`; cài thư viện bằng `npm ci`, chạy `npm start`, đóng gói bằng `npm run dist:win`. 19 kiểm thử tự động đạt và đã mở thử cửa sổ desktop, chọn thư mục, lưu mã hóa, đóng/mở lại trên Windows. Chưa kiểm chứng đăng nhập/gửi nhận Zalo thật hoặc 6 phiên Zalo đồng thời.

## Bản connector cá nhân mới

Mở [Hộp thư Zalo + QR](inbox.html). Chạy connector local theo [hướng dẫn](connector/README.md). Có 6 slot tài khoản, callback QR, hộp thư tin mới và gửi văn bản thủ công. Phiên chỉ trong RAM, không lưu lên GitHub. Đọc bảng trạng thái kiểm chứng trong hướng dẫn: kiểm thử giả lập không đồng nghĩa đã đăng nhập/gửi nhận Zalo thật. Phần bên dưới mô tả giao diện demo cũ tại index.html.

Ứng dụng web thử nghiệm chạy trên GitHub Pages. Dữ liệu được lưu tại trình duyệt bằng localStorage và không tự đồng bộ giữa các thiết bị.

## Chức năng hiện có
- Bảng tổng quan và gợi ý việc cần làm theo quy tắc.
- Năm nhãn tài khoản để phân loại khách hàng (chưa kết nối Zalo).
- Hộp thư **mô phỏng**: tạo tin nhắn cục bộ; chọn ảnh/tệp chỉ lưu **tên tệp**, không upload hoặc gửi qua Zalo.
- Hồ sơ khách hàng, trạng thái, ghi chú, ngày cần chăm sóc.
- Nhật ký làm việc, danh sách nhiệm vụ, xuất JSON dự phòng.

## Giới hạn kỹ thuật quan trọng
GitHub Pages không chạy backend, không giữ được 5 phiên đăng nhập Zalo cá nhân, không tự đọc/gửi hội thoại Zalo thật. Bản này **không** có chức năng đăng nhập Zalo, đồng bộ Zalo hay AI API. Không nhập mật khẩu, cookie, QR hoặc token Zalo vào app.

## Chạy trên GitHub Pages
Trong repository GitHub > Settings > Pages > Build and deployment: Deploy from a branch > main / (root) > Save. Trang dự kiến: https://adamavaadam.github.io/SAsistant/ (chỉ dùng khi Pages đã xuất bản).

## Hướng phát triển
1. Kiểm chứng giải pháp kết nối Zalo cá nhân được phép và an toàn bằng một tài khoản thử.
2. Khi có connector hợp lệ, triển khai backend riêng cho xác thực, phiên kết nối, tệp đính kèm và đồng bộ.
3. Kết nối dữ liệu bán hàng, công nợ, chương trình và AI để đề xuất công việc.

## Bảo mật
Repository công khai chỉ chứa mã và dữ liệu mẫu. localStorage không thích hợp để lưu thông tin khách hàng nhạy cảm trên máy dùng chung. Không đưa thông tin bí mật hoặc dữ liệu thực tế lên GitHub.

Bản 0.3.2 bổ sung yêu cầu tin cũ qua WebSocket sau handshake, nút Tải tin cũ, Kết nối lại bằng phiên lưu và trạng thái kênh nhận tin. Phần thư mục được ẩn trong Cài đặt khi đã chọn kho. Lịch sử có thể chỉ được Zalo trả về một phần.

## Desktop 0.4.1

Giao diện hai cột toàn chiều cao, thanh tài khoản và số chưa đọc, lọc tất cả/chưa đọc; quản lý tài khoản và thư mục trong hộp thoại. Bổ sung tên người gửi/tên nhóm, nội dung dài, ảnh/video/thoại/tệp có xem/tải theo khả năng URL Zalo; lịch gửi văn bản có lưu mã hóa, hủy, chống lặp và xử lý quá giờ. Xem HUONG-DAN-WINDOWS.md để biết phần đã kiểm chứng và các giới hạn thực tế.
