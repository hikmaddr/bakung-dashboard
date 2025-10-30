import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const templateTypes = ['invoice', 'quotation', 'sales_order', 'delivery_note', 'universal'];

const templateNames = {
  invoice: [
    'Invoice Template A', 'Invoice Template B', 'Invoice Template C', 'Invoice Template D', 'Invoice Template E'
  ],
  quotation: [
    'Quotation Template A', 'Quotation Template B', 'Quotation Template C', 'Quotation Template D', 'Quotation Template E'
  ],
  sales_order: [
    'Sales Order Template A', 'Sales Order Template B', 'Sales Order Template C', 'Sales Order Template D', 'Sales Order Template E'
  ],
  delivery_note: [
    'Delivery Note Template A', 'Delivery Note Template B', 'Delivery Note Template C', 'Delivery Note Template D', 'Delivery Note Template E'
  ],
  universal: [
    'Universal Template A', 'Universal Template B', 'Universal Template C', 'Universal Template D', 'Universal Template E'
  ]
};

const descriptions = [
  'Professional template with clean design',
  'Modern template with elegant styling',
  'Simple template for quick use',
  'Detailed template with comprehensive layout',
  'Customizable template for various needs',
  'Minimalist template with essential elements',
  'Corporate template with brand focus',
  'Flexible template for different document types',
  'Standard template following industry norms',
  'Advanced template with rich features'
];

function generateRandomPlaceholders(type: string): Record<string, string> {
  const basePlaceholders = {
    '{{BRAND_NAME}}': 'brand name',
    '{{CLIENT_NAME}}': 'client name',
    '{{DATE}}': 'date',
    '{{FOOTER_NOTE}}': 'footer note'
  };

  const typeSpecificPlaceholders = {
    invoice: {
      '{{INVOICE_NUMBER}}': 'invoice number',
      '{{PRODUCT_LIST}}': 'product list',
      '{{TOTAL}}': 'total amount'
    },
    quotation: {
      '{{QUOTATION_NUMBER}}': 'quotation number',
      '{{PRODUCT_LIST}}': 'product list',
      '{{TOTAL}}': 'total amount'
    },
    sales_order: {
      '{{SO_NUMBER}}': 'sales order number',
      '{{PRODUCT_LIST}}': 'product list',
      '{{TOTAL}}': 'total amount'
    },
    delivery_note: {
      '{{DELIVERY_NUMBER}}': 'delivery note number',
      '{{PRODUCT_LIST}}': 'product list'
    },
    universal: {
      '{{INVOICE_NUMBER}}': 'invoice number',
      '{{QUOTATION_NUMBER}}': 'quotation number',
      '{{SO_NUMBER}}': 'sales order number',
      '{{DELIVERY_NUMBER}}': 'delivery note number',
      '{{PRODUCT_LIST}}': 'product list',
      '{{TOTAL}}': 'total amount'
    }
  };

  return { ...basePlaceholders, ...typeSpecificPlaceholders[type as keyof typeof typeSpecificPlaceholders] };
}

function generateDummySVGContent(type: string, name: string): string {
  const placeholders = generateRandomPlaceholders(type);
  const placeholderKeys = Object.keys(placeholders);

  // Create a simple SVG template with placeholders
  const svgContent = `<svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#ffffff"/>
    <text x="50" y="50" font-family="Arial" font-size="24" fill="#000000">${name}</text>
    <text x="50" y="100" font-family="Arial" font-size="16" fill="#666666">${type.toUpperCase()} TEMPLATE</text>
    ${placeholderKeys.map((key, index) =>
      `<text x="50" y="${150 + index * 30}" font-family="Arial" font-size="14" fill="#333333">${key}</text>`
    ).join('\n    ')}
  </svg>`;

  return svgContent;
}

async function generateDummyTemplates(count: number = 25) {
  console.log(`Generating ${count} dummy templates...`);

  const templates = [];

  for (let i = 0; i < count; i++) {
    const type = templateTypes[Math.floor(Math.random() * templateTypes.length)];
    const names = templateNames[type as keyof typeof templateNames];
    const name = names[Math.floor(Math.random() * names.length)];
    const description = descriptions[Math.floor(Math.random() * descriptions.length)];

    const template = {
      name,
      description,
      type,
      category: 'custom',
      fileUrl: `/uploads/templates/dummy-${i + 1}.svg`,
      thumbnailUrl: `https://picsum.photos/seed/template${i}/200/150`,
      placeholders: generateRandomPlaceholders(type),
      isActive: Math.random() > 0.2, // 80% active
    };

    templates.push(template);
  }

  // Insert templates
  for (const template of templates) {
    await prisma.template.create({
      data: template,
    });
    console.log(`Inserted template: ${template.name}`);
  }

  console.log(`Successfully generated ${count} dummy templates!`);
}

async function main() {
  try {
    await generateDummyTemplates(25);
    console.log('All dummy templates have been inserted successfully!');
  } catch (error) {
    console.error('Error generating dummy templates:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
