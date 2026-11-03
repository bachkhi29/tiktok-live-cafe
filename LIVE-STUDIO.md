# Phát quán cà phê bằng TikTok LIVE Studio trên PC

Hướng dẫn đưa hình quán, nhạc và giọng đọc lên LIVE Studio, rồi nhận bình luận/quà/follow vào quán. Tên menu có thể khác giữa các phiên bản và ngôn ngữ.

## 1. Điều kiện và các cửa sổ cần mở

- Windows, Node.js 20+, Chrome hoặc Edge.
- TikTok LIVE Studio đã cài và tài khoản **được phép phát bằng LIVE Studio**. Nếu báo **No access / Not approved**, cần xử lý quyền truy cập với TikTok; quán và OBS không tự mở được quyền này. Vẫn có thể chuẩn bị và thử DEMO cục bộ.
- Tai nghe để tránh mic thu lại nhạc/giọng đọc từ loa.
- OBS chỉ cần cho phương án tạo nguồn hình 1080 × 1920 bên dưới.

| Cửa sổ | Nhiệm vụ |
| --- | --- |
| Server mở bằng `start-cafe.cmd` | Giữ quán chạy; không đóng trong lúc LIVE |
| Studio quán `http://localhost:3000` | Điều khiển nhạc, nhân vật và kết nối sự kiện TikTok |
| Overlay mở bằng `open-overlay.cmd` | Phát hình quán và âm thanh; phải bấm Bật âm thanh |
| TikTok LIVE Studio | Gửi hình và tiếng lên TikTok |

## 2. Chuẩn bị quán trước khi phát

1. Giải nén/clone repo, mở **`start-cafe.cmd`**. Lần đầu chương trình cài dependency; chờ hiện địa chỉ server.
2. Mở **http://localhost:3000**. Nếu đang chạy phiên server cũ, đóng cửa sổ đó rồi mở lại `.cmd`; tải lại trang bằng Ctrl+F5.
3. Trong **Giao diện**, đặt tên quán và lời chào của kênh, chọn cảnh. Bắt đầu khoảng 24–64 ghế và 5–12 chỗ sân khấu để chữ/nhân vật dễ nhìn.
4. Trong **Nhạc & order**, thêm nhạc bạn có quyền sử dụng. Tích những bài cho người xem order. Có thể dùng nhạc nền tự tạo khi chưa có file riêng.
5. Mở **`open-overlay.cmd`** từ thư mục dự án. Đây là cửa sổ overlay riêng, dùng profile trình duyệt riêng trong `.browser-overlay/`.
6. Trong overlay, bấm **Bật âm thanh**. Trong Studio quán, thử **Đọc lên** và phát thử nhạc. Cần nghe tiếng trước khi cấu hình thu âm trong LIVE Studio.
7. Gửi `nhảy`, `hát`, thử follow/quà DEMO để xác nhận hình chuyển động. Chưa cần phát LIVE thật cho bước này.

Giữ cửa sổ overlay mở, không thu nhỏ. Trình duyệt có nhịp vẽ khi ẩn, nhưng phần mềm chụp cửa sổ có thể ngừng lấy hình một cửa sổ bị thu nhỏ.

## 3. Tạo cảnh dọc trong LIVE Studio

1. Đăng nhập đúng tài khoản đã có quyền LIVE Studio.
2. Tạo/chọn cảnh dọc **9:16 / Portrait / Mobile view**.
3. Trong thiết lập chất lượng, dùng **30 FPS** trước. Chọn 1080 × 1920 nếu ứng dụng và máy/mạng cho phép; có thể giảm 720 × 1280 khi cần.
4. Tắt/xóa các nguồn không muốn phát như webcam, chụp toàn màn hình, cửa sổ khác hoặc khung mẫu. Chỉ bật các nguồn bạn muốn người xem thấy.
5. Thêm hình quán bằng **một** trong ba phương án bên dưới.

## 4A. Dễ nhất: chụp cửa sổ overlay

1. Trong **Sources / Nguồn → Add source / Thêm nguồn**, chọn **Window capture / Chụp cửa sổ**.
2. Chọn cửa sổ quán mở bởi `open-overlay.cmd`, không chọn Studio điều khiển hay cửa sổ server.
3. Dùng **Fit to screen / Vừa màn hình** hoặc kéo nguồn phủ khung dọc. Giữ tỷ lệ 9:16; không kéo giãn riêng chiều ngang.
4. Nếu có viền/thanh tiêu đề, dùng crop/cắt nguồn của LIVE Studio để chỉ lấy nội dung quán. Xem lại để không mất tiêu đề, lệnh tương tác, hàng nhạc và mục tiêu.
5. Gửi một bình luận DEMO từ Studio quán rồi chuyển sang LIVE Studio. Nhân vật và mã bài phải tiếp tục chuyển động.

Ảnh nguồn phụ thuộc kích thước cửa sổ thực tế. Chụp cửa sổ cao khoảng 900 px rồi kéo thành 1920 px có thể mờ. Nếu muốn nguồn hình 1080 × 1920 độc lập với màn hình Windows, dùng phương án 4C.

