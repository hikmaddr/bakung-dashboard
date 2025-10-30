"use client";

import { useEffect, useRef, useState } from "react";

type PdfViewerProps = {
  url: string;
  scale?: number;
  className?: string;
};

let pdfjsLibPromise: Promise<typeof import("pdfjs-dist/build/pdf")> | null = null;

const loadPdfJs = () => {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import("pdfjs-dist/build/pdf");
  }
  return pdfjsLibPromise;
};

export default function PdfViewer({ url, scale = 1, className }: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let loadingTask:
      | import("pdfjs-dist/types/web/interfaces").PDFDocumentLoadingTask
      | null = null;

    const renderPdf = async () => {
      try {
        const container = containerRef.current;
        if (!container) {
          return;
        }
        container.innerHTML = "";
        setError(null);
        setLoading(true);

        const { getDocument, GlobalWorkerOptions } = await loadPdfJs();

        if (typeof window !== "undefined") {
          GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";
        }

        loadingTask = getDocument({ url, withCredentials: true });
        const pdf = await loadingTask.promise;
        if (cancelled) return;

        const fragment = document.createDocumentFragment();

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
          const page = await pdf.getPage(pageNumber);
          if (cancelled) return;

          const viewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          canvas.className = "block w-full mb-2 bg-white";
          const context = canvas.getContext("2d");
          if (!context) continue;

          const dpr = window.devicePixelRatio || 1;
          canvas.width = Math.floor(viewport.width * dpr);
          canvas.height = Math.floor(viewport.height * dpr);
          canvas.style.width = `${viewport.width}px`;
          canvas.style.height = `${viewport.height}px`;

          const renderViewport = page.getViewport({ scale: scale * dpr });
          await page.render({ canvasContext: context, viewport: renderViewport }).promise;
          fragment.appendChild(canvas);
        }

        container.appendChild(fragment);
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message ?? "Gagal memuat PDF");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    renderPdf();

    return () => {
      cancelled = true;
      if (loadingTask) {
        try {
          loadingTask.destroy();
        } catch {
          // ignore cleanup error
        }
      }
    };
  }, [url, scale]);

  return (
    <div className={className} style={{ overflow: "auto" }}>
      <div ref={containerRef} className="p-0" />
      {loading && (
        <div className="py-6 text-center text-sm text-gray-500">Memuat PDF...</div>
      )}
      {error && (
        <div className="py-6 text-center text-sm text-red-600">{error}</div>
      )}
    </div>
  );
}

