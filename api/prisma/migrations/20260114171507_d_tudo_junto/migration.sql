-- AlterTable
ALTER TABLE `mensagem` ADD COLUMN `metaJson` JSON NULL,
    ADD COLUMN `tipo` ENUM('TEXTO', 'PRESENTE', 'SISTEMA') NOT NULL DEFAULT 'TEXTO',
    MODIFY `texto` TEXT NULL;

-- AlterTable
ALTER TABLE `usuario` ADD COLUMN `minutosDisponiveis` INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `Presente` (
    `id` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `minutos` INTEGER NOT NULL DEFAULT 0,
    `imagemUrl` VARCHAR(191) NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Presente_ativo_idx`(`ativo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PresenteEnviado` (
    `id` VARCHAR(191) NOT NULL,
    `presenteId` VARCHAR(191) NOT NULL,
    `conversaId` VARCHAR(191) NOT NULL,
    `deUsuarioId` VARCHAR(191) NOT NULL,
    `paraUsuarioId` VARCHAR(191) NOT NULL,
    `minutos` INTEGER NOT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PresenteEnviado_conversaId_criadoEm_idx`(`conversaId`, `criadoEm`),
    INDEX `PresenteEnviado_paraUsuarioId_criadoEm_idx`(`paraUsuarioId`, `criadoEm`),
    INDEX `PresenteEnviado_deUsuarioId_criadoEm_idx`(`deUsuarioId`, `criadoEm`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PresenteEnviado` ADD CONSTRAINT `PresenteEnviado_presenteId_fkey` FOREIGN KEY (`presenteId`) REFERENCES `Presente`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PresenteEnviado` ADD CONSTRAINT `PresenteEnviado_conversaId_fkey` FOREIGN KEY (`conversaId`) REFERENCES `Conversa`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PresenteEnviado` ADD CONSTRAINT `PresenteEnviado_deUsuarioId_fkey` FOREIGN KEY (`deUsuarioId`) REFERENCES `Usuario`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PresenteEnviado` ADD CONSTRAINT `PresenteEnviado_paraUsuarioId_fkey` FOREIGN KEY (`paraUsuarioId`) REFERENCES `Usuario`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
