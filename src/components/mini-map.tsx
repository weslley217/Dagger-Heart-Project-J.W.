"use client";

import { useCallback, useRef, useState } from "react";
import { MapPin, Trash2 } from "lucide-react";

export type MapToken = {
  id: string;
  type: "player" | "npc";
  entity_id: string;
  name: string;
  x: number; // 0..1 fraction of map width
  y: number; // 0..1 fraction of map height
  color: string;
  visible?: boolean; // only relevant for npcs
};

type Props = {
  tokens: MapToken[];
  readonly?: boolean;
  onTokenMove?: (id: string, x: number, y: number) => void;
  onTokenRemove?: (id: string) => void;
};

export function MiniMap({ tokens, readonly = false, onTokenMove, onTokenRemove }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, tokenId: string) => {
      if (readonly) return;
      e.preventDefault();
      setDragging(tokenId);

      function onMove(ev: MouseEvent) {
        const map = mapRef.current;
        if (!map) return;
        const rect = map.getBoundingClientRect();
        const x = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
        const y = Math.max(0, Math.min(1, (ev.clientY - rect.top) / rect.height));
        onTokenMove?.(tokenId, x, y);
      }

      function onUp() {
        setDragging(null);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      }

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [readonly, onTokenMove],
  );

  // Touch support
  const handleTouchStart = useCallback(
    (e: React.TouchEvent, tokenId: string) => {
      if (readonly) return;
      e.preventDefault();
      setDragging(tokenId);

      function onMove(ev: TouchEvent) {
        const map = mapRef.current;
        if (!map || !ev.touches[0]) return;
        const rect = map.getBoundingClientRect();
        const x = Math.max(0, Math.min(1, (ev.touches[0].clientX - rect.left) / rect.width));
        const y = Math.max(0, Math.min(1, (ev.touches[0].clientY - rect.top) / rect.height));
        onTokenMove?.(tokenId, x, y);
      }

      function onEnd() {
        setDragging(null);
        window.removeEventListener("touchmove", onMove);
        window.removeEventListener("touchend", onEnd);
      }

      window.addEventListener("touchmove", onMove, { passive: false });
      window.addEventListener("touchend", onEnd);
    },
    [readonly, onTokenMove],
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <MapPin className="h-4 w-4 text-[var(--accent)]" />
        <p className="text-sm font-semibold text-white">Minimapa da cena</p>
        {!readonly && (
          <span className="text-xs text-white/40">Arraste os tokens para reposicioná-los</span>
        )}
      </div>

      <div
        ref={mapRef}
        className="relative h-56 w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0c1120]"
        style={{
          backgroundImage: `
            radial-gradient(circle at 30% 40%, rgba(139,92,246,0.08) 0%, transparent 50%),
            radial-gradient(circle at 70% 60%, rgba(59,130,246,0.06) 0%, transparent 50%),
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
          `,
          backgroundSize: "auto, auto, 24px 24px, 24px 24px",
        }}
      >
        {tokens.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-xs text-white/20">Nenhum token adicionado</p>
          </div>
        )}

        {tokens.map((token) => (
          <div
            key={token.id}
            className={`group absolute flex items-center justify-center rounded-full text-xs font-bold text-white shadow-lg transition-transform ${
              dragging === token.id ? "scale-125 cursor-grabbing" : readonly ? "cursor-default" : "cursor-grab hover:scale-110"
            }`}
            style={{
              left: `${token.x * 100}%`,
              top: `${token.y * 100}%`,
              transform: "translate(-50%, -50%)",
              width: 32,
              height: 32,
              background: token.color,
              boxShadow: `0 0 10px ${token.color}66`,
              zIndex: dragging === token.id ? 50 : 10,
            }}
            title={token.name}
            onMouseDown={(e) => handleMouseDown(e, token.id)}
            onTouchStart={(e) => handleTouchStart(e, token.id)}
          >
            {token.name.charAt(0).toUpperCase()}

            {/* Tooltip */}
            <span className="pointer-events-none absolute -top-7 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-black/80 px-1.5 py-0.5 text-[10px] text-white group-hover:flex">
              {token.name}
            </span>

            {/* Remove button (master only) */}
            {!readonly && onTokenRemove && (
              <button
                className="absolute -right-1 -top-1 hidden h-3.5 w-3.5 items-center justify-center rounded-full bg-rose-600 group-hover:flex"
                onMouseDown={(e) => { e.stopPropagation(); onTokenRemove(token.id); }}
                title="Remover token"
              >
                <Trash2 className="h-2 w-2 text-white" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Legend */}
      {tokens.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tokens.map((token) => (
            <div key={token.id} className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded-full" style={{ background: token.color }} />
              <span className="text-[10px] text-white/50">{token.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
