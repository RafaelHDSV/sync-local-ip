# sync-local-ip

Detecta o IPv4 util da maquina (Ethernet/Wi-Fi), identifica se voce esta na **rede empresa**
(`10.10.0.x`) ou **rede casa** (`172.24.x.x`, ou `10.20.x.x`) e propaga o IP certo em
`.env`, `_localVars.ts`, `ips/table.ts` e Serveruler.

Inclui **mini tag** no desktop (estilo workday) e entrada no **Startup** via VBS — sem janela
de terminal.

## Primeiro uso

1. Copie a pasta `sync-local-ip` para onde quiser (nao precisa ficar dentro dos clones).
2. Crie `config.json` a partir de `config.example.json`.
3. Preencha `userKey` (mesma chave em `ips/table.ts`).
4. Defina `reposRoot` apontando para a pasta que contem `ips/`, `core/` ou `serveruler-client/`.
5. Se tiver clones em mais de um disco, liste todos em `scanRoots` (veja abaixo).
6. Duplo clique em `sync-local-ip-startup.vbs` para subir a tag, ou rode `install-startup.ps1`
   uma vez para abrir no logon.

## config.json

### Minimo

```json
{
  "userKey": "seu-login",
  "reposRoot": "C:\\Users\\voce\\Desktop\\repos"
}
```

### Com varios lugares de clone

```json
{
  "userKey": "seu-login",
  "reposRoot": "C:\\Users\\voce\\Desktop\\repos",
  "scanRoots": [
    "C:\\Users\\voce\\Desktop\\repos",
    "D:\\work\\agx"
  ]
}
```

| Campo | Obrigatorio | Descricao |
|-------|-------------|-----------|
| `userKey` | sim | Chave em `ips/table.ts` e em `serveruler-client/public/data.json` |
| `reposRoot` | recomendado | Pasta **canonica** dos clones AGX (`ips/`, redirect, Serveruler). Caminho absoluto ou relativo **a pasta desta ferramenta** |
| `scanRoots` | nao | Pastas onde varrer `.env`, `.env.local` e `_localVars.ts`. Se omitido, usa so `reposRoot`. **`reposRoot` e sempre incluido** — nao precisa repetir na lista |

### Caminhos

- **Absoluto:** `C:\\Users\\voce\\Desktop\\repos` (barra dupla no JSON).
- **Relativo:** em relacao a pasta onde esta `sync-local-ip.mjs` (ex.: `"../.."` se a tool ainda
  estiver em `.tools/sync-local-ip` dentro dos repos).

### Deteccao automatica de `reposRoot`

Se `reposRoot` nao estiver no JSON, a ferramenta tenta, nesta ordem:

1. `../..` e `..` a partir da pasta da tool  
2. `%USERPROFILE%\\Desktop\\repos`  
3. `%USERPROFILE%\\repos`  
4. `%USERPROFILE%\\dev`  

Se nenhuma pasta tiver `ips/`, `core/`, `serveruler-client/` ou `uxvision-web/`, o sync falha
com mensagem pedindo `reposRoot` explicito.

Porta Serveruler = **5173** (fixa). Historico de IPs anteriores = `.last-ip.json` (automatico,
inclui perfil `company` ou `home`).

## Rede empresa vs casa

O sync **nao** grava IP de casa em `empresa` (nem o contrario). O perfil vem do IP que o
`ipconfig` detectou:

| IP detectado | Perfil | `ips/table.ts` | Redirect Serveruler | `.env` / `_localVars.ts` |
|--------------|--------|----------------|---------------------|---------------------------|
| `10.10.0.x` | empresa | atualiza `empresa` | `COMPANY_IP_ADDRESS` | troca `10.10.0.x` stale e o `casa` cadastrado na tabela |
| `172.24.x.x` ou `10.20.x.x` | casa | atualiza `casa` | `HOME_IP_ADDRESS` | troca `172.24.x` / `10.20.x` stale e o `empresa` cadastrado na tabela |

Assim funciona no escritorio **e** em casa (ZeroTier home), desde que o `userKey` tenha
`casa` preenchido em `ips/table.ts` (vazio = pula `casa` / `data.json`, mas envs ainda
sincronizam pelo prefixo).

