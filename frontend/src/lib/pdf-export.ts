"use client";

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type ExcelJS from "exceljs";

// ─── Font caching ──────────────────────────────────────────────
let _fontBase64: string | null = null;
let _fontLoading: Promise<string | null> | null = null;

const FONT_URL =
  "https://fonts.gstatic.com/s/notosans/v38/o-0IIpQlx3QUlC5A4PNr5TRF.ttf";
const FONT_NAME = "NotoSans";

/**
 * Load Noto Sans font (supports Vietnamese) from Google Fonts CDN.
 * Returns the base64-encoded font data, or null on failure.
 * Caches the result so it's only fetched once.
 */
async function getFontBase64(): Promise<string | null> {
  if (_fontBase64) return _fontBase64;
  if (_fontLoading) return _fontLoading;

  _fontLoading = (async () => {
    try {
      const response = await fetch(FONT_URL);
      const blob = await response.blob();

      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]); // Remove data:...;base64, prefix
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      _fontBase64 = base64;
      return base64;
    } catch (error) {
      console.warn("[PDF Export] Failed to load Unicode font, falling back to standard fonts:", error);
      return null;
    }
  })();

  return _fontLoading;
}

/**
 * Register the cached font on a specific jsPDF instance.
 * Must be called after getFontBase64() has resolved.
 */
function registerFontOnDoc(doc: jsPDF): void {
  if (!_fontBase64) return;
  doc.addFileToVFS(`${FONT_NAME}-Regular.ttf`, _fontBase64);
  doc.addFont(`${FONT_NAME}-Regular.ttf`, FONT_NAME, "normal");
  doc.addFont(`${FONT_NAME}-Regular.ttf`, `${FONT_NAME}-bold`, "bold");
}

function applyFont(doc: jsPDF, style: "normal" | "bold" = "normal"): void {
  if (_fontBase64) {
    doc.setFont(FONT_NAME, style === "bold" ? "bold" : "normal");
  } else {
    doc.setFont("helvetica", style);
  }
}

// ─── Colors ────────────────────────────────────────────────────

const COLORS = {
  primary: [249, 115, 22] as [number, number, number],
  primaryDark: [234, 88, 12] as [number, number, number],
  accent: [16, 185, 129] as [number, number, number],
  text: [30, 30, 30] as [number, number, number],
  textSecondary: [107, 114, 128] as [number, number, number],
  border: [229, 231, 235] as [number, number, number],
  error: [239, 68, 68] as [number, number, number],
};

// ─── Main Export Functions ─────────────────────────────────────

const MARGIN = 14;
const PAGE_WIDTH = 210; // A4

/**
 * Export analytics data to a professional PDF with Vietnamese support
 */
