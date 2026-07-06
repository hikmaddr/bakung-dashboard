import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Adding new enum values using raw SQL...')
  
  try {
    await prisma.$executeRawUnsafe(`ALTER TYPE "QuotationStatus" ADD VALUE IF NOT EXISTS 'Viewed'`)
    await prisma.$executeRawUnsafe(`ALTER TYPE "QuotationStatus" ADD VALUE IF NOT EXISTS 'Approved'`)
    await prisma.$executeRawUnsafe(`ALTER TYPE "QuotationStatus" ADD VALUE IF NOT EXISTS 'Converted'`)
  } catch(e) { console.log('QuotationStatus update (might already exist)') }

  try {
    await prisma.$executeRawUnsafe(`ALTER TYPE "PurchaseStatus" ADD VALUE IF NOT EXISTS 'WaitingSupplier'`)
    await prisma.$executeRawUnsafe(`ALTER TYPE "PurchaseStatus" ADD VALUE IF NOT EXISTS 'SupplierApproved'`)
    await prisma.$executeRawUnsafe(`ALTER TYPE "PurchaseStatus" ADD VALUE IF NOT EXISTS 'DPPaid'`)
    await prisma.$executeRawUnsafe(`ALTER TYPE "PurchaseStatus" ADD VALUE IF NOT EXISTS 'Production'`)
    await prisma.$executeRawUnsafe(`ALTER TYPE "PurchaseStatus" ADD VALUE IF NOT EXISTS 'QCProcess'`)
    await prisma.$executeRawUnsafe(`ALTER TYPE "PurchaseStatus" ADD VALUE IF NOT EXISTS 'ReadyShipment'`)
  } catch(e) { console.log('PurchaseStatus update (might already exist)') }

  console.log('Migrating data...')
  await prisma.$executeRawUnsafe(`UPDATE quotation SET status = 'Approved' WHERE status = 'Confirmed'`)
  await prisma.$executeRawUnsafe(`UPDATE purchaseorder SET status = 'Production' WHERE status = 'Processing'`)
  
  console.log('Done.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
