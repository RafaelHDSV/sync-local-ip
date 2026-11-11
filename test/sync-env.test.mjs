import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, it } from 'node:test'

const TOOL_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Copia a ferramenta para uma pasta temporaria: config.json e .last-ip.json sao lidos
 * da pasta do script, entao cada teste precisa da sua copia.
 */
function setupSandbox({ state, table, tableRaw, config, configRaw } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'sync-local-ip-'))
  const tool = join(root, 'tool')
  const repos = join(root, 'repos')
  mkdirSync(tool)
  cpSync(join(TOOL_ROOT, 'lib'), join(tool, 'lib'), { recursive: true })
  cpSync(join(TOOL_ROOT, 'sync-local-ip.mjs'), join(tool, 'sync-local-ip.mjs'))
  // configRaw = texto cru (BOM, JSON quebrado); config null = sem config.json
  if (configRaw !== undefined) {
    writeFileSync(join(tool, 'config.json'), typeof configRaw === 'function' ? configRaw(repos) : configRaw)
  } else if (config !== null) {
    writeFileSync(
      join(tool, 'config.json'),
      JSON.stringify({ userKey: 'dev', reposRoot: repos, ...config })
    )
  }
  // state ausente = maquina que nunca sincronizou (sem .last-ip.json)
  if (state) writeFileSync(join(tool, '.last-ip.json'), JSON.stringify(state))
  mkdirSync(join(repos, 'ips'), { recursive: true })
  // table null = userKey ausente da tabela (dev ainda nao cadastrado)
  const row = table
    ? `  dev: {\n    empresa: "${table.empresa}",\n    casa: "${table.casa}",\n  },\n`
    : `  outro: {\n    empresa: "10.10.0.200",\n    casa: "172.24.0.200",\n  },\n`
  // tableRaw = conteudo cru do table.ts (aspas simples, chave com hifen, varias linhas)
  writeFileSync(join(repos, 'ips', 'table.ts'), tableRaw ?? `export const table = {\n${row}}\n`)
  mkdirSync(join(repos, 'app'))
  return { root, tool, repos, envPath: join(repos, 'app', '.env') }
}

/** Como runSync, mas devolve status/stdout/stderr em vez de lancar no exit != 0. */
function runSyncRaw(sandbox, args, options = {}) {
  const result = spawnSync(
    process.execPath,
    [join(sandbox.tool, 'sync-local-ip.mjs'), ...args],
    { encoding: 'utf8', input: options.input ?? '' }
  )
  return { status: result.status, stdout: result.stdout, stderr: result.stderr }
}

