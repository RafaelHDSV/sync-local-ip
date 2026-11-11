# Onboarding — instalar o sync-local-ip pela primeira vez

> **Para que serve:** passo a passo para um dev novo colocar a ferramenta para funcionar no Windows, do clone até a faixa verde no logon.
> **Fonte da verdade:** `sync-local-ip.mjs`, `sync-local-ip-tag.ps1`, `install-startup.ps1`. Passos validados em 11/11/2026.
> **Relacionados:** [configuracao.md](configuracao.md), [tag.md](tag.md), [problemas-comuns.md](problemas-comuns.md), [rede-e-arquivos.md](rede-e-arquivos.md).

Tempo: cerca de 15 minutos. Ao final você terá:

- os `.env` dos seus clones sempre com o seu IP atual, nas redes da empresa e de casa;
- uma faixa no canto da tela: **verde** (alinhado) ou **vermelha** (algo divergiu);
- tudo isso subindo sozinho quando você entra no Windows.

Os blocos de código são para o **PowerShell**. Use a **mesma janela** do começo ao fim (as variáveis `$login` e `$repos` são reaproveitadas), siga na ordem e só avance quando o passo disser "Você deve ver".

---

## Antes de tudo: 3 coisas que pegam todo mundo

1. **O `config.json` é só seu.** Ele não vem no clone (está no `.gitignore`) e a ferramenta recusa rodar sem ele, ou com os valores do exemplo (`seu-login`, `SEU_USUARIO`). O passo 3 cria o seu.
2. **A troca nos `.env` é textual: qualquer IP `10.10.0.x`, `172.24.x` ou `10.20.x` que não seja o seu é trocado**, inclusive o de um servidor compartilhado ou de um banco. Por isso a primeira gravação é sua: o terminal mostra o que vai mudar e pergunta antes. Se aparecer um IP que não é seu, responda `n` e use `ignoreIps` (passo 4.2).
3. **A faixa não faz o primeiro sync.** Até você aprovar no terminal (passo 5), ela mostra `1o uso` em laranja e não grava nada.

---

## Pré-requisitos

| Precisa de | Como conferir | Se faltar |
|------------|---------------|-----------|
| Windows 10 ou 11 | — | Linux e macOS não são suportados |
| Node.js 20 ou mais novo | `node -v` | Instale o Node LTS e **abra um terminal novo** |
| Git | `git --version` | Instale o Git for Windows |
| Seus repositórios clonados, com o **`ips`** entre eles | `Test-Path <pasta-dos-clones>\ips` | Clone o `AGX-Software/ips` ao lado dos outros |
| Estar na rede da empresa (ou o ZeroTier de casa ligado) | `ipconfig` mostra `10.10.0.x` ou `172.24.x.x` | Sem isso a ferramenta não tem o que sincronizar |

**Atenção ao Node:** a faixa roda fora do terminal, então o `node` precisa estar no PATH do Windows, não só no seu shell. Se você usa `fnm` ou `volta`, confira:

```powershell
cmd /c "node -v"
```

Você deve ver a versão (`v20…` ou maior). Se der "não reconhecido", instale o Node de forma global (instalador oficial ou `nvm-windows`) antes de seguir, senão a faixa mostra `erro (passe o mouse)` no logon.

---

## Passo 1 — Clonar

Recomendado: dentro de `.tools`, ao lado dos seus clones. Assim a ferramenta acha sozinha a pasta dos repositórios e atualiza o `serveruler-redirect` irmão.

```powershell
cd $HOME\Desktop\repos          # a pasta onde ficam os seus clones
mkdir .tools -Force | Out-Null
cd .tools
git clone https://github.com/RafaelHDSV/sync-local-ip.git
cd sync-local-ip
```

