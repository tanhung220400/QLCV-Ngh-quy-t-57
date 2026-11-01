// Bộ máy tìm kiếm theo nội dung: chuẩn hóa tiếng Việt (có dấu / không dấu), mở rộng từ đồng nghĩa,
// từ viết tắt và khái niệm liên quan (hàm ý), chấp nhận gõ sai 1 ký tự, xếp hạng theo mức độ phù hợp.
// Chạy hoàn toàn trên máy chủ của phần mềm, không gửi dữ liệu ra ngoài.

/** Bỏ dấu một ký tự (giữ nguyên độ dài để ánh xạ vị trí về chuỗi gốc) */
function boDauKyTu(c: string): string {
  const l = c.toLowerCase();
  if (l === "đ") return "d";
  const b = l.normalize("NFD").replace(/[̀-ͯ]/g, "");
  return /^[a-z0-9]$/.test(b) ? b : " ";
}

/** Chuỗi chuẩn hóa (không dấu, chữ thường, ký tự lạ thành khoảng trắng) cùng độ dài với chuỗi NFC gốc */
export function chuanHoa(s: string): { goc: string; n: string } {
  const goc = (s || "").normalize("NFC");
  let n = "";
  for (const c of goc) n += c.length === 1 ? boDauKyTu(c) : " ";
  // ký tự ngoài BMP có độ dài 2: giữ độ dài
  if (n.length !== goc.length) {
    n = "";
    for (let i = 0; i < goc.length; i++) n += boDauKyTu(goc[i]);
  }
  return { goc, n };
}

export const khongDau = (s: string) => chuanHoa(s).n.replace(/\s+/g, " ").trim();

