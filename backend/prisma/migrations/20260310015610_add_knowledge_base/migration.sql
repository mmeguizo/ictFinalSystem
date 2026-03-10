-- CreateTable
CREATE TABLE `KnowledgeArticle` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(191) NOT NULL,
    `content` LONGTEXT NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `tags` TEXT NULL,
    `status` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `viewCount` INTEGER NOT NULL DEFAULT 0,
    `helpfulCount` INTEGER NOT NULL DEFAULT 0,
    `createdById` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `KnowledgeArticle_category_idx`(`category`),
    INDEX `KnowledgeArticle_status_idx`(`status`),
    INDEX `KnowledgeArticle_createdById_idx`(`createdById`),
    INDEX `KnowledgeArticle_createdAt_idx`(`createdAt`),
    FULLTEXT INDEX `KnowledgeArticle_title_content_idx`(`title`, `content`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `KnowledgeArticle` ADD CONSTRAINT `KnowledgeArticle_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
