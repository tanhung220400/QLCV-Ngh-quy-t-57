import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SwRegister } from "@/components/SwRegister";

export const metadata: Metadata = {
  title: "Giao việc & Chỉ tiêu xã",
  description: "Phần mềm giao việc và theo dõi chỉ tiêu cấp xã",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "QLCV xã", statusBarStyle: "default" },
  icons: { icon: "/icon-192.png", apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#1d4ed8",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>
        {children}
        <SwRegister />
      </body>
    </html>
  );
}
