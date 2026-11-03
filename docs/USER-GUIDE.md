# Cà Phê Sau 12h · Studio gọn ☾

Bộ LIVE cục bộ cho **@_tuduylogic_**, phát triển từ [Chánh Điện Online của Kent Juno](https://github.com/kentjuno/chanh-dien-online), giấy phép MIT. Giữ Node.js + WebSocket + HTML/canvas; trải nghiệm mới dùng quán cà phê, sân khấu và trò chuyện. Xem [LICENSE](../LICENSE), tài liệu gốc ở [UPSTREAM.md](../UPSTREAM.md). Hình và nhạc tôn giáo gốc đã được loại khỏi bản phân phối.

## Mở quán và thử khi chưa LIVE

Cần Node.js 20 trở lên. Nhấp đúp **start-cafe.cmd**, hoặc chạy:

```powershell
cd tiktok-live-cafe/live
npm.cmd ci
npm.cmd start
```

Mở **http://localhost:3000**. Mở **Overlay & âm thanh**, bấm **Bật âm thanh** trong tab dọc và giữ tab đó mở. Khung xem trước trong Studio luôn im lặng. Chỉ một overlay phát tiếng; bật tab mới sẽ chuyển nguồn âm thanh sang tab mới.

Không cần kết nối TikTok để thử. Trong **Thử tương tác**, chọn tên khách rồi gửi `nhảy`, `hát`, `múa`, `khiêu vũ`, hoặc tặng một hoa hồng DEMO. Gửi `!nhac MÃ` để chọn bài; mặc định bình chọn nhạc miễn phí. Dùng nhiều tên để kiểm tra số người chọn và ghép đôi khiêu vũ. Nút **Thử follow** hiển thị lời cảm ơn mà không cần LIVE. Các nút **12 / 36 / 100 khách** đặt lại số khách DEMO do chính các nút tạo; chọn số nhỏ hơn sẽ cho khách DEMO dư rời quán, còn khách LIVE và khách thử bằng tên riêng vẫn ở lại. Nếu số ghế không đủ, số khách DEMO được giới hạn theo chỗ trống.

Hướng dẫn chạy thử bằng PC ở [LIVE-STUDIO.md](../LIVE-STUDIO.md). Mở `open-overlay.cmd` để có cửa sổ dọc riêng, bật âm thanh rồi chọn cửa sổ trong LIVE Studio. Có nguồn OBS Browser Source **1080 × 1920** im lặng tại **http://localhost:3000/live/overlay.html?capture=1**; tiếng lấy từ overlay thường. Sau khi kênh đang LIVE công khai, nhập username của bạn và bấm Kết nối TikTok. DEMO không chứng minh kết nối LIVE thật hoặc quyền phát của tài khoản.

Để phát bằng **iPhone có chia sẻ màn hình**, xem [IPHONE-LIVE.md](../IPHONE-LIVE.md). `start-phone.cmd` mở link nội bộ có mã riêng theo phiên; PC vẫn giữ Studio. Kiểm tra hình và tiếng từ một tài khoản xem khác trước khi dùng lâu dài.

Trên iPhone, bấm **Bật âm thanh** trong Safari và kiểm tra Studio báo **ÂM THANH: iPhone / mạng nội bộ**. Thanh âm lượng nhạc chung trên Studio điều khiển nhạc nền lẫn bài order qua Web Audio; khi đọc, nhạc hạ xuống để giọng nổi rõ. Âm lượng hệ thống Windows không điều khiển âm lượng iPhone.

## Radio và quyền chủ quán

Studio chia thành năm tab **Điều khiển, Nhạc & order, Sân khấu, Giọng đọc, Giao diện**. Thanh phát nhạc và xem trước luôn ở cạnh công cụ đang mở trên desktop; trang không kéo dài qua tất cả cài đặt. Tab nhớ lựa chọn trên trình duyệt, hỗ trợ phím mũi tên, Home/End. Các cài đặt ít dùng thu trong mục mở rộng. Trên điện thoại, xem trước mặc định thu gọn.

- **Thêm file nhạc** ngay trong Studio: MP3, WAV, OGG, M4A, tối đa 100 MB/file. File mới chỉ vào **Thư viện**, chưa hiện mã bài cho người xem. Tích bài nào thì bài đó có mã `!nhac` và hiện ngay trên băng chuyền overlay; bỏ tích sẽ ẩn bài khỏi order. Nếu bỏ tích một bài đang chờ hoặc đang phát, bài đó cũng được gỡ khỏi hàng chờ hoặc dừng phát. Lựa chọn được lưu qua lần khởi động sau. Nút **Ẩn tất cả** bỏ toàn bộ bài khỏi danh sách order. Không ghi đè file cùng tên. Cũng có thể chép vào `assets/radio/` rồi tải lại thư viện. File cần codec trình duyệt hỗ trợ và quyền phát phù hợp.
- Nếu Studio báo **Server đang chạy bản cũ**, đóng cửa sổ server hiện tại rồi mở lại `start-cafe.cmd` hoặc `start-phone.cmd`. Trang giao diện có thể đọc code mới ngay từ ổ đĩa, nhưng tiến trình Node đang chạy phải được mở lại để hiểu lệnh tích/bỏ tích.
- Bấm **Sửa tên** ở từng bài trong thư viện để đặt tên hiển thị trên Studio và overlay. Tên mới áp dụng ngay cho bài trong hàng chờ, bài đang phát và băng chuyền mã nhạc; mã `!nhac` và tên file gốc không đổi. Bấm **Tên gốc** rồi lưu để khôi phục. Tên hiển thị được lưu qua lần khởi động sau.
- Tìm tên bài trong thư viện. Với bài đã đưa lên danh sách, **+ Hàng chờ** thêm bài của chủ quán; **Phát ngay** thay bài đang phát. Đưa lên danh sách chỉ cho phép người xem chọn, chưa tự phát bài khi hàng chờ trống. Không cần quà cho thao tác chủ quán.
- Trong hàng chờ, bấm **tên bài để phát ngay**. Có nút lên/xuống, ghim/bỏ ghim, xóa từng bài và xóa toàn hàng chờ. Thao tác ghim/sắp xếp của chủ quán có ưu tiên cao hơn quà mới. Bỏ ghim từng bài để trở về thứ tự tự động.
- Điều chỉnh riêng âm lượng bài order, âm lượng nhạc nền, âm lượng giọng. **Nhạc còn lại khi đọc** là tỷ lệ giữ lại: 25% nghĩa là khi có lời đọc, nhạc còn một phần tư âm lượng đã đặt.
- Có tạm dừng/tiếp tục, tua bằng thanh thời gian, bài tiếp, dừng phát. **Dừng** không xóa hàng chờ. Tắt **Tự phát bài tiếp** để duyệt thủ công. Bấm tên bài hoặc tiếp tục để phát lại.
- Tạm đóng nhận order khi quá đông; chủ quán vẫn thêm và phát bài được. Giới hạn hàng chờ chỉnh từ 5 đến 100 bài, mặc định 50.

Mặc định **Bình chọn nhạc cộng đồng** được bật:

1. `!nhac MÃ` tạo hoặc cộng một phiếu vào bài đang chờ. Các yêu cầu cùng mã gộp thành một bài; một người chỉ có một phiếu trong hàng chờ. Gõ lại cùng mã không tăng phiếu. Đổi mã chuyển phiếu và ưu tiên quà đi kèm, cách ít nhất 3 giây.
2. Xếp theo **chủ quán ghim/sắp xếp → số người chọn → giá trị quà khi bằng phiếu → đề cử trước**. Quà không vượt bài có nhiều người chọn hơn. Bài đang phát không bị ngắt bởi bình chọn hay quà.
3. Quà trước khi chọn bài được giữ cho lần đề cử tiếp theo; quà khi đã chọn cộng vào bài đang chờ. Điểm tiêu khi bài bắt đầu hoặc bị xóa. Không nhân đôi điểm khi đổi phiếu.
4. Overlay có hướng dẫn, ba bài đầu, thanh số người chọn và mã bài ở phía trên. Mã thư viện chạy ngang liên tục thành băng chuyền, nối vòng liền nhau; cập nhật phiếu không khởi động lại băng. Phiếu DEMO được ghi riêng cạnh tổng phiếu; không phải người thật. Xóa đề cử giải phóng phiếu; đang phát rồi thì người xem chọn bài kế tiếp.
5. Tắt **Bình chọn nhạc cộng đồng** chuyển về kiểu order có quà; việc chuyển chế độ xóa các đề cử cộng đồng đang chờ, giữ bài chủ quán thêm và bài đang phát.

Khi dùng kiểu order có quà:

1. Quà trước order được giữ làm điểm cho **một lần order tiếp theo** của người đó trong phiên.
2. Khi người đó đã có bài đang chờ, quà mới cộng vào ưu tiên **đúng bài đó**.
3. Hàng tự động xếp theo tổng KC gắn với từng yêu cầu, cao trước; bằng nhau thì yêu cầu trước đứng trước. Không tự cắt bài đang phát. Chủ quán có thể cắt bằng Phát ngay.
4. Điểm đã dùng cho một yêu cầu không được dùng vô hạn cho các bài tiếp. Xóa yêu cầu không hoàn lại quà TikTok. Mỗi người một bài đang chờ và tối đa một order/30 giây; các giới hạn không áp dụng cho bài chủ quán thêm.

Mã số bài theo thứ tự các bài đang có trong danh sách phát; có thể đổi khi thêm/gỡ bài. File ở thư viện nhưng chưa được chọn không có mã công khai. Bài lỗi bị bỏ qua và ghi nhật ký. Không có tìm kiếm hoặc tải nhạc YouTube/Spotify trong bản này.

## Nhạc nền, giọng đọc và lời một chạm

Sáu kiểu nhạc nền tự tạo bằng Web Audio: **Midnight lofi, Piano bên cửa sổ, Bossa cà phê, Vườn mơ, Mưa và hợp âm, Night drive**. Mỗi kiểu có nhịp, hợp âm và giai điệu riêng; không phải các bản thu thương mại. Nhạc nền nhường chỗ cho bài order. Tắt Nhạc nền không tắt bài order.

**Giọng chủ quán** có Hoài My/Nam Minh, tốc độ -50% đến +50%, độ cao -50 đến +50 Hz và âm lượng riêng. Lời đang đọc giữ tham số lúc bắt đầu; thay đổi áp dụng cho lượt đọc kế tiếp. Dừng đọc hủy cả lời đang phát và hàng đợi lời đọc.

Thêm tên nút và nội dung vào **Lời đọc một chạm**. Có thể lưu tối đa 30 lời, sửa/xóa và bấm để đọc. **Tạo giọng sẵn** tạo và lưu file; cùng nội dung + giọng + tốc độ + độ cao sẽ dùng lại file, giảm thời gian chờ. Khi đổi các tham số này, cần tạo giọng tương ứng. Cache tối đa 120 file.

Trong **Giọng đọc → Chỉnh lời cảm ơn hoa hồng / quà / follow**, mỗi dòng là một câu (1–12 câu/nhóm, tối đa 320 ký tự/câu). Dùng `{name}`, `{gift}`, `{count}` để chèn dữ liệu. Bấm **Lưu lời cảm ơn**; các câu xoay vòng trong phiên, tránh lặp liên tiếp khi có nhiều câu. **Nghe thử câu đã lưu** hiển thị câu hoàn chỉnh và phát nếu overlay đã bật tiếng. Có bật/tắt đọc follow. Sự kiện follow hiển thị tên và lời cảm ơn, không tự tạo ghế; mỗi tài khoản được cảm ơn một lần trong phiên. Follow thật cần kết nối LIVE và thư viện trả sự kiện follow.

Lời mẫu chủ quán xưng **tôi – mọi người**; lời tự động cảm ơn từng người tặng quà xưng **mình – bạn**, kèm tên người tặng và món quà. Lời tự nhập và file thu âm phát theo nội dung chủ quán đã chọn.

Ứng dụng ưu tiên giọng **Hoài My/Nam Minh của Edge** qua Internet. Khi Edge ngắt luồng hoặc quá hạn 8 giây, ứng dụng tự tạo **MP3 tiếng Việt dự phòng qua đường đọc web của Google Translate**. Nguồn dự phòng không yêu cầu máy cài giọng Việt; Studio hiện rõ **Đang phát giọng Việt dự phòng (Google)**. Google dùng giọng Việt riêng, hỗ trợ tốc độ và âm lượng; độ trầm/cao giữ nguyên. Mỗi lượt đọc mới lại thử Edge, không khóa giọng 60 giây. Đường đọc web của Google cũng phụ thuộc dịch vụ bên ngoài và Internet.

Câu dài được chia ở ranh giới từ thành đoạn tối đa 180 ký tự rồi ghép MP3 theo thứ tự; không cắt bỏ phần sau. Nguồn giọng và tốc độ phát được lưu cùng cache để đọc lại đúng sau khi khởi động server. Hủy đọc sẽ hủy cả yêu cầu đang tạo âm thanh. Chỉ khi cả hai nguồn trực tuyến đều lỗi mới thử giọng Việt trên máy; nếu máy không có, Studio báo rõ hai điều kiện này thay vì chỉ báo thiếu giọng Việt.

Nút **Bật âm thanh** kích hoạt cả nhạc lẫn bộ phát giọng trong chính lần bấm, để trình duyệt cho phép đọc sau đó. Studio phân biệt Đang tạo giọng / Đang thử lại / Đang phát giọng / Trình duyệt chặn tiếng. Nếu bị chặn, bấm lại nút Bật âm thanh trong overlay để cho phép; không cần kết nối TikTok.

Ông cũng có thể thêm file giọng tự thu qua thư viện, chọn file ở **Lời đọc một chạm → File giọng thu âm**. Khi bấm nút đó, file phát trực tiếp, không cần Edge TTS. Tên file và nguồn âm thanh được lưu cùng lời; file vẫn cần có trên máy. Tốc độ/độ cao TTS không đổi giọng của file thu âm; âm lượng giọng và giảm nhạc khi đọc vẫn áp dụng.

## Sân khấu và chỗ ngồi

- Sân khấu nhập **1–100 người**, có gợi ý 5, 8, 12, 24, 50, 100. Mặc định mới 5 người, **10 giây/lượt**; thời lượng chỉnh từ 3–180 giây. Số ghế tổng được tăng tối thiểu bằng sức chứa sân khấu. Từ 5 người đang diễn, sân khấu tự chia nhiều hàng; khách còn lại ở hai cánh. 50–100 người hiển thị nhỏ hơn; nên thử 8–24 trước khi tăng và kiểm tra tải cùng LIVE Studio. Nút **Điền DEMO đủ số chỗ sân khấu** phục vụ kiểm tra, vẫn gắn cờ DEMO. Cấu hình trước bản 4 bật bình luận biểu diễn, bình chọn nhạc và đưa mốc quà về 1 KC; giữ tên quán, thời lượng, giọng, nhạc và các lời tự viết.
- **1 hoa hồng = 1 lượt nhảy** vẫn áp dụng cho quà tặng, nhưng overlay không còn treo lời kêu tặng hoa. Mỗi món quà khác đủ mốc cho một lượt; combo N món cộng N lượt. Giá trị quà ưu tiên hàng chờ sân khấu và phá hòa bình chọn nhạc. Quà khác dưới mốc tùy chỉnh được cộng KC để đủ lượt. Quy tắc và giây/lượt chỉ chỉnh trong Studio.
- Quà thêm cộng số lượt, không đặt lại bộ đếm lượt đang diễn ra. Hết lượt còn dư thì về vòng chờ, nhường người đang đợi trước khi vào lượt tiếp; hết hẳn thì trở lại bàn. Chủ quán nhìn được số lượt còn lại của từng người.
- Nếu tặng trước khi bình luận, quyền lên sân khấu được giữ đến khi người đó bình luận. Đầy sân khấu thì xếp hàng; người đang nhảy không bị đẩy xuống khi có quà mới.
- Mặc định bình luận **nhảy**, **hát**, **múa**, **khiêu vũ** được lên sân khấu hoặc vào hàng chờ. Có cooldown 4 giây khi đổi động tác. Đổi động tác không cộng lượt hoặc đặt lại bộ đếm. Hai người cùng chọn khiêu vũ và đã có chỗ mới ghép đôi; một người thì đợi bạn, không kéo người khác lên. Quà ưu tiên trước yêu cầu miễn phí khi sân khấu đầy, không đẩy người đang diễn xuống.
- Chủ quán bấm **♫ cạnh khách** để mời lên, mời từng người xuống hoặc dọn sân khấu/hàng chờ. Có thể tắt bình luận biểu diễn miễn phí trong tab Sân khấu.
- Sự kiện **vào phòng** từ TikTok tạo nhân vật và chỗ ngồi; bình luận cũng tạo ghế nếu sự kiện vào phòng chưa tới. Số người hiện phụ thuộc các sự kiện TikTok gửi về, không bảo đảm khớp số người đang xem.
- Số ghế chọn 24, 36, 64, 100, 150, 200. Giảm giới hạn giữ khách đang ngồi. Đầy chỗ thì người không tặng quà, không ở sân khấu và im lặng lâu nhất nhường chỗ. Nếu tất cả đều được giữ chỗ, người mới phải đợi; quà vẫn ghi nhận.

## Hiển thị và không gian

Mười cảnh có màu và chi tiết riêng: **Cà phê sau 12h, Neon concert, Vườn ánh trăng, Rooftop thành phố, Tiệm sách đêm, Cà phê bên biển, Góc mưa Sài Gòn, Pixel arcade, Hiên hoa anh đào, Nhà gỗ mùa đông**. Đổi cảnh giữ nhân vật, nhạc và hàng chờ.

Trong **Giao diện → Chuyển động quán & nhân vật**, chọn **Nhẹ nhàng** (mặc định), **Nổi bật** hoặc **Tắt chuyển động**. Quán luôn có đèn quét, dải đèn, nốt nhạc; khi vắng khách, nhân vật **CHỦ QUÁN · BIỂU DIỄN TỰ ĐỘNG** luân phiên hát, nhảy, múa, không được tính là khách. Khách tự chớp mắt, nhấp đồ uống và hưởng ứng bằng vẫy tay/vỗ tay xen kẽ; bình luận có thể gọi động tác cụ thể. Sáu điệu nhảy khác nhau ở tay, chân và thân: disco, shuffle, robot, hip-hop, twist và wave. Có bước chân, chuyển tay mượt, cầm mic, dải lụa và hai người khiêu vũ cầm tay. Đây là animation mô phỏng, không tạo tiếng hát thật hoặc đồng bộ khẩu hình với TTS/nhịp file nhạc.

Tắt chuyển động giữ tư thế tĩnh và chuyển chỗ ngay. Yêu cầu giảm chuyển động của thiết bị được ưu tiên hơn mức đã chọn. Khung xem trước giới hạn 30 khung hình/giây và nghỉ khi trang ẩn. Overlay thường tối đa 60 khi hiện, dùng đồng hồ Worker tối đa 30 khi trang ẩn; nguồn hình `?capture=1` im lặng, tối đa 30 và vẫn vẽ khi ẩn. Nhân vật, đèn và dây chuyền mã nhạc dùng cùng nhịp vẽ. Đây là giới hạn tốc độ vẽ, không bảo đảm FPS trên mọi máy; vẫn giữ cửa sổ được chụp mở, không thu nhỏ vì phần mềm chụp có thể ngừng lấy hình cửa sổ thu nhỏ.

Chỉnh số bong bóng cùng lúc (1–8), thời gian (3–15 giây), cỡ chữ và độ rộng. Nhân vật đi từ bàn lên sân khấu và về lại bàn; bong bóng dùng đúng tọa độ đầu nhân vật đang di chuyển hoặc nhảy. Chat trên sân khấu được ưu tiên, bố trí gần đầu và tránh bảng quà, bảng top, mục tiêu và các bong bóng khác. Chat vẫn hết hạn theo thời gian đã đặt, không giữ vô hạn chỉ vì đang nhảy. Không đủ chỗ thì tạm ẩn câu thấp ưu tiên. Có thể ẩn bong bóng lệnh để dành chỗ cho trò chuyện. 150–200 ghế làm nhân vật nhỏ hơn; nên dùng 24–64 khi ít khách.

Avatar nhận từ profile trong sự kiện TikTok sẽ thay đầu nhân vật bằng ảnh tròn, theo cùng cử động và giữ tên bên dưới. Có thể tắt trong **Giao diện → Ghế ngồi & bình luận**. Không có ảnh hoặc ảnh lỗi thì dùng chữ viết tắt tên, không tạo ảnh người giả. Ảnh được tải qua máy chủ cục bộ với danh sách CDN TikTok cho phép, giới hạn dung lượng và chặn chuyển hướng ra địa chỉ khác; không cho trình duyệt làm hỏng khả năng chụp canvas vì ảnh khác nguồn. DEMO mặc định dùng chữ viết tắt; bài kiểm tra ảnh dùng PNG bàn cờ được ghi rõ là fixture.

Follow có thanh thông báo riêng nền sáng phía trên, tạm phủ thanh nhạc trong 5,5 giây, hiện tên lớn và ảnh nếu có. Thông báo quà vẫn độc lập. Các follow dồn cùng lúc được xếp hàng có giới hạn, có chỉ báo số đang chờ. Overlay tập trung vào lệnh bình luận điều khiển nhân vật, cú pháp order nhạc và hàng chờ; câu hỏi đã được bỏ khỏi màn hình.

| Bình luận | Hoạt động |
| --- | --- |
| Bất kỳ câu nào | Vào ngồi và trò chuyện |
| `!uong latte`, `!uong den`, `!uong tra`, `!uong cacao` | Chọn đồ uống |
| `!ao 1` đến `!ao 6` | Đổi nhân vật |
| `!nhac MÃ` hoặc `!nhac TÊN BÀI` | Bình chọn bài tiếp theo (hoặc order khi tắt bình chọn) |
| `nhảy`, `nhảy 1` đến `nhảy 6` (hoặc `!nhay`) | Lên nhảy, chọn hoặc đổi điệu |
| `hát`, `múa`, `khiêu vũ` | Cầm mic, múa lụa, xin ghép đôi |
| `vỗ tay`, `vẫy tay`, `đèn` | Hưởng ứng, chào, điều khiển đèn; có cooldown |

## Donate và bộ quà thử

Overlay hiển thị tổng quà, top 5, mục tiêu có thanh tiến độ và bảng hiệu ứng. KC là **kim cương TikTok, không phải số tiền VNĐ đã nhận**. Mục tiêu thật hoàn thành bật đèn 30 giây. Quà và tim DEMO có tổng riêng, không cộng vào mục tiêu thật.

Bộ thử có Rose, Finger Heart, Perfume, Doughnut, Paper Crane, Hand Hearts, Sunglasses, Confetti, Galaxy, Lion. Tên lấy theo các loại quà TikTok; **KC bộ DEMO là giá trị chạy thử, không phải bảng giá hiện hành**. Có thể chỉnh KC/món và số lượng. Khi nối LIVE, ứng dụng dùng danh sách quà phòng nếu thư viện trả về; quà thật luôn tính theo payload sự kiện. Combo chỉ tính khi kết thúc, không cộng lặp mỗi lần tăng combo.

## Lưu cấu hình và giới hạn

- Cấu hình và lời đọc mẫu tự lưu tại `live/data/studio.json`. Dữ liệu câu hỏi cũ vẫn được giữ trong bản sao cấu hình để tránh mất nội dung đã soạn. Ghi qua file tạm rồi đổi tên. Có xuất/nhập JSON để sao lưu. Dữ liệu này và cache giọng không được Git theo dõi.
- Nhân vật, quà, điểm order, sân khấu, lượt bình chọn và hàng chờ là dữ liệu **trong phiên**, đặt lại khi tắt server. Dọn quán giữ cấu hình nhưng xóa các thống kê phiên.
- Bộ đếm là khách đã nhận được sự kiện vào phòng hoặc bình luận và được xếp chỗ, **không phải số concurrent viewers TikTok**. Chưa có xử lý rời phòng; nhân vật còn ở quán sau khi người xem thoát.
- `tiktok-live-connector 2.5.0` là thư viện cộng đồng; TikTok hoặc dịch vụ ký kết nối thay đổi có thể làm kết nối lỗi. [Tài liệu phiên bản đang dùng](https://github.com/zerodytrash/TikTok-Live-Connector/tree/v2.5.0). Thử DEMO không xác minh kết nối kênh thật.
- Server chỉ mở `127.0.0.1`, kiểm tra Host/Origin và danh sách file công khai. Tải file chỉ nhận nguồn từ Studio, giới hạn dung lượng và chặn đường dẫn thoát thư mục. Không nhập mật khẩu/cookie/session TikTok. Chưa có đăng nhập để đưa server công khai lên Internet.
- Chưa có bộ lọc nội dung bình luận nâng cao; cần kiểm duyệt phòng. Chữ được xử lý như văn bản, không chạy HTML. Font Google có font máy dự phòng.

## Kiểm tra và cấu trúc

```powershell
cd live
npm.cmd run check
npm.cmd test
npm.cmd run test:ui
# Kiểm tra có Internet: tạo giọng Hoài My và Nam Minh mới rồi phát trong Chrome
npm.cmd run test:voice
```

Không có bước build. Kiểm tra UI dùng Chrome cài trên Windows; có thể đặt `CHROME_PATH` nếu đường dẫn khác. Test dùng thư mục cấu hình riêng, file WAV tín hiệu tự tạo để kiểm tra phát nhạc/giọng thu âm và xóa file đó sau khi chạy. Ảnh chụp ở `live/artifacts/`. Không tự nối kênh LIVE khi test.

`live/cafe.mjs`: logic phòng; `server.mjs`: HTTP, WebSocket, TikTok, TTS và lưu cấu hình; `control.*`: Studio; `overlay.*`: màn hình LIVE; `audio-engine.js`: âm thanh; `scene-renderer.js`: cảnh; `motion.js`: tư thế và vị trí đầu nhân vật; `bubble-layout.js`: bố trí bình luận; `presets.js`: cảnh, nhạc nền và dữ liệu mẫu; `assets/radio/`: thư viện file của ông.
