// Just enough chess to play a puzzle's solution line: read a FEN, apply a
// move given as UCI, and match what the person typed against the expected
// move. Legality is never computed: a puzzle accepts only its solution.

export type Color = 'w' | 'b'

export type Position = {
  /** 64 squares, a8 first and h1 last; FEN piece letters, null when empty. */
  squares: (string | null)[]
  turn: Color
  castling: string
  enPassant: string | null
}

const FILES = 'abcdefgh'

export const squareIndex = (square: string): number =>
  (8 - Number(square[1])) * 8 + FILES.indexOf(square[0] ?? '')

export const squareName = (index: number): string =>
  `${FILES[index % 8]}${8 - Math.floor(index / 8)}`

export const colorOf = (piece: string): Color =>
  piece === piece.toUpperCase() ? 'w' : 'b'

export const parseFen = (fen: string): Position => {
  const [placement = '', turn = 'w', castling = '-', enPassant = '-'] = fen.split(' ')
  const squares: (string | null)[] = []
  for (const char of placement.replace(/\//g, '')) {
    if (/\d/.test(char)) {
      for (let i = 0; i < Number(char); i++) squares.push(null)
    } else {
      squares.push(char)
    }
  }
  if (squares.length !== 64) throw new Error(`bad FEN placement: ${fen}`)

  return {
    squares,
    turn: turn === 'b' ? 'b' : 'w',
    castling,
    enPassant: enPassant === '-' ? null : enPassant,
  }
}

export const toFen = (position: Position): string => {
  const ranks: string[] = []
  for (let rank = 0; rank < 8; rank++) {
    let row = ''
    let empty = 0
    for (let file = 0; file < 8; file++) {
      const piece = position.squares[rank * 8 + file]
      if (piece) {
        if (empty) row += empty
        empty = 0
        row += piece
      } else {
        empty++
      }
    }
    ranks.push(empty ? row + empty : row)
  }

  return [ranks.join('/'), position.turn, position.castling || '-', position.enPassant ?? '-', '0', '1'].join(' ')
}

/** Plays a UCI move (`e2e4`, `e7e8q`, `e1g1`) on a copy of the position. */
export const applyUci = (position: Position, uci: string): Position => {
  const from = squareIndex(uci.slice(0, 2))
  const to = squareIndex(uci.slice(2, 4))
  const promotion = uci[4]
  const squares = [...position.squares]
  const piece = squares[from]
  if (!piece) throw new Error(`no piece on ${uci.slice(0, 2)}`)

  const kind = piece.toLowerCase()
  const isWhite = colorOf(piece) === 'w'

  if (kind === 'p' && uci.slice(2, 4) === position.enPassant && !squares[to]) {
    squares[to + (isWhite ? 8 : -8)] = null
  }
  if (kind === 'k' && Math.abs(to - from) === 2) {
    const isShort = to > from
    const rookFrom = isShort ? from + 3 : from - 4
    const rookTo = isShort ? from + 1 : from - 1
    squares[rookTo] = squares[rookFrom] ?? null
    squares[rookFrom] = null
  }

  squares[to] = promotion ? (isWhite ? promotion.toUpperCase() : promotion.toLowerCase()) : piece
  squares[from] = null

  const touched = [uci.slice(0, 2), uci.slice(2, 4)]
  const lost: Record<string, string> = { e1: 'KQ', h1: 'K', a1: 'Q', e8: 'kq', h8: 'k', a8: 'q' }
  let castling = position.castling === '-' ? '' : position.castling
  for (const square of touched) {
    for (const right of lost[square] ?? '') castling = castling.replace(right, '')
  }

  const isDoublePush = kind === 'p' && Math.abs(to - from) === 16
  return {
    squares,
    turn: isWhite ? 'b' : 'w',
    castling: castling || '-',
    enPassant: isDoublePush ? squareName((from + to) / 2) : null,
  }
}

const normalizeSan = (text: string): string =>
  text
    .trim()
    .replace(/0/g, 'O')
    .replace(/[+#!?x=:\-\s]/g, '')
    .replace(/([a-h][18])([qrbn])$/, (_, square: string, piece: string) => square + piece.toUpperCase())

/**
 * Whether what the person typed is the expected move: its UCI (any case),
 * or its SAN with or without the capture, check and promotion marks.
 */
export const isSameMove = (typed: string, expected: { uci: string; san: string }): boolean => {
  const plain = typed.trim().toLowerCase().replace(/[-\s]/g, '')
  if (plain === expected.uci || (expected.uci.length === 5 && plain === expected.uci.slice(0, 4) + '=' + expected.uci[4])) {
    return true
  }

  return normalizeSan(typed) === normalizeSan(expected.san)
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
