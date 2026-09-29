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

// Casa, PT-BR: Radmin VPN aparece como "Ethernet 3" (sem "Radmin" no nome) e antes da LAN.
const SAMPLE_PT_HOME = `
Configuração de IP do Windows

Adaptador Ethernet vEthernet (Default Switch):

   Endereço IPv4. . . . . . . .  . . . . . . . : 192.168.96.1
   Máscara de Sub-rede . . . . . . . . . . . . : 255.255.240.0
   Gateway Padrão. . . . . . . . . . . . . . . :

Adaptador Ethernet Ethernet 3:

   Endereço IPv4. . . . . . . .  . . . . . . . : 26.246.161.213
   Máscara de Sub-rede . . . . . . . . . . . . : 255.0.0.0
   Gateway Padrão. . . . . . . . . . . . . . . : 26.0.0.1

Adaptador Ethernet Ethernet:

   Sufixo DNS específico de conexão. . . . . . : home
   Endereço IPv6 . . . . . . . . . . : 2804:14d:c091:90f2::1bfc
   Endereço IPv4. . . . . . . .  . . . . . . . : 192.168.0.31
   Máscara de Sub-rede . . . . . . . . . . . . : 255.255.255.0
   Gateway Padrão. . . . . . . . . . . . . . . : fe80::229a:7dff:feba:4543%13
                                                 192.168.0.1

Adaptador de túnel Teredo Tunneling Pseudo-Interface:

   Endereço IPv6 . . . . . . . . . . : 2001:0:14c9:cd04:2ca0:3679:4ebe:114d
   Gateway Padrão. . . . . . . . . . . . . . . :
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

  it('ignora Radmin VPN (26.x) listado antes da LAN de casa', () => {
    const picked = pickPrimaryIpv4(SAMPLE_PT_HOME)
    assert.equal(picked.ip, '192.168.0.31')
    assert.equal(picked.adapter, 'Ethernet Ethernet')
  })

  it('prefere ZeroTier casa (172.24.x) sobre a LAN 192.168.x', () => {
    const text = `${SAMPLE_PT_HOME}
Adaptador Ethernet ZeroTier One [8056c2e21c000001]:

   Endereço IPv4. . . . . . . .  . . . . . . . : 172.24.0.189
   Máscara de Sub-rede . . . . . . . . . . . . : 255.255.0.0
   Gateway Padrão. . . . . . . . . . . . . . . :
`
    assert.equal(pickPrimaryIpv4(text).ip, '172.24.0.189')
  })
})

describe('parseIpconfigAdapters gateway', () => {
  it('le o gateway IPv4 na linha de continuacao (IPv6 primeiro, PT-BR)', () => {
    const list = parseIpconfigAdapters(SAMPLE_PT_HOME)
    const lan = list.find((a) => a.ip === '192.168.0.31')
    assert.equal(lan.gateway, '192.168.0.1')
  })
})
