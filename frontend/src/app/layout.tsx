import type { Metadata } from "next";
import { Inter, Geist } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "LogistiQ — Quản lý Kho & Vận chuyển",
    template: "%s | LogistiQ",
  },
  description:
    "Hệ thống quản lý kho và vận chuyển thông minh. Theo dõi tồn kho, kiểm kho QR code, giám sát vận chuyển thời gian thực.",
  keywords: ["logistics", "warehouse", "supply chain", "vận chuyển", "quản lý kho"],
  openGraph: {
    title: "LogistiQ — Quản lý Kho & Vận chuyển",
    description: "Hệ thống quản lý logistics thông minh cho doanh nghiệp Việt Nam",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" suppressHydrationWarning className={cn("font-sans", geist.variable)}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
