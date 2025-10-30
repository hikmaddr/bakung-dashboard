export type DocumentType = 'invoice' | 'quotation' | 'delivery-note' | 'universal' | 'sales-order';

export type TemplateCategory = 'classic' | 'minimalist' | 'corporate' | 'dark-mode' | 'dynamic';

export interface Template {
  id: string;
  name: string;
  description: string;
  type: DocumentType;
  category: TemplateCategory;
  thumbnail: string; // URL to thumbnail image
  preview: string; // URL to full preview image
  primaryColor: string;
  secondaryColor: string;
  isPopular?: boolean;
  isNew?: boolean;
  placeholders: Record<string, string>; // Template placeholders
  isUploaded?: boolean;
  fileUrl?: string;
}

export const documentTypeLabels: Record<DocumentType, string> = {
  invoice: 'Invoice',
  quotation: 'Quotation',
  'delivery-note': 'Surat Jalan',
  universal: 'Universal',
  'sales-order': 'Sales Order',
};

export const categoryLabels: Record<TemplateCategory, string> = {
  classic: 'Classic',
  minimalist: 'Minimalist',
  corporate: 'Corporate',
  'dark-mode': 'Dark Mode',
  dynamic: 'Dynamic',
};

// Template data - in a real app, this would come from an API
export const templates: Template[] = [
  {
    id: "modern-clean",
    name: "Modern Clean",
    description: "Tampilan minimalis dengan aksen tegas untuk brand korporat.",
    type: "universal",
    category: "minimalist",
    thumbnail: "/images/templates/modern-clean-thumb.png",
    preview: "/images/templates/modern-clean-preview.png",
    primaryColor: "#0EA5E9",
    secondaryColor: "#ECFEFF",
    placeholders: {},
  },
  {
    id: "corporate-bold",
    name: "Corporate Bold",
    description: "Desain tegas dan profesional untuk perusahaan besar.",
    type: "universal",
    category: "corporate",
    thumbnail: "/images/templates/corporate-bold-thumb.png",
    preview: "/images/templates/corporate-bold-preview.png",
    primaryColor: "#1f2937",
    secondaryColor: "#f9fafb",
    placeholders: {},
  },
  {
    id: "minimal-soft",
    name: "Minimal Soft",
    description: "Gaya minimal dengan sentuhan lembut untuk brand modern.",
    type: "universal",
    category: "minimalist",
    thumbnail: "/images/templates/minimal-soft-thumb.png",
    preview: "/images/templates/minimal-soft-preview.png",
    primaryColor: "#6b7280",
    secondaryColor: "#f3f4f6",
    placeholders: {},
  },
  {
    id: "heritage-classic",
    name: "Heritage Classic",
    description: "Nuansa hangat dengan tipografi klasik cocok untuk retail.",
    type: "universal",
    category: "classic",
    thumbnail: "/images/templates/heritage-classic-thumb.png",
    preview: "/images/templates/heritage-classic-preview.png",
    primaryColor: "#8B5CF6",
    secondaryColor: "#f3e8ff",
    placeholders: {},
  },
  {
    id: "invoice-modern-warm",
    name: "Invoice Modern Warm",
    description: "Layout invoice dengan aksen peach hangat dan footer berlapis.",
    type: "invoice",
    category: "corporate",
    thumbnail: "/images/templates/modern-clean-thumb.png",
    preview: "/images/templates/modern-clean-preview.png",
    primaryColor: "#E85C57",
    secondaryColor: "#FFEAE5",
    placeholders: {},
    isPopular: true,
  },
  {
    id: "invoice-modern-indigo",
    name: "Invoice Modern Indigo",
    description: "Template invoice dengan tone ungu profesional dan highlight total.",
    type: "invoice",
    category: "corporate",
    thumbnail: "/images/templates/corporate-bold-thumb.png",
    preview: "/images/templates/corporate-bold-preview.png",
    primaryColor: "#4C1D95",
    secondaryColor: "#EDE9FE",
    placeholders: {},
  },
];

export const getTemplatesByType = (type: DocumentType): Template[] => {
  return templates.filter(template => template.type === type || template.type === 'universal');
};

export const getTemplatesByCategory = (category: TemplateCategory): Template[] => {
  return templates.filter(template => template.category === category);
};

export const getPopularTemplates = (): Template[] => {
  return templates.filter(template => template.isPopular);
};

export const getNewTemplates = (): Template[] => {
  return templates.filter(template => template.isNew);
};

export const searchTemplates = (query: string): Template[] => {
  const lowercaseQuery = query.toLowerCase();
  return templates.filter(template =>
    template.name.toLowerCase().includes(lowercaseQuery) ||
    template.description.toLowerCase().includes(lowercaseQuery) ||
    template.category.toLowerCase().includes(lowercaseQuery) ||
    template.type.toLowerCase().includes(lowercaseQuery)
  );
};

// Function to fetch uploaded templates from API
export const fetchUploadedTemplates = async (): Promise<Template[]> => {
  try {
    const response = await fetch('/api/templates');
    if (!response.ok) {
      throw new Error('Failed to fetch uploaded templates');
    }
    const data = await response.json();

    // Transform API response to match Template interface
    return data.map((template: any) => ({
      id: template.id.toString(),
      name: template.name,
      description: template.description || '',
      type: template.type as DocumentType,
      category: template.category as TemplateCategory,
      thumbnail: template.thumbnailUrl || '/images/templates/default-thumb.png',
      preview: template.thumbnailUrl || '/images/templates/default-preview.png',
      primaryColor: '#1f2937', // Default colors for uploaded templates
      secondaryColor: '#f9fafb',
      placeholders: template.placeholders || {},
      isUploaded: true,
      fileUrl: template.fileUrl,
    }));
  } catch (error) {
    console.error('Error fetching uploaded templates:', error);
    return [];
  }
};

// Function to get all templates (static + uploaded)
export const getAllTemplates = async (): Promise<Template[]> => {
  const [staticTemplates, uploadedTemplates] = await Promise.all([
    Promise.resolve(templates),
    fetchUploadedTemplates(),
  ]);

  // Merge and return all templates
  return [...staticTemplates, ...uploadedTemplates];
};
