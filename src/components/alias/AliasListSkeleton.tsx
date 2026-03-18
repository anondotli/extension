import { Skeleton } from "../ui/Skeleton";

export function AliasListSkeleton() {
  return (
    <div className="flex flex-col gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="py-2 flex items-center gap-2">
          <Skeleton class="h-3.5 flex-1 max-w-[180px]" />
          <Skeleton class="h-3 w-16" />
          <div className="ml-auto flex items-center gap-1">
            <Skeleton class="h-4 w-7 rounded-full" />
            <Skeleton class="h-5 w-5 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
