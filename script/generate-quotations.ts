import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const projectDescriptions = [
  'Website development project for e-commerce platform',
  'Mobile app development for food delivery service',
  'Brand identity design and marketing materials',
  'Custom software solution for inventory management',
  'Digital marketing campaign and social media strategy',
  'Corporate website redesign and SEO optimization',
  'Point of sale system implementation',
  'Customer relationship management system',
  'Data analytics dashboard development',
  'E-learning platform development',
  'Real estate website with property listings',
  'Restaurant management system',
  'Healthcare appointment booking system',
  'Fitness tracking mobile application',
  'Event management and ticketing platform',
];

function generateRandomQuotationNumber(): string {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  const sequence = Math.floor(Math.random() * 9999) + 1;
  return `QUO-${year}-${month}-${String(sequence).padStart(4, '0')}`;
}

function generateRandomDate(): Date {
  const now = new Date();
  const daysAgo = Math.floor(Math.random() * 90); // Last 90 days
  const date = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  return date;
}

function generateRandomTotal(): number {
  // Random total between 1M and 50M IDR
  return Math.floor(Math.random() * 49000000) + 1000000;
}

async function generateDummyQuotations(count: number = 20) {
  console.log(`Generating ${count} dummy quotations...`);

  try {
    // Get all customers and products
    const customers = await prisma.customer.findMany();
    const products = await prisma.product.findMany();

    if (customers.length === 0 || products.length === 0) {
      console.error('No customers or products found. Please run generate-customers.ts and generate-products.ts first.');
      return;
    }

    const quotations = [];

    for (let i = 0; i < count; i++) {
      const customer = customers[Math.floor(Math.random() * customers.length)];
      const quotationNumber = generateRandomQuotationNumber();
      const date = generateRandomDate();
      const projectDesc = projectDescriptions[Math.floor(Math.random() * projectDescriptions.length)];

      // Generate 2-8 random items for this quotation
      const itemCount = Math.floor(Math.random() * 7) + 2;
      const selectedProducts = [];
      const usedProductIds = new Set();

      for (let j = 0; j < itemCount; j++) {
        let product;
        let attempts = 0;
        do {
          product = products[Math.floor(Math.random() * products.length)];
          attempts++;
        } while (usedProductIds.has(product.id) && attempts < 10);

        if (!usedProductIds.has(product.id)) {
          usedProductIds.add(product.id);
          selectedProducts.push(product);
        }
      }

      // Calculate total from items
      let total = 0;
      const quotationItems = selectedProducts.map(product => {
        const quantity = Math.floor(Math.random() * 10) + 1;
        const price = product.sellPrice || Math.floor(Math.random() * 100000) + 50000;
        const subtotal = quantity * price;
        total += subtotal;

        return {
          productId: product.id,
          product: product.name,
          description: product.description || `High-quality ${product.name.toLowerCase()}`,
          quantity,
          unit: product.unit || 'pcs',
          price,
          subtotal,
        };
      });

      const quotation = {
        quotationNumber,
        customerId: customer.id,
        date,
        projectDesc,
        total,
        status: Math.random() > 0.3 ? 'draft' : 'sent', // 70% draft, 30% sent
        quotationItems: {
          create: quotationItems,
        },
      };

      quotations.push(quotation);
    }

    // Insert quotations
    for (const quotation of quotations) {
      await prisma.quotation.create({
        data: quotation,
      });
      console.log(`Created quotation: ${quotation.quotationNumber} for ${quotation.customerId}`);
    }

    console.log(`Successfully generated ${count} dummy quotations!`);

  } catch (error) {
    console.error('Error generating quotations:', error);
  }
}

async function main() {
  try {
    await generateDummyQuotations(20);
    console.log('All dummy quotations have been created successfully!');
  } catch (error) {
    console.error('Error in main:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
