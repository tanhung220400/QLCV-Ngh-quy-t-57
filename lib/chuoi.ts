// Hàm xử lý chuỗi tiếng Việt dùng chung

/** Chữ thường, bỏ dấu thanh và dấu mũ, đ → d (chưa xử lý dấu câu, khoảng trắng) */
export const boDauThuong = (s: string) => s.normalize("NFC").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
