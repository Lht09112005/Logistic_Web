"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Warehouse, Plus, Search, MapPin, Layers, Activity } from "lucide-react";
import { getStockPercent } from "@/lib/utils";
import { warehousesApi } from "@/lib/api";

interface WarehouseItem {
  id: string;
  name: string;
  code: string;
  address: string;
  city: string;
  province: string;
  totalArea: number;
  usedArea: number;
  capacity: number;
  status: "ACTIVE" | "INACTIVE" | "MAINTENANCE";
  manager?: {
    name: string;
    email: string;
  };
  _count?: {
    inventory: number;
    zones: number;
  };
}

interface Props {
  warehouses: unknown[];
}

const POLL_INTERVAL = 15_000;

function useRealtimeWarehouses(initial: unknown[]) {
  const fallbackRef = useRef<unknown[]>(initial);
  const [items, setItems] = useState<unknown[]>(initial);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [socketConnected, setSocketConnected] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const res = await warehousesApi.getAll();
      const data = Array.isArray(res.data.data) ? res.data.data : fallbackRef.current;
      setItems(data);
      fallbackRef.current = data;
    } catch {
      // keep existing data on failure
    }
    setLastUpdated(new Date());
  }, []);

  // Initial fetch + polling
  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchAll]);

  // Socket.io
  useEffect(() => {
    const initSocket = async () => {
      const { io } = await import("socket.io-client");
      const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:5000");
      socket.on("connect", () => setSocketConnected(true));
      socket.on("disconnect", () => setSocketConnected(false));
      socket.on("alert:new", () => fetchAll()); // inventory alert could relate to warehouse
      return socket;
    };
    const cleanup = initSocket();
    return () => {
      cleanup.then((s) => {
        s?.off("alert:new");
        s?.disconnect();
      });
    };
  }, [fetchAll]);

  // Manual refresh
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  }, [fetchAll]);

  return { items, lastUpdated, socketConnected, refresh: handleRefresh, refreshing };
}

export default function WarehouseClient({ warehouses: initial }: Props) {
  const { items, lastUpdated, socketConnected, refresh, refreshing } = useRealtimeWarehouses(initial);
  const [search, setSearch] = useState("");
  const list = items as WarehouseItem[];

  const filtered = list.filter(
    (w) =>
      w.name.toLowerCase().includes(search.toLowerCase()) ||
      w.code.toLowerCase().includes(search.toLowerCase()) ||
      w.city.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", color: "var(--text-primary)" }}>
              Kho hàng
            </h1>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: socketConnected ? "#dcfce7" : "#f1f5f9", color: socketConnected ? "#15803d" : "var(--text-muted)" }}>
              <div className={`w-1.5 h-1.5 rounded-full ${socketConnected ? "bg-emerald-500 animate-pulse" : "bg-gray-300"}`} />
              {socketConnected ? "Trực tiếp" : "Đang kết nối..."}
            </div>
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              {lastUpdated.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          </div>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            Quản lý mạng lưới kho phân phối toàn quốc
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={refresh} disabled={refreshing} className="btn btn-ghost btn-sm">
            <Activity size={14} className={refreshing ? "animate-spin" : ""} /> {refreshing ? "Đang tải..." : "Làm mới"}
          </button>
          <Link href="/dashboard/warehouse/new" className="btn btn-primary btn-sm">
            <Plus size={14} /> Thêm kho mới
          </Link>
        </div>
      </div>

      {/* Filter bar */}
      <div className="card p-4 flex gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên kho, mã kho, thành phố..."
            className="input-base pl-9 py-2 text-sm"
            style={{ height: "38px" }}
          />
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filtered.map((w, i) => {
          const occupancyPct = getStockPercent(w.usedArea || 0, w.totalArea / 2);
          const statusBadgeMap = {
            ACTIVE: "badge-success",
            INACTIVE: "badge-danger",
            MAINTENANCE: "badge-warning",
          };
          const statusLabelMap = {
            ACTIVE: "Đang hoạt động",
            INACTIVE: "Dừng hoạt động",
            MAINTENANCE: "Bảo trì",
          };

          return (
            <div
              key={w.id}
              className="card card-hover p-6 flex flex-col justify-between animate-fade-in"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="space-y-4">
                {/* Status & icon */}
                <div className="flex items-start justify-between">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ background: "#eef2ff" }}
                  >
                    <Warehouse size={22} style={{ color: "#6366f1" }} />
                  </div>
                  <span className={`badge ${statusBadgeMap[w.status]}`}>
                    {statusLabelMap[w.status]}
                  </span>
                </div>

                {/* Info */}
                <div>
                  <h3 className="font-bold text-lg hover:underline" style={{ color: "var(--text-primary)" }}>
                    <Link href={`/dashboard/warehouse/${w.id}`}>{w.name}</Link>
                  </h3>
                  <code className="text-xs" style={{ color: "var(--text-muted)" }}>{w.code}</code>
                  <p className="text-sm mt-2 flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>
                    <MapPin size={14} className="flex-shrink-0" />
                    {w.address}, {w.city}
                  </p>
                </div>

                {/* Capacity stats */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                    <span>Công suất chứa</span>
                    <span>{w.usedArea || 0} / {w.totalArea} m²</span>
                  </div>
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${occupancyPct}%`,
                        background: occupancyPct > 85 ? "#ef4444" : "linear-gradient(90deg,#6366f1,#4f46e5)",
                      }}
                    />
                  </div>
                </div>

                {/* Substats */}
                <div className="grid grid-cols-3 gap-2 pt-2 text-center border-t" style={{ borderColor: "var(--border-light)" }}>
                  <div className="space-y-0.5">
                    <div className="text-xs" style={{ color: "var(--text-muted)" }}>Phân khu</div>
                    <div className="font-bold text-sm flex items-center justify-center gap-1" style={{ color: "var(--text-primary)" }}>
                      <Layers size={13} style={{ color: "#6366f1" }} />
                      {w._count?.zones || 0}
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-xs" style={{ color: "var(--text-muted)" }}>Mặt hàng</div>
                    <div className="font-bold text-sm flex items-center justify-center gap-1" style={{ color: "var(--text-primary)" }}>
                      <Layers size={13} style={{ color: "#10b981" }} />
                      {w._count?.inventory || 0}
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-xs" style={{ color: "var(--text-muted)" }}>Quản lý</div>
                    <div className="font-semibold text-xs truncate max-w-full" style={{ color: "var(--text-primary)" }}>
                      {w.manager?.name || "—"}
                    </div>
                  </div>
                </div>
              </div>

              {/* View button */}
              <Link
                href={`/dashboard/warehouse/${w.id}`}
                className="btn btn-secondary btn-sm w-full mt-5"
              >
                Chi tiết kho
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
