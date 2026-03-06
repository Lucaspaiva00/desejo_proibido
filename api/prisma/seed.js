import { prisma } from "../src/prisma.js";

const TERMOS_USO = `
TERMOS DE USO — DESEJO PROIBIDO
Versão 1.0

1. ACEITAÇÃO DOS TERMOS

Ao acessar ou utilizar a plataforma Desejo Proibido, o usuário declara ter lido, compreendido e concordado com estes Termos de Uso e com a Política de Privacidade.

Caso não concorde com qualquer condição, o usuário não deve utilizar a plataforma.

--------------------------------------------------

2. DESCRIÇÃO DO SERVIÇO

O Desejo Proibido é uma plataforma online que permite:

• criação de perfis
• interação entre usuários
• troca de mensagens
• envio de mídias
• envio de presentes virtuais
• acesso a funcionalidades premium mediante créditos ou assinatura

A plataforma é destinada exclusivamente para maiores de 18 anos.

--------------------------------------------------

3. IDADE MÍNIMA

Ao criar uma conta, o usuário declara que possui pelo menos 18 anos de idade.

O uso por menores de idade é estritamente proibido e poderá resultar na remoção imediata da conta.

--------------------------------------------------

4. CADASTRO DE USUÁRIO

Para utilizar a plataforma, o usuário deve fornecer informações verdadeiras e atualizadas.

O usuário é responsável por:

• manter a confidencialidade da sua senha
• não compartilhar sua conta
• atualizar suas informações quando necessário

--------------------------------------------------

5. CONDUTA DO USUÁRIO

É proibido utilizar a plataforma para:

• atividades ilegais
• assédio ou ameaças
• divulgação de informações pessoais de terceiros
• envio de spam
• uso de bots ou automações

Contas que violem essas regras poderão ser suspensas ou removidas.

--------------------------------------------------

6. CONTEÚDO GERADO PELOS USUÁRIOS

Os usuários são responsáveis por todo conteúdo enviado ou publicado na plataforma, incluindo:

• mensagens
• imagens
• áudios
• informações de perfil

A plataforma pode remover conteúdos que violem estes termos.

--------------------------------------------------

7. PAGAMENTOS E CRÉDITOS

Algumas funcionalidades podem exigir compra de créditos ou assinatura premium.

Os créditos:

• são utilizados apenas dentro da plataforma
• não possuem valor monetário fora dela
• não são reembolsáveis, salvo exigência legal

--------------------------------------------------

8. LIMITAÇÃO DE RESPONSABILIDADE

A plataforma não se responsabiliza por interações entre usuários, incluindo encontros presenciais ou conteúdos compartilhados entre usuários.

--------------------------------------------------

9. ALTERAÇÕES NOS TERMOS

Estes termos podem ser atualizados a qualquer momento.

O uso contínuo da plataforma após alterações representa aceitação das novas condições.
`;

const POLITICA_PRIVACIDADE = `
POLÍTICA DE PRIVACIDADE — DESEJO PROIBIDO
Versão 1.0

1. INTRODUÇÃO

Esta política explica como coletamos, utilizamos e protegemos os dados dos usuários da plataforma Desejo Proibido.

--------------------------------------------------

2. DADOS COLETADOS

Podemos coletar:

Informações fornecidas pelo usuário:

• nome ou apelido
• e-mail
• foto de perfil
• informações de perfil
• mensagens e interações

Informações coletadas automaticamente:

• endereço IP
• tipo de dispositivo
• navegador utilizado
• data e hora de acesso

--------------------------------------------------

3. USO DAS INFORMAÇÕES

Os dados podem ser utilizados para:

• funcionamento da plataforma
• melhoria dos serviços
• personalização da experiência
• segurança da plataforma
• prevenção de fraudes

--------------------------------------------------

4. COMPARTILHAMENTO DE DADOS

Os dados podem ser compartilhados com:

• serviços de hospedagem
• serviços de pagamento
• serviços de armazenamento de mídia
• autoridades legais quando exigido por lei

O Desejo Proibido não vende dados pessoais.

--------------------------------------------------

5. SEGURANÇA

Adotamos medidas técnicas e organizacionais para proteger os dados dos usuários contra acesso não autorizado, alteração ou destruição.

--------------------------------------------------

6. ARMAZENAMENTO DE DADOS

Os dados serão mantidos enquanto:

• a conta estiver ativa
• necessário para cumprir obrigações legais

--------------------------------------------------

7. DIREITOS DOS USUÁRIOS

Os usuários podem solicitar:

• acesso aos seus dados
• correção de informações
• exclusão da conta
• exclusão de dados pessoais

--------------------------------------------------

8. COOKIES

Utilizamos cookies para melhorar a navegação e personalizar a experiência do usuário.

--------------------------------------------------

9. ALTERAÇÕES NA POLÍTICA

Esta política pode ser atualizada periodicamente para refletir mudanças legais ou operacionais.
`;

async function main() {
    const jaTem = await prisma.termo.count({
        where: {
            ativo: true,
            tipo: { in: ["TERMOS_USO", "POLITICA_PRIVACIDADE"] },
        },
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
                conteudo: TERMOS_USO,
                ativo: true,
            },
            {
                tipo: "POLITICA_PRIVACIDADE",
                versao: "1.0",
                conteudo: POLITICA_PRIVACIDADE,
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