// Hiểu câu hỏi tiếng Việt (có dấu hoặc không dấu, từ đồng nghĩa, cách nói thông dụng)
// và chuyển thành bộ lọc có cấu trúc. Không gửi dữ liệu ra ngoài.
import { vnDate, addDays } from "./time";

export const boDau = (s: string) =>
  s
    .normalize("NFC")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9/\-.\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export type TrangThaiTC =
  | "qua_han"
  | "sap_han"
  | "dang_lam"
  | "hoan_thanh"
  | "dung_han"
  | "tre_han"
  | "cho_duyet"
  | "moi_giao"
  | "tra_lai"
  | "tam_dung"
  | "huy"
  | "gia_han"
  | "lam_lai";

export type KpiTC = "nguy_co" | "cham" | "dung_tien_do" | "dat" | "chua_co_so_lieu" | "cho_xac_nhan";

export type BoLoc = {
  doi_tuong: "cong_viec" | "chi_tieu";
  trang_thai: TrangThaiTC[];
  kpi: KpiTC[];
  don_vi: number[];
  linh_vuc: string[];
  nguoi: number[];
  nguon: string[];
  uu_tien: string[];
  tu?: string;
  den?: string;
  moc: "han" | "hoan_thanh" | "giao";
  tu_khoa: string[][]; // mỗi nhóm là các từ đồng nghĩa (HOẶC), các nhóm kết hợp VÀ
  nhom_theo?: "don_vi" | "linh_vuc" | "nguoi" | "trang_thai" | "thang";
  hieu: string[]; // diễn giải cho người dùng kiểm tra
};

// ---------- Từ điển (viết không dấu) ----------
const TRANG_THAI_TU: [TrangThaiTC, string[]][] = [
  ["tre_han", ["hoan thanh tre", "hoan thanh cham", "xong tre", "xong cham", "hoan thanh qua han", "lam xong tre", "nop tre", "nop cham"]],
  ["dung_han", ["dung han", "kip thoi", "kip han", "truoc han", "dung tien do", "dung deadline", "kip deadline"]],
  ["dang_lam", ["dang lam", "dang thuc hien", "dang trien khai", "dang xu ly", "dang giai quyet", "chua xong", "chua hoan thanh", "chua lam xong", "con dang", "dang theo doi", "con ton", "con lai", "dang chay"]],
  ["qua_han", ["qua han", "tre han", "tre hen", "lo han", "vuot han", "het han chua", "qua deadline", "tre deadline", "lo deadline", "tre tien do", "cham tien do", "cham tre", "bi cham", "cham", "tre", "ton dong", "no dong", "dong lai", "chay han"]],
  ["sap_han", ["sap den han", "sap het han", "sap toi han", "gan den han", "gan het han", "sap den deadline", "sap deadline", "den han", "toi han", "can gap", "sap phai nop"]],
  ["cho_duyet", ["cho duyet", "cho phe duyet", "cho xem xet", "da bao cao", "cho nghiem thu", "cho xac nhan ket qua"]],
  ["moi_giao", ["chua nhan", "chua tiep nhan", "chua xac nhan nhan", "moi giao", "vua giao", "moi duoc giao"]],
  ["tra_lai", ["tra lai", "bi tra lai", "tu choi nhan", "khong nhan"]],
  ["lam_lai", ["lam lai", "yeu cau lam lai", "phai lam lai", "khong dat yeu cau"]],
  ["gia_han", ["gia han", "xin gia han", "lui han", "doi han", "xin them thoi gian", "keo dai han"]],
  ["tam_dung", ["tam dung", "tam hoan", "tam ngung", "dung lai"]],
  ["huy", ["da huy", "bi huy", "huy bo"]],
  ["hoan_thanh", ["hoan thanh", "da xong", "lam xong", "xong roi", "xong", "hoan tat", "ket thuc", "da giai quyet", "da thuc hien", "da lam"]],
];

