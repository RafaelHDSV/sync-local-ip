# Ambiente e operação

> **Para que serve:** como rodar a ferramenta no dia a dia e quais arquivos locais ela mantém.
> **Fonte da verdade:** `sync-local-ip.mjs`, `sync-local-ip.ps1`, `sync-local-ip-tag.ps1`, `install-startup.ps1`.
> **Relacionados:** [onboarding.md](onboarding.md), [configuracao.md](configuracao.md), [linha-de-comando.md](linha-de-comando.md), [seguranca.md](seguranca.md).

## Setup

Primeira instalação, passo a passo: [onboarding.md](onboarding.md). Campos do `config.json`: [configuracao.md](configuracao.md).

Requisitos: Windows, Node.js 20+ no PATH do Windows (a tag roda fora do terminal) e PowerShell 5.1. Não há `npm install`, build, Docker, CI nem deploy.

## Rodar

| Quero | Comando |
|-------|---------|
| Ver o que mudaria, sem gravar | `node sync-local-ip.mjs --dry-run` |
| Comparar sem gravar | `node sync-local-ip.mjs --check-only` |
| Sincronizar | `node sync-local-ip.mjs` (no primeiro uso da máquina mostra o resumo e pergunta; `--yes` não pergunta) |
| Abrir a tag | `wscript.exe .\sync-local-ip-startup.vbs` |
| Subir a tag no logon | `powershell -NoProfile -ExecutionPolicy Bypass -File .\install-startup.ps1` |
| Remover do logon | `powershell -NoProfile -ExecutionPolicy Bypass -File .\uninstall-startup.ps1` |

O Windows vem com a execução de scripts `.ps1` bloqueada (`Restricted`): por isso o `-ExecutionPolicy Bypass` nos scripts de instalação. O VBS já passa essa opção ao abrir a tag. Todas as flags: [linha-de-comando.md](linha-de-comando.md).

## Variáveis de ambiente

Nenhuma. A configuração está no `config.json` ao lado do script.

## Arquivos locais desta pasta

| Arquivo | Versionar? | Conteúdo |
|---------|------------|----------|
| `config.json` | não (está no `.gitignore`; copie de `config.example.json`) | `userKey`, `reposRoot`, `scanRoots` |
| `.last-ip.json` | não | Último IP, perfil e histórico, gravado após sync real |
| `ui-state.json` | não | Posição da tag e "ocultar até" |

## Testes

`node --test` na raiz. Cobre detecção de IP, perfis e a troca nos `.env`. Tag e logon são teste manual no Windows ([CONTRIBUTING.md](../CONTRIBUTING.md)).
