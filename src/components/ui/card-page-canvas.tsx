"use client";

import { useEffect, useRef, useState } from "react";

// Module-level PDF document cache so the same file isn't re-fetched for every card.
const pdfCache = new Map<string, Promise<import("pdfjs-dist").PDFDocumentProxy>>();

type Props = {
  sourcePdfKey: string;
  sourcePage: number;
  className?: string;
};

export function CardPageCanvas({ sourcePdfKey, sourcePage, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

        const url = `/api/files/${sourcePdfKey}`;

        if (!pdfCache.has(url)) {
          pdfCache.set(url, pdfjsLib.getDocument(url).promise);
        }

        const pdf = await pdfCache.get(url)!;
        if (cancelled) return;

        const page = await pdf.getPage(Math.max(1, sourcePage ?? 1));
        if (cancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const viewport = page.getViewport({ scale: 1.8 });
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({ canvas, canvasContext: ctx, viewport }).promise;
        if (!cancelled) setLoading(false);
      } catch {
        if (!cancelled) {
          setFailed(true);
          setLoading(false);
        }
      }
    }

    setLoading(true);
    setFailed(false);
    render();

    return () => {
      cancelled = true;
    };
  }, [sourcePdfKey, sourcePage]);

  if (failed) return null;

  return (
    <div className={`relative overflow-hidden ${className ?? ""}`}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/30">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white/70" />
        </div>
      )}
      <canvas
        ref={canvasRef}
        className={`w-full rounded-xl transition-opacity duration-300 ${loading ? "opacity-0" : "opacity-100"}`}
      />
    </div>
  );
}
