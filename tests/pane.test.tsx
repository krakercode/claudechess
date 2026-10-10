import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

import { PUZZLES } from '../hooks/puzzles.ts'

const PLUGIN = 'chess-puzzles'
const PANE = {
  plugin: PLUGIN,
  component: 'Pane',
  requestId: 'chess-puzzles',
  props: {
    title: 'Chess puzzle',
    isFocused: true,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

test('each surface solves a puzzle by pressing squares', async ($, on) => {
  mock.store(on)
  for (const [index, surface] of (['terminal', 'desktop', 'vscode', 'mobile'] as const).entries()) {
    const puzzle = PUZZLES[index]!
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ text: new RegExp(`#${index + 1} ${puzzle.title}`) })).toBeDefined()
    for (let ply = 0; ply < puzzle.moves.length; ply += 2) {
      const move = puzzle.moves[ply]!
      await ui.press({ key: move.slice(0, 2) })
      await ui.press({ key: move.slice(2, 4) })
    }
    expect(await ui.find({ text: /solved!/ })).toBeDefined()
    await ui.press({ key: 'next' })
    await ui.unmount()
  }
})

test('a typed move is checked against the solution', async ($, on) => {
  mock.store(on)
  const puzzle = PUZZLES[0]!
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.input({ key: 'move', text: 'a1a1' })
  expect(await ui.find({ text: /is not it/ })).toBeDefined()
  await ui.input({ key: 'move', text: puzzle.san[0]!.replace(/[+#]/g, '') })
  expect(await ui.find({ text: puzzle.moves.length === 1 ? /solved!/ : /good/ })).toBeDefined()
  await ui.unmount()
})

test('hint names the piece, and the solution can be shown', async ($, on) => {
  mock.store(on)
  const puzzle = PUZZLES[0]!
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'hint' })
  expect(await ui.find({ text: new RegExp(`on ${puzzle.moves[0]!.slice(0, 2)}`) })).toBeDefined()
  await ui.press({ key: 'reveal' })
  expect(await ui.find({ text: /Solution:/ })).toBeDefined()
  expect(await ui.find({ key: 'next' })).toBeDefined()
  await ui.unmount()
})

const watchOpens = (on: On) => {
  const opened: string[] = []
  on('ui.panes', () => ({ value: [] }))
  on('ui.open', ($, e) => {
    opened.push(e.id)
    return { value: { isPlaced: true } }
  })
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  return opened
}

test('a turn opens the pane', async ($, on) => {
  mock.store(on)
  const opened = watchOpens(on)
  await $.turn.start({ text: 'fix the bug', turnId: 't1' })
  expect(opened).toEqual(['chess-puzzles'])
})

test('a turn leaves the pane shut after /chess off', async ($, on) => {
  mock.store(on, { autoOpen: false })
  const opened = watchOpens(on)
  await $.turn.start({ text: 'fix the bug', turnId: 't1' })
  expect(opened).toEqual([])
})
