"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import {
  CheckCircle2, Circle, Truck, Package, Warehouse,
  MapPin, Navigation, Flag, Loader2,
  CheckCircle, Clock, ArrowRightFromLine, ArrowLeftToLine,
  PartyPopper, X,
} from "lucide-react";
import { getShipmentStatusLabel } from "@/lib/utils";
import { shipmentsApi } from "@/lib/api";

interface Checkpoint {
  id: string; name: string; address: string;
  latitude?: number; longitude?: number;
  sequence: number; isCompleted: boolean;
  arrivedAt?: string; estimatedAt?: string;
}

interface ShipmentItem {
  id: string; quantity: number; weight?: number;
  product: { name: string; sku: string; unit: string };
}

interface Props {
  shipmentId: string;
  shipmentCode: string;
  status: string;
  originAddress: string;
  destinationAddress: string;
  originWarehouse?: { id: string; name: string } | null;
  destinationWarehouse?: { id: string; name: string } | null;
  checkpoints: Checkpoint[];
  items: ShipmentItem[];
  driver?: { id: string; name: string } | null;
  currentUserId?: string;
  onStatusUpdate: (newStatus: string) => void;
  onCheckpointUpdate: (cpId: string) => void;
}

type StepStatus = "pending" | "current" | "completed";

type Step =
  | { key: "loading"; label: string; description: string; icon: typeof Package; status: StepStatus }
  | { key: "delivering"; label: string; description: string; icon: typeof Flag; status: StepStatus }
  | { key: `cp-${string}`; label: string; description: string; icon: typeof MapPin; status: StepStatus; checkpointId: string };

function isCpStep(step: Step): step is Step & { checkpointId: string } {
  return step.key.startsWith("cp-");
}

// ─── Confetti Animation Component ───
function ConfettiEffect({ trigger, checkpointName }: { trigger: boolean; checkpointName: string }) {
  const [particles, setParticles] = useState<{ id: number; x: number; y: number; color: string; rotation: number; delay: number }[]>([]);

  useEffect(() => {
    if (!trigger) return;

    const colors = ["#f97316", "#10b981", "#6366f1", "#ef4444", "#eab308", "#ec4899", "#14b8a6"];
    const newParticles = Array.from({ length: 24 }, (_, i) => ({
      id: i,
      x: 40 + Math.random() * 20,
      y: 30 + Math.random() * 20,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      delay: Math.random() * 0.3,
    }));
    setParticles(newParticles);

    const timer = setTimeout(() => setParticles([]), 2000);
    return () => clearTimeout(timer);
  }, [trigger]);

  if (particles.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-50" style={{ borderRadius: "inherit" }}>
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute animate-confetti-fall"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: 8,
            height: 8,
            background: p.color,
            borderRadius: Math.random() > 0.5 ? "50%" : "2px",
            transform: `rotate(${p.rotation}deg)`,
            animationDelay: `${p.delay}s`,
            opacity: 0,
          }}
        />
      ))}
      <div className="absolute inset-0 flex items-center justify-center animate-confetti-badge">
        <div className="px-3 py-1.5 rounded-full shadow-2xl flex items-center gap-1.5 text-xs font-bold"
          style={{
            background: "linear-gradient(135deg, var(--color-success), #059669)",
            color: "white",
            animation: "bounceIn 0.5s ease-out",
          }}
        >
          <PartyPopper size={14} />
          Đã đến {checkpointName}
        </div>
      </div>
    </div>
  );
}

// ─── Success Toast ───
function SuccessToast({
  message, visible, onClose,
}: { message: string; visible: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] animate-toast-slide-in">
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl shadow-2xl text-sm"
        style={{
          background: "linear-gradient(135deg, var(--color-success), #047857)",
          color: "white",
          minWidth: 240,
          border: "1px solid var(--color-success-border)",
        }}
      >
        <div className="w-7 h-7 rounded-full bg-emerald-400/20 flex items-center justify-center">
          <PartyPopper size={14} className="text-emerald-300" />
        </div>
        <div className="flex-1">
          <div className="text-xs font-bold">Xác nhận thành công!</div>
          <div className="text-[10px] text-emerald-200 mt-0.5">{message}</div>
        </div>
        <button onClick={onClose} className="text-emerald-300 hover:text-white transition-colors">
          <X size={12} />
        </button>
      </div>
    </div>
  );
}

