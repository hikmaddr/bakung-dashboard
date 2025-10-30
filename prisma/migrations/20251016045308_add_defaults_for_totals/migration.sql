-- AlterTable
ALTER TABLE `quotation` ADD COLUMN `totalAmount` DOUBLE NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `quotationitem` ADD COLUMN `subtotal` DOUBLE NOT NULL DEFAULT 0;
