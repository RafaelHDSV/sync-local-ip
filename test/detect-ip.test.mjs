import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { pickPrimaryIpv4, parseIpconfigAdapters } from '../lib/detect-ip.mjs'

const SAMPLE = `
Windows IP Configuration

Ethernet adapter Ethernet:

   Media State . . . . . . . . . . . : Media disconnected

Wireless LAN adapter Wi-Fi:

   Connection-specific DNS Suffix  . :
   IPv4 Address. . . . . . . . . . . : 10.10.0.66
   Subnet Mask . . . . . . . . . . . : 255.255.255.0
   Default Gateway . . . . . . . . . : 10.10.0.1

Ethernet adapter vEthernet (WSL):

   Connection-specific DNS Suffix  . :
   IPv4 Address. . . . . . . . . . . : 172.28.16.1
   Subnet Mask . . . . . . . . . . . : 255.255.240.0

Ethernet adapter VirtualBox Host-Only Network:

   IPv4 Address. . . . . . . . . . . : 192.168.56.1
`

const SAMPLE_PT = `
Configuração de IP do Windows

Adaptador Ethernet Ethernet 3:

   Endereço IPv4. . . . . . . . . . . . . . . . . : 26.26.26.62
   Gateway Padrão. . . . . . . . . . . . . . . . . : 26.0.0.1

Adaptador Ethernet Ethernet:

   Endereço IPv4. . . . . . . . . . . . . . . . . : 10.10.0.47
   Gateway Padrão. . . . . . . . . . . . . . . . . : 10.10.0.1

Adaptador de LAN sem fio Wi-Fi:

   Endereço IPv4. . . . . . . . . . . . . . . . . : 10.10.0.42
   Gateway Padrão. . . . . . . . . . . . . . . . . : 10.10.0.1
`

describe('parseIpconfigAdapters', () => {
  it('pairs adapter names with ipv4 addresses', () => {
    const list = parseIpconfigAdapters(SAMPLE)
    assert.ok(list.some((a) => a.name === 'Wi-Fi' && a.ip === '10.10.0.66'))
    assert.ok(list.some((a) => a.name.includes('WSL') && a.ip === '172.28.16.1'))
  })

  it('parses Portuguese adapter headers with full names', () => {
    const list = parseIpconfigAdapters(SAMPLE_PT)
    assert.ok(list.some((a) => a.name === 'Ethernet Ethernet 3' && a.ip === '26.26.26.62'))
    assert.ok(list.some((a) => a.name === 'Ethernet Ethernet' && a.ip === '10.10.0.47'))
    assert.ok(list.some((a) => a.name.includes('Wi-Fi') && a.ip === '10.10.0.42'))
  })
})

describe('pickPrimaryIpv4', () => {
  it('prefers Wi-Fi over WSL and VirtualBox', () => {
    const picked = pickPrimaryIpv4(SAMPLE)
    assert.equal(picked.ip, '10.10.0.66')
    assert.equal(picked.adapter, 'Wi-Fi')
  })

  it('skips link-local 169.254', () => {
    const text = `
Ethernet adapter Ethernet:

   IPv4 Address. . . . . . . . . . . : 169.254.1.1

Wireless LAN adapter Wi-Fi:

   IPv4 Address. . . . . . . . . . . : 10.10.0.70
   Default Gateway . . . . . . . . . : 10.10.0.1
`
    assert.equal(pickPrimaryIpv4(text).ip, '10.10.0.70')
  })

  it('returns null when only virtual adapters', () => {
    const text = `
Ethernet adapter vEthernet (WSL):

   IPv4 Address. . . . . . . . . . . : 172.28.16.1
`
    assert.equal(pickPrimaryIpv4(text), null)
  })

  it('falls back to non-preferred physical adapter', () => {
    const text = `
Ethernet adapter Ethernet 2:

   IPv4 Address. . . . . . . . . . . : 192.168.1.50
`
    const picked = pickPrimaryIpv4(text)
    assert.equal(picked.ip, '192.168.1.50')
  })

  it('prefers Ethernet empresa over Wi-Fi stale on PT-BR ipconfig', () => {
    const picked = pickPrimaryIpv4(SAMPLE_PT)
    assert.equal(picked.ip, '10.10.0.47')
    assert.equal(picked.adapter, 'Ethernet Ethernet')
  })
})
