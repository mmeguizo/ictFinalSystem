-- CreateIndex
CREATE FULLTEXT INDEX `Ticket_title_description_idx` ON `Ticket`(`title`, `description`);