## 4B. Nếu LIVE Studio có nguồn Website / Link

Chỉ dùng khi phiên bản của bạn thực sự có nguồn này.

1. Thêm nguồn Website/Link với URL **`http://localhost:3000/live/overlay.html?capture=1`**.
2. Đặt chiều rộng **1080**, chiều cao **1920** nếu nguồn có các ô kích thước. Căn vừa khung dọc.
3. Nguồn `?capture=1` xuất hình im lặng. Giữ overlay thường đã bật âm thanh để thu nhạc/giọng bằng hướng dẫn phần 5.
4. Thử DEMO để kiểm tra nguồn này tải và có chuyển động; nếu không có nguồn Website/Link, dùng 4A hoặc 4C.

## 4C. Nguồn hình rõ hơn: OBS → Virtual Camera → LIVE Studio

Cách này tạo khung quán trong OBS thay vì phóng to cửa sổ trình duyệt nhỏ. Tài khoản vẫn cần quyền phát LIVE Studio; Virtual Camera chỉ cung cấp nguồn hình.

1. Cài [OBS từ trang chính thức](https://obsproject.com/download), mở OBS.
2. Trong **Settings → Video** đặt:

   | Mục | Giá trị |
   | --- | --- |
   | Base (Canvas) Resolution | 1080 × 1920 |
   | Output (Scaled) Resolution | 1080 × 1920 |
   | Common FPS Values | 30 |

3. Tạo scene **Cà Phê LIVE**. Trong **Sources → + → Browser**, tạo nguồn với:

   | Mục | Giá trị |
   | --- | --- |
   | URL | `http://localhost:3000/live/overlay.html?capture=1` |
   | Width | 1080 |
   | Height | 1920 |
   | Use custom frame rate / FPS | Bật, 30 |
   | Shutdown source when not visible | Tắt trong lúc chuẩn bị phát |
   | Refresh browser when scene becomes active | Tắt để tránh tải lại giữa buổi |

4. Căn nguồn vừa canvas. Chọn scene quán rồi bấm **Start Virtual Camera** trong OBS. Nếu chọn đầu ra Virtual Camera, dùng **Program** hoặc cố định scene quán để tránh phát nhầm màn hình Preview khi chỉnh cảnh.
5. Trong **LIVE Studio → Add source → Camera**, chọn **OBS Virtual Camera**. Nếu ứng dụng có lựa chọn độ phân giải, thử 1080 × 1920.
6. Căn hình camera vào khung dọc; kiểm tra không bị cắt tiêu đề/chân khung hoặc méo chiều ngang. Nếu bản LIVE Studio/driver không nhận đúng khung dọc, quay về 4A thay vì kéo méo ảnh.
7. Giữ OBS và server quán chạy. Chưa cần bấm Start Streaming trong OBS; LIVE Studio là chương trình gửi buổi phát lên TikTok.
8. **Virtual Camera chỉ là hình.** Tiếng vẫn lấy từ overlay thường mở bằng `open-overlay.cmd` và đã bấm Bật âm thanh. Chuyển sang phần 5 để cấu hình riêng.

OBS mô tả kích thước/FPS của Browser Source trong [tài liệu Browser Source](https://obsproject.com/kb/browser-source), và cách xuất scene dưới dạng webcam trong [Virtual Camera Guide](https://obsproject.com/kb/virtual-camera-guide).

## 5. Lấy nhạc và giọng đọc vào LIVE Studio

1. Trong Windows, bảo đảm Chrome/Edge mở overlay không bị mute trong **Volume mixer**. Kiểm tra nhạc và giọng đọc đều nghe được bằng tai nghe.
2. Trong phần **Audio / Âm thanh** của LIVE Studio, chọn cách lấy tiếng:

   | Trường hợp | Nguồn cần lấy |
   | --- | --- |
   | Có thu tiếng ứng dụng riêng | Chọn đúng Chrome/Edge đang mở overlay |
   | Không có thu tiếng ứng dụng riêng | Dùng Desktop/System audio với đúng thiết bị âm thanh Windows |

3. Chỉ lấy tiếng quán qua **một đường**. Nếu đã thu tiếng ứng dụng, tắt đường Desktop đang thu lại cùng tiếng để tránh lặp/vọng.
4. Đặt mic riêng nếu muốn trò chuyện; tắt mic khi chưa dùng. Dùng tai nghe để mic không thu lại loa.
5. Trong Studio quán, phát nhạc rồi bấm **Đọc lên**. Cả hai cần làm thanh âm lượng LIVE Studio chuyển động. Không chỉ dựa vào việc bạn nghe được trên PC.
6. Chỉnh **Âm lượng nhạc chung**, **Âm lượng giọng** và **Nhạc còn lại khi đọc** trong Studio quán. Khi đọc, nhạc phải hạ để lời rõ; tránh để thanh thu âm thường xuyên chạm đỏ.
7. Nếu LIVE Studio có ghi thử/xem thử, dùng tính năng đó để nghe lại. Tắt tiếng điện thoại xem thử hoặc dùng tai nghe để tránh tạo vòng lặp âm thanh.

Khung xem trước trong Studio quán luôn im lặng. Nguồn overlay `?capture=1` cũng im lặng; không lấy nguồn này làm bằng chứng nhạc đã được thu.

## 6. Kiểm tra trước khi bấm Go LIVE

- Chỉ còn khung quán trong cảnh phát; không có thanh Windows, tab trình duyệt hoặc cửa sổ điều khiển.
- Đọc được lệnh tương tác và `!nhac MÃ` trên khung dọc; nhân vật/đèn/băng chuyền chuyển động khi chuyển qua lại cửa sổ.
- Nhạc và lời đọc đều hiện tín hiệu trong LIVE Studio; không bị lặp tiếng.
- Các bài muốn nhận order đã được tích; tên và mã hiện đúng trên overlay.
- Tắt bot và **Dọn quán** để xóa khách/quà/phiếu DEMO trước khi có người xem thật. Cài đặt/thư viện vẫn được giữ.
- Tiêu đề, cảnh và mic đã đúng ý. Chưa xóa DEMO bằng Dọn quán sau khi đã có khách thật vì thao tác này đặt lại cả phiên.

## 7. Phát LIVE và nối bình luận thật

1. Bấm **Go LIVE / Phát LIVE** trong LIVE Studio khi đã sẵn sàng.
2. Quay lại Studio quán ở `http://localhost:3000`, mở **Kết nối TikTok**, nhập **username kênh của bạn** và bấm Kết nối. Cần hiện **Đã nối LIVE**; dòng **Server đang chạy** chỉ chứng minh server quán đang mở.
3. Từ một điện thoại/tài khoản khác, vào xem rồi bình luận một câu. Nhân vật phải xuất hiện; avatar chỉ hiện khi sự kiện TikTok cung cấp ảnh hợp lệ.
4. Thử `nhảy`, `hát`, `múa`, `!nhac MÃ`. Hai người cùng chọn `khiêu vũ` để kiểm tra ghép đôi.
5. Xác nhận follow/quà khi có sự kiện thật. Hiệu ứng quà DEMO không chứng minh quà TikTok thật đã đến server.
6. Trong buổi phát, giữ server, overlay thường, OBS (nếu dùng) và LIVE Studio mở. Dùng Studio quán để điều khiển, thay vì đổi sang chụp toàn màn hình.
7. Khi kết thúc, dừng LIVE trong LIVE Studio trước, rồi dừng Virtual Camera/OBS và tắt server nếu không dùng nữa.

## 8. Các lỗi hay gặp

| Hiện tượng | Cách xử lý |
| --- | --- |
| No access / Not approved | Kiểm tra quyền LIVE Studio trong đúng tài khoản; ứng dụng quán/OBS không thay thế quyền này. |
| Hình đen | Kiểm tra server, mở URL overlay bằng trình duyệt; chọn lại đúng cửa sổ/camera và thử phương thức chụp khác nếu có. |
| Hình đứng khi đổi cửa sổ | Giữ overlay không thu nhỏ; xem animation có bị tắt hoặc thiết bị có bật giảm chuyển động không. |
| Hình mờ | Nguồn cửa sổ có thể nhỏ; dùng 4C và kiểm tra bản phát thực tế từ máy xem khác. |
| Hình OBS bị kéo ngang | Kiểm tra canvas/nguồn đều 1080 × 1920 và không stretch sai tỷ lệ; đổi sang 4A nếu camera không nhận khung dọc. |
| Có hình nhưng không có tiếng | Virtual Camera/capture=1 chỉ có hình; kiểm tra overlay thường đã bật tiếng và đường thu âm LIVE Studio. |
| Tiếng vọng/lặp | Đang thu hai lần cùng nguồn hoặc mic thu lại loa; giữ một đường tiếng và dùng tai nghe. |
| Người xem chat nhưng quán không phản ứng | Xem trạng thái Kết nối TikTok, username, LIVE công khai và nhật ký lỗi; việc có hình không chứng minh đã nhận sự kiện. |
| Bỏ tích nhạc không có hiệu lực | Đóng server cũ, mở lại `.cmd`, tải lại Studio. Studio mới sẽ cảnh báo khi server chưa hỗ trợ lệnh. |

Các bước PC/OBS là hướng dẫn cấu hình, không phải xác nhận mọi tài khoản/phiên bản LIVE Studio đã được thử. Bản phát cuối còn phụ thuộc quyền tài khoản, bản ứng dụng, máy và đường truyền.

Nguồn chính thức: [TikTok LIVE Studio](https://www.tiktok.com/studio/download), [TikTok LIVE](https://support.tiktok.com/en/live-gifts-wallet/tiktok-live/what-is-tiktok-live), [OBS Browser Source](https://obsproject.com/kb/browser-source), [OBS Virtual Camera](https://obsproject.com/kb/virtual-camera-guide).
