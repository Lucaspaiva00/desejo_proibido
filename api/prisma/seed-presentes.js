cd / usr / app / desejo_proibido / api
mkdir - p prisma

cat > prisma / seed - presentes.js << 'EOF'
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
    for (const p of presentes) {
        await prisma.presente.upsert({
            where: { nome: p.nome },
            update: p,
            create: p,
        });
    }
    console.log("✅ Presentes seed ok:", presentes.length);
}

main()
    .then(() => prisma.$disconnect())
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });
EOF
