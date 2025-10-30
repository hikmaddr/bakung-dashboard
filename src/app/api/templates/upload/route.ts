import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { prisma } from "@/lib/prisma";

const SUPPORTED_PLACEHOLDERS = [
  '{{BRAND_NAME}}',
  '{{CLIENT_NAME}}',
  '{{INVOICE_NUMBER}}',
  '{{QUOTATION_NUMBER}}',
  '{{SO_NUMBER}}',
  '{{DELIVERY_NUMBER}}',
  '{{DATE}}',
  '{{PRODUCT_LIST}}',
  '{{TOTAL}}',
  '{{FOOTER_NOTE}}',
];

function extractPlaceholders(svgContent: string): string[] {
  const found: string[] = [];
  SUPPORTED_PLACEHOLDERS.forEach(placeholder => {
    if (svgContent.includes(placeholder)) {
      found.push(placeholder);
    }
  });
  return found;
}

function validateSVG(content: string): { isValid: boolean; error?: string } {
  // Basic SVG validation
  if (!content.trim().startsWith('<svg') || !content.trim().endsWith('</svg>')) {
    return { isValid: false, error: "Invalid SVG format" };
  }

  // Check for XML declaration or DOCTYPE
  if (content.includes('<!DOCTYPE') || content.includes('<?xml')) {
    return { isValid: false, error: "SVG should not contain DOCTYPE or XML declarations" };
  }

  return { isValid: true };
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const type = formData.get("type") as string;

    if (!file || !name || !type) {
      return NextResponse.json(
        { success: false, message: "File, name, and type are required" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.svg')) {
      return NextResponse.json(
        { success: false, message: "Only SVG files are allowed" },
        { status: 400 }
      );
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, message: "File size must be less than 5MB" },
        { status: 400 }
      );
    }

    // Read file content
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const svgContent = buffer.toString('utf-8');

    // Validate SVG
    const validation = validateSVG(svgContent);
    if (!validation.isValid) {
      return NextResponse.json(
        { success: false, message: validation.error },
        { status: 400 }
      );
    }

    // Extract placeholders
    const placeholders = extractPlaceholders(svgContent);

    // Check for minimum required placeholders
    const hasMinimumPlaceholders = placeholders.length >= 3; // At least 3 placeholders
    if (!hasMinimumPlaceholders) {
      return NextResponse.json(
        {
          success: false,
          message: "Template must contain at least 3 supported placeholders",
          warning: "Consider adding more placeholders for better functionality"
        },
        { status: 400 }
      );
    }

    // Create upload directory if it doesn't exist
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'templates');
    try {
      await mkdir(uploadDir, { recursive: true });
    } catch (error) {
      // Directory might already exist, continue
    }

    // Generate unique filename
    const timestamp = Date.now();
    const filename = `${timestamp}-${file.name}`;
    const filepath = join(uploadDir, filename);

    // Save file
    await writeFile(filepath, buffer);

    // Save to database
    const template = await prisma.template.create({
      data: {
        name,
        description,
        type,
        category: "custom",
        fileUrl: `/uploads/templates/${filename}`,
        placeholders: placeholders.reduce((acc, ph) => {
          acc[ph] = ph.replace(/\{\{/g, '').replace(/\}\}/g, '').toLowerCase().replace(/_/g, ' ');
          return acc;
        }, {} as Record<string, string>),
      },
    });

    return NextResponse.json({
      success: true,
      template,
      placeholders,
      message: "Template uploaded successfully"
    });

  } catch (error) {
    console.error("Template upload error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to upload template" },
      { status: 500 }
    );
  }
}