/** Chữ thường có dấu, gọn khoảng trắng (để so dấu) */
const coDau = (s: string) => s.normalize("NFC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

// ---------------------------------------------------------------------------
// Từ điển khái niệm: mỗi khái niệm có các cách gọi tương đương (đồng nghĩa, viết tắt)
// và các nội dung liên quan (hàm ý gần, điểm thấp hơn). Viết không dấu.
// ---------------------------------------------------------------------------
type KhaiNiem = { ten: string; dn: string[]; lq?: string[] };

export const KHAI_NIEM: KhaiNiem[] = [
  // --- Nghị quyết 57, chuyển đổi số, khoa học công nghệ ---
  { ten: "chuyển đổi số", dn: ["chuyen doi so", "cds", "so hoa", "chinh quyen so", "kinh te so", "xa hoi so", "cong dan so", "chinh quyen dien tu"], lq: ["cong nghe thong tin", "cntt", "nghi quyet 57", "nq57", "57 nq tw", "du lieu so", "ung dung so", "nen tang so", "phan mem", "dich vu cong truc tuyen", "vneid", "khong dung tien mat", "ky nang so", "binh dan hoc vu so", "to cong nghe so", "ha tang so", "chu ky so", "thuong mai dien tu"] },
  { ten: "Nghị quyết 57", dn: ["nghi quyet 57", "nq57", "nq 57", "57 nq tw", "57-nq/tw"], lq: ["chuyen doi so", "khoa hoc cong nghe", "doi moi sang tao", "khcn", "dmst"] },
  { ten: "khoa học công nghệ", dn: ["khoa hoc cong nghe", "khcn", "khoa hoc va cong nghe", "ung dung khoa hoc"], lq: ["doi moi sang tao", "sang kien", "nghien cuu", "cong nghe moi", "tri tue nhan tao"] },
  { ten: "đổi mới sáng tạo", dn: ["doi moi sang tao", "dmst", "sang tao", "khoi nghiep", "startup"], lq: ["sang kien", "giai phap moi", "cai tien", "y tuong"] },
  { ten: "sáng kiến", dn: ["sang kien", "giai phap", "cai tien", "sang kien kinh nghiem", "de tai"], lq: ["doi moi sang tao", "cong nhan sang kien", "y tuong"] },
  { ten: "định danh điện tử", dn: ["vneid", "dinh danh dien tu", "dinh danh muc 2", "tai khoan dinh danh", "muc 2", "can cuoc dien tu"], lq: ["de an 06", "can cuoc", "cccd", "cong an", "tich hop giay to"] },
  { ten: "Đề án 06", dn: ["de an 06", "da 06", "de an 6"], lq: ["vneid", "dinh danh dien tu", "du lieu dan cu", "can cuoc"] },
  { ten: "căn cước", dn: ["can cuoc", "cccd", "can cuoc cong dan", "chung minh nhan dan", "cmnd"], lq: ["vneid", "dinh danh", "cu tru"] },
  { ten: "dịch vụ công trực tuyến", dn: ["dich vu cong truc tuyen", "dvc truc tuyen", "dvctt", "dich vu cong", "cong dich vu cong", "nop truc tuyen", "ho so truc tuyen", "toan trinh", "mot phan"], lq: ["thu tuc hanh chinh", "tthc", "mot cua", "ho so dien tu", "so hoa ho so"] },
  { ten: "thủ tục hành chính", dn: ["thu tuc hanh chinh", "tthc", "ho so hanh chinh", "giai quyet ho so", "tiep nhan ho so", "tra ket qua"], lq: ["mot cua", "bo phan mot cua", "hanh chinh cong", "dich vu cong", "cai cach hanh chinh", "dung han", "tre han"] },
  { ten: "một cửa", dn: ["mot cua", "bo phan mot cua", "mot cua lien thong", "trung tam hanh chinh cong", "hanh chinh cong", "tt hcc", "phuc vu hanh chinh cong"], lq: ["thu tuc hanh chinh", "tiep nhan ho so"] },
  { ten: "cải cách hành chính", dn: ["cai cach hanh chinh", "cchc", "chi so cai cach hanh chinh", "par index"], lq: ["thu tuc hanh chinh", "sipas", "hai long", "ky luat ky cuong"] },
  { ten: "số hóa", dn: ["so hoa", "so hoa ho so", "so hoa du lieu", "dien tu hoa", "scan"], lq: ["ho so dien tu", "luu tru dien tu", "kho du lieu", "csdl"] },
  { ten: "dữ liệu", dn: ["du lieu", "co so du lieu", "csdl", "data", "du lieu so", "kho du lieu"], lq: ["lam sach du lieu", "dong bo", "cap nhat du lieu", "thong tin"] },
  { ten: "thanh toán không dùng tiền mặt", dn: ["khong dung tien mat", "thanh toan dien tu", "thanh toan truc tuyen", "chuyen khoan", "vi dien tu", "qr code", "ma qr", "the ngan hang", "mobile money"], lq: ["ngan hang", "tai khoan ngan hang", "chi tra an sinh", "luong huu"] },
  { ten: "kỹ năng số", dn: ["ky nang so", "binh dan hoc vu so", "pho cap ky nang so", "pho cap so", "huong dan su dung", "tap huan ky nang so", "lop hoc so"], lq: ["to cong nghe so", "tap huan", "dao tao", "nguoi dan su dung", "dien thoai thong minh"] },
  { ten: "tổ công nghệ số cộng đồng", dn: ["to cong nghe so", "to cong nghe so cong dong", "to cnscd", "cnscd"], lq: ["ky nang so", "binh dan hoc vu so", "doan thanh nien", "tinh nguyen"] },
  { ten: "hạ tầng số", dn: ["ha tang so", "cap quang", "internet", "wifi", "wi fi", "song di dong", "song dien thoai", "4g", "5g", "tram bts", "bts", "mang vien thong", "duong truyen"], lq: ["nha mang", "viettel", "vnpt", "mobifone", "phu song", "song yeu", "mat song", "camera"] },
  { ten: "camera", dn: ["camera", "camera an ninh", "camera giam sat", "he thong camera"], lq: ["an ninh trat tu", "giam sat", "ha tang so"] },
  { ten: "an toàn thông tin", dn: ["an toan thong tin", "attt", "an ninh mang", "bao mat", "virus", "ma doc", "lua dao qua mang", "lua dao truc tuyen", "hack"], lq: ["mat khau", "may tinh", "mang noi bo", "du lieu ca nhan"] },
  { ten: "chữ ký số", dn: ["chu ky so", "ky so", "ca", "usb token", "sim ky so", "van ban dien tu", "ky dien tu"], lq: ["van ban di", "van ban den", "quan ly van ban", "ioffice"] },
  { ten: "phần mềm, ứng dụng", dn: ["phan mem", "ung dung", "app", "website", "trang thong tin dien tu", "cong thong tin", "he thong thong tin", "nen tang"], lq: ["zalo", "facebook", "fanpage", "mang xa hoi", "tri tue nhan tao", "ai"] },
  { ten: "trí tuệ nhân tạo", dn: ["tri tue nhan tao", "ai", "chatbot", "tro ly ao"], lq: ["phan mem", "chuyen doi so", "khoa hoc cong nghe"] },
  { ten: "mạng xã hội", dn: ["zalo", "facebook", "fanpage", "mang xa hoi", "nhom zalo", "tiktok", "youtube"], lq: ["tuyen truyen", "thong tin", "phan anh"] },
  { ten: "thương mại điện tử", dn: ["thuong mai dien tu", "tmdt", "san thuong mai dien tu", "ban hang online", "ban hang truc tuyen", "len san", "shopee", "lazada", "tiktok shop", "postmart", "voso"], lq: ["ocop", "nong san", "san pham dia phuong", "tieu thu"] },
  { ten: "OCOP", dn: ["ocop", "san pham ocop", "moi xa mot san pham", "moi xa phuong mot san pham"], lq: ["nong san", "dac san", "san pham dia phuong", "thuong mai dien tu"] },
  // --- Hành chính, văn bản, họp ---
  { ten: "văn bản", dn: ["van ban", "cong van", "quyet dinh", "to trinh", "thong bao", "ke hoach", "huong dan", "chi thi", "cv", "qd", "kh", "tb"], lq: ["so hieu", "ban hanh", "trinh ky", "du thao"] },
  { ten: "báo cáo", dn: ["bao cao", "bc", "bao cao dinh ky", "bao cao so ket", "bao cao tong ket", "bao cao chuyen de", "so ket", "tong ket"], lq: ["so lieu", "thong ke", "tong hop", "danh gia"] },
  { ten: "kế hoạch", dn: ["ke hoach", "kh", "chuong trinh", "phuong an", "lo trinh", "de an"], lq: ["trien khai", "to chuc thuc hien", "chi tieu"] },
  { ten: "họp", dn: ["hop", "cuoc hop", "phien hop", "giao ban", "hoi nghi", "ket luan hop", "thong bao ket luan", "ky hop"], lq: ["bien ban", "ket luan", "chu tri", "du hop"] },
  { ten: "dự thảo", dn: ["du thao", "soan thao", "xay dung van ban", "lay y kien", "gop y"], lq: ["van ban", "to trinh", "trinh ky"] },
  { ten: "kiểm tra, rà soát", dn: ["kiem tra", "ra soat", "thanh tra", "giam sat", "khao sat", "danh gia", "doi chieu", "kiem dem", "thong ke", "dieu tra"], lq: ["phat hien", "xu ly vi pham", "bien ban", "chan chinh"] },
  { ten: "tuyên truyền", dn: ["tuyen truyen", "pho bien", "truyen thong", "van dong", "thong tin tuyen truyen", "loa phat thanh", "dai truyen thanh", "pano", "bang ron", "to roi", "khau hieu"], lq: ["nang cao nhan thuc", "pho bien phap luat", "mang xa hoi"] },
  { ten: "tập huấn", dn: ["tap huan", "dao tao", "boi duong", "hoc tap", "lop hoc", "huong dan nghiep vu", "trien khai hoc tap"], lq: ["giang vien", "hoc vien", "ky nang", "nang cao nang luc"] },
  { ten: "thi đua khen thưởng", dn: ["thi dua", "khen thuong", "giay khen", "bang khen", "danh hieu", "ton vinh", "bieu duong", "guong dien hinh"], lq: ["phong trao", "tong ket", "binh xet"] },
  { ten: "tổ chức cán bộ", dn: ["to chuc can bo", "nhan su", "can bo cong chuc", "bo nhiem", "dieu dong", "luan chuyen", "tuyen dung", "bien che", "vi tri viec lam", "danh gia can bo", "ky luat"], lq: ["noi vu", "cong chuc", "vien chuc", "hop dong lao dong"] },
  { ten: "cán bộ, công chức", dn: ["can bo", "cong chuc", "vien chuc", "nhan vien", "chuyen vien", "nguoi lao dong", "doi ngu"], lq: ["to chuc can bo", "nhan su"] },
  // --- Người dân, phản ánh ---
  { ten: "người dân", dn: ["nguoi dan", "nhan dan", "cong dan", "ba con", "ho dan", "dan cu", "cu dan", "ho gia dinh"], lq: ["khu pho", "to dan pho", "cong dong", "dan"] },
  { ten: "phản ánh, kiến nghị", dn: ["phan anh", "kien nghi", "khieu nai", "to cao", "don thu", "khieu kien", "y kien nguoi dan", "de nghi cua dan", "kien nghi cu tri", "tiep cong dan", "tiep dan", "buc xuc", "than phien"], lq: ["giai quyet", "tra loi", "hoa giai", "xu ly don", "duong day nong", "1022"] },
  { ten: "hòa giải", dn: ["hoa giai", "hoa giai co so", "tranh chap", "mau thuan"], lq: ["phan anh", "khieu nai", "dat dai"] },
  { ten: "khu phố", dn: ["khu pho", "to dan pho", "thon", "ap", "xom", "khu dan cu", "dia ban dan cu"], lq: ["truong khu pho", "dia ban", "cong dong"] },
  // --- Hạ tầng, xây dựng, giao thông, đô thị ---
  { ten: "đường giao thông", dn: ["duong", "duong giao thong", "giao thong", "duong lien khu pho", "duong lien xa", "duong ngo", "hem", "ngo", "kiet", "via he", "mat duong", "duong be tong", "duong nhua"], lq: ["be tong hoa", "cung hoa", "nang cap duong", "sua duong", "o ga", "lun sut", "an toan giao thong"] },
  { ten: "an toàn giao thông", dn: ["an toan giao thong", "atgt", "tai nan giao thong", "vi pham giao thong", "lan chiem", "lan chiem via he", "hanh lang an toan"], lq: ["trat tu do thi", "cong an", "duong"] },
  { ten: "cầu, cống, kênh mương", dn: ["cau", "cong", "kenh", "muong", "kenh muong", "thoat nuoc", "cong thoat nuoc", "ranh thoat nuoc", "nao vet"], lq: ["ngap", "ngap ung", "thuy loi", "tieu thoat"] },
  { ten: "đèn chiếu sáng", dn: ["den chieu sang", "den duong", "chieu sang cong cong", "bong den", "den", "he thong chieu sang"], lq: ["dien", "duong", "hong", "toi", "an ninh"] },
  { ten: "điện", dn: ["dien", "luoi dien", "mat dien", "cup dien", "dien luc", "tram bien ap", "cot dien", "day dien"], lq: ["chieu sang", "an toan dien"] },
  { ten: "nước sạch", dn: ["nuoc sach", "cap nuoc", "nuoc sinh hoat", "nha may nuoc", "gieng", "ong nuoc"], lq: ["ve sinh moi truong", "thieu nuoc", "o nhiem nuoc"] },
  { ten: "xây dựng", dn: ["xay dung", "cong trinh", "xay nha", "giay phep xay dung", "trat tu xay dung", "xay khong phep", "xay sai phep", "trai phep", "khong phep", "sai phep", "xay dung trai phep", "vi pham trat tu xay dung", "co phep", "thi cong", "du an"], lq: ["quy hoach", "dat dai", "do thi", "nghiem thu", "giai ngan"] },
  { ten: "đô thị, quy hoạch", dn: ["do thi", "quy hoach", "chinh trang do thi", "my quan do thi", "trat tu do thi", "van minh do thi", "cay xanh", "cong vien"], lq: ["xay dung", "via he", "lan chiem"] },
  { ten: "đầu tư công", dn: ["dau tu cong", "du an", "giai ngan", "von dau tu", "xay dung co ban", "xdcb", "chu dau tu", "ban quan ly du an", "nghiem thu", "quyet toan"], lq: ["cong trinh", "ngan sach", "thi cong"] },
  { ten: "giải phóng mặt bằng", dn: ["giai phong mat bang", "gpmb", "boi thuong", "thu hoi dat", "den bu", "mat bang", "tai dinh cu", "ho tro tai dinh cu"], lq: ["dat dai", "du an", "kiem dem"] },
  // --- Đất đai, môi trường, nông nghiệp ---
  { ten: "đất đai", dn: ["dat dai", "dia chinh", "nha dat", "quyen su dung dat", "so do", "so hong", "giay chung nhan", "gcn", "dat cong", "dat o", "dat nong nghiep", "dat lua", "chuyen muc dich", "cap giay chung nhan", "dang ky dat dai", "do dac", "ban do dia chinh"], lq: ["lan chiem dat", "tranh chap dat", "quy hoach", "giai phong mat bang", "thue dat"] },
  { ten: "môi trường", dn: ["moi truong", "ve sinh moi truong", "o nhiem", "o nhiem moi truong", "rac thai", "rac", "chat thai", "thu gom rac", "bai rac", "xu ly rac", "phan loai rac", "nuoc thai", "khoi bui", "mui hoi"], lq: ["cay xanh", "khu pho sach", "tong ve sinh", "xanh sach dep"] },
  { ten: "tài nguyên, khoáng sản", dn: ["tai nguyen", "khoang san", "khai thac cat", "khai thac trai phep", "tai nguyen nuoc", "nuoc ngam"], lq: ["moi truong", "dat dai"] },
  { ten: "nông nghiệp", dn: ["nong nghiep", "san xuat nong nghiep", "trong trot", "chan nuoi", "cay trong", "vat nuoi", "lua", "hoa mau", "rau mau", "vu dong", "vu he thu", "vu mua", "khuyen nong", "thuy loi", "thuy san", "nuoi trong"], lq: ["dich benh gia suc", "phan bon", "giong", "nong san", "hop tac xa"] },
  { ten: "dịch bệnh vật nuôi", dn: ["dich ta lon", "cum gia cam", "lo mom long mong", "dich benh gia suc", "dich benh vat nuoi", "tiem phong vat nuoi", "thu y"], lq: ["chan nuoi", "tieu huy"] },
  { ten: "nông thôn mới", dn: ["nong thon moi", "ntm", "chuan nong thon moi", "nong thon moi nang cao", "nong thon moi kieu mau", "do thi van minh"], lq: ["tieu chi", "xay dung nong thon moi"] },
  { ten: "thiên tai", dn: ["thien tai", "phong chong thien tai", "pctt", "mua bao", "bao", "lu", "lu lut", "lu quet", "sat lo", "ngap", "ngap ung", "han han", "xam nhap man", "ap thap"], lq: ["cuu ho cuu nan", "so tan", "tim kiem cuu nan", "khac phuc hau qua"] },
  { ten: "phòng cháy chữa cháy", dn: ["phong chay chua chay", "pccc", "chay", "chay no", "chua chay", "hoa hoan", "cuu nan cuu ho", "binh chua chay"], lq: ["an toan", "kiem tra pccc", "cong an"] },
  // --- Kinh tế, tài chính ---
  { ten: "ngân sách, tài chính", dn: ["ngan sach", "thu ngan sach", "chi ngan sach", "thu chi", "tai chinh", "kinh phi", "du toan", "quyet toan", "von", "tien", "thue", "phi le phi", "tam ung"], lq: ["ke toan", "kho bac", "giai ngan", "thu thue"] },
  { ten: "thuế", dn: ["thue", "thu thue", "no thue", "thue dat", "thue phi nong nghiep", "ho kinh doanh nop thue", "le phi"], lq: ["ngan sach", "kinh doanh"] },
  { ten: "kinh doanh, doanh nghiệp", dn: ["doanh nghiep", "ho kinh doanh", "kinh doanh", "hop tac xa", "htx", "co so san xuat", "tieu thuong", "cho", "buon ban", "dang ky kinh doanh"], lq: ["thue", "thuong mai", "dich vu", "an toan thuc pham"] },
  { ten: "an toàn thực phẩm", dn: ["an toan thuc pham", "attp", "ve sinh an toan thuc pham", "ngo doc thuc pham", "thuc pham ban", "bep an"], lq: ["kinh doanh", "y te", "kiem tra"] },
  { ten: "du lịch", dn: ["du lich", "diem du lich", "khach du lich", "homestay", "luu tru"], lq: ["van hoa", "le hoi", "dac san"] },
  // --- Văn hóa, xã hội ---
  { ten: "văn hóa, thể thao", dn: ["van hoa", "the thao", "van nghe", "le hoi", "nha van hoa", "thiet che van hoa", "gia dinh van hoa", "khu pho van hoa", "di tich", "the duc the thao", "giai bong da", "hoi thi"], lq: ["phong trao toan dan doan ket", "dao duc loi song", "du lich"] },
  { ten: "giáo dục", dn: ["giao duc", "truong hoc", "hoc sinh", "giao vien", "pho cap giao duc", "xoa mu chu", "nam hoc", "tuyen sinh", "mam non", "tieu hoc", "trung hoc", "khuyen hoc", "hoc bong"], lq: ["tre em", "phu huynh", "co so vat chat"] },
  { ten: "y tế, sức khỏe", dn: ["y te", "suc khoe", "tram y te", "kham benh", "chua benh", "kham chua benh", "tiem chung", "phong dich", "dich benh", "sot xuat huyet", "covid", "dan so", "ke hoach hoa gia dinh", "dinh duong", "suy dinh duong"], lq: ["bao hiem y te", "benh vien", "thuoc"] },
  { ten: "bảo hiểm y tế", dn: ["bao hiem y te", "bhyt", "the bao hiem y te", "the bhyt"], lq: ["bao hiem xa hoi", "y te", "an sinh"] },
  { ten: "bảo hiểm xã hội", dn: ["bao hiem xa hoi", "bhxh", "bao hiem xa hoi tu nguyen", "luong huu", "tro cap bhxh"], lq: ["bao hiem y te", "an sinh xa hoi", "lao dong"] },
  { ten: "giảm nghèo", dn: ["ho ngheo", "can ngheo", "giam ngheo", "thoat ngheo", "ngheo", "ho kho khan", "ra soat ho ngheo", "ngheo da chieu"], lq: ["an sinh xa hoi", "nha o", "nha tam", "tro cap", "vay von"] },
  { ten: "nhà ở, xóa nhà tạm", dn: ["nha tam", "nha dot nat", "xoa nha tam", "nha o", "ho tro nha o", "nha tinh nghia", "nha dai doan ket", "nha tinh thuong"], lq: ["ho ngheo", "an sinh xa hoi"] },
  { ten: "an sinh xã hội", dn: ["an sinh xa hoi", "an sinh", "chinh sach xa hoi", "bao tro xa hoi", "tro cap", "tro cap xa hoi", "ho tro", "cuu tro", "qua tet", "tham hoi"], lq: ["ho ngheo", "nguoi co cong", "nguoi khuyet tat", "nguoi cao tuoi", "tre em"] },
  { ten: "người có công", dn: ["nguoi co cong", "thuong binh", "liet si", "gia dinh chinh sach", "me viet nam anh hung", "uu dai nguoi co cong", "den on dap nghia", "27 7"], lq: ["an sinh xa hoi", "tham hoi"] },
  { ten: "người cao tuổi, khuyết tật, trẻ em", dn: ["nguoi cao tuoi", "nct", "nguoi gia", "nguoi khuyet tat", "khuyet tat", "tre em", "tre em co hoan canh dac biet", "bao ve tre em", "tre mo coi"], lq: ["an sinh xa hoi", "tro cap"] },
  { ten: "lao động, việc làm", dn: ["lao dong", "viec lam", "giai quyet viec lam", "xuat khau lao dong", "dao tao nghe", "hoc nghe", "that nghiep", "nguoi lao dong"], lq: ["doanh nghiep", "bao hiem xa hoi", "thu nhap"] },
  { ten: "dân số, cư trú", dn: ["dan so", "cu tru", "ho khau", "tam tru", "tam vang", "dang ky cu tru", "nhan khau", "khai sinh", "khai tu", "ho tich", "ket hon"], lq: ["tu phap ho tich", "can cuoc", "cong an"] },
  { ten: "tư pháp, hộ tịch", dn: ["tu phap", "ho tich", "chung thuc", "khai sinh", "khai tu", "dang ky ket hon", "pho bien giao duc phap luat", "pbgdpl", "tro giup phap ly"], lq: ["hoa giai", "phap luat"] },
  { ten: "tôn giáo, dân tộc", dn: ["ton giao", "tin nguong", "dan toc", "chua", "nha tho", "co so ton giao", "chuc sac"], lq: ["dai doan ket", "mat tran"] },
  // --- An ninh, quốc phòng ---
  { ten: "an ninh trật tự", dn: ["an ninh", "trat tu", "an ninh trat tu", "antt", "cong an", "toi pham", "trom cap", "danh nhau", "gay roi", "tu nan xa hoi", "co bac", "tin dung den", "cho vay nang lai", "lua dao"], lq: ["camera", "tuan tra", "phong chong toi pham", "khu pho an toan"] },
  { ten: "ma túy", dn: ["ma tuy", "nghien", "cai nghien", "nguoi su dung ma tuy", "chat gay nghien", "phong chong ma tuy"], lq: ["an ninh trat tu", "cong an", "tu nan xa hoi"] },
  { ten: "quân sự, quốc phòng", dn: ["quan su", "quoc phong", "nghia vu quan su", "nvqs", "nhap ngu", "tuyen quan", "giao quan", "dan quan", "dan quan tu ve", "dqtv", "du bi dong vien", "huan luyen"], lq: ["thanh nien", "kham tuyen"] },
  // --- Đảng, đoàn thể ---
  { ten: "xây dựng Đảng", dn: ["xay dung dang", "dang uy", "chi bo", "dang vien", "ket nap dang", "sinh hoat chi bo", "nghi quyet dang", "kiem tra dang", "uy ban kiem tra", "dang bo", "cap uy"], lq: ["hoc tap nghi quyet", "chinh tri tu tuong", "dai hoi dang"] },
  { ten: "Mặt trận, đoàn thể", dn: ["mat tran", "mttq", "uy ban mat tran", "doan the", "hoi phu nu", "phu nu", "hlhpn", "doan thanh nien", "thanh nien", "dtn", "doan phuong", "hoi cuu chien binh", "ccb", "hoi nong dan", "hoi nguoi cao tuoi", "cong doan"], lq: ["dai doan ket", "van dong", "giam sat phan bien"] },
  { ten: "HĐND, UBND", dn: ["hdnd", "hoi dong nhan dan", "ubnd", "uy ban nhan dan", "ky hop", "dai bieu", "cu tri", "tiep xuc cu tri", "chat van"], lq: ["nghi quyet hdnd", "kien nghi cu tri"] },
  { ten: "bầu cử", dn: ["bau cu", "cu tri", "ung cu", "danh sach cu tri", "to bau cu", "khu vuc bo phieu"], lq: ["hdnd", "dai bieu"] },
  // --- Trạng thái, mức độ (bổ trợ khi nằm trong nội dung) ---
  { ten: "hư hỏng, xuống cấp", dn: ["hong", "hu hong", "xuong cap", "bi hong", "hu", "nut", "vo", "sut lun", "lun", "o ga", "ro ri", "mat", "khong hoat dong", "khong sang"], lq: ["sua chua", "khac phuc", "thay the", "nang cap"] },
  { ten: "sửa chữa, nâng cấp", dn: ["sua chua", "sua", "nang cap", "cai tao", "khac phuc", "thay the", "bao tri", "bao duong", "duy tu"], lq: ["hu hong", "xuong cap", "kinh phi"] },
];

/** Từ không mang nội dung khi tìm kiếm */
export const TU_DUNG = new Set(
  (
    "viec cong viec nhiem vu cac nhung mot cua ve cho toi tim kiem xem hien thi liet ke danh sach tong hop thong ke bao nhieu so luong co la nao gi dang da duoc trong tai voi va hoac the nay kia ubnd uy ban can giup minh em anh chi oi nhe a cho biet hay thi o tu den phan nhu con roi lai bi vao ra len xuong ma khi bay gio hien nay hien tai luc truoc sau dau cuoi theo tung moi tat ca toan bo noi dung lien quan thuoc chi tiet muon xin vui long hoi tra loi phuong xa nhieu it rat qua lam nhat hon cung van deu chi moi tren duoi giua ngoai the nao sao vi tai sao de khong co ai"
  ).split(" "),
);

/** Từ đơn (có dấu) gợi ra khái niệm */
const TU_DON: Record<string, string> = {
  đèn: "đèn chiếu sáng", điện: "điện", đường: "đường giao thông", hẻm: "đường giao thông", ngõ: "đường giao thông", cầu: "cầu, cống, kênh mương", cống: "cầu, cống, kênh mương", mương: "cầu, cống, kênh mương", kênh: "cầu, cống, kênh mương",
  rác: "môi trường", "ô nhiễm": "môi trường", nước: "nước sạch", hỏng: "hư hỏng, xuống cấp", hư: "hư hỏng, xuống cấp", "xuống cấp": "hư hỏng, xuống cấp", sửa: "sửa chữa, nâng cấp",
  đất: "đất đai", nhà: "nhà ở, xóa nhà tạm", nghèo: "giảm nghèo", thuế: "thuế", chợ: "kinh doanh, doanh nghiệp", lũ: "thiên tai", lụt: "thiên tai", bão: "thiên tai", ngập: "thiên tai", cháy: "phòng cháy chữa cháy",
  trộm: "an ninh trật tự", "ma túy": "ma túy", họp: "họp", sóng: "hạ tầng số", mạng: "hạ tầng số", số: "chuyển đổi số", "trường": "giáo dục", "học": "giáo dục", "bệnh": "y tế, sức khỏe", "dịch": "y tế, sức khỏe",
  "dân": "người dân", "đơn": "phản ánh, kiến nghị", "khiếu": "phản ánh, kiến nghị", "lừa": "an toàn thông tin", "quân": "quân sự, quốc phòng", "đảng": "xây dựng Đảng", "tiền": "ngân sách, tài chính", "vốn": "ngân sách, tài chính",
};
// khi người dùng gõ không dấu: chỉ dùng các từ ít bị trùng nghĩa
const TU_DON_KD = new Map<string, string>([["rac", "môi trường"], ["nuoc", "nước sạch"], ["ngheo", "giảm nghèo"], ["thue", "thuế"], ["chay", "phòng cháy chữa cháy"], ["ngap", "thiên tai"], ["trom", "an ninh trật tự"], ["duong", "đường giao thông"], ["hong", "hư hỏng, xuống cấp"], ["dat", "đất đai"]]);

// ---------------------------------------------------------------------------
// Mở rộng câu tìm kiếm thành các khái niệm
// ---------------------------------------------------------------------------
export type BienThe = { t: string; w: number; dau?: string }; // t: không dấu; w: trọng số; dau: dạng có dấu người dùng gõ (để ưu tiên đúng dấu)
export type KhaiNiemTim = { goc: string; ten: string; bien: BienThe[] };

const thoat = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
const nguon = (p: string) => `(?<![a-z0-9])${p.split(" ").map(thoat).join("\\s+")}(?![a-z0-9])`;
const boNho1 = new Map<string, RegExp>();
const boNhoG = new Map<string, RegExp>();
/** Biểu thức tìm một cụm (không dấu) theo ranh giới từ; dùng cho test/exec */
function reCum(p: string): RegExp {
  let r = boNho1.get(p);
  if (!r) boNho1.set(p, (r = new RegExp(nguon(p))));
  return r;
}
/** Bản có cờ g, chỉ dùng với match/replace */
function reCumG(p: string): RegExp {
  let r = boNhoG.get(p);
  if (!r) boNhoG.set(p, (r = new RegExp(nguon(p), "g")));
  return r;
}
// Một âm tiết tiếng Việt không dấu dễ trùng nhiều nghĩa (cầu/câu, công/cống...): chỉ dùng làm biến thể khi là từ viết tắt / từ nước ngoài
const NGOAI = new Set(["camera", "internet", "wifi", "zalo", "facebook", "fanpage", "app", "website", "virus", "hack", "scan", "data", "startup", "chatbot", "tiktok", "youtube", "shopee", "lazada", "postmart", "voso", "viettel", "vnpt", "mobifone", "ocop", "vneid", "covid", "homestay", "ioffice"]);
const dungDuoc = (x: string) => x.includes(" ") || /\d/.test(x) || !/[aeiouy]/.test(x) || NGOAI.has(x);

/**
 * Phân tích phần nội dung của câu tìm kiếm (không dấu, đã bỏ phần thời gian / trạng thái / đơn vị...)
 * thành các khái niệm: ưu tiên cụm dài khớp từ điển, phần còn lại tách thành từng từ.
 */
export function moRong(noiDung: string, cauGoc: string): KhaiNiemTim[] {
  let t = ` ${noiDung} `;
  // bản đồ từ không dấu -> có dấu theo câu người dùng gõ
  const dauMap = new Map<string, string>();
  for (const w of coDau(cauGoc).split(" ")) if (w) dauMap.set(khongDau(w), w);
  const dau = (p: string) => {
    const ws = p.split(" ").map((w) => dauMap.get(w));
    return ws.every(Boolean) && ws.join(" ") !== p ? ws.join(" ") : undefined;
  };
  const out: KhaiNiemTim[] = [];
  const all = KHAI_NIEM.flatMap((k) => k.dn.map((p) => ({ p, k }))).sort((a, b) => b.p.length - a.p.length);
  const daCo = new Set<KhaiNiem>();
  for (const { p, k } of all) {
    if (p.length < 2 || !dungDuoc(p)) continue;
    const re = reCum(p);
    if (!re.test(t)) continue;
    t = t.replace(reCumG(p), " ");
    if (daCo.has(k)) continue;
    daCo.add(k);
    const bien: BienThe[] = [{ t: p, w: 1, dau: dau(p) }];
    for (const x of k.dn) if (x !== p && dungDuoc(x)) bien.push({ t: x, w: 0.9 });
    for (const x of k.lq || []) if (dungDuoc(x)) bien.push({ t: x, w: 0.45 });
    out.push({ goc: dau(p) || p, ten: k.ten, bien });
  }
  const tu = t
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !TU_DUNG.has(w) && !/^\d{1,2}$/.test(w));
  const khongGoDau = khongDau(cauGoc) === coDau(cauGoc);
  for (const w of [...new Set(tu)]) {
    const wd = dauMap.get(w);
    const bien: BienThe[] = [{ t: w, w: 1, dau: wd && wd !== w ? wd : undefined }];
    // từ đơn có dấu gợi ra khái niệm (ví dụ “đèn” → đèn chiếu sáng, “hỏng” → hư hỏng, xuống cấp)
    const ten = TU_DON[wd || ""] || (khongGoDau ? TU_DON_KD.get(w) : undefined);
    const k = ten ? KHAI_NIEM.find((x) => x.ten === ten) : undefined;
    if (k && !daCo.has(k)) {
      daCo.add(k);
      for (const x of k.dn) if (x !== w && dungDuoc(x)) bien.push({ t: x, w: 0.85 });
      for (const x of k.lq || []) if (dungDuoc(x)) bien.push({ t: x, w: 0.4 });
    }
    out.push({ goc: wd || w, ten: k ? `${wd || w} (${k.ten})` : wd || w, bien });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Chấm điểm một tài liệu
// ---------------------------------------------------------------------------
export type Truong = { ten: string; text: string; w: number };
export type TaiLieu = { truong: Truong[] };
type DaChuanHoa = { truong: (Truong & { goc: string; n: string; tu: Set<string> })[] };

export function chuanBi(d: TaiLieu): DaChuanHoa {
  return {
    truong: d.truong
      .filter((f) => f.text)
      .map((f) => {
        const { goc, n } = chuanHoa(f.text);
        return { ...f, goc, n, tu: new Set(n.split(/\s+/).filter(Boolean)) };
      }),
  };
}

/** Khoảng cách sửa (Levenshtein) giới hạn 1 */
function gan1(a: string, b: string): boolean {
  if (a === b) return true;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  let i = 0;
  let j = 0;
  let sai = 0;
  while (i < la && j < lb) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++sai > 1) return false;
    if (la > lb) i++;
    else if (lb > la) j++;
    else {
      i++;
      j++;
    }
  }
  return sai + (la - i) + (lb - j) <= 1;
}

