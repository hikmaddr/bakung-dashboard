import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const newCustomer = await prisma.customer.create({
    data: {
      pic: 'Hikmad Drajat',
      company: 'CV Kreatif',
      address: 'Jl. Mawar No. 3',
      phone: '082233445566',
    },
  });

  console.log('Customer baru:', newCustomer);

  const customers = await prisma.customer.findMany();
  console.log('Semua customer:', customers);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
