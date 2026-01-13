-- CreateTable
CREATE TABLE `Usuario` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `senhaHash` VARCHAR(191) NOT NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Usuario_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Perfil` (
    `id` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `bio` TEXT NULL,
    `cidade` VARCHAR(191) NULL,
    `estado` VARCHAR(191) NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Perfil_usuarioId_key`(`usuarioId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Foto` (
    `id` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NOT NULL,
    `url` VARCHAR(191) NOT NULL,
    `principal` BOOLEAN NOT NULL DEFAULT false,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Foto_usuarioId_idx`(`usuarioId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

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

-- CreateTable
CREATE TABLE `Conversa` (
    `id` VARCHAR(191) NOT NULL,
    `matchId` VARCHAR(191) NOT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Conversa_matchId_key`(`matchId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Mensagem` (
    `id` VARCHAR(191) NOT NULL,
    `conversaId` VARCHAR(191) NOT NULL,
    `autorId` VARCHAR(191) NOT NULL,
    `texto` TEXT NOT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Mensagem_conversaId_idx`(`conversaId`),
    INDEX `Mensagem_autorId_idx`(`autorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

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
ALTER TABLE `Perfil` ADD CONSTRAINT `Perfil_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Foto` ADD CONSTRAINT `Foto_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Curtida` ADD CONSTRAINT `Curtida_deUsuarioId_fkey` FOREIGN KEY (`deUsuarioId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Curtida` ADD CONSTRAINT `Curtida_paraUsuarioId_fkey` FOREIGN KEY (`paraUsuarioId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Match` ADD CONSTRAINT `Match_usuarioAId_fkey` FOREIGN KEY (`usuarioAId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Match` ADD CONSTRAINT `Match_usuarioBId_fkey` FOREIGN KEY (`usuarioBId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Conversa` ADD CONSTRAINT `Conversa_matchId_fkey` FOREIGN KEY (`matchId`) REFERENCES `Match`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Mensagem` ADD CONSTRAINT `Mensagem_conversaId_fkey` FOREIGN KEY (`conversaId`) REFERENCES `Conversa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Mensagem` ADD CONSTRAINT `Mensagem_autorId_fkey` FOREIGN KEY (`autorId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Skip` ADD CONSTRAINT `Skip_deUsuarioId_fkey` FOREIGN KEY (`deUsuarioId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Skip` ADD CONSTRAINT `Skip_paraUsuarioId_fkey` FOREIGN KEY (`paraUsuarioId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Bloqueio` ADD CONSTRAINT `Bloqueio_deUsuarioId_fkey` FOREIGN KEY (`deUsuarioId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Bloqueio` ADD CONSTRAINT `Bloqueio_paraUsuarioId_fkey` FOREIGN KEY (`paraUsuarioId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Denuncia` ADD CONSTRAINT `Denuncia_denuncianteId_fkey` FOREIGN KEY (`denuncianteId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Denuncia` ADD CONSTRAINT `Denuncia_denunciadoId_fkey` FOREIGN KEY (`denunciadoId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
