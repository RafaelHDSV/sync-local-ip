# sync-local-ip — especificação

> **Para que serve:** contrato do produto: problema, o que é gravado, decisões e limites.
> **Fonte da verdade:** `sync-local-ip.mjs`, `lib/network-profile.mjs`, `lib/detect-ip.mjs`, `sync-local-ip-tag.ps1`.
> **Relacionados:** [context.md](context.md), [README.md](../README.md), [rede-e-arquivos.md](rede-e-arquivos.md), [DESIGN.md](DESIGN.md).

**Ano:** 2026

Pitch e quick start: [README](../README.md). Configuração, tag, CLI e troubleshooting estão nos docs irmãos. Aqui fica o que o produto se compromete a fazer.

---

## Objetivo

Quem desenvolve em clones locais troca de rede (escritório, casa, VPN) e o IPv4 da máquina muda. Esse endereço aparece em `.env`, `_localVars.ts` e, em alguns times, em tabelas compartilhadas e redirects. Esquecer um arquivo deixa o app apontando para a máquina errada.

Esta ferramenta, no Windows, detecta o IPv4 útil, classifica o perfil e grava o lado correspondente. A interface do dia a dia é a tag. O público-alvo é qualquer pessoa no Windows cujos projetos embutam o IP local em arquivos de texto — com integração opcional ao layout AGX (`ips/table.ts`, Serveruler) quando esses arquivos existem.

---

## Stack

- **Motor:** Node.js 20+, ESM, sem dependências npm.
- **Interface:** tag WPF em PowerShell 5.1, sem console, lançada por VBS.
- **Persistência:** JSON local. Não há banco.
- **Testes:** `node --test`.

---

## Contrato de sincronização

Entrada: `ipconfig` ou `--ip`. Detecção: `lib/detect-ip.mjs`. Perfis: `lib/network-profile.mjs`.

| IP | Perfil | Campo opcional (tabela / data.json) | Constante opcional (redirect) |
|----|--------|-------------------------------------|-------------------------------|
| `10.10.0.x` | `company` | `empresa` | `COMPANY_IP_ADDRESS` |
| `172.24.x.x`, `10.20.x.x` ou `192.168.x.x` | `home` | `casa` | `HOME_IP_ADDRESS` |
| outro | nenhum | nada | nada |

Destinos:

- Sempre (pastas em `scanRoots` + `reposRoot`): substituição textual em `.env`, `.env.local`, `_localVars.ts`.
- Se existirem em `reposRoot`: `ips/table.ts`, `serveruler-client/public/data.json`, `serveruler-redirect/index.html`.
- Cópia irmã do redirect, se existir ao lado da ferramenta.

URL do redirect: `http://<ip>:5173/`. Ausente ou campo vazio → skip, não cria. Detalhe operacional: [rede-e-arquivos.md](rede-e-arquivos.md).

Estado em `.last-ip.json` só após sync real. A tag fica verde só sem drift no perfil atual.

---

## Setup

Sem `yarn` / `npm install` / build. Quick start no [README](../README.md). Detalhe: [configuracao.md](configuracao.md). Testes: [CONTRIBUTING.md](../CONTRIBUTING.md).

---

## Decisões registradas

| # | Tema | Decisão |
|---|------|---------|
| 1 | Onde roda | Somente Windows |
| 2 | Dependências | Nenhuma |
| 3 | Origem | Criado para AGX; varredura de envs em qualquer repo via `scanRoots` |
| 4 | Perfis | Empresa e casa não compartilham campo; prefixos atuais fixos no código |
| 5 | Prefixo `10.20` | Tratado como casa |
| 6 | Porta do redirect | 5173, fixa |
| 7 | Tag no logon | Atalho → VBS |
| 8 | `reposRoot` | Exige um marcador de pasta hoje; envs extras vão em `scanRoots` |
| 9 | Prefixo `192.168` | Tratado como casa (LAN doméstica). Fica fora da varredura por prefixo dos `.env`; só um `192.168` já gravado pela ferramenta é trocado |
| 10 | Histórico em `.last-ip.json` | Vale entre perfis: o IP gravado na outra rede é trocado ao mudar de rede |

---

## Fora de escopo

- IPv6; Linux; macOS.
- Criar linha em `ips/table.ts` quando não existe.
- Escolher variáveis pelo nome — a troca é do texto do IP.
- Operar processos de aplicação.
- Prefixos de rede configuráveis pelo JSON (ainda não).

---

## Relação com outros docs

| Arquivo | Uso |
|---------|-----|
| `README.md` | Pitch e quick start |
| `docs/configuracao.md` | `config.json` |
| `docs/rede-e-arquivos.md` | Perfis e arquivos |
| `docs/tag.md` / `linha-de-comando.md` / `problemas-comuns.md` | Uso diário |
| `docs/DESIGN.md` | Visual |
| Este arquivo | Contrato |
