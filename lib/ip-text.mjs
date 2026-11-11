/**
 * Troca e busca de IPv4 em texto, sempre pelo endereco INTEIRO.
 *
 * Sem fronteira, `10.10.0.18` casava dentro de `10.10.0.188` e o .env ficava com `10.10.0.1888`;
 * e o IP novo, recem-gravado, podia ser trocado de novo por outro IP antigo da lista.
 *
 * Fronteira: o IP nao pode vir colado em outro digito (`1192.168.0.5`) nem ser o final de um
 * endereco maior (`7.192.168.0.5`), e nao pode ser seguido de digito (`10.10.0.55`) nem de
 * `.digito` (`10.10.0.5.1`). Ponto final de frase, `:porta`, `/` e aspas continuam valendo.
 */

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Um unico padrao com todos os IPs: a troca e em passada unica, entao o texto ja trocado nunca
 * e lido de novo. Os mais longos primeiro, por clareza (com a fronteira a ordem nao muda o resultado).
 *
 * @param {string[]} ips
 * @returns {RegExp | null}
 */
function buildPattern(ips) {
  const list = [...new Set(ips.filter(Boolean))].sort((a, b) => b.length - a.length)
  if (!list.length) return null
  return new RegExp(`(?<!\\d)(?<!\\d\\.)(?:${list.map(escapeRegExp).join('|')})(?!\\d)(?!\\.\\d)`, 'g')
}

/**
 * @param {string} text
 * @param {string[]} ips
 * @returns {boolean}
 */
export function containsAnyIp(text, ips) {
  const pattern = buildPattern(ips)
  return pattern ? pattern.test(text) : false
}

/**
 * @param {string} text
 * @param {string[]} oldIps
 * @param {string} newIp
 * @returns {{ text: string, replacements: number }}
 */
export function replaceIps(text, oldIps, newIp) {
  const pattern = buildPattern(oldIps.filter((ip) => ip !== newIp))
  if (!pattern) return { text, replacements: 0 }
  let replacements = 0
  const result = text.replace(pattern, () => {
    replacements += 1
    return newIp
  })
  return { text: result, replacements }
}
