import "dotenv/config";
import { prisma } from "../src/prisma.js";
import { isAdult, isFemaleGender } from "../src/utils/creator.js";

try {
  const users = await prisma.usuario.findMany({
    where: {
      creatorStatus: "NAO_SOLICITADO",
      lives: { some: {} },
    },
    select: {
      id: true,
      creatorStatus: true,
      perfil: { select: { genero: true, nascimento: true } },
    },
  });

  let approved = 0;
  for (const user of users) {
    if (!isFemaleGender(user.perfil?.genero) || !isAdult(user.perfil?.nascimento)) continue;
    await prisma.usuario.update({
      where: { id: user.id },
      data: {
        creatorStatus: "APROVADA",
        creatorAprovadoEm: new Date(),
        creatorMotivo: "Migração: criadora com histórico de live anterior ao fluxo de aprovação",
      },
    });
    approved++;
  }
  console.log(`Backfill concluído: ${approved} criadora(s) histórica(s) aprovada(s).`);
} finally {
  await prisma.$disconnect();
}
