"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Truck, Plus, Search, Filter, MapPin, Clock,
  CheckCircle, Eye, Activity, ThumbsUp,
} from "lucide-react";
import {
  formatDate, formatRelative,
  getShipmentStatusLabel, getShipmentStatusBadge,
} from "@/lib/utils";
import { shipmentsApi } from "@/lib/api";
import { useAuth } from "@/context/auth-context";

const STATUS_TABS = [
  { label: "Tất cả", value: "" },
  { label: "Chờ duyệt", value: "PENDING" },
  { label: "Đã duyệt", value: "CONFIRMED" },
  { label: "Đang vận chuyển", value: "IN_TRANSIT" },
  { label: "Đã giao", value: "DELIVERED" },
  { label: "Đã hủy", value: "CANCELLED" },
];

interface Props {
  status?: string;
  page?: string;
  search?: string;
}

const POLL_INTERVAL = 15_000;

function useRealtimeShipments(status?: string, page?: string, search?: string, driverId?: string) {
  const [shipments, setShipments] = useState<unknown[]>([]);
  const [total, setTotal] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [socketConnected, setSocketConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      const res = await shipmentsApi.getAll({
        page: page || "1",
        limit: "15",
        ...(status && { status }),
        ...(search && { search }),
        ...(driverId && { driverId }),
      });
      const data = res.data.data || [];
      const metaTotal = res.data.meta?.total || 0;
      setShipments(data);
      setTotal(metaTotal);
    } catch {
      // keep existing data
    }
    setLastUpdated(new Date());
  }, [page, status, search, driverId]);

  // Initial fetch + polling
  useEffect(() => {
    fetchAll().finally(() => setLoading(false));
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
      socket.on("alert:new", () => fetchAll());
      socket.on("shipment:position", () => fetchAll());
      return socket;
    };
    const cleanup = initSocket();
    return () => {
      cleanup.then((s) => {
        s?.off("alert:new");
        s?.off("shipment:position");
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

  return { shipments, total, loading, lastUpdated, socketConnected, refresh: handleRefresh, refreshing };
}

export default function ShipmentsClient({ status, page, search }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAdmin, isManager, isDriver, user } = useAuth();
  const driverId = isDriver && user?.id ? user.id : undefined;
  const { shipments, total, loading, lastUpdated, socketConnected, refresh, refreshing } = useRealtimeShipments(status, page, search, driverId);
  const [searchText, setSearchText] = useState(search || "");
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const activeStatus = status || "";

  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const sp = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([k, v]) => {
        if (v) sp.set(k, v); else sp.delete(k);
      });
      sp.delete("page");
      router.push(`/dashboard/shipments?${sp.toString()}`);
    },
    [router, searchParams]
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateParams({ search: searchText });
  };

  const handleApprove = async (id: string) => {
    setApprovingId(id);
    try {
      await shipmentsApi.approve(id);
      await refresh();
    } catch (err: any) {
      console.warn("Lỗi duyệt vận đơn:", err?.response?.data?.message || err?.message);
    }
    setApprovingId(null);
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="skeleton h-10 w-48 rounded-xl" />
        <div className="skeleton h-14 rounded-xl" />
        <div className="skeleton h-96 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", color: "var(--text-primary)" }}>
              Quản lý vận đơn
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
            {total} vận đơn trong hệ thống
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={refresh} disabled={refreshing} className="btn btn-ghost btn-sm">
            <Activity size={14} className={refreshing ? "animate-spin" : ""} /> {refreshing ? "Đang tải..." : "Làm mới"}
          </button>
          {isAdmin || isManager ? (
            <Link href="/dashboard/shipments/new" className="btn btn-primary btn-sm">
              <Plus size={14} /> Tạo vận đơn
            </Link>
          ) : null}
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 space-y-4">
        {/* Status tabs */}
        <div className="flex gap-1 flex-wrap">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => updateParams({ status: tab.value })}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeStatus === tab.value
                  ? "text-white shadow-sm"
                  : "hover:bg-[var(--bg-input)]"
              }`}
              style={
                activeStatus === tab.value
                  ? { background: "linear-gradient(135deg,#f97316,#ea580c)", color: "white" }
                  : { color: "var(--text-secondary)" }
              }
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Tìm theo mã, địa chỉ..."
              className="input-base pl-9 py-2 text-sm"
              style={{ height: "38px" }}
            />
          </div>
          <button type="submit" className="btn btn-secondary btn-sm">
            <Filter size={14} /> Lọc
          </button>
        </form>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {shipments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3" style={{ color: "var(--text-muted)" }}>
            <Truck size={48} style={{ opacity: 0.2 }} />
            <p className="font-medium">Không tìm thấy vận đơn</p>
            <Link href="/dashboard/shipments/new" className="btn btn-primary btn-sm">
              <Plus size={14} /> Tạo vận đơn mới
            </Link>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Mã vận đơn</th>
                  <th>Tài xế / Xe</th>
                  <th>Điểm đến</th>
                  <th>Trạng thái</th>
                  <th>Dự kiến giao</th>
                  <th>Tạo lúc</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(shipments as Record<string, unknown>[]).map((s) => (
                  <tr key={s.id as string}>
                    <td>
                      <div className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
                        {s.shipmentCode as string}
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                        {s.vehicleType as string} • {s.vehicleNumber as string}
                      </div>
                    </td>
                    <td>
                      <div className="text-sm" style={{ color: "var(--text-primary)" }}>
                        {(s.driver as Record<string,string> | null)?.name || "—"}
                      </div>
                      <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {(s.driver as Record<string,string> | null)?.phone || ""}
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-1 text-sm" style={{ color: "var(--text-secondary)" }}>
                        <MapPin size={12} className="flex-shrink-0" />
                        <span className="truncate max-w-48">{s.destinationAddress as string}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${getShipmentStatusBadge(s.status as string)}`}>
                        {getShipmentStatusLabel(s.status as string)}
                      </span>
                    </td>
                    <td>
                      {s.estimatedArrival ? (
                        <div className="flex items-center gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                          <Clock size={11} />
                          {formatRelative(s.estimatedArrival as string)}
                        </div>
                      ) : "—"}
                    </td>
                    <td>
                      <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {formatDate(s.createdAt as string)}
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        {(isAdmin || (isManager && user?.managedWarehouses?.some((mw: any) => mw.id === s.originWarehouseId))) &&
                          (s.status as string) === "PENDING" && (
                          <button
                            onClick={() => handleApprove(s.id as string)}
                            disabled={approvingId === s.id}
                            className="btn btn-primary btn-sm"
                          >
                            {approvingId === s.id ? (
                              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <ThumbsUp size={13} />
                            )}
                            Duyệt
                          </button>
                        )}
                        <Link
                          href={`/dashboard/shipments/${s.id}`}
                          className="btn btn-ghost btn-sm"
                        >
                          <Eye size={14} /> Xem
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Active shipments summary */}
      {shipments.filter((s) => (s as Record<string, unknown>).status === "IN_TRANSIT").length > 0 && (
        <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
          <CheckCircle size={16} style={{ color: "#10b981" }} />
          <span>
            {shipments.filter((s) => (s as Record<string, unknown>).status === "IN_TRANSIT").length} vận đơn đang trên đường
          </span>
        </div>
      )}
    </div>
  );
}
