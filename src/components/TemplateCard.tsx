"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Star, Sparkles } from "lucide-react";
import { Template, documentTypeLabels } from "@/lib/templates";

interface TemplateCardProps {
  template: Template;
  isSelected?: boolean;
  onPreview: (template: Template) => void;
  onSelect: (template: Template) => void;
}

export default function TemplateCard({
  template,
  isSelected = false,
  onPreview,
  onSelect
}: TemplateCardProps) {
  return (
    <Card className={`group relative overflow-hidden transition-all duration-300 hover:shadow-xl border-2 ${
      isSelected
        ? 'border-blue-500 shadow-lg shadow-blue-100 bg-gradient-to-br from-blue-50 to-white'
        : 'border-gray-200 hover:border-gray-300'
    }`}>
      {/* Selected indicator */}
      {isSelected && (
        <div className="absolute top-3 right-3 z-10">
          <div className="flex items-center gap-1 px-2 py-1 bg-blue-500 text-white text-xs font-medium rounded-full">
            <Star className="h-3 w-3 fill-current" />
            Selected
          </div>
        </div>
      )}

      {/* Badges */}
      <div className="absolute top-3 left-3 z-10 flex gap-1">
        {template.isPopular && (
          <Badge variant="secondary" className="bg-orange-100 text-orange-700 text-xs">
            <Star className="h-3 w-3 mr-1" />
            Popular
          </Badge>
        )}
        {template.isNew && (
          <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs">
            <Sparkles className="h-3 w-3 mr-1" />
            New
          </Badge>
        )}
      </div>

      <CardContent className="p-0">
        {/* Thumbnail */}
        <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
          <div
            className="w-full h-full flex items-center justify-center text-white font-bold text-lg"
            style={{ backgroundColor: template.primaryColor }}
          >
            {template.name}
          </div>
          {/* Overlay on hover */}
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onPreview(template)}
              className="gap-1"
            >
              <Eye className="h-4 w-4" />
              Preview
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          <div>
            <h3 className="font-semibold text-gray-900 truncate">{template.name}</h3>
            <p className="text-sm text-gray-600 line-clamp-2 mt-1">
              {template.description}
            </p>
          </div>

          {/* Type badge */}
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="text-xs">
              {documentTypeLabels[template.type]}
            </Badge>
            <div
              className="w-4 h-4 rounded border border-gray-300"
              style={{ backgroundColor: template.primaryColor }}
              title={`Primary: ${template.primaryColor}`}
            />
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPreview(template)}
              className="flex-1 text-xs"
            >
              <Eye className="h-3 w-3 mr-1" />
              Preview
            </Button>
            <Button
              size="sm"
              onClick={() => onSelect(template)}
              className={`flex-1 text-xs ${
                isSelected
                  ? 'bg-blue-500 hover:bg-blue-600 text-white'
                  : 'bg-gray-900 hover:bg-gray-800 text-white'
              }`}
            >
              {isSelected ? 'Selected' : 'Select'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
