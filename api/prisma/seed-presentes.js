// prisma/seed-presentes.js
import { prisma } from "../src/prisma.js";

const presentes = [
  { nome: "Algema Dourada", imagemUrl: "/assets/presentes/algema_dourada.png", custoCreditos: 25, minutos: 0, ativo: true },
  { nome: "Anel com Moeda", imagemUrl: "/assets/presentes/anel_moeda_coracao.png", custoCreditos: 20, minutos: 0, ativo: true },
  { nome: "Balde Champagne Luxo", imagemUrl: "/assets/presentes/balde_champagne_luxo.png", custoCreditos: 80, minutos: 0, ativo: true },
  { nome: "Batom", imagemUrl: "/assets/presentes/baton.png", custoCreditos: 5, minutos: 0, ativo: true },
  { nome: "Beijo", imagemUrl: "/assets/presentes/boca.png", custoCreditos: 8, minutos: 0, ativo: true },

  { nome: "Bracelete Joia Preta", imagemUrl: "/assets/presentes/bracelete_joia_preta.png", custoCreditos: 100, minutos: 0, ativo: true },
  { nome: "Busto Feminino Luxo", imagemUrl: "/assets/presentes/busto_feminino_luxo.png", custoCreditos: 110, minutos: 0, ativo: true },
  { nome: "Cadeado Coração M", imagemUrl: "/assets/presentes/cadeado_coracao_letra_m.png", custoCreditos: 45, minutos: 0, ativo: true },
  { nome: "Caixa Prêmio I", imagemUrl: "/assets/presentes/caixa_premio_letra_i.png", custoCreditos: 90, minutos: 0, ativo: true },
  { nome: "Caixa Presente Dourada", imagemUrl: "/assets/presentes/caixa_presente_dourada.png", custoCreditos: 55, minutos: 0, ativo: true },
  { nome: "Caixa Presente Preta", imagemUrl: "/assets/presentes/caixa_presente_preta.png", custoCreditos: 50, minutos: 0, ativo: true },

  { nome: "Carta de Coração", imagemUrl: "/assets/presentes/carta_coracao_luxo.png", custoCreditos: 18, minutos: 0, ativo: true },
  { nome: "Cartão VIP", imagemUrl: "/assets/presentes/cartao.png", custoCreditos: 10, minutos: 0, ativo: true },
  { nome: "Cartas", imagemUrl: "/assets/presentes/cartas.png", custoCreditos: 12, minutos: 0, ativo: true },
  { nome: "Carteira Coração", imagemUrl: "/assets/presentes/carteira_coracao_preta.png", custoCreditos: 35, minutos: 0, ativo: true },
  { nome: "Carteira Premium", imagemUrl: "/assets/presentes/carteira_dinheiro_premium.png", custoCreditos: 60, minutos: 0, ativo: true },

  { nome: "Cofre Dourado", imagemUrl: "/assets/presentes/cofre_dinheiro_dourado.png", custoCreditos: 95, minutos: 0, ativo: true },
  { nome: "Cofre Ouro Luxo", imagemUrl: "/assets/presentes/cofre_ouro_luxo.png", custoCreditos: 120, minutos: 0, ativo: true },
  { nome: "Coração com Dados", imagemUrl: "/assets/presentes/coracao_dados.png", custoCreditos: 30, minutos: 0, ativo: true },
  { nome: "Coração Pixel", imagemUrl: "/assets/presentes/coracao_pixel_vermelho.png", custoCreditos: 28, minutos: 0, ativo: true },
  { nome: "Coração Rubi", imagemUrl: "/assets/presentes/coracao_rubi_luxo.png", custoCreditos: 40, minutos: 0, ativo: true },
  { nome: "Coroa Real", imagemUrl: "/assets/presentes/coroa_real_dourada.png", custoCreditos: 85, minutos: 0, ativo: true },

  { nome: "Dados da Sorte", imagemUrl: "/assets/presentes/dados.png", custoCreditos: 15, minutos: 0, ativo: true },
  { nome: "Dinheiro", imagemUrl: "/assets/presentes/dinheiro.png", custoCreditos: 20, minutos: 0, ativo: true },
  { nome: "Envelope", imagemUrl: "/assets/presentes/envelope.png", custoCreditos: 22, minutos: 0, ativo: true },
  { nome: "Estrela de Ouro", imagemUrl: "/assets/presentes/estrela_moedas_ouro.png", custoCreditos: 75, minutos: 0, ativo: true },
  { nome: "Rosas", imagemUrl: "/assets/presentes/flor.png", custoCreditos: 30, minutos: 0, ativo: true },

  { nome: "Frasco Luxo Estrela", imagemUrl: "/assets/presentes/frasco_luxo_estrela.png", custoCreditos: 88, minutos: 0, ativo: true },
  { nome: "Lingerie Vermelha", imagemUrl: "/assets/presentes/lingerie_vermelha_luxo.png", custoCreditos: 130, minutos: 0, ativo: true },
  { nome: "Maço de Dinheiro", imagemUrl: "/assets/presentes/maco_dinheiro_luxo.png", custoCreditos: 70, minutos: 0, ativo: true },
  { nome: "Maleta Luxo G", imagemUrl: "/assets/presentes/maleta_luxo_letra_g.png", custoCreditos: 105, minutos: 0, ativo: true },
  { nome: "Moeda de Ouro", imagemUrl: "/assets/presentes/moedaouro.png", custoCreditos: 35, minutos: 0, ativo: true },
  { nome: "Coração de Ouro", imagemUrl: "/assets/presentes/ouro.png", custoCreditos: 40, minutos: 0, ativo: true },

  { nome: "Presente", imagemUrl: "/assets/presentes/presente.png", custoCreditos: 45, minutos: 0, ativo: true },
  { nome: "Caixa de Presente", imagemUrl: "/assets/presentes/presentecaixa.png", custoCreditos: 48, minutos: 0, ativo: true },
  { nome: "Pulseira Pingentes", imagemUrl: "/assets/presentes/pulseira_pingentes_luxo.png", custoCreditos: 32, minutos: 0, ativo: true },
  { nome: "Saco de Dinheiro", imagemUrl: "/assets/presentes/saco_dinheiro_premium.png", custoCreditos: 65, minutos: 0, ativo: true },
  { nome: "Sacola Presente Preta", imagemUrl: "/assets/presentes/sacola_presente_preta.png", custoCreditos: 68, minutos: 0, ativo: true },

  { nome: "Salto com Corrente", imagemUrl: "/assets/presentes/salto_corrente_dourada.png", custoCreditos: 140, minutos: 0, ativo: true },
  { nome: "Salto Preto Luxo", imagemUrl: "/assets/presentes/salto_preto_luxo.png", custoCreditos: 125, minutos: 0, ativo: true },
  { nome: "Sino de Luxo", imagemUrl: "/assets/presentes/sino.png", custoCreditos: 60, minutos: 0, ativo: true },
  { nome: "Taça", imagemUrl: "/assets/presentes/taca.png", custoCreditos: 70, minutos: 0, ativo: true },
  { nome: "Taça Brinde Dupla", imagemUrl: "/assets/presentes/taca_brinde_dupla.png", custoCreditos: 95, minutos: 0, ativo: true },
  { nome: "Taças com Laço", imagemUrl: "/assets/presentes/tacas_laco_dourado.png", custoCreditos: 100, minutos: 0, ativo: true },

  { nome: "Urso", imagemUrl: "/assets/presentes/urso.png", custoCreditos: 90, minutos: 0, ativo: true },
  { nome: "VIP", imagemUrl: "/assets/presentes/vip.png", custoCreditos: 120, minutos: 0, ativo: true },
  { nome: "Whisky", imagemUrl: "/assets/presentes/whisk.png", custoCreditos: 150, minutos: 0, ativo: true },
];

async function main() {
  let criados = 0;
  let atualizados = 0;
  let desativados = 0;

  const nomesNovos = new Set(presentes.map((p) => p.nome));

  // Desativa presentes antigos fora da lista
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

  
  for (const p of presentes) {
    const existente = await prisma.presente.findFirst({
      where: { nome: p.nome },
      select: { id: true },
    });

    if (existente) {
      await prisma.presente.update({
        where: { id: existente.id },
        data: {
          imagemUrl: p.imagemUrl,
          custoCreditos: p.custoCreditos,
          minutos: p.minutos,
          ativo: p.ativo,
        },
      });
      atualizados++;
    } else {
      await prisma.presente.create({
        data: p,
      });
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