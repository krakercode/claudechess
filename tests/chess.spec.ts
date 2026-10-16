// Plain Node tests of the chess logic, the rating and every bundled game:
//   node --experimental-strip-types --test tests/*.spec.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { boardOf, fullFen, outcomeOf, play, playSan, resolveMove, sanLine, squareIndex, targetsOf, turnOf } from '../hooks/chess.ts'
import { FAMOUS } from '../hooks/famous.ts'
import { MASTERS } from '../hooks/masters.ts'
import { ROWS, countOf, pickNear, puzzleFor, themeCode } from '../hooks/pool.ts'
import { LICHESS_THEMES } from '../hooks/puzzles.ts'
import { START, isProvisional, rate } from '../hooks/rating.ts'
import { DRILLS, findDrill, ideasOf, themeName } from '../hooks/themes.ts'

const OPEN = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4'

test('a FEN without move counters is completed', () => {
  assert.equal(fullFen('8/8/8/8/8/8/8/K6k w - -'), '8/8/8/8/8/8/8/K6k w - - 0 1')
  assert.equal(fullFen(OPEN), OPEN)
})

test('typed moves resolve in SAN, loose SAN and UCI', () => {
  for (const typed of ['Qxf7#', 'Qf7', 'qxf7', 'h5f7', 'H5F7', 'h5-f7', 'Qh5xf7']) {
    assert.deepEqual(resolveMove(OPEN, typed), { uci: 'h5f7', san: 'Qxf7#' }, typed)
  }
  assert.equal(resolveMove(OPEN, 'Qf8'), null)
  assert.equal(resolveMove(OPEN, 'nonsense'), null)
  assert.equal(resolveMove(OPEN, ''), null)
})

test('a b-file pawn and a bishop are told apart', () => {
  const fen = 'k7/8/8/8/8/2p5/1P1B4/K7 w - - 0 1'
  assert.equal(resolveMove(fen, 'bxc3')?.uci, 'b2c3')
  assert.equal(resolveMove(fen, 'Bxc3')?.uci, 'd2c3')
})

test('promotions resolve however they are written', () => {
  const fen = '8/4P3/8/8/8/8/8/k6K w - - 0 1'
  for (const typed of ['e8=Q', 'e8Q', 'e8q', 'e7e8q', 'e8', 'e7e8=q']) assert.equal(resolveMove(fen, typed)?.uci, 'e7e8q', typed)
  assert.equal(resolveMove(fen, 'e8=N')?.uci, 'e7e8n')
})

test('castling resolves as O-O, 0-0 or the king move', () => {
  const fen = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'
  for (const typed of ['O-O', '0-0', 'e1g1', 'o-o']) assert.equal(resolveMove(fen, typed)?.san, 'O-O', typed)
  assert.equal(resolveMove(fen, 'O-O-O')?.uci, 'e1c1')
  const after = play(fen, 'e1c1')
  assert.equal(after.fen.split(' ')[0], 'r3k2r/8/8/8/8/8/8/2KR3R')
})

test('en passant takes the pawn beside', () => {
  const after = play('k7/8/8/3Pp3/8/8/8/K7 w - e6 0 1', 'd5e6')
  assert.equal(boardOf(after.fen)[squareIndex('e5')], null)
  assert.equal(after.san, 'dxe6')
})

test("a piece's targets are its legal moves", () => {
  assert.deepEqual(targetsOf(OPEN, 'h5').sort(), ['d1', 'e2', 'e5', 'f3', 'f5', 'f7', 'g4', 'g5', 'g6', 'h3', 'h4', 'h6', 'h7'])
  assert.deepEqual(targetsOf(OPEN, 'a7'), [])
})

test('outcomes: mate, stalemate, going on', () => {
  assert.equal(outcomeOf(play(OPEN, 'h5f7').fen).reason, 'checkmate')
  assert.equal(outcomeOf('k7/2Q5/1K6/8/8/8/8/8 b - - 0 1').reason, 'stalemate')
  assert.equal(outcomeOf(OPEN).isOver, false)
})

test('a win raises the rating and a loss lowers it, and the deviation shrinks', () => {
  const won = rate(START, 1500, 1)
  const lost = rate(START, 1500, 0)
  assert.ok(won.rating > 1500 && lost.rating < 1500)
  assert.ok(Math.abs(won.rating - 1500 - (1500 - lost.rating)) < 0.5)
  assert.ok(won.deviation < START.deviation)
  assert.ok(isProvisional(START))
  let settled = START
  for (let i = 0; i < 40; i++) settled = rate(settled, 1500, (i % 2) as 0 | 1)
  assert.ok(!isProvisional(settled))
  assert.ok(Math.abs(rate(settled, 1500, 1).rating - settled.rating) < 40)
})

