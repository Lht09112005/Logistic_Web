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
import { toast } from "sonner";

const STATUS_TABS = [
  { label: "Tất cả", value: "" },
  { label: "Chờ duyệt", value: "PENDING" },
  { label: "Đã duyệt", value: "CONFIRMED" },
  { label: "Đang xếp hàng", value: "LOADING" },
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
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message;
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
    } catch (err: any) {
      console.warn("Lỗi từ chối vận đơn:", err?.response?.data?.message || err?.message);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start sm:items-center justify-between flex-col sm:flex-row gap-2 sm:gap-3">
        <div className="w-full sm:w-auto">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <h1 className="text-lg sm:text-2xl font-bold" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", color: "var(--text-primary)" }}>
              Quản lý vận đơn
            </h1>
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
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button onClick={refresh} disabled={refreshing} className="btn btn-ghost btn-sm flex-1 sm:flex-none justify-center">
            <Activity size={14} className={refreshing ? "animate-spin" : ""} />
            <span className="hidden sm:inline">{refreshing ? "Đang tải..." : "Làm mới"}</span>
          </button>
          {isAdmin || isManager ? (
            <Link href="/dashboard/shipments/new" className="btn btn-primary btn-sm flex-1 sm:flex-none justify-center">
              <Plus size={14} />
              <span className="hidden sm:inline"> Tạo vận đơn</span>
            </Link>
          ) : null}
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
                        {(isAdmin || (isManager && user?.managedWarehouses?.some((mw: any) => mw.id === (s as any).originWarehouseId))) &&
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
