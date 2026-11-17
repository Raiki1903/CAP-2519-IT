-- Issue #194: the asset categories move from an ENUM into the table asset_categories.
-- The category code stays the key: assets.category and category_metrics.category keep the same text in every row
-- and only gain a foreign key to asset_categories.code. No column is dropped and no asset row is rewritten.
-- Also adds REFERENCE_DATA_CHANGED (#194) and PASSWORD_CHANGED (#186) to the activity_log event types.

-- 1. CreateTable
CREATE TABLE `asset_categories` (
    `code` VARCHAR(30) NOT NULL,
    `label` VARCHAR(100) NOT NULL,
    `useful_life_years` INTEGER NOT NULL DEFAULT 5,
    `is_active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `asset_categories_label_key`(`label`),
    PRIMARY KEY (`code`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 2. The 20 categories the ENUM held, with the labels of shared/enums/assetCategory.ts. Useful life 5 years each.
INSERT INTO `asset_categories` (`code`, `label`, `useful_life_years`, `is_active`) VALUES
    ('DEV_KIT', 'Dev Kit', 5, true),
    ('MONITOR', 'Monitor', 5, true),
    ('TV', 'TV', 5, true),
    ('CPU', 'CPU', 5, true),
    ('KEYBOARD', 'Keyboard', 5, true),
    ('MOUSE', 'Mouse', 5, true),
    ('CAMERA', 'Camera', 5, true),
    ('MEMORY_CARD', 'Memory Card', 5, true),
    ('PROJECTOR', 'Projector', 5, true),
    ('RECORDER', 'Recorder', 5, true),
    ('ROUTER', 'Router', 5, true),
    ('SIMULATOR', 'Simulator', 5, true),
    ('TABLET', 'Tablet', 5, true),
    ('VR', 'VR', 5, true),
    ('PRINTER', 'Printer', 5, true),
    ('SWITCH', 'Switch', 5, true),
    ('HARD_DRIVE', 'Hard Drive', 5, true),
    ('AUDIO', 'Audio', 5, true),
    ('VIDEO_CAMERA', 'Video Camera', 5, true),
    ('SPEAKER', 'Speaker', 5, true);

-- 3. AlterTable: ENUM to VARCHAR in place. MODIFY keeps each row's value as the same text (the longest code has 12 letters).
-- category_metrics keeps its primary key (category, metric_id) through the MODIFY.
ALTER TABLE `assets` MODIFY `category` VARCHAR(30) NOT NULL;

ALTER TABLE `category_metrics` MODIFY `category` VARCHAR(30) NOT NULL;

-- 4. CreateIndex and AddForeignKey. A row whose category is not in asset_categories stops the migration here.
CREATE INDEX `assets_category_idx` ON `assets`(`category`);

ALTER TABLE `assets` ADD CONSTRAINT `assets_category_fkey` FOREIGN KEY (`category`) REFERENCES `asset_categories`(`code`) ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE `category_metrics` ADD CONSTRAINT `category_metrics_category_fkey` FOREIGN KEY (`category`) REFERENCES `asset_categories`(`code`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- 5. AlterTable: every earlier event type, then the two new ones at the end.
ALTER TABLE `activity_log` MODIFY `event_type` ENUM('LOGIN_SUCCESS', 'LOGIN_FAILURE', 'SIGNUP_APPROVED', 'SIGNUP_REJECTED', 'ROLE_CHANGED', 'LABS_CHANGED', 'HEAD_CHANGED', 'USER_DEACTIVATED', 'USER_REACTIVATED', 'USER_ANONYMIZED', 'TICKET_STATUS_CHANGED', 'ASSET_REGISTERED', 'ASSET_EDITED', 'ASSET_DELETED', 'ASSET_MARKED_MISSING', 'ASSET_FOUND', 'CLEARANCE_RECORD_PRINTED', 'PROJECT_CREATED', 'REFERENCE_DATA_CHANGED', 'PASSWORD_CHANGED') NOT NULL;
