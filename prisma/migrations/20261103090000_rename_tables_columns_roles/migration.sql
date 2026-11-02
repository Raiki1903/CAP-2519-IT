-- Batch 1, commit 3: rename tables, columns, indexes and role values. No data is dropped and no behavior changes.
-- Written by hand: prisma migrate diff writes a rename as DROP plus CREATE, which would delete the rows.
-- Foreign key constraint names (fk_repairs_asset and the like) are kept as they are; only the indexes Prisma names
-- after the table or column are renamed, so the schema and the database stay in step.

-- Tables
RENAME TABLE `asset_repairs` TO `asset_maintenance`;
RENAME TABLE `asset_disposals` TO `asset_retirements`;
RENAME TABLE `asset_reports` TO `asset_inspections`;

-- asset_loans: loaned_on has always been the time of the request.
ALTER TABLE `asset_loans` RENAME COLUMN `loaned_on` TO `requested_at`;
ALTER TABLE `asset_loans` RENAME COLUMN `due_date` TO `return_by`;

-- asset_inspections
ALTER TABLE `asset_inspections` RENAME COLUMN `report_id` TO `inspection_id`;
ALTER TABLE `asset_inspections` RENAME COLUMN `reported_by_id` TO `inspected_by_id`;
ALTER TABLE `asset_inspections` RENAME COLUMN `report_date` TO `inspected_at`;
ALTER TABLE `asset_inspections` RENAME COLUMN `report_img` TO `photo`;
ALTER TABLE `asset_inspections` RENAME COLUMN `report_condition` TO `condition`;
ALTER TABLE `asset_inspections` RENAME COLUMN `report_remarks` TO `remarks`;
ALTER TABLE `asset_inspections` RENAME INDEX `asset_reports_asset_id_idx` TO `asset_inspections_asset_id_idx`;
ALTER TABLE `asset_inspections` RENAME INDEX `asset_reports_reported_by_id_idx` TO `asset_inspections_inspected_by_id_idx`;

-- asset_retirements
ALTER TABLE `asset_retirements` RENAME COLUMN `disposal_id` TO `retirement_id`;
ALTER TABLE `asset_retirements` RENAME COLUMN `disposed_by_id` TO `requested_by_id`;
ALTER TABLE `asset_retirements` RENAME COLUMN `disposal_date` TO `requested_at`;
ALTER TABLE `asset_retirements` RENAME COLUMN `disposal_reason` TO `reason`;
ALTER TABLE `asset_retirements` RENAME INDEX `asset_disposals_asset_id_idx` TO `asset_retirements_asset_id_idx`;
ALTER TABLE `asset_retirements` RENAME INDEX `asset_disposals_disposed_by_id_idx` TO `asset_retirements_requested_by_id_idx`;

-- asset_maintenance
ALTER TABLE `asset_maintenance` RENAME COLUMN `repair_id` TO `maintenance_id`;
ALTER TABLE `asset_maintenance` RENAME COLUMN `created_at` TO `reported_at`;
ALTER TABLE `asset_maintenance` RENAME INDEX `asset_repairs_asset_id_idx` TO `asset_maintenance_asset_id_idx`;
ALTER TABLE `asset_maintenance` RENAME INDEX `asset_repairs_reported_by_id_idx` TO `asset_maintenance_reported_by_id_idx`;

-- asset_records: the table goes in commit 9b; renaming its links keeps every commit until then green.
ALTER TABLE `asset_records` RENAME COLUMN `repair_id` TO `maintenance_id`;
ALTER TABLE `asset_records` RENAME COLUMN `disposal_id` TO `retirement_id`;

-- projects: the text code first, so its old name is free for the numeric key. The foreign key from
-- asset_records.project_id follows the renamed column by itself.
ALTER TABLE `projects` RENAME COLUMN `project_id` TO `project_code`;
ALTER TABLE `projects` RENAME COLUMN `master_id` TO `project_id`;
ALTER TABLE `projects` RENAME INDEX `projects_project_id_key` TO `projects_project_code_key`;

-- Role values, in three steps: widen the enum, move the rows, narrow it.
ALTER TABLE `roles` MODIFY `role_name` ENUM('ADMIN', 'ADRIC_DIRECTOR', 'ADRIC_SECRETARY', 'TSG_STAFF', 'ITS_STAFF', 'LAB_HEAD', 'CUSTODIAN', 'RESEARCHER', 'IT_ADMIN') NOT NULL;

UPDATE `roles` SET `role_name` = 'RESEARCHER' WHERE `role_name` = 'CUSTODIAN';
UPDATE `roles` SET `role_name` = 'IT_ADMIN' WHERE `role_name` = 'ADMIN';

-- ITS_STAFF holders become TSG_STAFF. A TSG_STAFF role row is added only if some account needs it.
INSERT INTO `roles` (`role_name`)
SELECT 'TSG_STAFF' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `roles` WHERE `role_name` = 'TSG_STAFF')
  AND EXISTS (SELECT 1 FROM `user_roles` ur JOIN `roles` r ON r.`role_id` = ur.`role_id` WHERE r.`role_name` = 'ITS_STAFF');

-- An account that already holds TSG_STAFF loses its ITS_STAFF row instead of getting a second TSG_STAFF row.
DELETE ur FROM `user_roles` ur
JOIN `roles` its ON its.`role_id` = ur.`role_id` AND its.`role_name` = 'ITS_STAFF'
JOIN (
    SELECT DISTINCT ur2.`user_id`
    FROM `user_roles` ur2 JOIN `roles` r2 ON r2.`role_id` = ur2.`role_id`
    WHERE r2.`role_name` = 'TSG_STAFF'
) has_tsg ON has_tsg.`user_id` = ur.`user_id`;

UPDATE `user_roles` ur
JOIN `roles` its ON its.`role_id` = ur.`role_id` AND its.`role_name` = 'ITS_STAFF'
SET ur.`role_id` = (SELECT `role_id` FROM (SELECT MIN(`role_id`) AS `role_id` FROM `roles` WHERE `role_name` = 'TSG_STAFF') tsg);

DELETE FROM `roles` WHERE `role_name` = 'ITS_STAFF';

-- Fails here, and changes nothing more, if any row still holds a removed value.
ALTER TABLE `roles` MODIFY `role_name` ENUM('IT_ADMIN', 'ADRIC_DIRECTOR', 'ADRIC_SECRETARY', 'TSG_STAFF', 'LAB_HEAD', 'RESEARCHER') NOT NULL;
