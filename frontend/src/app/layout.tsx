import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Inter, Geist } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { cn } from "@/lib/utils";
import { Toaster } from "sonner";
import { OfflineBanner } from "@/components/layout/offline-banner";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = {
  themeColor: "#f97316",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

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
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "LogistiQ",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/icon-152x152.png", sizes: "152x152", type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" suppressHydrationWarning data-scroll-behavior="smooth" className={cn("font-sans", geist.variable)}>
      <head>
        {/* No-flash dark mode: runs before hydration via next/script */}
        <Script id="no-flash-dark-mode" strategy="beforeInteractive">
          {`(function(){try{var t=localStorage.getItem('theme'),d=t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme:dark)').matches);if(d)document.documentElement.classList.add('dark')}catch(e){}})()`}
        </Script>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="apple-touch-icon" sizes="152x152" href="/icons/icon-152x152.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="LogistiQ" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <Providers>{children}</Providers>
        <OfflineBanner />
        <Toaster position="top-right" richColors closeButton duration={4000} />
      </body>
    </html>
  );
}
