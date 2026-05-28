export default function WarehouseLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="skeleton h-10 w-48 rounded-xl" />
      <div className="skeleton h-14 rounded-xl" />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-64 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
