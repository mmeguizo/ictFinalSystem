/*
  Warnings:

  - A unique constraint covering the columns `[externalId]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `user` ADD COLUMN `externalId` VARCHAR(191) NULL,
    ADD COLUMN `role` ENUM('ADMIN', 'DEVELOPER', 'OFFICE_HEAD', 'USER') NOT NULL DEFAULT 'USER',
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL,
    MODIFY `password` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `User_externalId_key` ON `User`(`externalId`);
