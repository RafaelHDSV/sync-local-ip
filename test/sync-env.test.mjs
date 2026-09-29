import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, it } from 'node:test'

const TOOL_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Copia a ferramenta para uma pasta temporaria: config.json e .last-ip.json sao lidos
 * da pasta do script, entao cada teste precisa da sua copia.
 */
function setupSandbox({ state, table }) {
  const root = mkdtempSync(join(tmpdir(), 'sync-local-ip-'))
  const tool = join(root, 'tool')
  const repos = join(root, 'repos')
  mkdirSync(tool)
  cpSync(join(TOOL_ROOT, 'lib'), join(tool, 'lib'), { recursive: true })
  cpSync(join(TOOL_ROOT, 'sync-local-ip.mjs'), join(tool, 'sync-local-ip.mjs'))
  writeFileSync(join(tool, 'config.json'), JSON.stringify({ userKey: 'dev', reposRoot: repos }))
  writeFileSync(join(tool, '.last-ip.json'), JSON.stringify(state))
  mkdirSync(join(repos, 'ips'), { recursive: true })
  // table null = userKey ausente da tabela (dev ainda nao cadastrado)
  const row = table
    ? `  dev: {\n    empresa: "${table.empresa}",\n    casa: "${table.casa}",\n  },\n`
    : `  outro: {\n    empresa: "10.10.0.200",\n    casa: "172.24.0.200",\n  },\n`
  writeFileSync(join(repos, 'ips', 'table.ts'), `export const table = {\n${row}}\n`)
  mkdirSync(join(repos, 'app'))
  return { root, tool, repos, envPath: join(repos, 'app', '.env') }
}

function runSync(sandbox, ip) {
  return execFileSync(process.execPath, [join(sandbox.tool, 'sync-local-ip.mjs'), '--ip', ip], {
    encoding: 'utf8',
  })
}

describe('sync dos .env ao trocar de rede', () => {
  let sandbox

  afterEach(() => {
    if (sandbox) rmSync(sandbox.root, { recursive: true, force: true })
  })

  describe('empresa -> casa com a tabela desatualizada', () => {
    beforeEach(() => {
      sandbox = setupSandbox({
        state: { ip: '10.10.0.66', profile: 'company', previousIps: [], adapter: 'Ethernet' },
        table: { empresa: '10.10.0.99', casa: '172.24.0.50' },
      })
      writeFileSync(sandbox.envPath, 'API_URL=http://10.10.0.66:3693\nHYPERV=192.168.96.1\n')
    })

    it('troca o ultimo IP gravado pela ferramenta, mesmo sendo de outro perfil', () => {
      runSync(sandbox, '192.168.0.31')
      const env = readFileSync(sandbox.envPath, 'utf8')
      assert.match(env, /API_URL=http:\/\/192\.168\.0\.31:3693/)
    })

    it('nao toca em 192.168.x que a ferramenta nao conhece', () => {
      runSync(sandbox, '192.168.0.31')
      assert.match(readFileSync(sandbox.envPath, 'utf8'), /HYPERV=192\.168\.96\.1/)
    })

    it('nao declara sincronizado na rodada seguinte com o .env ainda velho', () => {
      runSync(sandbox, '192.168.0.31')
      writeFileSync(sandbox.envPath, 'API_URL=http://10.10.0.66:3693\n')
      runSync(sandbox, '192.168.0.31')
      assert.match(readFileSync(sandbox.envPath, 'utf8'), /192\.168\.0\.31/)
    })
  })

  describe('sem historico e sem linha na tabela', () => {
    it('em casa (LAN), troca o 10.10.0.x que ficou nos .env', () => {
      sandbox = setupSandbox({
        state: { ip: '192.168.0.31', profile: 'home', previousIps: [], adapter: 'Ethernet' },
        table: null,
      })
      writeFileSync(sandbox.envPath, 'API_URL=http://10.10.0.66:3693\nHYPERV=192.168.96.1\n')
      runSync(sandbox, '192.168.0.31')
      const env = readFileSync(sandbox.envPath, 'utf8')
      assert.match(env, /API_URL=http:\/\/192\.168\.0\.31:3693/)
      assert.match(env, /HYPERV=192\.168\.96\.1/)
    })

    it('na empresa, troca o 172.24.x que ficou nos .env', () => {
      sandbox = setupSandbox({
        state: { ip: '10.10.0.70', profile: 'company', previousIps: [], adapter: 'Ethernet' },
        table: null,
      })
      writeFileSync(sandbox.envPath, 'API_URL=http://172.24.0.50:3693\n')
      runSync(sandbox, '10.10.0.70')
      assert.match(readFileSync(sandbox.envPath, 'utf8'), /API_URL=http:\/\/10\.10\.0\.70:3693/)
    })
  })

  describe('casa -> empresa', () => {
    beforeEach(() => {
      sandbox = setupSandbox({
        state: { ip: '192.168.0.31', profile: 'home', previousIps: ['10.10.0.66'], adapter: 'Ethernet' },
        table: { empresa: '10.10.0.66', casa: '172.24.0.50' },
      })
      writeFileSync(sandbox.envPath, 'API_URL=http://192.168.0.31:3693\n')
    })

    it('volta o .env para o IP da empresa', () => {
      runSync(sandbox, '10.10.0.70')
      assert.match(readFileSync(sandbox.envPath, 'utf8'), /API_URL=http:\/\/10\.10\.0\.70:3693/)
    })
  })
})
