import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { profileForIp, ipMatchesProfile, PROFILES } from '../lib/network-profile.mjs'

describe('profileForIp', () => {
  it('classifica empresa 10.10.0.x', () => {
    assert.equal(profileForIp('10.10.0.47')?.id, 'company')
  })

  it('classifica casa 172.24.x', () => {
    assert.equal(profileForIp('172.24.0.189')?.id, 'home')
  })

  it('classifica casa 10.20.x (excecao ana)', () => {
    assert.equal(profileForIp('10.20.0.244')?.id, 'home')
  })

  it('classifica casa 192.168.x (LAN domestica)', () => {
    assert.equal(profileForIp('192.168.0.31')?.id, 'home')
  })

  it('rejeita IP fora dos perfis AGX', () => {
    assert.equal(profileForIp('26.246.161.213'), null)
    assert.equal(profileForIp('8.8.8.8'), null)
  })
})

describe('staleIpPattern', () => {
  it('casa nao varre 192.168.x nos .env (Hyper-V, Docker, LAN)', () => {
    const text = 'A=192.168.96.1 B=192.168.0.10 C=172.24.0.5'
    const found = [...text.matchAll(PROFILES.home.staleIpPattern)].map((m) => m[1])
    assert.deepEqual(found, ['172.24.0.5'])
  })
})

describe('ipMatchesProfile', () => {
  it('nao mistura prefixos', () => {
    assert.equal(ipMatchesProfile('10.10.0.1', PROFILES.home), false)
    assert.equal(ipMatchesProfile('172.24.0.1', PROFILES.company), false)
  })
})