// ─── Compact Route Visualizer ───
function RouteVisualizer({
  checkpoints, status, onCheckpointClick, actionLoading, completedCpId,
}: {
  checkpoints: Checkpoint[]; status: string;
  onCheckpointClick: (cpId: string) => void;
  actionLoading: string | null; completedCpId: string | null;
}) {
  const completedCount = checkpoints.filter((cp) => cp.isCompleted).length;
  const nextCpIndex = checkpoints.findIndex((cp) => !cp.isCompleted);
  const isRouteActive = ["LOADING", "IN_TRANSIT", "DELIVERING"].includes(status);

  const nodes = useMemo(() => {
    return [
      { id: "origin", label: "Kho xuất", isCheckpoint: false,
        status: (completedCount > 0 || ["LOADING","IN_TRANSIT","DELIVERING"].includes(status) ? "completed" : "current") as "completed" | "current" },
      ...checkpoints.map((cp, idx) => ({
        id: cp.id, label: cp.name, isCheckpoint: true,
        justCompleted: cp.id === completedCpId,
        status: (cp.isCompleted ? "completed" : idx === nextCpIndex ? "current" : "pending") as "completed" | "current" | "pending",
      })),
      { id: "destination", label: "Kho nhập", isCheckpoint: false,
        status: (status === "DELIVERED" ? "completed" : "pending") as "completed" | "pending" },
    ];
  }, [checkpoints, completedCount, nextCpIndex, status, completedCpId]);

  return (
    <div className="px-4 py-2.5 border-b" style={{ borderColor: "var(--border-color)" }}>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
          Lộ trình
        </h4>
        <span className="text-[9px] font-medium text-warning">
          {completedCount}/{checkpoints.length} chặng
        </span>
      </div>

      <div className="relative overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
        <div className="flex items-center gap-0 min-w-max">
          {nodes.map((node, idx) => {
            const isLast = idx === nodes.length - 1;
            const isDotCompleted = node.status === "completed";
            const isDotCurrent = node.status === "current";
            const isDotPending = node.status === "pending";
            const isClickable = isDotCurrent && node.isCheckpoint && isRouteActive;
            const dSize = node.id === "origin" || node.id === "destination" ? 10 : isDotCurrent ? 12 : 8;
            const justCompleted = (node as any).justCompleted;

            return (
              <div key={node.id} className="flex items-center">
                <div className="flex flex-col items-center gap-0.5">
                  <button
                    disabled={!isClickable || actionLoading !== null}
                    onClick={() => isClickable && onCheckpointClick(node.id)}
                    className={`relative flex items-center justify-center rounded-full transition-all duration-300
                      ${isClickable ? "cursor-pointer hover:scale-125" : "cursor-default"}
                      ${justCompleted ? "animate-checkpoint-complete" : ""}`}
                    style={{
                      width: dSize + 6, height: dSize + 6,
                      background: isDotCompleted || node.id === "origin" ? "#10b981"
                        : isDotCurrent ? "#fff7ed"
                        : node.id === "destination" ? "#fef2f2" : "white",
                      border: `${isDotCurrent ? 3 : 2}px solid ${
                        isDotCompleted || node.id === "origin" ? "#10b981"
                        : isDotCurrent ? "#f97316"
                        : node.id === "destination" ? "#ef4444" : "#d1d5db"}`,
                      boxShadow: isDotCurrent ? "0 0 8px rgba(249,115,22,0.4)" : "none",
                      transition: "all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
                    }}
                    title={isClickable ? "Nhấn để xác nhận" : node.label}
                  >
                    {isDotCurrent && (
                      <div className="absolute inset-0 rounded-full" style={{
                        background: "rgba(249,115,22,0.2)",
                        animation: "ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite",
                      }} />
                    )}
                    {isDotCompleted && <CheckCircle size={7} className="text-white" />}
                    {(node as any).justCompleted && (
                      <div className="absolute -top-1.5 -right-1.5 text-emerald-400 animate-sparkle text-[8px]">✨</div>
                    )}
                  </button>
                  <span className={`text-[7px] font-semibold whitespace-nowrap px-1 py-0.5 rounded transition-all duration-300
                    ${isDotCurrent ? "text-orange-600 bg-orange-50" : ""}
                    ${isDotCompleted || node.id === "origin" ? "text-emerald-600" : ""}
                    ${isDotPending ? "text-gray-400" : ""}`}>
                    {node.label.length > 8 ? node.label.slice(0, 6) + ".." : node.label}
                  </span>
                </div>
                {!isLast && (
                  <div className="h-0.5 mx-0.5 rounded-full transition-all duration-700"
                    style={{ width: 28, background: isDotCompleted ? "#10b981" : isDotCurrent ? "linear-gradient(90deg,#f97316,#d1d5db)" : "#d1d5db" }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-2 mt-1.5 text-[8px]" style={{ color: "var(--text-muted)" }}>
        <span className="flex items-center gap-0.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Đã qua</span>
        <span className="flex items-center gap-0.5"><div className="w-2 h-2 rounded-full border-2 border-orange-500 bg-orange-50" /> Hiện tại</span>
        <span className="flex items-center gap-0.5"><div className="w-1.5 h-1.5 rounded-full bg-gray-300" /> Chờ</span>
        {isRouteActive && nextCpIndex >= 0 && (
          <span className="ml-auto font-semibold" style={{ color: "#ea580c" }}>
            <MapPin size={8} className="inline mr-0.5" />
            {checkpoints[nextCpIndex]?.name || ""}
          </span>
        )}
      </div>
    </div>
  );
}

export default function DriverCheckpointPanel({
  shipmentId, shipmentCode, status, originAddress, destinationAddress,
  originWarehouse, destinationWarehouse, checkpoints, items,
  driver, currentUserId, onStatusUpdate, onCheckpointUpdate,
}: Props) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [confirmedCpName, setConfirmedCpName] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [completedCpId, setCompletedCpId] = useState<string | null>(null);

  const allCheckpointsCompleted = checkpoints.length > 0 && checkpoints.every((cp) => cp.isCompleted);
  const nextCpIndex = checkpoints.findIndex((cp) => !cp.isCompleted);
  const completedCount = checkpoints.filter((cp) => cp.isCompleted).length;

  const triggerSuccess = useCallback((checkpointName: string, cpId: string) => {
    setConfirmedCpName(checkpointName);
    setCompletedCpId(cpId);
    setShowConfetti(true);
    setToastMessage(`Bạn đã xác nhận đến ${checkpointName}`);
    setToastVisible(true);
    setTimeout(() => { setShowConfetti(false); setCompletedCpId(null); }, 2500);
  }, []);

  const handleAction = async (actionType: string, actionFn: () => Promise<void>) => {
    setActionLoading(actionType);
    setError(null);
    try { await actionFn(); }
    catch { setError("Thao tác thất bại, vui lòng thử lại!"); }
    setActionLoading(null);
  };

  const handleRouteCheckpointClick = (cpId: string) => {
    const cp = checkpoints.find((c) => c.id === cpId);
    if (!cp || cp.isCompleted || actionLoading !== null) return;
    handleAction(`cp-${cpId}`, async () => {
      await shipmentsApi.update(shipmentId, {
        checkpoints: checkpoints.map((c) =>
          c.id === cpId ? { ...c, isCompleted: true, arrivedAt: new Date().toISOString() } : c
        ),
      });
      onCheckpointUpdate(cpId);
      triggerSuccess(cp.name, cpId);
    });
  };

  const getStepStatus = (stepType: string): StepStatus => {
    switch (stepType) {
      case "loading": return status === "LOADING" || status === "IN_TRANSIT" || status === "DELIVERED" ? "completed" : status === "PENDING" ? "current" : "pending";
      case "delivering": return status === "DELIVERED" ? "completed" : status === "IN_TRANSIT" && allCheckpointsCompleted ? "current" : "pending";
      default: return "pending";
    }
  };

  const steps: Step[] = [
    { key: "loading", label: "Lấy hàng", description: "Chất hàng lên xe", icon: Package, status: getStepStatus("loading") },
    ...checkpoints.map((cp, idx) => ({
      key: `cp-${cp.id}` as const, label: cp.name, description: cp.address, icon: MapPin,
      status: cp.isCompleted ? "completed" as StepStatus : idx === nextCpIndex ? "current" as StepStatus : "pending" as StepStatus,
      checkpointId: cp.id,
    })),
    { key: "delivering", label: "Bàn giao", description: "Giao hàng đến kho đích", icon: Flag, status: getStepStatus("delivering") },
  ];

  const justCompletedId = completedCpId;

  return (
    <div className="card overflow-hidden border-warning relative">
      <ConfettiEffect trigger={showConfetti} checkpointName={confirmedCpName} />
      <SuccessToast message={toastMessage} visible={toastVisible} onClose={() => setToastVisible(false)} />

      {/* Compact Header */}
      <div className="px-4 py-2 bg-warning">
        <div className="flex items-center gap-2">
          <Truck size={16} className="text-warning" />
          <div>
            <h3 className="font-bold text-xs uppercase tracking-wide text-warning">
              Bảng điều khiển tài xế
            </h3>
            <p className="text-[10px]" style={{ color: "var(--color-warning)" }}>
              {shipmentCode} • {getShipmentStatusLabel(status)}
            </p>
          </div>
        </div>
      </div>

      {/* Route Visualizer */}
      <RouteVisualizer
        checkpoints={checkpoints} status={status}
        onCheckpointClick={handleRouteCheckpointClick}
        actionLoading={actionLoading} completedCpId={completedCpId}
      />

      {/* Error */}
      {error && (
        <div className="mx-4 mt-1.5 p-1.5 text-[10px] rounded-lg animate-shake bg-error text-error">
          {error}
        </div>
      )}

      {/* Progress bar - compact */}
      <div className="px-4 pt-2">
        <div className="flex justify-between text-[10px] mb-1" style={{ color: "var(--text-muted)" }}>
          <span>Tiến độ</span>
          <span className="font-semibold text-warning">{completedCount}/{checkpoints.length} chặng</span>
        </div>
        <div className="progress-bar mb-2" style={{ height: "4px" }}>
          <div className="progress-fill" style={{
            width: `${(completedCount / Math.max(checkpoints.length, 1)) * 100}%`,
            transition: "width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
          }} />
        </div>
      </div>

      {/* Compact Timeline */}
      <div className="px-4 pb-2 space-y-0.5 max-h-[280px] overflow-y-auto driver-cp-scroll">
        {steps.map((step, idx) => {
          const isLast = idx === steps.length - 1;
          const StepIcon = step.icon;
          const isCurrent = step.status === "current";
          const isCompleted = step.status === "completed";
          const isCp = isCpStep(step);
          const isCpCurrent = isCp && step.status === "current";
          const justCompleted = isCp && isCpStep(step) && step.checkpointId === justCompletedId;

          return (
            <div key={step.key} className={`flex gap-2 ${justCompleted ? "animate-step-complete" : ""}`}>
              <div className="flex flex-col items-center">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all duration-500 shrink-0 ${
                  isCompleted ? "bg-emerald-500 border-emerald-500"
                    : isCurrent ? "bg-orange-500 border-orange-500 animate-pulse"
                    : "bg-transparent border-gray-300"
                } ${justCompleted ? "animate-icon-pop" : ""}`}>
                  {isCompleted ? <CheckCircle2 size={12} className="text-white" />
                    : isCurrent ? <StepIcon size={11} className="text-white" />
                    : <Circle size={11} style={{ color: "var(--text-muted)" }} />}
                </div>
                {!isLast && <div className="w-px h-3 my-0.5 transition-all duration-700"
                  style={{ background: isCompleted ? "#10b981" : "var(--border-color)" }} />}
              </div>

              <div className={`flex-1 pb-2 transition-all duration-300 min-w-0 ${justCompleted ? "animate-slide-in" : ""}`}>
                <div className="flex items-start justify-between gap-1">
                  <div className="min-w-0 flex-1">
                    <div className={`text-[11px] font-semibold transition-colors duration-300 truncate ${
                      isCompleted ? "text-emerald-600" : isCurrent ? "text-orange-600" : "text-gray-400"
                    } ${justCompleted ? "animate-text-pop" : ""}`}>
                      {step.label}
                      {justCompleted && (
                        <span className="ml-1 inline-flex items-center text-[7px] font-bold text-emerald-500 bg-emerald-50 px-1 rounded-full animate-badge-pop">
                          <CheckCircle size={7} className="mr-0.5" /> OK
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>
                      {step.description}
                    </div>
                    {isCp && isCpStep(step) && step.checkpointId && (
                      <div className="flex items-center gap-1 text-[9px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                        <Package size={8} />
                        {items.length} mặt hàng
                        {checkpoints.find((cp) => cp.id === step.checkpointId)?.estimatedAt && (
                          <><span className="mx-0.5">•</span><Clock size={8} />
                            {new Date(checkpoints.find((cp) => cp.id === step.checkpointId)!.estimatedAt!)
                              .toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex-shrink-0">
                    {isCpCurrent && isCp && (
                      <button disabled={actionLoading !== null}
                        onClick={() => handleAction(`cp-${step.checkpointId}`, async () => {
                          await shipmentsApi.update(shipmentId, {
                            checkpoints: checkpoints.map((cp) =>
                              cp.id === step.checkpointId ? { ...cp, isCompleted: true, arrivedAt: new Date().toISOString() } : cp
                            ),
                          });
                          onCheckpointUpdate(step.checkpointId);
                          const cp = checkpoints.find((c) => c.id === step.checkpointId);
                          if (cp) triggerSuccess(cp.name, cp.id);
                        })}
                        className="btn btn-primary whitespace-nowrap px-4 py-2 text-xs min-h-[44px] sm:min-h-0 sm:px-3 sm:py-1.5"
                        style={{ borderRadius: "8px", gap: "6px" }}>
                        {actionLoading === `cp-${step.checkpointId}`
                          ? <Loader2 size={14} className="animate-spin" />
                          : <><CheckCircle size={14} /> Xác nhận</>}
                      </button>
                    )}
                    {step.key === "loading" && !isCompleted && (
                      <button disabled={actionLoading !== null}
                        onClick={() => handleAction("loading", async () => {
                          await shipmentsApi.update(shipmentId, { status: "LOADING" });
                          onStatusUpdate("LOADING");
                        })}
                        className="btn btn-primary whitespace-nowrap px-4 py-2 text-xs min-h-[44px] sm:min-h-0 sm:px-3 sm:py-1.5"
                        style={{ borderRadius: "8px", gap: "6px" }}>
                        {actionLoading === "loading"
                          ? <Loader2 size={14} className="animate-spin" />
                          : <><ArrowRightFromLine size={14} /> Nhận hàng</>}
                      </button>
                    )}
                    {step.key === "loading" && isCompleted && (
                      <span className="text-[11px] font-medium text-emerald-600 flex items-center gap-1.5 animate-fade-in">
                        <CheckCircle size={14} /> Đã lấy
                      </span>
                    )}
                    {step.key === "delivering" && isCurrent && (
                      <div className="flex flex-col gap-2">
                        <button disabled={actionLoading !== null}
                          onClick={() => handleAction("arrived", async () => {
                            await shipmentsApi.update(shipmentId, { status: "DELIVERING" });
                            onStatusUpdate("DELIVERING");
                          })}
                          className="btn btn-primary whitespace-nowrap px-4 py-2 text-xs min-h-[44px] sm:min-h-0 sm:px-3 sm:py-1.5"
                          style={{ borderRadius: "8px", gap: "6px" }}>
                          {actionLoading === "arrived"
                            ? <Loader2 size={14} className="animate-spin" />
                            : <><ArrowLeftToLine size={14} /> Đã đến kho</>}
                        </button>
                        <button disabled={actionLoading !== null}
                          onClick={() => handleAction("delivered", async () => {
                            await shipmentsApi.update(shipmentId, { status: "DELIVERED" });
                            onStatusUpdate("DELIVERED");
                          })}
                          className="inline-flex items-center justify-center font-semibold px-4 py-2 text-xs min-h-[44px] sm:min-h-0 sm:px-3 sm:py-1.5"
                          style={{ borderRadius: "8px", gap: "6px", color: "var(--color-success)", border: "1.5px solid var(--color-success-border)", background: "var(--color-success-bg)", cursor: "pointer" }}>
                          {actionLoading === "delivered"
                            ? <Loader2 size={14} className="animate-spin" />
                            : <><Flag size={14} /> Hoàn thành</>}
                        </button>
                      </div>
                    )}
                    {step.key === "delivering" && isCompleted && (
                      <span className="text-[10px] font-medium text-emerald-600 flex items-center gap-1 animate-fade-in">
                        <CheckCircle size={11} /> Đã bàn giao
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Current position bar - compact */}
      {nextCpIndex >= 0 && nextCpIndex < checkpoints.length && (            <div className="px-4 py-1.5 border-t transition-colors duration-500"
          style={{ borderColor: "var(--border-color)", background: completedCpId ? "var(--color-success-bg)" : "var(--color-warning-bg)" }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[10px]">
              <Navigation size={11} style={{ color: completedCpId ? "var(--color-success)" : "var(--color-warning)" }} />
              <span style={{ color: completedCpId ? "var(--color-success)" : "var(--color-warning)" }}>
                <strong>Vị trí:</strong> Đang tại <strong>{checkpoints[nextCpIndex]?.name}</strong>
              </span>
            </div>
            <span className="text-[9px] font-medium" style={{ color: completedCpId ? "var(--color-success)" : "var(--color-warning)" }}>
              {nextCpIndex + 1}/{checkpoints.length}
            </span>
          </div>
        </div>
      )}

      {/* Cargo summary - compact */}
      <div className="px-4 py-1.5 border-t flex items-center justify-between"
        style={{ borderColor: "var(--border-color)", background: "var(--bg-input)" }}>
        <div className="flex items-center gap-1.5 text-[10px]" style={{ color: "var(--text-secondary)" }}>
          <Package size={11} />
          <span>{items.length} loại</span>
        </div>
        <div className="flex items-center gap-1 text-[9px]" style={{ color: "var(--text-muted)" }}>
          <Warehouse size={10} />
          {originWarehouse?.name || "Kho 1"} → {destinationWarehouse?.name || "Kho 2"}
        </div>
      </div>
    </div>
  );
}
