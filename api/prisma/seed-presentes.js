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
  let criados = 0;
  let atualizados = 0;

  for (const p of presentes) {
    const existente = await prisma.presente.findFirst({
      where: { nome: p.nome },
      select: { id: true },
    });

    if (existente?.id) {
      await prisma.presente.update({
        where: { id: existente.id },
        data: {
          emoji: p.emoji,
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

  console.log(`✅ Seed de presentes OK | criados=${criados} | atualizados=${atualizados}`);
}

main()
  .catch((e) => {
    console.error("❌ Erro no seed de presentes:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
