// The chess the pane needs, over chess.js: read a FEN into squares to draw,
// turn what the person typed or clicked into a legal move, list a piece's
// moves, and play a line. Positions travel as FEN strings, so state stays
// plain data.

import { Chess } from './vendor/chess.js'

export type Color = 'w' | 'b'

/** A move as the pane keeps it: UCI (`e7e8q`) and SAN (`e8=Q+`). */
export type Move = { uci: string; san: string }

const FILES = 'abcdefgh'

/** A FEN with the move counters chess.js wants, when they were left off. */
export const fullFen = (fen: string): string => {
  const fields = fen.trim().split(/\s+/)
  while (fields.length < 4) fields.push('-')
  if (fields.length === 4) fields.push('0', '1')
  return fields.join(' ')
}

export const squareIndex = (square: string): number =>
  (8 - Number(square[1])) * 8 + FILES.indexOf(square[0] ?? '')

export const squareName = (index: number): string =>
  `${FILES[index % 8]}${8 - Math.floor(index / 8)}`

export const colorOf = (piece: string): Color =>
  piece === piece.toUpperCase() ? 'w' : 'b'

/** The side to move in a FEN. */
export const turnOf = (fen: string): Color => (fen.split(' ')[1] === 'b' ? 'b' : 'w')

/** 64 squares, a8 first and h1 last; FEN piece letters, null when empty. */
export const boardOf = (fen: string): (string | null)[] => {
  const squares: (string | null)[] = []
  for (const char of (fen.split(' ')[0] ?? '').replace(/\//g, '')) {
    if (/\d/.test(char)) {
      for (let i = 0; i < Number(char); i++) squares.push(null)
    } else {
      squares.push(char)
    }
  }
  if (squares.length !== 64) throw new Error(`bad FEN placement: ${fen}`)
  return squares
}

const asMove = (move: { lan: string; san: string }): Move => ({ uci: move.lan, san: move.san })

/** Plays a UCI move, answering the move and the FEN after it; throws when illegal. */
export const play = (fen: string, uci: string): Move & { fen: string } => {
  const chess = new Chess(fullFen(fen))
  const move = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
  return { ...asMove(move), fen: chess.fen() }
}

/** Plays a SAN move; throws when illegal. */
export const playSan = (fen: string, san: string): Move & { fen: string } => {
  const chess = new Chess(fullFen(fen))
  const move = chess.move(san)
  return { ...asMove(move), fen: chess.fen() }
}

const tryMove = (fen: string, attempt: string | { from: string; to: string; promotion?: string }): Move | null => {
  try {
    return asMove(new Chess(fullFen(fen)).move(attempt))
  } catch {
    return null
  }
}

/**
 * The legal move the person meant by what they typed, or null: SAN with or
 * without capture and check marks (`Nf7`, `Nxf7#`, a lowercase `nf7` too),
 * UCI (`g5f7`, `e7e8q`), castling as `O-O` or `0-0`, a promotion as `e8=Q`,
 * `e8Q`, `e8q`, or a bare `e8` for a queen.
 */
export const resolveMove = (fen: string, typed: string): Move | null => {
  const text = typed.trim().replace(/\s+/g, '')
  if (!text) return null
  const castle = text.replace(/0/g, 'O').replace(/-/g, '').toUpperCase()
  if (castle === 'OO' || castle === 'OOO') return tryMove(fen, castle === 'OO' ? 'O-O' : 'O-O-O')

  const plain = text.replace(/[-+#!?]/g, '')
  const uci = plain.toLowerCase().replace('=', '').match(/^([a-h][1-8])x?([a-h][1-8])([qrbn])?$/)
  if (uci) {
    const move = tryMove(fen, { from: uci[1]!, to: uci[2]!, promotion: uci[3] })
    if (move) return move
  }

  const promoted = plain.replace(/([a-h][18])=?([qrbnQRBN])$/, (_, square: string, piece: string) => `${square}=${piece.toUpperCase()}`)
  const tries = [promoted]
  if (/^[nrqk]/.test(promoted)) tries.push(promoted[0]!.toUpperCase() + promoted.slice(1))
  if (/^b/.test(promoted)) tries.push('B' + promoted.slice(1))
  if (/^[a-h]x?[a-h]?[18]$/.test(promoted)) tries.push(`${promoted}=Q`)
  for (const attempt of tries) {
    const move = tryMove(fen, attempt)
    if (move) return move
  }
  return null
}

/** The squares the piece on `from` can move to. */
export const targetsOf = (fen: string, from: string): string[] => {
  try {
    return new Chess(fullFen(fen)).moves({ square: from as never, verbose: true }).map(move => move.to)
  } catch {
    return []
  }
}

/** The move from one square to another, promoting to `promotion` or a queen; null when illegal. */
export const moveBetween = (fen: string, from: string, to: string, promotion = 'q'): Move | null =>
  tryMove(fen, { from, to, promotion })

/** The SAN of each move of a line played from fen. */
export const sanLine = (fen: string, line: readonly string[]): string[] => {
  const chess = new Chess(fullFen(fen))
  return line.map(uci => chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san)
}

/** How the game stands: whose move, and whether it is over and why. */
export const outcomeOf = (fen: string): { isOver: boolean; reason?: 'checkmate' | 'stalemate' | 'draw'; isCheck: boolean } => {
  const chess = new Chess(fullFen(fen))
  if (chess.isCheckmate()) return { isOver: true, reason: 'checkmate', isCheck: true }
  if (chess.isStalemate()) return { isOver: true, reason: 'stalemate', isCheck: false }
  if (chess.isDraw()) return { isOver: true, reason: 'draw', isCheck: chess.inCheck() }
  return { isOver: false, isCheck: chess.inCheck() }
}

const PIECE_NAMES: Record<string, string> = {
  p: 'pawn',
  n: 'knight',
  b: 'bishop',
  r: 'rook',
  q: 'queen',
  k: 'king',
}

export const pieceName = (piece: string): string => PIECE_NAMES[piece.toLowerCase()] ?? piece

/** White's pieces as outline glyphs and Black's as solid ones, as in printed diagrams. */
const GLYPHS: Record<string, string> = {
  K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙',
  k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟︎',
}

/** How a piece is drawn: a chess symbol, or its FEN letter. */
export const glyphOf = (piece: string, style: 'symbols' | 'letters'): string =>
  style === 'letters' ? piece : (GLYPHS[piece] ?? piece)
