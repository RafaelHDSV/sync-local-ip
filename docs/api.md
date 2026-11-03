# API

> **Para que serve:** rotas HTTP, CLI I/O, códigos de erro e contratos
> **Fonte da verdade:** handlers / routers / entrypoints CLI
> **Relacionados:** [arquitetura](arquitetura.md) · [banco-de-dados](banco-de-dados.md) · [seguranca](seguranca.md)

## Convenções

- Prefixo / entrypoint: ver código (`/api`, `/v1`, binário CLI, etc.)
- Auth: ver [seguranca](seguranca.md)

## Superfície

sync-local-ip pode não expor HTTP. Contratos relevantes: CLI, arquivos de config ou webhooks descritos no README.

Requisitos: Windows 10/11 e [Node.js](https://nodejs.org/) 20+ no `PATH`.

```powershell
git clone https://github.com/RafaelHDSV/sync-local-ip.git
cd sync-local-ip
copy config.example.json config.json
```

Edite o `config.json`:

```json
{
  "userKey": "seu-login",
  "reposRoot": "C:\\caminho\\para\\seus\\clones",
  "scanRoots": [
    "C:\\caminho\\para\\seus\\clones",
    "D:\\outro\\projeto"
  ]
}
```

- `userKey` — identificador seu (a mesma chave em `ips/table.ts`, se você usar essa tabela).
- `reposRoot` — pasta âncora dos clones (detalhes em [configuração](docs/configuracao.md)).
- `scanRoots` — onde varrer `.env` e `_localVars.ts`. Pode listar **qualquer** repositório.

Ensaio sem gravar, depois sync de verdade:

```powershell
node sync-local-ip.mjs --dry-run
node sync-local-ip.mjs
```

Suba a tag (sem janela de terminal):

```powershell
wscript.exe .\sync-local-ip-startup.vbs
```

Para abrir no logon: `.\install-startup.ps1`. Remover: `.\uninstall-startup.ps1`.

Clique na tag = sincronizar agora. Verde = IP nos arquivos bate com a máquina. Vermelho = passe o mouse no tooltip.

| Método / comando | Caminho | Auth | Nota |
|---|---|---|---|
| | | | Preencher a partir do código |
