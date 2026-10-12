// Legal moves, for puzzles that arrive as a game in SAN (the Lichess daily
// puzzle): find the move a SAN names, and write a UCI move as SAN.

import { applyUci, colorOf, type Color, type Position, squareIndex, squareName } from './chess.ts'

const KNIGHT = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]]
const KING = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]]
const ROOK = [[1, 0], [-1, 0], [0, 1], [0, -1]]
const BISHOP = [[1, 1], [1, -1], [-1, 1], [-1, -1]]

/** The square a file and rank step away, or undefined off the board; rank steps go up the board. */
const step = (index: number, df: number, dr: number): number | undefined => {
  const file = (index % 8) + df
  const rank = 7 - Math.floor(index / 8) + dr
  if (file < 0 || file > 7 || rank < 0 || rank > 7) return undefined
  return (7 - rank) * 8 + file
}

const isAttacked = (squares: Position['squares'], target: number, by: Color): boolean => {
  const own = (piece: string | null | undefined, kinds: string) =>
    !!piece && colorOf(piece) === by && kinds.includes(piece.toLowerCase())
  for (const [df, dr] of KNIGHT) {
    const at = step(target, df!, dr!)
    if (at !== undefined && own(squares[at], 'n')) return true
  }
  for (const [df, dr] of KING) {
    const at = step(target, df!, dr!)
    if (at !== undefined && own(squares[at], 'k')) return true
  }
  // A pawn of `by` attacks from one rank behind the target, from its own side.
  const back = by === 'w' ? -1 : 1
  for (const df of [-1, 1]) {
    const at = step(target, df, back)
    if (at !== undefined && own(squares[at], 'p')) return true
  }
  for (const [lines, kinds] of [[ROOK, 'rq'], [BISHOP, 'bq']] as const) {
    for (const [df, dr] of lines) {
      let at = step(target, df!, dr!)
      while (at !== undefined) {
        const piece = squares[at]
        if (piece) {
          if (own(piece, kinds)) return true
          break
        }
        at = step(at, df!, dr!)
      }
    }
  }
  return false
}

const kingSquare = (position: Position, color: Color) =>
  position.squares.findIndex(piece => piece === (color === 'w' ? 'K' : 'k'))

export const isCheck = (position: Position): boolean => {
  const king = kingSquare(position, position.turn)
  return king >= 0 && isAttacked(position.squares, king, position.turn === 'w' ? 'b' : 'w')
}

/** Moves by piece rules alone, as UCI; the king may still be left in check. */
const pseudoMoves = (position: Position): string[] => {
  const { squares, turn } = position
  const enemy: Color = turn === 'w' ? 'b' : 'w'
  const moves: string[] = []
  const add = (from: number, to: number) => moves.push(squareName(from) + squareName(to))

  squares.forEach((piece, from) => {
    if (!piece || colorOf(piece) !== turn) return
    const kind = piece.toLowerCase()
    const isTarget = (to: number) => !squares[to] || colorOf(squares[to]!) === enemy

    if (kind === 'p') {
      const up = turn === 'w' ? 1 : -1
      const startRank = turn === 'w' ? 1 : 6
      const lastRank = turn === 'w' ? 7 : 0
      const pawnTo = (to: number) => {
        if (7 - Math.floor(to / 8) === lastRank) {
          for (const promotion of 'qrbn') moves.push(squareName(from) + squareName(to) + promotion)
        } else {
          add(from, to)
        }
      }
      const one = step(from, 0, up)
      if (one !== undefined && !squares[one]) {
        pawnTo(one)
        const two = step(from, 0, 2 * up)
        if (7 - Math.floor(from / 8) === startRank && two !== undefined && !squares[two]) add(from, two)
      }
      for (const df of [-1, 1]) {
        const to = step(from, df, up)
        if (to === undefined) continue
        const target = squares[to]
        if ((target && colorOf(target) === enemy) || squareName(to) === position.enPassant) pawnTo(to)
      }
      return
    }

    if (kind === 'n' || kind === 'k') {
      for (const [df, dr] of kind === 'n' ? KNIGHT : KING) {
        const to = step(from, df!, dr!)
        if (to !== undefined && isTarget(to)) add(from, to)
      }
    } else {
      const lines = kind === 'r' ? ROOK : kind === 'b' ? BISHOP : [...ROOK, ...BISHOP]
      for (const [df, dr] of lines) {
        let to = step(from, df!, dr!)
        while (to !== undefined) {
          if (!isTarget(to)) break
          add(from, to)
          if (squares[to]) break
          to = step(to, df!, dr!)
        }
      }
    }

    if (kind === 'k') {
      const home = squareIndex(turn === 'w' ? 'e1' : 'e8')
      if (from !== home || isAttacked(squares, home, enemy)) return
      const rook = turn === 'w' ? 'R' : 'r'
      const sides = [
        { right: turn === 'w' ? 'K' : 'k', empty: [1, 2], safe: [1, 2], rookAt: 3 },
        { right: turn === 'w' ? 'Q' : 'q', empty: [-1, -2, -3], safe: [-1, -2], rookAt: -4 },
      ]
      for (const side of sides) {
        if (!position.castling.includes(side.right)) continue
        if (squares[home + side.rookAt] !== rook) continue
        if (side.empty.some(offset => squares[home + offset])) continue
        if (side.safe.some(offset => isAttacked(squares, home + offset, enemy))) continue
        add(home, home + side.safe[1]!)
      }
    }
  })
  return moves
}

