# Changelog

Todas as mudanças notáveis deste projeto serão documentadas neste arquivo.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/)
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Unreleased]

### Adicionado

- Living docs (hub `docs/context.md`), arquivos de comunidade e README no padrão board#7.
- Guia de primeiro uso para dev novo: [`docs/onboarding.md`](docs/onboarding.md).
- `config.json` com BOM passa a ser aceito. JSON inválido gera uma mensagem com as causas comuns e o caminho do guia.
- A ferramenta recusa rodar com o `userKey` ou os caminhos do `config.example.json` (`seu-login`, `SEU_USUARIO`).
- **Primeiro uso revisável:** numa máquina sem `.last-ip.json`, `node sync-local-ip.mjs` mostra o resumo do `--dry-run` e pergunta `[s/N]` antes de gravar. A tag e o `--json` não fazem a primeira gravação: devolvem `needsFirstRun: true` e a tag mostra `1o uso` em laranja. Novo flag `--yes` (`-y`) para automação.
- `ignoreIps` no `config.json`: lista de IPv4 que nunca são trocados nem contam como drift (servidor compartilhado, banco).
- `--check-only --json` e os demais payloads `--json` ganham o campo `needsFirstRun` (aditivo).

### Corrigido

- `ips/table.ts` volta a ser atualizado: a tabela real usa aspas simples e a ferramenta só lia aspas duplas. Agora aceita aspas simples, duplas e crase, preserva o estilo do arquivo e acha chaves entre aspas, com hífen (`'ana-b':`).
- A chave do `userKey` não casa mais dentro da linha de outra pessoa: com `userKey` igual a `ana`, a linha `joana` era alterada. Depois desta correção, o `git status` do repositório `ips` passa a mostrar a sua linha alterada após o sync.
- A troca de IP nos `.env` é pelo endereço **inteiro**. Antes, um IP antigo no histórico que fosse prefixo do novo corrompia o arquivo (`10.10.0.18` no histórico e rede nova `10.10.0.188` deixavam `10.10.0.1888`) e fazia a tag nunca ficar verde. A troca agora é em passada única, com fronteira: `10.10.0.5` não pega `10.10.0.55` nem `1192.168.0.5`, e o texto recém-trocado não é trocado de novo.

### Alterado

- **`config.json` deixa de ser versionado** e entra no `.gitignore`: ele trazia a chave de outra pessoa para quem clonava. `config.example.json` usa barras normais nos caminhos.
  **Migração (instalações antigas):** guarde o seu `config.json`, rode `git checkout -- config.json` e `git pull`, e devolva o arquivo. Passo a passo em [`docs/onboarding.md`](docs/onboarding.md#atualizando-uma-instalação-antiga).
