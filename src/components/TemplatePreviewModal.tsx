"use client";

import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Check, FileText, Palette } from "lucide-react";
import { Template, documentTypeLabels } from "@/lib/templates";

interface TemplatePreviewModalProps {
  template: Template | null;
  isOpen: boolean;
  onClose: () => void;
  onSelect: (template: Template) => void;
  isSelected?: boolean;
}

export default function TemplatePreviewModal({
  template,
  isOpen,
  onClose,
  onSelect,
  isSelected = false,
}: TemplatePreviewModalProps) {
  if (!template) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-4xl max-h-[90vh] overflow-hidden">
      <div className="flex flex-col h-full max-h-[90vh]">
        {/* Header */}
        <div className="flex-shrink-0 p-6 border-b bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-2xl font-bold text-gray-900">{template.name}</h2>
                {isSelected && (
                  <Badge className="bg-blue-100 text-blue-700">
                    <Check className="h-3 w-3 mr-1" />
                    Selected
                  </Badge>
                )}
              </div>
              <p className="text-gray-600 mb-3">{template.description}</p>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <FileText className="h-4 w-4" />
                  {documentTypeLabels[template.type]}
                </span>
                <span className="flex items-center gap-1">
                  <Palette className="h-4 w-4" />
                  <div className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded border border-gray-300"
                      style={{ backgroundColor: template.primaryColor }}
                      title={`Primary: ${template.primaryColor}`}
                    />
                    <div
                      className="w-4 h-4 rounded border border-gray-300"
                      style={{ backgroundColor: template.secondaryColor }}
                      title={`Secondary: ${template.secondaryColor}`}
                    />
                  </div>
                </span>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Template Preview */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-4">Template Preview</h3>
            <div className="border-2 rounded-lg overflow-hidden shadow-lg">
              <div
                className="aspect-[3/4] flex items-center justify-center text-white font-bold text-xl"
                style={{ backgroundColor: template.primaryColor }}
              >
                {template.name} Preview
              </div>
            </div>
          </div>

          {/* Template Details */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Information */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Template Information</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-700">Category</label>
                  <p className="text-sm text-gray-600 capitalize">{template.category.replace('-', ' ')}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Document Type</label>
                  <p className="text-sm text-gray-600">{documentTypeLabels[template.type]}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Color Scheme</label>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded border border-gray-300"
                        style={{ backgroundColor: template.primaryColor }}
                      />
                      <span className="text-xs text-gray-600">{template.primaryColor}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded border border-gray-300"
                        style={{ backgroundColor: template.secondaryColor }}
                      />
                      <span className="text-xs text-gray-600">{template.secondaryColor}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Placeholders */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Available Placeholders</h3>
              <div className="space-y-2">
                {Object.entries(template.placeholders).map(([key, description]) => (
                  <div key={key} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <code className="text-sm font-mono text-blue-600">{key}</code>
                    <span className="text-xs text-gray-600">{description}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 p-6 border-t bg-gray-50">
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button
              onClick={() => {
                onSelect(template);
                onClose();
              }}
              className={isSelected ? 'bg-blue-500 hover:bg-blue-600' : ''}
            >
              {isSelected ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Selected
                </>
              ) : (
                'Select Template'
              )}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
