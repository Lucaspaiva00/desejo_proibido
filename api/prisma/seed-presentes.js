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

  { nome: "Batom", imagemUrl: "/assets/presentes/baton.png", custoCreditos: 5, minutos: 0, ativo: true },
  { nome: "Beijo", imagemUrl: "/assets/presentes/boca.png", custoCreditos: 8, minutos: 0, ativo: true },
  { nome: "Cartão VIP", imagemUrl: "/assets/presentes/cartao.png", custoCreditos: 10, minutos: 0, ativo: true },
  { nome: "Cartas", imagemUrl: "/assets/presentes/cartas.png", custoCreditos: 12, minutos: 0, ativo: true },

  { nome: "Dados da Sorte", imagemUrl: "/assets/presentes/dados.png", custoCreditos: 15, minutos: 0, ativo: true },
  { nome: "Dinheiro", imagemUrl: "/assets/presentes/dinheiro.png", custoCreditos: 20, minutos: 0, ativo: true },
  { nome: "Envelope", imagemUrl: "/assets/presentes/envelope.png", custoCreditos: 25, minutos: 0, ativo: true },
  { nome: "Rosas", imagemUrl: "/assets/presentes/flor.png", custoCreditos: 30, minutos: 0, ativo: true },

  { nome: "Moeda de Ouro", imagemUrl: "/assets/presentes/moedaouro.png", custoCreditos: 35, minutos: 0, ativo: true },
  { nome: "Coração de Ouro", imagemUrl: "/assets/presentes/ouro.png", custoCreditos: 40, minutos: 0, ativo: true },
  { nome: "Presente", imagemUrl: "/assets/presentes/presente.png", custoCreditos: 45, minutos: 0, ativo: true },
  { nome: "Caixa de Presente", imagemUrl: "/assets/presentes/presentecaixa.png", custoCreditos: 50, minutos: 0, ativo: true },

  { nome: "Sino de Luxo", imagemUrl: "/assets/presentes/sino.png", custoCreditos: 60, minutos: 0, ativo: true },
  { nome: "Taça", imagemUrl: "/assets/presentes/taca.png", custoCreditos: 70, minutos: 0, ativo: true },
  { nome: "Urso", imagemUrl: "/assets/presentes/urso.png", custoCreditos: 90, minutos: 0, ativo: true },
  { nome: "VIP", imagemUrl: "/assets/presentes/vip.png", custoCreditos: 120, minutos: 0, ativo: true },

  { nome: "Whisky", imagemUrl: "/assets/presentes/whisk.png", custoCreditos: 150, minutos: 0, ativo: true }

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
          imagemUrl: p.imagemUrl,
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
