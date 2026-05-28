export default function WarehouseDetailLoading() {
  return (
    <div className="space-y-6 animate-pulse p-6">
      <div className="skeleton h-10 w-48 rounded-xl" />
      <div className="skeleton h-64 rounded-2xl" />
      <div className="skeleton h-96 rounded-2xl" />
    </div>
  );
}
