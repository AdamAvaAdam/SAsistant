# Connector SAsistant cá nhân

Yêu cầu Node.js 22 trở lên. Mở PowerShell tại thư mục này:

```powershell
npm ci --ignore-scripts
npm start
```

Mở http://127.0.0.1:4317, dán mã ghép nối in trong cửa sổ vừa chạy. Chọn tên → Đăng nhập QR → quét bằng Zalo trên điện thoại và xác nhận. Dùng một tài khoản phụ trước. Từ điện thoại khác gửi tin đến tài khoản phụ để kiểm tra hộp thư, rồi trả lời một tin văn bản bằng nút Gửi. Không gửi tự động, không gửi hàng loạt.

Giao diện GitHub Pages tại `../inbox.html` cũng gọi connector này. Trình duyệt có thể hỏi quyền truy cập mạng cục bộ hoặc chặn HTTPS → HTTP; khi đó dùng địa chỉ local phía trên. Không mở cổng router, không dùng tunnel, không đổi địa chỉ bind thành 0.0.0.0.

Giới hạn: 6 phiên tính cả phiên đang chờ QR/thất bại. Xóa phiên để thử lại. Xóa phiên dừng listener và bỏ dữ liệu tại connector, không đảm bảo thu hồi phiên phía Zalo; quản lý thiết bị đăng nhập trong Zalo để thu hồi. Ngắt giao diện chỉ xóa mã khỏi bộ nhớ trang; connector vẫn chạy. Ctrl+C dừng tất cả. Không lưu cookie, IMEI, user agent, QR hay tin nhắn ra file; đóng connector mất toàn bộ phiên và dữ liệu hộp thư. Không tải lịch sử cũ. Tin đa phương tiện chỉ có dòng thông báo; gửi ảnh, video, tệp và AI chưa hỗ trợ.

Mã ghép nối ngẫu nhiên đổi mỗi lần khởi động, chỉ ở RAM; không nhập cookie Zalo vào giao diện. Giao diện không lưu mã hay nội dung inbox vào localStorage. API chỉ bind loopback, kiểm tra Host, Origin và Bearer token; origin Pages chỉ giới hạn được tên miền, không giới hạn đường dẫn repository. Tránh chạy script không tin cậy trên cùng origin GitHub Pages khi sử dụng.

## Trạng thái kiểm chứng

- Đã kiểm thử tự động bằng bộ giả lập: xác thực, từ chối Origin/Host lạ, CORS, 6 tài khoản, lọc dữ liệu trả về, nhận tin, gửi thủ công, hạn chế gửi liên tiếp, xóa phiên.
- Chưa kiểm chứng tài khoản Zalo thật: QR, quét/xác nhận, nhận tin, gửi tin, 6 phiên đồng thời, ngắt/mất mạng. Bộ giả lập không chứng minh API Zalo thực tế hoạt động.
- Chưa kiểm thử trình duyệt và quyền truy cập loopback từ Pages. Có giao diện local dự phòng.

## Nguồn đối chiếu

Đã đọc mã `zca-js` 2.2.0: `src/zalo.ts`, `src/apis/loginQR.ts`, `src/models/Message.ts`, `src/apis/listen.ts`, `src/apis/sendMessage.ts` tại https://github.com/RFS-ADRENO/zca-js. Dùng `loginQR({}, callback)`, `QRCodeGenerated.data.image`, `listener.on('message')`, `message.threadId`, `message.type`, `sendMessage(text, threadId, type)`. Cố định phiên bản và lockfile. Không sao chép MiniZalo. Đây là API không chính thức và upstream cảnh báo có thể bị khóa tài khoản.

Không coi việc đăng nhập Zalo Web ở tab khác là kết nối SAsistant. Không đưa session secrets, dữ liệu khách hàng hoặc ảnh QR vào GitHub/issue.
