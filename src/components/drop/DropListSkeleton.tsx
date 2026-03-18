import { Skeleton } from "../ui/Skeleton";

export function DropListSkeleton() {
  return (
    <div className="flex flex-col gap-0.5">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="py-2 flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <Skeleton class="h-3.5 w-24" />
            <Skeleton class="h-3 w-16" />
            <div className="ml-auto flex items-center gap-1">
              <Skeleton class="h-5 w-5 rounded" />
              <Skeleton class="h-5 w-5 rounded" />
              <Skeleton class="h-4 w-7 rounded-full" />
            </div>
          </div>
          <div className="flex gap-3">
            <Skeleton class="h-3 w-12" />
            <Skeleton class="h-3 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}
