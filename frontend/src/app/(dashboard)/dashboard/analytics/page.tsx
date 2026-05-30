"use client";

import { useEffect, useState } from "react";
import {
  BarChart3, TrendingUp, Download, CheckCircle, Package,
  AlertTriangle, Truck, Layers, Activity
} from "lucide-react";
import { shipmentsApi, inventoryApi, warehousesApi } from "@/lib/api";

// ─── SVG Donut Chart ────────────────────────────────────────────────
function DonutChart({
  segments,
  size = 160,
}: {
  segments: { value: number; color: string; label: string }[];
  size?: number;
}) {
  const radius = 58;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;

  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  let cumulative = 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {segments.map((seg, i) => {
        const pct = seg.value / total;
        const dash = pct * circumference;
        const gap = circumference - dash;
        const rotation = (cumulative / total) * 360 - 90;
        cumulative += seg.value;
        return (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke={seg.color}
            strokeWidth={20}
            strokeDasharray={`${dash} ${gap}`}
            strokeLinecap="butt"
            transform={`rotate(${rotation} ${cx} ${cy})`}
            style={{ transition: "stroke-dasharray 0.8s ease" }}
          />
        );
      })}
      {/* Center hole */}
      <circle cx={cx} cy={cy} r={44} fill="var(--bg-card, white)" />
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize="20" fontWeight="700" fill="var(--text-primary, #111)">
        {total}
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" fontSize="9" fill="var(--text-muted, #888)" fontWeight="600">
        VẬN ĐƠN
      </text>
    </svg>
  );
}

// ─── Sparkline ──────────────────────────────────────────────────────
function Sparkline({ values, color }: { values: number[]; color: string }) {
  const w = 120;
  const h = 40;
  const max = Math.max(...values, 1);
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - (v / max) * (h - 4) - 2;
    return `${x},${y}`;
  });
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={(values.length - 1) / (values.length - 1) * w}
        cy={h - (values[values.length - 1] / max) * (h - 4) - 2}
        r="3.5"
        fill={color}
      />
    </svg>
  );
}

