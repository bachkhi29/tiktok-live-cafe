# Đóng góp cho TikTok LIVE Café

Có thể mở Issue để góp ý/báo lỗi hoặc gửi Pull Request.

## Báo lỗi

Ghi các bước tái hiện, kết quả mong đợi và thực tế. Kèm phiên bản Node.js, hệ điều hành, trình duyệt; với điện thoại, thêm phiên bản iOS/TikTok. Cho biết lỗi xảy ra trong DEMO hay LIVE thật.

Kèm ảnh/nhật ký liên quan nếu có; che mã link iPhone, cookie, token và dữ liệu riêng tư trước khi đăng. Không cần gửi nhạc thương mại để báo lỗi âm thanh.

## Trước khi gửi thay đổi

```bash
cd live
npm ci
npm run check
npm test
```

Với giao diện/animation, mô tả cách thử trên overlay. Với âm thanh/iPhone, ghi thiết bị đã thử và phần chưa xác minh. Kết quả DEMO không chứng minh kết nối LIVE thật.

Giữ kiến trúc Node.js + WebSocket + HTML Canvas, ưu tiên thay đổi nhỏ và rõ ràng. Giải thích khi thêm thư viện. Không commit `node_modules`, `live/data`, `live/tts`, profile trình duyệt, file nhạc cá nhân hay khóa truy cập. Giữ giấy phép MIT và ghi công upstream; bảo đảm có quyền chia sẻ nội dung mới.
