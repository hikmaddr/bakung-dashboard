-- CreateTable
CREATE TABLE `signatureprofile` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NULL,
    `imageUrl` VARCHAR(191) NOT NULL,
    `brandProfileId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `signatureprofile_brandProfileId_idx`(`brandProfileId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `signatureprofile` ADD CONSTRAINT `signatureprofile_brandProfileId_fkey` FOREIGN KEY (`brandProfileId`) REFERENCES `brand_profile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