export type KetQuaCham = { diem: number; khop: string[]; trich: string; phu: number };

/**
 * Điểm phù hợp: tổng theo khái niệm (trọng số biến thể × trọng số trường × độ hiếm),
 * nhân với tỷ lệ khái niệm được đáp ứng. Đúng dấu được ưu tiên, gõ sai 1 ký tự vẫn tìm được (điểm thấp hơn).
 */
export function cham(d: DaChuanHoa, kn: KhaiNiemTim[], doHiem: number[]): KetQuaCham {
  let diem = 0;
  let dat = 0;
  const khop: string[] = [];
  let trich = "";
  let trichDiem = 0;
  kn.forEach((k, idx) => {
    let best = 0;
    let bestTu = "";
    let bestTrich = "";
    for (const f of d.truong) {
      for (const b of k.bien) {
        const re = reCum(b.t);
        const m = re.exec(f.n);
        let s = 0;
        if (m) {
          s = b.w * f.w;
          // đúng dấu như người dùng gõ: thêm điểm; khác dấu (ví dụ “đèn” với “đến”): giảm mạnh
          if (b.dau) {
            const goc = coDau(f.goc.slice(m.index, m.index + m[0].length));
            s *= goc === b.dau ? 1.25 : 0.3;
          }
          // xuất hiện nhiều lần
          const lan = (f.n.match(reCumG(b.t)) || []).length;
          s *= 1 + Math.min(0.5, (lan - 1) * 0.15);
          if (s > best) {
            best = s;
            bestTu = b.dau || b.t;
            const a = Math.max(0, m.index - 70);
            bestTrich = (a > 0 ? "…" : "") + f.goc.slice(a, m.index + m[0].length + 90).trim() + (m.index + m[0].length + 90 < f.goc.length ? "…" : "");
          }
        } else if (!b.t.includes(" ") && b.t.length >= 5 && b.w >= 0.9) {
          // gõ sai 1 ký tự
          for (const w of f.tu)
            if (w.length >= 5 && w[0] === b.t[0] && gan1(w, b.t)) {
              s = 0.55 * b.w * f.w;
              if (s > best) {
                best = s;
                bestTu = `${w}≈${b.t}`;
                bestTrich = f.goc.slice(0, 160);
              }
              break;
            }
        }
      }
    }
    if (best > 0) {
      dat++;
      diem += best * (doHiem[idx] ?? 1);
      khop.push(bestTu);
      if (best > trichDiem) {
        trichDiem = best;
        trich = bestTrich;
      }
    }
  });
  const phu = kn.length ? dat / kn.length : 0;
  // thưởng khi các từ của người dùng đứng liền nhau đúng thứ tự
  if (kn.length >= 2 && dat >= 2) {
    const cum = kn.map((k) => k.bien[0].t).join(" ");
    if (d.truong.some((f) => reCum(cum).test(f.n))) diem *= 1.5;
  }
  return { diem: diem * Math.pow(phu, 1.5), khop, trich, phu };
}