function runSync(sandbox, ip, extraArgs = []) {
  return execFileSync(
    process.execPath,
    [join(sandbox.tool, 'sync-local-ip.mjs'), '--ip', ip, ...extraArgs],
    { encoding: 'utf8' }
  )
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

  describe('nomes com outra caixa (Windows nao diferencia)', () => {
    beforeEach(() => {
      sandbox = setupSandbox({
        state: { ip: '192.168.0.31', profile: 'home', previousIps: ['172.28.80.1'], adapter: 'Ethernet' },
        table: null,
      })
    })

    it('atualiza _localvars.ts (v minusculo)', () => {
      const dir = join(sandbox.repos, 'shorten', 'source', 'config')
      mkdirSync(dir, { recursive: true })
      const file = join(dir, '_localvars.ts')
      writeFileSync(file, "const IP = '172.28.80.1'\n")
      runSync(sandbox, '192.168.0.31')
      assert.match(readFileSync(file, 'utf8'), /const IP = '192\.168\.0\.31'/)
    })

    it('atualiza .ENV (maiusculo)', () => {
      const file = join(sandbox.repos, 'app', '.ENV')
      writeFileSync(file, 'API_URL=http://172.28.80.1:3693\n')
      runSync(sandbox, '192.168.0.31')
      assert.match(readFileSync(file, 'utf8'), /192\.168\.0\.31/)
    })

    it('nao processa duas vezes a mesma pasta escrita com outra caixa', () => {
      const cfgPath = join(sandbox.tool, 'config.json')
      const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'))
      cfg.scanRoots = [sandbox.repos, join(sandbox.repos, 'APP')]
      writeFileSync(cfgPath, JSON.stringify(cfg))
      writeFileSync(sandbox.envPath, 'API_URL=http://172.28.80.1:3693\n')
      const out = runSync(sandbox, '192.168.0.31', ['--verbose'])
      assert.match(out, /: 1 env, 0 _localVars\.ts/)
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

describe('ips/table.ts', () => {
  let sandbox
  const STATE = { ip: '10.10.0.66', profile: 'company', previousIps: [], adapter: 'Ethernet' }
  const readTable = () => readFileSync(join(sandbox.repos, 'ips', 'table.ts'), 'utf8')

  afterEach(() => {
    if (sandbox) rmSync(sandbox.root, { recursive: true, force: true })
  })

  it('atualiza a tabela com aspas simples e preserva o estilo', () => {
    sandbox = setupSandbox({
      state: STATE,
      tableRaw: "export const table = {\n  dev: {\n    empresa: '10.10.0.99',\n    casa: '172.24.0.50'\n  },\n}\n",
    })
    runSync(sandbox, '10.10.0.70')
    const table = readTable()
    assert.match(table, /empresa: '10\.10\.0\.70'/)
    assert.match(table, /casa: '172\.24\.0\.50'/)
  })

  it('atualiza a tabela com crase', () => {
    sandbox = setupSandbox({
      state: STATE,
      tableRaw: 'export const table = {\n  dev: {\n    empresa: `10.10.0.99`,\n  },\n}\n',
    })
    runSync(sandbox, '10.10.0.70')
    assert.match(readTable(), /empresa: `10\.10\.0\.70`/)
  })

  it('acha chave entre aspas e com hifen', () => {
    sandbox = setupSandbox({
      state: STATE,
      config: { userKey: 'ana-b' },
      tableRaw: "export const table = {\n  'ana-b': {\n    empresa: '10.10.0.99',\n  },\n}\n",
    })
    runSync(sandbox, '10.10.0.70')
    assert.match(readTable(), /'ana-b': \{\s+empresa: '10\.10\.0\.70'/)
  })

  // Os dois estilos: com aspas duplas o regex antigo ja lia a tabela e casava ana dentro de joana.
  for (const q of ['"', "'"]) {
    it(`a chave ana nao altera a linha da joana (aspas ${q})`, () => {
      sandbox = setupSandbox({
        state: STATE,
        config: { userKey: 'ana' },
        tableRaw: `export const table = {\n  joana: {\n    empresa: ${q}10.10.0.8${q},\n  },\n}\n`,
      })
      const out = runSync(sandbox, '10.10.0.70')
      assert.match(readTable(), new RegExp(`joana: \\{\\s+empresa: ${q}10\\.10\\.0\\.8${q}`))
      assert.match(out, /skip ips\/table\.ts/)
    })

    it(`com ana e joana na tabela, so a ana muda (aspas ${q})`, () => {
      sandbox = setupSandbox({
        state: STATE,
        config: { userKey: 'ana' },
        tableRaw:
          `export const table = {\n  joana: {\n    empresa: ${q}10.10.0.8${q},\n  },\n` +
          `  ana: {\n    empresa: ${q}10.10.0.9${q},\n  },\n}\n`,
      })
      runSync(sandbox, '10.10.0.70')
      const table = readTable()
      assert.match(table, new RegExp(`joana: \\{\\s+empresa: ${q}10\\.10\\.0\\.8${q}`))
      assert.match(table, new RegExp(`\\bana: \\{\\s+empresa: ${q}10\\.10\\.0\\.70${q}`))
    })
  }

  it('campo externalEmpresa nao e confundido com empresa', () => {
    sandbox = setupSandbox({
      state: STATE,
      tableRaw:
        "export const table = {\n  dev: {\n    externalEmpresa: '200.1.1.1',\n    empresa: '10.10.0.99',\n  },\n}\n",
    })
    runSync(sandbox, '10.10.0.70')
    const table = readTable()
    assert.match(table, /externalEmpresa: '200\.1\.1\.1'/)
    assert.match(table, /\n    empresa: '10\.10\.0\.70'/)
  })

  it('a tag nao fica verde quando a tabela com aspas simples esta desatualizada', () => {
    sandbox = setupSandbox({
      state: { ...STATE, ip: '10.10.0.70' },
      tableRaw: "export const table = {\n  dev: {\n    empresa: '10.10.0.99',\n  },\n}\n",
    })
    writeFileSync(sandbox.envPath, 'API_URL=http://10.10.0.70:3693\n')
    const result = runSyncRaw(sandbox, ['--check-only', '--ip', '10.10.0.70'])
    assert.match(result.stdout, /match=false/)
  })
})

describe('primeiro sync (maquina sem .last-ip.json)', () => {
  let sandbox
  const OLD_ENV = 'API_URL=http://10.10.0.66:3693\nDB_HOST=10.10.0.20\n'
  const statePath = () => join(sandbox.tool, '.last-ip.json')

  beforeEach(() => {
    sandbox = setupSandbox({ table: null })
    writeFileSync(sandbox.envPath, OLD_ENV)
  })

  afterEach(() => {
    if (sandbox) rmSync(sandbox.root, { recursive: true, force: true })
  })

  it('a tag (--json) nao grava e pede a aprovacao no terminal', () => {
    const result = runSyncRaw(sandbox, ['--json', '--ip', '10.10.0.70'])
    assert.equal(result.status, 0, result.stderr)
    const payload = JSON.parse(result.stdout)
    assert.equal(payload.needsFirstRun, true)
    assert.equal(payload.synced, false)
    assert.equal(payload.skipped, true)
    assert.match(payload.message, /terminal/)
    assert.equal(readFileSync(sandbox.envPath, 'utf8'), OLD_ENV)
    assert.equal(existsSync(statePath()), false)
  })

  it('sem terminal interativo nao grava, sai com erro e aponta o --yes', () => {
    const result = runSyncRaw(sandbox, ['--ip', '10.10.0.70'])
    assert.equal(result.status, 1)
    assert.match(result.stderr, /primeiro uso/i)
    assert.match(result.stderr, /--yes/)
    assert.equal(readFileSync(sandbox.envPath, 'utf8'), OLD_ENV)
    assert.equal(existsSync(statePath()), false)
  })

  it('--yes grava e cria o estado', () => {
    const result = runSyncRaw(sandbox, ['--yes', '--ip', '10.10.0.70'])
    assert.equal(result.status, 0, result.stderr)
    assert.match(readFileSync(sandbox.envPath, 'utf8'), /API_URL=http:\/\/10\.10\.0\.70:3693/)
    assert.equal(existsSync(statePath()), true)
  })

  it('--dry-run segue como sempre: mostra o que mudaria e nao grava', () => {
    const result = runSyncRaw(sandbox, ['--dry-run', '--ip', '10.10.0.70'])
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /\[dry-run\]/)
    assert.equal(readFileSync(sandbox.envPath, 'utf8'), OLD_ENV)
    assert.equal(existsSync(statePath()), false)
  })

  it('--check-only --json informa needsFirstRun', () => {
    const result = runSyncRaw(sandbox, ['--check-only', '--json', '--ip', '10.10.0.70'])
    assert.equal(JSON.parse(result.stdout).needsFirstRun, true)
  })

  it('depois do primeiro sync aprovado, a tag volta a sincronizar sozinha', () => {
    runSyncRaw(sandbox, ['--yes', '--ip', '10.10.0.70'])
    writeFileSync(sandbox.envPath, 'API_URL=http://10.10.0.70:3693\nDB_HOST=10.10.0.20\n')
    const check = runSyncRaw(sandbox, ['--check-only', '--json', '--ip', '10.10.0.71'])
    assert.equal(JSON.parse(check.stdout).needsFirstRun, false)
    const result = runSyncRaw(sandbox, ['--json', '--ip', '10.10.0.71'])
    const payload = JSON.parse(result.stdout)
    assert.equal(payload.synced, true)
    assert.match(readFileSync(sandbox.envPath, 'utf8'), /API_URL=http:\/\/10\.10\.0\.71:3693/)
  })

  it('quem ja tem .last-ip.json nao e afetado', () => {
    writeFileSync(
      statePath(),
      JSON.stringify({ ip: '10.10.0.66', profile: 'company', previousIps: [], adapter: 'Ethernet' })
    )
    const result = runSyncRaw(sandbox, ['--json', '--ip', '10.10.0.70'])
    const payload = JSON.parse(result.stdout)
    assert.equal(payload.needsFirstRun, false)
    assert.equal(payload.synced, true)
  })
})

describe('IP antigo que e prefixo de outro IP', () => {
  let sandbox

  afterEach(() => {
    if (sandbox) rmSync(sandbox.root, { recursive: true, force: true })
  })

  it('a rede nova 10.10.0.188 nao vira 10.10.0.1888 quando o historico tem 10.10.0.18', () => {
    sandbox = setupSandbox({
      state: { ip: '10.10.0.155', profile: 'company', previousIps: ['10.10.0.18'], adapter: 'Ethernet' },
    })
    writeFileSync(sandbox.envPath, 'API_URL=http://10.10.0.155:3693\n')
    runSync(sandbox, '10.10.0.188')
    assert.equal(readFileSync(sandbox.envPath, 'utf8'), 'API_URL=http://10.10.0.188:3693\n')
  })

  it('so troca o IP inteiro: 192.168.0.5 nao pega 192.168.0.55 nem 1192.168.0.5', () => {
    sandbox = setupSandbox({
      state: { ip: '192.168.0.5', profile: 'home', previousIps: [], adapter: 'Ethernet' },
    })
    writeFileSync(sandbox.envPath, 'A=192.168.0.5\nB=192.168.0.55\nC=1192.168.0.5\n')
    runSync(sandbox, '10.10.0.70')
    assert.equal(readFileSync(sandbox.envPath, 'utf8'), 'A=10.10.0.70\nB=192.168.0.55\nC=1192.168.0.5\n')
  })

  it('troca o IP seguido de ponto final de frase em comentario', () => {
    sandbox = setupSandbox({
      state: { ip: '192.168.0.5', profile: 'home', previousIps: [], adapter: 'Ethernet' },
    })
    writeFileSync(sandbox.envPath, '# servidor em 192.168.0.5.\nA=192.168.0.5\n')
    runSync(sandbox, '10.10.0.70')
    assert.equal(readFileSync(sandbox.envPath, 'utf8'), '# servidor em 10.10.0.70.\nA=10.10.0.70\n')
  })

  it('a tag fica verde: IP atual que tem um antigo como prefixo nao conta como drift', () => {
    sandbox = setupSandbox({
      state: { ip: '10.10.0.188', profile: 'company', previousIps: ['10.10.0.18'], adapter: 'Ethernet' },
    })
    writeFileSync(sandbox.envPath, 'API_URL=http://10.10.0.188:3693\n')
    const result = runSyncRaw(sandbox, ['--check-only', '--ip', '10.10.0.188'])
    assert.match(result.stdout, /match=true/)
  })
})

describe('ignoreIps', () => {
  let sandbox
  const STATE = { ip: '10.10.0.66', profile: 'company', previousIps: [], adapter: 'Ethernet' }
  const SHARED_DB = '10.10.0.20'

  afterEach(() => {
    if (sandbox) rmSync(sandbox.root, { recursive: true, force: true })
  })

  it('sem ignoreIps, o IP de um servidor compartilhado tambem e trocado (comportamento atual)', () => {
    sandbox = setupSandbox({ state: STATE })
    writeFileSync(sandbox.envPath, `API_URL=http://10.10.0.66:3693\nDB_HOST=${SHARED_DB}\n`)
    runSync(sandbox, '10.10.0.70')
    assert.match(readFileSync(sandbox.envPath, 'utf8'), /DB_HOST=10\.10\.0\.70/)
  })

  it('IP em ignoreIps nunca e trocado, e o seu IP antigo continua sendo', () => {
    sandbox = setupSandbox({ state: STATE, config: { ignoreIps: [SHARED_DB] } })
    writeFileSync(sandbox.envPath, `API_URL=http://10.10.0.66:3693\nDB_HOST=${SHARED_DB}\n`)
    runSync(sandbox, '10.10.0.70')
    const env = readFileSync(sandbox.envPath, 'utf8')
    assert.match(env, /API_URL=http:\/\/10\.10\.0\.70:3693/)
    assert.match(env, /DB_HOST=10\.10\.0\.20/)
  })

  it('IP ignorado nao deixa a tag vermelha (nao conta como drift)', () => {
    sandbox = setupSandbox({
      state: { ...STATE, ip: '10.10.0.70' },
      table: { empresa: '10.10.0.70', casa: '172.24.0.50' },
      config: { ignoreIps: [SHARED_DB] },
    })
    writeFileSync(sandbox.envPath, `API_URL=http://10.10.0.70:3693\nDB_HOST=${SHARED_DB}\n`)
    const result = runSyncRaw(sandbox, ['--check-only', '--ip', '10.10.0.70'])
    assert.match(result.stdout, /match=true/)
  })

  it('o mesmo cenario sem ignoreIps conta como drift', () => {
    sandbox = setupSandbox({
      state: { ...STATE, ip: '10.10.0.70' },
      table: { empresa: '10.10.0.70', casa: '172.24.0.50' },
    })
    writeFileSync(sandbox.envPath, `API_URL=http://10.10.0.70:3693\nDB_HOST=${SHARED_DB}\n`)
    const result = runSyncRaw(sandbox, ['--check-only', '--ip', '10.10.0.70'])
    assert.match(result.stdout, /match=false/)
  })

  it('recusa entrada que nao e IPv4', () => {
    sandbox = setupSandbox({ config: { ignoreIps: ['servidor-db'] } })
    const result = runSyncRaw(sandbox, ['--check-only', '--ip', '10.10.0.70'])
    assert.equal(result.status, 1)
    assert.match(result.stderr, /ignoreIps/)
    assert.match(result.stderr, /servidor-db/)
  })

  it('recusa ignoreIps que nao e lista', () => {
    sandbox = setupSandbox({ config: { ignoreIps: '10.10.0.20' } })
    const result = runSyncRaw(sandbox, ['--check-only', '--ip', '10.10.0.70'])
    assert.equal(result.status, 1)
    assert.match(result.stderr, /ignoreIps/)
  })
})

describe('config.json no primeiro uso', () => {
  let sandbox

  afterEach(() => {
    if (sandbox) rmSync(sandbox.root, { recursive: true, force: true })
  })

  it('aceita config.json salvo com BOM', () => {
    sandbox = setupSandbox({
      configRaw: (repos) => `\uFEFF${JSON.stringify({ userKey: 'dev', reposRoot: repos })}`,
    })
    const result = runSyncRaw(sandbox, ['--check-only', '--ip', '10.10.0.66'])
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /detectado=10\.10\.0\.66/)
  })

  it('explica a barra invertida sem escape e aponta o guia', () => {
    sandbox = setupSandbox({
      configRaw: () => '{ "userKey": "dev", "reposRoot": "C:\\Users\\x" }',
    })
    const result = runSyncRaw(sandbox, ['--check-only', '--ip', '10.10.0.66'])
    assert.equal(result.status, 1)
    assert.match(result.stderr, /config\.json invalido/)
    assert.match(result.stderr, /barra invertida/)
    assert.match(result.stderr, /docs\/onboarding\.md/)
  })

  it('recusa o userKey do exemplo', () => {
    sandbox = setupSandbox({ config: { userKey: 'seu-login' } })
    const result = runSyncRaw(sandbox, ['--check-only', '--ip', '10.10.0.66'])
    assert.equal(result.status, 1)
    assert.match(result.stderr, /userKey/)
    assert.match(result.stderr, /exemplo/)
  })

  it('recusa o reposRoot com SEU_USUARIO do exemplo', () => {
    sandbox = setupSandbox({ config: { reposRoot: 'C:/Users/SEU_USUARIO/Desktop/repos' } })
    const result = runSyncRaw(sandbox, ['--check-only', '--ip', '10.10.0.66'])
    assert.equal(result.status, 1)
    assert.match(result.stderr, /SEU_USUARIO/)
  })

  it('recusa SEU_USUARIO esquecido em scanRoots', () => {
    sandbox = setupSandbox({ config: { scanRoots: ['C:/Users/SEU_USUARIO/Desktop/repos'] } })
    const result = runSyncRaw(sandbox, ['--check-only', '--ip', '10.10.0.66'])
    assert.equal(result.status, 1)
    assert.match(result.stderr, /scanRoots/)
    assert.match(result.stderr, /SEU_USUARIO/)
  })

  it('sem config.json, manda criar o proprio a partir do exemplo e aponta o guia', () => {
    sandbox = setupSandbox({ config: null })
    const result = runSyncRaw(sandbox, ['--check-only', '--ip', '10.10.0.66'])
    assert.equal(result.status, 1)
    assert.match(result.stderr, /config\.example\.json/)
    assert.match(result.stderr, /docs\/onboarding\.md/)
  })

  it('no modo --json o erro de config vai no payload', () => {
    sandbox = setupSandbox({ config: { userKey: 'seu-login' } })
    const result = runSyncRaw(sandbox, ['--check-only', '--json', '--ip', '10.10.0.66'])
    const payload = JSON.parse(result.stdout)
    assert.equal(payload.ok, false)
    assert.equal(payload.detected, '10.10.0.66')
    assert.match(payload.error, /userKey/)
  })
})
