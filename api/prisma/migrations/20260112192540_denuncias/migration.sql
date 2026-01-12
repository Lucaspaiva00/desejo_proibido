-- CreateTable
CREATE TABLE `Denuncia` (
    `id` VARCHAR(191) NOT NULL,
    `denuncianteId` VARCHAR(191) NOT NULL,
    `denunciadoId` VARCHAR(191) NOT NULL,
    `motivo` VARCHAR(191) NOT NULL,
    `descricao` TEXT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Denuncia_denunciadoId_idx`(`denunciadoId`),
    INDEX `Denuncia_denuncianteId_idx`(`denuncianteId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Denuncia` ADD CONSTRAINT `Denuncia_denuncianteId_fkey` FOREIGN KEY (`denuncianteId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Denuncia` ADD CONSTRAINT `Denuncia_denunciadoId_fkey` FOREIGN KEY (`denunciadoId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
