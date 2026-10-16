-- CreateTable
CREATE TABLE `asset_disposals` (
    `disposal_id` INTEGER NOT NULL AUTO_INCREMENT,
    `asset_id` INTEGER NOT NULL,
    `disposed_by_id` INTEGER NOT NULL,
    `disposal_date` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `disposal_reason` TEXT NOT NULL,
    `status` VARCHAR(50) NOT NULL DEFAULT 'pending',

    INDEX `asset_disposals_asset_id_idx`(`asset_id`),
    INDEX `asset_disposals_disposed_by_id_idx`(`disposed_by_id`),
    PRIMARY KEY (`disposal_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `asset_monetary` (
    `asset_monetary_id` INTEGER NOT NULL AUTO_INCREMENT,
    `asset_id` INTEGER NOT NULL,
    `funding_source` VARCHAR(255) NOT NULL,
    `acquisition_value` DECIMAL(10, 2) NOT NULL,

    UNIQUE INDEX `asset_monetary_asset_id_key`(`asset_id`),
    PRIMARY KEY (`asset_monetary_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `asset_records` (
    `asset_record_id` INTEGER NOT NULL AUTO_INCREMENT,
    `asset_id` INTEGER NOT NULL,
    `status` ENUM('ACTIVE', 'ON_LOAN', 'MAINTENANCE', 'DISPOSED') NOT NULL,
    `location` VARCHAR(255) NOT NULL,
    `current_location` VARCHAR(255) NULL,
    `date_logged` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `current_custodian` INTEGER NOT NULL,
    `asset_condition` ENUM('PERFECT', 'OPERATIONAL', 'MINOR DRIFT', 'DEGRADED', 'CRITICAL DEFECT') NOT NULL DEFAULT 'PERFECT',
    `Asset_Remarks` TEXT NULL,
    `project_id` INTEGER NULL,
    `transfer_id` INTEGER NULL,
    `disposal_id` INTEGER NULL,
    `repair_id` INTEGER NULL,

    INDEX `asset_records_asset_id_idx`(`asset_id`),
    INDEX `asset_records_current_custodian_idx`(`current_custodian`),
    INDEX `fk_records_project`(`project_id`),
    PRIMARY KEY (`asset_record_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `asset_repairs` (
    `repair_id` INTEGER NOT NULL AUTO_INCREMENT,
    `asset_id` INTEGER NOT NULL,
    `reported_by_id` INTEGER NOT NULL,
    `issue_description` TEXT NOT NULL,
    `is_immediate` BOOLEAN NOT NULL DEFAULT false,
    `progress_status` VARCHAR(100) NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `asset_repairs_asset_id_idx`(`asset_id`),
    INDEX `asset_repairs_reported_by_id_idx`(`reported_by_id`),
    PRIMARY KEY (`repair_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `assets` (
    `asset_id` INTEGER NOT NULL AUTO_INCREMENT,
    `asset_tag` VARCHAR(50) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `serial_number` VARCHAR(255) NULL,
    `manufacturer` VARCHAR(255) NULL,
    `category` ENUM('DEV_KIT', 'MONITOR', 'TV', 'CPU', 'KEYBOARD', 'MOUSE', 'CAMERA', 'MEMORY_CARD', 'PROJECTOR', 'RECORDER', 'ROUTER', 'SIMULATOR', 'TABLET', 'VR', 'PRINTER', 'SWITCH', 'HARD_DRIVE', 'AUDIO', 'VIDEO_CAMERA', 'SPEAKER') NOT NULL,
    `procurement_date` DATE NULL,
    `warranty_expiry` DATE NULL,
    `image_url` LONGTEXT NULL,

    UNIQUE INDEX `assets_asset_tag_key`(`asset_tag`),
    PRIMARY KEY (`asset_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `asset_reports` (
    `report_id` INTEGER NOT NULL AUTO_INCREMENT,
    `asset_id` INTEGER NOT NULL,
    `reported_by_id` INTEGER NOT NULL,
    `report_date` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `report_img` LONGTEXT NULL,
    `report_condition` ENUM('PERFECT', 'OPERATIONAL', 'MINOR DRIFT', 'DEGRADED', 'CRITICAL DEFECT') NOT NULL,
    `report_remarks` VARCHAR(255) NULL,

    INDEX `asset_reports_asset_id_idx`(`asset_id`),
    INDEX `asset_reports_reported_by_id_idx`(`reported_by_id`),
    PRIMARY KEY (`report_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `research_centers` (
    `center_id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,
    `short_code` VARCHAR(50) NOT NULL,
    `location` ENUM('MANILA', 'LAGUNA') NOT NULL,

    UNIQUE INDEX `research_centers_short_code_key`(`short_code`),
    PRIMARY KEY (`center_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `roles` (
    `role_id` INTEGER NOT NULL AUTO_INCREMENT,
    `role_name` ENUM('ADMIN', 'ADRIC_DIRECTOR', 'ADRIC_SECRETARY', 'TSG_STAFF', 'ITS_STAFF', 'LAB_HEAD', 'CUSTODIAN') NOT NULL,

    PRIMARY KEY (`role_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_centers` (
    `user_centers_id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `center_id` INTEGER NOT NULL,

    INDEX `user_centers_center_id_idx`(`center_id`),
    INDEX `user_centers_user_id_idx`(`user_id`),
    PRIMARY KEY (`user_centers_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_roles` (
    `user_role_id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `role_id` INTEGER NOT NULL,

    INDEX `user_roles_role_id_idx`(`role_id`),
    INDEX `user_roles_user_id_idx`(`user_id`),
    PRIMARY KEY (`user_role_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `user_id` INTEGER NOT NULL AUTO_INCREMENT,
    `first_name` VARCHAR(255) NOT NULL,
    `last_name` VARCHAR(255) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `password` VARCHAR(255) NOT NULL,
    `id_number` INTEGER NOT NULL,
    `user_img` LONGTEXT NULL,
    `user_type` ENUM('STUDENT', 'FACULTY', 'STAFF') NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    UNIQUE INDEX `users_id_number_key`(`id_number`),
    PRIMARY KEY (`user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `asset_loans` (
    `loan_id` INTEGER NOT NULL AUTO_INCREMENT,
    `asset_id` INTEGER NOT NULL,
    `borrower_id` INTEGER NOT NULL,
    `purpose` TEXT NOT NULL,
    `loaned_on` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `due_date` DATE NOT NULL,
    `status` VARCHAR(50) NOT NULL DEFAULT 'pending',

    INDEX `asset_loans_asset_id_idx`(`asset_id`),
    INDEX `asset_loans_borrower_id_idx`(`borrower_id`),
    PRIMARY KEY (`loan_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `asset_returns` (
    `return_id` INTEGER NOT NULL AUTO_INCREMENT,
    `asset_id` INTEGER NOT NULL,
    `returned_by_id` INTEGER NOT NULL,
    `reference_number` VARCHAR(100) NOT NULL,
    `returned_on` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `comments` VARCHAR(255) NULL,
    `condition` ENUM('PERFECT', 'OPERATIONAL', 'MINOR_DRIFT', 'DEGRADED', 'CRITICAL_DEFECT') NULL,

    UNIQUE INDEX `asset_returns_reference_number_key`(`reference_number`),
    INDEX `asset_returns_asset_id_idx`(`asset_id`),
    INDEX `asset_returns_returned_by_id_idx`(`returned_by_id`),
    PRIMARY KEY (`return_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `asset_transfers` (
    `transfer_id` INTEGER NOT NULL AUTO_INCREMENT,
    `asset_id` INTEGER NOT NULL,
    `from_custodian_id` INTEGER NOT NULL,
    `to_custodian_id` INTEGER NOT NULL,
    `justification` TEXT NOT NULL,
    `status` VARCHAR(50) NOT NULL DEFAULT 'pending',
    `requested_on` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `asset_transfers_asset_id_idx`(`asset_id`),
    PRIMARY KEY (`transfer_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `projects` (
    `master_id` INTEGER NOT NULL AUTO_INCREMENT,
    `project_id` VARCHAR(255) NOT NULL,
    `project_name` VARCHAR(255) NOT NULL,
    `project_leader` VARCHAR(255) NOT NULL,
    `center_id` INTEGER NOT NULL,
    `funding_agency` VARCHAR(255) NOT NULL,
    `start_date` DATE NOT NULL,
    `end_date` DATE NULL,

    UNIQUE INDEX `projects_project_id_key`(`project_id`),
    INDEX `fk_projects_center`(`center_id`),
    PRIMARY KEY (`master_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `asset_disposals` ADD CONSTRAINT `fk_disposals_asset` FOREIGN KEY (`asset_id`) REFERENCES `assets`(`asset_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `asset_disposals` ADD CONSTRAINT `fk_disposals_user` FOREIGN KEY (`disposed_by_id`) REFERENCES `users`(`user_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `asset_monetary` ADD CONSTRAINT `fk_monetary_asset` FOREIGN KEY (`asset_id`) REFERENCES `assets`(`asset_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `asset_records` ADD CONSTRAINT `fk_assets_project` FOREIGN KEY (`project_id`) REFERENCES `projects`(`master_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `asset_records` ADD CONSTRAINT `fk_records_asset` FOREIGN KEY (`asset_id`) REFERENCES `assets`(`asset_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `asset_records` ADD CONSTRAINT `fk_records_custodian` FOREIGN KEY (`current_custodian`) REFERENCES `users`(`user_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `asset_repairs` ADD CONSTRAINT `fk_repairs_asset` FOREIGN KEY (`asset_id`) REFERENCES `assets`(`asset_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `asset_repairs` ADD CONSTRAINT `fk_repairs_reporter` FOREIGN KEY (`reported_by_id`) REFERENCES `users`(`user_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `asset_reports` ADD CONSTRAINT `fk_reports_asset` FOREIGN KEY (`asset_id`) REFERENCES `assets`(`asset_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `asset_reports` ADD CONSTRAINT `fk_reports_user` FOREIGN KEY (`reported_by_id`) REFERENCES `users`(`user_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `user_centers` ADD CONSTRAINT `fk_user_centers_center` FOREIGN KEY (`center_id`) REFERENCES `research_centers`(`center_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `user_centers` ADD CONSTRAINT `fk_user_centers_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `user_roles` ADD CONSTRAINT `fk_user_roles_role` FOREIGN KEY (`role_id`) REFERENCES `roles`(`role_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `user_roles` ADD CONSTRAINT `fk_user_roles_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `asset_loans` ADD CONSTRAINT `fk_loans_asset` FOREIGN KEY (`asset_id`) REFERENCES `assets`(`asset_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `asset_loans` ADD CONSTRAINT `fk_loans_borrower` FOREIGN KEY (`borrower_id`) REFERENCES `users`(`user_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `asset_returns` ADD CONSTRAINT `fk_returns_asset` FOREIGN KEY (`asset_id`) REFERENCES `assets`(`asset_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `asset_returns` ADD CONSTRAINT `fk_returns_processor` FOREIGN KEY (`returned_by_id`) REFERENCES `users`(`user_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `asset_transfers` ADD CONSTRAINT `fk_transfers_asset` FOREIGN KEY (`asset_id`) REFERENCES `assets`(`asset_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `projects` ADD CONSTRAINT `fk_projects_center` FOREIGN KEY (`center_id`) REFERENCES `research_centers`(`center_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;
