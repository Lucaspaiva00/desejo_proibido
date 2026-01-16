-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "TermoTipo" AS ENUM ('TERMOS_USO', 'POLITICA_PRIVACIDADE');

-- CreateEnum
CREATE TYPE "AceiteOrigem" AS ENUM ('WEB', 'MOBILE');

-- CreateEnum
CREATE TYPE "DenunciaStatus" AS ENUM ('ABERTA', 'EM_ANALISE', 'RESOLVIDA', 'IGNORADA');

-- CreateEnum
CREATE TYPE "MensagemTipo" AS ENUM ('TEXTO', 'PRESENTE', 'SISTEMA');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "isInvisivel" BOOLEAN NOT NULL DEFAULT false,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "plano" TEXT NOT NULL DEFAULT 'FREE',
    "isPremium" BOOLEAN NOT NULL DEFAULT false,
    "modoInvisivel" BOOLEAN NOT NULL DEFAULT false,
    "boostAte" TIMESTAMP(3),
    "minutosDisponiveis" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Perfil" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "bio" TEXT,
    "cidade" TEXT,
    "estado" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "genero" TEXT,
    "nascimento" TIMESTAMP(3),
    "verificado" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Perfil_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Foto" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Foto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Curtida" (
    "id" TEXT NOT NULL,
    "deUsuarioId" TEXT NOT NULL,
    "paraUsuarioId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Curtida_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "usuarioAId" TEXT NOT NULL,
    "usuarioBId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversa" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mensagem" (
    "id" TEXT NOT NULL,
    "conversaId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "tipo" "MensagemTipo" NOT NULL DEFAULT 'TEXTO',
    "texto" TEXT,
    "metaJson" JSONB,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Mensagem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Skip" (
    "id" TEXT NOT NULL,
    "deUsuarioId" TEXT NOT NULL,
    "paraUsuarioId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Skip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bloqueio" (
    "id" TEXT NOT NULL,
    "deUsuarioId" TEXT NOT NULL,
    "paraUsuarioId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bloqueio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Denuncia" (
    "id" TEXT NOT NULL,
    "denuncianteId" TEXT NOT NULL,
    "denunciadoId" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "descricao" TEXT,
    "status" "DenunciaStatus" NOT NULL DEFAULT 'ABERTA',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Denuncia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Termo" (
    "id" TEXT NOT NULL,
    "tipo" "TermoTipo" NOT NULL,
    "versao" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Termo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AceiteTermos" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "termoId" TEXT NOT NULL,
    "origem" "AceiteOrigem" NOT NULL DEFAULT 'WEB',
    "ip" TEXT,
    "userAgent" TEXT,
    "aceitoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AceiteTermos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcaoAdmin" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "alvoId" TEXT,
    "tipo" TEXT NOT NULL,
    "motivo" TEXT,
    "detalhes" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcaoAdmin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BanGlobal" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "motivo" TEXT,
    "ate" TIMESTAMP(3),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BanGlobal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pagamento" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "mpPaymentId" TEXT,
    "mpOrderId" TEXT,
    "status" TEXT NOT NULL,
    "plano" TEXT NOT NULL,
    "valorCentavos" INTEGER NOT NULL,
    "moeda" TEXT NOT NULL DEFAULT 'BRL',
    "tipo" TEXT,
    "pacoteId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pagamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogAcesso" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT,
    "email" TEXT,
    "evento" TEXT NOT NULL,
    "rota" TEXT,
    "metodo" TEXT,
    "status" INTEGER,
    "ip" TEXT,
    "userAgent" TEXT,
    "detalhe" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LogAcesso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogDenuncia" (
    "id" TEXT NOT NULL,
    "denunciaId" TEXT,
    "denuncianteId" TEXT,
    "denunciadoId" TEXT,
    "adminId" TEXT,
    "tipo" TEXT NOT NULL,
    "statusAntes" TEXT,
    "statusDepois" TEXT,
    "motivo" TEXT,
    "detalhes" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LogDenuncia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditoMinuto" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "minutos" INTEGER NOT NULL,
    "refTipo" TEXT,
    "refId" TEXT,
    "detalhes" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditoMinuto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompraWoo" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "produtoId" TEXT,
    "produtoNome" TEXT,
    "minutosCreditados" INTEGER NOT NULL,
    "payloadJson" JSONB,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompraWoo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessaoLigacao" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "alvoId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "iniciadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizadoEm" TIMESTAMP(3),
    "segundosConsumidos" INTEGER NOT NULL DEFAULT 0,
    "minutosCobrados" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SessaoLigacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Presente" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "minutos" INTEGER NOT NULL DEFAULT 0,
    "imagemUrl" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Presente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PresenteEnviado" (
    "id" TEXT NOT NULL,
    "presenteId" TEXT NOT NULL,
    "conversaId" TEXT NOT NULL,
    "deUsuarioId" TEXT NOT NULL,
    "paraUsuarioId" TEXT NOT NULL,
    "minutos" INTEGER NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PresenteEnviado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreferenciaBusca" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "idadeMin" INTEGER DEFAULT 18,
    "idadeMax" INTEGER DEFAULT 99,
    "cidade" TEXT,
    "estado" TEXT,
    "generoAlvo" TEXT,
    "somenteVerificados" BOOLEAN NOT NULL DEFAULT false,
    "somenteComFoto" BOOLEAN NOT NULL DEFAULT false,
    "ordenarPor" TEXT NOT NULL DEFAULT 'recent',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreferenciaBusca_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "Usuario_ativo_idx" ON "Usuario"("ativo");

-- CreateIndex
CREATE INDEX "Usuario_role_idx" ON "Usuario"("role");

-- CreateIndex
CREATE INDEX "Usuario_isPremium_idx" ON "Usuario"("isPremium");

-- CreateIndex
CREATE INDEX "Usuario_boostAte_idx" ON "Usuario"("boostAte");

-- CreateIndex
CREATE UNIQUE INDEX "Perfil_usuarioId_key" ON "Perfil"("usuarioId");

-- CreateIndex
CREATE INDEX "Perfil_cidade_idx" ON "Perfil"("cidade");

-- CreateIndex
CREATE INDEX "Perfil_estado_idx" ON "Perfil"("estado");

-- CreateIndex
CREATE INDEX "Foto_usuarioId_idx" ON "Foto"("usuarioId");

-- CreateIndex
CREATE INDEX "Foto_principal_idx" ON "Foto"("principal");

-- CreateIndex
CREATE INDEX "Curtida_paraUsuarioId_idx" ON "Curtida"("paraUsuarioId");

-- CreateIndex
CREATE INDEX "Curtida_deUsuarioId_criadoEm_idx" ON "Curtida"("deUsuarioId", "criadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "Curtida_deUsuarioId_paraUsuarioId_key" ON "Curtida"("deUsuarioId", "paraUsuarioId");

-- CreateIndex
CREATE INDEX "Match_usuarioAId_idx" ON "Match"("usuarioAId");

-- CreateIndex
CREATE INDEX "Match_usuarioBId_idx" ON "Match"("usuarioBId");

-- CreateIndex
CREATE UNIQUE INDEX "Match_usuarioAId_usuarioBId_key" ON "Match"("usuarioAId", "usuarioBId");

-- CreateIndex
CREATE UNIQUE INDEX "Conversa_matchId_key" ON "Conversa"("matchId");

-- CreateIndex
CREATE INDEX "Mensagem_conversaId_idx" ON "Mensagem"("conversaId");

-- CreateIndex
CREATE INDEX "Mensagem_autorId_idx" ON "Mensagem"("autorId");

-- CreateIndex
CREATE INDEX "Mensagem_conversaId_criadoEm_idx" ON "Mensagem"("conversaId", "criadoEm");

-- CreateIndex
CREATE INDEX "Skip_paraUsuarioId_idx" ON "Skip"("paraUsuarioId");

-- CreateIndex
CREATE INDEX "Skip_deUsuarioId_criadoEm_idx" ON "Skip"("deUsuarioId", "criadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "Skip_deUsuarioId_paraUsuarioId_key" ON "Skip"("deUsuarioId", "paraUsuarioId");

-- CreateIndex
CREATE INDEX "Bloqueio_paraUsuarioId_idx" ON "Bloqueio"("paraUsuarioId");

-- CreateIndex
CREATE INDEX "Bloqueio_deUsuarioId_idx" ON "Bloqueio"("deUsuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "Bloqueio_deUsuarioId_paraUsuarioId_key" ON "Bloqueio"("deUsuarioId", "paraUsuarioId");

-- CreateIndex
CREATE INDEX "Denuncia_denunciadoId_idx" ON "Denuncia"("denunciadoId");

-- CreateIndex
CREATE INDEX "Denuncia_denuncianteId_idx" ON "Denuncia"("denuncianteId");

-- CreateIndex
CREATE INDEX "Denuncia_status_idx" ON "Denuncia"("status");

-- CreateIndex
CREATE INDEX "Denuncia_criadoEm_idx" ON "Denuncia"("criadoEm");

-- CreateIndex
CREATE INDEX "Termo_tipo_ativo_idx" ON "Termo"("tipo", "ativo");

-- CreateIndex
CREATE UNIQUE INDEX "Termo_tipo_versao_key" ON "Termo"("tipo", "versao");

-- CreateIndex
CREATE INDEX "AceiteTermos_usuarioId_aceitoEm_idx" ON "AceiteTermos"("usuarioId", "aceitoEm");

-- CreateIndex
CREATE INDEX "AceiteTermos_termoId_idx" ON "AceiteTermos"("termoId");

-- CreateIndex
CREATE UNIQUE INDEX "AceiteTermos_usuarioId_termoId_key" ON "AceiteTermos"("usuarioId", "termoId");

-- CreateIndex
CREATE INDEX "AcaoAdmin_adminId_criadoEm_idx" ON "AcaoAdmin"("adminId", "criadoEm");

-- CreateIndex
CREATE INDEX "AcaoAdmin_alvoId_criadoEm_idx" ON "AcaoAdmin"("alvoId", "criadoEm");

-- CreateIndex
CREATE INDEX "AcaoAdmin_tipo_idx" ON "AcaoAdmin"("tipo");

-- CreateIndex
CREATE UNIQUE INDEX "BanGlobal_usuarioId_key" ON "BanGlobal"("usuarioId");

-- CreateIndex
CREATE INDEX "BanGlobal_ativo_idx" ON "BanGlobal"("ativo");

-- CreateIndex
CREATE INDEX "BanGlobal_ate_idx" ON "BanGlobal"("ate");

-- CreateIndex
CREATE UNIQUE INDEX "Pagamento_mpPaymentId_key" ON "Pagamento"("mpPaymentId");

-- CreateIndex
CREATE INDEX "Pagamento_usuarioId_idx" ON "Pagamento"("usuarioId");

-- CreateIndex
CREATE INDEX "Pagamento_status_idx" ON "Pagamento"("status");

-- CreateIndex
CREATE INDEX "LogAcesso_usuarioId_idx" ON "LogAcesso"("usuarioId");

-- CreateIndex
CREATE INDEX "LogAcesso_evento_idx" ON "LogAcesso"("evento");

-- CreateIndex
CREATE INDEX "LogAcesso_criadoEm_idx" ON "LogAcesso"("criadoEm");

-- CreateIndex
CREATE INDEX "LogDenuncia_denunciaId_idx" ON "LogDenuncia"("denunciaId");

-- CreateIndex
CREATE INDEX "LogDenuncia_denunciadoId_idx" ON "LogDenuncia"("denunciadoId");

-- CreateIndex
CREATE INDEX "LogDenuncia_tipo_idx" ON "LogDenuncia"("tipo");

-- CreateIndex
CREATE INDEX "LogDenuncia_criadoEm_idx" ON "LogDenuncia"("criadoEm");

-- CreateIndex
CREATE INDEX "CreditoMinuto_usuarioId_idx" ON "CreditoMinuto"("usuarioId");

-- CreateIndex
CREATE INDEX "CreditoMinuto_refTipo_refId_idx" ON "CreditoMinuto"("refTipo", "refId");

-- CreateIndex
CREATE INDEX "CreditoMinuto_criadoEm_idx" ON "CreditoMinuto"("criadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "CompraWoo_orderId_key" ON "CompraWoo"("orderId");

-- CreateIndex
CREATE INDEX "CompraWoo_usuarioId_idx" ON "CompraWoo"("usuarioId");

-- CreateIndex
CREATE INDEX "CompraWoo_criadoEm_idx" ON "CompraWoo"("criadoEm");

-- CreateIndex
CREATE INDEX "SessaoLigacao_usuarioId_idx" ON "SessaoLigacao"("usuarioId");

-- CreateIndex
CREATE INDEX "SessaoLigacao_alvoId_idx" ON "SessaoLigacao"("alvoId");

-- CreateIndex
CREATE INDEX "SessaoLigacao_status_idx" ON "SessaoLigacao"("status");

-- CreateIndex
CREATE INDEX "Presente_ativo_idx" ON "Presente"("ativo");

-- CreateIndex
CREATE INDEX "PresenteEnviado_conversaId_criadoEm_idx" ON "PresenteEnviado"("conversaId", "criadoEm");

-- CreateIndex
CREATE INDEX "PresenteEnviado_paraUsuarioId_criadoEm_idx" ON "PresenteEnviado"("paraUsuarioId", "criadoEm");

-- CreateIndex
CREATE INDEX "PresenteEnviado_deUsuarioId_criadoEm_idx" ON "PresenteEnviado"("deUsuarioId", "criadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "PreferenciaBusca_usuarioId_key" ON "PreferenciaBusca"("usuarioId");

-- CreateIndex
CREATE INDEX "PreferenciaBusca_cidade_idx" ON "PreferenciaBusca"("cidade");

-- CreateIndex
CREATE INDEX "PreferenciaBusca_estado_idx" ON "PreferenciaBusca"("estado");

-- AddForeignKey
ALTER TABLE "Perfil" ADD CONSTRAINT "Perfil_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Foto" ADD CONSTRAINT "Foto_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Curtida" ADD CONSTRAINT "Curtida_deUsuarioId_fkey" FOREIGN KEY ("deUsuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Curtida" ADD CONSTRAINT "Curtida_paraUsuarioId_fkey" FOREIGN KEY ("paraUsuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_usuarioAId_fkey" FOREIGN KEY ("usuarioAId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_usuarioBId_fkey" FOREIGN KEY ("usuarioBId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversa" ADD CONSTRAINT "Conversa_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mensagem" ADD CONSTRAINT "Mensagem_conversaId_fkey" FOREIGN KEY ("conversaId") REFERENCES "Conversa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mensagem" ADD CONSTRAINT "Mensagem_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Skip" ADD CONSTRAINT "Skip_deUsuarioId_fkey" FOREIGN KEY ("deUsuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Skip" ADD CONSTRAINT "Skip_paraUsuarioId_fkey" FOREIGN KEY ("paraUsuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bloqueio" ADD CONSTRAINT "Bloqueio_deUsuarioId_fkey" FOREIGN KEY ("deUsuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bloqueio" ADD CONSTRAINT "Bloqueio_paraUsuarioId_fkey" FOREIGN KEY ("paraUsuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Denuncia" ADD CONSTRAINT "Denuncia_denuncianteId_fkey" FOREIGN KEY ("denuncianteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Denuncia" ADD CONSTRAINT "Denuncia_denunciadoId_fkey" FOREIGN KEY ("denunciadoId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AceiteTermos" ADD CONSTRAINT "AceiteTermos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AceiteTermos" ADD CONSTRAINT "AceiteTermos_termoId_fkey" FOREIGN KEY ("termoId") REFERENCES "Termo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcaoAdmin" ADD CONSTRAINT "AcaoAdmin_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcaoAdmin" ADD CONSTRAINT "AcaoAdmin_alvoId_fkey" FOREIGN KEY ("alvoId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BanGlobal" ADD CONSTRAINT "BanGlobal_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pagamento" ADD CONSTRAINT "Pagamento_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogAcesso" ADD CONSTRAINT "LogAcesso_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogDenuncia" ADD CONSTRAINT "LogDenuncia_denunciaId_fkey" FOREIGN KEY ("denunciaId") REFERENCES "Denuncia"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogDenuncia" ADD CONSTRAINT "LogDenuncia_denuncianteId_fkey" FOREIGN KEY ("denuncianteId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogDenuncia" ADD CONSTRAINT "LogDenuncia_denunciadoId_fkey" FOREIGN KEY ("denunciadoId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogDenuncia" ADD CONSTRAINT "LogDenuncia_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditoMinuto" ADD CONSTRAINT "CreditoMinuto_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompraWoo" ADD CONSTRAINT "CompraWoo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessaoLigacao" ADD CONSTRAINT "SessaoLigacao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessaoLigacao" ADD CONSTRAINT "SessaoLigacao_alvoId_fkey" FOREIGN KEY ("alvoId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresenteEnviado" ADD CONSTRAINT "PresenteEnviado_presenteId_fkey" FOREIGN KEY ("presenteId") REFERENCES "Presente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresenteEnviado" ADD CONSTRAINT "PresenteEnviado_conversaId_fkey" FOREIGN KEY ("conversaId") REFERENCES "Conversa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresenteEnviado" ADD CONSTRAINT "PresenteEnviado_deUsuarioId_fkey" FOREIGN KEY ("deUsuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresenteEnviado" ADD CONSTRAINT "PresenteEnviado_paraUsuarioId_fkey" FOREIGN KEY ("paraUsuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreferenciaBusca" ADD CONSTRAINT "PreferenciaBusca_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
