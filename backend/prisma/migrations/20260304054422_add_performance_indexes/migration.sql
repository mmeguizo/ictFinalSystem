-- CreateIndex
CREATE INDEX `Ticket_dueDate_idx` ON `Ticket`(`dueDate`);

-- CreateIndex
CREATE INDEX `Ticket_priority_idx` ON `Ticket`(`priority`);

-- CreateIndex
CREATE INDEX `Ticket_createdAt_idx` ON `Ticket`(`createdAt`);

-- CreateIndex
CREATE INDEX `Ticket_resolvedAt_idx` ON `Ticket`(`resolvedAt`);

-- CreateIndex
CREATE INDEX `Ticket_escalationLevel_idx` ON `Ticket`(`escalationLevel`);

-- CreateIndex
CREATE INDEX `Ticket_type_status_idx` ON `Ticket`(`type`, `status`);

-- CreateIndex
CREATE INDEX `Ticket_dueDate_status_idx` ON `Ticket`(`dueDate`, `status`);

-- CreateIndex
CREATE INDEX `TicketStatusHistory_ticketId_userId_idx` ON `TicketStatusHistory`(`ticketId`, `userId`);

-- CreateIndex
CREATE INDEX `TicketStatusHistory_createdAt_idx` ON `TicketStatusHistory`(`createdAt`);
