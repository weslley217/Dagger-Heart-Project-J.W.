import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function SurfaceCard({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.1),rgba(255,255,255,0.04))] p-5 shadow-[0_24px_50px_rgba(10,14,20,0.34)] backdrop-blur-xl",
        className,
      )}
      {...props}
    />
  );
}
