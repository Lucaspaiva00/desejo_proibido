// prisma/seed-presentes.js
import { prisma } from "../src/prisma.js";

const presentes = [
    { nome: "🔥 Fogo", custoCreditos: 5, minutos: 0, ativo: true },
    { nome: "💋 Beijo", custoCreditos: 10, minutos: 0, ativo: true },
    { nome: "🌹 Rosa", custoCreditos: 15, minutos: 0, ativo: true },
    { nome: "🍷 Vinho", custoCreditos: 20, minutos: 0, ativo: true },
    { nome: "⭐ Estrela", custoCreditos: 25, minutos: 0, ativo: true },
    { nome: "👑 Coroa", custoCreditos: 40, minutos: 0, ativo: true },
    { nome: "🎁 Presente", custoCreditos: 50, minutos: 0, ativo: true },
];

async function main() {
    let criados = 0, atualizados = 0;

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

    console.log(`✅ Seed OK | criados=${criados} | atualizados=${atualizados}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
