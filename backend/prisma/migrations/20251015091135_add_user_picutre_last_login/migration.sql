-- AlterTable
ALTER TABLE `user` ADD COLUMN `lastLoginAt` DATETIME(3) NULL,
    ADD COLUMN `picture` VARCHAR(191) NULL;
