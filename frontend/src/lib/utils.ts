import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format as dateFnsFormat, formatDistanceToNow } from "date-fns"
import { vi } from "date-fns/locale"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ── Date formatting ──

export function formatDate(date: string | Date, fmt = "dd/MM/yyyy HH:mm") {
  if (!date) return "—"
  const d = typeof date === "string" ? new Date(date) : date
  try {
    return dateFnsFormat(d, fmt, { locale: vi })
  } catch {
    return "—"
  }
}

export function formatRelative(date: string | Date) {
  if (!date) return "—"
  const d = typeof date === "string" ? new Date(date) : date
  try {
    return formatDistanceToNow(d, { addSuffix: true, locale: vi })
  } catch {
    return "—"
  }
}

// ── Shipment status ──

const shipmentStatusLabelMap: Record<string, string> = {
  PENDING: "Chờ duyệt",
  CONFIRMED: "Đã duyệt",
  LOADING: "Đang xếp hàng",
  IN_TRANSIT: "Đang vận chuyển",
  AT_CHECKPOINT: "Tại trạm",
  DELIVERING: "Đang giao",
  DELIVERED: "Đã giao",
  CANCELLED: "Đã hủy",
  FAILED: "Thất bại",
}

const shipmentStatusBadgeMap: Record<string, string> = {
  PENDING: "badge-warning",
  CONFIRMED: "badge-info",
  LOADING: "badge-warning",
  IN_TRANSIT: "badge-info",
  AT_CHECKPOINT: "badge-info",
  DELIVERING: "badge-success",
  DELIVERED: "badge-success",
  CANCELLED: "badge-danger",
  FAILED: "badge-danger",
}

export function getShipmentStatusLabel(status: string): string {
  return shipmentStatusLabelMap[status] || status
}

export function getShipmentStatusBadge(status: string): string {
  return shipmentStatusBadgeMap[status] || "badge-muted"
}

// ── Product category ──

const categoryLabelMap: Record<string, string> = {
  ELECTRONICS: "Điện tử",
  FMCG: "Hàng tiêu dùng",
  FOOD: "Thực phẩm",
  PHARMACEUTICAL: "Dược phẩm",
  FASHION: "Thời trang",
  OTHER: "Khác",
}

export function getCategoryLabel(category: string): string {
  return categoryLabelMap[category] || category
}

// ── Alert severity ──

const alertSeverityBadgeMap: Record<string, string> = {
  CRITICAL: "badge-danger",
  HIGH: "badge-warning",
  MEDIUM: "badge-info",
  LOW: "badge-muted",
}

export function getAlertSeverityBadge(severity: string): string {
  return alertSeverityBadgeMap[severity] || "badge-muted"
}

// ── Stock utilities ──

export function getStockPercent(qty: number, minLevel: number): number {
  if (minLevel <= 0) return 100
  return Math.min(100, Math.round((qty / minLevel) * 100))
}
