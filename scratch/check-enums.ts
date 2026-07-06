import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const qStats = await prisma.$queryRawUnsafe(`SELECT status, count(*) FROM quotation GROUP BY status`)
  console.log('Quotation Statuses:', qStats)

  const pStats = await prisma.$queryRawUnsafe(`SELECT status, count(*) FROM purchaseorder GROUP BY status`)
  console.log('PurchaseOrder Statuses:', pStats)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
