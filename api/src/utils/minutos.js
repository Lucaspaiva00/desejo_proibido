import { prisma } from "../prisma.js";

export async function creditarMinutos({ usuarioId, minutos, tipo = "CREDITO", refTipo, refId, detalhes }) {
    if (!usuarioId) throw new Error("usuarioId obrigatório");
    if (!Number.isInteger(minutos) || minutos === 0) throw new Error("minutos inválido");

    return prisma.$transaction(async (tx) => {
        await tx.usuario.update({
            where: { id: usuarioId },
            data: { minutosDisponiveis: { increment: minutos } },
        });

        const extrato = await tx.creditoMinuto.create({
            data: {
                usuarioId,
                tipo,
                minutos,
                refTipo: refTipo ?? null,
                refId: refId ?? null,
                detalhes: detalhes ?? null,
            },
        });

        const u = await tx.usuario.findUnique({
            where: { id: usuarioId },
            select: { minutosDisponiveis: true },
        });

        return { extrato, saldo: u?.minutosDisponiveis ?? 0 };
    });
}

export async function debitarMinutos({ usuarioId, minutos, refTipo, refId, detalhes }) {
    if (!usuarioId) throw new Error("usuarioId obrigatório");
    if (!Number.isInteger(minutos) || minutos <= 0) throw new Error("minutos inválido");

    return prisma.$transaction(async (tx) => {
        const u = await tx.usuario.findUnique({
            where: { id: usuarioId },
            select: { id: true, minutosDisponiveis: true, ativo: true },
        });

        if (!u || !u.ativo) throw new Error("Usuário inválido");
        if (u.minutosDisponiveis < minutos) throw new Error("Saldo de minutos insuficiente");

        await tx.usuario.update({
            where: { id: usuarioId },
            data: { minutosDisponiveis: { decrement: minutos } },
        });

        const extrato = await tx.creditoMinuto.create({
            data: {
                usuarioId,
                tipo: "DEBITO",
                minutos: -minutos,
                refTipo: refTipo ?? null,
                refId: refId ?? null,
                detalhes: detalhes ?? null,
            },
        });

        const u2 = await tx.usuario.findUnique({
            where: { id: usuarioId },
            select: { minutosDisponiveis: true },
        });

        return { extrato, saldo: u2?.minutosDisponiveis ?? 0 };
    });
}