const KPI_TU: [KpiTC, string[]][] = [
  ["nguy_co", ["nguy co", "kho dat", "khong dat", "de truot", "kho hoan thanh", "bao dong", "dang bao do", "mau do", "rui ro"]],
  ["cho_xac_nhan", ["cho xac nhan", "chua xac nhan", "chua duyet so lieu"]],
  ["chua_co_so_lieu", ["chua co so lieu", "chua nhap so lieu", "chua cap nhat", "thieu so lieu"]],
  ["dat", ["da dat", "vuot chi tieu", "vuot ke hoach", "hoan thanh chi tieu", "dat chi tieu", "dat ke hoach"]],
  ["cham", ["cham", "cham tien do", "cham nhe", "mau vang", "chua dat"]],
  ["dung_tien_do", ["dung tien do", "dat tien do", "on dinh", "mau xanh"]],
];

const DOI_TUONG_CT = ["chi tieu", "muc tieu", "kpi", "chi so", "tieu chi"];

const NGUON_TU: [string, string[]][] = [
  ["Kết luận họp", ["ket luan hop", "ket luan cuoc hop", "cuoc hop", "phien hop", "hop giao ban", "giao ban", "sau hop", "trong hop"]],
  ["Văn bản của tỉnh", ["van ban tinh", "van ban cua tinh", "cong van tinh", "tinh giao", "chi dao cua tinh", "cap tren giao", "uy ban tinh", "so nganh"]],
  ["Chỉ đạo trực tiếp", ["chi dao truc tiep", "giao truc tiep", "lanh dao giao", "chu tich giao"]],
  ["Kế hoạch năm", ["ke hoach nam"]],
  ["Nghị quyết HĐND xã", ["nghi quyet hdnd", "nghi quyet hoi dong nhan dan", "hdnd"]],
];

const UU_TIEN_TU: [string, string[]][] = [
  ["hoa_toc", ["hoa toc", "cap toc", "rat gap", "khan cap", "gap gap"]],
  ["khan", ["khan", "gap", "uu tien"]],
];

const NHOM_THEO_TU: [NonNullable<BoLoc["nhom_theo"]>, string[]][] = [
  ["don_vi", ["theo don vi", "tung don vi", "cac don vi", "theo phong", "tung phong", "cac phong", "moi phong", "moi don vi", "theo co quan", "theo thon", "tung thon", "cac thon"]],
  ["linh_vuc", ["theo linh vuc", "tung linh vuc", "cac linh vuc", "moi linh vuc", "theo mang", "tung mang"]],
  ["nguoi", ["theo can bo", "tung can bo", "tung nguoi", "theo nguoi", "moi nguoi", "ca nhan", "cac can bo", "nguoi nao", "ai dang", "ai co", "ai bi", "theo cong chuc"]],
  ["thang", ["theo thang", "tung thang", "hang thang", "moi thang", "qua cac thang"]],
  ["trang_thai", ["theo trang thai", "tinh hinh chung", "tong the"]],
];

/** Từ đồng nghĩa theo chủ đề để mở rộng tìm kiếm nội dung */
const DONG_NGHIA: string[][] = [
  ["ho ngheo", "can ngheo", "giam ngheo", "thoat ngheo", "ngheo"],
  ["rac thai", "rac", "chat thai", "ve sinh moi truong", "thu gom rac", "bai rac"],
  ["bao hiem y te", "bhyt", "the bao hiem"],
  ["bao hiem xa hoi", "bhxh"],
  ["thu tuc hanh chinh", "tthc", "ho so hanh chinh", "mot cua", "dich vu cong", "ho so truc tuyen"],
  ["giai phong mat bang", "gpmb", "boi thuong", "thu hoi dat", "den bu", "mat bang"],
  ["dat dai", "dia chinh", "nha dat", "quyen su dung dat", "so do", "so hong", "giay chung nhan", "dat cong", "dat o", "dat nong nghiep"],
  ["xay dung", "cong trinh", "xay nha", "xay khong phep", "trat tu xay dung", "giay phep xay dung"],
  ["giao thong", "duong", "cau", "be tong hoa", "cung hoa", "duong lien thon", "lam duong"],
  ["chuyen doi so", "so hoa", "cong nghe thong tin", "cntt", "nghi quyet 57", "nq57", "57-nq/tw", "chinh quyen so", "khong dung tien mat", "de an 06"],
  ["phong chay", "pccc", "chay no", "chua chay", "an toan chay"],
  ["dich benh", "tiem chung", "phong dich", "suc khoe", "y te", "tram y te"],
  ["truong hoc", "giao duc", "hoc sinh", "giao vien", "pho cap"],
  ["nghia vu quan su", "nhap ngu", "tuyen quan", "giao quan", "quan su", "dan quan"],
  ["ngan sach", "thu ngan sach", "thu chi", "thue", "tai chinh", "kinh phi"],
  ["le hoi", "van hoa", "the thao", "du lich", "van nghe", "thong tin tuyen truyen", "tuyen truyen"],
  ["mua bao", "lu lut", "thien tai", "phong chong thien tai", "sat lo", "ngap"],
  ["nong thon moi", "ntm", "chuan nong thon moi"],
  ["san xuat", "vu dong", "vu he thu", "vu mua", "trong trot", "chan nuoi", "nong nghiep", "cay trong", "lua"],
  ["an ninh", "trat tu", "cong an", "ma tuy", "toi pham", "an ninh trat tu"],
  ["dan so", "lao dong", "viec lam", "dan cu", "ho khau", "cu tru"],
  ["chinh sach", "nguoi co cong", "bao tro xa hoi", "tro cap", "an sinh"],
  ["ky hop", "hoi dong nhan dan", "hdnd", "dai bieu"],
  ["kiem tra", "thanh tra", "giam sat", "ra soat"],
];

