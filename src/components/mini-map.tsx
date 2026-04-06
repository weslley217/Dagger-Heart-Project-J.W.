"use client";

import { useCallback, useRef, useState } from "react";
import {
  CircleDot,
  Leaf,
  MapPin,
  Minus,
  Music,
  Pentagon,
  RectangleHorizontal,
  Shield,
  Slash,
  Sparkles,
  Star,
  Sword,
  Trash2,
  Zap,
} from "lucide-react";

export type MapToken = {
  id: string;
  type: "player" | "npc";
  entity_id: string;
  name: string;
  x: number; // 0..1 fraction of map width
  y: number; // 0..1 fraction of map height
  color: string;
  classKey?: string;
  visible?: boolean; // only relevant for npcs
};

export type MapShape = {
  id: string;
  kind: "rect" | "circle" | "line";
  x1: number; // 0..1
  y1: number;
  x2: number;
  y2: number;
  color: string;
  label?: string;
};

type DrawTool = "select" | "rect" | "circle" | "line";

type Props = {
  tokens: MapToken[];
  shapes?: MapShape[];
  readonly?: boolean;
  onTokenMove?: (id: string, x: number, y: number) => void;
  onTokenRemove?: (id: string) => void;
  onShapesChange?: (shapes: MapShape[]) => void;
};

// Map class key → Lucide icon component
const CLASS_ICONS: Record<string, React.ElementType> = {
  bard: Music,
  druid: Leaf,
  guardian: Shield,
  ranger: CircleDot,
  rogue: Zap,
  seraph: Star,
  sorcerer: Sparkles,
  warrior: Sword,
  wizard: Pentagon,
};

const SHAPE_COLORS = ["#f97316", "#3b82f6", "#22c55e", "#a855f7", "#ef4444", "#eab308"];

function ClassIcon({ classKey, size = 14 }: { classKey?: string; size?: number }) {
  const key = (classKey ?? "").toLowerCase();
  const Icon = CLASS_ICONS[key];
  if (!Icon) return null;
  return <Icon style={{ width: size, height: size }} />;
}

