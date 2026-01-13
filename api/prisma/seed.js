import { prisma } from "../src/prisma.js";

async function main() {
    const jaTem = await prisma.termo.count({
        where: { ativo: true, tipo: { in: ["TERMOS_USO", "POLITICA_PRIVACIDADE"] } },
    });

    if (jaTem >= 2) {
        console.log("✅ Termos já existem. Nada a fazer.");
        return;
    }

    await prisma.termo.createMany({
        data: [
            {
                tipo: "TERMOS_USO",
                versao: "1.0",
                conteudo:
                    "TERMOS DE USO (v1.0)\n\n1) Uso da plataforma...\n2) Regras...\n3) Responsabilidades...\n\n(Edite esse texto depois com seu jurídico.)",
                ativo: true,
            },
            {
                tipo: "POLITICA_PRIVACIDADE",
                versao: "1.0",
                conteudo:
                    "POLÍTICA DE PRIVACIDADE (v1.0)\n\n1) Coleta de dados...\n2) Uso...\n3) Armazenamento...\n\n(Edite esse texto depois com seu jurídico.)",
                ativo: true,
            },
        ],
    });

    console.log("✅ Termos criados com sucesso.");
}

main()
    .catch((e) => {
        console.error("❌ Erro no seed:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
