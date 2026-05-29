import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date, fmt = "dd/MM/yyyy HH:mm") {
  return format(new Date(date), fmt, { locale: vi });
}

export function formatRelative(date: string | Date) {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: vi });
}

export function getShipmentStatusLabel(status: string) {
  const map: Record<string, string> = {
    PENDING: "Chờ xác nhận",
    CONFIRMED: "Đã xác nhận",
    LOADING: "Đang bốc xếp",
    IN_TRANSIT: "Đang vận chuyển",
    AT_CHECKPOINT: "Tại trạm",
    DELIVERING: "Đang giao",
    DELIVERED: "Đã giao",
    CANCELLED: "Đã hủy",
    FAILED: "Thất bại",
  };
  return map[status] || status;
}

export function getShipmentStatusBadge(status: string) {
  const map: Record<string, string> = {
    PENDING: "badge-muted",
    CONFIRMED: "badge-info",
    LOADING: "badge-warning",
    IN_TRANSIT: "badge-orange",
    AT_CHECKPOINT: "badge-info",
    DELIVERING: "badge-orange",
    DELIVERED: "badge-success",
    CANCELLED: "badge-danger",
    FAILED: "badge-danger",
  };
  return map[status] || "badge-muted";
}

export function getCategoryLabel(cat: string) {
  const map: Record<string, string> = {
    ELECTRONICS: "Điện tử",
    CLOTHING: "Quần áo",
    FOOD: "Thực phẩm",
    FURNITURE: "Nội thất",
    MEDICAL: "Y tế",
    AUTOMOTIVE: "Ô tô",
    CHEMICAL: "Hóa chất",
    OTHER: "Khác",
  };
  return map[cat] || cat;
}

export function getAlertSeverityBadge(severity: string) {
  const map: Record<string, string> = {
    LOW: "badge-info",
    MEDIUM: "badge-warning",
    HIGH: "badge-orange",
    CRITICAL: "badge-danger",
  };
  return map[severity] || "badge-muted";
}

export function getStockPercent(qty: number, min: number) {
  if (min === 0) return 100;
  return Math.min(100, Math.round((qty / (min * 2)) * 100));
}


