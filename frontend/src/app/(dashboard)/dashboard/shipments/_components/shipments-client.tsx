"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Truck, Plus, Search, Filter, MapPin, Clock,
  CheckCircle, Eye, RefreshCw, ThumbsUp,
  Navigation, Zap, Flag, Package, ChevronRight,
  AlertTriangle, Circle,
} from "lucide-react";
import {
  formatDate, formatRelative,
  getShipmentStatusLabel, getShipmentStatusBadge,
} from "@/lib/utils";
import { shipmentsApi } from "@/lib/api";
import { useAuth } from "@/context/auth-context";
import { toast } from "sonner";
import { offlineDB } from "@/lib/offline-db";
import { CACHE_KEYS } from "@/lib/use-offline-cache";

const STATUS_TABS = [
  { label: "Tất cả", value: "" },
  { label: "Chờ duyệt", value: "PENDING" },
  { label: "Đã duyệt", value: "CONFIRMED" },
  { label: "Đang xếp hàng", value: "LOADING" },
  { label: "Đang vận chuyển", value: "IN_TRANSIT" },
  { label: "Đã giao", value: "DELIVERED" },
  { label: "Đã hủy", value: "CANCELLED" },
];

// Tab filter riêng cho tài xế
const DRIVER_STATUS_TABS = [
  { label: "Tất cả", value: "", icon: Truck },
  { label: "Đang chạy", value: "LOADING,IN_TRANSIT,DELIVERING", icon: Navigation },
  { label: "Sắp tới", value: "CONFIRMED", icon: Zap },
  { label: "Lịch sử", value: "DELIVERED", icon: CheckCircle },
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
      // Cache for offline use (only non-driver views)
      if (!driverId) {
        const cacheKey = `app:shipments:${status || "all"}:${search || ""}`;
        offlineDB.cacheAppData(cacheKey, { items: data, total: metaTotal }, "shipments").catch((e) => console.warn('[OfflineCache] cache error:', e));
      }
    } catch {
      // Try offline cache (non-driver only)
      if (!driverId) {
        const cacheKey = `app:shipments:${status || "all"}:${search || ""}`;
        const cached = await offlineDB.getCachedAppData<{ items: unknown[]; total: number }>(cacheKey);
        if (cached) {
          setShipments(cached.items);
          setTotal(cached.total);
        }
      }
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
  const [rejectModal, setRejectModal] = useState<{ id: string; open: boolean; reason: string }>({ id: "", open: false, reason: "" });
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
      toast.success("Đã duyệt vận đơn thành công!");
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      const msg = axiosErr?.response?.data?.message || (err as Error)?.message;
      console.warn("Lỗi duyệt vận đơn:", msg);
      toast.error("Lỗi duyệt vận đơn: " + msg);
    }
    setApprovingId(null);
  };

  const handleReject = async () => {
    if (!rejectModal.reason.trim()) return;
    setApprovingId(rejectModal.id);
    try {
      await shipmentsApi.reject(rejectModal.id, rejectModal.reason);
      await refresh();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      console.warn("Lỗi từ chối vận đơn:", axiosErr?.response?.data?.message || (err as Error)?.message);
    }
    setApprovingId(null);
    setRejectModal({ id: "", open: false, reason: "" });
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="skeleton h-9 w-36 rounded-xl" />
        <div className="skeleton h-12 rounded-xl" />
        <div className="skeleton h-80 rounded-2xl" />
      </div>
    );
  }

  // ─── DRIVER VIEW: Card layout ───
  if (isDriver) {
    return (
      <div className="space-y-4">
        {/* Driver header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
            Chuyến đi của tôi
          </h1>
          <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: socketConnected ? "#dcfce7" : "#f1f5f9", color: socketConnected ? "#15803d" : "var(--text-muted)" }}>
            <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${socketConnected ? "bg-emerald-500" : "bg-gray-300"}`} />
            {total} chuyến
          </span>
        </div>

        {/* Driver tab filters */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {DRIVER_STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => updateParams({ status: tab.value })}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all shrink-0 whitespace-nowrap"
              style={
                activeStatus === tab.value
                  ? { background: "linear-gradient(135deg,#10b981,#059669)", color: "white", boxShadow: "0 2px 8px rgba(16,185,129,0.3)" }
                  : { background: "var(--bg-input)", color: "var(--text-secondary)" }
              }
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Tìm theo mã vận đơn..."
              className="input-base pl-9 py-2 text-sm"
              style={{ height: "38px" }}
            />
          </div>
          <button type="submit" className="btn btn-secondary btn-sm"><Filter size={14} /></button>
          <button type="button" onClick={refresh} disabled={refreshing} className="btn btn-ghost btn-sm">
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          </button>
        </form>

        {/* Cards */}
        {(shipments as Record<string, unknown>[]).length === 0 ? (
          <div className="card flex flex-col items-center justify-center py-16 gap-3" style={{ color: "var(--text-muted)" }}>
            <Truck size={40} style={{ opacity: 0.2 }} />
            <p className="font-medium">Không có chuyến đi nào</p>
          </div>
        ) : (
          <div className="space-y-3">
            {(shipments as Record<string, unknown>[]).map((s) => {
              const statusColorMap: Record<string, string> = {
                LOADING: "#f97316", IN_TRANSIT: "#3b82f6", DELIVERING: "#8b5cf6",
                CONFIRMED: "#6366f1", DELIVERED: "#10b981", CANCELLED: "#ef4444", PENDING: "#f59e0b",
              };
              const statusIconMap: Record<string, typeof Truck> = {
                LOADING: Package, IN_TRANSIT: Navigation, DELIVERING: Flag,
                CONFIRMED: Clock, DELIVERED: CheckCircle, PENDING: AlertTriangle,
              };
              const sStatus = s.status as string;
              const color = statusColorMap[sStatus] || "#6b7280";
              const Icon = statusIconMap[sStatus] || Truck;
              const isActive = ["LOADING", "IN_TRANSIT", "DELIVERING"].includes(sStatus);
              return (
                <Link
                  key={s.id as string}
                  href={`/dashboard/shipments/${s.id}`}
                  className="card block overflow-hidden hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5"
                  style={isActive ? { border: `2px solid ${color}`, background: `${color}06` } : {}}
                >
                  {/* Card header */}
                  <div className="px-4 py-3 flex items-center justify-between border-b" style={{ borderColor: "var(--border-color)" }}>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color}18` }}>
                        <Icon size={16} style={{ color }} />
                      </div>
                      <div>
                        <p className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>{s.shipmentCode as string}</p>
                        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{s.vehicleType as string} • {s.vehicleNumber as string}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`badge ${getShipmentStatusBadge(sStatus)}`}>
                        {getShipmentStatusLabel(sStatus)}
                      </span>
                      <ChevronRight size={14} style={{ color: "var(--text-muted)" }} />
                    </div>
                  </div>
                  {/* Card body */}
                  <div className="px-4 py-3 grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[9px] font-semibold uppercase mb-0.5" style={{ color: "var(--text-muted)" }}>Xuất phát</p>
                      <div className="flex items-start gap-1">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 mt-0.5 shrink-0" />
                        <p className="text-xs leading-tight" style={{ color: "var(--text-primary)" }}>
                          {((s.originWarehouse as Record<string, string>)?.name) || (s.originAddress as string)}
                        </p>
                      </div>
                    </div>
                    <div>
                      <p className="text-[9px] font-semibold uppercase mb-0.5" style={{ color: "var(--text-muted)" }}>Giao tới</p>
                      <div className="flex items-start gap-1">
                        <MapPin size={10} style={{ color: "#f97316", flexShrink: 0, marginTop: 2 }} />
                        <p className="text-xs leading-tight" style={{ color: "var(--text-primary)" }}>
                          {((s.destinationWarehouse as Record<string, string>)?.name) || (s.destinationAddress as string)}
                        </p>
                      </div>
                    </div>
                  </div>
                  {/* Card footer */}
                  {(s.estimatedArrival || isActive) && (
                    <div className="px-4 pb-3 flex items-center justify-between">
                      {s.estimatedArrival ? (
                        <div className="flex items-center gap-1 text-xs" style={{ color: isActive ? color : "var(--text-muted)" }}>
                          <Clock size={11} />
                          Dự kiến: <strong className="ml-0.5">{formatRelative(s.estimatedArrival as string)}</strong>
                        </div>
                      ) : <span />}
                      {isActive && (
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full animate-pulse"
                          style={{ background: `${color}20`, color }}>
                          <Circle size={8} fill="currentColor" className="inline mr-0.5" /> Đang chạy
                        </span>
                      )}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ─── NON-DRIVER VIEW: Table layout (unchanged) ───
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-start sm:items-center justify-between flex-col sm:flex-row gap-2 sm:gap-3">
          <div className="w-full sm:w-auto">
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <h1 className="text-lg sm:text-2xl font-bold" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", color: "var(--text-primary)" }}>
                Quản lý vận đơn
              </h1>
              {/* Mobile refresh — top-right inside title row */}
              <button
                onClick={refresh}
                disabled={refreshing}
                className="sm:hidden ml-auto btn btn-ghost btn-sm"
                title="Làm mới"
              >
                <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
              </button>
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium shrink-0" style={{ background: socketConnected ? "#dcfce7" : "#f1f5f9", color: socketConnected ? "#15803d" : "var(--text-muted)" }}>
                <div className={`w-1.5 h-1.5 rounded-full ${socketConnected ? "bg-emerald-500 animate-pulse" : "bg-gray-300"}`} />
                {socketConnected ? "Trực tiếp" : "Đang kết nối..."}
              </div>
              <span className="text-[9px] sm:text-[10px] hidden sm:inline" style={{ color: "var(--text-muted)" }}>
                {lastUpdated.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
            </div>
            <p className="text-xs sm:text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
              {total} vận đơn trong hệ thống
            </p>
            {/* Mobile: full-width "Tạo vận đơn" */}
            {isAdmin || isManager ? (
              <div className="sm:hidden mt-2">
                <Link href="/dashboard/shipments/new" className="btn btn-primary btn-sm w-full justify-center">
                  <Plus size={14} /> Tạo vận đơn
                </Link>
              </div>
            ) : null}
          </div>
          {/* Desktop buttons — unchanged layout */}
          <div className="hidden sm:flex gap-2">
            <button onClick={refresh} disabled={refreshing} className="btn btn-ghost btn-sm">
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
              <span>{refreshing ? "Đang tải..." : "Làm mới"}</span>
            </button>
            {isAdmin || isManager ? (
              <Link href="/dashboard/shipments/new" className="btn btn-primary btn-sm">
                <Plus size={14} /> Tạo vận đơn
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 space-y-4">
        {/* Status tabs — horizontal scroll on mobile */}
        <div className="flex gap-1 overflow-x-auto pb-1 snap-x snap-mandatory no-scrollbar sm:flex-wrap sm:overflow-visible sm:snap-none">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => updateParams({ status: tab.value })}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all snap-start shrink-0 whitespace-nowrap ${
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
          <div className="relative flex-1">
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
            {(isAdmin || isManager) && (
              <Link href="/dashboard/shipments/new" className="btn btn-primary btn-sm">
                <Plus size={14} /> Tạo vận đơn mới
              </Link>
            )}
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Mã vận đơn</th>
                  <th className="hidden md:table-cell">Tài xế / Xe</th>
                  <th className="hidden lg:table-cell">Điểm đến</th>
                  <th>Trạng thái</th>
                  <th className="hidden lg:table-cell">Dự kiến giao</th>
                  <th className="hidden md:table-cell">Tạo lúc</th>
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
                    <td className="hidden md:table-cell">
                      <div className="text-sm" style={{ color: "var(--text-primary)" }}>
                        {(s.driver as Record<string,string> | null)?.name || "—"}
                      </div>
                      <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {(s.driver as Record<string,string> | null)?.phone || ""}
                      </div>
                    </td>
                    <td className="hidden lg:table-cell">
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
                    <td className="hidden lg:table-cell">
                      {s.estimatedArrival ? (
                        <div className="flex items-center gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                          <Clock size={11} />
                          {formatRelative(s.estimatedArrival as string)}
                        </div>
                      ) : "—"}
                    </td>
                    <td className="hidden md:table-cell">
                      <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {formatDate(s.createdAt as string)}
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        {(isAdmin || (isManager && user?.managedWarehouses?.some((mw: { id: string }) => mw.id === (s as Record<string, string>).originWarehouseId))) &&
                          (s.status as string) === "PENDING" && (
                          <>
                            <button
                              onClick={() => handleApprove(s.id as string)}
                              disabled={approvingId === s.id || rejectModal.open}
                              className="btn btn-primary btn-sm"
                            >
                              {approvingId === s.id ? (
                                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <ThumbsUp size={13} />
                              )}
                              Duyệt
                            </button>
                            <button
                              onClick={() => setRejectModal({ id: s.id as string, open: true, reason: "" })}
                              disabled={approvingId === s.id}
                              className="btn btn-ghost btn-sm"
                              style={{ color: "#ef4444" }}
                            >
                              Từ chối
                            </button>
                          </>
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

      {/* Reject modal */}
      {rejectModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setRejectModal({ ...rejectModal, open: false })} />
          <div className="relative w-full max-w-md rounded-2xl shadow-2xl border p-6 space-y-4" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
            <h3 className="font-bold text-lg" style={{ color: "var(--text-primary)" }}>Từ chối vận đơn</h3>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Vui lòng nhập lý do từ chối vận đơn này:</p>
            <textarea
              value={rejectModal.reason}
              onChange={(e) => setRejectModal({ ...rejectModal, reason: e.target.value })}
              placeholder="Nhập lý do từ chối..."
              className="input-base text-sm resize-none"
              rows={3}
              style={{ width: "100%" }}
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => setRejectModal({ ...rejectModal, open: false })} className="btn btn-secondary">Hủy</button>
              <button onClick={handleReject} disabled={!rejectModal.reason.trim()} className="btn" style={{ background: "#ef4444", color: "white" }}>Xác nhận từ chối</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
