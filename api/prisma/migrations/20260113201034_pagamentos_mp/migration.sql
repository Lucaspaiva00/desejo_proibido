-- CreateTable
CREATE TABLE `Pagamento` (
    `id` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NOT NULL,
    `mpPaymentId` VARCHAR(191) NULL,
    `mpOrderId` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL,
    `plano` VARCHAR(191) NOT NULL,
    `valorCentavos` INTEGER NOT NULL,
    `moeda` VARCHAR(191) NOT NULL DEFAULT 'BRL',
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Pagamento_mpPaymentId_key`(`mpPaymentId`),
    INDEX `Pagamento_usuarioId_idx`(`usuarioId`),
    INDEX `Pagamento_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Pagamento` ADD CONSTRAINT `Pagamento_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
