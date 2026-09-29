/**
 * Perfis de rede AGX (ips/table.ts + redirect Serveruler).
 */

export const PROFILES = {
  company: {
    id: 'company',
    label: 'empresa',
    tableField: 'empresa',
    redirectConst: 'COMPANY_IP_ADDRESS',
    /** @param {string} ip */
    matchesIp(ip) {
      return ip.startsWith('10.10.0.')
    },
    staleIpPattern: /\b(10\.10\.0\.\d{1,3})\b/g,
  },
  home: {
    id: 'home',
    label: 'casa',
    tableField: 'casa',
    redirectConst: 'HOME_IP_ADDRESS',
    /** @param {string} ip */
    matchesIp(ip) {
      return ip.startsWith('172.24.') || ip.startsWith('10.20.') || ip.startsWith('192.168.')
    },
    /**
     * So ZeroTier. 192.168.x fica fora de proposito: varrer os .env por ele trocaria o
     * vEthernet do Hyper-V, IPs de Docker e aparelhos da LAN. Um 192.168 antigo ainda e
     * substituido quando e conhecido (.last-ip.json, campo casa da tabela, data.json).
     */
    staleIpPattern: /\b(172\.24\.\d{1,3}\.\d{1,3}|10\.20\.\d{1,3}\.\d{1,3})\b/g,
  },
}

/**
 * @param {string} ip
 * @returns {import('./network-profile.mjs').PROFILES.company | import('./network-profile.mjs').PROFILES.home | null}
 */
export function profileForIp(ip) {
  if (!ip || !/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return null
  if (PROFILES.company.matchesIp(ip)) return PROFILES.company
  if (PROFILES.home.matchesIp(ip)) return PROFILES.home
  return null
}

/**
 * @param {string} ip
 * @param {{ id: string }} profile
 */
export function ipMatchesProfile(ip, profile) {
  if (!ip || !profile) return false
  if (profile.id === 'company') return PROFILES.company.matchesIp(ip)
  if (profile.id === 'home') return PROFILES.home.matchesIp(ip)
  return false
}