test('beating a much stronger puzzle gains more than beating a weaker one', () => {
  const player = { rating: 1500, deviation: 80, volatility: 0.09 }
  assert.ok(rate(player, 1900, 1).rating - 1500 > rate(player, 1100, 1).rating - 1500)
})

test('the Lichess sample spreads from beginner to grandmaster, in rating order', () => {
  assert.ok(ROWS.length >= 6000)
  assert.ok(ROWS[0]!.rating < 500 && ROWS.at(-1)!.rating > 2900)
  for (let band = 500; band < 2900; band += 100) {
    assert.ok(ROWS.filter(row => row.rating >= band && row.rating < band + 100).length >= 150, `rating ${band}`)
  }
  for (let i = 1; i < ROWS.length; i++) assert.ok(ROWS[i - 1]!.rating <= ROWS[i]!.rating)
  assert.equal(new Set(ROWS.map(row => row.id)).size, ROWS.length)
})

test('every Lichess puzzle plays legally and ends on the solver\'s move', () => {
  for (const row of ROWS) {
    const label = `puzzle ${row.id}`
    assert.equal(row.moves.length % 2, 0, label)
    assert.ok(row.codes.every(code => LICHESS_THEMES[code] !== undefined), label)
    const puzzle = puzzleFor(`l:${row.id}`)!
    assert.equal(puzzle.moves.length % 2, 1, label)
    assert.equal(puzzle.san.length, puzzle.moves.length, label)
    assert.notEqual(turnOf(fullFen(row.fen)), turnOf(puzzle.fen), label)
    const end = puzzle.moves.reduce((fen, uci) => play(fen, uci).fen, puzzle.fen)
    if (puzzle.themes.includes('mate')) assert.equal(outcomeOf(end).reason, 'checkmate', label)
  }
})

test('every drill has at least 30 puzzles', () => {
  for (const drill of DRILLS) {
    assert.ok(themeCode(drill.theme) >= 0, drill.theme)
    assert.ok(countOf(drill.theme) >= 30, drill.theme)
  }
})

test('dealing picks near the target, keeps to the theme and skips what was seen', () => {
  let seed = 1
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const seen = new Set<string>()
  for (let i = 0; i < 30; i++) {
    const puzzle = pickNear(1500, undefined, seen, random)
    assert.ok(Math.abs(puzzle.rating! - 1500) < 100, `${puzzle.rating}`)
    assert.ok(!seen.has(puzzle.key))
    seen.add(puzzle.key)
  }
  const fork = pickNear(1200, 'fork', new Set(), random)
  assert.ok(fork.themes.includes('fork'))
  assert.ok(pickNear(9999, undefined, new Set(), random).rating! > 3000)
})

test('the master-game puzzles play through cleanly and end on the solver\'s move', () => {
  assert.ok(MASTERS.length >= 80)
  for (const [n, master] of MASTERS.entries()) {
    const label = `master ${n + 1}`
    assert.equal(master.moves.length % 2, 1, label)
    assert.deepEqual(sanLine(fullFen(master.fen), master.moves), master.san, label)
    const mateIn = master.title.match(/^Mate in (\d)$/)?.[1]
    if (mateIn) assert.equal(master.moves.length, Number(mateIn) * 2 - 1, label)
  }
})

test('every famous game replays to its result', () => {
  assert.equal(FAMOUS.length, 30)
  assert.equal(new Set(FAMOUS.map(game => game.id)).size, FAMOUS.length)
  for (const game of FAMOUS) {
    let fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    for (const san of game.moves.split(' ')) fen = playSan(fen, san).fen
    if (outcomeOf(fen).reason === 'checkmate') assert.equal(game.result, turnOf(fen) === 'b' ? '1-0' : '0-1', game.id)
    assert.ok(game.blurb.length > 40 && game.source.startsWith('https://'), game.id)
  }
  for (let i = 1; i < FAMOUS.length; i++) assert.ok(FAMOUS[i - 1]!.year <= FAMOUS[i]!.year)
})

test('themes read in plain words and can be looked up loosely', () => {
  assert.equal(themeName('discoveredAttack'), 'Discovered attack')
  assert.equal(findDrill('mate in 2')?.theme, 'mateIn2')
  assert.equal(findDrill('Back-rank mate')?.theme, 'backRankMate')
  assert.equal(findDrill('fork')?.name, 'Fork')
  assert.equal(findDrill('nothing'), undefined)
  assert.deepEqual(ideasOf(['crushing', 'fork', 'middlegame', 'short', 'mateIn2']), ['Fork'])
})
