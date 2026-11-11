#!/usr/bin/env node
/**
 * Detecta o IPv4 util via ipconfig e propaga para:
 * - .env / .env.local (varredura em scanRoots)
 * - _localVars.ts (idem)
 * - ips/table.ts (empresa ou casa do userKey, conforme rede)
 * - serveruler-redirect/index.html (reposRoot)
 * - .tools/serveruler-redirect/index.html (copia local da ferramenta)
 * - serveruler-client/public/data.json (empresa do userKey, se existir)
 */
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { dirname, join, resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pickPrimaryIpv4 } from './lib/detect-ip.mjs'
import { firstRunAction, askYesNo } from './lib/first-run.mjs'
import { containsAnyIp, replaceIps } from './lib/ip-text.mjs'
import { profileForIp, ipMatchesProfile, ENV_SCAN_PATTERNS } from './lib/network-profile.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const STATE_FILE = join(__dirname, '.last-ip.json')
const SERVERULER_PORT = 5173
const PREVIOUS_IP_LIMIT = 12

const SKIP_DIR_NAMES = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  'coverage',
  '.turbo',
  'vendor',
  '.cache',
  '.vercel',
])

const ENV_FILE_NAMES = new Set(['.env', '.env.local'])
const LOCAL_VARS_FILE = '_localVars.ts'
const REPOS_MARKERS = ['ips', 'core', 'serveruler-client', 'uxvision-web']

function parseArgs(argv) {
  const args = {
    ip: '',
    dryRun: false,
    verbose: false,
    checkOnly: false,
    json: false,
    help: false,
    yes: false,
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--ip' && argv[i + 1]) {
      args.ip = argv[++i]
    } else if (arg === '--dry-run') {
      args.dryRun = true
    } else if (arg === '--verbose' || arg === '-v') {
      args.verbose = true
    } else if (arg === '--check-only') {
      args.checkOnly = true
    } else if (arg === '--json') {
      args.json = true
    } else if (arg === '--yes' || arg === '-y') {
      args.yes = true
    } else if (arg === '--help' || arg === '-h') {
      args.help = true
    }
  }
  return args
}

const CONFIG_GUIDE = 'docs/onboarding.md'
const FIRST_RUN_MESSAGE =
  'Primeiro uso nesta maquina: nada foi gravado. Rode "node sync-local-ip.mjs" no terminal desta pasta, ' +
  'revise o resumo e aprove (s). Depois a sincronizacao fica automatica.'
const IPV4_RE = /^\d{1,3}(\.\d{1,3}){3}$/
/**
 * IPs de config.ignoreIps (servidor compartilhado, banco...): nunca sao trocados e nao contam
 * como drift. Preenchido por main() depois de ler o config.
 */
const ignoredIps = new Set()
const isIgnoredIp = (ip) => ignoredIps.has(ip)
/** Valores de config.example.json: se sobrarem no config.json, o dev esqueceu de editar. */
const EXAMPLE_USER_KEY = 'seu-login'
const EXAMPLE_PATH_MARKER = 'SEU_USUARIO'

