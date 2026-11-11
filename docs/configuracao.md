# Configuração

> **Para que serve:** preencher e validar o `config.json`.
> **Fonte da verdade:** `loadConfig`, `resolveReposRoot` e `resolveScanRoots` em `sync-local-ip.mjs`.
> **Relacionados:** [README](../README.md), [rede-e-arquivos.md](rede-e-arquivos.md), [problemas-comuns.md](problemas-comuns.md).

A ferramenta lê **somente** o `config.json` na mesma pasta de `sync-local-ip.mjs`. Outro arquivo com o mesmo nome, em outra pasta, é ignorado. Modelo: `config.example.json`. O `config.json` é **só seu**: está no `.gitignore` e não vem no clone. A ferramenta recusa rodar sem ele, ou com os valores do exemplo (`userKey` igual a `seu-login`, caminho com `SEU_USUARIO`).

```powershell
copy config.example.json config.json
```

Salve em UTF-8 (com ou sem BOM). No JSON, barra invertida precisa de escape (`\\`); barra normal (`C:/Users/...`) funciona e evita o problema. Para um guia completo, veja [onboarding.md](onboarding.md).

## Campos

| Campo | Obrigatório | Função |
|-------|-------------|--------|
| `userKey` | sim | Identificador seu. Na AGX, a mesma chave em `ips/table.ts` e em `serveruler-client/public/data.json`. Sem `userKey` o sync não inicia. |
| `reposRoot` | recomendado | Pasta âncora. Absoluto, ou relativo **à pasta desta ferramenta**. |
| `ignoreIps` | não | Lista de IPv4 que **nunca** são trocados (servidor compartilhado, banco) e não contam como drift. Veja [abaixo](#ignoreips) |
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

## `ignoreIps`

A troca nos `.env` é textual: qualquer `10.10.0.x`, `172.24.x` ou `10.20.x` que não seja o seu IP atual é trocado. Se um `.env` aponta para um servidor ou banco compartilhado nessas faixas, liste o endereço aqui e ele fica como está:

```json
{
  "userKey": "seu-login",
  "reposRoot": "C:/Users/voce/Desktop/repos",
  "ignoreIps": ["10.10.0.5", "10.10.0.20"]
}
```

Só IPv4, como texto. Qualquer outra coisa (nome de host, lista que não é lista) é recusada com erro. O IP ignorado também não deixa a tag vermelha. Para descobrir quais IPs você tem nos `.env`, veja o passo 4.2 do [onboarding](onboarding.md).

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
vieira: {
  empresa: '10.10.0.47',
  casa: '172.24.0.12'
},
```

O `userKey` do JSON é exatamente a chave da linha (`vieira` no exemplo; `seu-login` é o valor do `config.example.json` e é recusado). A chave é comparada inteira (`ana` não casa dentro de `joana`) e pode vir entre aspas, com hífen (`'ana-b': {`). O IP pode estar entre aspas simples, duplas ou crase, e a ferramenta preserva o estilo que já estava no arquivo. Campo `casa` vazio: a ferramenta não atualiza `casa` na tabela nem no `data.json`; os `.env` do prefixo da rede atual ainda sincronizam.

Só a sua chave é alterada na tabela e no `data.json`. Se a chave ainda não existe e você precisa da tabela AGX, peça o cadastro no canal de IPs do time.

Fora da AGX, `userKey` continua obrigatório no JSON (o motor valida). Sem `ips/table.ts`, ele não encontra linha para atualizar e segue só com a varredura de envs.

## Arquivos locais desta pasta

| Arquivo | Versionar? | Conteúdo |
|---------|------------|----------|
| `config.example.json` | sim | Modelo |
| `config.json` | não (está no `.gitignore`) | `userKey`, `reposRoot`, `scanRoots` |
| `.last-ip.json` | não | Último IP, perfil, histórico |
| `ui-state.json` | não | Posição da tag / ocultar até |
