import { Suspense } from "react";
import QRScanClient from "./_components/qr-scan-client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kiểm kho QR | LogistiQ",
};

// ISR: Revalidate mỗi 60 giây — trang này không gọi auth() nên an toàn để cache
// Giảm tải cho backend, dữ liệu giao diện QR scan (form, cấu hình) ít thay đổi
export const revalidate = 60;

export default function QRScanPage() {
  return (
    <Suspense fallback={
      <div className="p-20 text-center">
        <div className="skeleton h-12 w-3/4 mx-auto mb-4" />
        <div className="skeleton h-8 w-1/2 mx-auto" />
      </div>
    }>
      <QRScanClient />
    </Suspense>
  );
}
