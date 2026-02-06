import { prisma } from "../src/prisma.js";

const presentes = [
    { nome: "🔥 Fogo", emoji: "🔥", custoCreditos: 5, minutos: 0, ativo: true },
    { nome: "💋 Beijo", emoji: "💋", custoCreditos: 10, minutos: 0, ativo: true },
    { nome: "🌹 Rosa", emoji: "🌹", custoCreditos: 15, minutos: 0, ativo: true },
    { nome: "🍷 Vinho", emoji: "🍷", custoCreditos: 20, minutos: 0, ativo: true },
    { nome: "⭐ Estrela", emoji: "⭐", custoCreditos: 25, minutos: 0, ativo: true },
    { nome: "👑 Coroa", emoji: "👑", custoCreditos: 40, minutos: 0, ativo: true },
    { nome: "🎁 Presente", emoji: "🎁", custoCreditos: 50, minutos: 0, ativo: true },
];

async function main() {
    for (const presente of presentes) {
        await prisma.presente.upsert({
            where: { nome: presente.nome },
            update: {
                emoji: presente.emoji,
                custoCreditos: presente.custoCreditos,
                minutos: presente.minutos,
                ativo: presente.ativo,
            },
            create: presente,
        });
    }

    console.log(`✅ Seed de presentes executado (${presentes.length} registros)`);
}

main()
    .catch((e) => {
        console.error("❌ Erro no seed de presentes:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
