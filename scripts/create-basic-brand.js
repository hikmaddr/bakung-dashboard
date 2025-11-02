const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createBasicBrand() {
  try {
    console.log('[create-basic-brand] Creating basic brand profile...');
    
    // Check if any active brand exists
    const existingActive = await prisma.brandProfile.findFirst({ where: { isActive: true } });
    if (existingActive) {
      console.log('[create-basic-brand] Active brand already exists:', existingActive.name);
      return existingActive;
    }

    // Create a basic brand profile
    const brandProfile = await prisma.brandProfile.create({
      data: {
        slug: 'default-company',
        name: 'Default Company',
        overview: 'Default company profile for initial setup',
        address: 'Jakarta, Indonesia',
        phone: '021-123456',
        email: 'admin@company.com',
        website: 'https://company.com',
        footerText: 'Default Company - Your Business Partner',
        primaryColor: '#0EA5E9',
        secondaryColor: '#ECFEFF',
        isActive: true,
        templateDefaults: {
          invoice: 'default',
          quotation: 'default',
          sales_order: 'default',
          delivery_note: 'default'
        },
        numberFormats: {
          currency: 'IDR',
          decimal: ',',
          thousand: '.'
        },
        modules: {
          sales: true,
          purchase: true,
          inventory: true,
          accounting: false,
          hr: false
        }
      }
    });

    console.log('[create-basic-brand] Created brand profile:', brandProfile.name);
    return brandProfile;
    
  } catch (error) {
    console.error('[create-basic-brand] Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  createBasicBrand();
}

module.exports = { createBasicBrand };