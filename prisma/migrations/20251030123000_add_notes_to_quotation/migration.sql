-- Ensure `notes` column uses TEXT type; modify if it already exists
ALTER TABLE `quotation`
    MODIFY COLUMN `notes` TEXT NULL;
