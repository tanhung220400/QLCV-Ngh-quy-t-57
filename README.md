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
- Nhập chỉ tiêu từ Excel theo mẫu.
- Phân rã xuống đơn vị, thôn, có kiểm tra tổng các phần. Lập kế hoạch theo tháng hoặc quý.
- Cập nhật số liệu kèm minh chứng. Trưởng đơn vị xác nhận trước khi số liệu lên báo cáo.
- Tự tính % hoàn thành và % lẽ ra phải đạt, cảnh báo nguy cơ khi chậm quá 10 điểm %.
- Hỗ trợ loại cộng dồn, tỷ lệ, đạt/không đạt, cả chiều "càng thấp càng tốt".
- Lưu lịch sử mọi lần sửa số liệu.

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
- Sáu vai trò. Phân quyền theo chức vụ và đơn vị. Phó Chủ tịch chỉ thấy lĩnh vực mình phụ trách.
- Có ủy quyền khi đi công tác.
- Xác thực hai lớp OTP (Google hoặc Microsoft Authenticator), quản trị có thể bắt buộc. Khóa đăng nhập tạm khi sai mật khẩu nhiều lần.
- Nhật ký thao tác được khóa ở mức cơ sở dữ liệu, không ai sửa hoặc xóa được.
- Khi mất mạng vẫn xem được danh sách việc đã mở. Cập nhật tiến độ lúc mất mạng sẽ tự gửi khi có mạng lại.
- API chỉ đọc để liên thông với hệ thống khác: `/api/v1/cong-viec`, `/api/v1/chi-tieu` (gửi kèm header `x-api-key`).

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
