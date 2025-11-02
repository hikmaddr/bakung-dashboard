/*
  Warnings:

  - You are about to drop the column `read` on the `notification` table. All the data in the column will be lost.
  - You are about to alter the column `type` on the `notification` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Enum(EnumId(10))`.

*/
-- DropForeignKey
ALTER TABLE `notification` DROP FOREIGN KEY `notification_userId_fkey`;

-- AlterTable
ALTER TABLE `brand_profile` ADD COLUMN `businessScope` ENUM('CREATIVE', 'PROCUREMENT', 'SOUVENIR') NOT NULL DEFAULT 'PROCUREMENT',
    ADD COLUMN `deletedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `customer` ADD COLUMN `deletedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `invoice` ADD COLUMN `deletedAt` DATETIME(3) NULL,
    ADD COLUMN `paidAmount` DOUBLE NOT NULL DEFAULT 0,
    ADD COLUMN `paymentStatus` VARCHAR(191) NOT NULL DEFAULT 'UNPAID';

-- AlterTable
ALTER TABLE `notification` DROP COLUMN `read`,
    ADD COLUMN `brandProfileId` INTEGER NULL,
    ADD COLUMN `isRead` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `readAt` DATETIME(3) NULL,
    ADD COLUMN `roleTarget` ENUM('OWNER', 'ADMIN', 'STAFF', 'ALL') NULL,
    MODIFY `userId` INTEGER NULL,
    MODIFY `type` ENUM('info', 'success', 'warning', 'error') NOT NULL;