function loadConfig() {
  const path = join(__dirname, 'config.json')
  if (!existsSync(path)) {
    throw new Error(
      'config.json ausente. Copie config.example.json para config.json e preencha "userKey" ' +
        `e "reposRoot". Passo a passo: ${CONFIG_GUIDE}`
    )
  }
  // Editores antigos e o Set-Content -Encoding UTF8 do PowerShell 5.1 gravam BOM, que o JSON.parse recusa.
  const text = readFileSync(path, 'utf8').replace(/^\uFEFF/, '')
  let config
  try {
    config = JSON.parse(text)
  } catch (error) {
    throw new Error(
      `config.json invalido (${error.message}). Causas comuns: barra invertida sem escape ` +
        '(use "C:/pasta" ou "C:\\\\pasta"), virgula sobrando ou aspas faltando. ' +
        `Passo a passo: ${CONFIG_GUIDE}`
    )
  }
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error(`config.json: o conteudo deve ser um objeto JSON. Passo a passo: ${CONFIG_GUIDE}`)
  }
  if (!config.userKey || typeof config.userKey !== 'string') {
    throw new Error(`config.json: "userKey" e obrigatorio. Passo a passo: ${CONFIG_GUIDE}`)
  }
  if (config.userKey === EXAMPLE_USER_KEY) {
    throw new Error(
      `config.json: "userKey" ainda e o do exemplo ("${EXAMPLE_USER_KEY}"). ` +
        `Troque pela sua chave. Passo a passo: ${CONFIG_GUIDE}`
    )
  }
  if (config.ignoreIps !== undefined) {
    if (!Array.isArray(config.ignoreIps)) {
      throw new Error('config.json: "ignoreIps" deve ser uma lista de IPv4, ex.: ["10.10.0.5"].')
    }
    const invalid = config.ignoreIps.find((ip) => typeof ip !== 'string' || !IPV4_RE.test(ip.trim()))
    if (invalid !== undefined) {
      throw new Error(
        `config.json: "ignoreIps" tem uma entrada que nao e IPv4: ${JSON.stringify(invalid)}. ` +
          'Use so enderecos como "10.10.0.5".'
      )
    }
  }
  const paths = [
    ['reposRoot', config.reposRoot],
    ...(Array.isArray(config.scanRoots) ? config.scanRoots.map((p, i) => [`scanRoots[${i}]`, p]) : []),
  ]
  for (const [field, value] of paths) {
    if (typeof value === 'string' && value.includes(EXAMPLE_PATH_MARKER)) {
      throw new Error(
        `config.json: "${field}" ainda tem ${EXAMPLE_PATH_MARKER} do exemplo. ` +
          `Troque pelo caminho real. Passo a passo: ${CONFIG_GUIDE}`
      )
    }
  }
  return config
}

function resolvePathFromConfig(entry) {
  if (!entry || typeof entry !== 'string') return null
  const trimmed = entry.trim()
  if (!trimmed) return null
  if (/^[A-Za-z]:[\\/]/.test(trimmed) || trimmed.startsWith('\\\\')) {
    return resolve(trimmed)
  }
  if (trimmed.startsWith('/')) {
    return resolve(trimmed)
  }
  return resolve(__dirname, trimmed)
}

function looksLikeReposRoot(dir) {
  return REPOS_MARKERS.some((name) => existsSync(join(dir, name)))
}

function resolveReposRoot(config) {
  if (config.reposRoot) {
    const root = resolvePathFromConfig(config.reposRoot)
    if (!root || !looksLikeReposRoot(root)) {
      throw new Error(
        'reposRoot invalido: nao encontrei ips/, core/ ou serveruler-client/. ' +
          'Ajuste "reposRoot" em config.json (caminho absoluto ou relativo a esta pasta).'
      )
    }
    return root
  }

  const candidates = [
    resolve(__dirname, '../..'),
    resolve(__dirname, '..'),
  ]
  const home = process.env.USERPROFILE || process.env.HOME || ''
  if (home) {
    candidates.push(join(home, 'Desktop', 'repos'))
    candidates.push(join(home, 'repos'))
    candidates.push(join(home, 'dev'))
  }

  for (const candidate of candidates) {
    if (looksLikeReposRoot(candidate)) return candidate
  }

  throw new Error(
    'reposRoot nao encontrado automaticamente. Defina "reposRoot" em config.json ' +
      '(pasta que contem ips/, core/ ou serveruler-client/).'
  )
}

function resolveScanRoots(config, reposRoot) {
  /** @type {string[]} */
  const roots = []
  const seen = new Set()

  const addRoot = (entry, { required = false } = {}) => {
    const abs = typeof entry === 'string' ? resolvePathFromConfig(entry) : entry
    if (!abs) {
      if (required) throw new Error('scanRoots: entrada invalida no config.json.')
      return
    }
    if (!existsSync(abs)) {
      if (required) {
        throw new Error(`scanRoots: pasta inexistente: ${abs}`)
      }
      return
    }
    const key = abs.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    roots.push(abs)
  }

  addRoot(reposRoot, { required: true })

  if (Array.isArray(config.scanRoots)) {
    for (const entry of config.scanRoots) {
      addRoot(entry)
    }
  }

  if (!roots.length) {
    throw new Error('scanRoots: nenhuma pasta valida para varrer .env / _localVars.ts.')
  }

  return roots
}

