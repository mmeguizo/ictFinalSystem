-- Simplify ticket workflow: Remove PENDING_ACKNOWLEDGMENT/SCHEDULED, add PENDING status
-- Add fields: assignedDeveloperName, resolution, dateFinished
-- Remove deprecated schedule/monitor fields
-- Step 1: Migrate existing data from removed statuses
UPDATE `Ticket`
SET `status` = 'ASSIGNED'
WHERE `status` = 'PENDING_ACKNOWLEDGMENT';
UPDATE `Ticket`
SET `status` = 'IN_PROGRESS'
WHERE `status` = 'SCHEDULED';
-- Step 2: Migrate status history references
UPDATE `TicketStatusHistory`
SET `toStatus` = 'ASSIGNED'
WHERE `toStatus` = 'PENDING_ACKNOWLEDGMENT';
UPDATE `TicketStatusHistory`
SET `toStatus` = 'IN_PROGRESS'
WHERE `toStatus` = 'SCHEDULED';
UPDATE `TicketStatusHistory`
SET `fromStatus` = 'ASSIGNED'
WHERE `fromStatus` = 'PENDING_ACKNOWLEDGMENT';
UPDATE `TicketStatusHistory`
SET `fromStatus` = 'IN_PROGRESS'
WHERE `fromStatus` = 'SCHEDULED';
-- Step 3: Alter the Ticket status enum - remove old values, add PENDING
ALTER TABLE `Ticket`
MODIFY COLUMN `status` ENUM(
        'FOR_REVIEW',
        'REVIEWED',
        'DIRECTOR_APPROVED',
        'ASSIGNED',
        'PENDING',
        'IN_PROGRESS',
        'ON_HOLD',
        'RESOLVED',
        'CLOSED',
        'CANCELLED'
    ) NOT NULL DEFAULT 'FOR_REVIEW';
-- Step 4: Alter TicketStatusHistory enums 
ALTER TABLE `TicketStatusHistory`
MODIFY COLUMN `fromStatus` ENUM(
        'FOR_REVIEW',
        'REVIEWED',
        'DIRECTOR_APPROVED',
        'ASSIGNED',
        'PENDING',
        'IN_PROGRESS',
        'ON_HOLD',
        'RESOLVED',
        'CLOSED',
        'CANCELLED'
    ) NULL;
ALTER TABLE `TicketStatusHistory`
MODIFY COLUMN `toStatus` ENUM(
        'FOR_REVIEW',
        'REVIEWED',
        'DIRECTOR_APPROVED',
        'ASSIGNED',
        'PENDING',
        'IN_PROGRESS',
        'ON_HOLD',
        'RESOLVED',
        'CLOSED',
        'CANCELLED'
    ) NOT NULL;
-- Step 5: Add new fields to Ticket
ALTER TABLE `Ticket`
ADD COLUMN `assignedDeveloperName` VARCHAR(191) NULL;
ALTER TABLE `Ticket`
ADD COLUMN `resolution` TEXT NULL;
ALTER TABLE `Ticket`
ADD COLUMN `dateFinished` DATETIME(3) NULL;
-- Step 6: Drop deprecated columns
ALTER TABLE `Ticket` DROP COLUMN `headScheduledById`;
ALTER TABLE `Ticket` DROP COLUMN `headScheduledAt`;
ALTER TABLE `Ticket` DROP COLUMN `adminAcknowledgedById`;
ALTER TABLE `Ticket` DROP COLUMN `adminAcknowledgedAt`;
ALTER TABLE `Ticket` DROP COLUMN `monitorNotes`;
ALTER TABLE `Ticket` DROP COLUMN `recommendations`;
ALTER TABLE `Ticket` DROP COLUMN `monitoredById`;
ALTER TABLE `Ticket` DROP COLUMN `monitoredAt`;