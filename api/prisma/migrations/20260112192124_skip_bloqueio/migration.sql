-- CreateTable
CREATE TABLE `Skip` (
    `id` VARCHAR(191) NOT NULL,
    `deUsuarioId` VARCHAR(191) NOT NULL,
    `paraUsuarioId` VARCHAR(191) NOT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Skip_paraUsuarioId_idx`(`paraUsuarioId`),
    UNIQUE INDEX `Skip_deUsuarioId_paraUsuarioId_key`(`deUsuarioId`, `paraUsuarioId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Bloqueio` (
    `id` VARCHAR(191) NOT NULL,
    `deUsuarioId` VARCHAR(191) NOT NULL,
    `paraUsuarioId` VARCHAR(191) NOT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Bloqueio_paraUsuarioId_idx`(`paraUsuarioId`),
    UNIQUE INDEX `Bloqueio_deUsuarioId_paraUsuarioId_key`(`deUsuarioId`, `paraUsuarioId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Skip` ADD CONSTRAINT `Skip_deUsuarioId_fkey` FOREIGN KEY (`deUsuarioId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Skip` ADD CONSTRAINT `Skip_paraUsuarioId_fkey` FOREIGN KEY (`paraUsuarioId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Bloqueio` ADD CONSTRAINT `Bloqueio_deUsuarioId_fkey` FOREIGN KEY (`deUsuarioId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Bloqueio` ADD CONSTRAINT `Bloqueio_paraUsuarioId_fkey` FOREIGN KEY (`paraUsuarioId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
