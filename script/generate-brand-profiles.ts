import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const companyNames = [
  'PT Maju Bersama',
  'CV Kreatif Indonesia',
  'PT Teknologi Nusantara',
  'CV Digital Solutions',
  'PT Global Trading',
  'CV Media Kreatif',
  'PT Inovasi Teknologi',
  'CV Konsultan Bisnis',
  'PT Sistem Informasi',
  'CV Design Studio',
];

const cities = [
  'Jakarta', 'Surabaya', 'Bandung', 'Medan', 'Semarang', 'Makassar', 'Palembang',
  'Tangerang', 'Depok', 'Bekasi', 'Bogor', 'Malang', 'Padang', 'Pekanbaru', 'Bali',
  'Yogyakarta', 'Solo', 'Cirebon', 'Tasikmalaya', 'Cimahi'
];

const streets = [
  'Jl. Sudirman', 'Jl. Thamrin', 'Jl. Gatot Subroto', 'Jl. Ahmad Yani', 'Jl. Diponegoro',
  'Jl. Pahlawan', 'Jl. Veteran', 'Jl. Malioboro', 'Jl. Braga', 'Jl. Asia Afrika'
];

function generateRandomSlug(name: string): string {
  return name.toLowerCase()
    .replace(/pt\s+/i, '')
    .replace(/cv\s+/i, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

function generateRandomPhone(): string {
  const prefixes = ['21', '22', '24', '31', '32', '33', '34', '35', '36', '37', '38', '39'];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const number = Math.floor(Math.random() * 10000000).toString().padStart(7, '0');
  return `(${prefix}) ${number.slice(0, 3)}-${number.slice(3, 5)}-${number.slice(5)}`;
}

function generateRandomEmail(name: string): string {
  const domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'company.com', 'biz.com'];
  const domain = domains[Math.floor(Math.random() * domains.length)];
  return `${generateRandomSlug(name)}@${domain}`;
}

function generateRandomAddress(): string {
  const street = streets[Math.floor(Math.random() * streets.length)];
  const number = Math.floor(Math.random() * 200) + 1;
  const city = cities[Math.floor(Math.random() * cities.length)];
  return `${street} No. ${number}, ${city}, Indonesia 12345`;
}

function generateRandomWebsite(name: string): string {
  const slug = generateRandomSlug(name);
  return `https://www.${slug}.com`;
}

function generateRandomColor(): string {
  const colors = ['#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#84CC16', '#F97316'];
  return colors[Math.floor(Math.random() * colors.length)];
}

function generateRandomFooterText(name: string): string {
  const footers = [
    `© 2024 ${name}. All rights reserved.`,
    `Powered by ${name} - Professional Business Solutions`,
    `${name} - Your Trusted Business Partner`,
    `Contact ${name} for all your business needs`,
  ];
  return footers[Math.floor(Math.random() * footers.length)];
}

async function generateDummyBrandProfiles(count: number = 10) {
  console.log(`Generating ${count} dummy brand profiles...`);

  const brandProfiles = [];

  for (let i = 0; i < count; i++) {
    const name = companyNames[Math.floor(Math.random() * companyNames.length)];
    const slug = generateRandomSlug(name);

    const brandProfile = {
      slug,
      name,
      overview: `${name} is a leading company in providing innovative business solutions and professional services.`,
      address: generateRandomAddress(),
      phone: generateRandomPhone(),
      email: generateRandomEmail(name),
      website: generateRandomWebsite(name),
      footerText: generateRandomFooterText(name),
      logoUrl: `https://picsum.photos/seed/${encodeURIComponent(slug)}/200/100`,
      templateOptionId: null,
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
      },
      primaryColor: generateRandomColor(),
      secondaryColor: '#ECFEFF',
      isActive: Math.random() > 0.3, // 70% active
    };

    brandProfiles.push(brandProfile);
  }

  // Insert brand profiles
  for (const profile of brandProfiles) {
    await prisma.brandProfile.upsert({
      where: { slug: profile.slug },
      update: {},
      create: profile,
    });
    console.log(`Inserted brand profile: ${profile.name}`);
  }

  console.log(`Successfully generated ${count} dummy brand profiles!`);
}

async function main() {
  try {
    await generateDummyBrandProfiles(10);
    console.log('All dummy brand profiles have been inserted successfully!');
  } catch (error) {
    console.error('Error generating dummy brand profiles:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
