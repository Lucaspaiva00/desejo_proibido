// prisma/seed-presentes.js
import { prisma } from "../src/prisma.js";

/**
 * Presentes "premium" usando apenas emojis (sem imagem e sem mudar banco).
 * - Nomes curtos, com cara de produto
 * - Escada de preços (impulso -> luxo)
 *
 * Observação:
 * - Como "nome" não é unique no schema, fazemos findFirst por nome.
 * - Para "sobrescrever", além de upsert manual, desativamos os que não estiverem na lista.
 */

const presentes = [
    // Impulso (baratos)
    { nome: "💌 Bilhetinho", custoCreditos: 3, minutos: 0, ativo: true },
    { nome: "✨ Elogio", custoCreditos: 5, minutos: 0, ativo: true },
    { nome: "🌹 Rosa", custoCreditos: 8, minutos: 0, ativo: true },

    // Romântico (médio)
    { nome: "💋 Beijo", custoCreditos: 12, minutos: 0, ativo: true },
    { nome: "🍫 Chocolate", custoCreditos: 16, minutos: 0, ativo: true },
    { nome: "🥂 Brinde", custoCreditos: 20, minutos: 0, ativo: true },

    // Luxo (alto)
    { nome: "🎀 Presente Chic", custoCreditos: 30, minutos: 0, ativo: true },
    { nome: "💎 Diamante", custoCreditos: 45, minutos: 0, ativo: true },
    { nome: "💍 Anel", custoCreditos: 60, minutos: 0, ativo: true },

    // Elite (muito alto)
    { nome: "👑 Coroa", custoCreditos: 90, minutos: 0, ativo: true },
    { nome: "🏰 Castelo", custoCreditos: 140, minutos: 0, ativo: true },
    { nome: "✈️ Viagem", custoCreditos: 220, minutos: 0, ativo: true },
];

async function main() {
    let criados = 0;
    let atualizados = 0;
    let desativados = 0;

    const nomesNovos = new Set(presentes.map((p) => p.nome));

    // 1) Desativa presentes antigos que não estão mais na lista (overwrite "limpo")
    const existentes = await prisma.presente.findMany({
        select: { id: true, nome: true, ativo: true },
    });

    const paraDesativar = existentes.filter((x) => !nomesNovos.has(x.nome) && x.ativo);
    if (paraDesativar.length) {
        await prisma.presente.updateMany({
            where: { id: { in: paraDesativar.map((x) => x.id) } },
            data: { ativo: false },
        });
        desativados = paraDesativar.length;
    }

    // 2) Upsert manual por nome (como seu schema não tem unique)
    for (const p of presentes) {
        const existente = await prisma.presente.findFirst({
            where: { nome: p.nome },
            select: { id: true },
        });

        if (existente) {
            await prisma.presente.update({
                where: { id: existente.id },
                data: {
                    custoCreditos: p.custoCreditos,
                    minutos: p.minutos,
                    ativo: p.ativo,
                },
            });
            atualizados++;
        } else {
            await prisma.presente.create({ data: p });
            criados++;
        }
    }

    console.log(
        `✅ Presentes OK | criados=${criados} | atualizados=${atualizados} | desativados=${desativados}`
    );
}

main()
    .catch((e) => {
        console.error("❌ Erro no seed de presentes:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
