# SAsistant cho Windows — v0.3.0

## Cài và mở ứng dụng

1. Chạy `SAsistant-Setup-0.3.0-x64.exe` trên Windows 10/11 64-bit. Chọn thư mục cài ứng dụng và hoàn tất. Không cần cài Node.js trên máy sử dụng.
2. Mở **SAsistant** từ biểu tượng Desktop hoặc Start Menu.
3. Bấm **Chọn thư mục lưu trữ**. Chọn một thư mục riêng trên máy, ví dụ `D:\DuLieu\SAsistant`. Thư mục lưu dữ liệu độc lập với thư mục cài chương trình.
4. Nhập tên tài khoản để dễ nhận biết rồi bấm **Đăng nhập bằng QR**. Quét QR bằng Zalo trên điện thoại và xác nhận. Dùng một tài khoản phụ trước vì đây là kết nối không chính thức.
5. Nhận một tin mới vào tài khoản vừa đăng nhập, chọn hội thoại và trả lời bằng nút **Gửi tin nhắn**. Ứng dụng không tự nhắn khách.

Bộ cài thử nghiệm chưa có chữ ký số nhà phát hành. Nếu Windows chặn hoặc báo không xác định nhà phát hành, không tắt các tính năng bảo vệ Windows; kiểm tra nguồn file và thông tin cảnh báo trước khi quyết định cài.

## Dữ liệu của ông nằm ở đâu?

- Thư mục ông chọn chứa `du-lieu.sasistant` (kho mã hóa) và `du-lieu.sasistant.bak` (bản lưu trước đó, cũng mã hóa). Có thể xuất hiện `.tmp` trong lúc ghi.
- Kho chứa tên tài khoản, phiên Zalo và tối đa 1.000 tin gần nhất cho mỗi tài khoản. Chỉ lưu các tin app đã nhận hoặc gửi; chưa tải lịch sử cũ từ Zalo. Tin văn bản hiển thị tối đa 2.000 ký tự, tin đa phương tiện chỉ có dòng thông báo.
- Mã hóa sử dụng Electron safeStorage bất đồng bộ với Windows DPAPI. Phiên và nội dung kho không ghi thành JSON/cookie rõ. Mã hóa này bảo vệ giữa các tài khoản Windows; không bảo vệ trước phần mềm độc hại đang chạy cùng tài khoản Windows.
- Một file cấu hình chỉ chứa đường dẫn thư mục và bộ nhớ đệm giao diện vẫn nằm trong thư mục ứng dụng của tài khoản Windows (`%APPDATA%\sasistant-desktop`). Hộp thư và thông tin phiên do app quản lý nằm trong kho đã chọn. Không có máy chủ đám mây của SAsistant, không gửi dữ liệu lên GitHub; kết nối Zalo vẫn trao đổi với dịch vụ Zalo.
- Đóng ứng dụng bình thường để lưu xong dữ liệu. Dữ liệu vẫn còn sau khi đóng app; mở lại tự thử khôi phục phiên. Nếu phiên hết hạn hoặc kết nối lỗi, chọn **Đăng nhập lại** để quét QR mới.
- **Đổi thư mục…** mở một kho độc lập tại thư mục mới; không tự di chuyển hay gộp dữ liệu. Chọn lại thư mục cũ để trở lại kho cũ. Tránh chọn thư mục đồng bộ công khai hoặc thư mục dự án Git.
- Sao lưu khi app đã đóng: chép cả thư mục dữ liệu và giữ cấu hình ứng dụng Windows. Mã hóa gắn với tài khoản Windows và thông tin khóa tại máy này; chỉ chép kho sang máy/tài khoản khác không bảo đảm mở được. Chưa có tính năng xuất bản sao di chuyển giữa các máy.
- Nếu mất file chính, có thể chép **bản sao** của `.bak` sang một thư mục phục hồi riêng rồi đổi tên bản sao thành `du-lieu.sasistant`, giữ nguyên bản gốc. Mở thư mục phục hồi bằng app trên cùng tài khoản Windows. Nếu không giải mã được, app báo lỗi và không ghi đè kho hỏng.
- Xóa tài khoản khỏi app bỏ tài khoản khỏi kho chính; bản dự phòng trước đó có thể còn phiên và hộp thư. Muốn thu hồi phiên phía Zalo, vào phần quản lý thiết bị đăng nhập của Zalo trên điện thoại. Gỡ ứng dụng không tự xóa thư mục dữ liệu ông đã chọn.

## Những gì đã và chưa kiểm thử

| Phần | Trạng thái |
| --- | --- |
| Tạo bộ cài Windows x64 | Đã tạo bằng electron-builder/NSIS |
| Mở ứng dụng desktop đã đóng gói | Đã mở trên Windows |
| Chọn thư mục bằng hộp thoại Windows | Đã thử với kho trống riêng |
| Ghi file mã hóa và mở lại kho trên Windows | Đã thử trực tiếp qua giao diện; kiểm thử Electron safeStorage thật cũng đạt với phiên giả, file không chứa dữ liệu rõ |
| Lưu phiên/hộp thư và khôi phục trạng thái sau khi khởi động lại | Đạt kiểm thử giả lập, chưa có phiên Zalo thật |
| Xác thực connector, 6 slot, chống gửi liên tiếp, bảo vệ dữ liệu trả về | Đạt kiểm thử tự động |
| File hỏng, khóa giải mã khác, mất file chính còn backup, lỗi ghi dữ liệu | Đạt kiểm thử tự động với dữ liệu giả |
| Quy trình cài/gỡ và chạy trên máy Windows khác | Chưa kiểm thử đầy đủ |
| QR, quét/xác nhận, gửi nhận Zalo thật | Chưa kiểm chứng bằng tài khoản thật |
| Sáu phiên Zalo cùng hoạt động, mất mạng/hết phiên | Chưa kiểm chứng thực tế |
| Gửi ảnh/video/tệp, lịch sử Zalo cũ, AI | Chưa tích hợp |

## Dành cho phát triển

```powershell
npm ci
npm test
npm start
npm run dist:win
```

Dùng Node.js 22 trở lên để phát triển. Bộ cài đã chứa bộ chạy Electron. Electron được cố định ở 45.1.0, zca-js 2.2.0, electron-builder 26.18.0 trong lockfile. Không có chế độ tự cập nhật hoặc tự đăng tải dữ liệu. Mã renderer bị tách khỏi Node.js và chỉ gọi các tác vụ IPC được chỉ định; không mở cửa sổ web bên ngoài hoặc cổng mạng local.

Nguồn: [mã nguồn và cảnh báo zca-js](https://github.com/RFS-ADRENO/zca-js), [Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage), [NSIS installer](https://www.electron.build/docs/nsis/).
