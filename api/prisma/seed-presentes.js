// prisma/seed-presentes.js
import { prisma } from "../src/prisma.js";

/**
 * Presentes PREMIUM usando apenas emojis (sem imagem e sem mudar banco).
 * - Emojis escolhidos pra ficarem bons no Windows/Chrome (menos "borda preta grossa")
 * - Nomes curtos, com cara de produto
 * - Escada de preços (impulso -> luxo -> elite)
 *
 * Overwrite:
 * - Desativa presentes antigos que não estiverem na lista
 * - Atualiza os existentes pelo nome (findFirst) e cria os novos
 */

const presentes = [
  // Impulso (baratos)
  { nome: "💌", custoCreditos: 3, minutos: 0, ativo: true },
  { nome: "✨", custoCreditos: 5, minutos: 0, ativo: true },
  { nome: "🌹", custoCreditos: 8, minutos: 0, ativo: true },

  // Romântico (médio)
  { nome: "💋", custoCreditos: 12, minutos: 0, ativo: true },
  { nome: "🍫", custoCreditos: 16, minutos: 0, ativo: true },
  { nome: "🍷", custoCreditos: 20, minutos: 0, ativo: true },

  // Luxo (alto)
  { nome: "💝", custoCreditos: 30, minutos: 0, ativo: true },
  { nome: "💎", custoCreditos: 45, minutos: 0, ativo: true },
  { nome: "🏆", custoCreditos: 60, minutos: 0, ativo: true },

  // Elite (muito alto)
  { nome: "👑", custoCreditos: 90, minutos: 0, ativo: true },
  { nome: "🏰", custoCreditos: 140, minutos: 0, ativo: true },
  { nome: "✈️", custoCreditos: 220, minutos: 0, ativo: true },
];

async function main() {
  let criados = 0;
  let atualizados = 0;
  let desativados = 0;

  const nomesNovos = new Set(presentes.map((p) => p.nome));

  // 1) Desativar presentes antigos fora da lista (overwrite limpo)
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

  // 2) Upsert manual por nome (schema sem unique)
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