Você deve ver: a pasta `sync-local-ip` com `sync-local-ip.mjs`, `lib\` e `docs\`. Não há `npm install` nem build.

---

## Passo 2 — Descobrir a sua chave (`userKey`)

A chave é o seu nome na tabela `ips/table.ts`, como `vieira` ou `zarco`. Veja se você já está lá:

```powershell
$login = 'SEU_LOGIN'            # a chave exata, em minúsculas
Select-String -Path ..\..\ips\table.ts -Pattern "^\s*['""]?$login['""]?\s*:"
```

- **Apareceu uma linha:** ótimo, siga para o passo 3.
- **Não apareceu nada:** você ainda não está na tabela. Peça o cadastro no canal de IPs do time, ou abra um PR no repositório `ips` com a sua linha (`empresa` e, se tiver, `casa`). A ferramenta não cria a linha sozinha.

A chave pode ter hífen e vir entre aspas (`'ana-b': {`). Ela é comparada inteira: `ana` não pega a linha da `joana`.

---

## Passo 3 — Criar o seu `config.json`

Se você copiar o caminho do Explorer para dentro do JSON, a barra invertida precisa de escape (`\\`), senão o arquivo quebra. Gere o arquivo pelo PowerShell, que já sai correto:

```powershell
$login = 'SEU_LOGIN'                       # o mesmo do passo 2
$repos = (Resolve-Path ..\..).Path         # se clonou em outro lugar: 'C:\caminho\dos\seus\clones'

if (-not (Test-Path "$repos\ips")) { throw "Não achei a pasta ips em $repos. Clone o repositório ips ali." }

$cfg  = [ordered]@{ userKey = $login; reposRoot = $repos.Replace('\', '/') }
$utf8 = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Join-Path $PWD 'config.json'), ($cfg | ConvertTo-Json), $utf8)
Get-Content config.json
```

Você deve ver:

```json
{
    "userKey":  "seu-login",
    "reposRoot":  "C:/Users/voce/Desktop/repos"
}
```

Duas notas:

- Barras normais (`C:/…`) funcionam e evitam o problema de escape. Se for editar à mão, use `\\` ou `/`.
- O `config.json` está no `.gitignore`: ele é só seu e não aparece no `git status`.
- Já tinha a ferramenta instalada de antes? Veja "Atualizando uma instalação antiga" no fim deste guia.

Para varrer outras pastas além da âncora (outro disco, outro projeto), veja `scanRoots` em [configuracao.md](configuracao.md).

---

## Passo 4 — Testar sem gravar nada

**4.1 — A ferramenta enxerga a sua rede?**

```powershell
node sync-local-ip.mjs --check-only
```

Você deve ver algo como:

```
detectado=10.10.0.155 perfil=company cadastrado=(nenhum) match=false adapter=Ethernet
```

`match=false` e `cadastrado=(nenhum)` são normais na primeira vez. O que importa é `detectado=` ser o **seu** IP e o perfil fazer sentido (`company` = `10.10.0.x`, `home` = `172.24` / `10.20` / `192.168`).

**4.2 — Quais IPs existem hoje nos seus `.env`?**

```powershell
Get-ChildItem -Path $repos -Recurse -Force -Include .env,.env.local -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -notmatch 'node_modules' } |
  Select-String -Pattern '10\.10\.0\.\d+|172\.24\.\d+\.\d+|10\.20\.\d+\.\d+' |
  ForEach-Object { '{0}\{1}:{2}  {3}' -f (Split-Path (Split-Path $_.Path) -Leaf), (Split-Path $_.Path -Leaf), $_.LineNumber, $_.Line.Trim() }