function loadState() {
  if (!existsSync(STATE_FILE)) return null
  const raw = JSON.parse(readFileSync(STATE_FILE, 'utf8'))
  const ip = raw.ip || raw.companyIp || null
  const previousIps = Array.isArray(raw.previousIps) ? raw.previousIps.map(String) : []
  return {
    ip,
    profile: raw.profile || null,
    previousIps,
    updatedAt: raw.updatedAt || null,
    adapter: raw.adapter || null,
  }
}

function saveState({ ip, profile, previousIps, adapter }) {
  const payload = {
    ip,
    profile: profile || null,
    previousIps: previousIps.slice(0, PREVIOUS_IP_LIMIT),
    adapter: adapter || null,
    updatedAt: new Date().toISOString(),
  }
  writeFileSync(STATE_FILE, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
}

function readUserKeyFieldIp(filePath, userKey, field) {
  if (!existsSync(filePath)) return null
  const text = readFileSync(filePath, 'utf8')
  if (filePath.endsWith('.json')) {
    try {
      const data = JSON.parse(text)
      const entry = data[userKey]
      const value = entry?.[field]
      if (value && /^\d+\.\d+\.\d+\.\d+$/.test(value)) {
        return value
      }
    } catch {
      return null
    }
    return null
  }
  const match = text.match(userKeyFieldPattern(userKey, field))
  return match ? match[4] : null
}

/**
 * Acha `<chave>: { ... <campo>: '<ip>' }` em ips/table.ts.
 * - IP com aspas simples, duplas ou crase (a tabela real usa simples).
 * - Chave simples ou entre aspas, com hifen (`'ana-b': {`).
 * - Fronteira de palavra: a chave `ana` nao casa dentro de `joana:`, nem o campo
 *   `empresa` dentro de `xempresa:`.
 * Grupos: 1 = tudo ate a aspa de abertura do IP, 4 = o IP, 5 = a aspa de fechamento.
 */
function userKeyFieldPattern(userKey, field) {
  const key = escapeRegExp(userKey)
  const name = escapeRegExp(field)
  return new RegExp(
    `((?<![\\w-])(["'\`]?)${key}\\2\\s*:\\s*\\{[^}]*?(?<![\\w-])${name}\\s*:\\s*(["'\`]))([\\d.]+)(\\3)`,
    's'
  )
}

function readUserKeyIpFromFile(filePath, userKey, field = 'empresa') {
  return readUserKeyFieldIp(filePath, userKey, field)
}

function collectKnownOldIps(state, reposRoot, userKey, profile) {
  const set = new Set()
  // Sem filtro de perfil: o historico so tem IPs que esta ferramenta gravou nesta maquina.
  // Ao trocar de rede, o IP que esta nos .env e justamente o do outro perfil.
  if (state?.ip) set.add(state.ip)
  for (const ip of state?.previousIps || []) set.add(ip)
  const tableField = profile.tableField
  const fromTable = readUserKeyFieldIp(join(reposRoot, 'ips', 'table.ts'), userKey, tableField)
  if (fromTable) set.add(fromTable)
  const fromData = readUserKeyFieldIp(
    join(reposRoot, 'serveruler-client', 'public', 'data.json'),
    userKey,
    tableField
  )
  if (fromData) set.add(fromData)
  return [...set]
}

function readRedirectIp(reposRoot, redirectConst) {
  const filePath = join(reposRoot, 'serveruler-redirect', 'index.html')
  if (!existsSync(filePath)) return null
  const re = new RegExp(`const ${escapeRegExp(redirectConst)} = "http:\\/\\/([\\d.]+):`)
  const match = readFileSync(filePath, 'utf8').match(re)
  return match ? match[1] : null
}

function readRedirectCompanyIp(reposRoot) {
  return readRedirectIp(reposRoot, 'COMPANY_IP_ADDRESS')
}

function findStaleIpsInWorkspace(scanRoots, detected, profile) {
  if (!ipMatchesProfile(detected, profile)) return []
  const found = new Set()
  const { envFiles, localVarsFiles } = discoverTargetFiles(scanRoots, false)
  for (const filePath of [...envFiles, ...localVarsFiles]) {
    let text
    try {
      text = readFileSync(filePath, 'utf8')
    } catch {
      continue
    }
    // Prefixos de todos os perfis: ao trocar de rede, o IP velho nos .env e o da outra rede,
    // e sem historico nem linha na tabela so a varredura o encontra. 192.168 fica fora (ver lib).
    for (const pattern of ENV_SCAN_PATTERNS) {
      for (const match of text.matchAll(pattern)) {
        const ip = match[1]
        if (ip !== detected) found.add(ip)
      }
    }
  }
  return [...found]
}

function workspaceContainsAnyIp(scanRoots, ips) {
  if (!ips.length) return false
  const { envFiles, localVarsFiles } = discoverTargetFiles(scanRoots, false)
  for (const filePath of [...envFiles, ...localVarsFiles]) {
    let text
    try {
      text = readFileSync(filePath, 'utf8')
    } catch {
      continue
    }
    if (containsAnyIp(text, ips)) return true
  }
  return false
}

function readCrossProfileIp(reposRoot, userKey, profile) {
  const crossField = profile.id === 'company' ? 'casa' : 'empresa'
  return readUserKeyFieldIp(join(reposRoot, 'ips', 'table.ts'), userKey, crossField)
}

function envContainsOppositeProfileIp(reposRoot, scanRoots, userKey, profile) {
  const crossIp = readCrossProfileIp(reposRoot, userKey, profile)
  if (!crossIp || isIgnoredIp(crossIp)) return false
  return workspaceContainsAnyIp(scanRoots, [crossIp])
}

function hasWorkspaceDrift(reposRoot, scanRoots, userKey, detected, profile, state) {
  if (!detected || !profile) return false

  const tableIp = readUserKeyFieldIp(join(reposRoot, 'ips', 'table.ts'), userKey, profile.tableField)
  if (tableIp && tableIp !== detected) return true

  const dataIp = readUserKeyFieldIp(
    join(reposRoot, 'serveruler-client', 'public', 'data.json'),
    userKey,
    profile.tableField
  )
  if (dataIp && dataIp !== detected) return true

  const redirectIp = readRedirectIp(reposRoot, profile.redirectConst)
  if (redirectIp && redirectIp !== detected) return true

  if (envContainsOppositeProfileIp(reposRoot, scanRoots, userKey, profile)) return true

  const staleCandidates = [
    ...collectKnownOldIps(state, reposRoot, userKey, profile),
    ...findStaleIpsInWorkspace(scanRoots, detected, profile),
  ].filter((ip, index, arr) => ip !== detected && !isIgnoredIp(ip) && arr.indexOf(ip) === index)

  return workspaceContainsAnyIp(scanRoots, staleCandidates)
}

function buildOldIpList(state, reposRoot, scanRoots, userKey, detected, profile) {
  const set = new Set(collectKnownOldIps(state, reposRoot, userKey, profile))
  for (const ip of findStaleIpsInWorkspace(scanRoots, detected, profile)) {
    set.add(ip)
  }
  const crossIp = readCrossProfileIp(reposRoot, userKey, profile)
  if (crossIp) set.add(crossIp)
  set.delete(detected)
  return [...set].filter((ip) => ip && ip !== detected && !isIgnoredIp(ip))
}

function isFullySynced(reposRoot, scanRoots, userKey, detected, profile, state) {
  const registered = state?.ip || null
  const registeredProfile = state?.profile || (registered ? profileForIp(registered)?.id : null)
  if (!registered || registered !== detected) return false
  if (registeredProfile && profile && registeredProfile !== profile.id) return false
  return !hasWorkspaceDrift(reposRoot, scanRoots, userKey, detected, profile, state)
}

function detectPrimaryIp() {
  const output = execSync('ipconfig', { encoding: 'utf8' })
  return pickPrimaryIpv4(output)
}

function discoverTargetFilesInRoot(reposRoot) {
  const envFiles = []
  const localVarsFiles = []

  function walk(dir) {
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (SKIP_DIR_NAMES.has(entry.name)) continue
        walk(fullPath)
        continue
      }
      if (!entry.isFile()) continue
      // Windows nao diferencia caixa: _localvars.ts e carregado por require('./_localVars').
      const name = entry.name.toLowerCase()
      if (ENV_FILE_NAMES.has(name)) {
        envFiles.push(fullPath)
        continue
      }
      if (name === LOCAL_VARS_FILE.toLowerCase()) {
        localVarsFiles.push(fullPath)
      }
    }
  }

  walk(reposRoot)
  return { envFiles, localVarsFiles }
}

