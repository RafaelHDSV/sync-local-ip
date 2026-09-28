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

  it('rejeita IP fora dos perfis AGX', () => {
    assert.equal(profileForIp('192.168.1.10'), null)
  })
})

describe('ipMatchesProfile', () => {
  it('nao mistura prefixos', () => {
    assert.equal(ipMatchesProfile('10.10.0.1', PROFILES.home), false)
    assert.equal(ipMatchesProfile('172.24.0.1', PROFILES.company), false)
  })
})
