ALTER TABLE `brand_profile`
    ADD COLUMN `termsConditions` TEXT NULL,
    ADD COLUMN `showBrandName` BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN `showBrandDescription` BOOLEAN NOT NULL DEFAULT TRUE;
