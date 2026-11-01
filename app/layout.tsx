import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";
import { SwRegister } from "@/components/SwRegister";

const font = Be_Vietnam_Pro({ subsets: ["latin", "vietnamese"], weight: ["400", "500", "600", "700"], variable: "--font-be-vietnam", display: "swap" });

export const metadata: Metadata = {
  title: "QLCV Nghị quyết 57-NQ/TW",
  description: "Phần mềm giao việc và theo dõi chỉ tiêu cấp xã",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "QLCV xã", statusBarStyle: "default" },
  icons: { icon: "/icon-192.png", apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={font.variable}>
      <body>
        {children}
        <SwRegister />
      </body>
    </html>
  );
}