// Lĩnh vực: tên danh mục và các cách gọi khác
const LINH_VUC_TU: Record<string, string[]> = {
  "dat dai": ["dat dai", "dia chinh", "nha dat", "linh vuc dat"],
  "xay dung": ["xay dung", "do thi", "quy hoach"],
  "giao thong": ["giao thong"],
  "nong nghiep": ["nong nghiep", "nong lam", "thuy loi", "khuyen nong"],
  "moi truong": ["moi truong", "tai nguyen moi truong", "tnmt"],
  "kinh te": ["kinh te"],
  "tai chinh": ["tai chinh", "ngan sach"],
  "van hoa": ["van hoa", "van hoa xa hoi", "vhxh"],
  "xa hoi": ["xa hoi", "lao dong thuong binh"],
  "giao duc": ["giao duc"],
  "y te": ["y te"],
  "an ninh": ["an ninh"],
  "quoc phong": ["quoc phong", "quan su"],
  "noi vu": ["noi vu", "to chuc can bo", "thi dua khen thuong", "ton giao"],
  "xay dung chinh quyen": ["xay dung chinh quyen", "chinh quyen"],
  "khoa hoc": ["khoa hoc", "khcn"],
  "cong nghe": ["cong nghe"],
  "chuyen doi so": ["chuyen doi so", "nghi quyet 57", "nq57"],
  "cai cach hanh chinh": ["cai cach hanh chinh", "cchc"],
};

const STOP = new Set(
  (
    "viec cong viec nhiem vu task cac nhung mot cua ve cho toi tim xem hien thi liet ke danh sach bao cao tong hop thong ke bao nhieu so luong co la nao gi dang da duoc trong tai voi va hoac the nay kia xa ubnd uy ban can giup minh em anh chi oi nhe a cho biet hay thi o tu den phan nhu la con roi lai bi vao ra len xuong ma khi nao bay gio hien nay hien tai luc truoc sau dau cuoi theo tung moi tat ca toan bo toan xa linh vuc don vi phong ban can bo nguoi ai so lieu ket qua tinh hinh ty le phan tram muon xin giao nhan chua co duoc vui long giup do hoi tra loi thuoc lien quan noi dung chi tiet"
  ).split(" "),
);

function findPhrase(text: string, phrases: string[]): string | null {
  for (const p of [...phrases].sort((a, b) => b.length - a.length)) {
    const re = new RegExp(`(^|\\s)${p.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}(?=\\s|$)`);
    if (re.test(text)) return p;
  }
  return null;
}

/** Tìm và cắt mọi cụm từ của một khái niệm; trả về cụm đầu tiên tìm thấy */
function takeAll(text: string, phrases: string[]): { hit: string | null; rest: string } {
  let hit: string | null = null;
  let rest = text;
  for (;;) {
    const p = findPhrase(rest, phrases);
    if (!p) break;
    hit = hit ?? p;
    rest = cut(rest, p);
  }
  return { hit, rest };
}

function cut(text: string, phrase: string): string {
  const re = new RegExp(`(^|\\s)${phrase.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}(?=\\s|$)`, "g");
  return text.replace(re, " ").replace(/\s+/g, " ").trim();
}

const QUY_LA_MA: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, "1": 1, "2": 2, "3": 3, "4": 4 };

