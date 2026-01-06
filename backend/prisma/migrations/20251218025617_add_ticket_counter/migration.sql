-- CreateTable
CREATE TABLE `TicketCounter` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `year` INTEGER NOT NULL,
    `month` INTEGER NOT NULL,
    `counter` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `TicketCounter_year_month_key`(`year`, `month`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