export async function exportAnalyticsPDF(params: {
  total: number;
  inTransit: number;
  delivered: number;
  pending: number;
  failed: number;
  inventoryCount: number;
  alertsCount: number;
  warehouseCount: number;
}): Promise<void> {
  const { total, inTransit, delivered, pending, failed, inventoryCount, alertsCount, warehouseCount } = params;

  // Load Unicode font first
  await getFontBase64();

  // Create doc and register font on THIS instance
  const doc = new jsPDF("p", "mm", "a4");
  registerFontOnDoc(doc);

  const pageH = doc.internal.pageSize.getHeight();
  const deliveryRate = total > 0 ? Math.round((delivered / total) * 100) : 0;

  // ═══════════════════════════ HEADER ═══════════════════════════

  // Top decorative bar
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, PAGE_WIDTH, 6, "F");

  // Logo + title
  doc.setFillColor(...COLORS.primaryDark);
  doc.roundedRect(MARGIN, 16, 8, 8, 1.5, 1.5, "F");
  applyFont(doc, "bold");
  doc.setFontSize(20);
  doc.setTextColor(...COLORS.primary);
  doc.text("LogistiQ", MARGIN + 14, 23);

  applyFont(doc, "bold");
  doc.setFontSize(26);
  doc.setTextColor(...COLORS.text);
  doc.text("Báo cáo phân tích hệ thống", MARGIN, 38);

  // Divider
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, 43, PAGE_WIDTH - MARGIN, 43);

  // Meta info
  applyFont(doc, "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.textSecondary);
  const dateStr = new Date().toLocaleDateString("vi-VN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  doc.text(`Ngày xuất báo cáo: ${dateStr}`, MARGIN, 50);
  doc.text("LogistiQ — Hệ thống quản lý chuỗi cung ứng thông minh", MARGIN, 55);

  // ═══════════════════════════ SUMMARY TABLE ═══════════════════════════

  autoTable(doc, {
    startY: 62,
    head: [["Chỉ số", "Giá trị", "Đánh giá"]],
    body: [
      ["Tổng số vận đơn", `${total}`, "—"],
      ["Đã giao hàng", `${delivered}`, deliveryRate >= 80 ? "Tốt" : deliveryRate >= 50 ? "Trung bình" : "Cần cải thiện"],
      ["Đang vận chuyển", `${inTransit}`, inTransit > 0 ? "Đang hoạt động" : "—"],
      ["Chờ xác nhận", `${pending}`, pending > 0 ? "Cần xử lý" : "—"],
      ["Thất bại / Hủy", `${failed}`, failed > 0 ? "Cần xem xét" : "Không có"],
      ["Tỷ lệ giao hàng thành công", `${deliveryRate}%`, deliveryRate >= 80 ? "Mức tối ưu" : "Cần cải thiện"],
    ],
    theme: "grid",
    headStyles: {
      fillColor: COLORS.primary,
      textColor: 255,
      fontStyle: "bold",
      fontSize: 10,
      halign: "center",
    },
    bodyStyles: { fontSize: 10, textColor: COLORS.text },
    columnStyles: {
      0: { cellWidth: 80, fontStyle: "bold" },
      1: { cellWidth: 40, halign: "center" },
      2: { cellWidth: 50, halign: "center" },
    },
    margin: { left: MARGIN, right: MARGIN },
    didParseCell(data) {
      if (data.column.index === 2 && data.section === "body") {
        const text = data.cell.raw?.toString() || "";
        if (text === "Tốt" || text === "Mức tối ưu" || text === "Không có" || text === "Hoạt động" || text === "Có hàng" || text === "An toàn") data.cell.styles.textColor = [22, 163, 74];
        else if (text.includes("Trung bình") || text.includes("Cần cải thiện")) data.cell.styles.textColor = [217, 119, 6];
        else if (text.includes("Cần xem xét")) data.cell.styles.textColor = [220, 38, 38];
      }
    },
  });

  // ═══════════════════════════ INVENTORY SECTION ═══════════════════════════

  const lastY = (doc as any).lastAutoTable.finalY || 62;

  applyFont(doc, "bold");
  doc.setFontSize(14);
  doc.setTextColor(...COLORS.text);
  doc.text("Kho hàng & Tồn kho", MARGIN, lastY + 16);

  autoTable(doc, {
    startY: lastY + 22,
    head: [["Chỉ số", "Giá trị", "Trạng thái"]],
    body: [
      ["Kho đang hoạt động", `${warehouseCount}`, warehouseCount > 0 ? "Hoạt động" : "Chưa có dữ liệu"],
      ["Mặt hàng trong kho", `${inventoryCount}`, inventoryCount > 0 ? "Có hàng" : "Chưa có dữ liệu"],
      ["Cảnh báo tồn kho", `${alertsCount}`, alertsCount === 0 ? "An toàn" : `${alertsCount} cảnh báo`],
    ],
    theme: "grid",
    headStyles: {
      fillColor: COLORS.accent,
      textColor: 255,
      fontStyle: "bold",
      fontSize: 10,
      halign: "center",
    },
    bodyStyles: { fontSize: 10, textColor: COLORS.text },
    columnStyles: {
      0: { cellWidth: 80, fontStyle: "bold" },
      1: { cellWidth: 40, halign: "center" },
      2: { cellWidth: 50, halign: "center" },
    },
    margin: { left: MARGIN, right: MARGIN },
  });

  // ═══════════════════════════ FOOTER ═══════════════════════════

  doc.setFillColor(...COLORS.primary);
  doc.rect(0, pageH - 6, PAGE_WIDTH, 6, "F");

  applyFont(doc, "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.textSecondary);
  doc.text("Báo cáo được tạo tự động bởi LogistiQ © 2025", MARGIN, pageH - 12);
  doc.text(
    `Mã báo cáo: RPT-${Date.now().toString(36).toUpperCase()}`,
    PAGE_WIDTH - MARGIN,
    pageH - 12,
    { align: "right" }
  );

  doc.save(`LogistiQ_BaoCao_${Date.now()}.pdf`);
}

/**
 * Export analytics data to a professionally formatted Excel file
 * Uses exceljs for full styling support (colors, borders, fonts, conditional formatting)
 */
export async function exportAnalyticsExcel(params: {
  total: number;
  inTransit: number;
  delivered: number;
  pending: number;
  failed: number;
  inventoryCount: number;
  alertsCount: number;
  warehouseCount: number;
}): Promise<void> {
  const { total, inTransit, delivered, pending, failed, inventoryCount, alertsCount, warehouseCount } = params;

  const ExcelJS = await import("exceljs");
  const deliveryRate = total > 0 ? Math.round((delivered / total) * 100) : 0;

  const wb = new ExcelJS.Workbook();
  wb.creator = "LogistiQ";
  wb.created = new Date();

  // ─── Palette ──────────────────────────────────────────────────
  const colors = {
    primary:    { argb: "FFF97316" },  // orange
    primaryDark: { argb: "FFEA580C" },
    accent:     { argb: "FF10B981" },  // emerald
    accentDark:  { argb: "FF059669" },
    headerText: { argb: "FFFFFFFF" },
    bodyText:   { argb: "FF1E1E1E" },
    mutedText:  { argb: "FF6B7280" },
    border:     { argb: "FFD1D5DB" },
    rowEven:    { argb: "FFF9FAFB" },  // light gray
    rowOdd:     { argb: "FFFFFFFF" },    // white
    success:    { argb: "FF16A34A" },    // green
    warning:    { argb: "FFD97706" },    // amber
    danger:     { argb: "FFDC2626" },   // red
    subtitleBg: { argb: "FFFEF3C7" },   // amber-50
  };

  type ExcelColor = { argb: string };

  /** Shared thin border */
  const thinBorder: Partial<ExcelJS.Borders> = {
    top:    { style: "thin", color: colors.border },
    bottom: { style: "thin", color: colors.border },
    left:   { style: "thin", color: colors.border },
    right:  { style: "thin", color: colors.border },
  };

  /** Shared medium border for headers */
  const mediumBorder: Partial<ExcelJS.Borders> = {
    top:    { style: "medium", color: colors.primaryDark },
    bottom: { style: "medium", color: colors.primaryDark },
    left:   { style: "medium", color: colors.primaryDark },
    right:  { style: "medium", color: colors.primaryDark },
  };

  /** Apply default font to a cell */
  function styleCell(
    cell: ExcelJS.Cell,
    opts: {
      bold?: boolean;
      color?: ExcelColor;
      fill?: ExcelColor;
      fontSize?: number;
      align?: "left" | "center" | "right";
      border?: Partial<ExcelJS.Borders>;
      numFmt?: string;
    } = {},
  ) {
    cell.font = {
      name: "Noto Sans",
      size: opts.fontSize ?? 11,
      bold: opts.bold ?? false,
      color: opts.color ?? colors.bodyText,
    };
    if (opts.fill) cell.fill = { type: "pattern", pattern: "solid", fgColor: opts.fill };
    if (opts.align) cell.alignment = { horizontal: opts.align, vertical: "middle" };
    if (opts.border) cell.border = opts.border;
    if (opts.numFmt) cell.numFmt = opts.numFmt;
  }

  /** Decides status color based on a condition */
  function statusColor(
    isGood: boolean,
    isMedium: boolean,
  ): ExcelColor {
    if (isGood) return colors.success;
    if (isMedium) return colors.warning;
    return colors.danger;
  }

  /** Status text + color helper */
  function good(v: number, label: string): { text: string; color: ExcelColor } {
    if (v === 0) return { text: label, color: colors.success };
    if (v <= 3) return { text: label, color: colors.warning };
    return { text: label, color: colors.danger };
  }

  const dateStr = new Date().toLocaleDateString("vi-VN", {
    year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
  });

  // ═══════════════════════════════════════════════════════════════
  //  SHEET 1 — Tổng quan
  // ═══════════════════════════════════════════════════════════════

  const ws1 = wb.addWorksheet("Tổng quan", {
    pageSetup: { orientation: "portrait", fitToPage: true },
  });

  // Title row
  ws1.mergeCells(1, 1, 1, 4);
  const titleCell = ws1.getCell("A1");
  titleCell.value = "BÁO CÁO PHÂN TÍCH HỆ THỐNG — LOGISTIQ";
  styleCell(titleCell, { bold: true, color: colors.headerText, fill: colors.primary, fontSize: 16, align: "center", border: thinBorder });
  ws1.getRow(1).height = 38;

  // Subtitle row
  ws1.mergeCells(2, 1, 2, 4);
  const subCell = ws1.getCell("A2");
  subCell.value = `Ngày xuất báo cáo: ${dateStr}  ·  LogistiQ — Hệ thống quản lý chuỗi cung ứng thông minh`;
  styleCell(subCell, { color: colors.mutedText, fill: colors.subtitleBg, fontSize: 10, align: "center", border: thinBorder });
  ws1.getRow(2).height = 26;

  // Empty spacer row
  ws1.getRow(3).height = 6;

  // Header row
  const summaryHeaders = ["Chỉ số", "Giá trị", "Đánh giá", "Khuyến nghị"];
  const headerRow = ws1.getRow(4);
  summaryHeaders.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    styleCell(cell, { bold: true, color: colors.headerText, fill: colors.primaryDark, fontSize: 11, align: "center", border: mediumBorder });
  });
  headerRow.height = 26;

  // Body rows
  const summaryRows: {
    label: string;
    value: number | string;
    status: { text: string; color: typeof colors.success | typeof colors.warning | typeof colors.danger };
    recommend: string;
  }[] = [
    {
      label: "Tổng số vận đơn",
      value: total,
      status: { text: "—", color: colors.bodyText },
      recommend: "",
    },
    {
      label: "Đã giao hàng",
      value: delivered,
      status: {
        text: deliveryRate >= 80 ? "Tốt" : deliveryRate >= 50 ? "Trung bình" : "Cần cải thiện",
        color: statusColor(deliveryRate >= 80, deliveryRate >= 50),
      },
      recommend: deliveryRate >= 80 ? "Duy trì hiệu suất hiện tại" : "Tối ưu hóa quy trình giao hàng",
    },
    {
      label: "Đang vận chuyển",
      value: inTransit,
      status: good(inTransit, inTransit > 0 ? "Đang hoạt động" : "—"),
      recommend: inTransit > 0 ? "Theo dõi tiến độ thường xuyên" : "",
    },
    {
      label: "Chờ xác nhận",
      value: pending,
      status: good(pending, pending > 0 ? "Cần xử lý" : "—"),
      recommend: pending > 0 ? "Xác nhận và phê duyệt sớm" : "",
    },
    {
      label: "Thất bại / Hủy",
      value: failed,
      status: good(failed, failed > 0 ? "Cần xem xét" : "Không có"),
      recommend: failed > 0 ? "Điều tra nguyên nhân và cải thiện" : "",
    },
    {
      label: "Tỷ lệ giao hàng",
      value: `${deliveryRate}%`,
      status: {
        text: deliveryRate >= 80 ? "Mức tối ưu" : "Cần cải thiện",
        color: statusColor(deliveryRate >= 80, deliveryRate >= 50),
      },
      recommend: deliveryRate >= 80 ? "Đạt chuẩn KPI" : "Xem xét lại quy trình logistics",
    },
  ];

  summaryRows.forEach((row, idx) => {
    const rowNum = idx + 5;
    const r = ws1.getRow(rowNum);
    const bgColor = idx % 2 === 0 ? colors.rowEven : colors.rowOdd;

    const cell1 = r.getCell(1);
    cell1.value = row.label;
    styleCell(cell1, { bold: true, color: colors.bodyText, fill: bgColor, fontSize: 11, align: "left", border: thinBorder });

    const cell2 = r.getCell(2);
    cell2.value = row.value;
    styleCell(cell2, { bold: true, color: colors.primary, fill: bgColor, fontSize: 12, align: "center", border: thinBorder });

    const cell3 = r.getCell(3);
    cell3.value = row.status.text;
    styleCell(cell3, { color: row.status.color, fill: bgColor, fontSize: 11, align: "center", border: thinBorder });

    const cell4 = r.getCell(4);
    cell4.value = row.recommend;
    styleCell(cell4, { color: colors.mutedText, fill: bgColor, fontSize: 10, align: "left", border: thinBorder });

    r.height = 24;
  });

  // Column widths
  ws1.getColumn(1).width = 30;
  ws1.getColumn(2).width = 18;
  ws1.getColumn(3).width = 28;
  ws1.getColumn(4).width = 42;

  // ═══════════════════════════════════════════════════════════════
  //  SHEET 2 — Chi tiết vận đơn
  // ═══════════════════════════════════════════════════════════════

  const ws2 = wb.addWorksheet("Chi tiết vận đơn", {
    pageSetup: { orientation: "portrait", fitToPage: true },
  });

  // Title
  ws2.mergeCells(1, 1, 1, 4);
  const title2 = ws2.getCell("A1");
  title2.value = "PHÂN BỔ VẬN ĐƠN THEO TRẠNG THÁI";
  styleCell(title2, { bold: true, color: colors.headerText, fill: colors.primary, fontSize: 16, align: "center", border: thinBorder });
  ws2.getRow(1).height = 38;

  // Subtitle
  ws2.mergeCells(2, 1, 2, 4);
  const sub2 = ws2.getCell("A2");
  sub2.value = `Ngày xuất: ${dateStr}  ·  Tổng số vận đơn: ${total}`;
  styleCell(sub2, { color: colors.mutedText, fill: colors.subtitleBg, fontSize: 10, align: "center", border: thinBorder });
  ws2.getRow(2).height = 26;

  // Header row
  const breakHeaders = ["Trạng thái", "Số lượng", "Tỷ lệ", "Xu hướng"];
  const hdr2 = ws2.getRow(4);
  breakHeaders.forEach((h, i) => {
    const cell = hdr2.getCell(i + 1);
    cell.value = h;
    styleCell(cell, { bold: true, color: colors.headerText, fill: colors.accentDark, fontSize: 11, align: "center", border: mediumBorder });
  });
  hdr2.height = 26;

  const breakdownItems: {
    label: string;
    count: number;
    pct: string;
    trendColor: typeof colors.success | typeof colors.warning | typeof colors.danger;
    trendLabel: string;
  }[] = [
    {
      label: "Đã giao hàng",
      count: delivered,
      pct: total > 0 ? `${Math.round((delivered / total) * 100)}%` : "0%",
      trendColor: colors.success,
      trendLabel: Math.round((delivered / (total || 1)) * 100) >= 80 ? "Ổn định" : "Cần cải thiện",
    },
    {
      label: "Đang vận chuyển",
      count: inTransit,
      pct: total > 0 ? `${Math.round((inTransit / total) * 100)}%` : "0%",
      trendColor: colors.warning,
      trendLabel: "Đang xử lý",
    },
    {
      label: "Chờ xác nhận",
      count: pending,
      pct: total > 0 ? `${Math.round((pending / total) * 100)}%` : "0%",
      trendColor: colors.warning,
      trendLabel: pending > 3 ? "Tồn đọng" : "Ít",
    },
    {
      label: "Thất bại / Hủy",
      count: failed,
      pct: total > 0 ? `${Math.round((failed / total) * 100)}%` : "0%",
      trendColor: colors.danger,
      trendLabel: failed > 0 ? "Cần xem xét" : "Không có",
    },
  ];

  breakdownItems.forEach((item, idx) => {
    const rowNum = idx + 5;
    const r = ws2.getRow(rowNum);
    const bg = idx % 2 === 0 ? colors.rowEven : colors.rowOdd;

    r.getCell(1).value = item.label;
    styleCell(r.getCell(1), { bold: true, color: colors.bodyText, fill: bg, align: "left", border: thinBorder });

    const ctCell = r.getCell(2);
    ctCell.value = item.count;
    styleCell(ctCell, { bold: true, color: colors.primary, fill: bg, fontSize: 13, align: "center", border: thinBorder });

    r.getCell(3).value = item.pct;
    styleCell(r.getCell(3), { color: item.trendColor, fill: bg, fontSize: 12, align: "center", border: thinBorder });

    r.getCell(4).value = item.trendLabel;
    styleCell(r.getCell(4), { color: item.trendColor, fill: bg, align: "center", border: thinBorder });

    r.height = 26;
  });

  // Total row
  const totalRow = ws2.getRow(9);
  totalRow.getCell(1).value = "TỔNG CỘNG";
  styleCell(totalRow.getCell(1), { bold: true, color: colors.headerText, fill: colors.primaryDark, fontSize: 12, align: "left", border: mediumBorder });

  totalRow.getCell(2).value = total;
  styleCell(totalRow.getCell(2), { bold: true, color: colors.headerText, fill: colors.primaryDark, fontSize: 14, align: "center", border: mediumBorder });

  totalRow.getCell(3).value = "100%";
  styleCell(totalRow.getCell(3), { bold: true, color: colors.headerText, fill: colors.primaryDark, fontSize: 12, align: "center", border: mediumBorder });

  totalRow.getCell(4).value = "—";
  styleCell(totalRow.getCell(4), { bold: true, color: colors.headerText, fill: colors.primaryDark, align: "center", border: mediumBorder });

  totalRow.height = 30;

  ws2.getColumn(1).width = 28;
  ws2.getColumn(2).width = 16;
  ws2.getColumn(3).width = 14;
  ws2.getColumn(4).width = 22;

  // ═══════════════════════════════════════════════════════════════
  //  SHEET 3 — Kho hàng & Tồn kho
  // ═══════════════════════════════════════════════════════════════

  const ws3 = wb.addWorksheet("Kho hàng & Tồn kho", {
    pageSetup: { orientation: "portrait", fitToPage: true },
  });

  // Title
  ws3.mergeCells(1, 1, 1, 4);
  const title3 = ws3.getCell("A1");
  title3.value = "TÌNH HÌNH KHO HÀNG & TỒN KHO";
  styleCell(title3, { bold: true, color: colors.headerText, fill: colors.accent, fontSize: 16, align: "center", border: thinBorder });
  ws3.getRow(1).height = 38;

  ws3.mergeCells(2, 1, 2, 4);
  const sub3 = ws3.getCell("A2");
  sub3.value = `Tổng quan về kho bãi và hàng tồn`;
  styleCell(sub3, { color: colors.mutedText, fill: colors.subtitleBg, fontSize: 10, align: "center", border: thinBorder });
  ws3.getRow(2).height = 26;

  const whHeaders = ["Chỉ số", "Giá trị", "Trạng thái", "Mức độ ưu tiên"];
  const hdr3 = ws3.getRow(4);
  whHeaders.forEach((h, i) => {
    const cell = hdr3.getCell(i + 1);
    cell.value = h;
    styleCell(cell, { bold: true, color: colors.headerText, fill: colors.accentDark, fontSize: 11, align: "center", border: mediumBorder });
  });
  hdr3.height = 26;

  const warehouseRows: {
    label: string;
    value: number | string;
    status: { text: string; color: typeof colors.success | typeof colors.warning | typeof colors.danger | typeof colors.bodyText };
    priorityLabel: string;
  }[] = [
    {
      label: "Kho đang hoạt động",
      value: warehouseCount,
      status: warehouseCount > 0
        ? { text: "Hoạt động", color: colors.success }
        : { text: "Chưa có dữ liệu", color: colors.warning },
      priorityLabel: warehouseCount > 0 ? "Thấp" : "Trung bình",
    },
    {
      label: "Mặt hàng trong kho",
      value: inventoryCount,
      status: inventoryCount > 0
        ? { text: "Có hàng", color: colors.success }
        : { text: "Chưa có dữ liệu", color: colors.warning },
      priorityLabel: inventoryCount > 0 ? "—" : "Trung bình",
    },
    {
      label: "Cảnh báo tồn kho",
      value: alertsCount,
      status: alertsCount === 0
        ? { text: "An toàn", color: colors.success }
        : alertsCount <= 3
          ? { text: `${alertsCount} cảnh báo nhẹ`, color: colors.warning }
          : { text: `${alertsCount} cảnh báo nghiêm trọng`, color: colors.danger },
      priorityLabel: alertsCount === 0 ? "—" : alertsCount <= 3 ? "Cao" : "Ngay lập tức",
    },
  ];

  warehouseRows.forEach((row, idx) => {
    const rowNum = idx + 5;
    const r = ws3.getRow(rowNum);
    const bg = idx % 2 === 0 ? colors.rowEven : colors.rowOdd;

    r.getCell(1).value = row.label;
    styleCell(r.getCell(1), { bold: true, color: colors.bodyText, fill: bg, align: "left", border: thinBorder });

    const vCell = r.getCell(2);
    vCell.value = row.value;
    styleCell(vCell, { bold: true, color: colors.primary, fill: bg, fontSize: 14, align: "center", border: thinBorder });

    r.getCell(3).value = row.status.text;
    styleCell(r.getCell(3), { color: row.status.color, fill: bg, align: "center", border: thinBorder });

    r.getCell(4).value = row.priorityLabel;
    styleCell(r.getCell(4), { color: colors.mutedText, fill: bg, align: "center", border: thinBorder });

    r.height = 28;
  });

  // Summary row for warehouse
  const whSummaryRow = ws3.getRow(8);
  whSummaryRow.getCell(1).value = "ĐÁNH GIÁ TỔNG THỂ";
  styleCell(whSummaryRow.getCell(1), { bold: true, color: colors.headerText, fill: colors.primaryDark, fontSize: 11, align: "left", border: mediumBorder });

  const overallStatus =
    alertsCount === 0 && warehouseCount > 0
      ? "Hệ thống kho vận hành ổn định"
      : alertsCount <= 3
        ? "Cần theo dõi cảnh báo"
        : "Cần can thiệp khẩn cấp";
  ws3.mergeCells(8, 2, 8, 4);
  const ovCell = whSummaryRow.getCell(2);
  ovCell.value = overallStatus;
  styleCell(ovCell, {
    bold: true,
    color: alertsCount === 0 ? colors.success : alertsCount <= 3 ? colors.warning : colors.danger,
    fill: colors.primaryDark,
    fontSize: 12,
    align: "center",
    border: mediumBorder,
  });
  whSummaryRow.height = 30;

  ws3.getColumn(1).width = 30;
  ws3.getColumn(2).width = 18;
  ws3.getColumn(3).width = 30;
  ws3.getColumn(4).width = 20;

  // ═══════════════════════════════════════════════════════════════
  //  WRITE FILE
  // ═══════════════════════════════════════════════════════════════

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `LogistiQ_PhanTich_${Date.now()}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
