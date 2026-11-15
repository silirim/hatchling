// @ts-check
import test from 'node:test'
import assert from 'node:assert/strict'
import { cols, pad, wrap } from './width.js'

test('width on screen: a letter is one column, a Chinese character or its punctuation two, a combining mark none', () => {
  assert.equal(cols('short chat'), 10)
  assert.equal(cols('对话不长'), 8)
  assert.equal(cols('对话不长，轻装上路。'), 20) // the full-width comma and stop count two as well
  assert.equal(cols('lean 已开'), 9)
  assert.equal(cols('añadió ¿qué?'), 12)
  assert.equal(cols('é'), 1) // e and a combining accent
  assert.equal(cols('a​b'), 2) // a zero-width space
  assert.equal(cols('★ ♥ ·'), 5)
  assert.equal(cols(''), 0)
  assert.equal(pad('墨镜', 8), '墨镜    ')
  assert.equal(cols(pad('sunglasses', 14)), 14)
  assert.equal(pad('toolong', 3), 'toolong')
})

test('the bubble wraps by columns: words break at spaces, Chinese between characters, and no line is over the limit', () => {
  assert.deepEqual(wrap('A note only. Fix asks the agent to use what it has.', 44), ['A note only. Fix asks the agent to use what', 'it has.'])
  assert.deepEqual(wrap('re-read, unchanged: a.txt', 44), ['re-read, unchanged: a.txt'])
  assert.deepEqual(wrap('', 44), [''])
  // 30 Chinese characters are 60 columns: two lines, the first of 22 characters, where 30 letters would be one
  const zh = '好'.repeat(30)
  assert.deepEqual(wrap(zh, 44), ['好'.repeat(22), '好'.repeat(8)])
  assert.deepEqual(wrap('a'.repeat(30), 44), ['a'.repeat(30)])
  // an odd column left over is not filled with half a character
  assert.deepEqual(wrap('a' + '好'.repeat(22), 44).map(cols), [43, 2])
  // a closing mark never starts a line: it goes down with the character before it
  const full = '好'.repeat(22) + '。' + '好'
  assert.deepEqual(wrap(full, 44), ['好'.repeat(21), '好。好'])
  // Latin words inside Chinese stay whole, and the space before one is kept
  assert.deepEqual(wrap('对话很长，lean 没开：每次请求重读 120k token', 44), ['对话很长，lean 没开：每次请求重读 120k token']) // 44 columns exactly
  assert.deepEqual(wrap('对话很长，lean 没开：每次请求重读 120k token', 40), ['对话很长，lean 没开：每次请求重读 120k', 'token'])
  assert.deepEqual(wrap('对话很长，lean 没开', 12), ['对话很长，', 'lean 没开'])
  // a word wider than the line is cut by columns
  assert.deepEqual(wrap('x'.repeat(50), 44), ['x'.repeat(44), 'x'.repeat(6)])
  for (const text of [zh, full, '只是提醒。在两次对话之间改 CLAUDE.md、工具或 MCP 就能避免。', 'Una nota: cambiar CLAUDE.md, herramientas o MCP entre chats lo evita.']) {
    const lines = wrap(text, 44)
    for (const line of lines) assert.ok(cols(line) <= 44 && line === line.trim() && line, line)
    assert.equal(lines.join('').replace(/ /g, ''), text.replace(/ /g, '')) // nothing lost but the spaces at a break
  }
})
