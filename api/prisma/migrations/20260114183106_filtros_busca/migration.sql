-- AlterTable
ALTER TABLE `perfil` ADD COLUMN `genero` VARCHAR(191) NULL,
    ADD COLUMN `nascimento` DATETIME(3) NULL,
    ADD COLUMN `verificado` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `PreferenciaBusca` (
    `id` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NOT NULL,
    `idadeMin` INTEGER NULL DEFAULT 18,
    `idadeMax` INTEGER NULL DEFAULT 99,
    `cidade` VARCHAR(191) NULL,
    `estado` VARCHAR(191) NULL,
    `generoAlvo` VARCHAR(191) NULL,
    `somenteVerificados` BOOLEAN NOT NULL DEFAULT false,
    `somenteComFoto` BOOLEAN NOT NULL DEFAULT false,
    `ordenarPor` VARCHAR(191) NOT NULL DEFAULT 'recent',
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PreferenciaBusca_usuarioId_key`(`usuarioId`),
    INDEX `PreferenciaBusca_cidade_idx`(`cidade`),
    INDEX `PreferenciaBusca_estado_idx`(`estado`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PreferenciaBusca` ADD CONSTRAINT `PreferenciaBusca_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `Usuario`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
