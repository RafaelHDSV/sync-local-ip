# Contribuindo

Obrigado pelo interesse em contribuir com **sync-local-ip**.

- Pitch e quick start: [README](README.md)
- Contrato: [docs/especificacao.md](docs/especificacao.md)
- Visual da tag: [docs/DESIGN.md](docs/DESIGN.md)
- Índice para IA e humanos: [docs/context.md](docs/context.md)

Mudança de comportamento, config ou troubleshooting: atualize o doc dono no mesmo PR (não inche o README).

## Antes do pull request

```powershell
node --test
```

Não há `package.json`, lint nem build. Testes cobrem detecção de IP e perfis. Tag e logon: teste manual no Windows.

```powershell
node sync-local-ip.mjs --dry-run
```

Não inclua no PR: `config.json` com dados da sua máquina, `.last-ip.json`, `ui-state.json`, nem `.env` real.

## Fluxo

1. Abra uma issue.
2. Fork e branch: `git checkout -b feat/sua-feature`
3. Implemente no estilo do arquivo tocado.
4. Rode `node --test`.
5. PR com problema, solução e como testar. Docs no mesmo PR se o contrato ou o uso mudarem.

## Padrões

- Commit objetivo (porquê), pt ou en.
- Sem dependência npm nova sem combinar antes.
- Prefixo de rede novo: teste em `test/network-profile.test.mjs` + linha em [rede-e-arquivos.md](docs/rede-e-arquivos.md).
- Docs em pt-BR com acentos.

## Código de conduta

[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
