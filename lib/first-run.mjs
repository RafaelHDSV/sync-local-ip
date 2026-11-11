/**
 * Primeiro uso: a maquina ainda nunca sincronizou (nao ha .last-ip.json).
 * A troca nos .env e textual e ampla (qualquer 10.10.0.x, 172.24.x, 10.20.x), entao a primeira
 * aplicacao precisa ser revisada por uma pessoa antes de gravar.
 */
import { readSync } from 'node:fs'

/**
 * Decide o que fazer com um sync de verdade (os modos --dry-run e --check-only nunca gravam).
 * - 'proceed': segue como sempre.
 * - 'prompt': mostra o resumo e pergunta (terminal interativo).
 * - 'skip': nao grava (a tag, um script ou um pipe nao tem quem aprove).
 *
 * @param {{ firstRun: boolean, yes: boolean, dryRun: boolean, checkOnly: boolean, json: boolean, interactive: boolean }} ctx
 * @returns {'proceed' | 'prompt' | 'skip'}
 */
export function firstRunAction({ firstRun, yes, dryRun, checkOnly, json, interactive }) {
  if (!firstRun || yes || dryRun || checkOnly) return 'proceed'
  if (json || !interactive) return 'skip'
  return 'prompt'
}

/** @param {unknown} text */
export function isYes(text) {
  return /^\s*(s|sim|y|yes)\s*$/i.test(String(text ?? ''))
}

/**
 * Le uma linha do stdin (sincrono, como o resto do motor). EOF ou erro de leitura contam como "nao".
 *
 * @param {string} question
 * @param {{ fd?: number, write?: (text: string) => void }} [io]
 */
export function askYesNo(question, { fd = 0, write = (text) => process.stdout.write(text) } = {}) {
  write(question)
  const buffer = Buffer.alloc(256)
  try {
    const bytes = readSync(fd, buffer, 0, buffer.length, null)
    return isYes(buffer.toString('utf8', 0, bytes))
  } catch {
    return false
  }
}
