-- CreateTable
CREATE TABLE `Curtida` (
    `id` VARCHAR(191) NOT NULL,
    `deUsuarioId` VARCHAR(191) NOT NULL,
    `paraUsuarioId` VARCHAR(191) NOT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Curtida_paraUsuarioId_idx`(`paraUsuarioId`),
    UNIQUE INDEX `Curtida_deUsuarioId_paraUsuarioId_key`(`deUsuarioId`, `paraUsuarioId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Match` (
    `id` VARCHAR(191) NOT NULL,
    `usuarioAId` VARCHAR(191) NOT NULL,
    `usuarioBId` VARCHAR(191) NOT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Match_usuarioAId_idx`(`usuarioAId`),
    INDEX `Match_usuarioBId_idx`(`usuarioBId`),
    UNIQUE INDEX `Match_usuarioAId_usuarioBId_key`(`usuarioAId`, `usuarioBId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Curtida` ADD CONSTRAINT `Curtida_deUsuarioId_fkey` FOREIGN KEY (`deUsuarioId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Curtida` ADD CONSTRAINT `Curtida_paraUsuarioId_fkey` FOREIGN KEY (`paraUsuarioId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Match` ADD CONSTRAINT `Match_usuarioAId_fkey` FOREIGN KEY (`usuarioAId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Match` ADD CONSTRAINT `Match_usuarioBId_fkey` FOREIGN KEY (`usuarioBId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
