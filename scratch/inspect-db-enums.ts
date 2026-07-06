import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const enumValues = await prisma.$queryRawUnsafe(`
    SELECT n.nspname as schema, t.typname as type, e.enumlabel as value
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname IN ('QuotationStatus', 'PurchaseStatus')
  `)
  console.log('Current DB Enum Values:', enumValues)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
