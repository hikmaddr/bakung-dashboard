-- AlterTable
ALTER TABLE `brand_profile` ADD COLUMN `showBrandAddress` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `showBrandEmail` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `showBrandWebsite` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `customer` ADD COLUMN `brandProfileId` INTEGER NULL;

-- AlterTable
ALTER TABLE `invoice` ADD COLUMN `brandProfileId` INTEGER NULL,
    ADD COLUMN `quotationId` INTEGER NULL;

-- AlterTable
ALTER TABLE `product` ADD COLUMN `brandProfileId` INTEGER NULL;

-- AlterTable
ALTER TABLE `productcategory` ADD COLUMN `brandProfileId` INTEGER NULL;

-- AlterTable
ALTER TABLE `quotation` ADD COLUMN `brandProfileId` INTEGER NULL,
    MODIFY `notes` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `salesorder` ADD COLUMN `brandProfileId` INTEGER NULL;

-- AlterTable
ALTER TABLE `user` ADD COLUMN `defaultBrandProfileId` INTEGER NULL,
    ADD COLUMN `taxId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `user_brand_scope` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `brandProfileId` INTEGER NOT NULL,
    `isBrandAdmin` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `user_brand_scope_brandProfileId_idx`(`brandProfileId`),
    INDEX `user_brand_scope_userId_idx`(`userId`),
    UNIQUE INDEX `user_brand_scope_userId_brandProfileId_key`(`userId`, `brandProfileId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `customer_brandProfileId_idx` ON `customer`(`brandProfileId`);

-- CreateIndex
CREATE INDEX `invoice_quotationId_idx` ON `invoice`(`quotationId`);

-- CreateIndex
CREATE INDEX `invoice_brandProfileId_idx` ON `invoice`(`brandProfileId`);

-- CreateIndex
CREATE INDEX `product_brandProfileId_idx` ON `product`(`brandProfileId`);

-- CreateIndex
CREATE INDEX `productcategory_brandProfileId_idx` ON `productcategory`(`brandProfileId`);

-- CreateIndex
CREATE INDEX `quotation_brandProfileId_idx` ON `quotation`(`brandProfileId`);

-- CreateIndex
CREATE INDEX `salesorder_brandProfileId_idx` ON `salesorder`(`brandProfileId`);

-- CreateIndex
CREATE INDEX `user_defaultBrandProfileId_idx` ON `user`(`defaultBrandProfileId`);

-- AddForeignKey
ALTER TABLE `customer` ADD CONSTRAINT `customer_brandProfileId_fkey` FOREIGN KEY (`brandProfileId`) REFERENCES `brand_profile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quotation` ADD CONSTRAINT `quotation_brandProfileId_fkey` FOREIGN KEY (`brandProfileId`) REFERENCES `brand_profile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `salesorder` ADD CONSTRAINT `salesorder_brandProfileId_fkey` FOREIGN KEY (`brandProfileId`) REFERENCES `brand_profile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoice` ADD CONSTRAINT `invoice_quotationId_fkey` FOREIGN KEY (`quotationId`) REFERENCES `quotation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoice` ADD CONSTRAINT `invoice_brandProfileId_fkey` FOREIGN KEY (`brandProfileId`) REFERENCES `brand_profile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `productcategory` ADD CONSTRAINT `productcategory_brandProfileId_fkey` FOREIGN KEY (`brandProfileId`) REFERENCES `brand_profile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product` ADD CONSTRAINT `product_brandProfileId_fkey` FOREIGN KEY (`brandProfileId`) REFERENCES `brand_profile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user` ADD CONSTRAINT `user_defaultBrandProfileId_fkey` FOREIGN KEY (`defaultBrandProfileId`) REFERENCES `brand_profile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_brand_scope` ADD CONSTRAINT `user_brand_scope_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_brand_scope` ADD CONSTRAINT `user_brand_scope_brandProfileId_fkey` FOREIGN KEY (`brandProfileId`) REFERENCES `brand_profile`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
