const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createCreativeBrand() {
  try {
    console.log('Creating CREATIVE scope brand profile...');
    
    const brandProfile = await prisma.brandProfile.create({
      data: {
        slug: 'creative-studio-test',
        name: 'Creative Studio Test',
        overview: 'Test brand for CREATIVE business scope',
        address: 'Jakarta, Indonesia',
        phone: '021-123456',
        email: 'test@creative.com',
        website: 'https://creative-test.com',
        footerText: 'Creative Studio Test - Your Creative Partner',
        businessScope: 'CREATIVE',
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
          purchase: false,
          inventory: false,
          accounting: false,
          hr: false
        }
      }
    });

    console.log('Created brand profile:', brandProfile);
    
    // Set as active brand
    await prisma.brandProfile.updateMany({
      where: { isActive: true },
      data: { isActive: false }
    });
    
    await prisma.brandProfile.update({
      where: { id: brandProfile.id },
      data: { isActive: true }
    });
    
    console.log('Set as active brand profile');
    
  } catch (error) {
    console.error('Error creating brand profile:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createCreativeBrand();
