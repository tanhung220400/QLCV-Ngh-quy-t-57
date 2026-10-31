# Phần mềm Giao việc & Theo dõi chỉ tiêu cấp xã

Phục vụ triển khai Nghị quyết 57-NQ/TW. Lãnh đạo xã biết ngay việc nào đang chậm, chỉ tiêu nào có nguy cơ không đạt, ai chịu trách nhiệm, mà không phải chờ báo cáo giấy.

Chạy trên điện thoại, máy tính bảng và máy tính (web cài được như ứng dụng, PWA).

## Chức năng

**Giao việc** (mục 3 đặc tả)
- Mỗi việc bắt buộc có người chủ trì, hạn hoàn thành và sản phẩm đầu ra. Thiếu một trong ba thì không lưu được.
- Giao cho một người, một đơn vị hoặc nhiều đơn vị cùng lúc. Giao nhiều đơn vị thì tự tách thành các việc riêng.
- Giao nhanh từ kết luận họp: dán danh sách từ Word hoặc copy các cột từ Excel.
- Có việc con, checklist, việc định kỳ (tuần, tháng, quý).
- Các thao tác: nhận việc, giao lại cho công chức, trả lại kèm lý do, xin gia hạn (người giao duyệt), báo cáo hoàn thành kèm minh chứng, duyệt kết quả hoặc yêu cầu làm lại.
- Trao đổi ngay trong việc, có nhắc tên bằng `@tên_đăng_nhập`.
- Ảnh hiện trường chụp từ ứng dụng tự gắn ngày giờ và tọa độ GPS lên ảnh. Tệp tối đa 20 MB.

**Theo dõi tiến độ** (mục 4)
- Các tab: Việc của tôi, Việc tôi giao, Việc của đơn vị, Sắp đến hạn, Quá hạn.
- Ba cách xem: danh sách có bộ lọc, Kanban kéo thả, lịch.
- Màu cảnh báo xanh, vàng, đỏ, xám. Số ngày tính theo ngày làm việc, trừ thứ Bảy, Chủ nhật và ngày lễ.
- Nhắc việc tự động:
  - khi được giao;
  - trước hạn 3 ngày và 1 ngày;
  - khi đến hạn;
  - quá hạn 3 ngày thì báo người giao và lãnh đạo phụ trách lĩnh vực;
  - quá 24 giờ chưa nhận việc thì nhắc người giao;
  - 7 giờ 30 mỗi ngày làm việc gửi tin tóm tắt.

**Chỉ tiêu** (mục 5)
- Chỉ tiêu thu gọn theo lĩnh vực: bấm vào lĩnh vực để xem danh sách, bấm vào chỉ tiêu để xem chi tiết.
- Nhập chỉ tiêu từ Excel theo mẫu.
- Phân rã xuống đơn vị, thôn, có kiểm tra tổng các phần. Lập kế hoạch theo tháng hoặc quý.
- Cập nhật số liệu kèm minh chứng. Trưởng đơn vị xác nhận trước khi số liệu lên báo cáo.
- Tự tính % hoàn thành và % lẽ ra phải đạt, cảnh báo nguy cơ khi chậm quá 10 điểm %.
- Hỗ trợ loại cộng dồn, tỷ lệ, đạt/không đạt, cả chiều "càng thấp càng tốt".
- Lưu lịch sử mọi lần sửa số liệu.

**Thông báo SMS**
- Gửi SMS khi được giao việc, giao chỉ tiêu, sắp đến hạn, đến hạn, quá hạn. Quản trị chọn sự kiện nào được gửi.
- Nhà cung cấp: eSMS.vn, SpeedSMS.vn, Twilio, hoặc webhook riêng (cổng SMS/Zalo của tỉnh). Cấu hình ở Quản trị → Tin nhắn SMS.
- Không gửi trong giờ nghỉ (mặc định 21:00–06:30). Có nhật ký gửi tin.

**Đăng nhập**
- Ghi nhớ tên đăng nhập.
- Quên mật khẩu: nhận mã qua SMS, hoặc gửi yêu cầu cho quản trị nếu chưa có SMS.
- Nút Đăng xuất ở thanh bên và trong menu điện thoại.

