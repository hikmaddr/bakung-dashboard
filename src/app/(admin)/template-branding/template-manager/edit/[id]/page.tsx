"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

import {
  ArrowLeft,
  Save,
  Eye,
  Palette,
  Type,
  Layout,
  Settings,
  FileText,
  Image,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlertTriangle,
  CheckCircle,
  Loader2
} from "lucide-react";
import { Template, documentTypeLabels, categoryLabels } from "@/lib/templates";

export default function TemplateEditPage() {
  const params = useParams();
  const router = useRouter();
  const templateId = params.id as string;

  const [template, setTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'universal' as keyof typeof documentTypeLabels,
    category: 'corporate' as keyof typeof categoryLabels,
  });

  // Preview state
  const [svgContent, setSvgContent] = useState<string>("");
  const [previewLoading, setPreviewLoading] = useState(true);

  // Customization state
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [customizations, setCustomizations] = useState<Record<string, any>>({});

  useEffect(() => {
    fetchTemplate();
  }, [templateId]);

  const fetchTemplate = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/templates?id=${templateId}`);
      if (!response.ok) {
        throw new Error('Template not found');
      }
      const data = await response.json();
      setTemplate(data);
      setFormData({
        name: data.name,
        description: data.description || '',
        type: data.type,
        category: data.category,
      });

      // Load SVG content for preview
      if (data.fileUrl) {
        const svgResponse = await fetch(data.fileUrl);
        if (svgResponse.ok) {
          const svgText = await svgResponse.text();
          setSvgContent(svgText);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load template');
    } finally {
      setLoading(false);
      setPreviewLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const response = await fetch(`/api/templates?id=${templateId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          customizations,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update template');
      }

      setSuccess('Template updated successfully');
      // Refresh template data
      await fetchTemplate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update template');
    } finally {
      setSaving(false);
    }
  };

  const handleCustomizationChange = (element: string, property: string, value: any) => {
    setCustomizations(prev => ({
      ...prev,
      [element]: {
        ...prev[element],
        [property]: value,
      },
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading template...</span>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Template Not Found</h2>
        <p className="text-gray-600 mb-6">The template you're looking for doesn't exist.</p>
        <Button onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 px-4 pb-16 pt-6 md:px-8 lg:px-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            onClick={() => router.back()}
            className="shrink-0"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Edit Template</h1>
            <p className="text-sm text-gray-600">Customize your document template</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="outline">
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
        </div>
      </div>

      {/* Success/Error Messages */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Customization Options */}
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Template Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Template Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter template name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter template description"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Document Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, type: value as keyof typeof documentTypeLabels }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(documentTypeLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, category: value as keyof typeof categoryLabels }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(categoryLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Customization Tabs */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Customization
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="text" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="text" className="text-xs">
                    <Type className="h-3 w-3 mr-1" />
                    Text
                  </TabsTrigger>
                  <TabsTrigger value="layout" className="text-xs">
                    <Layout className="h-3 w-3 mr-1" />
                    Layout
                  </TabsTrigger>
                  <TabsTrigger value="colors" className="text-xs">
                    <Palette className="h-3 w-3 mr-1" />
                    Colors
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="text" className="space-y-4 mt-4">
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm">Text Formatting</h4>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm">
                        <Bold className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm">
                        <Italic className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm">
                        <Underline className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>



                  <div className="space-y-3">
                    <h4 className="font-medium text-sm">Text Alignment</h4>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        <AlignLeft className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm">
                        <AlignCenter className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm">
                        <AlignRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="layout" className="space-y-4 mt-4">
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm">Element Positioning</h4>
                    <div className="space-y-2">
                      <Label className="text-xs">Selected Element: {selectedElement || 'None'}</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <Button variant="outline" size="sm" className="text-xs">
                          Move Up
                        </Button>
                        <Button variant="outline" size="sm" className="text-xs">
                          Move Down
                        </Button>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="colors" className="space-y-4 mt-4">
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm">Color Palette</h4>
                    <div className="grid grid-cols-4 gap-2">
                      {['#1f2937', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6b7280'].map((color) => (
                        <button
                          key={color}
                          className="w-8 h-8 rounded border-2 border-gray-300 hover:border-gray-400"
                          style={{ backgroundColor: color }}
                          onClick={() => handleCustomizationChange(selectedElement || 'default', 'color', color)}
                        />
                      ))}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel - Preview */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Live Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-white border rounded-lg p-6 min-h-[600px] flex items-center justify-center">
                {previewLoading ? (
                  <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                    <p className="text-sm text-gray-600">Loading preview...</p>
                  </div>
                ) : svgContent ? (
                  <div
                    className="w-full max-w-2xl"
                    dangerouslySetInnerHTML={{ __html: svgContent }}
                    style={{ aspectRatio: '1 / 1.414' }}
                  />
                ) : (
                  <div className="text-center">
                    <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No preview available</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