/** Every legal move in the position, as UCI. */
export const legalMoves = (position: Position): string[] =>
  pseudoMoves(position).filter(uci => {
    const after = applyUci(position, uci)
    const king = kingSquare(after, position.turn)
    return king >= 0 && !isAttacked(after.squares, king, after.turn)
  })

/** The move written as SAN, with its check or mate mark. */
export const toSan = (position: Position, uci: string): string => {
  const from = squareIndex(uci.slice(0, 2))
  const to = squareIndex(uci.slice(2, 4))
  const piece = position.squares[from]
  if (!piece) throw new Error(`no piece on ${uci.slice(0, 2)}`)
  const kind = piece.toLowerCase()
  let san: string

  if (kind === 'k' && Math.abs(to - from) === 2) {
    san = to > from ? 'O-O' : 'O-O-O'
  } else {
    const isCapture = !!position.squares[to] || (kind === 'p' && uci.slice(2, 4) === position.enPassant)
    if (kind === 'p') {
      san = (isCapture ? uci[0] + 'x' : '') + uci.slice(2, 4) + (uci[4] ? '=' + uci[4].toUpperCase() : '')
    } else {
      const rivals = legalMoves(position).filter(
        other => other !== uci && other.slice(2, 4) === uci.slice(2, 4) && position.squares[squareIndex(other.slice(0, 2))] === piece,
      )
      let which = ''
      if (rivals.length) {
        const sameFile = rivals.some(other => other[0] === uci[0])
        const sameRank = rivals.some(other => other[1] === uci[1])
        which = !sameFile ? uci[0]! : !sameRank ? uci[1]! : uci.slice(0, 2)
      }
      san = kind.toUpperCase() + which + (isCapture ? 'x' : '') + uci.slice(2, 4)
    }
  }

  const after = applyUci(position, uci)
  if (isCheck(after)) san += legalMoves(after).length ? '+' : '#'
  return san
}

/** The legal move a SAN names, as UCI, or undefined if none or several do. */
export const fromSan = (position: Position, san: string): string | undefined => {
  const plain = san.replace(/[+#!?]/g, '').replace(/0/g, 'O')
  const legal = legalMoves(position)
  const kingAt = squareName(kingSquare(position, position.turn))
  if (plain === 'O-O' || plain === 'O-O-O') {
    const to = (plain === 'O-O' ? 'g' : 'c') + kingAt[1]
    return legal.find(uci => uci === kingAt + to && kingAt[0] === 'e')
  }
  const match = plain.match(/^([NBRQK])?([a-h])?([1-8])?x?([a-h][1-8])(?:=?([NBRQ]))?$/)
  if (!match) return undefined
  const [, kind = 'P', file, rank, to, promotion] = match
  const found = legal.filter(uci => {
    const piece = position.squares[squareIndex(uci.slice(0, 2))]!
    return (
      uci.slice(2, 4) === to &&
      piece.toUpperCase() === kind &&
      (!file || uci[0] === file) &&
      (!rank || uci[1] === rank) &&
      (uci[4] ?? '') === (promotion?.toLowerCase() ?? '')
    )
  })
  return found.length === 1 ? found[0] : undefined
}