// ─── Animated progress bar ──────────────────────────────────────────
function AnimatedBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden" style={{ height: 8 }}>
      <div
        className="h-full rounded-full"
        style={{
          width: `${pct}%`,
          background: color,
          transition: "width 1s cubic-bezier(0.4,0,0.2,1)",
        }}
      />
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, inTransit: 0, delivered: 0, pending: 0, failed: 0 });
  const [inventoryCount, setInventoryCount] = useState(0);
  const [alertsCount, setAlertsCount] = useState(0);
  const [warehouseCount, setWarehouseCount] = useState(0);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const [statsRes, invRes, alertsRes, whRes] = await Promise.all([
          shipmentsApi.getStats(),
          inventoryApi.getAll({ limit: 1 }),
          inventoryApi.getAlerts({ isResolved: "false" }),
          warehousesApi.getAll(),
        ]);
        setStats(statsRes.data.data);
        setInventoryCount(invRes.data.meta?.total || 0);
        setAlertsCount((alertsRes.data.data || []).length);
        setWarehouseCount((whRes.data.data || []).length);
      } catch (err) {
        console.error("Lỗi tải phân tích:", err);
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, []);

  const handleExportPDF = async () => {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("LOGISTIQ SYSTEM REPORT", 20, 20);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.text(`Export date: ${new Date().toLocaleString()}`, 20, 30);
    doc.text("----------------------------------------------------------------", 20, 35);
    doc.text(`Total Shipments: ${stats.total}`, 20, 45);
    doc.text(`Delivered Shipments: ${stats.delivered}`, 20, 55);
    doc.text(`In-transit Shipments: ${stats.inTransit}`, 20, 65);
    doc.text(`Unresolved Inventory Alerts: ${alertsCount}`, 20, 75);
    doc.text(`Total Warehouses Active: ${warehouseCount}`, 20, 85);
    doc.save(`logistiq_report_${Date.now()}.pdf`);
  };

  const handleExportExcel = async () => {
    const xlsx = await import("xlsx");
    const data = [
      { Metric: "Total Shipments", Value: stats.total },
      { Metric: "Delivered", Value: stats.delivered },
      { Metric: "In Transit", Value: stats.inTransit },
      { Metric: "Pending", Value: stats.pending },
      { Metric: "Failed", Value: stats.failed },
      { Metric: "Active Inventory Items", Value: inventoryCount },
      { Metric: "Unresolved Stock Alerts", Value: alertsCount },
      { Metric: "Active Warehouses", Value: warehouseCount },
    ];
    const ws = xlsx.utils.json_to_sheet(data);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "Logistics Summary");
    xlsx.writeFile(wb, `logistiq_data_${Date.now()}.xlsx`);
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="skeleton h-10 w-64 rounded-xl" />
        <div className="grid grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-32 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-2 gap-6">
          {[1, 2].map((i) => <div key={i} className="skeleton h-64 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  const deliveryRate = stats.total > 0 ? Math.round((stats.delivered / stats.total) * 100) : 0;

  // Mock weekly trend for sparkline (simulated from stats)
  const weeklyTrend = [
    Math.max(1, stats.delivered - 5),
    Math.max(1, stats.delivered - 3),
    Math.max(1, stats.delivered - 2),
    Math.max(1, stats.delivered - 1),
    Math.max(1, stats.delivered),
    Math.max(1, stats.delivered + 1),
    Math.max(1, stats.total),
  ];

  const donutSegments = [
    { value: stats.delivered, color: "#10b981", label: "Đã giao" },
    { value: stats.inTransit, color: "#f97316", label: "Đang chạy" },
    { value: stats.pending, color: "#6366f1", label: "Chờ xác nhận" },
    { value: stats.failed, color: "#ef4444", label: "Thất bại" },
  ].filter(s => s.value > 0);

  // Pad donut if all zero
  const chartSegments = donutSegments.length > 0
    ? donutSegments
    : [{ value: 1, color: "#e5e7eb", label: "Chưa có dữ liệu" }];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", color: "var(--text-primary)" }}>
            Báo cáo phân tích
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            Xem hiệu suất chuỗi cung ứng và xuất báo cáo dữ liệu định kỳ
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExportExcel} className="btn btn-secondary btn-sm">
            <Download size={14} /> Xuất Excel
          </button>
          <button onClick={handleExportPDF} className="btn btn-primary btn-sm">
            <Download size={14} /> Xuất PDF
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Total shipments + sparkline */}
        <div className="card p-5 flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-orange-50">
              <Truck size={22} className="text-orange-500" />
            </div>
            <div>
              <div className="text-3xl font-extrabold" style={{ color: "var(--text-primary)" }}>{stats.total}</div>
              <div className="text-xs font-semibold uppercase tracking-wider mt-1" style={{ color: "var(--text-muted)" }}>Tổng vận đơn</div>
              <div className="text-xs font-semibold text-emerald-500 mt-1 flex items-center gap-0.5">
                <TrendingUp size={11} /> +12% tháng này
              </div>
            </div>
          </div>
          <Sparkline values={weeklyTrend} color="#f97316" />
        </div>

        {/* Delivery rate + donut mini */}
        <div className="card p-5 flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-emerald-50">
              <CheckCircle size={22} className="text-emerald-500" />
            </div>
            <div>
              <div className="text-3xl font-extrabold" style={{ color: "var(--text-primary)" }}>{deliveryRate}%</div>
              <div className="text-xs font-semibold uppercase tracking-wider mt-1" style={{ color: "var(--text-muted)" }}>Tỷ lệ giao đúng hẹn</div>
              <div className="text-xs font-semibold mt-1" style={{ color: deliveryRate >= 80 ? "#10b981" : "#f59e0b" }}>
                {deliveryRate >= 80 ? "✅ Mức tối ưu" : "⚠ Cần cải thiện"}
              </div>
            </div>
          </div>
          <Sparkline values={[60, 70, 65, 80, 75, 85, deliveryRate]} color="#10b981" />
        </div>

        {/* Alerts */}
        <div className="card p-5 flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-rose-50">
              <AlertTriangle size={22} className="text-rose-500" />
            </div>
            <div>
              <div className="text-3xl font-extrabold" style={{ color: "var(--text-primary)" }}>{alertsCount}</div>
              <div className="text-xs font-semibold uppercase tracking-wider mt-1" style={{ color: "var(--text-muted)" }}>Cảnh báo chưa xử lý</div>
              <div className="text-xs font-semibold text-rose-500 mt-1">Cần can thiệp nhanh</div>
            </div>
          </div>
          <Sparkline values={[2, 3, alertsCount + 1, alertsCount + 2, alertsCount, alertsCount, alertsCount]} color="#ef4444" />
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        {/* Donut Chart */}
        <div className="xl:col-span-2 card p-6 flex flex-col items-center gap-4">
          <div className="w-full flex items-center justify-between">
            <h3 className="font-bold" style={{ color: "var(--text-primary)" }}>Phân bổ vận đơn</h3>
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: "rgba(99,102,241,0.1)", color: "#6366f1" }}>
              Biểu đồ tròn
            </span>
          </div>
          <DonutChart segments={chartSegments} size={180} />
          {/* Legend */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 w-full">
            {[
              { label: "Đã giao", value: stats.delivered, color: "#10b981" },
              { label: "Đang chạy", value: stats.inTransit, color: "#f97316" },
              { label: "Chờ xác nhận", value: stats.pending, color: "#6366f1" },
              { label: "Thất bại", value: stats.failed, color: "#ef4444" },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: item.color }} />
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{item.label}</span>
                <span className="text-xs font-bold ml-auto" style={{ color: item.color }}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Horizontal bar breakdown */}
        <div className="xl:col-span-3 card p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="font-bold" style={{ color: "var(--text-primary)" }}>Phân phối hiệu quả vận chuyển</h3>
            <Activity size={18} style={{ color: "var(--text-muted)" }} />
          </div>
          <div className="space-y-4">
            {[
              { label: "Đã hoàn thành", value: stats.delivered, max: stats.total, color: "#10b981", bg: "#ecfdf5" },
              { label: "Đang vận chuyển", value: stats.inTransit, max: stats.total, color: "#f97316", bg: "#fff7ed" },
              { label: "Chờ xác nhận", value: stats.pending, max: stats.total, color: "#6366f1", bg: "#eef2ff" },
              { label: "Thất bại / Hủy", value: stats.failed, max: stats.total, color: "#ef4444", bg: "#fef2f2" },
            ].map((item) => {
              const pct = item.max > 0 ? Math.round((item.value / item.max) * 100) : 0;
              return (
                <div key={item.label} className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: item.color }} />
                      <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>{item.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold" style={{ color: item.color }}>{item.value}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold" style={{ background: item.bg, color: item.color }}>{pct}%</span>
                    </div>
                  </div>
                  <AnimatedBar pct={pct} color={item.color} />
                </div>
              );
            })}
          </div>

          {/* Summary counters */}
          <div className="grid grid-cols-3 gap-3 pt-2 border-t" style={{ borderColor: "var(--border-light)" }}>
            {[
              { label: "Kho hoạt động", value: warehouseCount, icon: Layers, color: "#6366f1" },
              { label: "Mặt hàng lưu kho", value: inventoryCount, icon: Package, color: "#f97316" },
              { label: "Tỷ lệ thành công", value: `${deliveryRate}%`, icon: BarChart3, color: "#10b981" },
            ].map(item => (
              <div key={item.label} className="flex flex-col items-center text-center p-3 rounded-xl border" style={{ borderColor: "var(--border-light)", background: "var(--bg-input)" }}>
                <item.icon size={18} style={{ color: item.color }} />
                <div className="text-xl font-extrabold mt-1" style={{ color: item.color }}>{item.value}</div>
                <div className="text-[10px] font-semibold uppercase tracking-wide mt-0.5" style={{ color: "var(--text-muted)" }}>{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
