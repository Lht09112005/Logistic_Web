"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, notFound } from "next/navigation";
import { shipmentsApi } from "@/lib/api";
import ShipmentDetailClient from "./_components/shipment-detail-client";

const POLL_INTERVAL = 15_000;

export default function ShipmentDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [shipment, setShipment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [refreshing, setRefreshing] = useState(false);

  const fetchShipment = useCallback(async () => {
    if (!id) return;
    try {
      const res = await shipmentsApi.getById(id);
      setShipment(res.data.data);
      setError(false);
    } catch {
      setError(true);
    }
    setLastUpdated(new Date());
  }, [id]);

  // Initial fetch + polling
  useEffect(() => {
    fetchShipment().finally(() => setLoading(false));
    const interval = setInterval(fetchShipment, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchShipment]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchShipment();
    setRefreshing(false);
  };

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

  return (
    <ShipmentDetailClient
      shipment={shipment}
      lastUpdated={lastUpdated}
      refresh={handleRefresh}
      refreshing={refreshing}
    />
  );
}
