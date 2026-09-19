-- ==========================================
-- MySQL Schema
-- Generated from Prisma schema
-- ==========================================

-- Drop the database if it already exists, then recreate it
DROP DATABASE IF EXISTS `AdRIC_DB`;
CREATE DATABASE `AdRIC_DB` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `AdRIC_DB`;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ==========================================
-- CORE ENTITIES
-- ==========================================

CREATE TABLE `roles` (
  `role_id`   INT NOT NULL AUTO_INCREMENT,
  `role_name` ENUM('ADMIN','ADRIC_DIRECTOR','ADRIC_SECRETARY','TSG_STAFF','ITS_STAFF','LAB_HEAD','CUSTODIAN') NOT NULL,
  PRIMARY KEY (`role_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `research_centers` (
  `center_id`  INT NOT NULL AUTO_INCREMENT,
  `name`       VARCHAR(255) NOT NULL,
  `short_code` VARCHAR(50) NOT NULL,
  `location`   ENUM('MANILA','LAGUNA') NOT NULL,
  PRIMARY KEY (`center_id`),
  UNIQUE KEY `research_centers_short_code_key` (`short_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `users` (
  `user_id`    INT NOT NULL AUTO_INCREMENT,
  `first_name` VARCHAR(255) NOT NULL,
  `last_name`  VARCHAR(255) NOT NULL,
  `email`      VARCHAR(255) NOT NULL,
  `password`   VARCHAR(255) NOT NULL,
  `id_number`  INT NOT NULL,
  `user_img`   VARCHAR(500) NULL,
  `user_type`  ENUM('STUDENT','FACULTY','STAFF') NOT NULL,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `users_email_key` (`email`),
  UNIQUE KEY `users_id_number_key` (`id_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `assets` (
  `asset_id`         INT NOT NULL AUTO_INCREMENT,
  `asset_tag`        VARCHAR(50) NOT NULL,
  `name`             VARCHAR(255) NOT NULL,
  `serial_number`    VARCHAR(255) NULL,
  `manufacturer`     VARCHAR(255) NULL,
  `category`         ENUM(
    'DEV_KIT', 'MONITOR', 'TV', 'CPU', 'KEYBOARD', 'MOUSE', 'CAMERA',
    'MEMORY_CARD', 'PROJECTOR', 'RECORDER', 'ROUTER', 'SIMULATOR',
    'TABLET', 'VR', 'PRINTER', 'SWITCH', 'HARD_DRIVE', 'AUDIO',
    'VIDEO_CAMERA', 'SPEAKER'
  ) NOT NULL,
  `procurement_date` DATE NULL,
  `warranty_expiry`  DATE NULL,
  `image_url`        VARCHAR(500) NULL,
  PRIMARY KEY (`asset_id`),
  UNIQUE KEY `assets_asset_tag_key` (`asset_tag`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `projects` (
  `master_id`         INT NOT NULL AUTO_INCREMENT,
  `project_id`        VARCHAR(255) NOT NULL,
  `project_name`      VARCHAR(255) NOT NULL,
  `project_leader`    VARCHAR(255) NOT NULL,
  `center_id`         INT NOT NULL,
  `funding_agency`    VARCHAR(255) NOT NULL,
  `start_date`        DATE NOT NULL,
  `end_date`          DATE NULL,
  PRIMARY KEY (`master_id`),
  UNIQUE KEY `projects_project_id_key` (`project_id`),
  CONSTRAINT `fk_projects_center` FOREIGN KEY (`center_id`) REFERENCES `research_centers` (`center_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- ==========================================
-- ASSET DETAILS & RECORDS
-- ==========================================

CREATE TABLE `asset_monetary` (
  `asset_monetary_id` INT NOT NULL AUTO_INCREMENT,
  `asset_id`          INT NOT NULL,
  `funding_source`    VARCHAR(255) NOT NULL,
  `acquisition_value` DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (`asset_monetary_id`),
  UNIQUE KEY `asset_monetary_asset_id_key` (`asset_id`),
  CONSTRAINT `fk_monetary_asset` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`asset_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `asset_records` (
  `asset_record_id`   INT NOT NULL AUTO_INCREMENT,
  `asset_id`          INT NOT NULL,
  `status`            ENUM('ACTIVE','ON_LOAN','MAINTENANCE','DISPOSED') NOT NULL,
  `location`          VARCHAR(255) NOT NULL,
  `current_location`  VARCAHR(255) NULL,
  `date_logged`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `current_custodian` INT NOT NULL,
  `asset_condition`   ENUM('PERFECT','OPERATIONAL','MINOR DRIFT','DEGRADED','CRITICAL DEFECT') NOT NULL DEFAULT 'PERFECT',
  `Asset_Remarks`     VARCHAR(255) NULL,
  `project_id`        INT NULL,
  `transfer_id`       INT NULL,
  `disposal_id`       INT NULL,
  `repair_id`         INT NULL,
  PRIMARY KEY (`asset_record_id`),
  KEY `asset_records_asset_id_idx` (`asset_id`),
  KEY `asset_records_current_custodian_idx` (`current_custodian`),
  CONSTRAINT `fk_records_asset` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`asset_id`),
  CONSTRAINT `fk_records_custodian` FOREIGN KEY (`current_custodian`) REFERENCES `users` (`user_id`),
  CONSTRAINT `fk_records_project` FOREIGN KEY (`project_id`) REFERENCES `projects` (`master_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ==========================================
-- TRANSACTIONAL FORMS (LOANS, REPAIRS, ETC.)
-- ==========================================

CREATE TABLE `asset_loans` (
  `loan_id`     INT NOT NULL AUTO_INCREMENT,
  `asset_id`    INT NOT NULL,
  `borrower_id` INT NOT NULL,
  `purpose`     TEXT NOT NULL,
  `loaned_on`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `due_date`    DATE NOT NULL,
  `status`      VARCHAR(50) NOT NULL DEFAULT 'pending',
  PRIMARY KEY (`loan_id`),
  KEY `asset_loans_asset_id_idx` (`asset_id`),
  KEY `asset_loans_borrower_id_idx` (`borrower_id`),
  CONSTRAINT `fk_loans_asset` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`asset_id`),
  CONSTRAINT `fk_loans_borrower` FOREIGN KEY (`borrower_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `asset_repairs` (
  `repair_id`         INT NOT NULL AUTO_INCREMENT,
  `asset_id`          INT NOT NULL,
  `reported_by_id`    INT NOT NULL,
  `issue_description` TEXT NOT NULL,
  `is_immediate`      BOOLEAN NOT NULL DEFAULT FALSE,
  `progress_status`   VARCHAR(100) NOT NULL,
  `created_at`        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`repair_id`),
  KEY `asset_repairs_asset_id_idx` (`asset_id`),
  KEY `asset_repairs_reported_by_id_idx` (`reported_by_id`),
  CONSTRAINT `fk_repairs_asset` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`asset_id`),
  CONSTRAINT `fk_repairs_reporter` FOREIGN KEY (`reported_by_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `asset_transfers` (
  `transfer_id`       INT NOT NULL AUTO_INCREMENT,
  `asset_id`          INT NOT NULL,
  `from_custodian_id` INT NOT NULL,
  `to_custodian_id`   INT NOT NULL,
  `justification`     TEXT NOT NULL,
  `status`            VARCHAR(50) NOT NULL DEFAULT 'pending',
  `requested_on`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`transfer_id`),
  KEY `asset_transfers_asset_id_idx` (`asset_id`),
  CONSTRAINT `fk_transfers_asset` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`asset_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `asset_returns` (
  `return_id`        INT NOT NULL AUTO_INCREMENT,
  `asset_id`         INT NOT NULL,
  `returned_by_id`   INT NOT NULL,
  `condition`        ENUM('PERFECT','OPERATIONAL','MINOR DRIFT','DEGRADED','CRITICAL DEFECT') NOT NULL,
  `comments`         VARCHAR(255) NULL,
  `reference_number` VARCHAR(100) NOT NULL,
  `returned_on`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`return_id`),
  UNIQUE KEY `asset_returns_reference_number_key` (`reference_number`),
  KEY `asset_returns_asset_id_idx` (`asset_id`),
  KEY `asset_returns_returned_by_id_idx` (`returned_by_id`),
  CONSTRAINT `fk_returns_asset` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`asset_id`),
  CONSTRAINT `fk_returns_processor` FOREIGN KEY (`returned_by_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `asset_disposals` (
  `disposal_id`     INT NOT NULL AUTO_INCREMENT,
  `asset_id`        INT NOT NULL,
  `disposed_by_id`  INT NOT NULL,
  `disposal_date`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `disposal_reason` TEXT NOT NULL,
  `status`          VARCHAR(50) NOT NULL DEFAULT 'pending',
  PRIMARY KEY (`disposal_id`),
  KEY `asset_disposals_asset_id_idx` (`asset_id`),
  KEY `asset_disposals_disposed_by_id_idx` (`disposed_by_id`),
  CONSTRAINT `fk_disposals_asset` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`asset_id`),
  CONSTRAINT `fk_disposals_user` FOREIGN KEY (`disposed_by_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `asset_reports` (
  `report_id` INT NOT NULL AUTO_INCREMENT,
  `asset_id` INT NOT NULL,
  `reported_by_id` INT NOT NULL,
  `report_date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `report_img` VARCHAR(500) NULL,
  `report_condition` ENUM('PERFECT','OPERATIONAL','MINOR DRIFT','DEGRADED','CRITICAL DEFECT') NOT NULL,
  `report_remarks` VARCHAR(255) NULL, -- ADDED COMMA HERE
  PRIMARY KEY (`report_id`),
  KEY `asset_reports_asset_id_idx` (`asset_id`),
  KEY `asset_reports_reported_by_id_idx` (`reported_by_id`),
  CONSTRAINT `fk_reports_asset` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`asset_id`),
  CONSTRAINT `fk_reports_user` FOREIGN KEY (`reported_by_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- ==========================================
-- MAPPING TABLES (MANY-TO-MANY)
-- ==========================================

CREATE TABLE `user_roles` (
  `user_role_id` INT NOT NULL AUTO_INCREMENT,
  `user_id`      INT NOT NULL,
  `role_id`      INT NOT NULL,
  PRIMARY KEY (`user_role_id`),
  KEY `user_roles_role_id_idx` (`role_id`),
  KEY `user_roles_user_id_idx` (`user_id`),
  CONSTRAINT `fk_user_roles_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `fk_user_roles_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`role_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `user_centers` (
  `user_centers_id` INT NOT NULL AUTO_INCREMENT,
  `user_id`         INT NOT NULL,
  `center_id`       INT NOT NULL,
  PRIMARY KEY (`user_centers_id`),
  KEY `user_centers_center_id_idx` (`center_id`),
  KEY `user_centers_user_id_idx` (`user_id`),
  CONSTRAINT `fk_user_centers_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `fk_user_centers_center` FOREIGN KEY (`center_id`) REFERENCES `research_centers` (`center_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;

-- ==========================================
-- INSERT: roles
-- ==========================================
INSERT INTO `roles` (`role_id`, `role_name`) VALUES
(1, 'ADMIN'),
(2, 'ADRIC_DIRECTOR'),
(3, 'ADRIC_SECRETARY'),
(4, 'TSG_STAFF'),
(5, 'LAB_HEAD'),
(6, 'CUSTODIAN');

-- ==========================================
-- INSERT: research_centers
-- ==========================================
INSERT INTO `research_centers` (`center_id`, `name`, `short_code`, `location`) VALUES
(1, 'Center for ICT for Development (CITE4D)', 'CITe4D', 'MANILA'),
(2, 'Center for Automation Research (CAR)', 'CAR', 'LAGUNA'),
(3, 'Center for Human-Computer Innovations (CeHCI)', 'CeHCI', 'MANILA'),
(4, 'Human-X Interactions Lab', 'HXIL', 'LAGUNA'),
(5, 'Graphics, Animation, Multimedia and Entertainment Laboratory (GAME Lab)', 'GAME', 'MANILA'),
(6, 'Center for Language Technologies (CeLT)', 'CeLT', 'MANILA'),
(7, 'Bioinformatics Lab', 'Bio', 'MANILA'),
(8, 'Center for Networking and Information Security (CNIS)', 'CNIS', 'MANILA'),
(9, 'Computational Imaging and Visual Innovations (CIVI)', 'CIVI', 'MANILA'),
(10, 'Technology, Education, Entertainment, Empathy, Design (TE3D) House', 'TE3D', 'LAGUNA');

-- ==========================================
-- INSERT: users
-- ==========================================
INSERT INTO `users` (`user_id`, `first_name`, `last_name`, `email`, `password`, `id_number`, `user_type`) VALUES
(1, 'ITS', 'Admin', 'its@dlsu.edu.ph', 'its_password', 11111111, 'FACULTY'),
(2, 'TSG', 'Staff', 'tsg@dlsu.edu.ph', 'tsg_password', 22222222, 'FACULTY'),
(3, 'A.', 'Dela Cruz', 'custodian@dlsu.edu.ph', 'custodian_password', 44444444, 'STUDENT'),
(4, 'Dr. Joel', 'Ilao', 'director@dlsu.edu.ph', 'director_password', 12121212, 'FACULTY'),
(5, 'Dr. Michael', 'Cruz', 'labhead.cite4d@dlsu.edu.ph', 'labhead_password', 20000001, 'FACULTY'),
(6, 'Dr. Andrea', 'Reyes', 'labhead.car@dlsu.edu.ph', 'labhead_password', 20000002, 'FACULTY'),
(7, 'Dr. Patricia', 'Lim', 'labhead.cehci@dlsu.edu.ph', 'labhead_password', 20000003, 'FACULTY'),
(8, 'Dr. Ramon', 'Villanueva', 'labhead.hxil@dlsu.edu.ph', 'labhead_password', 20000004, 'FACULTY'),
(9, 'Dr. Grace', 'Uy', 'labhead.game@dlsu.edu.ph', 'labhead_password', 20000005, 'FACULTY'),
(10, 'Dr. Francis', 'Bautista', 'labhead.celt@dlsu.edu.ph', 'labhead_password', 20000006, 'FACULTY'),
(11, 'Dr. Carmela', 'Santos', 'labhead.bio@dlsu.edu.ph', 'labhead_password', 20000007, 'FACULTY'),
(12, 'Dr. Victor', 'Aquino', 'labhead.cnis@dlsu.edu.ph', 'labhead_password', 20000008, 'FACULTY'),
(13, 'Dr. Isabel', 'Manalo', 'labhead.civi@dlsu.edu.ph', 'labhead_password', 20000009, 'FACULTY'),
(14, 'Dr. Nathaniel', 'Ocampo', 'labhead.te3d@dlsu.edu.ph', 'labhead_password', 20000010, 'FACULTY');

-- ==========================================
-- INSERT: user_roles
-- ==========================================
INSERT INTO `user_roles` (`user_role_id`, `user_id`, `role_id`) VALUES
(1, 1, 1),
(2, 2, 4),
(3, 4, 6),
(4, 5, 5),
(5, 6, 5),
(6, 7, 5),
(7, 8, 5),
(8, 9, 5),
(9, 10, 5),
(10, 11, 5),
(11, 12, 5),
(12, 13, 5),
(13, 14, 5);
(14, 3, 6);

-- ==========================================
-- INSERT: user_centers
-- ==========================================
INSERT INTO `user_centers` (`user_centers_id`, `user_id`, `center_id`) VALUES
(1, 3, 1),
(2, 5, 1),
(3, 6, 2),
(4, 7, 3),
(5, 8, 4),
(6, 9, 5),
(7, 10, 6),
(8, 11, 7),
(9, 12, 8),
(10, 13, 9),
(11, 14, 10);


INSERT INTO `projects` (`project_id`, `project_name`, `project_leader`, `center_id`, `funding_agency`, `start_date`, `end_date`) VALUES
(1, 'Smart Campus IoT Initiative',        'Dr. Juan Dela Cruz', 1, 'DOST-SEI',      '2025-08-01', NULL),
(2, 'Human-Computer Interaction Lab Study', 'Dr. Elena Castro',   1, 'CHED',          '2025-06-15', '2026-06-15'),
(3, 'AR/VR Learning Tools Research',       'Dr. Santos',         1, 'DOST-PCIEERD',  '2026-01-10', NULL);

-- ==========================================
-- INSERT: assets  (10 per lab, grouped by lab, for all 10 research labs)
-- ==========================================
INSERT INTO `assets` (`asset_id`, `asset_tag`, `name`, `serial_number`, `manufacturer`, `category`, `procurement_date`, `warranty_expiry`, `image_url`) VALUES
-- CITe4D (center_id 1, Manila)
(1, 'CITe4D-0001', 'ASUS TUF Gaming A15', 'SN-TUFN1G401', 'ASUS', 'DEV_KIT', '2025-08-10', '2027-08-10', NULL),
(2, 'CITe4D-0002', 'Dell UltraSharp 27" Monitor', 'SN-DELLU27X', 'Dell', 'MONITOR', '2025-08-10', '2028-08-10', NULL),
(3, 'CITe4D-0003', 'Logitech MX Master 3S', 'SN-LGMX3S22', 'Logitech', 'MOUSE', '2025-09-01', '2026-09-01', NULL),
(4, 'CITe4D-0004', 'Meta Quest 3', 'SN-MQ3-0091', 'Meta', 'VR', '2026-01-15', '2027-01-15', NULL),
(5, 'CITe4D-0005', 'Canon EOS 90D', 'SN-CN90D-77', 'Canon', 'CAMERA', '2025-07-20', '2027-07-20', NULL),
(6, 'CITe4D-0006', 'Raspberry Pi 5 Kit', 'SN-RPI5-0036', 'Raspberry Pi Foundation', 'DEV_KIT', '2026-03-01', '2028-03-01', NULL),
(7, 'CITe4D-0007', 'Logitech C920 Webcam', 'SN-LGC920-046', 'Logitech', 'CAMERA', '2025-11-05', '2027-11-05', NULL),
(8, 'CITe4D-0008', 'Samsung T7 Portable SSD 1TB', 'SN-SMT7SSD-047', 'Samsung', 'HARD_DRIVE', '2025-11-05', '2028-11-05', NULL),
(9, 'CITe4D-0009', 'Apple Magic Keyboard', 'SN-APLMK-048', 'Apple', 'KEYBOARD', '2025-12-01', '2027-12-01', NULL),
(10, 'CITe4D-0010', 'Anker PowerConf S500 Speakerphone', 'SN-ANKPC-049', 'Anker', 'AUDIO', '2025-12-01', '2027-12-01', NULL),

-- CAR (center_id 2, Laguna)
(11, 'CAR-0001', 'Robotics Arm Simulator Kit', 'SN-RASK-104', 'Universal Robots', 'SIMULATOR', '2025-05-12', '2027-05-12', NULL),
(12, 'CAR-0002', 'Intel NUC 13 Mini PC', 'SN-NUC13-882', 'Intel', 'CPU', '2025-09-18', '2028-09-18', NULL),
(13, 'CAR-0003', 'Cisco Catalyst 24-Port Switch', 'SN-CISC24-19', 'Cisco', 'SWITCH', '2025-04-02', '2028-04-02', NULL),
(14, 'CAR-0004', 'TP-Link Archer AX55 Router', 'SN-TPAX55-03', 'TP-Link', 'ROUTER', '2025-11-01', '2027-11-01', NULL),
(15, 'CAR-0005', 'SanDisk Extreme Pro 256GB', 'SN-SDXP256-6', 'SanDisk', 'MEMORY_CARD', '2026-01-20', '2027-01-20', NULL),
(16, 'CAR-0006', 'KUKA LBR iiwa Collaborative Arm', 'SN-KUKAIIWA-1', 'KUKA', 'SIMULATOR', '2026-02-14', '2029-02-14', NULL),
(17, 'CAR-0007', 'Universal Robots UR5e Arm', 'SN-URUR5E-050', 'Universal Robots', 'SIMULATOR', '2026-01-08', '2029-01-08', NULL),
(18, 'CAR-0008', 'Raspberry Pi Compute Module Kit', 'SN-RPICM-051', 'Raspberry Pi Foundation', 'DEV_KIT', '2026-01-08', '2028-01-08', NULL),
(19, 'CAR-0009', 'FLIR C5 Thermal Camera', 'SN-FLIRC5-052', 'FLIR', 'CAMERA', '2026-01-20', '2028-01-20', NULL),
(20, 'CAR-0010', 'D-Link 16-Port Gigabit Switch', 'SN-DLK16P-053', 'D-Link', 'SWITCH', '2026-01-20', '2029-01-20', NULL),

-- CeHCI (center_id 3, Manila)
(21, 'CeHCI-0001', 'iPad Pro 12.9"', 'SN-IPADP-441', 'Apple', 'TABLET', '2025-07-08', '2027-07-08', NULL),
(22, 'CeHCI-0002', 'Logitech MX Keys', 'SN-MXKEYS-12', 'Logitech', 'KEYBOARD', '2025-08-22', '2026-08-22', NULL),
(23, 'CeHCI-0003', 'Focusrite Scarlett 2i2', 'SN-FSCAR-289', 'Focusrite', 'AUDIO', '2025-06-30', '2027-06-30', NULL),
(24, 'CeHCI-0004', 'Zoom H6 Audio Recorder', 'SN-ZH6-554', 'Zoom', 'RECORDER', '2025-10-14', '2027-10-14', NULL),
(25, 'CeHCI-0005', 'LG UltraFine 24" Monitor', 'SN-LGUF24-71', 'LG', 'MONITOR', '2025-09-05', '2028-09-05', NULL),
(26, 'CeHCI-0006', 'Wacom Cintiq Pro 24', 'SN-WACCP24-6', 'Wacom', 'TABLET', '2026-01-22', '2028-01-22', NULL),
(27, 'CeHCI-0007', 'Tobii Eye Tracker 5', 'SN-TOBET5-054', 'Tobii', 'CAMERA', '2025-10-14', '2027-10-14', NULL),
(28, 'CeHCI-0008', 'Elgato Stream Deck+', 'SN-ELGSD-055', 'Elgato', 'DEV_KIT', '2025-10-14', '2027-10-14', NULL),
(29, 'CeHCI-0009', 'Shure SM7B Microphone', 'SN-SHRSM7B-056', 'Shure', 'AUDIO', '2025-11-02', '2027-11-02', NULL),
(30, 'CeHCI-0010', 'Sony WH-1000XM5 Headphones', 'SN-SNYWH5-057', 'Sony', 'AUDIO', '2025-11-02', '2027-11-02', NULL),

-- HXIL (center_id 4, Laguna)
(31, 'HXIL-0001', 'Sony FX3 Cinema Camera', 'SN-SFX3-908', 'Sony', 'VIDEO_CAMERA', '2026-02-01', '2028-02-01', NULL),
(32, 'HXIL-0002', 'Samsung 55" QLED TV', 'SN-SMQL55-31', 'Samsung', 'TV', '2025-12-10', '2028-12-10', NULL),
(33, 'HXIL-0003', 'JBL EON615 Powered Speaker', 'SN-JBLE615-8', 'JBL', 'SPEAKER', '2025-05-25', '2027-05-25', NULL),
(34, 'HXIL-0004', 'BenQ TK850 4K Projector', 'SN-BQTK850-4', 'BenQ', 'PROJECTOR', '2025-03-19', '2027-03-19', NULL),
(35, 'HXIL-0005', 'WD My Book 8TB', 'SN-WDMB8T-55', 'Western Digital', 'HARD_DRIVE', '2025-11-27', '2028-11-27', NULL),
(36, 'HXIL-0006', 'GoPro Hero 12 Black', 'SN-GPH12BK-9', 'GoPro', 'VIDEO_CAMERA', '2026-02-05', '2028-02-05', NULL),
(37, 'HXIL-0007', 'DJI Osmo Pocket 3', 'SN-DJIOP3-058', 'DJI', 'VIDEO_CAMERA', '2026-01-12', '2028-01-12', NULL),
(38, 'HXIL-0008', 'Rode Wireless GO II', 'SN-RDWGO2-059', 'Rode', 'AUDIO', '2026-01-12', '2028-01-12', NULL),
(39, 'HXIL-0009', 'Anker 27" 4K Monitor', 'SN-ANK27K-060', 'Anker', 'MONITOR', '2026-01-25', '2029-01-25', NULL),
(40, 'HXIL-0010', 'Zoom PodTrak P4 Recorder', 'SN-ZMPTP4-061', 'Zoom', 'RECORDER', '2026-01-25', '2028-01-25', NULL),

-- GAME (center_id 5, Manila)
(41, 'GAME-0001', 'Steam Deck OLED', 'SN-STDKOL-19', 'Valve', 'DEV_KIT', '2026-01-05', '2027-01-05', NULL),
(42, 'GAME-0002', 'Custom Gaming PC (RTX 4070)', 'SN-GPCRTX-70', 'Custom Build', 'CPU', '2025-10-30', '2028-10-30', NULL),
(43, 'GAME-0003', 'ASUS ROG Swift 27" Monitor', 'SN-ROGSW27-2', 'ASUS', 'MONITOR', '2025-10-30', '2028-10-30', NULL),
(44, 'GAME-0004', 'Logitech StreamCam', 'SN-LGSCAM-45', 'Logitech', 'CAMERA', '2025-08-14', '2026-08-14', NULL),
(45, 'GAME-0005', 'Razer BlackWidow V4 Keyboard', 'SN-RZBWV4-16', 'Razer', 'KEYBOARD', '2025-08-14', '2026-08-14', NULL),
(46, 'GAME-0006', 'PlayStation 5 Dev Kit', 'SN-PS5DK-014', 'Sony', 'DEV_KIT', '2026-01-30', '2028-01-30', NULL),
(47, 'GAME-0007', 'Xbox Series X Dev Console', 'SN-XBXSX-062', 'Microsoft', 'DEV_KIT', '2025-09-14', '2027-09-14', NULL),
(48, 'GAME-0008', 'SteelSeries Arctis Nova Pro Headset', 'SN-SSANP-063', 'SteelSeries', 'AUDIO', '2025-09-14', '2027-09-14', NULL),
(49, 'GAME-0009', 'Elgato Game Capture HD60X', 'SN-ELGHD60-064', 'Elgato', 'RECORDER', '2025-09-28', '2027-09-28', NULL),
(50, 'GAME-0010', 'LG UltraGear 27" Monitor', 'SN-LGUG27-065', 'LG', 'MONITOR', '2025-09-28', '2028-09-28', NULL),

-- CeLT (center_id 6, Manila)
(51, 'CeLT-0001', 'Samsung Galaxy Tab S9', 'SN-SGTS9-233', 'Samsung', 'TABLET', '2025-07-16', '2027-07-16', NULL),
(52, 'CeLT-0002', 'HP LaserJet Pro M404dn', 'SN-HPLJ404-9', 'HP', 'PRINTER', '2025-06-01', '2027-06-01', NULL),
(53, 'CeLT-0003', 'Tascam DR-40X Recorder', 'SN-TSDR40X-3', 'Tascam', 'RECORDER', '2025-09-09', '2027-09-09', NULL),
(54, 'CeLT-0004', 'Bose Companion 2 Speakers', 'SN-BSCMP2-61', 'Bose', 'SPEAKER', '2025-04-28', '2027-04-28', NULL),
(55, 'CeLT-0005', 'Netgear 8-Port Switch', 'SN-NG8PSW-27', 'Netgear', 'SWITCH', '2025-12-02', '2028-12-02', NULL),
(56, 'CeLT-0006', 'Epson EB-2250U Projector', 'SN-EPEB2250-3', 'Epson', 'PROJECTOR', '2026-02-19', '2028-02-19', NULL),
(57, 'CeLT-0007', 'Yamaha PJP-20UR Speaker System', 'SN-YMPJP-066', 'Yamaha', 'SPEAKER', '2025-08-19', '2027-08-19', NULL),
(58, 'CeLT-0008', 'Brother HL-L2350DW Printer', 'SN-BRHL23-067', 'Brother', 'PRINTER', '2025-08-19', '2027-08-19', NULL),
(59, 'CeLT-0009', 'Sony ICD-UX570 Recorder', 'SN-SNICD-068', 'Sony', 'RECORDER', '2025-09-02', '2027-09-02', NULL),
(60, 'CeLT-0010', 'TP-Link Deco Mesh Router', 'SN-TPDECO-069', 'TP-Link', 'ROUTER', '2025-09-02', '2027-09-02', NULL),

-- Bio (center_id 7, Manila)
(61, 'Bio-0001', 'Nikon D7500 Microscope Camera', 'SN-NKD7500-8', 'Nikon', 'CAMERA', '2025-05-19', '2027-05-19', NULL),
(62, 'Bio-0002', 'Lexar 128GB microSD', 'SN-LX128SD-4', 'Lexar', 'MEMORY_CARD', '2026-01-08', '2027-01-08', NULL),
(63, 'Bio-0003', 'Seagate Expansion 4TB', 'SN-SGEX4T-52', 'Seagate', 'HARD_DRIVE', '2025-10-11', '2028-10-11', NULL),
(64, 'Bio-0004', 'Microsoft Ergonomic Mouse', 'SN-MSERGO-18', 'Microsoft', 'MOUSE', '2025-08-25', '2026-08-25', NULL),
(65, 'Bio-0005', 'Dell P2422H 24" Monitor', 'SN-DLP2422-7', 'Dell', 'MONITOR', '2025-08-25', '2028-08-25', NULL),
(66, 'Bio-0006', 'Olympus BX43 Microscope Camera Unit', 'SN-OLBX43-27', 'Olympus', 'CAMERA', '2026-01-15', '2028-01-15', NULL),
(67, 'Bio-0007', 'Zeiss Axiocam Microscope Camera', 'SN-ZSAXC-070', 'Zeiss', 'CAMERA', '2025-07-28', '2027-07-28', NULL),
(68, 'Bio-0008', 'WD Elements 5TB HDD', 'SN-WDEL5T-071', 'Western Digital', 'HARD_DRIVE', '2025-07-28', '2028-07-28', NULL),
(69, 'Bio-0009', 'SanDisk 1TB microSD', 'SN-SDMSD1T-072', 'SanDisk', 'MEMORY_CARD', '2025-08-11', '2026-08-11', NULL),
(70, 'Bio-0010', 'Logitech K380 Keyboard', 'SN-LGK380-073', 'Logitech', 'KEYBOARD', '2025-08-11', '2027-08-11', NULL),

-- CNIS (center_id 8, Manila)
(71, 'CNIS-0001', 'Fortinet FortiGate 60F Firewall', 'SN-FGT60F-441', 'Fortinet', 'ROUTER', '2026-02-01', '2029-02-01', NULL),
(72, 'CNIS-0002', 'Ubiquiti UniFi Dream Machine', 'SN-UBIQDM-074', 'Ubiquiti', 'ROUTER', '2026-02-03', '2029-02-03', NULL),
(73, 'CNIS-0003', 'Cisco Catalyst 9200 Switch', 'SN-CSC9200-075', 'Cisco', 'SWITCH', '2026-02-03', '2029-02-03', NULL),
(74, 'CNIS-0004', 'Dell PowerEdge Mini Server', 'SN-DLPE-076', 'Dell', 'CPU', '2026-02-17', '2029-02-17', NULL),
(75, 'CNIS-0005', 'Penetration Testing Laptop Kit', 'SN-PTLK-077', 'Custom Build', 'DEV_KIT', '2026-02-17', '2028-02-17', NULL),
(76, 'CNIS-0006', 'Network Traffic Capture Appliance', 'SN-NTCA-078', 'Custom Build', 'DEV_KIT', '2026-03-03', '2028-03-03', NULL),
(77, 'CNIS-0007', 'Netgear ProSafe 24-Port Switch', 'SN-NGPS24-079', 'Netgear', 'SWITCH', '2026-03-03', '2029-03-03', NULL),
(78, 'CNIS-0008', 'Samsung 1TB Encrypted SSD', 'SN-SM1TSSD-080', 'Samsung', 'HARD_DRIVE', '2026-03-10', '2028-03-10', NULL),
(79, 'CNIS-0009', 'Logitech Brio Webcam', 'SN-LGBRIO-081', 'Logitech', 'CAMERA', '2026-03-10', '2028-03-10', NULL),
(80, 'CNIS-0010', 'Dell 24" Monitor', 'SN-DL24MN-082', 'Dell', 'MONITOR', '2026-03-17', '2029-03-17', NULL),

-- CIVI (center_id 9, Manila)
(81, 'CIVI-0001', 'Intel RealSense D455 Depth Camera', 'SN-IRSD455-88', 'Intel', 'CAMERA', '2026-01-27', '2028-01-27', NULL),
(82, 'CIVI-0002', 'NVIDIA Jetson Orin Nano', 'SN-NVJON-083', 'NVIDIA', 'DEV_KIT', '2026-01-06', '2028-01-06', NULL),
(83, 'CIVI-0003', 'Intel RealSense L515 LiDAR Camera', 'SN-IRSL515-084', 'Intel', 'CAMERA', '2026-01-06', '2028-01-06', NULL),
(84, 'CIVI-0004', 'ASUS ROG Strix RTX 4080 PC', 'SN-ASRTX80-085', 'ASUS', 'CPU', '2026-01-19', '2029-01-19', NULL),
(85, 'CIVI-0005', 'Wacom Intuos Pro', 'SN-WACIP-086', 'Wacom', 'TABLET', '2026-01-19', '2028-01-19', NULL),
(86, 'CIVI-0006', 'BenQ PD3220U Monitor', 'SN-BQPD32-087', 'BenQ', 'MONITOR', '2026-02-02', '2029-02-02', NULL),
(87, 'CIVI-0007', 'Canon EOS R5', 'SN-CNR5-088', 'Canon', 'CAMERA', '2026-02-02', '2028-02-02', NULL),
(88, 'CIVI-0008', 'Samsung 2TB SSD', 'SN-SM2TSSD-089', 'Samsung', 'HARD_DRIVE', '2026-02-16', '2028-02-16', NULL),
(89, 'CIVI-0009', 'Logitech G502 Mouse', 'SN-LGG502-090', 'Logitech', 'MOUSE', '2026-02-16', '2027-02-16', NULL),
(90, 'CIVI-0010', 'Dell 27" 4K Monitor', 'SN-DL27K4-091', 'Dell', 'MONITOR', '2026-03-01', '2029-03-01', NULL),

-- TE3D (center_id 10, Laguna)
(91, 'TE3D-0001', 'Meta Quest Pro', 'SN-MQPRO-0053', 'Meta', 'VR', '2026-02-10', '2028-02-10', NULL),
(92, 'TE3D-0002', 'Meta Quest 3S', 'SN-MQ3S-092', 'Meta', 'VR', '2026-01-14', '2028-01-14', NULL),
(93, 'TE3D-0003', 'HTC Vive Pro 2', 'SN-HTCVP2-093', 'HTC', 'VR', '2026-01-14', '2028-01-14', NULL),
(94, 'TE3D-0004', 'Logitech StreamCam', 'SN-LGSTCM-094', 'Logitech', 'CAMERA', '2026-01-28', '2027-01-28', NULL),
(95, 'TE3D-0005', 'Yamaha HS5 Studio Monitor Speakers', 'SN-YMHS5-095', 'Yamaha', 'SPEAKER', '2026-01-28', '2028-01-28', NULL),
(96, 'TE3D-0006', 'Epson PowerLite Projector', 'SN-EPPWL-096', 'Epson', 'PROJECTOR', '2026-02-11', '2028-02-11', NULL),
(97, 'TE3D-0007', 'Zoom H4n Recorder', 'SN-ZMH4N-097', 'Zoom', 'RECORDER', '2026-02-11', '2028-02-11', NULL),
(98, 'TE3D-0008', 'Samsung 55" TV', 'SN-SM55TV-098', 'Samsung', 'TV', '2026-02-25', '2029-02-25', NULL),
(99, 'TE3D-0009', 'Netgear Nighthawk Router', 'SN-NGNHWK-099', 'Netgear', 'ROUTER', '2026-02-25', '2028-02-25', NULL),
(100, 'TE3D-0010', 'SanDisk Extreme 512GB microSD', 'SN-SDEX512-100', 'SanDisk', 'MEMORY_CARD', '2026-03-05', '2027-03-05', NULL);

-- ==========================================
-- INSERT: asset_monetary  (one row per asset)
-- ==========================================
INSERT INTO `asset_monetary` (`asset_monetary_id`, `asset_id`, `funding_source`, `acquisition_value`) VALUES
(1, 1, 'DOST-SEI', 49999.00), (2, 2, 'DOST-SEI', 18500.00), (3, 3, 'CHED', 5499.00), (4, 4, 'DOST-PCIEERD', 35000.00), (5, 5, 'CHED', 89999.00),
(6, 6, 'DOST-SEI', 3499.00), (7, 7, 'DOST-SEI', 6999.00), (8, 8, 'CHED', 8999.00), (9, 9, 'DOST-SEI', 9999.00), (10, 10, 'CHED', 12999.00),
(11, 11, 'DOST-SEI', 65000.00), (12, 12, 'DOST-SEI', 39999.00), (13, 13, 'CHED', 22000.00), (14, 14, 'DOST-SEI', 4999.00), (15, 15, 'CHED', 2599.00),
(16, 16, 'DOST-PCIEERD', 899999.00), (17, 17, 'DOST-PCIEERD', 1299999.00), (18, 18, 'DOST-SEI', 8999.00), (19, 19, 'CHED', 45999.00), (20, 20, 'DOST-SEI', 9999.00),
(21, 21, 'DOST-SEI', 74999.00), (22, 22, 'CHED', 6999.00), (23, 23, 'DOST-SEI', 12999.00), (24, 24, 'DOST-SEI', 18999.00), (25, 25, 'CHED', 15999.00),
(26, 26, 'CHED', 89999.00), (27, 27, 'DOST-PCIEERD', 89999.00), (28, 28, 'CHED', 12999.00), (29, 29, 'DOST-SEI', 24999.00), (30, 30, 'CHED', 22999.00),
(31, 31, 'DOST-PCIEERD', 249999.00), (32, 32, 'CHED', 54999.00), (33, 33, 'DOST-SEI', 32999.00), (34, 34, 'DOST-SEI', 89999.00), (35, 35, 'CHED', 11999.00),
(36, 36, 'DOST-SEI', 24999.00), (37, 37, 'DOST-PCIEERD', 89999.00), (38, 38, 'DOST-SEI', 14999.00), (39, 39, 'CHED', 24999.00), (40, 40, 'DOST-SEI', 18999.00),
(41, 41, 'DOST-SEI', 32999.00), (42, 42, 'DOST-SEI', 89999.00), (43, 43, 'CHED', 24999.00), (44, 44, 'DOST-SEI', 5999.00), (45, 45, 'DOST-SEI', 8999.00),
(46, 46, 'DOST-PCIEERD', 42999.00), (47, 47, 'DOST-SEI', 34999.00), (48, 48, 'CHED', 22999.00), (49, 49, 'DOST-SEI', 8999.00), (50, 50, 'CHED', 21999.00),
(51, 51, 'CHED', 44999.00), (52, 52, 'DOST-SEI', 15999.00), (53, 53, 'DOST-SEI', 9999.00), (54, 54, 'CHED', 4999.00), (55, 55, 'DOST-SEI', 6999.00),
(56, 56, 'CHED', 74999.00), (57, 57, 'DOST-SEI', 9999.00), (58, 58, 'CHED', 7999.00), (59, 59, 'DOST-SEI', 6999.00), (60, 60, 'CHED', 5999.00),
(61, 61, 'CHED', 69999.00), (62, 62, 'DOST-SEI', 1299.00), (63, 63, 'DOST-SEI', 6499.00), (64, 64, 'CHED', 1999.00), (65, 65, 'CHED', 9999.00),
(66, 66, 'DOST-SEI', 129999.00), (67, 67, 'DOST-PCIEERD', 99999.00), (68, 68, 'DOST-SEI', 6999.00), (69, 69, 'CHED', 1999.00), (70, 70, 'DOST-SEI', 2999.00),
(71, 71, 'DOST-PCIEERD', 54999.00), (72, 72, 'DOST-PCIEERD', 24999.00), (73, 73, 'DOST-PCIEERD', 189999.00), (74, 74, 'CHED', 149999.00), (75, 75, 'DOST-SEI', 79999.00),
(76, 76, 'DOST-SEI', 64999.00), (77, 77, 'CHED', 21999.00), (78, 78, 'DOST-SEI', 8999.00), (79, 79, 'CHED', 6999.00), (80, 80, 'DOST-SEI', 11999.00),
(81, 81, 'CHED', 18999.00), (82, 82, 'DOST-PCIEERD', 24999.00), (83, 83, 'DOST-PCIEERD', 39999.00), (84, 84, 'CHED', 129999.00), (85, 85, 'DOST-SEI', 34999.00),
(86, 86, 'DOST-PCIEERD', 74999.00), (87, 87, 'CHED', 189999.00), (88, 88, 'DOST-SEI', 9999.00), (89, 89, 'CHED', 4999.00), (90, 90, 'DOST-SEI', 44999.00),
(91, 91, 'DOST-SEI', 62999.00), (92, 92, 'DOST-SEI', 26999.00), (93, 93, 'DOST-PCIEERD', 79999.00), (94, 94, 'CHED', 5999.00), (95, 95, 'DOST-SEI', 18999.00),
(96, 96, 'CHED', 64999.00), (97, 97, 'DOST-SEI', 8999.00), (98, 98, 'DOST-PCIEERD', 44999.00), (99, 99, 'CHED', 8999.00), (100, 100, 'DOST-SEI', 1999.00);

-- ==========================================
-- INSERT: asset_records  (one initial ACTIVE record per asset, grouped by lab)
-- project_id only set for a few CITe4D assets, matching the seeded projects
-- (which are all center_id 1) — every other lab's assets are left unlinked
-- since there are no projects seeded for those centers yet.
-- ==========================================
INSERT INTO `asset_records` (`asset_record_id`, `asset_id`, `status`, `location`, `current_custodian`, `project_id`) VALUES
(1, 1, 'ACTIVE', 'Manila — CITe4D', 1, 1),
(2, 2, 'ACTIVE', 'Manila — CITe4D', 1, 1),
(3, 3, 'ACTIVE', 'Manila — CITe4D', 1, NULL),
(4, 4, 'ACTIVE', 'Manila — CITe4D', 1, 3),
(5, 5, 'ACTIVE', 'Manila — CITe4D', 1, 2),
(6, 6, 'ACTIVE', 'Manila — CITe4D', 1, NULL),
(7, 7, 'ACTIVE', 'Manila — CITe4D', 1, NULL),
(8, 8, 'ACTIVE', 'Manila — CITe4D', 1, NULL),
(9, 9, 'ACTIVE', 'Manila — CITe4D', 1, NULL),
(10, 10, 'ACTIVE', 'Manila — CITe4D', 1, NULL),

(11, 11, 'ACTIVE', 'Laguna — CAR', 1, NULL),
(12, 12, 'ACTIVE', 'Laguna — CAR', 1, NULL),
(13, 13, 'ACTIVE', 'Laguna — CAR', 1, NULL),
(14, 14, 'ACTIVE', 'Laguna — CAR', 1, NULL),
(15, 15, 'ACTIVE', 'Laguna — CAR', 1, NULL),
(16, 16, 'ACTIVE', 'Laguna — CAR', 1, NULL),
(17, 17, 'ACTIVE', 'Laguna — CAR', 1, NULL),
(18, 18, 'ACTIVE', 'Laguna — CAR', 1, NULL),
(19, 19, 'ACTIVE', 'Laguna — CAR', 1, NULL),
(20, 20, 'ACTIVE', 'Laguna — CAR', 1, NULL),

(21, 21, 'ACTIVE', 'Manila — CeHCI', 1, NULL),
(22, 22, 'ACTIVE', 'Manila — CeHCI', 1, NULL),
(23, 23, 'ACTIVE', 'Manila — CeHCI', 1, NULL),
(24, 24, 'ACTIVE', 'Manila — CeHCI', 1, NULL),
(25, 25, 'ACTIVE', 'Manila — CeHCI', 1, NULL),
(26, 26, 'ACTIVE', 'Manila — CeHCI', 1, NULL),
(27, 27, 'ACTIVE', 'Manila — CeHCI', 1, NULL),
(28, 28, 'ACTIVE', 'Manila — CeHCI', 1, NULL),
(29, 29, 'ACTIVE', 'Manila — CeHCI', 1, NULL),
(30, 30, 'ACTIVE', 'Manila — CeHCI', 1, NULL),

(31, 31, 'ACTIVE', 'Laguna — HXIL', 1, NULL),
(32, 32, 'ACTIVE', 'Laguna — HXIL', 1, NULL),
(33, 33, 'ACTIVE', 'Laguna — HXIL', 1, NULL),
(34, 34, 'ACTIVE', 'Laguna — HXIL', 1, NULL),
(35, 35, 'ACTIVE', 'Laguna — HXIL', 1, NULL),
(36, 36, 'ACTIVE', 'Laguna — HXIL', 1, NULL),
(37, 37, 'ACTIVE', 'Laguna — HXIL', 1, NULL),
(38, 38, 'ACTIVE', 'Laguna — HXIL', 1, NULL),
(39, 39, 'ACTIVE', 'Laguna — HXIL', 1, NULL),
(40, 40, 'ACTIVE', 'Laguna — HXIL', 1, NULL),

(41, 41, 'ACTIVE', 'Manila — GAME', 1, NULL),
(42, 42, 'ACTIVE', 'Manila — GAME', 1, NULL),
(43, 43, 'ACTIVE', 'Manila — GAME', 1, NULL),
(44, 44, 'ACTIVE', 'Manila — GAME', 1, NULL),
(45, 45, 'ACTIVE', 'Manila — GAME', 1, NULL),
(46, 46, 'ACTIVE', 'Manila — GAME', 1, NULL),
(47, 47, 'ACTIVE', 'Manila — GAME', 1, NULL),
(48, 48, 'ACTIVE', 'Manila — GAME', 1, NULL),
(49, 49, 'ACTIVE', 'Manila — GAME', 1, NULL),
(50, 50, 'ACTIVE', 'Manila — GAME', 1, NULL),

(51, 51, 'ACTIVE', 'Laguna — CeLT', 1, NULL),
(52, 52, 'ACTIVE', 'Laguna — CeLT', 1, NULL),
(53, 53, 'ACTIVE', 'Laguna — CeLT', 1, NULL),
(54, 54, 'ACTIVE', 'Laguna — CeLT', 1, NULL),
(55, 55, 'ACTIVE', 'Laguna — CeLT', 1, NULL),
(56, 56, 'ACTIVE', 'Manila — CeLT', 1, NULL),
(57, 57, 'ACTIVE', 'Manila — CeLT', 1, NULL),
(58, 58, 'ACTIVE', 'Manila — CeLT', 1, NULL),
(59, 59, 'ACTIVE', 'Manila — CeLT', 1, NULL),
(60, 60, 'ACTIVE', 'Manila — CeLT', 1, NULL),

(61, 61, 'ACTIVE', 'Manila — Bio', 1, NULL),
(62, 62, 'ACTIVE', 'Manila — Bio', 1, NULL),
(63, 63, 'ACTIVE', 'Manila — Bio', 1, NULL),
(64, 64, 'ACTIVE', 'Manila — Bio', 1, NULL),
(65, 65, 'ACTIVE', 'Manila — Bio', 1, NULL),
(66, 66, 'ACTIVE', 'Manila — Bio', 1, NULL),
(67, 67, 'ACTIVE', 'Manila — Bio', 1, NULL),
(68, 68, 'ACTIVE', 'Manila — Bio', 1, NULL),
(69, 69, 'ACTIVE', 'Manila — Bio', 1, NULL),
(70, 70, 'ACTIVE', 'Manila — Bio', 1, NULL),

(71, 71, 'ACTIVE', 'Manila — CNIS', 1, NULL),
(72, 72, 'ACTIVE', 'Manila — CNIS', 1, NULL),
(73, 73, 'ACTIVE', 'Manila — CNIS', 1, NULL),
(74, 74, 'ACTIVE', 'Manila — CNIS', 1, NULL),
(75, 75, 'ACTIVE', 'Manila — CNIS', 1, NULL),
(76, 76, 'ACTIVE', 'Manila — CNIS', 1, NULL),
(77, 77, 'ACTIVE', 'Manila — CNIS', 1, NULL),
(78, 78, 'ACTIVE', 'Manila — CNIS', 1, NULL),
(79, 79, 'ACTIVE', 'Manila — CNIS', 1, NULL),
(80, 80, 'ACTIVE', 'Manila — CNIS', 1, NULL),

(81, 81, 'ACTIVE', 'Manila — CIVI', 1, NULL),
(82, 82, 'ACTIVE', 'Manila — CIVI', 1, NULL),
(83, 83, 'ACTIVE', 'Manila — CIVI', 1, NULL),
(84, 84, 'ACTIVE', 'Manila — CIVI', 1, NULL),
(85, 85, 'ACTIVE', 'Manila — CIVI', 1, NULL),
(86, 86, 'ACTIVE', 'Manila — CIVI', 1, NULL),
(87, 87, 'ACTIVE', 'Manila — CIVI', 1, NULL),
(88, 88, 'ACTIVE', 'Manila — CIVI', 1, NULL),
(89, 89, 'ACTIVE', 'Manila — CIVI', 1, NULL),
(90, 90, 'ACTIVE', 'Manila — CIVI', 1, NULL),

(91, 91, 'ACTIVE', 'Laguna — TE3D', 1, NULL),
(92, 92, 'ACTIVE', 'Laguna — TE3D', 1, NULL),
(93, 93, 'ACTIVE', 'Laguna — TE3D', 1, NULL),
(94, 94, 'ACTIVE', 'Laguna — TE3D', 1, NULL),
(95, 95, 'ACTIVE', 'Laguna — TE3D', 1, NULL),
(96, 96, 'ACTIVE', 'Laguna — TE3D', 1, NULL),
(97, 97, 'ACTIVE', 'Laguna — TE3D', 1, NULL),
(98, 98, 'ACTIVE', 'Laguna — TE3D', 1, NULL),
(99, 99, 'ACTIVE', 'Laguna — TE3D', 1, NULL),
(100, 100, 'ACTIVE', 'Laguna — TE3D', 1, NULL);
