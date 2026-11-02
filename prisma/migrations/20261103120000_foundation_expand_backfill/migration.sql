-- Batch 1, commit 4: foundation tables, columns, lookups, enums, backfill and checks.
-- Built from the SQL prisma migrate diff gave, then edited by hand: no column or table is dropped here
-- (the replaced ones go in a later migration, once no code reads them), the status columns are moved to
-- their enums in steps, and every backfill is written out.
--
-- The backfill never guesses. Each check writes what it found into _batch1_backfill_stop; the "stop here"
-- statement after a group of checks copies that table onto itself, so any row in it makes MySQL refuse with
-- "Duplicate entry '<what was found>'". That ends the migration and names the problem.

CREATE TABLE `_batch1_backfill_stop` (
    `problem` VARCHAR(255) NOT NULL,

    UNIQUE INDEX `batch1_backfill_stopped`(`problem`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------------------------------------
-- 1. Checks before anything changes
-- ---------------------------------------------------------------------------------------------------------

INSERT INTO `_batch1_backfill_stop` (`problem`)
SELECT CONCAT('Duplicate role names: ', LEFT(GROUP_CONCAT(d.`role_name` SEPARATOR ', '), 200))
FROM (SELECT `role_name` FROM `roles` GROUP BY `role_name` HAVING COUNT(*) > 1) d
HAVING COUNT(*) > 0;

INSERT INTO `_batch1_backfill_stop` (`problem`)
SELECT CONCAT('Duplicate user_roles (user/role): ', LEFT(GROUP_CONCAT(CONCAT(d.`user_id`, '/', d.`role_id`) SEPARATOR ', '), 200))
FROM (SELECT `user_id`, `role_id` FROM `user_roles` GROUP BY `user_id`, `role_id` HAVING COUNT(*) > 1) d
HAVING COUNT(*) > 0;

INSERT INTO `_batch1_backfill_stop` (`problem`)
SELECT CONCAT('Duplicate user_centers (user/lab): ', LEFT(GROUP_CONCAT(CONCAT(d.`user_id`, '/', d.`center_id`) SEPARATOR ', '), 200))
FROM (SELECT `user_id`, `center_id` FROM `user_centers` GROUP BY `user_id`, `center_id` HAVING COUNT(*) > 1) d
HAVING COUNT(*) > 0;

INSERT INTO `_batch1_backfill_stop` (`problem`)
SELECT CONCAT('Unknown loan statuses: ', LEFT(GROUP_CONCAT(DISTINCT `status` SEPARATOR ', '), 200))
FROM `asset_loans`
WHERE `status` NOT IN ('pending', 'approved', 'declined', 'returned')
HAVING COUNT(*) > 0;

-- The progress dialog's labels and the Staff analytics board's labels are the only texts the app has written.
INSERT INTO `_batch1_backfill_stop` (`problem`)
SELECT CONCAT('Unknown maintenance progress texts: ', LEFT(GROUP_CONCAT(DISTINCT `progress_status` SEPARATOR ', '), 200))
FROM `asset_maintenance`
WHERE `progress_status` NOT IN (
    'Pending TSG Review', 'Awaiting Immediate Dispatch', 'Inspection Phase', 'Warranty Holder Possession',
    'Third-Party Repairer Possession', 'Fixed & Completed', 'Reported', 'Diagnosing', 'Waiting for Parts', 'Resolved'
)
HAVING COUNT(*) > 0;

INSERT INTO `_batch1_backfill_stop` (`problem`)
SELECT CONCAT('Unknown disposal statuses: ', LEFT(GROUP_CONCAT(DISTINCT `status` SEPARATOR ', '), 200))
FROM `asset_retirements`
WHERE `status` NOT IN ('pending', 'approved', 'rejected')
HAVING COUNT(*) > 0;

INSERT INTO `_batch1_backfill_stop` (`problem`)
SELECT CONCAT('Funding text longer than 100 characters on assets: ', LEFT(GROUP_CONCAT(`asset_id` SEPARATOR ', '), 200))
FROM `asset_monetary`
WHERE CHAR_LENGTH(TRIM(`funding_source`)) > 100
HAVING COUNT(*) > 0;

INSERT INTO `_batch1_backfill_stop` (`problem`)
SELECT CONCAT('Funding text longer than 100 characters on projects: ', LEFT(GROUP_CONCAT(`project_id` SEPARATOR ', '), 200))
FROM `projects`
WHERE CHAR_LENGTH(TRIM(`funding_agency`)) > 100
HAVING COUNT(*) > 0;

-- Stop here if any check above found something.
INSERT INTO `_batch1_backfill_stop` (`problem`) SELECT `problem` FROM `_batch1_backfill_stop`;

-- ---------------------------------------------------------------------------------------------------------
-- 2. Lookup tables
-- ---------------------------------------------------------------------------------------------------------

CREATE TABLE `funding_sources` (
    `funding_source_id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,

    UNIQUE INDEX `funding_sources_name_key`(`name`),
    PRIMARY KEY (`funding_source_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `funding_sources` (`name`) VALUES ('DOST'), ('USAID'), ('CHED'), ('Internal Grants');

-- Every other funding text in use gets its own row. "Unspecified" and empty text mean no funding source.
INSERT INTO `funding_sources` (`name`)
SELECT DISTINCT TRIM(m.`funding_source`)
FROM `asset_monetary` m
WHERE TRIM(m.`funding_source`) NOT IN ('', 'Unspecified')
  AND NOT EXISTS (SELECT 1 FROM `funding_sources` f WHERE f.`name` = TRIM(m.`funding_source`));

INSERT INTO `funding_sources` (`name`)
SELECT DISTINCT TRIM(p.`funding_agency`)
FROM `projects` p
WHERE TRIM(p.`funding_agency`) NOT IN ('', 'Unspecified')
  AND NOT EXISTS (SELECT 1 FROM `funding_sources` f WHERE f.`name` = TRIM(p.`funding_agency`));

CREATE TABLE `issue_types` (
    `issue_type_id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(50) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `suggested_action` VARCHAR(255) NOT NULL,

    UNIQUE INDEX `issue_types_key_key`(`key`),
    PRIMARY KEY (`issue_type_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `issue_types` (`key`, `name`, `suggested_action`) VALUES
    ('WONT_POWER_ON', 'Won''t power on', 'Check the charger, the cable and the outlet, then try another outlet.'),
    ('BATTERY_CHARGING', 'Battery or charging', 'Try another charger and note how long the battery lasts.'),
    ('DISPLAY', 'Display', 'Check the cable and the brightness, and note any lines, spots or flicker.'),
    ('STORAGE_DATA', 'Storage or data', 'Stop saving files to the device and write down any error message.'),
    ('NETWORK_PORTS', 'Network or ports', 'Try another cable or port and note which ports fail.'),
    ('PHYSICAL_DAMAGE', 'Physical damage', 'Stop using the device and take a photo of the damage.'),
    ('ACCESSORY_MISSING', 'Accessory missing', 'List the missing items and when they were last seen.'),
    ('SOFTWARE_OS', 'Software or OS', 'Restart the device and write down the exact error message.'),
    ('OTHER', 'Other', 'Describe what happens and when it started.');

CREATE TABLE `metric_definitions` (
    `metric_id` INTEGER NOT NULL AUTO_INCREMENT,
    `metric_key` VARCHAR(50) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `unit` VARCHAR(20) NOT NULL,
    `higher_is_better` BOOLEAN NOT NULL,

    UNIQUE INDEX `metric_definitions_metric_key_key`(`metric_key`),
    PRIMARY KEY (`metric_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Motor speed is flagged when it is too far off its baseline either way; higher_is_better only sets how a
-- chart draws it.
INSERT INTO `metric_definitions` (`metric_key`, `name`, `unit`, `higher_is_better`) VALUES
    ('CPU_LOAD_TEMP', 'CPU load temperature', '°C', false),
    ('BAD_SECTORS', 'Bad sectors', 'count', false),
    ('BATTERY_CAPACITY', 'Battery capacity', '% of design', true),
    ('READ_SPEED', 'Read speed', 'MB/s', true),
    ('WORKING_PORTS', 'Working ports', 'count', true),
    ('PACKET_LOSS', 'Packet loss', '%', false),
    ('SENSOR_DRIFT', 'Sensor drift', '%', false),
    ('MOTOR_SPEED', 'Motor speed', 'RPM', true);

CREATE TABLE `category_metrics` (
    `category` ENUM('DEV_KIT', 'MONITOR', 'TV', 'CPU', 'KEYBOARD', 'MOUSE', 'CAMERA', 'MEMORY_CARD', 'PROJECTOR', 'RECORDER', 'ROUTER', 'SIMULATOR', 'TABLET', 'VR', 'PRINTER', 'SWITCH', 'HARD_DRIVE', 'AUDIO', 'VIDEO_CAMERA', 'SPEAKER') NOT NULL,
    `metric_id` INTEGER NOT NULL,

    INDEX `category_metrics_metric_id_idx`(`metric_id`),
    PRIMARY KEY (`category`, `metric_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Manuscript 1.6.2.2.3. Categories with no row here use the health score only.
INSERT INTO `category_metrics` (`category`, `metric_id`)
SELECT c.`category`, m.`metric_id`
FROM (
    SELECT 'CPU' AS `category`, 'CPU_LOAD_TEMP' AS `metric_key`
    UNION ALL SELECT 'CPU', 'BAD_SECTORS'
    UNION ALL SELECT 'CPU', 'BATTERY_CAPACITY'
    UNION ALL SELECT 'TABLET', 'BATTERY_CAPACITY'
    UNION ALL SELECT 'VR', 'BATTERY_CAPACITY'
    UNION ALL SELECT 'HARD_DRIVE', 'BAD_SECTORS'
    UNION ALL SELECT 'HARD_DRIVE', 'READ_SPEED'
    UNION ALL SELECT 'MEMORY_CARD', 'BAD_SECTORS'
    UNION ALL SELECT 'MEMORY_CARD', 'READ_SPEED'
    UNION ALL SELECT 'ROUTER', 'WORKING_PORTS'
    UNION ALL SELECT 'ROUTER', 'PACKET_LOSS'
    UNION ALL SELECT 'SWITCH', 'WORKING_PORTS'
    UNION ALL SELECT 'SWITCH', 'PACKET_LOSS'
    UNION ALL SELECT 'DEV_KIT', 'SENSOR_DRIFT'
    UNION ALL SELECT 'DEV_KIT', 'MOTOR_SPEED'
    UNION ALL SELECT 'SIMULATOR', 'SENSOR_DRIFT'
    UNION ALL SELECT 'SIMULATOR', 'MOTOR_SPEED'
) c
JOIN `metric_definitions` m ON m.`metric_key` = c.`metric_key`;

-- ---------------------------------------------------------------------------------------------------------
-- 3. Labs: campuses and Heads
-- ---------------------------------------------------------------------------------------------------------

ALTER TABLE `research_centers` ADD COLUMN `head_user_id` INTEGER NULL,
    MODIFY `location` ENUM('MANILA', 'LAGUNA', 'MCKINLEY') NOT NULL;

UPDATE `research_centers`
SET `location` = CASE
    WHEN BINARY `short_code` IN ('TE3D', 'GAME') THEN 'LAGUNA'
    WHEN BINARY `short_code` = 'HXIL' THEN 'MCKINLEY'
    ELSE 'MANILA'
END;

-- A lab gets a Head only when exactly one LAB_HEAD holder belongs to it and that holder belongs to no other
-- lab. Every other lab keeps no Head; the IT Admin sets it.
UPDATE `research_centers` c
JOIN (
    SELECT per_lab.`center_id`, per_lab.`user_id`
    FROM (
        SELECT uc.`center_id`, MIN(uc.`user_id`) AS `user_id`, COUNT(DISTINCT uc.`user_id`) AS `holders`
        FROM `user_centers` uc
        JOIN `user_roles` ur ON ur.`user_id` = uc.`user_id`
        JOIN `roles` r ON r.`role_id` = ur.`role_id` AND r.`role_name` = 'LAB_HEAD'
        GROUP BY uc.`center_id`
    ) per_lab
    JOIN (
        SELECT uc.`user_id`, COUNT(DISTINCT uc.`center_id`) AS `labs`
        FROM `user_centers` uc
        JOIN `user_roles` ur ON ur.`user_id` = uc.`user_id`
        JOIN `roles` r ON r.`role_id` = ur.`role_id` AND r.`role_name` = 'LAB_HEAD'
        GROUP BY uc.`user_id`
    ) per_user ON per_user.`user_id` = per_lab.`user_id`
    WHERE per_lab.`holders` = 1 AND per_user.`labs` = 1
) sole_head ON sole_head.`center_id` = c.`center_id`
SET c.`head_user_id` = sole_head.`user_id`;

CREATE UNIQUE INDEX `research_centers_head_user_id_key` ON `research_centers`(`head_user_id`);

-- ---------------------------------------------------------------------------------------------------------
-- 4. Roles: LAB_HEAD goes. A Lab Head is whoever heads a lab; every LAB_HEAD holder becomes a RESEARCHER.
-- ---------------------------------------------------------------------------------------------------------

INSERT INTO `roles` (`role_name`)
SELECT 'RESEARCHER' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `roles` WHERE `role_name` = 'RESEARCHER')
  AND EXISTS (SELECT 1 FROM `user_roles` ur JOIN `roles` r ON r.`role_id` = ur.`role_id` WHERE r.`role_name` = 'LAB_HEAD');

-- An account that already holds RESEARCHER loses its LAB_HEAD row instead of getting a second RESEARCHER row.
DELETE ur FROM `user_roles` ur
JOIN `roles` lab_head ON lab_head.`role_id` = ur.`role_id` AND lab_head.`role_name` = 'LAB_HEAD'
JOIN (
    SELECT DISTINCT ur2.`user_id`
    FROM `user_roles` ur2 JOIN `roles` r2 ON r2.`role_id` = ur2.`role_id`
    WHERE r2.`role_name` = 'RESEARCHER'
) has_researcher ON has_researcher.`user_id` = ur.`user_id`;

UPDATE `user_roles` ur
JOIN `roles` lab_head ON lab_head.`role_id` = ur.`role_id` AND lab_head.`role_name` = 'LAB_HEAD'
SET ur.`role_id` = (SELECT `role_id` FROM (SELECT MIN(`role_id`) AS `role_id` FROM `roles` WHERE `role_name` = 'RESEARCHER') researcher);

DELETE FROM `roles` WHERE `role_name` = 'LAB_HEAD';

ALTER TABLE `roles` MODIFY `role_name` ENUM('IT_ADMIN', 'ADRIC_DIRECTOR', 'ADRIC_SECRETARY', 'TSG_STAFF', 'RESEARCHER') NOT NULL;

CREATE UNIQUE INDEX `roles_role_name_key` ON `roles`(`role_name`);
CREATE UNIQUE INDEX `user_centers_user_id_center_id_key` ON `user_centers`(`user_id`, `center_id`);
CREATE UNIQUE INDEX `user_roles_user_id_role_id_key` ON `user_roles`(`user_id`, `role_id`);

-- ---------------------------------------------------------------------------------------------------------
-- 5. Users
-- ---------------------------------------------------------------------------------------------------------

ALTER TABLE `users` ADD COLUMN `account_status` ENUM('PENDING', 'ACTIVE', 'INACTIVE', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    ADD COLUMN `anonymized_at` DATETIME(0) NULL,
    ADD COLUMN `status_decided_at` DATETIME(0) NULL,
    ADD COLUMN `status_decided_by_id` INTEGER NULL,
    MODIFY `id_number` INTEGER NULL;

UPDATE `users` SET `account_status` = 'ACTIVE';

-- User 1 with no role is the "nobody holds it" placeholder, not a person: it cannot be used to log in.
UPDATE `users` u
SET u.`account_status` = 'INACTIVE'
WHERE u.`user_id` = 1
  AND NOT EXISTS (SELECT 1 FROM `user_roles` ur WHERE ur.`user_id` = u.`user_id`);

CREATE INDEX `users_status_decided_by_id_idx` ON `users`(`status_decided_by_id`);

-- ---------------------------------------------------------------------------------------------------------
-- 6. Assets: status, home lab, project and funding, stored once on the asset
-- ---------------------------------------------------------------------------------------------------------

ALTER TABLE `assets` ADD COLUMN `accessories` VARCHAR(500) NULL,
    ADD COLUMN `acquisition_value` DECIMAL(10, 2) NULL,
    ADD COLUMN `center_id` INTEGER NULL,
    ADD COLUMN `funding_source_id` INTEGER NULL,
    ADD COLUMN `home_room` VARCHAR(100) NULL,
    ADD COLUMN `its_property_tag` VARCHAR(100) NULL,
    ADD COLUMN `project_id` INTEGER NULL,
    ADD COLUMN `status` ENUM('AVAILABLE', 'ON_LOAN', 'MAINTENANCE', 'PENDING_RETIREMENT', 'RETIRED', 'MISSING') NULL,
    ADD COLUMN `tsg_tag` VARCHAR(100) NULL;

-- Status and project from the asset's newest record, ordered as the asset list orders them.
UPDATE `assets` a
JOIN (
    SELECT ranked.`asset_id`, ranked.`status`, ranked.`project_id`
    FROM (
        SELECT r.`asset_id`, r.`status`, r.`project_id`,
               ROW_NUMBER() OVER (PARTITION BY r.`asset_id` ORDER BY r.`date_logged` DESC, r.`asset_record_id` DESC) AS `rn`
        FROM `asset_records` r
    ) ranked
    WHERE ranked.`rn` = 1
) newest ON newest.`asset_id` = a.`asset_id`
SET a.`status` = CASE newest.`status`
        WHEN 'ACTIVE' THEN 'AVAILABLE'
        WHEN 'ON_LOAN' THEN 'ON_LOAN'
        WHEN 'MAINTENANCE' THEN 'MAINTENANCE'
        WHEN 'DISPOSED' THEN 'RETIRED'
    END,
    a.`project_id` = newest.`project_id`;

-- An asset with no record has never left the pool.
UPDATE `assets` SET `status` = 'AVAILABLE' WHERE `status` IS NULL;

-- The home lab from the tag prefix, matched letter for letter.
UPDATE `assets` a
JOIN `research_centers` c ON BINARY c.`short_code` = BINARY SUBSTRING_INDEX(a.`asset_tag`, '-', 1)
SET a.`center_id` = c.`center_id`
WHERE a.`asset_tag` LIKE '%-%';

INSERT INTO `_batch1_backfill_stop` (`problem`)
SELECT CONCAT('No lab matches the tag prefix of: ', LEFT(GROUP_CONCAT(`asset_tag` ORDER BY `asset_tag` SEPARATOR ', '), 200))
FROM `assets`
WHERE `center_id` IS NULL
HAVING COUNT(*) > 0;

-- Stop here if any asset has no home lab.
INSERT INTO `_batch1_backfill_stop` (`problem`) SELECT `problem` FROM `_batch1_backfill_stop`;

UPDATE `assets` a
JOIN `asset_monetary` m ON m.`asset_id` = a.`asset_id`
LEFT JOIN `funding_sources` f ON f.`name` = TRIM(m.`funding_source`)
SET a.`acquisition_value` = m.`acquisition_value`,
    a.`funding_source_id` = f.`funding_source_id`;

ALTER TABLE `assets` MODIFY `center_id` INTEGER NOT NULL,
    MODIFY `status` ENUM('AVAILABLE', 'ON_LOAN', 'MAINTENANCE', 'PENDING_RETIREMENT', 'RETIRED', 'MISSING') NOT NULL DEFAULT 'AVAILABLE';

CREATE INDEX `assets_status_idx` ON `assets`(`status`);
CREATE INDEX `assets_center_id_idx` ON `assets`(`center_id`);
CREATE INDEX `assets_project_id_idx` ON `assets`(`project_id`);
CREATE INDEX `assets_funding_source_id_idx` ON `assets`(`funding_source_id`);

-- ---------------------------------------------------------------------------------------------------------
-- 7. Inspections
-- ---------------------------------------------------------------------------------------------------------

ALTER TABLE `asset_inspections` ADD COLUMN `health_score` TINYINT UNSIGNED NULL,
    ADD COLUMN `missing_accessories` VARCHAR(255) NULL,
    ADD COLUMN `type` ENUM('INITIAL', 'LOAN_RELEASE', 'RETURN', 'MAINTENANCE', 'RECOVERY', 'ROUTINE', 'RETIREMENT', 'SELF_REPORT') NULL;

-- A report by TSG was a routine check; anyone else's was the holder reporting on their own.
UPDATE `asset_inspections` i
SET i.`type` = CASE
    WHEN EXISTS (
        SELECT 1 FROM `user_roles` ur JOIN `roles` r ON r.`role_id` = ur.`role_id`
        WHERE ur.`user_id` = i.`inspected_by_id` AND r.`role_name` = 'TSG_STAFF'
    ) THEN 'ROUTINE'
    ELSE 'SELF_REPORT'
END;

ALTER TABLE `asset_inspections` MODIFY `type` ENUM('INITIAL', 'LOAN_RELEASE', 'RETURN', 'MAINTENANCE', 'RECOVERY', 'ROUTINE', 'RETIREMENT', 'SELF_REPORT') NOT NULL;

CREATE INDEX `asset_inspections_asset_id_inspected_at_idx` ON `asset_inspections`(`asset_id`, `inspected_at`);

ALTER TABLE `asset_inspections` ADD CONSTRAINT `asset_inspections_health_score_check` CHECK (`health_score` BETWEEN 0 AND 100);

CREATE TABLE `asset_inspection_metrics` (
    `inspection_id` INTEGER NOT NULL,
    `metric_id` INTEGER NOT NULL,
    `value` DECIMAL(10, 2) NOT NULL,

    INDEX `asset_inspection_metrics_metric_id_idx`(`metric_id`),
    PRIMARY KEY (`inspection_id`, `metric_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------------------------------------
-- 8. Loans
-- ---------------------------------------------------------------------------------------------------------

ALTER TABLE `asset_loans` ADD COLUMN `closed_at` DATETIME(0) NULL,
    ADD COLUMN `decided_at` DATETIME(0) NULL,
    ADD COLUMN `decided_by_id` INTEGER NULL,
    ADD COLUMN `decision_remarks` TEXT NULL,
    ADD COLUMN `destination_center_id` INTEGER NULL,
    ADD COLUMN `destination_room` VARCHAR(100) NULL,
    ADD COLUMN `project_id` INTEGER NULL,
    ADD COLUMN `received_by_id` INTEGER NULL,
    ADD COLUMN `release_inspection_id` INTEGER NULL,
    ADD COLUMN `released_at` DATETIME(0) NULL,
    ADD COLUMN `released_by_id` INTEGER NULL,
    ADD COLUMN `remarks` TEXT NULL,
    ADD COLUMN `return_inspection_id` INTEGER NULL,
    ADD COLUMN `return_requested_at` DATETIME(0) NULL;

UPDATE `asset_loans` SET `status` = 'PENDING_APPROVAL' WHERE `status` = 'pending';
UPDATE `asset_loans` SET `status` = 'DECLINED' WHERE `status` = 'declined';
UPDATE `asset_loans` SET `status` = 'RETURNED' WHERE `status` = 'returned';

-- Each asset_returns row goes onto its loan: the asset's newest returned loan requested before the return.
INSERT INTO `_batch1_backfill_stop` (`problem`)
SELECT CONCAT('Returns that match no returned loan: ', LEFT(GROUP_CONCAT(rt.`reference_number` SEPARATOR ', '), 200))
FROM `asset_returns` rt
WHERE NOT EXISTS (
    SELECT 1 FROM `asset_loans` l
    WHERE l.`asset_id` = rt.`asset_id` AND l.`status` = 'RETURNED' AND l.`requested_at` < rt.`returned_on`
)
HAVING COUNT(*) > 0;

INSERT INTO `_batch1_backfill_stop` (`problem`)
SELECT CONCAT('Loans matched by more than one return: ', LEFT(GROUP_CONCAT(shared.`loan_id` SEPARATOR ', '), 200))
FROM (
    SELECT matched.`loan_id`
    FROM (
        SELECT (
            SELECT MAX(l.`loan_id`) FROM `asset_loans` l
            WHERE l.`asset_id` = rt.`asset_id` AND l.`status` = 'RETURNED' AND l.`requested_at` < rt.`returned_on`
        ) AS `loan_id`
        FROM `asset_returns` rt
    ) matched
    WHERE matched.`loan_id` IS NOT NULL
    GROUP BY matched.`loan_id`
    HAVING COUNT(*) > 1
) shared
HAVING COUNT(*) > 0;

-- Stop here if a return matches no loan, or two returns match one loan.
INSERT INTO `_batch1_backfill_stop` (`problem`) SELECT `problem` FROM `_batch1_backfill_stop`;

UPDATE `asset_loans` l
JOIN (
    SELECT rt.`returned_by_id`, rt.`returned_on`, rt.`comments`, (
        SELECT MAX(l2.`loan_id`) FROM `asset_loans` l2
        WHERE l2.`asset_id` = rt.`asset_id` AND l2.`status` = 'RETURNED' AND l2.`requested_at` < rt.`returned_on`
    ) AS `loan_id`
    FROM `asset_returns` rt
) matched ON matched.`loan_id` = l.`loan_id`
SET l.`received_by_id` = matched.`returned_by_id`,
    l.`closed_at` = matched.`returned_on`,
    l.`remarks` = matched.`comments`;

-- An approved loan is still open only when it is its asset's newest approved loan and the asset is on loan.
UPDATE `asset_loans` l
JOIN (
    SELECT `asset_id`, MAX(`loan_id`) AS `loan_id` FROM `asset_loans` WHERE `status` = 'approved' GROUP BY `asset_id`
) newest ON newest.`loan_id` = l.`loan_id`
JOIN `assets` a ON a.`asset_id` = l.`asset_id`
SET l.`status` = 'ON_LOAN'
WHERE a.`status` = 'ON_LOAN';

-- Every other approved loan was left open by the old code after the asset came back (H-04). It is closed,
-- with no closing time, because none was recorded.
UPDATE `asset_loans` l
JOIN `assets` a ON a.`asset_id` = l.`asset_id`
SET l.`status` = 'RETURNED',
    l.`remarks` = IF(a.`status` = 'RETIRED', 'Closed by migration: asset retired while on loan', 'Closed by migration: asset already back')
WHERE l.`status` = 'approved';

ALTER TABLE `asset_loans` MODIFY `status` ENUM('PENDING_APPROVAL', 'PENDING_RELEASE', 'DECLINED', 'CANCELLED', 'ON_LOAN', 'RETURN_REQUESTED', 'RETURNED', 'ENDED_BY_MAINTENANCE', 'ENDED_BY_LOSS') NOT NULL DEFAULT 'PENDING_APPROVAL';

-- The old borrow form wrote the destination lab as the first line of the purpose. (H-19)
UPDATE `asset_loans` l
JOIN `research_centers` c
  ON BINARY c.`short_code` = BINARY TRIM(SUBSTRING_INDEX(SUBSTRING(l.`purpose`, CHAR_LENGTH('Destination Lab:') + 1), '\n', 1))
SET l.`destination_center_id` = c.`center_id`
WHERE l.`purpose` LIKE 'Destination Lab:%';

CREATE INDEX `asset_loans_asset_id_status_idx` ON `asset_loans`(`asset_id`, `status`);
CREATE INDEX `asset_loans_project_id_idx` ON `asset_loans`(`project_id`);
CREATE INDEX `asset_loans_destination_center_id_idx` ON `asset_loans`(`destination_center_id`);
CREATE INDEX `asset_loans_decided_by_id_idx` ON `asset_loans`(`decided_by_id`);
CREATE INDEX `asset_loans_released_by_id_idx` ON `asset_loans`(`released_by_id`);
CREATE INDEX `asset_loans_release_inspection_id_idx` ON `asset_loans`(`release_inspection_id`);
CREATE INDEX `asset_loans_received_by_id_idx` ON `asset_loans`(`received_by_id`);
CREATE INDEX `asset_loans_return_inspection_id_idx` ON `asset_loans`(`return_inspection_id`);

ALTER TABLE `asset_loans` ADD CONSTRAINT `asset_loans_return_by_check` CHECK (`return_by` >= DATE(`requested_at`));

-- ---------------------------------------------------------------------------------------------------------
-- 9. Maintenance
-- ---------------------------------------------------------------------------------------------------------

ALTER TABLE `asset_maintenance` ADD COLUMN `completed_at` DATETIME(0) NULL,
    ADD COLUMN `completed_by_id` INTEGER NULL,
    ADD COLUMN `completion_inspection_id` INTEGER NULL,
    ADD COLUMN `issue_type_id` INTEGER NULL,
    ADD COLUMN `provider` VARCHAR(255) NULL,
    ADD COLUMN `received_at` DATETIME(0) NULL,
    ADD COLUMN `received_by_id` INTEGER NULL,
    ADD COLUMN `resolution_remarks` TEXT NULL,
    ADD COLUMN `trigger_inspection_id` INTEGER NULL,
    ADD COLUMN `type` ENUM('BORROWER_REPORT', 'TSG_MAINTENANCE', 'RETURN_DAMAGE') NOT NULL DEFAULT 'BORROWER_REPORT',
    ADD COLUMN `warranty_override_reason` TEXT NULL;

-- The two outside services were two texts; they become one status, with who has the asset as the provider.
UPDATE `asset_maintenance` SET `provider` = 'Warranty holder' WHERE `progress_status` = 'Warranty Holder Possession';
UPDATE `asset_maintenance` SET `provider` = 'Third-party repairer' WHERE `progress_status` = 'Third-Party Repairer Possession';

UPDATE `asset_maintenance`
SET `progress_status` = CASE `progress_status`
    WHEN 'Pending TSG Review' THEN 'PENDING_RECEIPT'
    WHEN 'Awaiting Immediate Dispatch' THEN 'PENDING_RECEIPT'
    WHEN 'Reported' THEN 'PENDING_RECEIPT'
    WHEN 'Inspection Phase' THEN 'INSPECTING'
    WHEN 'Diagnosing' THEN 'INSPECTING'
    WHEN 'Waiting for Parts' THEN 'REPAIRING'
    WHEN 'Warranty Holder Possession' THEN 'EXTERNAL_SERVICE'
    WHEN 'Third-Party Repairer Possession' THEN 'EXTERNAL_SERVICE'
    WHEN 'Fixed & Completed' THEN 'RESOLVED'
    WHEN 'Resolved' THEN 'RESOLVED'
END;

ALTER TABLE `asset_maintenance` CHANGE `progress_status` `status` ENUM('PENDING_RECEIPT', 'INSPECTING', 'REPAIRING', 'EXTERNAL_SERVICE', 'RESOLVED', 'BEYOND_REPAIR', 'CANCELLED') NOT NULL DEFAULT 'PENDING_RECEIPT';

CREATE INDEX `asset_maintenance_asset_id_status_idx` ON `asset_maintenance`(`asset_id`, `status`);
CREATE INDEX `asset_maintenance_issue_type_id_idx` ON `asset_maintenance`(`issue_type_id`);
CREATE INDEX `asset_maintenance_received_by_id_idx` ON `asset_maintenance`(`received_by_id`);
CREATE INDEX `asset_maintenance_completed_by_id_idx` ON `asset_maintenance`(`completed_by_id`);
CREATE INDEX `asset_maintenance_trigger_inspection_id_idx` ON `asset_maintenance`(`trigger_inspection_id`);
CREATE INDEX `asset_maintenance_completion_inspection_id_idx` ON `asset_maintenance`(`completion_inspection_id`);

ALTER TABLE `asset_maintenance` ADD CONSTRAINT `asset_maintenance_completed_at_check` CHECK (`completed_at` >= `reported_at`);

-- ---------------------------------------------------------------------------------------------------------
-- 10. Retirements (page title "Asset Disposal")
-- ---------------------------------------------------------------------------------------------------------

ALTER TABLE `asset_retirements` ADD COLUMN `assessment_inspection_id` INTEGER NULL,
    ADD COLUMN `completed_at` DATETIME(0) NULL,
    ADD COLUMN `completed_by_id` INTEGER NULL,
    ADD COLUMN `decided_at` DATETIME(0) NULL,
    ADD COLUMN `decided_by_id` INTEGER NULL,
    ADD COLUMN `decision_remarks` TEXT NULL,
    ADD COLUMN `disposition_reference` VARCHAR(255) NULL,
    ADD COLUMN `pathway` ENUM('DONATE', 'RECYCLE', 'RETURN_TO_FUNDER', 'SELL', 'OTHER') NULL,
    ADD COLUMN `previous_status` ENUM('AVAILABLE', 'ON_LOAN', 'MAINTENANCE', 'PENDING_RETIREMENT', 'RETIRED', 'MISSING') NULL;

-- The pathway was packed into the first line of the reason (M-13). Where it parses it moves to its column and
-- the line leaves the reason; any other first line stays where it is.
UPDATE `asset_retirements`
SET `pathway` = CASE
    WHEN SUBSTRING_INDEX(`reason`, '\n', 1) LIKE '%Scrap / Recycle%' THEN 'RECYCLE'
    WHEN SUBSTRING_INDEX(`reason`, '\n', 1) LIKE '%Donate%' THEN 'DONATE'
    WHEN SUBSTRING_INDEX(`reason`, '\n', 1) LIKE '%Auction%' THEN 'SELL'
    WHEN SUBSTRING_INDEX(`reason`, '\n', 1) LIKE '%Warranty Return to Vendor%' THEN 'OTHER'
    WHEN SUBSTRING_INDEX(`reason`, '\n', 1) LIKE '%Secure Landfill%' THEN 'OTHER'
END
WHERE `reason` LIKE 'Disposal Pathway:%';

UPDATE `asset_retirements`
SET `reason` = IF(LOCATE('\n', `reason`) = 0, '', SUBSTRING(`reason`, LOCATE('\n', `reason`) + 1))
WHERE `pathway` IS NOT NULL;

-- A pending request keeps the status its asset had before it, from the newest record at or before the request.
UPDATE `asset_retirements` d
JOIN `assets` a ON a.`asset_id` = d.`asset_id`
SET d.`previous_status` = COALESCE((
    SELECT CASE r.`status`
        WHEN 'ACTIVE' THEN 'AVAILABLE'
        WHEN 'ON_LOAN' THEN 'ON_LOAN'
        WHEN 'MAINTENANCE' THEN 'MAINTENANCE'
        WHEN 'DISPOSED' THEN 'RETIRED'
    END
    FROM `asset_records` r
    WHERE r.`asset_id` = d.`asset_id` AND r.`date_logged` <= d.`requested_at`
    ORDER BY r.`date_logged` DESC, r.`asset_record_id` DESC
    LIMIT 1
), a.`status`)
WHERE d.`status` = 'pending';

-- The old approval disposed of the asset at once, so an approved request is a completed one.
UPDATE `asset_retirements` SET `status` = 'PENDING' WHERE `status` = 'pending';
UPDATE `asset_retirements` SET `status` = 'COMPLETED' WHERE `status` = 'approved';
UPDATE `asset_retirements` SET `status` = 'DENIED' WHERE `status` = 'rejected';

ALTER TABLE `asset_retirements` MODIFY `status` ENUM('PENDING', 'APPROVED', 'DENIED', 'COMPLETED') NOT NULL DEFAULT 'PENDING';

UPDATE `assets` a
JOIN `asset_retirements` d ON d.`asset_id` = a.`asset_id` AND d.`status` = 'PENDING'
SET a.`status` = 'PENDING_RETIREMENT';

CREATE INDEX `asset_retirements_decided_by_id_idx` ON `asset_retirements`(`decided_by_id`);
CREATE INDEX `asset_retirements_completed_by_id_idx` ON `asset_retirements`(`completed_by_id`);
CREATE INDEX `asset_retirements_assessment_inspection_id_idx` ON `asset_retirements`(`assessment_inspection_id`);

ALTER TABLE `asset_retirements` ADD CONSTRAINT `asset_retirements_decider_check` CHECK (`decided_by_id` <> `requested_by_id`);
ALTER TABLE `asset_retirements` ADD CONSTRAINT `asset_retirements_completed_at_check` CHECK (`completed_at` >= `requested_at`);

-- ---------------------------------------------------------------------------------------------------------
-- 11. Projects
-- ---------------------------------------------------------------------------------------------------------

ALTER TABLE `projects` ADD COLUMN `funding_source_id` INTEGER NULL;

UPDATE `projects` p
JOIN `funding_sources` f ON f.`name` = TRIM(p.`funding_agency`)
SET p.`funding_source_id` = f.`funding_source_id`;

CREATE INDEX `projects_funding_source_id_idx` ON `projects`(`funding_source_id`);

-- ---------------------------------------------------------------------------------------------------------
-- 12. Tickets and the activity log
-- ---------------------------------------------------------------------------------------------------------

CREATE TABLE `user_tickets` (
    `ticket_id` INTEGER NOT NULL AUTO_INCREMENT,
    `created_by_id` INTEGER NOT NULL,
    `type` ENUM('BUG', 'ACCOUNT_ACCESS', 'QUESTION', 'OTHER') NOT NULL,
    `title` VARCHAR(150) NOT NULL,
    `description` TEXT NOT NULL,
    `status` ENUM('OPEN', 'IN_PROGRESS', 'RESOLVED', 'REJECTED') NOT NULL DEFAULT 'OPEN',
    `resolution_remarks` TEXT NULL,
    `resolved_by_id` INTEGER NULL,
    `resolved_at` DATETIME(0) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `user_tickets_created_by_id_idx`(`created_by_id`),
    INDEX `user_tickets_resolved_by_id_idx`(`resolved_by_id`),
    INDEX `user_tickets_status_idx`(`status`),
    PRIMARY KEY (`ticket_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Never holds an email, a typed login name, or a password.
CREATE TABLE `activity_log` (
    `log_id` INTEGER NOT NULL AUTO_INCREMENT,
    `actor_id` INTEGER NULL,
    `event_type` ENUM('LOGIN_SUCCESS', 'LOGIN_FAILURE', 'SIGNUP_APPROVED', 'SIGNUP_REJECTED', 'ROLE_CHANGED', 'LABS_CHANGED', 'HEAD_CHANGED', 'USER_DEACTIVATED', 'USER_REACTIVATED', 'USER_ANONYMIZED', 'TICKET_STATUS_CHANGED', 'ASSET_REGISTERED', 'ASSET_EDITED', 'ASSET_DELETED', 'ASSET_MARKED_MISSING', 'ASSET_FOUND', 'CLEARANCE_RECORD_PRINTED') NOT NULL,
    `target_user_id` INTEGER NULL,
    `asset_id` INTEGER NULL,
    `details` VARCHAR(255) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `activity_log_actor_id_idx`(`actor_id`),
    INDEX `activity_log_target_user_id_idx`(`target_user_id`),
    INDEX `activity_log_asset_id_idx`(`asset_id`),
    INDEX `activity_log_event_type_created_at_idx`(`event_type`, `created_at`),
    PRIMARY KEY (`log_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------------------------------------
-- 13. Foreign keys
-- ---------------------------------------------------------------------------------------------------------

ALTER TABLE `asset_retirements` ADD CONSTRAINT `asset_retirements_decided_by_id_fkey` FOREIGN KEY (`decided_by_id`) REFERENCES `users`(`user_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE `asset_retirements` ADD CONSTRAINT `asset_retirements_completed_by_id_fkey` FOREIGN KEY (`completed_by_id`) REFERENCES `users`(`user_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE `asset_retirements` ADD CONSTRAINT `asset_retirements_assessment_inspection_id_fkey` FOREIGN KEY (`assessment_inspection_id`) REFERENCES `asset_inspections`(`inspection_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE `asset_maintenance` ADD CONSTRAINT `asset_maintenance_received_by_id_fkey` FOREIGN KEY (`received_by_id`) REFERENCES `users`(`user_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE `asset_maintenance` ADD CONSTRAINT `asset_maintenance_completed_by_id_fkey` FOREIGN KEY (`completed_by_id`) REFERENCES `users`(`user_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE `asset_maintenance` ADD CONSTRAINT `asset_maintenance_issue_type_id_fkey` FOREIGN KEY (`issue_type_id`) REFERENCES `issue_types`(`issue_type_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE `asset_maintenance` ADD CONSTRAINT `asset_maintenance_trigger_inspection_id_fkey` FOREIGN KEY (`trigger_inspection_id`) REFERENCES `asset_inspections`(`inspection_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE `asset_maintenance` ADD CONSTRAINT `asset_maintenance_completion_inspection_id_fkey` FOREIGN KEY (`completion_inspection_id`) REFERENCES `asset_inspections`(`inspection_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE `assets` ADD CONSTRAINT `assets_center_id_fkey` FOREIGN KEY (`center_id`) REFERENCES `research_centers`(`center_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE `assets` ADD CONSTRAINT `assets_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`project_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE `assets` ADD CONSTRAINT `assets_funding_source_id_fkey` FOREIGN KEY (`funding_source_id`) REFERENCES `funding_sources`(`funding_source_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE `asset_inspection_metrics` ADD CONSTRAINT `asset_inspection_metrics_inspection_id_fkey` FOREIGN KEY (`inspection_id`) REFERENCES `asset_inspections`(`inspection_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE `asset_inspection_metrics` ADD CONSTRAINT `asset_inspection_metrics_metric_id_fkey` FOREIGN KEY (`metric_id`) REFERENCES `metric_definitions`(`metric_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE `category_metrics` ADD CONSTRAINT `category_metrics_metric_id_fkey` FOREIGN KEY (`metric_id`) REFERENCES `metric_definitions`(`metric_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE `research_centers` ADD CONSTRAINT `research_centers_head_user_id_fkey` FOREIGN KEY (`head_user_id`) REFERENCES `users`(`user_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE `users` ADD CONSTRAINT `users_status_decided_by_id_fkey` FOREIGN KEY (`status_decided_by_id`) REFERENCES `users`(`user_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE `asset_loans` ADD CONSTRAINT `asset_loans_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`project_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE `asset_loans` ADD CONSTRAINT `asset_loans_destination_center_id_fkey` FOREIGN KEY (`destination_center_id`) REFERENCES `research_centers`(`center_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE `asset_loans` ADD CONSTRAINT `asset_loans_decided_by_id_fkey` FOREIGN KEY (`decided_by_id`) REFERENCES `users`(`user_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE `asset_loans` ADD CONSTRAINT `asset_loans_released_by_id_fkey` FOREIGN KEY (`released_by_id`) REFERENCES `users`(`user_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE `asset_loans` ADD CONSTRAINT `asset_loans_received_by_id_fkey` FOREIGN KEY (`received_by_id`) REFERENCES `users`(`user_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE `asset_loans` ADD CONSTRAINT `asset_loans_release_inspection_id_fkey` FOREIGN KEY (`release_inspection_id`) REFERENCES `asset_inspections`(`inspection_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE `asset_loans` ADD CONSTRAINT `asset_loans_return_inspection_id_fkey` FOREIGN KEY (`return_inspection_id`) REFERENCES `asset_inspections`(`inspection_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE `projects` ADD CONSTRAINT `projects_funding_source_id_fkey` FOREIGN KEY (`funding_source_id`) REFERENCES `funding_sources`(`funding_source_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE `user_tickets` ADD CONSTRAINT `user_tickets_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`user_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE `user_tickets` ADD CONSTRAINT `user_tickets_resolved_by_id_fkey` FOREIGN KEY (`resolved_by_id`) REFERENCES `users`(`user_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE `activity_log` ADD CONSTRAINT `activity_log_actor_id_fkey` FOREIGN KEY (`actor_id`) REFERENCES `users`(`user_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE `activity_log` ADD CONSTRAINT `activity_log_target_user_id_fkey` FOREIGN KEY (`target_user_id`) REFERENCES `users`(`user_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE `activity_log` ADD CONSTRAINT `activity_log_asset_id_fkey` FOREIGN KEY (`asset_id`) REFERENCES `assets`(`asset_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

DROP TABLE `_batch1_backfill_stop`;
