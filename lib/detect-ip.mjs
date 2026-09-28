/**
 * Parse Windows ipconfig text and pick a primary IPv4 for local sync.
 */

const SKIP_ADAPTER =
  /WSL|vEthernet|VirtualBox|Hyper-V|Loopback|VMware|Docker|Bluetooth|Local Area Connection\*|#/i
const SKIP_IP = /^(127\.|169\.254\.)/

/** Gateway tipico da rede empresa AGX (ZeroTier / LAN). */
const COMPANY_GATEWAY = '10.10.0.1'
const COMPANY_IP_PREFIX = '10.10.0.'
/** Gateway comum na rede casa (ZeroTier home). */
const HOME_GATEWAY = '172.24.0.1'

/**
 * @param {string} line
 * @returns {string | null}
 */
function parseAdapterHeaderLine(line) {
  const trimmed = line.trim()
  if (!trimmed.endsWith(':')) return null

  let match = trimmed.match(/^Ethernet adapter\s+(.+):\s*$/i)
  if (match) return match[1].trim()

  match = trimmed.match(/^Wireless LAN adapter\s+(.+):\s*$/i)
  if (match) return match[1].trim()

  match = trimmed.match(/^PPP adapter\s+(.+):\s*$/i)
  if (match) return match[1].trim()

  match = trimmed.match(/^Adaptador\s+(.+):\s*$/i)
  if (match) return match[1].trim()

  if (/adapter\s+.+\s*:\s*$/i.test(trimmed)) {
    match = trimmed.match(/adapter\s+(.+):\s*$/i)
    if (match) return match[1].trim()
  }

  return null
}

/**
 * @param {string} name
 */
function isSkippedAdapter(name) {
  return SKIP_ADAPTER.test(name)
}

/**
 * @param {string} name
 */
function isEthernetLike(name) {
  if (/sem fio|Wi-?Fi|Wireless/i.test(name)) return false
  return /\bEthernet\b/i.test(name) || /^Ethernet/i.test(name)
}

/**
 * @param {string} name
 */
function isWifiLike(name) {
  return /sem fio|Wi-?Fi|Wireless/i.test(name)
}

/**
 * @param {{ name: string, ip: string, gateway?: string | null, disconnected?: boolean }} adapter
 */
function scoreAdapter(adapter) {
  if (adapter.disconnected) return -1000
  if (!adapter.ip || SKIP_IP.test(adapter.ip) || isSkippedAdapter(adapter.name)) return -1000

  let score = 0
  if (adapter.gateway === COMPANY_GATEWAY) score += 100
  else if (adapter.gateway === HOME_GATEWAY) score += 100
  if (adapter.ip.startsWith(COMPANY_IP_PREFIX)) score += 30
  else if (adapter.ip.startsWith('172.24.') || adapter.ip.startsWith('10.20.')) score += 30
  if (isEthernetLike(adapter.name)) score += 50
  else if (isWifiLike(adapter.name)) score += 10
  else score += 5
  return score
}

/**
 * @param {string} text
 * @returns {{ name: string, ip: string, gateway: string | null, disconnected: boolean }[]}
 */
export function parseIpconfigAdapters(text) {
  const lines = String(text).split(/\r?\n/)
  /** @type {{ name: string, ip: string, gateway: string | null, disconnected: boolean }[]} */
  const result = []

  let currentName = null
  let currentGateway = null
  let currentDisconnected = false

  function pushIp(ip) {
    if (!currentName || !ip) return
    result.push({
      name: currentName,
      ip,
      gateway: currentGateway,
      disconnected: currentDisconnected,
    })
  }

  for (const raw of lines) {
    const line = raw.trimEnd()
    const headerName = parseAdapterHeaderLine(line)
    if (headerName) {
      currentName = headerName
      currentGateway = null
      currentDisconnected = false
      continue
    }

    if (!currentName) continue

    if (/Media State|Estado da m/i.test(line) && /disconnect|desconect/i.test(line)) {
      currentDisconnected = true
    }

    const gatewayMatch = line.match(/Gateway[^:]*:\s*(\d+\.\d+\.\d+\.\d+)/i)
    if (gatewayMatch) {
      currentGateway = gatewayMatch[1]
    }

    const ipMatch = line.match(/IPv4[^:]*:\s*(\d+\.\d+\.\d+\.\d+)/i)
    if (ipMatch) {
      pushIp(ipMatch[1])
    }
  }

  return result
}

/**
 * @param {string} ipconfigText
 * @returns {{ ip: string, adapter: string } | null}
 */
export function pickPrimaryIpv4(ipconfigText) {
  const adapters = parseIpconfigAdapters(ipconfigText)
  const scored = adapters
    .map((a) => ({ ...a, score: scoreAdapter(a) }))
    .filter((a) => a.score > 0)

  if (!scored.length) return null

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return 0
  })

  const best = scored[0]
  return { ip: best.ip, adapter: best.name }
}

export { COMPANY_GATEWAY, COMPANY_IP_PREFIX, HOME_GATEWAY }
