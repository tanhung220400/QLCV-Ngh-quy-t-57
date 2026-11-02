// Điều kiện SQL dùng chung để xếp loại việc đã xong: đúng hạn, xong trước hạn, trễ hạn.
// Trước đây mỗi tệp tự viết lại (và có chỗ lệch nhau: việc hoàn thành thiếu ngày hoàn thành chỗ tính trễ, chỗ không).
// Dùng trong câu lệnh qua sql.unsafe(...); a là bí danh bảng cong_viec (mặc định "cv"). Chỉ là hằng số trong mã, không chứa dữ liệu người dùng.

/** Hoàn thành không muộn hơn hạn (gồm cả xong trước hạn) */
export const dkDungHan = (a = "cv") => `${a}.trang_thai = 'hoan_thanh' AND ${a}.ngay_hoan_thanh <= ${a}.han`;

/** Hoàn thành trước ngày hạn (theo ngày giờ Việt Nam) — là một phần của đúng hạn */
export const dkTruocHan = (a = "cv") =>
  `${a}.trang_thai = 'hoan_thanh' AND (${a}.ngay_hoan_thanh AT TIME ZONE 'Asia/Ho_Chi_Minh')::date < (${a}.han AT TIME ZONE 'Asia/Ho_Chi_Minh')::date`;

/** Hoàn thành sau hạn (thiếu ngày hoàn thành cũng tính là trễ) */
export const dkTreHan = (a = "cv") => `${a}.trang_thai = 'hoan_thanh' AND (${a}.ngay_hoan_thanh IS NULL OR ${a}.ngay_hoan_thanh > ${a}.han)`;
