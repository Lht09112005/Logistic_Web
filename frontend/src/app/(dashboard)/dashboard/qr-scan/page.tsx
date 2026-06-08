import { Suspense } from "react";
import QRScanClient from "./_components/qr-scan-client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kiểm kho QR | LogistiQ",
};

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
