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
```

Wrapper equivalente: `.\sync-local-ip.ps1 -DryRun`, `-CheckOnly`, `-Json`, `-Verbose`, `-Ip "10.10.0.66"`.

| Opção | Efeito |
|-------|--------|
| `--check-only` | Só compara. Não grava arquivos nem `.last-ip.json` |
| `--json` | Uma linha JSON no stdout (a tag lê assim). Erros de config também saem nesse JSON, com o IP já detectado |
| `--dry-run` | Mostra o que gravaria. Não grava |
| `--verbose` | Contagem de `.env` e `_localVars.ts` encontrados |
| `--ip` | Ignora `ipconfig`. Ainda precisa ser prefixo empresa ou casa |

Exit code 1: nenhum IPv4 útil, prefixo fora dos perfis conhecidos, `config.json` ausente ou inválido, `reposRoot` inválido.

`--check-only` pode sair 0 mesmo com drift (`match=false`).
