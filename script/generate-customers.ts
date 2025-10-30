import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const companies = [
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
  'PT E-commerce Indonesia',
  'CV Marketing Agency',
  'PT Software Development',
  'CV Event Organizer',
  'PT Logistic Solutions',
  'CV Food & Beverage',
  'PT Property Development',
  'CV Fashion Design',
  'PT Manufacturing Indonesia',
  'CV Education Center',
  'PT Healthcare Solutions',
  'CV Travel Agency',
  'PT Construction Services',
  'CV Interior Design',
  'PT Automotive Parts',
  'CV Beauty & Wellness',
  'PT Renewable Energy',
  'CV Sports Equipment',
  'PT Financial Services',
  'CV Legal Consulting',
  'PT Agricultural Products',
  'CV Pet Supplies',
  'PT Home Appliances',
  'CV Book Publishing',
  'PT Gaming Studio',
  'CV Music Production',
  'PT Film Production',
  'CV Photography Services',
  'PT Security Systems',
  'CV Cleaning Services',
  'PT Waste Management',
  'CV Recycling Center',
  'PT Water Treatment',
  'CV Environmental Services',
  'PT Mining Equipment',
  'CV Construction Materials',
  'PT Textile Industry',
  'CV Leather Goods',
  'PT Pharmaceutical',
  'CV Medical Equipment'
];

const firstNames = [
  'Ahmad', 'Budi', 'Citra', 'Dedi', 'Eka', 'Fajar', 'Gita', 'Hadi', 'Indah', 'Joko',
  'Kartika', 'Lutfi', 'Maya', 'Nanda', 'Oka', 'Putri', 'Rudi', 'Sari', 'Tono', 'Umi',
  'Vino', 'Wati', 'Xander', 'Yuni', 'Zaki', 'Agus', 'Bella', 'Candra', 'Dina', 'Erik'
];

const lastNames = [
  'Santoso', 'Wijaya', 'Kusuma', 'Pratama', 'Saputra', 'Hartono', 'Susanto', 'Setiawan',
  'Wibowo', 'Suryadi', 'Gunawan', 'Hidayat', 'Nugroho', 'Purnomo', 'Suharto', 'Wahyudi',
  'Yusuf', 'Zulkarnain', 'Abdi', 'Bakti', 'Cahya', 'Dharma', 'Endah', 'Fadli', 'Gumelar',
  'Halim', 'Irawan', 'Jatmiko', 'Kurnia', 'Laksana'
];

const cities = [
  'Jakarta', 'Surabaya', 'Bandung', 'Medan', 'Semarang', 'Makassar', 'Palembang',
  'Tangerang', 'Depok', 'Bekasi', 'Bogor', 'Malang', 'Padang', 'Pekanbaru', 'Bali',
  'Yogyakarta', 'Solo', 'Cirebon', 'Tasikmalaya', 'Cimahi', 'Banjar', 'Magelang',
  'Salatiga', 'Purwokerto', 'Cilacap', 'Tegal', 'Pemalang', 'Purbalingga', 'Banyumas'
];

const streets = [
  'Jl. Sudirman', 'Jl. Thamrin', 'Jl. Gatot Subroto', 'Jl. Ahmad Yani', 'Jl. Diponegoro',
  'Jl. Pahlawan', 'Jl. Veteran', 'Jl. Malioboro', 'Jl. Malioboro', 'Jl. Braga',
  'Jl. Asia Afrika', 'Jl. Riau', 'Jl. Sumatra', 'Jl. Kalimantan', 'Jl. Sulawesi',
  'Jl. Papua', 'Jl. Nusa Tenggara', 'Jl. Bali', 'Jl. Lombok', 'Jl. Sumbawa'
];

function generateRandomEmail(firstName: string, lastName: string, company: string): string {
  const domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'company.com', 'biz.com'];
  const random = Math.floor(Math.random() * 3);
  const domain = domains[Math.floor(Math.random() * domains.length)];

  if (random === 0) return `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${domain}`;
  if (random === 1) return `${firstName.toLowerCase()}${Math.floor(Math.random() * 100)}@${domain}`;
  return `${firstName.toLowerCase()}${lastName.toLowerCase()}@${company.toLowerCase().replace(/\s+/g, '')}.com`;
}

function generateRandomPhone(): string {
  const prefixes = ['812', '813', '814', '815', '816', '817', '818', '819', '821', '822', '823', '852', '853', '856', '857', '858', '896', '897', '898', '899'];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const number = Math.floor(Math.random() * 10000000).toString().padStart(7, '0');
  return `62${prefix}${number}`;
}

function generateRandomAddress(): string {
  const street = streets[Math.floor(Math.random() * streets.length)];
  const number = Math.floor(Math.random() * 200) + 1;
  const city = cities[Math.floor(Math.random() * cities.length)];
  return `${street} No. ${number}, ${city}`;
}

async function generateDummyCustomers(count: number = 50) {
  console.log(`Clearing existing customers...`);
  await prisma.customer.deleteMany();

  console.log(`Generating ${count} dummy customers...`);

  const customers = [];

  for (let i = 0; i < count; i++) {
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const company = companies[Math.floor(Math.random() * companies.length)];
    const pic = `${firstName} ${lastName}`;

    const customer = {
      pic,
      company,
      address: generateRandomAddress(),
      phone: generateRandomPhone(),
      email: generateRandomEmail(firstName, lastName, company),
    };

    customers.push(customer);
  }

  // Insert customers in batches to avoid overwhelming the database
  const batchSize = 10;
  for (let i = 0; i < customers.length; i += batchSize) {
    const batch = customers.slice(i, i + batchSize);
    await prisma.customer.createMany({
      data: batch,
      skipDuplicates: true,
    });
    console.log(`Inserted ${Math.min(i + batchSize, customers.length)}/${customers.length} customers...`);
  }

  console.log(`Successfully generated ${count} dummy customers!`);
}

async function main() {
  try {
    await generateDummyCustomers(50);
    console.log('All dummy customers have been inserted successfully!');
  } catch (error) {
    console.error('Error generating dummy customers:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
