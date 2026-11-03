# Regras de negócio

> **Para que serve:** algoritmos e regras do domínio que a IA não deve reinventar
> **Fonte da verdade:** módulos de domínio no código
> **Relacionados:** [especificacao](especificacao.md) · [api](api.md) · [banco-de-dados](banco-de-dados.md)

## Regras

1. Perfis empresa e casa não misturam campos. IP fora de `10.10.0`, `172.24`, `10.20` e `192.168` não sincroniza (prefixos atuais; nasceram na AGX). O histórico de IPs em `.last-ip.json` vale entre perfis.
2. `reposRoot` é a âncora (hoje exige um marcador `ips/` / `core/` / `serveruler-client/` / `uxvision-web/`). `scanRoots` amplia a busca de envs para qualquer clone.
3. Só entram na varredura `.env`, `.env.local` e `_localVars.ts`, com o nome comparado sem diferenciar maiúsculas (Windows).
4. A tag sincroniza ao abrir e de hora em hora se houver drift. Duplo clique esconde até a meia-noite.
5. Sem `package.json` e sem telemetria. Estado local: `.last-ip.json` e `ui-state.json` (não versionar).

---