-- AlterTable
ALTER TABLE `product` ADD COLUMN `deletedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `quotation` ADD COLUMN `deletedAt` DATETIME(3) NULL,
    MODIFY `notes` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `salesorder` ADD COLUMN `deletedAt` DATETIME(3) NULL,
    ADD COLUMN `paidAmount` DOUBLE NOT NULL DEFAULT 0,
    ADD COLUMN `paymentStatus` VARCHAR(191) NOT NULL DEFAULT 'UNPAID';

-- CreateTable
CREATE TABLE `purchasedirect` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `purchaseNumber` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `supplierName` VARCHAR(191) NOT NULL,
    `marketplaceOrderId` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,
    `attachments` JSON NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'Draft',
    `receivedAt` DATETIME(3) NULL,
    `subtotal` DOUBLE NOT NULL DEFAULT 0,
    `shippingCost` DOUBLE NOT NULL DEFAULT 0,
    `fee` DOUBLE NOT NULL DEFAULT 0,
    `tax` DOUBLE NOT NULL DEFAULT 0,
    `total` DOUBLE NOT NULL DEFAULT 0,
    `paidAmount` DOUBLE NOT NULL DEFAULT 0,
    `paymentStatus` VARCHAR(191) NOT NULL DEFAULT 'UNPAID',
    `proofUrl` VARCHAR(191) NULL,
    `salesOrderId` INTEGER NULL,
    `brandProfileId` INTEGER NULL,
    `createdByUserId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `purchasedirect_purchaseNumber_key`(`purchaseNumber`),
    INDEX `purchasedirect_brandProfileId_idx`(`brandProfileId`),
    INDEX `purchasedirect_salesOrderId_idx`(`salesOrderId`),
    INDEX `purchasedirect_createdByUserId_idx`(`createdByUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `purchasedirectitem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `purchaseDirectId` INTEGER NOT NULL,
    `productId` INTEGER NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `qty` INTEGER NOT NULL,
    `unit` VARCHAR(191) NOT NULL DEFAULT 'pcs',
    `unitCost` DOUBLE NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `purchasedirectitem_purchaseDirectId_idx`(`purchaseDirectId`),
    INDEX `purchasedirectitem_productId_idx`(`productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `purchaseinvoice` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `invoiceNumber` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `dueDate` DATETIME(3) NULL,
    `supplierName` VARCHAR(191) NOT NULL,
    `notes` VARCHAR(191) NULL,
    `subtotal` DOUBLE NOT NULL DEFAULT 0,
    `shippingCost` DOUBLE NOT NULL DEFAULT 0,
    `tax` DOUBLE NOT NULL DEFAULT 0,
    `total` DOUBLE NOT NULL DEFAULT 0,
    `paidAmount` DOUBLE NOT NULL DEFAULT 0,
    `status` ENUM('Draft', 'Issued', 'PartiallyPaid', 'Paid', 'Canceled') NOT NULL DEFAULT 'Draft',
    `brandProfileId` INTEGER NULL,
    `purchaseDirectId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `purchaseinvoice_brandProfileId_idx`(`brandProfileId`),
    INDEX `purchaseinvoice_purchaseDirectId_idx`(`purchaseDirectId`),
    UNIQUE INDEX `purchaseinvoice_brandProfileId_invoiceNumber_key`(`brandProfileId`, `invoiceNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `purchaseinvoiceitem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `purchaseInvoiceId` INTEGER NOT NULL,
    `productId` INTEGER NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `qty` INTEGER NOT NULL,
    `unit` VARCHAR(191) NOT NULL DEFAULT 'pcs',
    `unitCost` DOUBLE NOT NULL DEFAULT 0,
    `subtotal` DOUBLE NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `purchaseinvoiceitem_purchaseInvoiceId_idx`(`purchaseInvoiceId`),
    INDEX `purchaseinvoiceitem_productId_idx`(`productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stockmutation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `productId` INTEGER NOT NULL,
    `qty` INTEGER NOT NULL,
    `type` ENUM('IN', 'OUT', 'ADJUST') NOT NULL,
    `refTable` VARCHAR(191) NULL,
    `refId` INTEGER NULL,
    `note` VARCHAR(191) NULL,
    `brandProfileId` INTEGER NULL,
    `createdByUserId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `stockmutation_productId_idx`(`productId`),
    INDEX `stockmutation_brandProfileId_idx`(`brandProfileId`),
    INDEX `stockmutation_createdByUserId_idx`(`createdByUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `brandProfileId` INTEGER NULL,
    `type` ENUM('IN', 'OUT') NOT NULL,
    `method` ENUM('CASH', 'BCA', 'BRI', 'OTHER') NOT NULL,
    `amount` DOUBLE NOT NULL DEFAULT 0,
    `paidAt` DATETIME(3) NOT NULL,
    `refType` ENUM('SALES_ORDER', 'INVOICE', 'PURCHASE', 'EXPENSE') NOT NULL,
    `refId` INTEGER NOT NULL,
    `notes` VARCHAR(191) NULL,
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `payment_brandProfileId_idx`(`brandProfileId`),
    INDEX `payment_refType_refId_idx`(`refType`, `refId`),
    INDEX `payment_createdById_idx`(`createdById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `receipt` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `brandProfileId` INTEGER NULL,
    `paymentId` INTEGER NOT NULL,
    `receiptNumber` VARCHAR(191) NOT NULL,
    `pdfUrl` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `receipt_paymentId_key`(`paymentId`),
    INDEX `receipt_brandProfileId_idx`(`brandProfileId`),
    UNIQUE INDEX `receipt_brandProfileId_receiptNumber_key`(`brandProfileId`, `receiptNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `paymentin` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `brandProfileId` INTEGER NULL,
    `method` ENUM('CASH', 'BCA', 'BRI', 'OTHER') NOT NULL,
    `amount` DOUBLE NOT NULL DEFAULT 0,
    `paidAt` DATETIME(3) NOT NULL,
    `status` ENUM('Draft', 'Posted', 'Voided') NOT NULL DEFAULT 'Posted',
    `notes` VARCHAR(191) NULL,
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `invoiceId` INTEGER NULL,
    `salesOrderId` INTEGER NULL,

    INDEX `paymentin_brandProfileId_idx`(`brandProfileId`),
    INDEX `paymentin_invoiceId_idx`(`invoiceId`),
    INDEX `paymentin_salesOrderId_idx`(`salesOrderId`),
    INDEX `paymentin_createdById_idx`(`createdById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `paymentout` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `brandProfileId` INTEGER NULL,
    `method` ENUM('CASH', 'BCA', 'BRI', 'OTHER') NOT NULL,
    `amount` DOUBLE NOT NULL DEFAULT 0,
    `paidAt` DATETIME(3) NOT NULL,
    `status` ENUM('Draft', 'Posted', 'Voided') NOT NULL DEFAULT 'Posted',
    `notes` VARCHAR(191) NULL,
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `purchaseInvoiceId` INTEGER NULL,

    INDEX `paymentout_brandProfileId_idx`(`brandProfileId`),
    INDEX `paymentout_purchaseInvoiceId_idx`(`purchaseInvoiceId`),
    INDEX `paymentout_createdById_idx`(`createdById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `expense` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `brandProfileId` INTEGER NULL,
    `category` VARCHAR(191) NOT NULL,
    `amount` DOUBLE NOT NULL DEFAULT 0,
    `payee` VARCHAR(191) NULL,
    `attachmentUrl` VARCHAR(191) NULL,
    `paidAt` DATETIME(3) NOT NULL,
    `notes` VARCHAR(191) NULL,
    `paymentId` INTEGER NULL,
    `paymentOutId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `expense_paymentId_key`(`paymentId`),
    UNIQUE INDEX `expense_paymentOutId_key`(`paymentOutId`),
    INDEX `expense_brandProfileId_idx`(`brandProfileId`),
    INDEX `expense_paymentId_idx`(`paymentId`),
    INDEX `expense_paymentOutId_idx`(`paymentOutId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `login_log` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NULL,
    `action` VARCHAR(191) NOT NULL,
    `success` BOOLEAN NOT NULL DEFAULT true,
    `ip` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `message` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `login_log_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `notification_brandProfileId_idx` ON `notification`(`brandProfileId`);

-- AddForeignKey
ALTER TABLE `purchasedirect` ADD CONSTRAINT `purchasedirect_brandProfileId_fkey` FOREIGN KEY (`brandProfileId`) REFERENCES `brand_profile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchasedirect` ADD CONSTRAINT `purchasedirect_salesOrderId_fkey` FOREIGN KEY (`salesOrderId`) REFERENCES `salesorder`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchasedirect` ADD CONSTRAINT `purchasedirect_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchasedirectitem` ADD CONSTRAINT `purchasedirectitem_purchaseDirectId_fkey` FOREIGN KEY (`purchaseDirectId`) REFERENCES `purchasedirect`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchasedirectitem` ADD CONSTRAINT `purchasedirectitem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `product`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchaseinvoice` ADD CONSTRAINT `purchaseinvoice_brandProfileId_fkey` FOREIGN KEY (`brandProfileId`) REFERENCES `brand_profile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchaseinvoice` ADD CONSTRAINT `purchaseinvoice_purchaseDirectId_fkey` FOREIGN KEY (`purchaseDirectId`) REFERENCES `purchasedirect`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchaseinvoiceitem` ADD CONSTRAINT `purchaseinvoiceitem_purchaseInvoiceId_fkey` FOREIGN KEY (`purchaseInvoiceId`) REFERENCES `purchaseinvoice`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchaseinvoiceitem` ADD CONSTRAINT `purchaseinvoiceitem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `product`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stockmutation` ADD CONSTRAINT `stockmutation_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stockmutation` ADD CONSTRAINT `stockmutation_brandProfileId_fkey` FOREIGN KEY (`brandProfileId`) REFERENCES `brand_profile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stockmutation` ADD CONSTRAINT `stockmutation_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment` ADD CONSTRAINT `payment_brandProfileId_fkey` FOREIGN KEY (`brandProfileId`) REFERENCES `brand_profile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment` ADD CONSTRAINT `payment_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `receipt` ADD CONSTRAINT `receipt_brandProfileId_fkey` FOREIGN KEY (`brandProfileId`) REFERENCES `brand_profile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `receipt` ADD CONSTRAINT `receipt_paymentId_fkey` FOREIGN KEY (`paymentId`) REFERENCES `payment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paymentin` ADD CONSTRAINT `paymentin_brandProfileId_fkey` FOREIGN KEY (`brandProfileId`) REFERENCES `brand_profile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paymentin` ADD CONSTRAINT `paymentin_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paymentin` ADD CONSTRAINT `paymentin_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `invoice`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paymentin` ADD CONSTRAINT `paymentin_salesOrderId_fkey` FOREIGN KEY (`salesOrderId`) REFERENCES `salesorder`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paymentout` ADD CONSTRAINT `paymentout_brandProfileId_fkey` FOREIGN KEY (`brandProfileId`) REFERENCES `brand_profile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paymentout` ADD CONSTRAINT `paymentout_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paymentout` ADD CONSTRAINT `paymentout_purchaseInvoiceId_fkey` FOREIGN KEY (`purchaseInvoiceId`) REFERENCES `purchaseinvoice`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expense` ADD CONSTRAINT `expense_brandProfileId_fkey` FOREIGN KEY (`brandProfileId`) REFERENCES `brand_profile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expense` ADD CONSTRAINT `expense_paymentId_fkey` FOREIGN KEY (`paymentId`) REFERENCES `payment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expense` ADD CONSTRAINT `expense_paymentOutId_fkey` FOREIGN KEY (`paymentOutId`) REFERENCES `paymentout`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `login_log` ADD CONSTRAINT `login_log_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notification` ADD CONSTRAINT `notification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notification` ADD CONSTRAINT `notification_brandProfileId_fkey` FOREIGN KEY (`brandProfileId`) REFERENCES `brand_profile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
