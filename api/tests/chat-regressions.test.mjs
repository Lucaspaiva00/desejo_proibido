import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function controller(name, prisma) {
  const source = readFileSync(new URL(`../src/controllers/${name}.controller.js`, import.meta.url), 'utf8')
    .replace(/^import .*;\n/gm, '').replaceAll('export async function', 'async function');
  const context = vm.createContext({ prisma, Date, Set, Map, Math, Number, String, process: { env: {} } });
  vm.runInContext(source, context);
  return context;
}
function response() {
  return { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
}

test('leitura exige participação e atualiza somente mensagens recebidas da conversa', async () => {
  const rows = [
    { id: 'received', conversaId: 'chat', autorId: 'other', lidaEm: null },
    { id: 'mine', conversaId: 'chat', autorId: 'me', lidaEm: null },
    { id: 'foreign', conversaId: 'foreign-chat', autorId: 'other', lidaEm: null },
  ];
  const prisma = {
    conversa: { findUnique: async () => ({ match: { usuarioAId: 'me', usuarioBId: 'other' } }) },
    mensagem: { updateMany: async ({ where, data }) => {
      for (const row of rows) if (row.conversaId === where.conversaId && where.id.in.includes(row.id) && row.autorId !== where.autorId.not && row.lidaEm === null) row.lidaEm = data.lidaEm;
    } },
  };
  const { marcarMensagensLidas } = controller('conversa', prisma);
  const req = { usuario: { id: 'me' }, params: { id: 'chat' }, body: { ids: rows.map((r) => r.id) } };
  const res = response();
  await marcarMensagensLidas(req, res);
  assert.equal(res.code, 200);
  assert.ok(rows[0].lidaEm);
  assert.equal(rows[1].lidaEm, null);
  assert.equal(rows[2].lidaEm, null);
  const firstRead = rows[0].lidaEm;
  await marcarMensagensLidas(req, response());
  assert.equal(rows[0].lidaEm, firstRead);
  const forbidden = response();
  await marcarMensagensLidas({ ...req, usuario: { id: 'stranger' } }, forbidden);
  assert.equal(forbidden.code, 403);
});

test('leitura rejeita ids inválidos e conversa inexistente', async () => {
  const { marcarMensagensLidas } = controller('conversa', { conversa: { findUnique: async () => null } });
  for (const ids of [undefined, [''], [12], Array(201).fill('id')]) {
    const res = response();
    await marcarMensagensLidas({ usuario: { id: 'me' }, params: { id: 'chat' }, body: { ids } }, res);
    assert.equal(res.code, 400);
  }
  const res = response();
  await marcarMensagensLidas({ usuario: { id: 'me' }, params: { id: 'chat' }, body: { ids: ['message'] } }, res);
  assert.equal(res.code, 404);
});

test('curtidos limita a consulta ao dono, exclui bloqueios nos dois sentidos e não expõe email', async () => {
  const prisma = {
    bloqueio: { findMany: async () => [ { deUsuarioId: 'me', paraUsuarioId: 'blocked' }, { deUsuarioId: 'blocked-me', paraUsuarioId: 'me' } ] },
    curtida: { findMany: async (query) => {
      assert.equal(query.where.deUsuarioId, 'me');
      assert.equal(query.where.paraUsuario.ativo, true);
      assert.deepEqual(Array.from(query.where.paraUsuario.id.notIn), ['blocked', 'blocked-me']);
      assert.equal(query.select.paraUsuario.select.email, undefined);
      return [{ id: 'like', paraUsuario: { id: 'liked', perfil: { nome: 'Teste' } } }];
    } },
  };
  const { listarCurtidos } = controller('curtida', prisma);
  const res = response();
  await listarCurtidos({ usuario: { id: 'me' } }, res);
  assert.equal(res.body[0].outro.id, 'liked');
});

test('distância para busca por destino lida com 2 km e cruzamento de longitude', () => {
  const { distanciaKm } = controller('busca', {});
  assert.equal(distanciaKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 0 }), 0);
  assert.ok(distanciaKm({ latitude: 0, longitude: 0 }, { latitude: 0.01, longitude: 0 }) < 2);
  assert.ok(distanciaKm({ latitude: 0, longitude: 0 }, { latitude: 0.03, longitude: 0 }) > 2);
  assert.ok(distanciaKm({ latitude: 0, longitude: 179.99 }, { latitude: 0, longitude: -179.99 }) < 3);
});
