const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function randFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

const companies = [
  'PT Maju Bersama', 'CV Kreatif Indonesia', 'PT Teknologi Nusantara', 'CV Digital Solutions',
  'PT Global Trading', 'CV Media Kreatif', 'PT Inovasi Teknologi', 'CV Konsultan Bisnis',
  'PT Sistem Informasi', 'CV Design Studio'
];

const streets = ['Jl. Sudirman', 'Jl. Thamrin', 'Jl. Gatot Subroto', 'Jl. Ahmad Yani', 'Jl. Diponegoro'];
const cities = ['Jakarta', 'Surabaya', 'Bandung', 'Medan', 'Semarang'];

function randomAddress() {
  const street = randFrom(streets);
  const no = Math.floor(Math.random() * 200) + 1;
  const city = randFrom(cities);
  return `${street} No. ${no}, ${city}, Indonesia 12345`;
}

function randomPhone() {
  const prefix = ['021', '022', '031', '061', '024'];
  const p = randFrom(prefix);
  const n = Math.floor(Math.random() * 9000000) + 1000000;
  return `${p}-${n}`;
}

async function main() {
  try {
    const brand = await prisma.brandProfile.findFirst({ where: { isActive: true } });
    if (!brand) throw new Error('Active brand profile not found. Please create/activate a brand first.');

    const toCreate = 15;
    console.log(`[generate-customers] Creating ${toCreate} customers for brand id=${brand.id}`);

    for (let i = 0; i < toCreate; i++) {
      const company = randFrom(companies) + ` ${i+1}`;
      await prisma.customer.create({
        data: {
          pic: 'Bapak/Ibu ' + (i + 1),
          company,
          address: randomAddress(),
          phone: randomPhone(),
          email: `customer${i+1}@example.com`,
          brandProfileId: brand.id,
        },
      });
    }
    console.log('[generate-customers] Done');
  } catch (e) {
    console.error('[generate-customers] Error:', e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();

