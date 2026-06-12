"use client";

import { useReportWebVitals } from "next/web-vitals";

type VitalsMetric = {
  id: string;
  name: string;
  label: "web-vital" | "custom";
  value: number;
  rating?: string;
  delta?: number;
  entries?: PerformanceEntry[];
};

// ─── Config ───────────────────────────────────────────────────────────
const SEND_TO_CONSOLE = process.env.NODE_ENV === "development";
const SEND_TO_ANALYTICS = false; // Set to true and implement sendToAnalytics() when ready

// ─── Metric label mapping ─────────────────────────────────────────────
const METRIC_LABELS: Record<string, string> = {
  LCP: "Largest Contentful Paint",
  CLS: "Cumulative Layout Shift",
  FID: "First Input Delay",
  INP: "Interaction to Next Paint",
  TTFB: "Time to First Byte",
  FCP: "First Contentful Paint",
};

// ─── Format helpers ───────────────────────────────────────────────────

function formatValue(metric: VitalsMetric): string {
  switch (metric.name) {
    case "CLS":
      return metric.value.toFixed(3);
    case "LCP":
    case "FCP":
    case "TTFB":
    case "FID":
    case "INP":
    default:
      return `${Math.round(metric.value)} ms`;
  }
}

function getRating(metric: VitalsMetric) {
  const v = metric.value;
  switch (metric.name) {
    case "LCP":
      if (v <= 2500) return "good";
      if (v <= 4000) return "needs-improvement";
      return "poor";
    case "FID":
    case "INP":
      if (v <= 100) return "good";
      if (v <= 300) return "needs-improvement";
      return "poor";
    case "CLS":
      if (v <= 0.1) return "good";
      if (v <= 0.25) return "needs-improvement";
      return "poor";
    case "TTFB":
      if (v <= 800) return "good";
      if (v <= 1800) return "needs-improvement";
      return "poor";
    case "FCP":
      if (v <= 1800) return "good";
      if (v <= 3000) return "needs-improvement";
      return "poor";
    default:
      return "unknown";
  }
}

function getRatingLabel(rating: string): string {
  switch (rating) {
    case "good": return "GOOD";
    case "needs-improvement": return "NEEDS_IMPROVEMENT";
    case "poor": return "POOR";
    default: return "UNKNOWN";
  }
}

// ─── Send metric to analytics endpoint ────────────────────────────────

async function sendToAnalytics(metric: VitalsMetric) {
  // Example: POST to your own analytics endpoint
  // Customize this when you have an analytics backend
  try {
    await fetch("/api/vitals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: metric.id,
        name: metric.name,
        label: metric.label,
        value: metric.value,
        rating: getRating(metric),
        page: window.location.pathname,
        timestamp: Date.now(),
      }),
      // Fire-and-forget: keep-alive ensures the request completes
      keepalive: true,
    });
  } catch {
    // Silently fail — vitals reporting should never block the page
  }
}

// ─── Component ────────────────────────────────────────────────────────

/**
 * WebVitals — monitors Core Web Vitals and reports them.
 *
 * Uses `useReportWebVitals` from `next/web-vitals` under the hood.
 * 
 * In development: logs to console with color-coded rating emoji.
 * In production: can send to /api/vitals endpoint (enable SEND_TO_ANALYTICS).
 *
 * Usage: Add <WebVitals /> to your root layout.
 * This component renders nothing (null) to the DOM.
 */
export function WebVitals() {
  useReportWebVitals((metric: VitalsMetric) => {
    const rating = getRating(metric);
    const label = METRIC_LABELS[metric.name] || metric.name;
    const formatted = formatValue(metric);

    // Console logging (development only)
    if (SEND_TO_CONSOLE) {
      const ratingLabel = getRatingLabel(rating);
      const style = rating === "good"
        ? "color: #10b981; font-weight: bold"
        : rating === "needs-improvement"
        ? "color: #f97316; font-weight: bold"
        : "color: #ef4444; font-weight: bold";

      console.log(
        `%c ${label}: ${formatted} [${ratingLabel}]`,
        style,
        `(id: ${metric.id})`
      );
    }

    // Send to analytics (production only)
    if (SEND_TO_ANALYTICS) {
      sendToAnalytics(metric);
    }
  });

  // This component renders nothing — it's only for the side effect
  return null;
}