function discoverTargetFiles(scanRoots, verbose) {
  // Chave em minusculas: "C:\AGX" e "C:\AGX\main workspace" chegam ao mesmo arquivo com caixas
  // diferentes ("Main workspace" vs "main workspace"). Fica o primeiro caminho visto.
  const envMap = new Map()
  const localVarsMap = new Map()
  const addOnce = (map, filePath) => {
    const key = filePath.toLowerCase()
    if (!map.has(key)) map.set(key, filePath)
  }

  for (const root of scanRoots) {
    const { envFiles, localVarsFiles } = discoverTargetFilesInRoot(root)
    for (const filePath of envFiles) addOnce(envMap, filePath)
    for (const filePath of localVarsFiles) addOnce(localVarsMap, filePath)
  }

  const envFiles = [...envMap.values()]
  const localVarsFiles = [...localVarsMap.values()]

  if (verbose) {
    console.log(
      `Descobertos em ${scanRoots.length} raiz(es): ${envFiles.length} env, ${localVarsFiles.length} _localVars.ts`
    )
  }
  return { envFiles, localVarsFiles }
}

function labelForScanRootFile(filePath, scanRoots) {
  for (const root of scanRoots) {
    if (filePath === root || filePath.startsWith(`${root}\\`) || filePath.startsWith(`${root}/`)) {
      return relative(root, filePath)
    }
  }
  return filePath
}

