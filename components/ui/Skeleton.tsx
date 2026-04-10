export function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-neutral-800 rounded ${className ?? ""}`} />;
}

export function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr style={{ height: "44px" }}>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-3 py-2">
          <Skeleton className="h-3 w-full" />
        </td>
      ))}
    </tr>
  );
}
