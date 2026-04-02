import { Heart, Shield, Sparkles, Star } from "lucide-react";

import { cn } from "@/lib/utils";

type IconTrackProps = {
  label: string;
  total: number;
  filled: number;
  icon: "heart" | "shield" | "star" | "sparkles";
  helper?: string;
};

const icons = {
  heart: Heart,
  shield: Shield,
  star: Star,
  sparkles: Sparkles,
};

const tones = {
  heart: "text-rose-400",
  shield: "text-amber-300",
  star: "text-sky-300",
  sparkles: "text-emerald-300",
};

export function IconTrack({
  label,
  total,
  filled,
  icon,
  helper,
}: IconTrackProps) {
  const Icon = icons[icon];
  const amount = Array.from({ length: total });

  return (
    <div className="space-y-2 rounded-3xl border border-white/8 bg-black/15 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-white">{label}</p>
        <p className="text-xs uppercase tracking-[0.24em] text-white/45">
          {filled}/{total}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {amount.map((_, index) => (
          <span
            key={`${label}-${index}`}
            className={cn(
              "inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-white/8 bg-black/20 transition",
              index < filled ? tones[icon] : "text-white/20",
            )}
          >
            <Icon className="h-4 w-4" />
          </span>
        ))}
      </div>
      {helper ? <p className="text-xs text-white/55">{helper}</p> : null}
    </div>
  );
}
