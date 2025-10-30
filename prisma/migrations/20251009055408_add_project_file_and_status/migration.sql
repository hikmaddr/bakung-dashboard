-- AlterTable
ALTER TABLE `quotation` ADD COLUMN `projectFileUrl` VARCHAR(191) NULL,
    ADD COLUMN `status` VARCHAR(191) NOT NULL DEFAULT 'Draft';