export function MiniMap({
  tokens,
  shapes = [],
  readonly = false,
  onTokenMove,
  onTokenRemove,
  onShapesChange,
}: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [drawTool, setDrawTool] = useState<DrawTool>("select");
  const [drawColor, setDrawColor] = useState(SHAPE_COLORS[0]!);
  const [drawing, setDrawing] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const drawingRef = useRef<{ x1: number; y1: number } | null>(null);

  // ── Token dragging ──────────────────────────────────────────
  const handleMouseDown = useCallback(
    (e: React.MouseEvent, tokenId: string) => {
      if (readonly || drawTool !== "select") return;
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
    [readonly, drawTool, onTokenMove],
  );

  const handleTouchStart = useCallback(
    (e: React.TouchEvent, tokenId: string) => {
      if (readonly || drawTool !== "select") return;
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
    [readonly, drawTool, onTokenMove],
  );

  // ── Shape drawing ───────────────────────────────────────────
  function toFraction(clientX: number, clientY: number): { x: number; y: number } {
    const map = mapRef.current;
    if (!map) return { x: 0, y: 0 };
    const rect = map.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
    };
  }

  function handleMapMouseDown(e: React.MouseEvent) {
    if (readonly || drawTool === "select") return;
    e.preventDefault();
    const { x, y } = toFraction(e.clientX, e.clientY);
    drawingRef.current = { x1: x, y1: y };
    setDrawing({ x1: x, y1: y, x2: x, y2: y });

    function onMove(ev: MouseEvent) {
      if (!drawingRef.current) return;
      const { x: x2, y: y2 } = toFraction(ev.clientX, ev.clientY);
      setDrawing({ ...drawingRef.current, x2, y2 });
    }

    function onUp(ev: MouseEvent) {
      if (!drawingRef.current) return;
      const { x: x2, y: y2 } = toFraction(ev.clientX, ev.clientY);
      const { x1, y1 } = drawingRef.current;
      // Only save if there's a meaningful size
      if (Math.abs(x2 - x1) > 0.01 || Math.abs(y2 - y1) > 0.01) {
        const shape: MapShape = {
          id: crypto.randomUUID(),
          kind: drawTool as "rect" | "circle" | "line",
          x1, y1, x2, y2,
          color: drawColor,
        };
        onShapesChange?.([...shapes, shape]);
      }
      drawingRef.current = null;
      setDrawing(null);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function removeShape(id: string) {
    onShapesChange?.(shapes.filter((s) => s.id !== id));
  }

  function renderShape(s: MapShape, preview?: boolean) {
    const key = preview ? "preview" : s.id;
    const { x1, y1, x2, y2 } = s;
    const rx = Math.min(x1, x2), ry = Math.min(y1, y2);
    const rw = Math.abs(x2 - x1), rh = Math.abs(y2 - y1);
    const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
    const opacity = preview ? 0.6 : 0.45;

    if (s.kind === "rect") {
      return (
        <rect
          key={key}
          x={`${rx * 100}%`} y={`${ry * 100}%`}
          width={`${rw * 100}%`} height={`${rh * 100}%`}
          fill={s.color} fillOpacity={opacity}
          stroke={s.color} strokeWidth={2} strokeOpacity={0.8}
          rx={4}
        />
      );
    }
    if (s.kind === "circle") {
      return (
        <ellipse
          key={key}
          cx={`${cx * 100}%`} cy={`${cy * 100}%`}
          rx={`${(rw / 2) * 100}%`} ry={`${(rh / 2) * 100}%`}
          fill={s.color} fillOpacity={opacity}
          stroke={s.color} strokeWidth={2} strokeOpacity={0.8}
        />
      );
    }
    if (s.kind === "line") {
      return (
        <line
          key={key}
          x1={`${x1 * 100}%`} y1={`${y1 * 100}%`}
          x2={`${x2 * 100}%`} y2={`${y2 * 100}%`}
          stroke={s.color} strokeWidth={3} strokeOpacity={0.9}
          strokeLinecap="round"
        />
      );
    }
    return null;
  }

  const TOOLS: { id: DrawTool; label: string; Icon: React.ElementType }[] = [
    { id: "select", label: "Mover tokens", Icon: MapPin },
    { id: "rect", label: "Retângulo", Icon: RectangleHorizontal },
    { id: "circle", label: "Círculo/Elipse", Icon: CircleDot },
    { id: "line", label: "Linha", Icon: Minus },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <MapPin className="h-4 w-4 text-[var(--accent)]" />
        <p className="text-sm font-semibold text-white">Minimapa da cena</p>
        {!readonly && (
          <span className="text-xs text-white/40">
            {drawTool === "select" ? "Arraste os tokens para reposicioná-los" : "Clique e arraste para desenhar"}
          </span>
        )}
      </div>

      {/* Drawing toolbar — master only */}
      {!readonly && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-xl border border-white/10 bg-black/20 p-1">
            {TOOLS.map(({ id, label, Icon }) => (
              <button
                key={id}
                title={label}
                onClick={() => setDrawTool(id)}
                className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${
                  drawTool === id
                    ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                    : "text-white/50 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>

          {drawTool !== "select" && (
            <div className="flex gap-1 rounded-xl border border-white/10 bg-black/20 p-1">
              {SHAPE_COLORS.map((c) => (
                <button
                  key={c}
                  title={c}
                  onClick={() => setDrawColor(c)}
                  className={`h-5 w-5 rounded-full transition-transform ${drawColor === c ? "scale-125 ring-2 ring-white/50" : "hover:scale-110"}`}
                  style={{ background: c }}
                />
              ))}
            </div>
          )}

          {shapes.length > 0 && (
            <button
              title="Limpar desenhos"
              onClick={() => onShapesChange?.([])}
              className="flex items-center gap-1 rounded-xl border border-rose-500/20 bg-rose-500/10 px-2 py-1 text-xs text-rose-400 hover:bg-rose-500/20 transition-colors"
            >
              <Slash className="h-3 w-3" /> Limpar
            </button>
          )}
        </div>
      )}

      {/* Map area */}
      <div
        ref={mapRef}
        className={`relative h-64 w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0c1120] ${
          !readonly && drawTool !== "select" ? "cursor-crosshair" : ""
        }`}
        style={{
          backgroundImage: `
            radial-gradient(circle at 30% 40%, rgba(139,92,246,0.08) 0%, transparent 50%),
            radial-gradient(circle at 70% 60%, rgba(59,130,246,0.06) 0%, transparent 50%),
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
          `,
          backgroundSize: "auto, auto, 24px 24px, 24px 24px",
        }}
        onMouseDown={handleMapMouseDown}
      >
        {tokens.length === 0 && shapes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-xs text-white/20">Nenhum token adicionado</p>
          </div>
        )}

        {/* Shapes SVG overlay */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full" style={{ zIndex: 5 }}>
          {shapes.map((s) => renderShape(s))}
          {drawing && drawTool !== "select" && renderShape({ ...drawing, id: "preview", kind: drawTool, color: drawColor })}
        </svg>

        {/* Tokens */}
        {tokens.map((token) => {
          const hasClassIcon = token.type === "player" && !!CLASS_ICONS[(token.classKey ?? "").toLowerCase()];
          return (
            <div
              key={token.id}
              className={`group absolute flex items-center justify-center rounded-full text-xs font-bold text-white shadow-lg transition-transform ${
                dragging === token.id
                  ? "scale-125 cursor-grabbing"
                  : readonly || drawTool !== "select"
                  ? "cursor-default"
                  : "cursor-grab hover:scale-110"
              }`}
              style={{
                left: `${token.x * 100}%`,
                top: `${token.y * 100}%`,
                transform: "translate(-50%, -50%)",
                width: 34,
                height: 34,
                background: token.color,
                boxShadow: `0 0 10px ${token.color}88`,
                zIndex: dragging === token.id ? 50 : 10,
              }}
              title={token.name}
              onMouseDown={(e) => handleMouseDown(e, token.id)}
              onTouchStart={(e) => handleTouchStart(e, token.id)}
            >
              {hasClassIcon ? (
                <ClassIcon classKey={token.classKey} size={16} />
              ) : (
                <span className="text-sm font-bold leading-none">
                  {token.name.charAt(0).toUpperCase()}
                </span>
              )}

              {/* NPC type ring */}
              {token.type === "npc" && (
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#0c1120] bg-rose-500" />
              )}

              {/* Tooltip */}
              <span className="pointer-events-none absolute -top-8 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-black/90 px-1.5 py-0.5 text-[10px] text-white group-hover:flex">
                {token.name}
                {token.classKey ? ` · ${token.classKey}` : ""}
              </span>

              {/* Remove button (master only) */}
              {!readonly && onTokenRemove && drawTool === "select" && (
                <button
                  className="absolute -right-1 -top-1 hidden h-3.5 w-3.5 items-center justify-center rounded-full bg-rose-600 group-hover:flex"
                  onMouseDown={(e) => { e.stopPropagation(); onTokenRemove(token.id); }}
                  title="Remover token"
                >
                  <Trash2 className="h-2 w-2 text-white" />
                </button>
              )}
            </div>
          );
        })}

        {/* Drawn shape remove buttons */}
        {!readonly && shapes.map((s) => (
          <button
            key={`rm-${s.id}`}
            className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white/60 hover:bg-rose-600 hover:text-white transition-colors hidden group-hover:flex"
            style={{
              left: `${((s.x1 + s.x2) / 2) * 100}%`,
              top: `${((s.y1 + s.y2) / 2) * 100}%`,
              zIndex: 20,
              display: "flex",
            }}
            onMouseDown={(e) => { e.stopPropagation(); removeShape(s.id); }}
            title="Remover forma"
          >
            <Trash2 className="h-2 w-2" />
          </button>
        ))}
      </div>

      {/* Legend */}
      {tokens.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tokens.map((token) => (
            <div key={token.id} className="flex items-center gap-1.5">
              <div
                className="flex h-4 w-4 items-center justify-center rounded-full"
                style={{ background: token.color }}
              >
                <ClassIcon classKey={token.classKey} size={9} />
              </div>
              <span className="text-[10px] text-white/50">{token.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
