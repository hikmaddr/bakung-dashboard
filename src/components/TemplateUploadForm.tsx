"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, FileText, AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface TemplateUploadFormProps {
  onSuccess?: () => void;
}

export default function TemplateUploadForm({ onSuccess }: TemplateUploadFormProps) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.toLowerCase().endsWith('.svg')) {
        setError("Only SVG files are allowed");
        setFile(null);
        return;
      }
      if (selectedFile.size > 5 * 1024 * 1024) {
        setError("File size must be less than 5MB");
        setFile(null);
        return;
      }
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!file || !formData.name || !formData.type) {
      setError("Please fill in all required fields and select a file");
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      const uploadData = new FormData();
      uploadData.append("file", file);
      uploadData.append("name", formData.name);
      uploadData.append("description", formData.description);
      uploadData.append("type", formData.type);

      const response = await fetch("/api/templates/upload", {
        method: "POST",
        body: uploadData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Upload failed");
      }

      setSuccess("Template uploaded successfully!");
      setFormData({ name: "", description: "", type: "" });
      setFile(null);

      // Reset file input
      const fileInput = document.getElementById("template-file") as HTMLInputElement;
      if (fileInput) fileInput.value = "";

      onSuccess?.();

    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Upload SVG Template
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Template Name */}
          <div className="space-y-2">
            <Label htmlFor="template-name">Template Name *</Label>
            <Input
              id="template-name"
              placeholder="e.g., Modern Invoice Template"
              value={formData.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="template-description">Description</Label>
            <Textarea
              id="template-description"
              placeholder="Describe your template..."
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              rows={3}
            />
          </div>

          {/* Document Type */}
          <div className="space-y-2">
            <Label htmlFor="template-type">Document Type *</Label>
            <Select value={formData.type} onValueChange={(value) => handleInputChange("type", value)}>
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Select document type" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="invoice">Invoice</SelectItem>
                <SelectItem value="quotation">Quotation</SelectItem>
                <SelectItem value="sales-order">Sales Order</SelectItem>
                <SelectItem value="delivery-note">Delivery Note</SelectItem>
                <SelectItem value="universal">Universal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <Label htmlFor="template-file">SVG File *</Label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
              <input
                id="template-file"
                type="file"
                accept=".svg"
                onChange={handleFileChange}
                className="hidden"
              />
              <label htmlFor="template-file" className="cursor-pointer">
                <div className="flex flex-col items-center gap-2">
                  <FileText className="h-8 w-8 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {file ? file.name : "Click to upload SVG file"}
                    </p>
                    <p className="text-xs text-gray-500">
                      SVG files only, max 5MB
                    </p>
                  </div>
                </div>
              </label>
            </div>
            {file && (
              <p className="text-sm text-green-600 flex items-center gap-1">
                <CheckCircle className="h-4 w-4" />
                File selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          {/* Supported Placeholders Info */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Supported Placeholders:</strong> Your SVG should include placeholders like{" "}
              <code className="bg-gray-100 px-1 rounded">{`{{BRAND_NAME}}`}</code>,{" "}
              <code className="bg-gray-100 px-1 rounded">{`{{CLIENT_NAME}}`}</code>,{" "}
              <code className="bg-gray-100 px-1 rounded">{`{{INVOICE_NUMBER}}`}</code>, etc.
            </AlertDescription>
          </Alert>

          {/* Error/Success Messages */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">{success}</AlertDescription>
            </Alert>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full"
            disabled={uploading}
          >
            {uploading ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Uploading...
              </>
            ) : (
              "Upload Template"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
