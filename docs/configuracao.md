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

Cada entrada de `scanRoots` pode ser um repositório qualquer. A varredura de envs não exige layout AGX.

## Caminhos

- Absoluto: `C:\\Users\\SEU_USUARIO\\Desktop\\repos` (barra invertida escapada no JSON).
- UNC: `\\\\servidor\\pasta`.
- Relativo: a partir da pasta de `sync-local-ip.mjs`. Exemplo: ferramenta em `repos\\.tools\\sync-local-ip` e `"../.."` apontando para `repos`.

Pasta inexistente em `scanRoots` é ignorada, sem erro. Um typo some da varredura em silêncio. O `--dry-run` imprime a lista que de fato entrou — confira essa linha.

## `reposRoot` e marcadores

Hoje o código trata `reposRoot` como válido se a pasta contiver pelo menos um destes diretórios: `ips/`, `core/`, `serveruler-client/` ou `uxvision-web/`.

Isso veio do monorepo AGX. Em workspace só com um app sem esses nomes:

1. Apontem `scanRoots` para o(s) clone(s) cujo `.env` deve mudar.
2. Usem como `reposRoot` uma pasta que tenha um dos marcadores (por exemplo a pasta AGX, se você tiver), **ou** mantenham um desses diretórios na âncora.

Arquivos AGX (`ips/table.ts`, redirect, `data.json`) são opcionais: se não existirem, o sync pula com `skip` e segue nos envs.

## Se omitir `reposRoot`

A ferramenta tenta, nesta ordem, a primeira pasta com um marcador:

1. `../..` e `..` a partir da pasta da ferramenta
2. `%USERPROFILE%\Desktop\repos`
3. `%USERPROFILE%\repos`
4. `%USERPROFILE%\dev`

Se nenhuma servir, o sync falha e pede `reposRoot` explícito. Em máquina fora desses caminhos, escreva o caminho. Não dependa da detecção.

## `userKey` (layout AGX)

Em `ips/table.ts`:

```ts
"seu-login": { empresa: "10.10.0.47", casa: "172.24.0.12" },
```

O `userKey` do JSON é exatamente `seu-login`. Campo `casa` vazio: a ferramenta não atualiza `casa` na tabela nem no `data.json`; os `.env` do prefixo da rede atual ainda sincronizam.

Só a sua chave é alterada na tabela e no `data.json`. Se a chave ainda não existe e você precisa da tabela AGX, peça o cadastro no canal de IPs do time.

Fora da AGX, `userKey` continua obrigatório no JSON (o motor valida). Sem `ips/table.ts`, ele não encontra linha para atualizar e segue só com a varredura de envs.

## Arquivos locais desta pasta

| Arquivo | Versionar? | Conteúdo |
|---------|------------|----------|
| `config.example.json` | sim | Modelo |
| `config.json` | não no PR com dados da sua máquina | `userKey`, `reposRoot`, `scanRoots` |
| `.last-ip.json` | não | Último IP, perfil, histórico |
| `ui-state.json` | não | Posição da tag / ocultar até |