```

Leia linha a linha. Cada IP que aparece aqui será trocado pelo seu. Pergunte-se: **esse número é a minha máquina?**

- É o meu IP antigo, ou um IP que eu coloquei para apontar para mim: pode trocar.
- É um servidor compartilhado, um banco ou a máquina de outro dev: **não pode ser trocado**. Coloque o endereço em `ignoreIps` no `config.json` e ele nunca é tocado:

  ```json
  "ignoreIps": ["10.10.0.5", "10.10.0.20"]
  ```

  Se o problema for uma pasta inteira que não deve seguir o seu IP, deixe-a fora de `scanRoots`. Mais em [configuracao.md](configuracao.md#ignoreips).

Não cole a saída em chat ou issue: linhas de `.env` podem ter usuário e senha na URL.

**4.3 — Simular o sync completo:**

```powershell
node sync-local-ip.mjs --dry-run
```

Confira as três primeiras linhas:

```
IP detectado: 10.10.0.155 (Ethernet, rede empresa)
reposRoot (ips/Serveruler): C:\Users\voce\Desktop\repos
scanRoots (.env / _localVars): C:\Users\voce\Desktop\repos
```

Se o IP, o `reposRoot` e o `scanRoots` estão certos, o resto é consequência. Depois vem a lista `Substituindo: … -> …` e os arquivos marcados `[dry-run]`. Nada foi gravado.

---

## Passo 5 — Primeiro sync de verdade

Só depois de o passo 4 estar limpo. Como é o primeiro uso desta máquina, a ferramenta repete o resumo do passo 4.3 e **pergunta antes de gravar**:

```powershell
node sync-local-ip.mjs
```

Você deve ver o resumo (`Substituindo: … -> …`, os arquivos marcados `[dry-run]`) e, no fim:

```
Aplicar estas mudanças? [s/N]
```

Responda `n` (ou Enter) para desistir: nada é gravado, e você pode ajustar `ignoreIps` ou `scanRoots` e rodar de novo. Responda `s` para gravar. Depois confira:

```powershell
node sync-local-ip.mjs --check-only
```

Você deve ver **`match=true`**. Abra um dos seus `.env` e confira que o IP é o seu.

Em script, sem terminal interativo, a pergunta não existe: a ferramenta recusa e sai com erro, a menos que você use `--yes`.

A ferramenta também atualiza a **sua** linha em `ips/table.ts`. Esse arquivo é do repositório `ips`: no `git status` dele vai aparecer a mudança. Leve-a por PR no `ips` para o time ver o seu IP novo.

---

## Passo 6 — Abrir a faixa

```powershell
wscript.exe .\sync-local-ip-startup.vbs
```

Uma faixa pequena aparece no canto inferior direito, à esquerda do widget do workday:

| Cor | Significa |
|-----|-----------|
| Amarela, `IP ...` | Sincronizando |
| Laranja, `10.10.0.155  1o uso` | Primeiro uso: nada foi gravado. Faça o passo 5 no terminal |
| Verde, `10.10.0.155 ✓` | Tudo alinhado |
| Vermelha, `✗` | Há divergência ou erro. Passe o mouse para ler o motivo |
| Cinza, `erro (passe o mouse)` ou `sem IP` | Node fora do PATH, config inválida ou sem rede utilizável |

Uso diário: clique na faixa para sincronizar agora, arraste para mudar de lugar, clique direito para o menu. Duplo clique esconde até a meia-noite. Mais em [tag.md](tag.md).

Abra **uma** vez só. Duas aberturas viram duas faixas.

---

## Passo 7 — Subir sozinha no logon

No Windows, o PowerShell vem com a execução de scripts bloqueada (política `Restricted`). Rodar `.\install-startup.ps1` direto falha com "a execução de scripts foi desabilitada neste sistema". Passe a política só para esse comando:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\install-startup.ps1
```

Você deve ver `Installed Startup shortcut: …sync-local-ip-startup.vbs.lnk`. Saia e entre no Windows de novo: a faixa deve voltar sozinha e ficar verde em poucos segundos.

