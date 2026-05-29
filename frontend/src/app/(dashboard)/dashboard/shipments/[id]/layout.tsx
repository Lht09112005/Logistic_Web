import type { Metadata } from "next";
import { ssrFetch } from "@/lib/server-api";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const shipment = await ssrFetch(`/shipments/${id}`);

  if (!shipment) {
    return { title: "Vận đơn không tồn tại" };
  }

  const s = shipment as any;
  const shipmentCode = s.shipmentCode || id;
  const status = s.status || "";
  const origin = s.originAddress || "";
  const destination = s.destinationAddress || "";

  const statusLabels: Record<string, string> = {
    PENDING: "Chờ xác nhận",
    CONFIRMED: "Đã xác nhận",
    LOADING: "Đang xếp hàng",
    IN_TRANSIT: "Đang vận chuyển",
    AT_CHECKPOINT: "Tại trạm kiểm soát",
    DELIVERING: "Đang giao hàng",
    DELIVERED: "Đã giao hàng",
    CANCELLED: "Đã hủy",
    FAILED: "Thất bại",
  };

  return {
    title: `Vận đơn ${shipmentCode}`,
    description: `Chi tiết vận đơn ${shipmentCode} — ${statusLabels[status] || status}. Lộ trình: ${origin} → ${destination}. Theo dõi GPS realtime, trạm kiểm soát, hàng hóa.`,
    openGraph: {
      title: `Vận đơn ${shipmentCode} | LogistiQ`,
      description: `Theo dõi lộ trình vận chuyển từ ${origin} đến ${destination}. Trạng thái: ${statusLabels[status] || status}.`,
    },
  };
}

export default function ShipmentDetailLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
