"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import ShipmentsClient from "./_components/shipments-client";

function ShipmentsContent() {
  const searchParams = useSearchParams();
  const status = searchParams.get("status") || undefined;
  const page = searchParams.get("page") || "1";
  const search = searchParams.get("search") || undefined;

  return (
    <ShipmentsClient
      status={status}
      page={page}
      search={search}
    />
  );
}

export default function ShipmentsPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6 animate-pulse">
        <div className="skeleton h-10 w-48 rounded-xl" />
        <div className="skeleton h-14 rounded-xl" />
        <div className="skeleton h-96 rounded-2xl" />
      </div>
    }>
      <ShipmentsContent />
    </Suspense>
  );
}