**Tra cứu, tổng hợp theo yêu cầu**
- Gõ hoặc nói câu hỏi tiếng Việt, ví dụ: “việc quá hạn của phòng kinh tế tháng này”, “tổng hợp việc hoàn thành quý 3 theo từng đơn vị”, “chỉ tiêu có nguy cơ không đạt”.
- Hiểu câu có dấu hoặc không dấu, từ đồng nghĩa và cách nói thông dụng (trễ deadline, lố hạn, tồn đọng...), tên đơn vị, lĩnh vực, cán bộ, mốc thời gian.
- Xử lý ngay trên máy chủ của phần mềm, không gửi dữ liệu ra ngoài. Kết quả giới hạn theo phân quyền, xuất được Excel.

**Dashboard và báo cáo** (mục 6)
- Bốn con số đầu trang, danh sách việc quá hạn có nút Nhắc, biểu đồ theo đơn vị, xu hướng tỷ lệ đúng hạn, bảng chỉ tiêu.
- Báo cáo tự lập:
  - báo cáo tuần (Word, PDF);
  - quá hạn theo đơn vị (Excel);
  - kết quả chỉ tiêu (Word, Excel);
  - thực hiện kết luận họp (Word, PDF);
  - số liệu đánh giá cá nhân (Excel).
- Quản trị sửa được tên cơ quan, địa danh, người ký và nơi nhận trên mẫu Word.

**Phân quyền và bảo mật** (mục 2, 7)
- Sáu vai trò, mỗi vai trò có bộ quyền mặc định. Quản trị bật/tắt được từng quyền cho từng tài khoản: công việc, chỉ tiêu, báo cáo, tra cứu, quản trị.
- Phạm vi dữ liệu: toàn xã, theo lĩnh vực, theo đơn vị hoặc chỉ việc của bản thân. Áp dụng cho cả công việc, chỉ tiêu, báo cáo và tra cứu.
- Phó Chủ tịch chỉ thấy công việc và chỉ tiêu thuộc lĩnh vực mình phụ trách.
- Có ủy quyền khi đi công tác.
- Xác thực hai lớp OTP (Google hoặc Microsoft Authenticator), quản trị có thể bắt buộc. Khóa đăng nhập tạm khi sai mật khẩu nhiều lần.
- Nhật ký thao tác được khóa ở mức cơ sở dữ liệu, không ai sửa hoặc xóa được.
- Khi mất mạng vẫn xem được danh sách việc đã mở. Cập nhật tiến độ lúc mất mạng sẽ tự gửi khi có mạng lại.
- API chỉ đọc để liên thông với hệ thống khác: `/api/v1/cong-viec`, `/api/v1/chi-tieu` (gửi kèm header `x-api-key`).

### Phiên bản 3: module tự tạo, quản trị dữ liệu, Nghị quyết 57

- **Module & menu do quản trị tự thiết kế** (Quản trị → Module & menu), giống phần mềm quản lý địa bàn:
  - Tạo nhóm menu, module nhập liệu, liên kết; module con nằm trong module lớn; sắp xếp, ẩn/hiện, đổi tên, biểu tượng, màu; giới hạn vai trò được xem / được nhập.
  - Mỗi module nhập liệu có trường tự định nghĩa (14 kiểu: văn bản, số, ngày, chọn một/nhiều, có/không, điện thoại, email, đơn vị/thôn, cán bộ, lĩnh vực, GPS, đường dẫn…).
  - Trang module: danh sách (bảng trên máy tính, thẻ trên điện thoại), tìm không dấu, lọc, thống kê nhanh, thêm/sửa/xóa, đính kèm ảnh, xuất Excel, nhập từ Excel theo tệp mẫu.
  - Mẫu có sẵn theo NQ57: Tổ công nghệ số cộng đồng, Bình dân học vụ số, Hạ tầng số tại thôn, Sáng kiến đổi mới sáng tạo, Sản phẩm lên sàn TMĐT; Phản ánh kiến nghị (Quản lý địa bàn).
