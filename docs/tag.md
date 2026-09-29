# Tag

> **Para que serve:** usar a faixa no canto da tela no dia a dia.
> **Fonte da verdade:** `sync-local-ip-tag.ps1`, `sync-local-ip-startup.vbs`, `install-startup.ps1`.
> **Relacionados:** [DESIGN.md](DESIGN.md), [linha-de-comando.md](linha-de-comando.md), [problemas-comuns.md](problemas-comuns.md).

A tag é uma faixa sempre por cima, sem ícone na barra de tarefas. Ao abrir, já sincroniza. De hora em hora, se o check acusar divergência, sincroniza de novo.

## Subir e instalar no logon

```powershell
wscript.exe .\sync-local-ip-startup.vbs
.\install-startup.ps1
.\uninstall-startup.ps1
```

O VBS sobe o PowerShell oculto. O atalho de Startup aponta para o VBS, não para um `.bat`.

Uma instância basta. Dois duplos cliques no VBS abrem duas faixas.

## O que a cor significa

| O que você vê | Significado |
|---------------|-------------|
| `IP ...` em amarelo | Sync em andamento |
| IP e `✓` em verde | Estado e arquivos alinhados com o IP detectado |
| IP e `✗` em vermelho | Há IP, mas ainda há drift ou erro — tooltip no mouse |
| `erro (passe o mouse)` | Falha sem IP útil, ou Node fora do `PATH` |
| `sem IP` | `ipconfig` sem IPv4 útil |

Verde exige estado interno alinhado **e** arquivos sem drift (tabela, `data.json`, redirect e envs varridos, no perfil atual). Detalhe do contrato: [especificacao.md](especificacao.md).

## Ações

| Ação | Efeito |
|------|--------|
| Clique sem arrastar | Sincroniza agora |
| Arrastar | Move; salva em `ui-state.json` |
| Duplo clique | Esconde até a meia-noite local. O processo e o poll de 1 h continuam; a faixa volta depois da meia-noite |
| Clique direito | Sincronizar agora / Abrir pasta / Sair |
| A cada 1 hora | Check; se divergir, sync automático |

Sair no menu encerra a tag. Não remove o atalho de logon.

Posição inicial: canto inferior, à esquerda do widget de workday. Visual (cores, fonte, raio): [DESIGN.md](DESIGN.md).

## Faixa sumiu no mesmo dia

Duplo clique não desinstala. Em `ui-state.json`, deixe `"hiddenUntil": null` e abra o VBS de novo (encerre antes o `powershell` da tag no Gerenciador de Tarefas, se ainda estiver rodando).