function lastDay(y: number, m: number) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}
const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** Nhận diện khoảng thời gian trong câu */
function parseTime(text: string, now = new Date()): { tu?: string; den?: string; nhan?: string; rest: string } {
  const today = vnDate(now);
  const Y = Number(today.slice(0, 4));
  const M = Number(today.slice(5, 7));
  const wd = (new Date(today + "T00:00:00Z").getUTCDay() + 6) % 7;
  const monday = addDays(today, -wd);
  let t = text;
  const take = (re: RegExp) => {
    const m = t.match(re);
    if (m) t = t.replace(m[0], " ").replace(/\s+/g, " ").trim();
    return m;
  };
  let m: RegExpMatchArray | null;
  // từ dd/mm(/yyyy) đến dd/mm(/yyyy)
  if ((m = take(/tu (?:ngay )?(\d{1,2})[/-](\d{1,2})(?:[/-](\d{4}))? (?:den|toi|-) (?:ngay )?(\d{1,2})[/-](\d{1,2})(?:[/-](\d{4}))?/))) {
    const y1 = Number(m[3] || Y);
    const y2 = Number(m[6] || m[3] || Y);
    return { tu: iso(y1, +m[2], +m[1]), den: iso(y2, +m[5], +m[4]), nhan: `từ ${m[1]}/${m[2]} đến ${m[4]}/${m[5]}`, rest: t };
  }
  if ((m = take(/(?:ngay )?(\d{1,2})[/-](\d{1,2})[/-](\d{4})/))) return { tu: iso(+m[3], +m[2], +m[1]), den: iso(+m[3], +m[2], +m[1]), nhan: `ngày ${m[1]}/${m[2]}/${m[3]}`, rest: t };
  if (take(/hom nay/)) return { tu: today, den: today, nhan: "hôm nay", rest: t };
  if (take(/hom qua/)) return { tu: addDays(today, -1), den: addDays(today, -1), nhan: "hôm qua", rest: t };
  if (take(/ngay mai/)) return { tu: addDays(today, 1), den: addDays(today, 1), nhan: "ngày mai", rest: t };
  if (take(/tuan (?:nay|hien tai)/)) return { tu: monday, den: addDays(monday, 6), nhan: "tuần này", rest: t };
  if (take(/tuan (?:truoc|qua|roi)/)) return { tu: addDays(monday, -7), den: addDays(monday, -1), nhan: "tuần trước", rest: t };
  if (take(/tuan (?:sau|toi)/)) return { tu: addDays(monday, 7), den: addDays(monday, 13), nhan: "tuần sau", rest: t };
  if (take(/thang (?:nay|hien tai)/)) return { tu: iso(Y, M, 1), den: iso(Y, M, lastDay(Y, M)), nhan: `tháng ${M}/${Y}`, rest: t };
  if (take(/thang (?:truoc|qua|roi)/)) {
    const y = M === 1 ? Y - 1 : Y;
    const mm = M === 1 ? 12 : M - 1;
    return { tu: iso(y, mm, 1), den: iso(y, mm, lastDay(y, mm)), nhan: `tháng ${mm}/${y}`, rest: t };
  }
  if (take(/thang (?:sau|toi)/)) {
    const y = M === 12 ? Y + 1 : Y;
    const mm = M === 12 ? 1 : M + 1;
    return { tu: iso(y, mm, 1), den: iso(y, mm, lastDay(y, mm)), nhan: `tháng ${mm}/${y}`, rest: t };
  }
  if ((m = take(/thang (\d{1,2})(?:[/ ](?:nam )?(\d{4}))?/)) && +m[1] >= 1 && +m[1] <= 12) {
    const y = Number(m[2] || Y);
    return { tu: iso(y, +m[1], 1), den: iso(y, +m[1], lastDay(y, +m[1])), nhan: `tháng ${+m[1]}/${y}`, rest: t };
  }
  if ((m = take(/quy (nay|truoc|i{1,3}|iv|[1-4])(?:[/ ](?:nam )?(\d{4}))?/))) {
    const cur = Math.floor((M - 1) / 3) + 1;
    let q = m[1] === "nay" ? cur : m[1] === "truoc" ? cur - 1 : QUY_LA_MA[m[1]];
    let y = Number(m[2] || Y);
    if (q === 0) {
      q = 4;
      y--;
    }
    return { tu: iso(y, q * 3 - 2, 1), den: iso(y, q * 3, lastDay(y, q * 3)), nhan: `quý ${q}/${y}`, rest: t };
  }
  if (take(/6 thang (?:dau nam|dau)/)) return { tu: iso(Y, 1, 1), den: iso(Y, 6, 30), nhan: `6 tháng đầu năm ${Y}`, rest: t };
  if (take(/6 thang (?:cuoi nam|cuoi)/)) return { tu: iso(Y, 7, 1), den: iso(Y, 12, 31), nhan: `6 tháng cuối năm ${Y}`, rest: t };
  if (take(/(?:tu )?dau nam (?:den nay|toi nay|den gio)/)) return { tu: iso(Y, 1, 1), den: today, nhan: `từ đầu năm ${Y} đến nay`, rest: t };
  if (take(/nam (?:nay|hien tai)/)) return { tu: iso(Y, 1, 1), den: iso(Y, 12, 31), nhan: `năm ${Y}`, rest: t };
  if (take(/nam (?:ngoai|truoc|qua)/)) return { tu: iso(Y - 1, 1, 1), den: iso(Y - 1, 12, 31), nhan: `năm ${Y - 1}`, rest: t };
  if ((m = take(/nam (\d{4})/))) return { tu: iso(+m[1], 1, 1), den: iso(+m[1], 12, 31), nhan: `năm ${m[1]}`, rest: t };
  if ((m = take(/(\d+) ngay (?:qua|gan day|vua qua)/))) return { tu: addDays(today, -Number(m[1])), den: today, nhan: `${m[1]} ngày qua`, rest: t };
  if ((m = take(/(\d+) ngay (?:toi|sap toi)/))) return { tu: today, den: addDays(today, Number(m[1])), nhan: `${m[1]} ngày tới`, rest: t };
  return { rest: t };
}

