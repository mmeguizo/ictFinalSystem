/*
  Warnings:

  - A unique constraint covering the columns `[controlNumber]` on the table `Ticket` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `ticket` ADD COLUMN `controlNumber` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Ticket_controlNumber_key` ON `Ticket`(`controlNumber`);
