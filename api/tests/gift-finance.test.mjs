import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { splitCreatorCredits } from '../src/utils/creatorFinance.js';

function response() { return { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } }; }
function fixture({ balance = 100, failMessage = false } = {}) {
  let state = { sender: balance, recipient: 0, fees: 0, ledger: [], gifts: 0, messages: 0 };
  const prisma = {
    presente: { findUnique: async () => ({ id: 'gift', ativo: true, custoCreditos: 100, nome: 'Teste' }) },
    conversa: { findUnique: async () => ({ match: { usuarioAId: 'sender', usuarioBId: 'recipient' } }) },
    $transaction: async (fn) => {
      const draft = structuredClone(state);
      const tx = {
        wallet: {
          updateMany: async ({ where, data }) => {
            if (draft.sender < where.saldoCreditos.gte) return { count: 0 };
            draft.sender -= data.saldoCreditos.decrement;
            return { count: 1 };
          },
          update: async ({ data }) => { draft.recipient += data.saldoCreditos.increment; },
          upsert: async () => {},
          findUnique: async () => ({ saldoCreditos: draft.sender }),
        },
        walletTx: { create: async ({ data }) => { draft.ledger.push(data); } },
        presenteEnviado: { create: async () => { draft.gifts++; return { id: 'sent-gift' }; } },
        platformRevenue: { create: async ({ data }) => { draft.fees += data.valorCreditos; } },
        giftCredito: { create: async () => {} },
        mensagem: { create: async () => { if (failMessage) throw Error('Falha simulada'); draft.messages++; } },
        conversa: { update: async () => {} },
      };
      const result = await fn(tx);
      state = draft;
      return result;
    },
  };
  const source = readFileSync(new URL('../src/controllers/presente.controller.js', import.meta.url), 'utf8').replace(/^import .*;\n/gm, '').replaceAll('export async function', 'async function');
  const context = vm.createContext({ prisma, splitCreatorCredits, ensureWallet: async () => {}, console: { error() {} }, Date, Number, String });
  vm.runInContext(source, context);
  return { send: context.enviarPresente, state: () => state };
}
const request = { usuario: { id: 'sender' }, body: { conversaId: 'chat', presenteId: 'gift' } };

test('presente debita o bruto, credita líquido e registra taxa com a mesma divisão das lives', async () => {
  const f = fixture(), res = response();
  await f.send(request, res);
  const split = splitCreatorCredits(100), state = f.state();
  assert.equal(res.code, 200);
  assert.equal(state.sender, 0);
  assert.equal(state.recipient, split.criadora);
  assert.equal(state.fees, split.plataforma);
  assert.equal(state.recipient + state.fees, 100);
  assert.equal(state.ledger.find((entry) => entry.tipo === 'CREDIT').refId, 'sent-gift');
  assert.equal(state.gifts, 1);
  assert.equal(state.messages, 1);
});
test('falha na mensagem desfaz débito, crédito e taxa', async () => {
  const f = fixture({ failMessage: true }), res = response();
  await f.send(request, res);
  assert.equal(res.code, 500);
  assert.equal(f.state().sender, 100);
  assert.equal(f.state().recipient, 0);
  assert.equal(f.state().fees, 0);
});
test('saldo insuficiente e remetente estranho não geram repasse', async () => {
  const f = fixture({ balance: 99 }), res = response();
  await f.send(request, res);
  assert.equal(res.code, 402);
  assert.equal(f.state().sender, 99);
  const forbidden = response();
  await f.send({ ...request, usuario: { id: 'stranger' } }, forbidden);
  assert.equal(forbidden.code, 403);
  assert.equal(f.state().recipient, 0);
});