export type DanhMucTC = {
  don_vi: { id: number; ten: string }[];
  nguoi: { id: number; ho_ten: string }[];
  linh_vuc: string[];
};

const TEN_TRANG_THAI: Record<TrangThaiTC, string> = {
  qua_han: "Quá hạn",
  sap_han: "Sắp đến hạn",
  dang_lam: "Đang làm (chưa xong)",
  hoan_thanh: "Đã hoàn thành",
  dung_han: "Hoàn thành đúng hạn",
  tre_han: "Hoàn thành trễ hạn",
  cho_duyet: "Chờ duyệt",
  moi_giao: "Chưa nhận việc",
  tra_lai: "Bị trả lại",
  tam_dung: "Tạm dừng",
  huy: "Đã hủy",
  gia_han: "Có xin gia hạn",
  lam_lai: "Bị yêu cầu làm lại",
};
const TEN_KPI: Record<KpiTC, string> = {
  nguy_co: "Có nguy cơ không đạt",
  cham: "Chậm tiến độ",
  dung_tien_do: "Đúng tiến độ",
  dat: "Đã đạt",
  chua_co_so_lieu: "Chưa có số liệu",
  cho_xac_nhan: "Số liệu chờ xác nhận",
};
const TEN_NHOM: Record<NonNullable<BoLoc["nhom_theo"]>, string> = {
  don_vi: "từng đơn vị",
  linh_vuc: "từng lĩnh vực",
  nguoi: "từng cán bộ",
  thang: "từng tháng",
  trang_thai: "trạng thái",
};

/** Phân tích câu hỏi thành bộ lọc */
// Cụm từ dễ nhầm khi bỏ dấu (tổng hợp ≠ họp, chăm sóc ≠ chậm, trẻ em ≠ trễ...) hoặc chỉ là lời yêu cầu
const BO_TRUOC: [RegExp, string][] = [
  [/\b(tong hop|thong ke|bao cao|liet ke|danh sach|cho biet|cho toi|cho em|hien thi|bao nhieu|so luong|ty le|phan tram|tinh hinh|ket qua|so lieu|giup toi|giup em|lam on|xin hay|hay cho)\b/g, " "],
  [/\bcham soc\b/g, "chamsoc"],
  [/\btre em\b/g, "treem"],
  [/\btre hoa\b/g, "trehoa"],
  [/\bdat chuan\b/g, "da dat"],
  [/\bdat yeu cau\b/g, " "],
];

