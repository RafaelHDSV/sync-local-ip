# Ambiente e operação

> **Para que serve:** como rodar, configurar e publicar sync-local-ip
> **Fonte da verdade:** `package.json`, `.env.example`, scripts de CI/deploy
> **Relacionados:** [context](context.md) · [seguranca](seguranca.md)

## Setup

# Configuração

> **Para que serve:** preencher e validar o `config.json`.
> **Fonte da verdade:** `loadConfig`, `resolveReposRoot` e `resolveScanRoots` em `sync-local-ip.mjs`.
> **Relacionados:** [README](../README.md), [rede-e-arquivos.md](rede-e-arquivos.md), [problemas-comuns.md](problemas-comuns.md).

A ferramenta lê **somente** o `config.json` na mesma pasta de `sync-local-ip.mjs`. Outro arquivo com o mesmo nome, em outra pasta, é ignorado. Modelo: `config.example.json`.

```powershell
copy config.example.json config.json
```

Salve em UTF-8.

## Campos

| Campo | Obrigatório | Função |
|-------|-------------|--------|
| `userKey` | sim | Identificador seu. Na AGX, a mesma chave em `ips/table.ts` e em `serveruler-client/public/data.json`. Sem `userKey` o sync não inicia. |
| `reposRoot` | recomendado | Pasta âncora. Absoluto, ou relativo **à pasta desta ferramenta**. |
| `scanRoots` | não | Pastas onde procurar `.env`, `.env.local` e `_localVars.ts`. Pode ser **qualquer** clone. `reposRoot` entra sempre na varredura, mesmo que você não o repita aqui. |

### Mínimo

```json
{
  "userKey": "seu-login",
  "reposRoot": "C:\\Users\\SEU_USUARIO\\Desktop\\repos"
}
```

### Vários discos / vários projetos

```json
{
  "userKey": "seu-login",
  "reposRoot": "C:\\Users\\SEU_USUARIO\\Desktop\\repos",
  "scanRoots": [
    "C:\\Users\\SEU_USUARIO\\Desktop\\repos",
    "D:\\work\\meu-app",
    "D:\\work\\outro-clone"
  ]
}
```
