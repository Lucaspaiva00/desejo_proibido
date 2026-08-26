# Deploy automático — Desejo Proibido

O workflow `.github/workflows/deploy-vps.yml` atualiza a VPS automaticamente após cada `git push origin main`.

## Secrets necessários no GitHub

Em **Settings → Secrets and variables → Actions → New repository secret**, cadastrar:

- `VPS_HOST`: IP ou host da VPS.
- `VPS_USER`: usuário SSH usado no PowerShell/SSH.
- `VPS_SSH_KEY`: chave privada SSH que tenha acesso à VPS.
- `VPS_APP_PATH`: caminho completo do repositório na VPS, por exemplo `/var/www/desejo_proibido`.
- `PM2_APP_NAME`: nome exato mostrado em `pm2 status` para a API.

Além dos secrets, crie em **Settings → Secrets and variables → Actions → Variables**:

- `VPS_DEPLOY_ENABLED` = `true`

Enquanto essa variável não existir/for diferente de `true`, o job fica pulado em vez de falhar. Assim o primeiro commit deste pacote pode ser enviado antes da configuração SSH.

## Primeiro deploy deste pacote

Este pacote adiciona campos/tabelas no Prisma. O projeto atual não possui diretório de migrations versionadas, então o fluxo usa `prisma db push` **sem** `--accept-data-loss`. Alterações destrutivas serão bloqueadas pelo Prisma em vez de apagarem dados.

Antes do primeiro `db push` em produção, faça backup do PostgreSQL com a ferramenta/procedimento já usado na VPS.

## Variáveis de ambiente novas (API)

Todas têm defaults, mas podem ser definidas no `.env` da VPS:

```env
LIVE_PLATFORM_FEE_PERCENT=30
CREATOR_CREDITO_VALOR_CENTAVOS=1
CREATOR_MIN_SAQUE_CREDITOS=5000
CREATOR_MAX_SAQUE_CREDITOS=10000000
LIVE_MAX_META_CREDITOS=100000000
```

- `LIVE_PLATFORM_FEE_PERCENT`: percentual retido pela plataforma nos ganhos de live.
- `CREATOR_CREDITO_VALOR_CENTAVOS`: conversão usada para o valor estimado/saque.
- `CREATOR_MIN_SAQUE_CREDITOS`: mínimo de créditos para solicitar saque.
- `CREATOR_MAX_SAQUE_CREDITOS`: teto por solicitação.
- `LIVE_MAX_META_CREDITOS`: maior meta permitida em uma live.

## Segurança

Não coloque senha, token, chave PIX ou chave SSH dentro do repositório. Chaves de deploy ficam somente em GitHub Secrets e credenciais de produção ficam no `.env` da VPS.

## Compatibilidade com criadoras que já faziam live

Depois do primeiro `prisma db push`, rode uma única vez:

```bash
cd "$VPS_APP_PATH/api"
node scripts/backfill-existing-creators.js
```

O script aprova somente contas femininas, 18+, que já possuíam histórico de live antes do novo fluxo de aprovação. Ele não aprova automaticamente novas contas.