function updateFileWithIpReplace(filePath, oldIps, newIp, dryRun, verbose, label, quiet) {
  if (!existsSync(filePath)) {
    if (verbose && !quiet) console.log(`  skip (ausente): ${filePath}`)
    return { updated: false, replacements: 0 }
  }

  const original = readFileSync(filePath, 'utf8')
  if (!containsAnyIp(original, oldIps)) {
    if (verbose && !quiet) console.log(`  ok (sem IP anterior): ${filePath}`)
    return { updated: false, replacements: 0 }
  }

  const { text, replacements } = replaceIps(original, oldIps, newIp)
  if (replacements === 0) {
    if (verbose && !quiet) console.log(`  ok (sem mudanca): ${filePath}`)
    return { updated: false, replacements: 0 }
  }

  if (!dryRun) writeFileSync(filePath, text, 'utf8')
  if (!quiet) console.log(`  ${dryRun ? '[dry-run] ' : ''}${label} (${replacements}x): ${filePath}`)
  return { updated: true, replacements }
}

function updateIpsTable(filePath, userKey, field, newIp, dryRun, quiet) {
  if (!existsSync(filePath)) {
    if (!quiet) console.log(`  skip ips/table.ts (ausente): ${filePath}`)
    return false
  }

  const original = readFileSync(filePath, 'utf8')
  const pattern = userKeyFieldPattern(userKey, field)
  const match = original.match(pattern)
  if (!match) {
    if (!quiet) {
      console.log(`  skip ips/table.ts (userKey "${userKey}" / ${field} nao encontrado): ${filePath}`)
    }
    return false
  }

  const currentIp = match[4]
  if (currentIp === newIp) {
    if (!quiet) console.log(`  ok ips/table.ts (sem mudanca): ${filePath}`)
    return false
  }

  // Funcao, nao string: "$1" + IP comecando em digito viraria "$11".
  const updated = original.replace(pattern, (_all, prefix, _keyQuote, _ipQuote, _ip, closing) => {
    return `${prefix}${newIp}${closing}`
  })
  if (!dryRun) writeFileSync(filePath, updated, 'utf8')
  if (!quiet) {
    console.log(`  ${dryRun ? '[dry-run] ' : ''}ips/table.ts ${userKey}.${field} ${currentIp} -> ${newIp}`)
  }
  return true
}

