"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { CheckCircle, Settings, Loader2 } from "lucide-react";
import { Template } from "@/lib/templates";

interface BrandProfile {
  id: string;
  name: string;
  templateDefaults?: {
    quotation?: string;
    salesOrder?: string;
    invoice?: string;
    deliveryNote?: string;
  };
}

interface DefaultTemplateSelectorProps {
  templates: Template[];
  brandProfiles: BrandProfile[];
  activeBrandId: string;
  onUpdateDefaults: (brandId: string, defaults: any) => void;
}

export default function DefaultTemplateSelector({
  templates,
  brandProfiles,
  activeBrandId,
  onUpdateDefaults,
}: DefaultTemplateSelectorProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const activeBrand = brandProfiles.find(p => p.id === activeBrandId);

  const documentTypes = [
    { key: 'invoice', label: 'Default Invoice Template', icon: '🧾' },
    { key: 'quotation', label: 'Default Quotation Template', icon: '📄' },
    { key: 'salesOrder', label: 'Default Sales Order Template', icon: '📋' },
    { key: 'deliveryNote', label: 'Default Delivery Note Template', icon: '🚚' },
  ];

  const getTemplatesForType = (type: string) => {
    return templates.filter(template =>
      template.type === type || template.type === 'universal'
    );
  };

  const getCurrentDefault = (type: string) => {
    if (!activeBrand?.templateDefaults) return 'none';
    const key = type === 'salesOrder' ? 'salesOrder' : type;
    const value = activeBrand.templateDefaults[key as keyof typeof activeBrand.templateDefaults];
    return value || 'none';
  };

  const getTemplateById = (id: string) => {
    return templates.find(t => t.id === id);
  };

  const handleDefaultChange = (type: string, templateId: string) => {
    if (!activeBrand) return;

    const key = type === 'salesOrder' ? 'salesOrder' : type;
    const updatedDefaults = {
      ...activeBrand.templateDefaults,
      [key]: templateId === 'none' ? '' : templateId,
    };

    onUpdateDefaults(activeBrand.id, updatedDefaults);
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      // The onUpdateDefaults function should handle the API call
      // This is just for UI feedback
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error('Error saving template settings:', error);
    } finally {
      setSaving(false);
    }
  };

  if (!activeBrand) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">No active brand profile selected</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Default Template Settings
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Configure default templates for each document type in your active brand profile: <strong>{activeBrand.name}</strong>
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {documentTypes.map(({ key, label, icon }) => {
          const availableTemplates = getTemplatesForType(key);
          const currentDefaultId = getCurrentDefault(key);
          const currentTemplate = currentDefaultId && currentDefaultId !== 'none' ? getTemplateById(currentDefaultId) : null;

          return (
            <div key={key} className="space-y-3">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <span>{icon}</span>
                {label}
              </Label>

              <Select
                value={currentDefaultId === 'none' ? '' : currentDefaultId}
                onValueChange={(value) => handleDefaultChange(key, value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No default (use system default)</SelectItem>
                  {availableTemplates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      <div className="flex items-center gap-2">
                        <span>{template.name}</span>
                        {template.isUploaded && (
                          <Badge variant="secondary" className="text-xs">Custom</Badge>
                        )}
                        {currentDefaultId === template.id && (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {currentTemplate && (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-800">
                      {currentTemplate.name}
                    </p>
                    <p className="text-xs text-green-600">
                      {currentTemplate.description}
                    </p>
                  </div>
                  {currentTemplate.isUploaded && (
                    <Badge variant="secondary" className="text-xs">Custom Upload</Badge>
                  )}
                </div>
              )}
            </div>
          );
        })}

        <div className="pt-4 border-t">
          <Button
            onClick={handleSaveSettings}
            disabled={saving}
            className="w-full"
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {saving ? "Saving..." : "Save Template Settings"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
