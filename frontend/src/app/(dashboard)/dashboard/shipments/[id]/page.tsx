"use client";

import { useEffect, useState } from "react";
import { useParams, notFound } from "next/navigation";
import { shipmentsApi } from "@/lib/api";
import ShipmentDetailClient from "./_components/shipment-detail-client";

export default function ShipmentDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [shipment, setShipment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    if (!id) return;
    const fetchShipment = async () => {
      try {
        const res = await shipmentsApi.getById(id);
        setShipment(res.data.data);
      } catch (err) {
        console.error("Lỗi lấy chi tiết vận đơn:", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchShipment();
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse p-6">
        <div className="skeleton h-10 w-48 rounded-xl" />
        <div className="skeleton h-64 rounded-2xl" />
        <div className="skeleton h-96 rounded-2xl" />
      </div>
    );
  }

  if (error || !shipment) {
    return notFound();
  }

  return <ShipmentDetailClient shipment={shipment} />;
}
