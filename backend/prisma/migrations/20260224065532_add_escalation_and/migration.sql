-- AlterTable
ALTER TABLE `notification` MODIFY `type` ENUM('TICKET_CREATED', 'TICKET_REVIEWED', 'TICKET_REJECTED', 'TICKET_APPROVED', 'TICKET_DISAPPROVED', 'TICKET_ASSIGNED', 'STATUS_CHANGED', 'NOTE_ADDED', 'ATTACHMENT_ADDED', 'SLA_BREACH', 'TICKET_ESCALATED') NOT NULL;

-- AlterTable
ALTER TABLE `ticket` ADD COLUMN `escalatedAt` DATETIME(3) NULL,
    ADD COLUMN `escalationLevel` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `satisfactionComment` TEXT NULL,
    ADD COLUMN `satisfactionRating` INTEGER NULL;

-- AlterTable
ALTER TABLE `ticketattachment` ADD COLUMN `deletedAt` DATETIME(3) NULL,
    ADD COLUMN `deletedById` INTEGER NULL,
    ADD COLUMN `isDeleted` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `uploadedById` INTEGER NULL;

-- AlterTable
ALTER TABLE `user` ADD COLUMN `deactivatedAt` DATETIME(3) NULL,
    ADD COLUMN `deactivatedById` INTEGER NULL,
    ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX `TicketAttachment_uploadedById_idx` ON `TicketAttachment`(`uploadedById`);

-- CreateIndex
CREATE INDEX `User_role_idx` ON `User`(`role`);

-- CreateIndex
CREATE INDEX `User_isActive_idx` ON `User`(`isActive`);

-- AddForeignKey
ALTER TABLE `TicketAttachment` ADD CONSTRAINT `TicketAttachment_uploadedById_fkey` FOREIGN KEY (`uploadedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketAttachment` ADD CONSTRAINT `TicketAttachment_deletedById_fkey` FOREIGN KEY (`deletedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
