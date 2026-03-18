import { clsx } from "./clsx";

interface SkeletonProps {
  class?: string;
}

export function Skeleton({ class: className }: SkeletonProps) {
  return (
    <div
      class={clsx(
        "animate-pulse rounded-md bg-muted",
        className
      )}
    />
  );
}
