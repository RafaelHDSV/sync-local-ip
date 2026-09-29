# Política de segurança

## Como reportar uma vulnerabilidade

Se você encontrou uma vulnerabilidade em **sync-local-ip**:

- Não abra uma issue pública.
- Fale direto com o mantenedor, por e-mail ou mensagem privada.
- Inclua passos para reproduzir, impacto e, se possível, uma sugestão de correção.

A resposta inicial ocorre em até 7 dias úteis. Depois da correção, o crédito é seu se você quiser.

## O que esta ferramenta faz na máquina

Ela lê `ipconfig` e reescreve arquivos locais: `.env`, `.env.local`, `_localVars.ts`, `ips/table.ts`, `data.json` e o HTML de redirect do Serveruler, nas pastas indicadas pelo `config.json`. Não há telemetria nem upload. Um `scanRoots` amplo demais troca IPs de mais arquivos do que a pessoa pretendia; isso é um efeito do desenho, descrito no README, e não um canal de vazamento.

Não commite `config.json` com caminhos pessoais, nem `.last-ip.json`, nem o conteúdo de um `.env` real.

## Versões suportadas

Só a versão mais recente no branch padrão recebe correção de segurança.

## Boas práticas

- Não commite segredos (`.env`, tokens, chaves privadas).
- Use o `.gitignore` do projeto como base.
- Trate o `userKey` como identificador interno da tabela de IPs, não como senha. Ainda assim, não publique o `config.json` da sua máquina num fork público sem revisar.
