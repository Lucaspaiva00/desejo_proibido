/*
  Warnings:

  - Added the required column `atualizadoEm` to the `Denuncia` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `denuncia` ADD COLUMN `atualizadoEm` DATETIME(3) NOT NULL,
    ADD COLUMN `status` ENUM('ABERTA', 'EM_ANALISE', 'RESOLVIDA', 'IGNORADA') NOT NULL DEFAULT 'ABERTA';

-- AlterTable
ALTER TABLE `usuario` ADD COLUMN `boostAte` DATETIME(3) NULL,
    ADD COLUMN `isPremium` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `modoInvisivel` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `plano` VARCHAR(191) NOT NULL DEFAULT 'FREE',
    ADD COLUMN `role` ENUM('USER', 'ADMIN') NOT NULL DEFAULT 'USER';

-- CreateTable
CREATE TABLE `Termo` (
    `id` VARCHAR(191) NOT NULL,
    `tipo` ENUM('TERMOS_USO', 'POLITICA_PRIVACIDADE') NOT NULL,
    `versao` VARCHAR(191) NOT NULL,
    `conteudo` LONGTEXT NOT NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Termo_tipo_ativo_idx`(`tipo`, `ativo`),
    UNIQUE INDEX `Termo_tipo_versao_key`(`tipo`, `versao`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AceiteTermos` (
    `id` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NOT NULL,
    `termoId` VARCHAR(191) NOT NULL,
    `origem` ENUM('WEB', 'MOBILE') NOT NULL DEFAULT 'WEB',
    `ip` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `aceitoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AceiteTermos_usuarioId_aceitoEm_idx`(`usuarioId`, `aceitoEm`),
    INDEX `AceiteTermos_termoId_idx`(`termoId`),
    UNIQUE INDEX `AceiteTermos_usuarioId_termoId_key`(`usuarioId`, `termoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AcaoAdmin` (
    `id` VARCHAR(191) NOT NULL,
    `adminId` VARCHAR(191) NOT NULL,
    `alvoId` VARCHAR(191) NULL,
    `tipo` VARCHAR(191) NOT NULL,
    `motivo` TEXT NULL,
    `detalhes` TEXT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AcaoAdmin_adminId_criadoEm_idx`(`adminId`, `criadoEm`),
    INDEX `AcaoAdmin_alvoId_criadoEm_idx`(`alvoId`, `criadoEm`),
    INDEX `AcaoAdmin_tipo_idx`(`tipo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BanGlobal` (
    `id` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NOT NULL,
    `motivo` TEXT NULL,
    `ate` DATETIME(3) NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `BanGlobal_usuarioId_key`(`usuarioId`),
    INDEX `BanGlobal_ativo_idx`(`ativo`),
    INDEX `BanGlobal_ate_idx`(`ate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Bloqueio_deUsuarioId_idx` ON `Bloqueio`(`deUsuarioId`);

-- CreateIndex
CREATE INDEX `Curtida_deUsuarioId_criadoEm_idx` ON `Curtida`(`deUsuarioId`, `criadoEm`);

-- CreateIndex
CREATE INDEX `Denuncia_status_idx` ON `Denuncia`(`status`);

-- CreateIndex
CREATE INDEX `Denuncia_criadoEm_idx` ON `Denuncia`(`criadoEm`);

-- CreateIndex
CREATE INDEX `Foto_principal_idx` ON `Foto`(`principal`);

-- CreateIndex
CREATE INDEX `Mensagem_conversaId_criadoEm_idx` ON `Mensagem`(`conversaId`, `criadoEm`);

-- CreateIndex
CREATE INDEX `Perfil_cidade_idx` ON `Perfil`(`cidade`);

-- CreateIndex
CREATE INDEX `Perfil_estado_idx` ON `Perfil`(`estado`);

-- CreateIndex
CREATE INDEX `Skip_deUsuarioId_criadoEm_idx` ON `Skip`(`deUsuarioId`, `criadoEm`);

-- CreateIndex
CREATE INDEX `Usuario_ativo_idx` ON `Usuario`(`ativo`);

-- CreateIndex
CREATE INDEX `Usuario_role_idx` ON `Usuario`(`role`);

-- CreateIndex
CREATE INDEX `Usuario_isPremium_idx` ON `Usuario`(`isPremium`);

-- CreateIndex
CREATE INDEX `Usuario_boostAte_idx` ON `Usuario`(`boostAte`);

-- AddForeignKey
ALTER TABLE `AceiteTermos` ADD CONSTRAINT `AceiteTermos_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AceiteTermos` ADD CONSTRAINT `AceiteTermos_termoId_fkey` FOREIGN KEY (`termoId`) REFERENCES `Termo`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AcaoAdmin` ADD CONSTRAINT `AcaoAdmin_adminId_fkey` FOREIGN KEY (`adminId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AcaoAdmin` ADD CONSTRAINT `AcaoAdmin_alvoId_fkey` FOREIGN KEY (`alvoId`) REFERENCES `Usuario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BanGlobal` ADD CONSTRAINT `BanGlobal_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
