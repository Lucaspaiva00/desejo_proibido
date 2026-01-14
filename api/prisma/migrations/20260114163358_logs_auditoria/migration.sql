-- CreateTable
CREATE TABLE `LogAcesso` (
    `id` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `evento` VARCHAR(191) NOT NULL,
    `rota` VARCHAR(191) NULL,
    `metodo` VARCHAR(191) NULL,
    `status` INTEGER NULL,
    `ip` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `detalhe` VARCHAR(191) NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `LogAcesso_usuarioId_idx`(`usuarioId`),
    INDEX `LogAcesso_evento_idx`(`evento`),
    INDEX `LogAcesso_criadoEm_idx`(`criadoEm`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LogDenuncia` (
    `id` VARCHAR(191) NOT NULL,
    `denunciaId` VARCHAR(191) NULL,
    `denuncianteId` VARCHAR(191) NULL,
    `denunciadoId` VARCHAR(191) NULL,
    `adminId` VARCHAR(191) NULL,
    `tipo` VARCHAR(191) NOT NULL,
    `statusAntes` VARCHAR(191) NULL,
    `statusDepois` VARCHAR(191) NULL,
    `motivo` VARCHAR(191) NULL,
    `detalhes` VARCHAR(191) NULL,
    `ip` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `LogDenuncia_denunciaId_idx`(`denunciaId`),
    INDEX `LogDenuncia_denunciadoId_idx`(`denunciadoId`),
    INDEX `LogDenuncia_tipo_idx`(`tipo`),
    INDEX `LogDenuncia_criadoEm_idx`(`criadoEm`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `LogAcesso` ADD CONSTRAINT `LogAcesso_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `Usuario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LogDenuncia` ADD CONSTRAINT `LogDenuncia_denunciaId_fkey` FOREIGN KEY (`denunciaId`) REFERENCES `Denuncia`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LogDenuncia` ADD CONSTRAINT `LogDenuncia_denuncianteId_fkey` FOREIGN KEY (`denuncianteId`) REFERENCES `Usuario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LogDenuncia` ADD CONSTRAINT `LogDenuncia_denunciadoId_fkey` FOREIGN KEY (`denunciadoId`) REFERENCES `Usuario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LogDenuncia` ADD CONSTRAINT `LogDenuncia_adminId_fkey` FOREIGN KEY (`adminId`) REFERENCES `Usuario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
