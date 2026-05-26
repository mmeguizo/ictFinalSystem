-- CreateTable
CREATE TABLE `UserSkill` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `skill` VARCHAR(191) NOT NULL,

    INDEX `UserSkill_userId_idx`(`userId`),
    INDEX `UserSkill_skill_idx`(`skill`),
    UNIQUE INDEX `UserSkill_userId_skill_key`(`userId`, `skill`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ChatSession` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL DEFAULT 'New Chat',
    `status` ENUM('ACTIVE', 'CLOSED', 'TICKET_CREATED') NOT NULL DEFAULT 'ACTIVE',
    `ticketId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ChatSession_userId_idx`(`userId`),
    INDEX `ChatSession_status_idx`(`status`),
    INDEX `ChatSession_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ChatMessage` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sessionId` INTEGER NOT NULL,
    `role` ENUM('USER', 'ASSISTANT', 'SYSTEM') NOT NULL,
    `content` TEXT NOT NULL,
    `metadata` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ChatMessage_sessionId_idx`(`sessionId`),
    INDEX `ChatMessage_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TroubleshootingSolution` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `problem` TEXT NOT NULL,
    `solution` LONGTEXT NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `tags` TEXT NULL,
    `visibility` VARCHAR(191) NOT NULL DEFAULT 'INTERNAL',
    `ticketId` INTEGER NULL,
    `createdById` INTEGER NOT NULL,
    `embedding` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TroubleshootingSolution_category_idx`(`category`),
    INDEX `TroubleshootingSolution_visibility_idx`(`visibility`),
    INDEX `TroubleshootingSolution_createdById_idx`(`createdById`),
    INDEX `TroubleshootingSolution_createdAt_idx`(`createdAt`),
    FULLTEXT INDEX `TroubleshootingSolution_problem_solution_idx`(`problem`, `solution`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `UserSkill` ADD CONSTRAINT `UserSkill_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatSession` ADD CONSTRAINT `ChatSession_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatSession` ADD CONSTRAINT `ChatSession_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `Ticket`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatMessage` ADD CONSTRAINT `ChatMessage_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `ChatSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TroubleshootingSolution` ADD CONSTRAINT `TroubleshootingSolution_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `Ticket`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TroubleshootingSolution` ADD CONSTRAINT `TroubleshootingSolution_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
