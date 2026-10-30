import { Zalo } from "zca-js";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

console.log("SAsistant | KIỂM TRA ĐĂNG NHẬP ZALO CÁ NHÂN");
console.log("CẢNH BÁO: zca-js không phải API chính thức; Zalo có thể hạn chế/khóa tài khoản.");
console.log("Chỉ dùng tài khoản phụ có thể chấp nhận rủi ro. Không dùng tài khoản bán hàng chính.");
console.log("Phiên đăng nhập chỉ nằm trong tiến trình trên máy này, không được gửi lên GitHub.");
const cli = createInterface({input:stdin,output:stdout});
const answer = await cli.question("Gõ TOI_HIEU_RUI_RO để bắt đầu quét QR hoặc Enter để hủy: ");
cli.close();
if (answer !== "TOI_HIEU_RUI_RO") { console.log("Đã hủy."); process.exit(0); }
const zalo = new Zalo();
try {
  console.log("Đang yêu cầu QR đăng nhập. Hãy theo dõi cửa sổ terminal.");
  const api = await zalo.loginQR();
  console.log("ĐĂNG NHẬP THÀNH CÔNG (theo phản hồi thư viện).");
  console.log("Chưa gửi tin nhắn và chưa tự đọc lịch sử khách hàng.");
  console.log("Bắt đầu lắng nghe sự kiện mới. Để dừng: Ctrl+C.");
  let count=0;
  api.listener.on("message", message=>{
    count++;
    const kind=typeof message?.data?.content==="string"?"văn bản":"đa phương tiện/khác";
    console.log("Tin nhắn #"+count+" | loại: "+kind+" | "+(message.isSelf?"tự gửi":"nhận được"));
    // Không ghi nội dung hoặc ID khách hàng vào log để tránh lộ dữ liệu.
  });
  api.listener.start();
} catch(err) {
  console.error("Đăng nhập/lắng nghe thất bại:",err?.message || String(err));
  process.exitCode=1;
}
