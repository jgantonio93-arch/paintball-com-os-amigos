// Personagens secretos: as fotos dos amigos vão CRIPTOGRAFADAS em jogo/amigos.secreto.js
// e só aparecem no jogo para quem digita o código secreto (a chave sai do código com PBKDF2).
//
// Fechar (gerar o arquivo a partir de uma pasta com amigos.json + fotos):
//   node jogo/tools/segredo.mjs fechar <pasta> <codigo>
// Abrir (tirar as fotos de volta para editar/adicionar alguém):
//   node jogo/tools/segredo.mjs abrir <pasta-de-saida> <codigo>
// amigos.json: [{ "nome": "Arthur", "foto": "amigo1.jpg", "camisa": 1776934, "cabelo": 3811870, "calca": 2237486, "velocidade": 1.15, "pele"?: 11565653 }, …]
// Mudou a lista? Aumente VERSAO no index.html (os índices do online mudam).
import fs from 'node:fs';
import path from 'node:path';
import { webcrypto as crypto } from 'node:crypto';

const ARQ = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'amigos.secreto.js');
const VOLTAS = 200000;
const [, , acao, pasta, codigo] = process.argv;
if (!['fechar', 'abrir'].includes(acao) || !pasta || !codigo) { console.log('uso: node jogo/tools/segredo.mjs fechar|abrir <pasta> <codigo>'); process.exit(1); }

async function chave(salt) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(codigo.trim()), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: VOLTAS, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
const b64 = b => Buffer.from(b).toString('base64');

if (acao === 'fechar') {
  const lista = JSON.parse(fs.readFileSync(path.join(pasta, 'amigos.json'), 'utf8'));
  for (const a of lista) a.foto = 'data:image/jpeg;base64,' + b64(fs.readFileSync(path.join(pasta, a.foto)));
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await chave(salt), new TextEncoder().encode(JSON.stringify(lista)));
  const dados = { v: 1, n: VOLTAS, salt: b64(salt), iv: b64(iv), ct: b64(ct) };
  fs.writeFileSync(ARQ, `// Personagens secretos (criptografados). Gerado por tools/segredo.mjs; não edite à mão.\nwindow.PB_SEGREDO = ${JSON.stringify(dados)};\n`);
  console.log(`${ARQ}: ${lista.length} personagens (${Math.round(fs.statSync(ARQ).size / 1024)} KB)`);
} else {
  const txt = fs.readFileSync(ARQ, 'utf8');
  const d = JSON.parse(txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1));
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: Buffer.from(d.iv, 'base64') }, await chave(Buffer.from(d.salt, 'base64')), Buffer.from(d.ct, 'base64'));
  const lista = JSON.parse(new TextDecoder().decode(pt));
  fs.mkdirSync(pasta, { recursive: true });
  lista.forEach((a, i) => { const nome = `amigo${i + 1}.jpg`; fs.writeFileSync(path.join(pasta, nome), Buffer.from(a.foto.split(',')[1], 'base64')); a.foto = nome; });
  fs.writeFileSync(path.join(pasta, 'amigos.json'), JSON.stringify(lista, null, 2));
  console.log(`${lista.length} personagens em ${pasta}`);
}
