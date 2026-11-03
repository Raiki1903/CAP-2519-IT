-- Batch 1, commit 9b: drop what the foundation migration replaced, now that no code reads or writes it.
-- Written by hand. These drops are deliberate (brief section 3.4): every value was copied by the foundation migration
-- (20261103120000) or is no longer needed, and the Nov 8 deploy is a fresh database.
--   asset_records    the asset's state: now assets.status, the open loan, and the newest TSG inspection
--   asset_monetary   funding and value: now assets.funding_source_id and assets.acquisition_value
--   asset_returns    each return: copied onto its loan (received_by_id, closed_at, remarks)
--   asset_transfers  the transfers feature, removed in commit 9
--   asset_maintenance.is_immediate  no longer read (0 rows were true on the UAT data, Stop 3)
--   projects.funding_agency         now projects.funding_source_id
-- The status enum of asset_records and the condition enum of asset_returns go with their tables. No other table points
-- at these four, so each DROP TABLE takes its own foreign keys with it.

DROP TABLE `asset_records`;
DROP TABLE `asset_monetary`;
DROP TABLE `asset_returns`;
DROP TABLE `asset_transfers`;

ALTER TABLE `asset_maintenance` DROP COLUMN `is_immediate`;
ALTER TABLE `projects` DROP COLUMN `funding_agency`;
