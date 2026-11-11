import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { describe, it } from 'node:test'
import { firstRunAction, isYes } from '../lib/first-run.mjs'

const LIB_URL = pathToFileURL(
  join(resolve(dirname(fileURLToPath(import.meta.url)), '..'), 'lib', 'first-run.mjs')
).href

const base = {
  firstRun: true,
  yes: false,
  dryRun: false,
  checkOnly: false,
  json: false,
  interactive: true,
}

describe('firstRunAction', () => {
  it('em terminal interativo no primeiro uso, pergunta', () => {
    assert.equal(firstRunAction(base), 'prompt')
  })

  it('a tag (--json) nunca grava no primeiro uso', () => {
    assert.equal(firstRunAction({ ...base, json: true }), 'skip')
  })

  it('sem terminal interativo (script, pipe) nao grava no primeiro uso', () => {
    assert.equal(firstRunAction({ ...base, interactive: false }), 'skip')
  })

  it('--yes libera o primeiro uso, mesmo sem terminal e com --json', () => {
    assert.equal(firstRunAction({ ...base, yes: true, interactive: false }), 'proceed')
    assert.equal(firstRunAction({ ...base, yes: true, json: true }), 'proceed')
  })

  it('--dry-run e --check-only seguem como sempre, sem perguntar', () => {
    assert.equal(firstRunAction({ ...base, dryRun: true }), 'proceed')
    assert.equal(firstRunAction({ ...base, checkOnly: true, json: true }), 'proceed')
  })

  it('quem ja sincronizou nesta maquina nao e afetado', () => {
    assert.equal(firstRunAction({ ...base, firstRun: false }), 'proceed')
    assert.equal(firstRunAction({ ...base, firstRun: false, json: true, interactive: false }), 'proceed')
  })
})

describe('isYes', () => {
  for (const text of ['s', 'S', 'sim', 'SIM', 'y', 'yes', ' s \r\n', 's\n']) {
    it(`aceita ${JSON.stringify(text)}`, () => {
      assert.equal(isYes(text), true)
    })
  }

  for (const text of ['', 'n', 'nao', 'não', 'sss', 'simm', '\r\n', undefined]) {
    it(`recusa ${JSON.stringify(text)}`, () => {
      assert.equal(isYes(text), false)
    })
  }
})

describe('askYesNo (leitura real do stdin)', () => {
  const ask = (input) => {
    const result = spawnSync(
      process.execPath,
      ['--input-type=module', '-e', `import { askYesNo } from '${LIB_URL}'; console.log('R=' + askYesNo('Aplicar? '))`],
      { encoding: 'utf8', input }
    )
    return result
  }

  it('devolve true para "s" e mostra a pergunta', () => {
    const result = ask('s\r\n')
    assert.match(result.stdout, /Aplicar\? /)
    assert.match(result.stdout, /R=true/)
  })

  it('devolve false para qualquer outra resposta', () => {
    assert.match(ask('n\r\n').stdout, /R=false/)
    assert.match(ask('talvez\r\n').stdout, /R=false/)
  })

  it('devolve false, sem lancar, quando o stdin esta vazio (EOF)', () => {
    const result = ask('')
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /R=false/)
  })
})
