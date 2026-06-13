"use client";

import { useEffect } from "react";
import { Suspense } from "react";
import QRScanClient from "./_components/qr-scan-client";
import { RoleGuard } from "@/components/auth/role-guard";

export default function QRScanPage() {
  useEffect(() => {
    document.title = "Kiểm kho QR | LogistiQ";
  }, []);

  return (
    <RoleGuard allowedRoles={["ADMIN", "MANAGER", "STAFF"]} fallback="denied">
      <Suspense fallback={
        <div className="p-20 text-center">
          <div className="skeleton h-12 w-3/4 mx-auto mb-4" />
          <div className="skeleton h-8 w-1/2 mx-auto" />
        </div>
      }>
        <QRScanClient />
      </Suspense>
    </RoleGuard>
  );
}
