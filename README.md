# SAsistant – VT Zalo AI (MVP 1.0)

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