- **Quản trị dữ liệu (quyền `qt.du_lieu`)**: sửa toàn bộ thông tin công việc (kể cả trạng thái, người giao, chủ trì), xóa công việc, chỉ tiêu, số liệu, trao đổi, bản ghi, module.
- **Thùng rác**: mọi nội dung xóa được lưu đủ (kèm việc con, số liệu, tệp) để khôi phục hoặc xóa hẳn.
- **Danh mục từng mục**: thêm, đổi tên, xóa, sắp xếp; đổi tên tự cập nhật công việc, chỉ tiêu, phân công cán bộ, bản ghi đang dùng. Bổ sung 16 lĩnh vực (chuyển đổi số, dữ liệu số / Đề án 06, kinh tế số, xã hội số, đổi mới sáng tạo, tư pháp hộ tịch…).
- **Giao diện mới**: phông Be Vietnam Pro, nền sáng dịu, thanh bên nhóm theo module, thanh trên có tra cứu nhanh, chuông, tài khoản; menu dạng ô trên điện thoại; trang chủ có “Truy cập nhanh”.
- **Dữ liệu mẫu NQ57**: 20 công việc, 10 chỉ tiêu có số liệu theo tháng, bản ghi cho 6 module. Nạp / xóa tại Quản trị → Thùng rác, dữ liệu; hoặc `POST /api/quan-tri/nap-mau` với tiêu đề `x-setup-key: <SETUP_KEY>` (`?op=them` nạp thêm, `?op=xoa` xóa).

## Công nghệ

Next.js 15, PostgreSQL, Vercel Blob (tệp đính kèm), Vercel Cron.

## Cài đặt trên Vercel

1. **Cơ sở dữ liệu**, chọn một trong hai cách:
   - **Neon:** trong dự án Vercel, vào **Storage → Create Database → Neon (Postgres)**, vùng **Singapore**, rồi **Connect**. Biến `DATABASE_URL` sẽ được tự thêm.
   - **Supabase:** vào **Connect → Session pooler**, chép chuỗi kết nối (cổng **5432**, thay `[YOUR-PASSWORD]` bằng mật khẩu cơ sở dữ liệu), đặt vào biến `DATABASE_URL`. Không dùng Transaction pooler (cổng 6543).

   Trên Supabase, bảng được tạo trong schema riêng `qlcv` (biến `DB_SCHEMA`). Schema này không bị lộ qua Data API, và không đụng bảng của ứng dụng khác.
2. **Biến môi trường:**

   | Biến | Ý nghĩa |
   |---|---|
   | `AUTH_SECRET` | Khóa ký phiên đăng nhập, là chuỗi ngẫu nhiên dài |
   | `SETUP_KEY` | Mã dùng một lần để tạo tài khoản quản trị đầu tiên |
   | `CRON_SECRET` | Bảo vệ tác vụ định kỳ |
   | `BLOB_READ_WRITE_TOKEN` | Kho tệp đính kèm (Vercel tự thêm khi tạo Blob store) |
   | `API_KEY` | Không bắt buộc. Bật API liên thông |

3. **Triển khai lại (Redeploy)**, rồi mở trang web. Màn hình **Khởi tạo phần mềm** sẽ hiện ra. Nhập `SETUP_KEY`, tạo tài khoản quản trị, chọn có hoặc không tạo dữ liệu mẫu.

Bảng dữ liệu được tạo tự động ở lần chạy đầu tiên.

## Chạy trên máy

```bash
npm install
cp .env.example .env.local   # điền DATABASE_URL, AUTH_SECRET, SETUP_KEY
npm run dev
```

## Kiểm thử

`tests/e2e.cjs` là kịch bản Playwright, chạy qua toàn bộ luồng:
- khởi tạo;
- giao việc, nhận, giao lại, cập nhật, gia hạn, báo cáo, duyệt;
- phân quyền;
- nhập và xác nhận số liệu chỉ tiêu;
- xuất báo cáo;
- bố cục trên điện thoại.

Hướng dẫn chạy nằm ở đầu tệp.

## Lưu ý trước khi dùng chính thức

- Máy chủ hiện đặt ở nước ngoài (Supabase eu-west-1 Ireland, Vercel Dublin). Đặc tả mục 7 yêu cầu máy chủ tại Việt Nam, nên trước khi dùng chính thức cần xin ý kiến Sở Khoa học và Công nghệ. Mã nguồn chạy được trên mọi máy chủ Node.js và PostgreSQL, kể cả trung tâm dữ liệu của tỉnh.
- Cần thống nhất với Văn phòng cách tính % cho chỉ tiêu "càng thấp càng tốt". Hiện phần mềm tính theo mức giảm so với đầu năm nếu có giá trị đầu năm, nếu không thì lấy kế hoạch ÷ thực hiện.
- Kiểm tra lại danh sách ngày nghỉ lễ hằng năm trong mục Quản trị.
- Gửi nhắc qua Zalo OA hoặc SMS và biểu đồ Gantt thuộc giai đoạn 3, chưa có trong bản này.
