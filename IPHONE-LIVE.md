# Đưa quán cà phê lên TikTok LIVE bằng iPhone

Cách này dùng **TikTok chia sẻ màn hình iPhone**: PC chạy server quán, Safari trên iPhone mở overlay, người xem thấy màn hình Safari. Tài khoản của ông phải có lựa chọn chia sẻ màn hình trong màn hình tạo LIVE. LIVE Studio trên PC không tham gia vào đường phát này.

## Chuẩn bị trên PC

1. Nếu `start-cafe.cmd` đang chạy, bấm Ctrl+C để đóng server cũ. Mở `start-phone.cmd` ở thư mục dự án. Chế độ này chỉ mở trong mạng nội bộ và tạo đường dẫn mới mỗi lần chạy.
2. Cửa sổ server sẽ in một hoặc vài dòng **Mở trên iPhone cùng Wi-Fi: http://.../phone?t=...**. Lấy dòng bắt đầu bằng IP Wi-Fi của PC. Giữ cửa sổ server mở. Nếu Windows hỏi quyền tường lửa, chỉ cho phép trên **Private networks / Mạng riêng**.
3. PC và iPhone cần cùng mạng nội bộ (cùng router; PC dùng dây mạng cũng được). Trên PC vẫn mở bảng điều khiển ở `http://localhost:3000` để đổi nhạc, lời đọc và kết nối TikTok sau khi đã phát LIVE.

Đường dẫn điện thoại có mã truy cập theo phiên. Người mở bằng link đó chỉ thấy overlay; bảng điều khiển và tải file nhạc không mở qua mạng nội bộ. Đừng chia sẻ link công khai. Khi khởi động lại server, dùng link mới. Nếu Safari báo 403, mở lại nguyên link có `?t=` được in trong cửa sổ server.

## Kiểm tra trên iPhone trước khi phát

1. Mở **Safari**, nhập nguyên link từ PC. Quán phải hiện, nhân vật/đèn và mã bài nhạc phải chuyển động. Nếu không tải được: kiểm tra cùng mạng, tắt VPN trên iPhone nếu làm lệch mạng, và kiểm tra Windows Firewall cho mạng riêng. `localhost:3000` trên iPhone là chính iPhone, không phải PC.
2. Trong Safari bấm **Chia sẻ → Thêm vào Màn hình chính → Thêm**. Thoát Safari rồi mở biểu tượng **Cà Phê LIVE** vừa tạo. Cách này bỏ thanh địa chỉ và thanh công cụ Safari; thanh giờ, Wi-Fi và pin của iPhone vẫn tồn tại nhưng dùng nền đen cùng màu quán để ít gây chú ý và không đè nội dung.
3. Bấm **Bật âm thanh** trong Cà Phê LIVE; trong bảng điều khiển PC kiểm tra trạng thái âm thanh. Gửi một bình luận DEMO và bấm **Đọc lên** để thấy hiệu ứng/giọng đọc trên iPhone. Hãy giữ ứng dụng web này ở phía trước khi chia sẻ màn hình.
4. Bật **Không làm phiền**, sạc điện thoại và đặt tự khóa màn hình đủ lâu cho buổi phát. Khi chia sẻ màn hình, thông báo và ứng dụng ông mở có thể hiện cho người xem. Có thể bật **Truy cập được hướng dẫn / Guided Access** để khóa iPhone trong Cà Phê LIVE, tránh vuốt nhầm; tính năng này không xóa thanh trạng thái.

## Phát qua TikTok trên iPhone

1. Trong TikTok: **+ → LIVE → Chia sẻ màn hình / Mobile gaming** (tên mục tùy phiên bản). Chọn bố cục dọc nếu ứng dụng cho phép. Nếu TikTok hiện điều kiện chỉ dành cho nội dung game mà quán không đáp ứng theo hướng dẫn của ứng dụng, không dùng chế độ đó.
2. Nhập tiêu đề rồi bắt đầu LIVE. Khi iPhone hiện bảng **Screen Broadcast / Phát màn hình**, chọn TikTok và xác nhận bắt đầu phát màn hình.
3. Chuyển ngay sang **Cà Phê LIVE** đã thêm ở Màn hình chính và giữ nó ở phía trước. Trên PC, nhập `_tuduylogic_` và bấm **Kết nối TikTok** sau khi LIVE đã bắt đầu. Chỉ khi trạng thái là **Đã nối LIVE**, bình luận/quà/follow thật mới đến quán. Nguồn sự kiện là thư viện TikTok không chính thức; nếu thư viện hoặc dịch vụ ký kết nối báo lỗi, hình quán vẫn có thể phát nhưng phản ứng theo sự kiện thật sẽ chưa hoạt động. Xem lỗi cụ thể trong cửa sổ **Kết nối TikTok** trên PC.
4. Dùng tài khoản hoặc điện thoại thứ hai vào xem để xác nhận **hình chuyển động, chữ đọc được, âm thanh nghe được và sự kiện vào phòng tạo nhân vật**. Nếu TikTok chưa gửi sự kiện vào phòng, bình luận cũng tạo nhân vật. Chia sẻ màn hình trên iPhone có thể xử lý âm thanh ứng dụng khác nhau theo bản iOS/TikTok; chỉ dấu **ÂM THANH: iPhone / mạng nội bộ** trên PC chưa chứng minh người xem nghe được tiếng.
5. Khi muốn kết thúc, quay lại TikTok và kết thúc LIVE theo nút của ứng dụng. Sau đó bấm Ctrl+C ở cửa sổ server PC để đóng chế độ mạng nội bộ.

Nếu TikTok chỉ có **camera** mà không có chia sẻ màn hình, điện thoại không thể lấy overlay web làm khung hình bằng các bước trên. Cần dùng một phương thức phát có quyền lấy màn hình hoặc chờ tài khoản được duyệt LIVE Studio trên PC. Không có bước nào trong ứng dụng quán tự cấp quyền này.
