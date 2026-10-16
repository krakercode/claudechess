// Claude Chess: a pane of chess to fill the time while Claude works. Rated
// Lichess puzzles near your rating, theme drills, master-game puzzles,
// famous games to replay or guess, and play from any position against a
// Stockfish of your own.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { openGame } from './games.ts'
import { FAMOUS } from './famous.ts'
import { current, nextPuzzle, ratingText } from './play.ts'
import { findDrill } from './themes.ts'
import { DIFFICULTY_NAMES, INITIAL, KEY, isDifficulty, loadStored } from './state.ts'
import type { Difficulty } from '../types'
import { drawPane, drillName, setDifficulty, setDrill } from './views.tsx'

const drill = atom({ plugin: 'chess-puzzles', key: 'drill' } as const, INITIAL.drill)
const isWorking = atom({ plugin: 'chess-puzzles', key: 'isWorking' } as const, INITIAL.isWorking)
const rating = atom({ plugin: 'chess-puzzles', key: 'rating' } as const, INITIAL.rating)
const settings = atom({ plugin: 'chess-puzzles', key: 'settings' } as const, INITIAL.settings)
const view = atom({ plugin: 'chess-puzzles', key: 'view' } as const, INITIAL.view)

const PANE = 'chess-puzzles'
const openPane = ($: EngineInterface) => $.ui.open({ id: PANE, title: 'Claude Chess' })

/** The old level names still work: easy, medium and hard map onto the new difficulties. */
const LEVEL_ALIASES: Record<string, Difficulty> = { easy: 'easier', medium: 'normal', hard: 'harder', mixed: 'normal' }

const HELP = [
  '/chess opens the pane; /chess next deals a fresh puzzle.',
  '/chess easiest, easier, normal, harder or hardest sets how far from your rating puzzles are dealt.',
  '/chess theme <name> drills one theme (fork, pin, mate in 2, ...); /chess theme any goes back to all of them; /chess masters deals the master-game puzzles.',
  '/chess famous [game] opens the famous games; /chess stats your rating and themes.',
  '/chess letters or /chess symbols picks how pieces are drawn.',
  '/chess engine [command or path] says which Stockfish to run for "Play from here".',
  '/chess off stops the pane opening by itself while Claude works; /chess on turns that back on.',
].join('\n')

const answerCommand = async ($: EngineInterface, args: string): Promise<{ text: string; open?: boolean }> => {
  const [word = '', ...rest] = args.trim().split(/\s+/)
  const arg = word.toLowerCase()
  const tail = rest.join(' ').trim()

  if (arg === 'help') return { text: HELP }
  if (arg === 'off') {
    await $.store.set(KEY.autoOpen, false)
    return { text: 'The chess pane will no longer open by itself while Claude works. /chess still opens it.' }
  }
  if (arg === 'on') {
    await $.store.set(KEY.autoOpen, true)
    return { text: 'The chess pane will open whenever Claude starts working.' }
  }
  if (arg === 'letters' || arg === 'symbols') {
    const pieces: 'letters' | 'symbols' = arg
    await update($, settings, value => ({ ...value, pieces }))
    await $.store.set(KEY.settings, await read($, settings))
    return { text: `Pieces are drawn as ${arg}.`, open: true }
  }
  if (arg === 'engine') {
    if (tail) {
      await update($, settings, value => ({ ...value, engine: tail }))
      await $.store.set(KEY.settings, await read($, settings))
      return { text: `"Play from here" will run ${tail}.` }
    }
    return { text: `"Play from here" runs ${(await read($, settings)).engine}. Give /chess engine a command or a path to change it.` }
  }
  if (arg === 'next') {
    await nextPuzzle($)
    await update($, view, () => 'puzzle')
    return { text: 'A fresh puzzle is on the board.', open: true }
  }
  const level = isDifficulty(arg) ? arg : LEVEL_ALIASES[arg]
  if (level) {
    await setDifficulty($, level)
    await nextPuzzle($)
    await update($, view, () => 'puzzle')
    return { text: `Difficulty: ${DIFFICULTY_NAMES[level]}.`, open: true }
  }
  if (arg === 'masters') {
    await setDrill($, { kind: 'masters' })
    return { text: 'Dealing the master-game puzzles, unrated.', open: true }
  }
  if (arg === 'theme' || arg === 'themes') {
    if (!tail) {
      await update($, view, () => 'themes')
      return { text: `Drilling: ${drillName(await read($, drill))}. Pick a theme in the pane.`, open: true }
    }
    if (tail.toLowerCase() === 'any') {
      await setDrill($, { kind: 'any' })
      return { text: 'Dealing rated puzzles of any theme.', open: true }
    }
    const found = findDrill(tail)
    if (!found) return { text: `There's no theme called "${tail}". /chess theme with no name lists them in the pane.` }
    await setDrill($, { kind: 'theme', theme: found.theme })
    return { text: `Drilling ${found.name}.`, open: true }
  }
  if (arg === 'famous' || arg === 'games') {
    if (tail) {
      const wanted = tail.toLowerCase()
      const match = FAMOUS.find(famous => [famous.id, famous.name, `${famous.white} ${famous.black}`].some(text => text.toLowerCase().includes(wanted)))
      if (!match) return { text: `No famous game matches "${tail}".`, open: true }
      await openGame($, match.id)
      return { text: `${match.name}: ${match.white} vs ${match.black}, ${match.year}.`, open: true }
    }
    await update($, view, () => 'famous')
    return { text: 'Famous games are open in the pane.', open: true }
  }
  if (arg === 'stats' || arg === 'rating') {
    await update($, view, () => 'stats')
    return { text: `Your puzzle rating is ${ratingText(await read($, rating))}.`, open: true }
  }
  if (arg === '') return { text: '', open: true }
  return { text: `/chess doesn't know "${word}".\n${HELP}` }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'chess',
      description: 'Open the Claude Chess pane; "/chess help" lists what else it takes',
      argumentHint: '[next|easier|harder|theme <name>|masters|famous|stats|on|off|help]',
    })
    await loadStored($)
    await current($)

    return next(e)
  })

  on('command.run', { command: 'chess' }, async ($, e) => {
    const answer = await answerCommand($, e.args)
    if (!answer.open) return { text: answer.text }
    await current($)
    const opened = await openPane($)
    const status = opened.isPlaced ? '' : ' The pane is waiting for room to open.'
    return { text: (answer.text || 'Claude Chess is open.') + status }
  })

  on('turn.start', async ($, e, next) => {
    await update($, isWorking, () => true)
    if ((await $.store.get(KEY.autoOpen)) !== false) {
      const isOpen = (await $.ui.panes()).some(pane => pane.id === PANE)
      if (!isOpen) {
        await current($)
        void openPane($)
      }
    }

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) await update($, isWorking, () => false)

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: 'chess-puzzles' }, async ($, e) => {
    const table = $.ui.resolve(e)
    return drawPane($, table, 'Input' in table)
  })
}

