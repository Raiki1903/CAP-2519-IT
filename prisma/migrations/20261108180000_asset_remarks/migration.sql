-- Issue #169: remarks on an asset. A new table only; nothing else changes.
-- A delete is soft: it sets deleted_by_id and deleted_at and keeps the row.

-- CreateTable
CREATE TABLE `asset_remarks` (
    `remark_id` INTEGER NOT NULL AUTO_INCREMENT,
    `asset_id` INTEGER NOT NULL,
    `author_id` INTEGER NOT NULL,
    `remark_text` VARCHAR(500) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deleted_by_id` INTEGER NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `asset_remarks_asset_id_idx`(`asset_id`),
    INDEX `asset_remarks_author_id_idx`(`author_id`),
    INDEX `asset_remarks_deleted_by_id_idx`(`deleted_by_id`),
    PRIMARY KEY (`remark_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `asset_remarks` ADD CONSTRAINT `asset_remarks_asset_id_fkey` FOREIGN KEY (`asset_id`) REFERENCES `assets`(`asset_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `asset_remarks` ADD CONSTRAINT `asset_remarks_author_id_fkey` FOREIGN KEY (`author_id`) REFERENCES `users`(`user_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `asset_remarks` ADD CONSTRAINT `asset_remarks_deleted_by_id_fkey` FOREIGN KEY (`deleted_by_id`) REFERENCES `users`(`user_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;