Para remover:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\uninstall-startup.ps1
```

---

## Deu certo se…

- [ ] `node sync-local-ip.mjs --check-only` termina com `match=true`
- [ ] os `.env` dos seus projetos têm o seu IP
- [ ] a faixa está verde
- [ ] depois de sair e entrar no Windows, a faixa volta sozinha
- [ ] `git status` do clone não mostra `config.json` para commit

---

## Limitações conhecidas hoje

Verificadas em 11/11/2026. Remova o item daqui quando for corrigido no código.

1. **A troca é textual e ampla** (veja o passo 4.2). Ela não distingue "o meu IP" de "o IP de um servidor": a saída é listar o servidor em `ignoreIps`.
2. **`userKey` errado não dá erro.** A faixa continua verde e só o log (`--dry-run`) mostra o `skip`.
---

## Quando algo dá errado

| Sintoma | Causa provável | O que fazer |
|---------|----------------|-------------|
| `config.json invalido (Bad escaped character…)` | Barra invertida sem escape no `config.json` | Refaça o passo 3 (ele gera o arquivo correto) ou use `/` nos caminhos |
| `config.json: "userKey" ainda e o do exemplo` ou `ainda tem SEU_USUARIO` | O `config.json` ainda tem os valores do `config.example.json` | Troque pela sua chave e pelos seus caminhos (passo 3) |
| `git pull` diz que o `config.json` seria sobrescrito | Instalação antiga: o arquivo ainda era versionado | Veja "Atualizando uma instalação antiga" abaixo |
| `reposRoot invalido: nao encontrei ips/, core/…` | Caminho errado, ou a pasta não tem `ips`, `core`, `serveruler-client` ou `uxvision-web` direto dentro | Aponte para a pasta que **contém** esses repositórios e clone o `ips` ali |
| `config.json ausente` | Arquivo apagado ou criado em outra pasta | Ele precisa ficar ao lado de `sync-local-ip.mjs` |
| `IP detectado (…) nao e rede empresa…` | 4G, hotspot ou outra rede | Esperado. Volte para a rede da empresa ou ligue o ZeroTier |
| Detectou o IP errado | Mais de um adaptador ativo | Rode `ipconfig` e veja qual está conectado. Em [rede-e-arquivos.md](rede-e-arquivos.md) está a regra de escolha |
| Faixa vermelha com o IP certo | Há arquivo divergente, ou `config.json` inválido | Passe o mouse para ler o motivo e rode `node sync-local-ip.mjs --dry-run --verbose` |
| `erro (passe o mouse)` ao ligar o PC, mas funciona no terminal | `node` fora do PATH do Windows | Refaça o teste `cmd /c "node -v"` dos pré-requisitos |
| A faixa não aparece | Escondida até a meia-noite, ou posição fora da tela (monitor ou escala diferentes) | Encerre o processo `powershell` da faixa no Gerenciador de Tarefas, apague `ui-state.json` e abra o VBS de novo |
| Faixa laranja com `1o uso` | Primeiro uso: a faixa não grava sozinha | Rode `node sync-local-ip.mjs` no terminal, revise e responda `s` (passo 5) |
| `Erro: primeiro uso nesta maquina…` | A ferramenta foi chamada sem terminal interativo (script, pipe) | Rode em um terminal normal, ou use `--yes` se for automação |
| Duas faixas | VBS aberto duas vezes | Clique direito → Sair em uma delas |
| Faixa verde, mas o app ainda usa o IP velho | O IP está em `.env.development`, `.env.production` ou outro nome | Só `.env`, `.env.local` e `_localVars.ts` são trocados |
| `install-startup.ps1` diz que a execução de scripts está desabilitada | Política `Restricted` | Use o comando do passo 7 |

Se nada disso resolver, junte a saída de `node sync-local-ip.mjs --dry-run --verbose` (sem segredos) e abra uma issue.

---

## Atualizando uma instalação antiga

Até a versão anterior o `config.json` era versionado. Agora ele só existe na sua máquina. Se você já tinha a ferramenta instalada, o primeiro `git pull` precisa de um cuidado: guarde o seu arquivo, deixe o Git removê-lo do índice e devolva-o.

```powershell
cd <pasta do sync-local-ip>
Copy-Item config.json "$env:TEMP\sync-local-ip.config.json"    # guarda o seu
git checkout -- config.json                                    # descarta a edição, para o pull não abortar
git pull
Copy-Item "$env:TEMP\sync-local-ip.config.json" config.json    # devolve o seu
```

Se você **nunca editou** o `config.json`, não devolva o arquivo: ele trazia a chave de outra pessoa. Crie o seu pelo passo 3.
