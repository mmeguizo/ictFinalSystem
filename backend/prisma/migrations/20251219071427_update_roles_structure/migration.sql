/*
  Warnings:

  - You are about to drop the column `department` on the `user` table. All the data in the column will be lost.
  - The values [OFFICE_HEAD] on the enum `User_role` will be removed. If these variants are still used in the database, this will fail.

*/

-- First, add the new role values to the enum (keeping OFFICE_HEAD temporarily)
ALTER TABLE `user` MODIFY `role` ENUM('ADMIN', 'DEVELOPER', 'TECHNICAL', 'SECRETARY', 'DIRECTOR', 'OFFICE_HEAD', 'MIS_HEAD', 'ITS_HEAD', 'USER') NOT NULL DEFAULT 'USER';

-- Update existing OFFICE_HEAD users to MIS_HEAD (you can manually change to ITS_HEAD in Prisma Studio if needed)
UPDATE `user` SET `role` = 'MIS_HEAD' WHERE `role` = 'OFFICE_HEAD';

-- Now safely remove OFFICE_HEAD from the enum and drop department column
ALTER TABLE `user` DROP COLUMN `department`,
    MODIFY `role` ENUM('ADMIN', 'DEVELOPER', 'TECHNICAL', 'SECRETARY', 'DIRECTOR', 'MIS_HEAD', 'ITS_HEAD', 'USER') NOT NULL DEFAULT 'USER';
