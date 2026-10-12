// Plain Node tests of the chess logic and the puzzle set:
//   node --experimental-strip-types --test tests/*.spec.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { applyUci, colorOf, isSameMove, parseFen, squareIndex, toFen } from '../hooks/chess.ts'
import { dailyFromLichess } from '../hooks/lichess.ts'
import { fromSan, legalMoves, toSan } from '../hooks/moves.ts'
import { PUZZLES } from '../hooks/puzzles.ts'
import { DAILY_JSON } from './fixtures-daily.ts'

test('a FEN reads back as written', () => {
  const fen = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 0 1'
  assert.equal(toFen(parseFen(fen)), fen)
})

test('castling moves the rook too', () => {
  const after = applyUci(parseFen('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'), 'e1c1')
  assert.equal(toFen(after).split(' ')[0], 'r3k2r/8/8/8/8/8/8/2KR3R')
  assert.equal(after.castling, 'kq')
})

test('en passant takes the pawn beside', () => {
  const after = applyUci(parseFen('8/8/8/3Pp3/8/8/8/k6K w - e6 0 1'), 'd5e6')
  assert.equal(toFen(after).split(' ')[0], '8/8/4P3/8/8/8/8/k6K')
})

test('a double push sets the en passant square', () => {
  assert.equal(applyUci(parseFen('8/8/8/8/8/8/4P3/k6K w - - 0 1'), 'e2e4').enPassant, 'e3')
})

test('promotion makes the piece of the mover', () => {
  const after = applyUci(parseFen('8/4P3/8/8/8/8/8/k6K w - - 0 1'), 'e7e8n')
  assert.equal(after.squares[squareIndex('e8')], 'N')
})

test('typed moves match in UCI and in loose SAN', () => {
  const capture = { uci: 'g5f7', san: 'Nxf7#' }
  for (const typed of ['Nxf7#', 'Nf7', 'g5f7', 'G5F7', 'g5-f7']) {
    assert.ok(isSameMove(typed, capture), typed)
  }
  assert.ok(!isSameMove('Nf6', capture))
  assert.ok(!isSameMove('f7', capture))

  const promotion = { uci: 'e7e8q', san: 'e8=Q+' }
  for (const typed of ['e8=Q', 'e8Q', 'e8q', 'e7e8q', 'e7e8=q']) assert.ok(isSameMove(typed, promotion), typed)
  assert.ok(!isSameMove('e8=N', promotion))

  const castle = { uci: 'e1c1', san: 'O-O-O#' }
  for (const typed of ['O-O-O', '0-0-0', 'e1c1']) assert.ok(isSameMove(typed, castle), typed)
  assert.ok(!isSameMove('O-O', castle))
})

test('every puzzle plays through cleanly and ends on the solver\'s move', () => {
  assert.ok(PUZZLES.length >= 80)
  for (const [n, puzzle] of PUZZLES.entries()) {
    const label = `puzzle ${n + 1} (${puzzle.fen})`
    const mateIn = puzzle.title.match(/^Mate in (\d)$/)?.[1]
    if (mateIn) {
      assert.equal(puzzle.moves.length, Number(mateIn) * 2 - 1, label)
      assert.match(puzzle.san.at(-1)!, /#$/, label)
    } else {
      assert.equal(puzzle.title, 'Find the win', label)
      assert.equal(puzzle.moves.length % 2, 1, label)
    }
    assert.equal(puzzle.san.length, puzzle.moves.length, label)
    assert.ok(puzzle.game.length > 0, label)
    let position = parseFen(puzzle.fen)
    for (const [ply, uci] of puzzle.moves.entries()) {
      const piece = position.squares[squareIndex(uci.slice(0, 2))]
      assert.ok(piece, `${label}: no piece for ${uci}`)
      assert.equal(colorOf(piece), position.turn, `${label}: ${uci} moves the wrong side`)
      assert.ok(isSameMove(puzzle.san[ply]!, { uci, san: puzzle.san[ply]! }), label)
      position = applyUci(position, uci)
    }
  }
})

test('each level has a fair share of the puzzles, easiest first', () => {
  const order = ['easy', 'medium', 'hard']
  for (const level of order) {
    assert.ok(PUZZLES.filter(puzzle => puzzle.level === level).length >= PUZZLES.length / 4, level)
  }
  const ranks = PUZZLES.map(puzzle => order.indexOf(puzzle.level))
  assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b))
})

test('legal moves cover castling, en passant, promotion and pins', () => {
  const castles = legalMoves(parseFen('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'))
  assert.ok(castles.includes('e1g1') && castles.includes('e1c1'))
  // The bishop on b4 pins the knight on c3 to the king on e1.
  assert.ok(!legalMoves(parseFen('4k3/8/8/8/1b6/2N5/8/4K3 w - - 0 1')).some(uci => uci.startsWith('c3')))
  assert.ok(legalMoves(parseFen('4k3/8/8/3Pp3/8/8/8/4K3 w - e6 0 1')).includes('d5e6'))
  assert.equal(legalMoves(parseFen('4k3/P7/8/8/8/8/8/4K3 w - - 0 1')).filter(uci => uci.startsWith('a7a8')).length, 4)
})

test('SAN is written and read with disambiguation and marks', () => {
  const rooks = parseFen('4k3/8/8/8/8/7K/8/R6R w - - 0 1')
  assert.equal(toSan(rooks, 'a1d1'), 'Rad1')
  assert.equal(fromSan(rooks, 'Rhd1'), 'h1d1')
  assert.equal(fromSan(rooks, 'Rd1'), undefined)
  assert.equal(fromSan(rooks, 'Ra2'), 'a1a2')
  assert.equal(toSan(parseFen('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'), 'e1g1'), 'O-O')
  assert.equal(toSan(parseFen('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1'), 'a1a8'), 'Ra8#')
})

test('the Lichess daily puzzle is read from its game and solution', () => {
  const daily = dailyFromLichess(DAILY_JSON)
  assert.equal(daily.fen.split(' ').slice(0, 4).join(' '), 'rn1qkbnr/ppp2p1p/3p2p1/4p3/2B1P1b1/2N2N2/PPPP1PPP/R1BQK2R w KQkq -')
  assert.deepEqual(daily.san, ['Nxe5', 'Bxd1', 'Bxf7+', 'Ke7', 'Nd5#'])
  assert.equal(daily.title, 'Mate in 3')
  assert.equal(daily.level, 'medium')
  assert.equal(daily.game, 'Legal vs SaintBrie, Classical on Lichess · rated 1621')
  assert.throws(() => dailyFromLichess('{"puzzle":{}}'))
})
