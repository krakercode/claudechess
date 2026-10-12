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

test('the level button deals puzzles of that level', async ($, on) => {
  mock.store(on)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ text: /Level: Mixed/ })).toBeDefined()
  expect(await ui.find({ text: /^From / })).toBeDefined()
  for (const name of ['Easy', 'Medium', 'Hard']) {
    await ui.press({ key: 'level' })
    expect(await ui.find({ text: new RegExp(`Level: ${name}`) })).toBeDefined()
    expect(await ui.find({ text: new RegExp(` · ${name} · `) })).toBeDefined()
    await ui.press({ key: 'skip' })
    expect(await ui.find({ text: new RegExp(` · ${name} · `) })).toBeDefined()
  }
  await ui.unmount()
})

const solveByPressing = async (ui: { press: (target: { key: string }) => Promise<unknown> }, moves: string[]) => {
  for (let ply = 0; ply < moves.length; ply += 2) {
    await ui.press({ key: moves[ply]!.slice(0, 2) })
    await ui.press({ key: moves[ply]!.slice(2, 4) })
  }
}

test('a missed puzzle comes back for review, and a clean solve clears it', async ($, on) => {
  mock.store(on)
  const puzzle = PUZZLES[0]!
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.input({ key: 'move', text: 'a1a1' })
  await solveByPressing(ui, puzzle.moves)
  expect(await ui.find({ text: /1 to review/ })).toBeDefined()

  await ui.press({ key: 'next' })
  expect(await ui.find({ text: /#2 / })).toBeDefined()
  await ui.press({ key: 'skip' })
  expect(await ui.find({ text: /#3 / })).toBeDefined()
  await ui.press({ key: 'skip' })
  expect(await ui.find({ text: /#1 / })).toBeDefined()
  expect(await ui.find({ text: / · review · / })).toBeDefined()
  expect(await ui.find({ text: /Another try/ })).toBeDefined()

  await solveByPressing(ui, puzzle.moves)
  expect(await ui.find({ text: /to review/ })).toBeUndefined()
  await ui.press({ key: 'next' })
  expect(await ui.find({ text: /#4 / })).toBeDefined()
  await ui.unmount()
})

test('showing the solution queues the puzzle for review', async ($, on) => {
  mock.store(on)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'reveal' })
  expect(await ui.find({ text: /1 to review/ })).toBeDefined()
  await ui.unmount()
})
