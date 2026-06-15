"use client"

import { useRouter } from "next/navigation"
import { X, Truck } from "lucide-react"
import { useEffect, useRef } from "react"

/**
 * Intercepting route: opens the new shipment form as a modal overlay
 * when navigated from /dashboard/shipments → /dashboard/shipments/new.
 *
 * Direct URL visit to /dashboard/shipments/new renders the full page instead.
 *
 * The `(.)` prefix means "intercept the `new` segment at the same URL level"
 * — a standard Next.js App Router pattern for intercepting routes.
 */
export default function NewShipmentModal() {
  const router = useRouter()
  const overlayRef = useRef<HTMLDivElement>(null)

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.back()
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [router])

  // Close on backdrop click
  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) router.back()
  }

  return (
    <div
      ref={overlayRef}
      onClick={handleBackdrop}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        className="relative w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-2xl shadow-2xl border"
        style={{
          background: "var(--bg-card)",
          borderColor: "var(--border-color)",
        }}
      >
        {/* Modal header */}
        <div
          className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b"
          style={{
            background: "var(--bg-card)",
            borderColor: "var(--border-color)",
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #f97316, #ea580c)" }}
            >
              <Truck size={18} color="white" />
            </div>
            <div>
              <h2
                className="text-lg font-bold"
                style={{
                  color: "var(--text-primary)",
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                }}
              >
                Tạo vận đơn mới
              </h2>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Điền thông tin để tạo vận đơn vận chuyển
              </p>
            </div>
          </div>
          <button
            onClick={() => router.back()}
            className="btn-icon w-8 h-8 rounded-lg"
            style={{ background: "var(--bg-input)" }}
            aria-label="Đóng"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal body: embed the full form in an iframe for reuse */}
        <div className="p-6">
          <iframe
            src="/dashboard/shipments/new"
            className="w-full border-0 rounded-xl"
            style={{ height: "calc(85vh - 100px)", minHeight: 480 }}
            title="Tạo vận đơn"
          />
        </div>
      </div>
    </div>
  )
}
