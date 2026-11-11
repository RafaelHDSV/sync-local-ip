# sync-local-ip — contexto do projeto

> Contexto primário para assistentes de IA (regra `ai-context.mdc`). Atualize este arquivo ao evoluir o produto.
>
> **Para que serve:** roteiro curto do que a ferramenta é e de qual doc ler antes de mexer em cada assunto.
> **Fonte da verdade:** `sync-local-ip.mjs`, `lib/detect-ip.mjs`, `lib/network-profile.mjs`, `sync-local-ip-tag.ps1`.
> **Relacionados:** [README.md](../README.md), [especificacao.md](especificacao.md), [DESIGN.md](DESIGN.md).

**Pacote:** `sync-local-ip` | **Ano:** 2026 | **Repositório:** https://github.com/RafaelHDSV/sync-local-ip

---

## Objetivo

No Windows, descobre o IPv4 útil da máquina e propaga esse IP nos arquivos locais. Nasceu no fluxo AGX (empresa `10.10.0.x` / casa `172.24.x`, `10.20.x` ou `192.168.x`, `ips/table.ts`, Serveruler), mas a varredura de `.env`, `.env.local` e `_localVars.ts` vale para **qualquer** pasta em `scanRoots`. Arquivos AGX só são tocados se existirem.

Pitch e quick start: [README](../README.md). Dev novo: [onboarding.md](onboarding.md). Detalhe operacional: docs listados abaixo. Este arquivo não repete o passo a passo.

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

1. Perfis empresa e casa não misturam campos. IP fora de `10.10.0`, `172.24`, `10.20` e `192.168` não sincroniza (prefixos atuais; nasceram na AGX). O histórico de IPs em `.last-ip.json` vale entre perfis.
2. `reposRoot` é a âncora (hoje exige um marcador `ips/` / `core/` / `serveruler-client/` / `uxvision-web/`). `scanRoots` amplia a busca de envs para qualquer clone.
3. Só entram na varredura `.env`, `.env.local` e `_localVars.ts`, com o nome comparado sem diferenciar maiúsculas (Windows).
4. A tag sincroniza ao abrir e de hora em hora se houver drift, mas **nunca faz a primeira gravação** de uma máquina (sem `.last-ip.json`): essa é aprovada no terminal. Duplo clique esconde até a meia-noite.
5. Sem `package.json` e sem telemetria. Estado local: `.last-ip.json`, `ui-state.json` e `config.json` (nenhum é versionado).
6. `config.json` aceita `ignoreIps` (IPv4 que a varredura nunca troca).

---

## Índice

| Documento | Quando ler |
|-----------|------------|
| [README.md](../README.md) | Pitch, o que faz, quick start |
| [onboarding.md](onboarding.md) | Instalar e configurar pela primeira vez (dev novo), passo a passo |
| [configuracao.md](configuracao.md) | `config.json`, caminhos, vários repos |
| [rede-e-arquivos.md](rede-e-arquivos.md) | Perfis, arquivos gravados, detecção de IP |
| [tag.md](tag.md) | Uso da faixa |
| [linha-de-comando.md](linha-de-comando.md) | Flags CLI |
| [problemas-comuns.md](problemas-comuns.md) | Troubleshooting |
| [especificacao.md](especificacao.md) | Contrato e limites |
| [DESIGN.md](DESIGN.md) | Visual da tag |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | Testes e PR |
| [ambiente-e-operacao.md](ambiente-e-operacao.md) | Como rodar, arquivos de estado, o que não existe (CI, deploy, variáveis de ambiente) |
| [arquitetura.md](arquitetura.md) | Ver documento |
| [api.md](api.md) | Ver documento |
| [banco-de-dados.md](banco-de-dados.md) | Ver documento |
| [regras-de-negocio.md](regras-de-negocio.md) | Ver documento |
| [frontend.md](frontend.md) | Ver documento |
| [seguranca.md](seguranca.md) | Ver documento |
| [historico-de-mudancas.md](historico-de-mudancas.md) | Ver documento |
| [fluxo-de-trabalho-ia.md](fluxo-de-trabalho-ia.md) | Ver documento |
| [CHANGELOG.md](../CHANGELOG.md) | Ver documento |

---

## Fora de escopo

- Linux, macOS e IPv6.
- Criar arquivos de destino que não existam.
- Subir processos de aplicação (Serveruler ou outros).
