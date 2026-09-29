# Problemas comuns

> **Para que serve:** sintoma → o que está acontecendo → o que fazer.
> **Relacionados:** [configuracao.md](configuracao.md), [tag.md](tag.md), [rede-e-arquivos.md](rede-e-arquivos.md).

| Sintoma | O que está acontecendo | O que fazer |
|---------|------------------------|-------------|
| `erro (passe o mouse)` ou IP vermelho com tooltip | `config.json` ausente, `userKey` vazio, `reposRoot` inválido, ou `node` fora do `PATH` | Leia o tooltip. `node -v` num terminal novo. Confira o JSON |
| `reposRoot nao encontrado` / `invalido` | Âncora sem marcadores ou caminho errado | Caminho absoluto no `config.json` (`\\`). Veja [configuração](configuracao.md) |
| Tag verde e `.env` ainda velho | Fora de `scanRoots`, ou nome diferente de `.env` / `.env.local` | Inclua a pasta; `--dry-run --verbose`; clique na tag |
| Disco / outro clone não muda | Pasta inexistente em `scanRoots` (ignorada) | Corrija o caminho; confira a linha `scanRoots` do dry-run |
| `userKey` não encontrado | Grafia diferente da tabela | Copie a chave de `ips/table.ts` |
| Em casa a tabela não muda | Campo `casa` vazio | Cadastro na tabela do time. Envs do prefixo de casa ainda sincronizam |
| IP é o Wi-Fi velho | Ethernet desconectado ou sem gateway esperado | Confira `ipconfig`. Ethernet no gateway `10.10.0.1` deve ganhar |
| Tag vermelha no 4G / hotspot | Prefixo fora de `10.10.0`, `172.24`, `10.20`, `192.168` | Esperado. Sync ao voltar à rede com esses prefixos |
| Detecta `26.x` / `25.x` | Radmin VPN / Hamachi numa versão antiga | Atualize a ferramenta; essas faixas são ignoradas |
| `_localVars.ts` não muda, com o IP já em `previousIps` | Versão antiga: exigia o nome exato `_localVars.ts`; um `_localvars.ts` era ignorado | Atualize. O `--dry-run --verbose` deve listar o arquivo em `_localVars.ts (auto):` |
| IP certo, mas `.env` não muda ao trocar de rede | Versão antiga: só varria o prefixo da rede atual e descartava o histórico de outro perfil | Atualize e clique na tag. Um `10.10.0.x` / `172.24.x` / `10.20.x` velho é trocado mesmo sem linha na tabela. Um `192.168.x` velho que a ferramenta não conhece continua exigindo `previousIps` à mão |
| Faixa sumiu | Duplo clique esconde até a meia-noite | `"hiddenUntil": null` em `ui-state.json` e abra o VBS |
| Duas faixas | VBS aberto duas vezes | Clique direito → Sair numa delas |
| Medo de estragar `.env` | Troca ampla dentro de `scanRoots` | `--dry-run` antes; enxugue `scanRoots` se a lista assustar |

Log útil:

```powershell
node sync-local-ip.mjs --dry-run --verbose
```

Primeira linha útil: `IP detectado: ... (adaptador, rede empresa|casa)`. Em seguida `reposRoot` e `scanRoots`. Se esses três estiverem errados, não adianta olhar o resto.
