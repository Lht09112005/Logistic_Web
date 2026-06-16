"use client";

import { useEffect, useState, useCallback } from "react";
import { useAppStore } from "@/store/app-store";
import { fetchAlertsAction } from "./actions";import { 
  AlertTriangle, CheckCircle, RefreshCw, ArrowLeft,
  Clock, XCircle, Truck
} from "lucide-react";
import { formatDate, getAlertSeverityBadge } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { RoleGuard } from "@/components/auth/role-guard";
import dynamic from "next/dynamic";

const ResolveAlertDialog = dynamic(() => import("./_components/resolve-alert-dialog"), {
  loading: () => null,
});

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
  const router = useRouter();
  const { setAlerts } = useAppStore();
  const { isAdmin, isManager } = useAuth();
  const [alerts, setLocalAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unresolved" | "resolved">("unresolved");
  const [resolvingAlert, setResolvingAlert] = useState<Alert | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const fetchAlerts = useCallback(async () => {
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
  }, [filter, setAlerts]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const handleResolved = () => {
    setResolvingAlert(null);
    fetchAlerts();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start sm:items-center justify-between flex-wrap gap-3">
        <div className="flex items-start sm:items-center gap-3 sm:gap-4 flex-1 min-w-0">
          <button onClick={() => router.back()} className="btn btn-secondary btn-sm px-2 sm:px-3" title="Quay lại">
            <ArrowLeft size={16} /> <span className="hidden sm:inline">Quay lại</span>
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg sm:text-2xl font-bold truncate" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", color: "var(--text-primary)" }}>
              Cảnh báo tồn kho
            </h1>
            <p className="text-xs sm:text-sm mt-0.5 truncate" style={{ color: "var(--text-secondary)" }}>
              Theo dõi và giải quyết các cảnh báo tồn kho thấp hoặc hết hàng
            </p>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
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
                CRITICAL: "--color-error", HIGH: "--color-warning", MEDIUM: "--color-warning", LOW: "--color-info",
              };
              const severityBgVar: Record<string, string> = {
                CRITICAL: "var(--color-error-bg)", HIGH: "var(--color-warning-bg)", MEDIUM: "var(--color-warning-bg)", LOW: "var(--color-info-bg)",
              };
              const AlertIcon = alert.severity === "CRITICAL" ? XCircle : AlertTriangle;

              return (
                <div
                  key={alert.id}
                  onClick={() => toggleExpand(alert.id)}
                  className="p-4 lg:p-6 lg:flex lg:items-start lg:gap-4 hover:bg-(--bg-input) transition-all duration-200 animate-fade-in border-l-4 cursor-pointer select-none"
                  style={{
                    animationDelay: `${i * 40}ms`,
                    borderLeftColor: `var(${severityColor[alert.severity]})`,
                    background: alert.isResolved ? undefined : severityBgVar[alert.severity],
                  }}
                >
                  {/* Desktop-only icon */}
                  <div
                    className="hidden lg:flex w-10 h-10 rounded-xl items-center justify-center shrink-0 shadow-sm"
                    style={{ background: severityBgVar[alert.severity] }}
                  >
                    <AlertIcon size={20} style={{ color: `var(${severityColor[alert.severity]})` }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    {/* ── Mobile layout (< lg): grid — icon + title on row 1, content full-width below ── */}
                    <div className="lg:hidden grid grid-cols-[auto_1fr] gap-x-3 gap-y-2">
                      {/* Mobile icon — col 1, row 1 */}
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm row-span-1"
                        style={{ background: severityBgVar[alert.severity] }}
                      >
                        <AlertIcon size={20} style={{ color: `var(${severityColor[alert.severity]})` }} />
                      </div>

                      {/* Name + badges — col 2, row 1 */}
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
                          {alert.product?.name}
                        </span>
                        <code className="text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--bg-input)", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "inline-block", verticalAlign: "middle", maxWidth: "100%" }}>
                          {alert.product?.sku}
                        </code>
                        <span className={`badge whitespace-nowrap ${getAlertSeverityBadge(alert.severity)}`}>
                          {alert.severity}
                        </span>
                        {/* Expand indicator */}
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleExpand(alert.id); }}
                          className="ml-auto p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-transform"
                        >
                        </button>
                      </div>

                      {/* Message — col span 2, collapsed to 1 line unless expanded */}
                      <div className="col-span-2">
                        <p className={`text-sm ${expandedIds.has(alert.id) ? '' : 'line-clamp-1'}`} style={{ color: "var(--text-secondary)" }}>
                          {alert.message}
                        </p>
                      </div>

                      {/* Meta — col span 2 */}
                      <div className="col-span-2">
                        <div className="flex items-center gap-2 text-xs flex-wrap" style={{ color: "var(--text-muted)" }}>
                          {alert.warehouse && (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border"
                              style={{ background: "var(--color-info-bg)", color: "var(--color-info)", borderColor: "var(--color-info-border)" }}
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
                            Hiện tại: <b style={{ color: alert.currentQty === 0 ? "var(--color-error)" : "var(--color-warning)" }}>{alert.currentQty}</b>
                          </span>
                        </div>
                      </div>

                      {/* Button — col span 2, full-width at bottom */}
                      <div className="col-span-2 pt-1">
                        {!alert.isResolved ? (
                          isAdmin || isManager ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); setResolvingAlert(alert); }}
                              className="w-full btn btn-primary btn-sm justify-center gap-1.5"
                            >
                              <Truck size={13} /> Giải quyết
                            </button>
                          ) : null
                        ) : (
                          <span className="inline-flex w-full badge badge-success text-xs font-semibold py-1.5 items-center justify-center gap-1 whitespace-nowrap">
                            <CheckCircle size={11} /> Đã giải quyết
                          </span>
                        )}
                      </div>
                    </div>

                    {/* ── Desktop layout (>= lg): inline, button on right ── */}
                    <div className="hidden lg:flex lg:items-start lg:gap-4">
                      <div className="flex-1 min-w-0 space-y-1.5">
                        {/* Title row: name + badges inline */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
                            {alert.product?.name}
                          </span>
                          <code className="text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--bg-input)", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "inline-block", verticalAlign: "middle", maxWidth: "100%" }}>{alert.product?.sku}</code>
                          <span className={`badge ${getAlertSeverityBadge(alert.severity)}`}>
                            {alert.severity}
                          </span>
                          {/* Expand indicator */}
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleExpand(alert.id); }}
                            className="ml-auto p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-transform"
                          >
                          </button>
                        </div>
                        <p className={`text-sm ${expandedIds.has(alert.id) ? '' : 'line-clamp-1'}`} style={{ color: "var(--text-secondary)" }}>
                          {alert.message}
                        </p>
                        <div className="flex items-center gap-2 text-xs flex-wrap" style={{ color: "var(--text-muted)" }}>
                          {alert.warehouse && (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border"
                              style={{ background: "var(--color-info-bg)", color: "var(--color-info)", borderColor: "var(--color-info-border)" }}
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
                            Hiện tại: <b style={{ color: alert.currentQty === 0 ? "var(--color-error)" : "var(--color-warning)" }}>{alert.currentQty}</b>
                          </span>
                        </div>
                      </div>
                      <div className="shrink-0">
                        {!alert.isResolved ? (
                          isAdmin || isManager ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); setResolvingAlert(alert); }}
                              className="btn btn-primary btn-sm justify-center gap-1.5 whitespace-nowrap"
                            >
                              <Truck size={13} /> Giải quyết
                            </button>
                          ) : null
                        ) : (
                          <span className="badge badge-success text-xs font-semibold py-1.5 inline-flex items-center gap-1 whitespace-nowrap">
                            <CheckCircle size={11} /> Đã giải quyết
                          </span>
                        )}
                      </div>
                    </div>
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