export function hieuCauHoi(q: string, dm: DanhMucTC, now = new Date()): BoLoc {
  let t = ` ${boDau(q)} `.trim();
  for (const [re, rep] of BO_TRUOC) t = t.replace(re, rep as string).replace(/\s+/g, " ").trim();
  t = t.replace(/\b(phu|hop) (hop|dong|tac|le|phap)\b/g, "$1$2");
  const f: BoLoc = { doi_tuong: "cong_viec", trang_thai: [], kpi: [], don_vi: [], linh_vuc: [], nguoi: [], nguon: [], uu_tien: [], moc: "han", tu_khoa: [], hieu: [] };

  // Đối tượng
  const ct = findPhrase(t, DOI_TUONG_CT);
  if (ct) {
    f.doi_tuong = "chi_tieu";
    t = cut(t, ct);
  }

  // Thời gian
  const tm = parseTime(t, now);
  t = tm.rest;

  // Nhóm theo
  for (const [k, ps] of NHOM_THEO_TU) {
    const p = findPhrase(t, ps);
    if (p) {
      f.nhom_theo = k;
      t = cut(t, p);
      break;
    }
  }

  // Đơn vị: khớp tên đầy đủ hoặc tên rút gọn (trước dấu "-" hoặc "và")
  const units = dm.don_vi
    .flatMap((u) => {
      const full = boDau(u.ten);
      const short = boDau(u.ten.split(/\s[-–]\s|\svà\s|,/)[0]);
      const extra: string[] = [];
      if (/van phong/.test(full)) extra.push("van phong");
      if (/phuc vu hanh chinh cong|hanh chinh cong/.test(full)) extra.push("trung tam hanh chinh cong", "hanh chinh cong", "bo phan mot cua", "tt hcc", "hcc");
      return [...new Set([full, short, ...extra])].filter((a) => a.split(" ").length >= 2 || a.length >= 6).map((a) => ({ a, u }));
    })
    .sort((x, y) => y.a.length - x.a.length);
  for (const { a, u } of units) {
    if (findPhrase(t, [a])) {
      if (!f.don_vi.includes(u.id)) f.don_vi.push(u.id);
      t = cut(t, a);
    }
  }

  // Cán bộ: gọi tên kèm xưng hô ("anh Nam", "đồng chí Lan")
  for (const p of dm.nguoi) {
    const last = boDau(p.ho_ten).split(" ").pop() || "";
    const m = t.match(new RegExp(`\\b(anh|chi|ong|ba|dong chi|dc|co|chu|bac|em|ban) ${last}\\b`));
    if (last.length >= 2 && m) {
      f.nguoi.push(p.id);
    }
  }
  for (const p of dm.nguoi) {
    const last = boDau(p.ho_ten).split(" ").pop() || "";
    t = t.replace(new RegExp(`\\b(anh|chi|ong|ba|dong chi|dc|co|chu|bac|em|ban) ${last}\\b`, "g"), " ").replace(/\s+/g, " ").trim();
  }
  // Cán bộ: họ tên đầy đủ hoặc 2 chữ cuối
  for (const p of dm.nguoi) {
    if (f.nguoi.includes(p.id)) continue;
    const full = boDau(p.ho_ten);
    const parts = full.split(" ");
    const cands = [full, parts.slice(-2).join(" ")].filter((x) => x.split(" ").length >= 2);
    const hit = findPhrase(t, cands);
    if (hit) {
      f.nguoi.push(p.id);
      t = cut(t, hit);
    }
  }

  // Trạng thái công việc / chỉ tiêu
  if (f.doi_tuong === "chi_tieu") {
    for (const [k, ps] of KPI_TU) {
      const r = takeAll(t, ps);
      if (r.hit) {
        f.kpi.push(k);
        t = r.rest;
      }
    }
  }
  for (const [k, ps] of TRANG_THAI_TU) {
    const r = takeAll(t, ps);
    if (r.hit) {
      f.trang_thai.push(k);
      t = r.rest;
    }
  }
  if (f.doi_tuong === "chi_tieu" && f.trang_thai.length) {
    // "chỉ tiêu chậm / chưa đạt" -> trạng thái chỉ tiêu
    f.trang_thai = [];
  }
  if (f.trang_thai.includes("dung_han") || f.trang_thai.includes("tre_han")) f.trang_thai = f.trang_thai.filter((x) => x !== "hoan_thanh" && x !== "qua_han");

  // Ưu tiên, nguồn giao
  for (const [k, ps] of UU_TIEN_TU) {
    const p = findPhrase(t, ps);
    if (p) {
      f.uu_tien.push(k);
      t = cut(t, p);
      break;
    }
  }
  for (const [k, ps] of NGUON_TU) {
    const p = findPhrase(t, ps);
    if (p) {
      f.nguon.push(k);
      t = cut(t, p);
    }
  }

  // Lĩnh vực theo danh mục
  for (const lv of dm.linh_vuc) {
    const parts = lv.split(/,|\s[-–]\s/).map((x) => boDau(x)).filter(Boolean);
    const aliases = [boDau(lv), ...parts.flatMap((p) => LINH_VUC_TU[p] || [p])];
    const hit = findPhrase(t, aliases);
    if (hit && (hit.split(" ").length >= 2 || hit.length >= 5)) {
      if (!f.linh_vuc.includes(lv)) f.linh_vuc.push(lv);
      t = cut(t, hit);
    }
  }

  // Mốc thời gian
  if (/\b(giao|duoc giao|nhan)\b/.test(boDau(q)) && !/\bhan\b/.test(boDau(q))) f.moc = "giao";
  if (f.trang_thai.some((s) => ["hoan_thanh", "dung_han", "tre_han"].includes(s))) f.moc = "hoan_thanh";
  if (tm.tu) {
    f.tu = tm.tu;
    f.den = tm.den;
  }

  // Từ khóa nội dung còn lại, mở rộng bằng từ đồng nghĩa
  for (const g of DONG_NGHIA) {
    const hit = findPhrase(t, g);
    if (hit) {
      f.tu_khoa.push(g);
      t = cut(t, hit);
    }
  }
  const rest = t
    .split(" ")
    .filter((w) => w.length >= 2 && !STOP.has(w) && !/^\d+$/.test(w));
  const KHOI_PHUC: Record<string, string> = { chamsoc: "cham soc", treem: "tre em", trehoa: "tre hoa", phuhop: "phu hop", hopdong: "hop dong", hoptac: "hop tac", hople: "hop le", hopphap: "hop phap" };
  for (const w of rest) f.tu_khoa.push([KHOI_PHUC[w] || w]);

  // Diễn giải
  f.hieu.push(f.doi_tuong === "chi_tieu" ? "Chỉ tiêu" : "Công việc");
  for (const s of f.trang_thai) f.hieu.push(TEN_TRANG_THAI[s]);
  for (const s of f.kpi) f.hieu.push(TEN_KPI[s]);
  for (const id of f.don_vi) f.hieu.push(dm.don_vi.find((u) => u.id === id)?.ten || "");
  for (const id of f.nguoi) f.hieu.push(`Cán bộ: ${dm.nguoi.find((u) => u.id === id)?.ho_ten}`);
  for (const l of f.linh_vuc) f.hieu.push(`Lĩnh vực: ${l}`);
  for (const n of f.nguon) f.hieu.push(`Nguồn: ${n}`);
  for (const u of f.uu_tien) f.hieu.push(u === "hoa_toc" ? "Hỏa tốc" : "Khẩn");
  if (tm.nhan) f.hieu.push(`${f.moc === "hoan_thanh" ? "Hoàn thành" : f.moc === "giao" ? "Giao" : "Hạn"} ${tm.nhan}`);
  for (const g of f.tu_khoa) f.hieu.push(`Nội dung có “${g[0]}”${g.length > 1 ? ` (hoặc ${g.slice(1, 4).join(", ")}…)` : ""}`);
  if (f.nhom_theo) f.hieu.push(`Tổng hợp theo ${TEN_NHOM[f.nhom_theo]}`);
  return f;
}

export const GOI_Y = [
  "Việc quá hạn của phòng kinh tế tháng này",
  "Tổng hợp việc hoàn thành đúng hạn quý 3 theo từng đơn vị",
  "Những việc sắp đến hạn tuần này",
  "Chỉ tiêu có nguy cơ không đạt",
  "Việc về hộ nghèo đang làm",
  "Ai đang bị trễ deadline",
  "Viec chua nhan tu ket luan hop",
  "Chỉ tiêu lĩnh vực giáo dục, y tế",
];