/** Độ hiếm của từng khái niệm trong tập tài liệu (khái niệm càng hiếm càng có giá trị phân biệt) */
export function tinhDoHiem(docs: DaChuanHoa[], kn: KhaiNiemTim[]): number[] {
  const N = Math.max(1, docs.length);
  const gop = docs.map((d) => d.truong.map((f) => f.n).join(" | "));
  return kn.map((k) => {
    let df = 0;
    for (const n of gop) if (k.bien.some((b) => reCum(b.t).test(n))) df++;
    return 1 + Math.log(1 + N / (1 + df));
  });
}

/** Lọc và xếp hạng: giữ tài liệu đáp ứng đủ khái niệm (≥ 1/2 khi có nhiều khái niệm) và đủ điểm so với kết quả tốt nhất */
export function xepHang<T>(items: { x: T; d: DaChuanHoa }[], kn: KhaiNiemTim[]): (T & { diem: number; khop: string[]; trich: string })[] {
  if (!kn.length) return items.map((i) => ({ ...i.x, diem: 0, khop: [], trich: "" }));
  const doHiem = tinhDoHiem(
    items.map((i) => i.d),
    kn,
  );
  const r = items.map((i) => ({ i, c: cham(i.d, kn, doHiem) })).filter((r) => r.c.diem > 0 && (kn.length < 2 || r.c.phu >= 0.5));
  const top = Math.max(0, ...r.map((x) => x.c.diem));
  return r
    .filter((x) => x.c.diem >= top * 0.12)
    .sort((a, b) => b.c.diem - a.c.diem)
    .map((x) => ({ ...x.i.x, diem: Math.round((x.c.diem / (top || 1)) * 100), khop: x.c.khop, trich: x.c.trich }));
}