IPs fora desses prefixos (ex.: Wi-Fi de hotel `192.168.x`) **nao** sincronizam — a tag
fica vermelha ate voltar a uma rede AGX.

## Como executar (VBS)

| Acao | Como |
|------|------|
| Subir a tag agora | Duplo clique em `sync-local-ip-startup.vbs` |
| Tag no logon do Windows | `install-startup.ps1` (cria atalho no Startup apontando para o VBS) |
| Remover do logon | `uninstall-startup.ps1` |

O VBS sobe a tag em segundo plano (PowerShell oculto). **Sync manual:** clique na tag.
**Sync automatico:** a cada 1 h se o IP detectado divergir do cadastrado.

## Mini tag

Overlay sempre visivel: IP detectado + `✓` (verde) ou `✗` (vermelho).

| Acao | Efeito |
|------|--------|
| Clique (sem arrastar) | Sync forcado |
| Arrastar | Move; salva posicao em `ui-state.json` |
| Duplo clique | Oculta ate o dia seguinte |
| Clique direito | Sincronizar agora / Abrir pasta / Sair |
| Poll | A cada **1 hora**; se divergir, auto-sync |

Posicao padrao: a **esquerda** do workday.

A tag so fica verde quando o IP em `.last-ip.json` bate com o detectado **e** nao ha drift
(envs, tabela, redirect, etc.).

## O que e atualizado

### Varredura (`scanRoots`)

Recursivo em cada raiz (ignora `node_modules`, `.git`, `dist`, etc.):

| Arquivo | Mudanca |
|---------|---------|
| `.env`, `.env.local` | Substitui IPs stale **do perfil atual** e o IP da outra rede (cadastro em `ips/table.ts`) |
| `_localVars.ts` | Idem |

### So em `reposRoot` (conforme perfil)

| Arquivo | Empresa (`10.10.0.x`) | Casa (`172.24.x` / `10.20.x`) |
|---------|-------------------------|--------------------------------|
| `ips/table.ts` | `empresa` | `casa` |
| `serveruler-client/public/data.json` | `empresa` | `casa` |
| `serveruler-redirect/index.html` | `COMPANY_IP_ADDRESS` | `HOME_IP_ADDRESS` |
| `.tools/serveruler-redirect/index.html` | idem | idem |

## Requisitos

- Windows 10/11 (`ipconfig` + tag WPF)
- Pasta dos clones acessivel via `reposRoot` (ou deteccao automatica)
- Node.js no PATH (a tag invoca por baixo dos panos; nao e necessario rodar comandos manualmente)

## Problemas comuns

| Sintoma | Causa provavel | Acao |
|---------|----------------|------|
| Tag `erro (passe o mouse)` ou IP em vermelho com tooltip | `config.json` ausente, `reposRoot` invalido ou Node fora do PATH | Leia o tooltip; corrija `config.json` (o example tem caminho placeholder) |
| Tag verde mas `.env` antigo | Estado ok, arquivos fora de `scanRoots` | Inclua a pasta do clone em `scanRoots`; clique na tag |
| Erro `reposRoot nao encontrado` | Tool longe dos repos e sem config | `reposRoot` absoluto no `config.json` |
| `.env` em outro disco nao muda | So `reposRoot` varrido | Adicione o disco em `scanRoots` |
| `userKey` nao encontrado | Login errado no config | Mesma chave que em `ips/table.ts` |
| IP detectado errado | Wi-Fi stale + Ethernet novo | Prioriza gateway `10.10.0.1` ou `172.24.0.1` |
| Em casa nao atualiza tabela | `casa` vazio em `ips/table.ts` | Pedir cadastro em #ips no Discord |
| Tag vermelha fora da AGX | IP nao e 10.10.0 / 172.24 / 10.20 | Normal em outra rede; sync ao conectar ZeroTier |

## Arquivos locais

| Arquivo | Versionar? | Uso |
|---------|------------|-----|
| `config.json` | opcional (use o example como modelo) | `userKey`, `reposRoot`, `scanRoots` |
| `.last-ip.json` | nao | IP atual + historico |
| `ui-state.json` | nao | Posicao da tag / ocultar ate |
