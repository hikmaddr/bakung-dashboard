"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Eye, Trash2, Edit, CheckCircle2, AlertTriangle, FileText } from "lucide-react";
import { Template, documentTypeLabels, categoryLabels } from "@/lib/templates";

interface SVGTemplatePreviewProps {
  template: Template;
  onRemove?: (template: Template) => void;
  onEdit?: (template: Template) => void;
  onPreviewPdf?: (template: Template) => void;
  enableEditForBuiltIn?: boolean;
}

const defaultPrimary = "#2563EB";
const defaultSecondary = "#E0F2FE";

const hexToRgb = (hex?: string) => {
  if (!hex) return { r: 0, g: 0, b: 0 };
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return { r: 0, g: 0, b: 0 };
  return {
    r: parseInt(normalized.substring(0, 2), 16),
    g: parseInt(normalized.substring(2, 4), 16),
    b: parseInt(normalized.substring(4, 6), 16),
  };
};

const rgba = (hex: string, alpha = 1) => {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const lighten = (hex: string, amount = 0.2) => {
  const { r, g, b } = hexToRgb(hex);
  const mix = (channel: number) => Math.round(channel + (255 - channel) * amount);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
};

export default function SVGTemplatePreview({
  template,
  onRemove,
  onEdit,
  onPreviewPdf,
  enableEditForBuiltIn = false,
}: SVGTemplatePreviewProps) {
  const [svgContent, setSvgContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFullPreview, setShowFullPreview] = useState(false);

  useEffect(() => {
    if (template?.fileUrl) {
      fetch(template.fileUrl)
        .then((response) => {
          if (!response.ok) throw new Error("Failed to load SVG");
          return response.text();
        })
        .then((content) => {
          setSvgContent(content);
          setLoading(false);
        })
        .catch((err) => {
          setError(err.message);
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [template?.fileUrl]);

  const placeholders = useMemo(() => {
    if (!svgContent) return [];
    const regex = /\{\{([^}]+)\}\}/g;
    const result = new Set<string>();
    let match: RegExpExecArray | null;
    while ((match = regex.exec(svgContent)) !== null) {
      result.add(match[1]);
    }
    return Array.from(result);
  }, [svgContent]);

  const primary = template?.primaryColor || defaultPrimary;
  const secondary = template?.secondaryColor || defaultSecondary;

  const renderFallbackPreview = () => {
    const headerColor = rgba(primary, 0.85);
    const mutedLine = rgba(primary, 0.25);
    const zebra = rgba(secondary, 0.6);

    return (
      <div
        className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-br from-white via-white to-[rgba(255,255,255,0.7)]"
        style={{
          backgroundImage: `linear-gradient(135deg, ${lighten(primary, 0.65)} 0%, ${lighten(
            secondary,
            0.4
          )} 60%, ${lighten(primary, 0.85)} 100%)`,
        }}
      >
        <div className="absolute inset-0 bg-white/70 backdrop-blur-sm" />
        <div className="relative flex h-full w-full flex-col gap-3 p-4">
          <div className="space-y-2">
            <div className="h-3 w-1/2 rounded-full" style={{ backgroundColor: headerColor }} />
            <div className="h-2 w-1/3 rounded-full" style={{ backgroundColor: rgba(primary, 0.45) }} />
          </div>

          <div className="space-y-3 rounded-xl border border-white/60 bg-white/70 p-3 shadow-inner">
            <div className="h-2 w-5/6 rounded-full" style={{ backgroundColor: headerColor }} />
            <div className="space-y-2">
              <div className="h-2 rounded-full" style={{ backgroundColor: mutedLine }} />
              <div className="h-2 w-4/5 rounded-full" style={{ backgroundColor: mutedLine }} />
            </div>
            <div className="space-y-1 pt-2">
              {[...Array(4)].map((_, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5"
                  style={{ backgroundColor: idx % 2 === 0 ? zebra : "transparent" }}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: rgba(primary, 0.45) }} />
                  <div className="flex-1 space-y-1">
                    <div className="h-1.5 w-5/6 rounded-full" style={{ backgroundColor: rgba(primary, 0.2) }} />
                    <div className="h-1.5 w-2/3 rounded-full" style={{ backgroundColor: rgba(primary, 0.12) }} />
                  </div>
                  <div className="h-2 w-10 rounded-full" style={{ backgroundColor: rgba(primary, 0.3) }} />
                </div>
              ))}
            </div>
          </div>

          <div className="mt-auto flex justify-end">
            <div className="rounded-lg px-3 py-1 text-xs font-semibold text-white shadow"
              style={{ backgroundColor: headerColor }}>
              Total
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderPreview = () => {
    if (loading) {
      return (
        <div className="aspect-[3/4] w-full animate-pulse overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-br from-gray-100 to-gray-200" />
      );
    }

    if (error) {
      return (
        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl border border-red-200 bg-red-50">
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-red-600">
            <AlertTriangle className="h-6 w-6" />
            <p className="text-xs font-medium">Preview gagal dimuat</p>
          </div>
        </div>
      );
    }

    if (svgContent) {
      return (
        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <div
            className="absolute inset-0 flex items-center justify-center p-2"
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />
        </div>
      );
    }

    return renderFallbackPreview();
  };

  const showPreviewButton = Boolean(svgContent);
  const allowEdit = Boolean(onEdit) && (template.isUploaded || enableEditForBuiltIn);
  const allowRemove = Boolean(onRemove);

  const typeLabel = documentTypeLabels[template.type as keyof typeof documentTypeLabels] ?? template.type;
  const categoryLabel = categoryLabels[template.category as keyof typeof categoryLabels] ?? template.category;

  return (
    <>
      <Card className="flex h-full flex-col overflow-hidden border border-gray-200 shadow-sm transition hover:shadow-md">
        <div className="relative">
          {renderPreview()}

          <div className="absolute left-4 top-4">
            <Badge variant={template.isUploaded ? "secondary" : "outline"} className="bg-white/80 backdrop-blur">
              {template.isUploaded ? "Custom" : "Built-in"}
            </Badge>
          </div>

          <div className="absolute right-4 top-4 flex gap-2">
            {showPreviewButton && (
              <Button
                size="sm"
                variant="secondary"
                className="h-9 w-9 rounded-full border border-white/50 bg-white/80 p-0 text-indigo-600 shadow backdrop-blur hover:bg-white"
                onClick={() => setShowFullPreview(true)}
              >
                <Eye className="h-4 w-4" />
              </Button>
            )}
            {typeof onPreviewPdf === "function" && (
              <Button
                title="Preview PDF"
                size="sm"
                variant="secondary"
                className="h-9 w-9 rounded-full border border-white/50 bg-white/80 p-0 text-blue-700 shadow backdrop-blur hover:bg-white"
                onClick={() => onPreviewPdf?.(template)}
              >
                <FileText className="h-4 w-4" />
              </Button>
            )}
            {allowEdit && (
              <Button
                size="sm"
                variant="secondary"
                className="h-9 w-9 rounded-full border border-white/50 bg-white/80 p-0 text-blue-600 shadow backdrop-blur hover:bg-white"
                onClick={() => onEdit?.(template)}
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}
            {allowRemove && (
              <Button
                size="sm"
                variant="secondary"
                className="h-9 w-9 rounded-full border border-white/50 bg-white/80 p-0 text-red-600 shadow backdrop-blur hover:bg-white"
                onClick={() => onRemove?.(template)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <CardContent className="flex flex-1 flex-col gap-4 p-5">
          <div>
            <h3 className="text-base font-semibold text-gray-900">{template.name}</h3>
            {template.description && (
              <p className="mt-1 text-sm text-gray-500 line-clamp-2">{template.description}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
              {typeLabel}
            </Badge>
            <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700">
              {categoryLabel}
            </Badge>
          </div>

          <div className="mt-auto space-y-3 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-600">Data merge:</span>
              {placeholders.length > 0 ? (
                <span className="flex items-center gap-1 text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" />
                  {placeholders.length} placeholder
                </span>
              ) : (
                <span className="flex items-center gap-1 text-orange-600">
                  <AlertTriangle className="h-4 w-4" />
                  Sesuaikan otomatis saat generate
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-600">Warna dasar:</span>
              <div className="flex items-center gap-2">
                <span
                  className="h-4 w-4 rounded-full border border-white shadow"
                  style={{ backgroundColor: primary }}
                  title={`Primary ${primary}`}
                />
                <span
                  className="h-4 w-4 rounded-full border border-white shadow"
                  style={{ backgroundColor: secondary }}
                  title={`Secondary ${secondary}`}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {svgContent && (
        <Modal
          isOpen={showFullPreview}
          onClose={() => setShowFullPreview(false)}
          className="max-w-4xl max-h-[90vh] overflow-hidden"
        >
          <div className="flex flex-col gap-4 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">{template.name}</h2>
              <Button variant="outline" onClick={() => setShowFullPreview(false)}>
                Tutup
              </Button>
            </div>
            {template.description && (
              <p className="text-sm text-gray-500">{template.description}</p>
            )}
            <div
              className="max-h-[70vh] overflow-auto rounded-2xl border border-gray-200 bg-gray-50 p-4"
              dangerouslySetInnerHTML={{ __html: svgContent }}
            />
          </div>
        </Modal>
      )}
    </>
  );
}
