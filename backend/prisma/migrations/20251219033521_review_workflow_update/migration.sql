/*
  Warnings:

  - You are about to drop the column `secretaryApprovedAt` on the `ticket` table. All the data in the column will be lost.
  - You are about to drop the column `secretaryApprovedById` on the `ticket` table. All the data in the column will be lost.
  - You are about to alter the column `status` on the `ticket` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(4))` to `Enum(EnumId(6))`.
  - The values [PENDING,SECRETARY_APPROVED] on the enum `TicketStatusHistory_toStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [PENDING,SECRETARY_APPROVED] on the enum `TicketStatusHistory_toStatus` will be removed. If these variants are still used in the database, this will fail.

*/

-- Step 1: Update existing ticket statuses before enum change
UPDATE `ticket` SET `status` = 'ASSIGNED' WHERE `status` = 'PENDING';
UPDATE `ticket` SET `status` = 'ASSIGNED' WHERE `status` = 'SECRETARY_APPROVED';

-- Step 2: Update existing status history before enum change
UPDATE `ticketstatushistory` SET `fromStatus` = 'ASSIGNED' WHERE `fromStatus` = 'PENDING';
UPDATE `ticketstatushistory` SET `fromStatus` = 'ASSIGNED' WHERE `fromStatus` = 'SECRETARY_APPROVED';
UPDATE `ticketstatushistory` SET `toStatus` = 'ASSIGNED' WHERE `toStatus` = 'PENDING';
UPDATE `ticketstatushistory` SET `toStatus` = 'ASSIGNED' WHERE `toStatus` = 'SECRETARY_APPROVED';

-- Step 3: AlterTable for ticket
ALTER TABLE `ticket` DROP COLUMN `secretaryApprovedAt`,
    DROP COLUMN `secretaryApprovedById`,
    ADD COLUMN `secretaryReviewedAt` DATETIME(3) NULL,
    ADD COLUMN `secretaryReviewedById` INTEGER NULL,
    MODIFY `status` ENUM('FOR_REVIEW', 'REVIEWED', 'DIRECTOR_APPROVED', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD', 'RESOLVED', 'CLOSED', 'CANCELLED') NOT NULL DEFAULT 'FOR_REVIEW';

-- Step 4: AlterTable for ticketstatushistory
ALTER TABLE `ticketstatushistory` MODIFY `fromStatus` ENUM('FOR_REVIEW', 'REVIEWED', 'DIRECTOR_APPROVED', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD', 'RESOLVED', 'CLOSED', 'CANCELLED') NULL,
    MODIFY `toStatus` ENUM('FOR_REVIEW', 'REVIEWED', 'DIRECTOR_APPROVED', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD', 'RESOLVED', 'CLOSED', 'CANCELLED') NOT NULL;
