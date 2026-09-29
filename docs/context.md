# sync-local-ip — contexto do projeto

> Contexto primário para assistentes de IA (regra `ai-context.mdc`). Atualize este arquivo ao evoluir o produto.
>
> **Para que serve:** roteiro curto do que a ferramenta é e de qual doc ler antes de mexer em cada assunto.
> **Fonte da verdade:** `sync-local-ip.mjs`, `lib/detect-ip.mjs`, `lib/network-profile.mjs`, `sync-local-ip-tag.ps1`.
> **Relacionados:** [README.md](../README.md), [especificacao.md](especificacao.md), [DESIGN.md](DESIGN.md).

**Pacote:** `sync-local-ip` | **Ano:** 2026 | **Repositório:** https://github.com/RafaelHDSV/sync-local-ip

---

## Objetivo

No Windows, descobre o IPv4 útil da máquina e propaga esse IP nos arquivos locais. Nasceu no fluxo AGX (empresa `10.10.0.x` / casa `172.24.x` ou `10.20.x`, `ips/table.ts`, Serveruler), mas a varredura de `.env`, `.env.local` e `_localVars.ts` vale para **qualquer** pasta em `scanRoots`. Arquivos AGX só são tocados se existirem.

Pitch e quick start: [README](../README.md). Detalhe operacional: docs listados abaixo. Este arquivo não repete o passo a passo.

---

## Stack

| Camada | Tecnologia |
|--------|------------|
| Motor | Node.js 20+ sem dependências (`sync-local-ip.mjs`, ESM) |
| Tag | PowerShell 5.1, WPF, lançada por `sync-local-ip-startup.vbs` sem console |
| Config | `config.json` ao lado do script (`config.example.json` é o modelo) |
| Testes | `node --test` em `test/` |
| Banco, front web, Docker | não há |

---

## Portas e URLs

| Item | Valor |
|------|--------|
| Redirect Serveruler (se o HTML existir) | `http://<ip-detectado>:5173/` |
| Servidor HTTP desta ferramenta | não há |

---

## Decisões fixas

1. Perfis empresa e casa não misturam campos. IP fora de `10.10.0`, `172.24` e `10.20` não sincroniza (prefixos atuais; nasceram na AGX).
2. `reposRoot` é a âncora (hoje exige um marcador `ips/` / `core/` / `serveruler-client/` / `uxvision-web/`). `scanRoots` amplia a busca de envs para qualquer clone.
3. Só entram na varredura `.env`, `.env.local` e `_localVars.ts`.
4. A tag sincroniza ao abrir e de hora em hora se houver drift. Duplo clique esconde até a meia-noite.
5. Sem `package.json` e sem telemetria. Estado local: `.last-ip.json` e `ui-state.json` (não versionar).

---

## Índice

| Documento | Quando ler |
|-----------|------------|
| [README.md](../README.md) | Pitch, o que faz, quick start |
| [configuracao.md](configuracao.md) | `config.json`, caminhos, vários repos |
| [rede-e-arquivos.md](rede-e-arquivos.md) | Perfis, arquivos gravados, detecção de IP |
| [tag.md](tag.md) | Uso da faixa |
| [linha-de-comando.md](linha-de-comando.md) | Flags CLI |
| [problemas-comuns.md](problemas-comuns.md) | Troubleshooting |
| [especificacao.md](especificacao.md) | Contrato e limites |
| [DESIGN.md](DESIGN.md) | Visual da tag |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | Testes e PR |

---

## Fora de escopo

- Linux, macOS e IPv6.
- Criar arquivos de destino que não existam.
- Subir processos de aplicação (Serveruler ou outros).
