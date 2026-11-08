-- Equipment a researcher bought with their own money needs a funding source to pick (#167).
-- Databases that already exist do not get it from the seed, so it is added here. Safe to run twice.
INSERT INTO `funding_sources` (`name`)
SELECT 'Personal (self-funded)'
WHERE NOT EXISTS (SELECT 1 FROM `funding_sources` WHERE `name` = 'Personal (self-funded)');
