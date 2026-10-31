const P = (d: string) => <path d={d} />;

const ICONS: Record<string, React.ReactNode> = {
  home: P("M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"),
  list: P("M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"),
  plus: P("M12 5v14M5 12h14"),
  target: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
    </>
  ),
  chart: P("M4 20V10M10 20V4M16 20v-7M22 20H2"),
  bell: P("M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c0-3.5 3-5.5 6.5-5.5s6.5 2 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5c2.2.6 3.5 2.5 3.5 5.5" />
    </>
  ),
  cog: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </>
  ),
  more: P("M4 6h16M4 12h16M4 18h16"),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  logout: P("M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11"),
  folder: P("M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"),
  layers: P("m12 3 9 5-9 5-9-5zM3 13l9 5 9-5M3 17.5l9 5 9-5"),
  wifi: P("M2 8.5a15 15 0 0 1 20 0M5 12a10 10 0 0 1 14 0M8.5 15.5a5 5 0 0 1 7 0M12 19h.01"),
  lightbulb: P("M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"),
  book: P("M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 21a2 2 0 0 1 2-2h13v2M8 7h7"),
  store: P("M3 9 4.5 4h15L21 9M3 9v1a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0V9M3 9h18M5 13v8h14v-8M10 21v-5h4v5"),
  megaphone: P("M3 11v2a1 1 0 0 0 1 1h3l6 4V6L7 10H4a1 1 0 0 0-1 1zM16.5 8.5a5 5 0 0 1 0 7M19.5 5.5a9 9 0 0 1 0 13"),
  cpu: (
    <>
      <rect x="6" y="6" width="12" height="12" rx="2" />
      <path d="M9.5 9.5h5v5h-5zM9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" />
    </>
  ),
  map: P("M9 4 3 6.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5zM9 4v13.5M15 6.5V20"),
  pin: (
    <>
      <path d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z" />
      <circle cx="12" cy="9" r="2.5" />
    </>
  ),
  trash: P("M4 7h16M10 11v6M14 11v6M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M9 7V4h6v3"),
  link: P("M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"),
  edit: P("M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16zM13.5 6.5l4 4"),
  doc: P("M6 3h8l5 5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM14 3v5h5M8 13h8M8 17h6"),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  shield: P("M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"),
  heart: P("M12 20s-7.5-4.6-9.3-9.2C1.4 7.5 3.6 4 7 4c2 0 3.5 1.1 5 3 1.5-1.9 3-3 5-3 3.4 0 5.6 3.5 4.3 6.8C19.5 15.4 12 20 12 20z"),
  leaf: P("M5 19c0-8 5-14 15-15-1 10-7 15-15 15zM5 19l7-7"),
  school: P("M2 9l10-5 10 5-10 5zM6 11v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5M22 9v6"),
  money: (
    <>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="3" />
      <path d="M6 9v.01M18 15v.01" />
    </>
  ),
  phone: P("M6.5 3h3l1.5 4.5-2 1.2a11 11 0 0 0 6.3 6.3l1.2-2L21 14.5v3a2 2 0 0 1-2 2A16 16 0 0 1 4.5 5a2 2 0 0 1 2-2z"),
  building: P("M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16M15 10h4a1 1 0 0 1 1 1v10M2 21h20M8 8h3M8 12h3M8 16h3"),
  check: P("M4 12.5 9 17.5 20 6.5"),
  download: P("M12 4v11M7 10l5 5 5-5M4 20h16"),
  upload: P("M12 20V9M7 14l5-5 5 5M4 4h16"),
  up: P("m6 15 6-6 6 6"),
  down: P("m6 9 6 6 6-6"),
  eye: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  eyeoff: P("M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3 3.8M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7c1.6 0 3-.4 4.3-1M9.9 9.9a3 3 0 0 0 4.2 4.2"),
  restore: P("M4 12a8 8 0 1 0 2.3-5.7M4 4v4h4"),
  grid: (
    <>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
    </>
  ),
  chevron: P("m9 6 6 6-6 6"),
  tag: P("M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9zM7.5 7.5h.01"),
  flag: P("M5 21V4M5 4h11l-2 4 2 4H5"),
};

/** Danh sách biểu tượng để quản trị chọn cho module */
export const BIEU_TUONG: [string, string][] = [
  ["folder", "Thư mục"],
  ["layers", "Nhóm"],
  ["list", "Danh sách"],
  ["doc", "Văn bản"],
  ["users", "Tổ, nhóm người"],
  ["user", "Người"],
  ["book", "Học tập"],
  ["school", "Trường học"],
  ["wifi", "Hạ tầng số"],
  ["cpu", "Công nghệ"],
  ["lightbulb", "Sáng kiến"],
  ["store", "Kinh doanh, chợ"],
  ["money", "Tài chính"],
  ["megaphone", "Phản ánh, tuyên truyền"],
  ["map", "Bản đồ, địa bàn"],
  ["pin", "Vị trí"],
  ["building", "Cơ quan, nhà"],
  ["shield", "An ninh, quốc phòng"],
  ["heart", "Y tế, xã hội"],
  ["leaf", "Nông nghiệp, môi trường"],
  ["calendar", "Lịch, sự kiện"],
  ["phone", "Liên lạc"],
  ["target", "Chỉ tiêu"],
  ["chart", "Thống kê"],
  ["flag", "Phong trào"],
  ["tag", "Danh mục"],
  ["link", "Liên kết"],
];

export function Icon({ name, className = "h-6 w-6", strokeWidth = 1.9 }: { name: string; className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {ICONS[name] || ICONS.folder}
    </svg>
  );
}
