-- CreateTable
CREATE TABLE `CreditoMinuto` (
    `id` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NOT NULL,
    `tipo` VARCHAR(191) NOT NULL,
    `minutos` INTEGER NOT NULL,
    `refTipo` VARCHAR(191) NULL,
    `refId` VARCHAR(191) NULL,
    `detalhes` VARCHAR(191) NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CreditoMinuto_usuarioId_idx`(`usuarioId`),
    INDEX `CreditoMinuto_refTipo_refId_idx`(`refTipo`, `refId`),
    INDEX `CreditoMinuto_criadoEm_idx`(`criadoEm`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CompraWoo` (
    `id` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `produtoId` VARCHAR(191) NULL,
    `produtoNome` VARCHAR(191) NULL,
    `minutosCreditados` INTEGER NOT NULL,
    `payloadJson` JSON NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CompraWoo_orderId_key`(`orderId`),
    INDEX `CompraWoo_usuarioId_idx`(`usuarioId`),
    INDEX `CompraWoo_criadoEm_idx`(`criadoEm`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SessaoLigacao` (
    `id` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NOT NULL,
    `alvoId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `iniciadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `finalizadoEm` DATETIME(3) NULL,
    `segundosConsumidos` INTEGER NOT NULL DEFAULT 0,
    `minutosCobrados` INTEGER NOT NULL DEFAULT 0,

    INDEX `SessaoLigacao_usuarioId_idx`(`usuarioId`),
    INDEX `SessaoLigacao_alvoId_idx`(`alvoId`),
    INDEX `SessaoLigacao_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CreditoMinuto` ADD CONSTRAINT `CreditoMinuto_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `Usuario`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompraWoo` ADD CONSTRAINT `CompraWoo_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `Usuario`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SessaoLigacao` ADD CONSTRAINT `SessaoLigacao_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `Usuario`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SessaoLigacao` ADD CONSTRAINT `SessaoLigacao_alvoId_fkey` FOREIGN KEY (`alvoId`) REFERENCES `Usuario`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
