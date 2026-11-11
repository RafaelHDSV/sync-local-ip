# Linha de comando

> **Para que serve:** flags do motor Node e do wrapper PowerShell.
> **Fonte da verdade:** `parseArgs` / `printHelp` em `sync-local-ip.mjs`, `sync-local-ip.ps1`.
> **Relacionados:** [configuracao.md](configuracao.md), [tag.md](tag.md).

Na pasta da ferramenta:

```powershell
node sync-local-ip.mjs --help
node sync-local-ip.mjs --check-only
node sync-local-ip.mjs --check-only --json
node sync-local-ip.mjs --dry-run
node sync-local-ip.mjs --dry-run --verbose
node sync-local-ip.mjs
node sync-local-ip.mjs --ip 10.10.0.66
node sync-local-ip.mjs --yes
```

Wrapper equivalente: `.\sync-local-ip.ps1 -DryRun`, `-CheckOnly`, `-Json`, `-Verbose`, `-Ip "10.10.0.66"`.

| Opção | Efeito |
|-------|--------|
| `--check-only` | Só compara. Não grava arquivos nem `.last-ip.json` |
| `--json` | Uma linha JSON no stdout (a tag lê assim). Erros de config também saem nesse JSON, com o IP já detectado |
| `--dry-run` | Mostra o que gravaria. Não grava |
| `--verbose` | Contagem de `.env` e `_localVars.ts` encontrados |
| `--ip` | Ignora `ipconfig`. Ainda precisa ser prefixo empresa ou casa |
| `--yes`, `-y` | Não pergunta no primeiro uso (veja abaixo) |

## Primeiro uso

Se a máquina nunca sincronizou (não há `.last-ip.json`), a troca nos `.env` precisa de aprovação, porque ela é textual e ampla ([rede-e-arquivos.md](rede-e-arquivos.md)):

| Como você roda | O que acontece |
|----------------|----------------|
| Terminal interativo, sem flags | Mostra o resumo do `--dry-run` e pergunta `Aplicar estas mudanças? [s/N]`. Só `s`, `sim`, `y` ou `yes` grava |
| Tag, ou qualquer execução com `--json` | **Não grava.** Devolve `needsFirstRun: true` e a tag mostra `1o uso` |
| Script ou pipe, sem terminal | Não grava e sai com código 1. Use `--yes` |
| `--yes` | Grava sem perguntar |
| `--dry-run` / `--check-only` | Como sempre. O `--check-only --json` traz `needsFirstRun` |

Depois da primeira gravação o `.last-ip.json` existe e tudo volta a ser automático. Para IPs que nunca devem ser trocados (servidor compartilhado, banco), veja `ignoreIps` em [configuracao.md](configuracao.md).

Exit code 1: nenhum IPv4 útil, prefixo fora dos perfis conhecidos, `config.json` ausente ou inválido, `reposRoot` inválido, ou primeiro uso sem terminal interativo e sem `--yes`.

`--check-only` pode sair 0 mesmo com drift (`match=false`).
