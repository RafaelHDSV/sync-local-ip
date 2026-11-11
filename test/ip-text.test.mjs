import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { containsAnyIp, replaceIps } from '../lib/ip-text.mjs'

describe('replaceIps', () => {
  it('troca o IP inteiro e conta as trocas', () => {
    const result = replaceIps('A=10.10.0.5 B=10.10.0.5', ['10.10.0.5'], '10.10.0.70')
    assert.deepEqual(result, { text: 'A=10.10.0.70 B=10.10.0.70', replacements: 2 })
  })

  it('IP antigo que e prefixo do novo nao corrompe o resultado (10.10.0.18 x 10.10.0.188)', () => {
    const result = replaceIps('API=10.10.0.155', ['10.10.0.155', '10.10.0.18'], '10.10.0.188')
    assert.equal(result.text, 'API=10.10.0.188')
    assert.equal(result.replacements, 1)
  })

  it('nao troca um IP que apenas comeca com o antigo (10.10.0.5 dentro de 10.10.0.55)', () => {
    const result = replaceIps('A=10.10.0.5 B=10.10.0.55', ['10.10.0.5'], '10.10.0.70')
    assert.equal(result.text, 'A=10.10.0.70 B=10.10.0.55')
  })

  it('nao troca um IP que termina com o antigo (192.168.0.5 dentro de 1192.168.0.5)', () => {
    const result = replaceIps('X=1192.168.0.5', ['192.168.0.5'], '10.10.0.70')
    assert.equal(result.text, 'X=1192.168.0.5')
    assert.equal(result.replacements, 0)
  })

  it('nao troca um IP que e o final de um endereco maior (7.192.168.0.5)', () => {
    const result = replaceIps('Z=7.192.168.0.5', ['192.168.0.5'], '10.10.0.70')
    assert.equal(result.text, 'Z=7.192.168.0.5')
  })

  it('troca o IP seguido de ponto final de frase, porta ou barra', () => {
    const text = '# servidor em 10.10.0.5. Use http://10.10.0.5:3693/ e 10.10.0.5/api'
    const result = replaceIps(text, ['10.10.0.5'], '10.10.0.70')
    assert.equal(result.text, '# servidor em 10.10.0.70. Use http://10.10.0.70:3693/ e 10.10.0.70/api')
    assert.equal(result.replacements, 3)
  })

  it('troca em passada unica: o texto novo nao e trocado de novo por outro IP antigo', () => {
    const result = replaceIps('A=10.10.0.5', ['10.10.0.5', '10.10.0.70'], '10.10.0.70')
    assert.equal(result.text, 'A=10.10.0.70')
  })

  it('ignora o proprio IP novo na lista e lista vazia', () => {
    assert.equal(replaceIps('A=10.10.0.70', ['10.10.0.70'], '10.10.0.70').replacements, 0)
    assert.deepEqual(replaceIps('A=10.10.0.5', [], '10.10.0.70'), { text: 'A=10.10.0.5', replacements: 0 })
  })

  it('trata o ponto do IP como ponto, nao como curinga', () => {
    const result = replaceIps('A=10x10x0x5', ['10.10.0.5'], '10.10.0.70')
    assert.equal(result.text, 'A=10x10x0x5')
  })
})

describe('containsAnyIp', () => {
  it('acha o IP inteiro', () => {
    assert.equal(containsAnyIp('A=10.10.0.5', ['10.10.0.5']), true)
  })

  it('nao acha quando o IP so aparece como prefixo de outro', () => {
    assert.equal(containsAnyIp('A=10.10.0.188', ['10.10.0.18']), false)
  })

  it('acha entre varios candidatos e aceita ponto final de frase', () => {
    assert.equal(containsAnyIp('veja 10.10.0.9.', ['10.10.0.1', '10.10.0.9']), true)
  })

  it('lista vazia nunca acha', () => {
    assert.equal(containsAnyIp('A=10.10.0.5', []), false)
  })
})
