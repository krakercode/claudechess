// Plain Node tests of the chess logic and the puzzle set:
//   node --experimental-strip-types --test tests/*.spec.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { applyUci, colorOf, isSameMove, parseFen, squareIndex, toFen } from '../hooks/chess.ts'
import { PUZZLES } from '../hooks/puzzles.ts'

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

test('every puzzle plays through cleanly and ends in mate', () => {
  assert.ok(PUZZLES.length >= 40)
  for (const [n, puzzle] of PUZZLES.entries()) {
    const label = `puzzle ${n + 1} (${puzzle.fen})`
    const mateIn = Number(puzzle.title.match(/Mate in (\d)/)?.[1])
    assert.equal(puzzle.moves.length, mateIn * 2 - 1, label)
    assert.equal(puzzle.san.length, puzzle.moves.length, label)
    assert.match(puzzle.san.at(-1)!, /#$/, label)
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
