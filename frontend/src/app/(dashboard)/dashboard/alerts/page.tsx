"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/store/app-store";
import { resolveAlertAction, fetchAlertsAction } from "./actions";
import {
  AlertTriangle, CheckCircle, RefreshCw,
  Clock, XCircle, Truck
} from "lucide-react";
import { formatDate, getAlertSeverityBadge } from "@/lib/utils";
import { useAuth } from "@/context/auth-context";
import { RoleGuard } from "@/components/auth/role-guard";
import ResolveAlertDialog from "./_components/resolve-alert-dialog";

interface Alert {
  id: string;
  productId: string;
  warehouseId?: string;
  alertType: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  message: string;
  currentQty: number;
  threshold: number;
  isResolved: boolean;
  createdAt: string;
  product?: {
    name: string;
    sku: string;
    category: string;
    imageUrl?: string;
  };
  warehouse?: {
    id: string;
    name: string;
    code: string;
    city: string;
  };
}

function AlertsPage() {
  const { setAlerts, resolveAlert: resolveAlertStore } = useAppStore();
  const { isAdmin, isManager } = useAuth();
  const [alerts, setLocalAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unresolved" | "resolved">("unresolved");
  const [resolvingAlert, setResolvingAlert] = useState<Alert | null>(null);

  const fetchAlerts = async () => {
    setLoading(true);
    const params =
      filter === "resolved"
        ? { isResolved: "true" }
        : filter === "unresolved"
          ? { isResolved: "false" }
          : undefined;
    const res = await fetchAlertsAction(params);
    const data = res.data || [];
    setLocalAlerts(data);
    // Synchronize with global store if showing unresolved
    if (filter === "unresolved") {
      setAlerts(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAlerts();
  }, [filter]);

  const handleResolved = () => {
    setResolvingAlert(null);
    fetchAlerts();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", color: "var(--text-primary)" }}>
            Cảnh báo tồn kho
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            Theo dõi và giải quyết các cảnh báo tồn kho thấp hoặc hết hàng
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchAlerts} className="btn btn-secondary btn-sm">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Làm mới
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="card p-4 flex flex-wrap gap-2 items-center">
        {[
          { v: "unresolved" as const, label: "Chưa xử lý" },
          { v: "resolved" as const, label: "Đã xử lý" },
          { v: "all" as const, label: "Tất cả" },
        ].map((tab) => (
          <button
            key={tab.v}
            onClick={() => setFilter(tab.v)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${filter === tab.v ? "text-white" : "hover:bg-(--bg-input)"}`}
            style={filter === tab.v ? { background: "linear-gradient(135deg,#f97316,#ea580c)" } : { color: "var(--text-secondary)" }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main List */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-20 space-y-4">
            <div className="skeleton h-8 w-2/3 mx-auto" />
            <div className="skeleton h-8 w-1/2 mx-auto" />
            <div className="skeleton h-8 w-1/3 mx-auto" />
          </div>
        ) : alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center" style={{ color: "var(--text-muted)" }}>
            <CheckCircle size={48} className="text-emerald-500 opacity-80" />
            <h3 className="font-bold text-lg text-(--text-primary)">Tuyệt vời!</h3>
            <p className="text-sm max-w-sm">
              Không có cảnh báo tồn kho nào cần xử lý. Hệ thống kho của bạn đang vận hành ổn định.
            </p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: "var(--border-light)" }}>
            {alerts.map((alert, i) => {
              const severityColor: Record<string, string> = {
                CRITICAL: "#ef4444", HIGH: "#f97316", MEDIUM: "#f59e0b", LOW: "#6366f1",
              };
              const severityBg: Record<string, string> = {
                CRITICAL: "#fef2f2", HIGH: "#fff7ed", MEDIUM: "#fffbeb", LOW: "#eef2ff",
              };
              const AlertIcon = alert.severity === "CRITICAL" ? XCircle : AlertTriangle;

              return (
                <div
                  key={alert.id}
                  className="p-4 lg:p-6 flex items-start gap-4 hover:bg-[var(--bg-input)] transition-all duration-200 animate-fade-in border-l-4"
                  style={{
                    animationDelay: `${i * 40}ms`,
                    borderLeftColor: severityColor[alert.severity],
                    background: alert.isResolved ? undefined : `${severityBg[alert.severity]}40`,
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
                    style={{ background: `${severityColor[alert.severity]}18` }}
                  >
                    <AlertIcon size={20} style={{ color: severityColor[alert.severity] }} />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
                        {alert.product?.name}
                      </span>
                      <code className="text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--bg-input)", color: "var(--text-muted)" }}>{alert.product?.sku}</code>
                      <span className={`badge ${getAlertSeverityBadge(alert.severity)}`}>
                        {alert.severity}
                      </span>
                    </div>
                    <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                      {alert.message}
                    </p>
                    <div className="flex items-center gap-2 text-xs flex-wrap" style={{ color: "var(--text-muted)" }}>
                      {alert.warehouse && (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border"
                          style={{ background: "#f5f3ff", color: "#6d28d9", borderColor: "#e0d7fc" }}
                        >
                          {alert.warehouse.name} ({alert.warehouse.code})
                        </span>
                      )}
                      <span className="opacity-40">•</span>
                      <span className="flex items-center gap-1">
                        <Clock size={11} />
                        {formatDate(alert.createdAt)}
                      </span>
                      <span className="opacity-40">•</span>
                      <span>Tối thiểu: {alert.threshold}</span>
                      <span className="opacity-40">•</span>
                      <span>
                        Hiện tại: <b style={{ color: alert.currentQty === 0 ? "#ef4444" : "#f97316" }}>{alert.currentQty}</b>
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    {!alert.isResolved ? (
                      <>
                        {isAdmin || isManager ? (
                          <button
                            onClick={() => setResolvingAlert(alert)}
                            className="btn btn-primary btn-sm justify-center gap-1.5 whitespace-nowrap"
                          >
                            <Truck size={13} />
                            Giải quyết
                          </button>
                        ) : null}
                      </>
                    ) : (
                      <span className="badge badge-success text-xs font-semibold py-1.5 inline-flex items-center gap-1 whitespace-nowrap">
                        <CheckCircle size={11} /> Đã giải quyết
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {/* Resolve Alert Dialog */}
      {resolvingAlert && (
        <ResolveAlertDialog
          alert={resolvingAlert}
          onClose={() => setResolvingAlert(null)}
          onResolved={handleResolved}
        />
      )}
    </div>
  );
}

// Wrap page with RoleGuard — only ADMIN & MANAGER can view alerts
export default function AlertsPageWrapper() {
  return (
    <RoleGuard allowedRoles={["ADMIN", "MANAGER"]} fallback="denied">
      <AlertsPage />
    </RoleGuard>
  );
}