function updateServerulerRedirect(filePath, newIp, redirectConst, dryRun, quiet) {
  if (!existsSync(filePath)) {
    if (!quiet) console.log(`  skip redirect (ausente): ${filePath}`)
    return false
  }

  const url = `http://${newIp}:${SERVERULER_PORT}/`
  const original = readFileSync(filePath, 'utf8')
  const pattern = new RegExp(
    `const ${escapeRegExp(redirectConst)} = "http:\\/\\/[\\d.]+:\\d+\\/";`
  )
  const updated = original.replace(pattern, `const ${redirectConst} = "${url}";`)

  if (updated === original) {
    if (!quiet) console.log(`  ok redirect ${redirectConst} (sem mudanca): ${filePath}`)
    return false
  }

  if (!dryRun) writeFileSync(filePath, updated, 'utf8')
  if (!quiet) console.log(`  ${dryRun ? '[dry-run] ' : ''}${redirectConst} -> ${url}`)
  return true
}

function updateServerulerDataJson(filePath, userKey, field, newIp, dryRun, quiet) {
  if (!existsSync(filePath)) {
    if (!quiet) console.log(`  skip data.json (ausente): ${filePath}`)
    return false
  }

  let data
  try {
    data = JSON.parse(readFileSync(filePath, 'utf8'))
  } catch {
    if (!quiet) console.log(`  skip data.json (JSON invalido): ${filePath}`)
    return false
  }

  const entry = data[userKey]
  if (!entry) {
    if (!quiet) console.log(`  skip data.json (userKey "${userKey}" ausente): ${filePath}`)
    return false
  }

  const current = entry[field]
  if (!current || !/^\d+\.\d+\.\d+\.\d+$/.test(current)) {
    if (!quiet) console.log(`  skip data.json (${field} vazio ou invalido): ${filePath}`)
    return false
  }
  if (current === newIp) {
    if (!quiet) console.log(`  ok data.json (sem mudanca): ${filePath}`)
    return false
  }

  entry[field] = newIp
  if (!dryRun) {
    writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
  }
  if (!quiet) console.log(`  ${dryRun ? '[dry-run] ' : ''}data.json ${userKey}.${field} ${current} -> ${newIp}`)
  return true
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function printHelp() {
  console.log(`Uso: node sync-local-ip.mjs [opcoes]

Detecta o IPv4 util (Ethernet/Wi-Fi) e atualiza .env, _localVars, ips/table.ts, Serveruler.

Opcoes:
  --ip <addr>    Usar IP manual em vez de ipconfig
  --check-only   So compara detectado vs cadastrado (nao grava)
  --json         Saida JSON (com --check-only ou no fim do sync)
  --dry-run      Mostra mudancas sem gravar
  --verbose      Lista arquivos ignorados
  --yes, -y      Nao pergunta no primeiro uso (maquina sem .last-ip.json)
  -h, --help     Esta ajuda

Primeiro uso: sem .last-ip.json o terminal mostra o resumo e pergunta antes de gravar;
a tag (--json) e scripts nao gravam ate voce aprovar (ou usar --yes).

config.json minimo: { "userKey": "<sua chave>" } (copie de config.example.json)
Opcional: "ignoreIps": ["10.10.0.5"] = IPs que nunca sao trocados (servidor compartilhado)
`)
}

function buildCheckPayload({ detected, registered, adapter, match, profile, needsFirstRun }) {
  return {
    ok: Boolean(detected),
    detected: detected || null,
    registered: registered || null,
    profile: profile?.id || null,
    match: Boolean(match),
    adapter: adapter || null,
    needsFirstRun: Boolean(needsFirstRun),
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    printHelp()
    process.exit(0)
  }

  runContext.json = args.json
  const state = loadState()

  // Detecta antes de ler config: erro de config nao pode esconder o IP da tag.
  let detected = null
  let adapter = null
  if (args.ip) {
    detected = args.ip
    adapter = 'manual'
  } else {
    const picked = detectPrimaryIp()
    if (!picked) {
      const payload = buildCheckPayload({
        detected: null,
        registered: state?.ip || null,
        adapter: null,
        match: false,
      })
      if (args.json || args.checkOnly) {
        console.log(JSON.stringify(payload))
      } else {
        console.error('Erro: nenhum IPv4 util encontrado no ipconfig. Use --ip manualmente.')
      }
      process.exit(1)
    }
    detected = picked.ip
    adapter = picked.adapter
  }
  runContext.detected = detected
  runContext.adapter = adapter
  runContext.registered = state?.ip || null

  const config = loadConfig()
  for (const ip of config.ignoreIps || []) ignoredIps.add(ip.trim())
  const reposRoot = resolveReposRoot(config)
  const scanRoots = resolveScanRoots(config, reposRoot)

  const profile = profileForIp(detected)
  if (!profile) {
    const msg =
      `IP detectado (${detected}) nao e rede empresa (10.10.0.x) nem casa (172.24.x / 10.20.x / 192.168.x).`
    if (args.json || args.checkOnly) {
      console.log(
        JSON.stringify({
          ...buildCheckPayload({
            detected,
            registered: state?.ip || null,
            adapter,
            match: false,
            profile: null,
          }),
          error: msg,
        })
      )
    } else {
      console.error(`Erro: ${msg}`)
    }
    process.exit(1)
  }

  const registered = state?.ip || null
  const firstRun = !state
  const match = isFullySynced(reposRoot, scanRoots, config.userKey, detected, profile, state)

  if (args.checkOnly) {
    const payload = buildCheckPayload({ detected, registered, adapter, match, profile, needsFirstRun: firstRun })
    if (args.json) {
      console.log(JSON.stringify(payload))
    } else {
      console.log(
        `detectado=${detected} perfil=${profile.id} cadastrado=${registered || '(nenhum)'} match=${match} adapter=${adapter}`
      )
    }
    process.exit(0)
  }

  if (match && !args.dryRun) {
    const msg = `IP sincronizado (${detected}, ${profile.label}) — nada a fazer.`
    if (args.json) {
      console.log(
        JSON.stringify({
          ...buildCheckPayload({ detected, registered, adapter, match: true, profile }),
          synced: false,
          skipped: true,
          message: msg,
        })
      )
    } else {
      console.log(msg)
    }
    process.exit(0)
  }

  // Primeiro uso (sem .last-ip.json): a troca nos .env e ampla, entao uma pessoa revisa antes de gravar.
  const action = firstRunAction({
    firstRun,
    yes: args.yes,
    dryRun: args.dryRun,
    checkOnly: args.checkOnly,
    json: args.json,
    interactive: Boolean(process.stdin.isTTY && process.stdout.isTTY),
  })
  if (action === 'skip') {
    if (args.json) {
      console.log(
        JSON.stringify({
          ...buildCheckPayload({ detected, registered, adapter, match: false, profile, needsFirstRun: true }),
          synced: false,
          skipped: true,
          message: FIRST_RUN_MESSAGE,
        })
      )
      process.exit(0)
    }
    console.error(
      'Erro: primeiro uso nesta maquina. A troca nos .env e ampla e precisa de aprovacao. ' +
        'Rode em um terminal interativo (mostra o resumo e pergunta) ou use --yes.'
    )
    process.exit(1)
  }

  const applySync = (dryRun) => {
    const oldIpList = buildOldIpList(state, reposRoot, scanRoots, config.userKey, detected, profile)

    if (!args.json) {
      console.log(`IP detectado: ${detected} (${adapter}, rede ${profile.label})`)
      console.log(`reposRoot (ips/Serveruler): ${reposRoot}`)
      console.log(`scanRoots (.env / _localVars): ${scanRoots.join('; ')}`)
      if (oldIpList.length) {
        console.log(`Substituindo: ${oldIpList.join(', ')} -> ${detected}`)
      } else {
        console.log('Nenhum IP anterior conhecido — atualizando tables/Serveruler pelo userKey.')
      }
    }

    const quiet = Boolean(args.json)
    const { envFiles, localVarsFiles } = discoverTargetFiles(scanRoots, args.verbose)

    let fileUpdates = 0
    let replacementCount = 0

    if (!quiet) console.log('\n.env / .env.local (auto):')
    for (const filePath of envFiles.sort()) {
      const rel = labelForScanRootFile(filePath, scanRoots)
      const result = updateFileWithIpReplace(
        filePath,
        oldIpList,
        detected,
        dryRun,
        args.verbose,
        rel,
        quiet
      )
      if (result.updated) fileUpdates += 1
      replacementCount += result.replacements
    }

    if (!quiet) console.log('\n_localVars.ts (auto):')
    for (const filePath of localVarsFiles.sort()) {
      const rel = labelForScanRootFile(filePath, scanRoots)
      const result = updateFileWithIpReplace(
        filePath,
        oldIpList,
        detected,
        dryRun,
        args.verbose,
        rel,
        quiet
      )
      if (result.updated) fileUpdates += 1
      replacementCount += result.replacements
    }

    if (!quiet) console.log('\nServeruler / ips:')
    updateIpsTable(
      join(reposRoot, 'ips', 'table.ts'),
      config.userKey,
      profile.tableField,
      detected,
      dryRun,
      quiet
    )
    const redirectPaths = [
      join(reposRoot, 'serveruler-redirect', 'index.html'),
      resolve(__dirname, '../serveruler-redirect/index.html'),
    ]
    for (const redirectPath of redirectPaths) {
      updateServerulerRedirect(redirectPath, detected, profile.redirectConst, dryRun, quiet)
    }
    updateServerulerDataJson(
      join(reposRoot, 'serveruler-client', 'public', 'data.json'),
      config.userKey,
      profile.tableField,
      detected,
      dryRun,
      quiet
    )

    if (!dryRun) {
      const previousIps = [
        ...(registered && registered !== detected ? [registered] : []),
        ...oldIpList.filter((ip) => ip !== registered),
      ].filter((ip, i, arr) => arr.indexOf(ip) === i)

      saveState({ ip: detected, profile: profile.id, previousIps, adapter })
    }

    if (args.json) {
      console.log(
        JSON.stringify({
          ...buildCheckPayload({ detected, registered, adapter, match: false, profile }),
          synced: !dryRun,
          dryRun: dryRun,
          fileUpdates,
          replacementCount,
        })
      )
    } else {
      console.log(
        `\nConcluido: ${fileUpdates} arquivo(s) alterado(s), ${replacementCount} substituicao(oes) de IP.`
      )
      if (dryRun) console.log('(dry-run — nenhum arquivo gravado)')
    }
  }

  if (action === 'prompt') {
    console.log('Primeiro uso nesta maquina: revise o que sera trocado antes de gravar.\n')
    applySync(true)
    if (!askYesNo('\nAplicar estas mudancas? [s/N] ')) {
      console.log('Nada foi gravado. Ajuste scanRoots / ignoreIps no config.json e rode de novo.')
      process.exit(0)
    }
    console.log('')
  }
  applySync(args.dryRun)
}

/** Preenchido por main() para o catch conseguir responder em JSON. */
const runContext = { json: false, detected: null, adapter: null, registered: null }

try {
  main()
} catch (error) {
  if (runContext.json) {
    // A tag le so o stdout: sem JSON aqui ela mostraria "sem IP" sem motivo.
    console.log(
      JSON.stringify({
        ...buildCheckPayload({
          detected: runContext.detected,
          registered: runContext.registered,
          adapter: runContext.adapter,
          match: false,
        }),
        ok: false,
        error: error.message,
      })
    )
  } else {
    console.error(`Erro: ${error.message}`)
  }
  process.exit(1)
}
