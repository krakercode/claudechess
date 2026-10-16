// The board: eight rows of squares in British racing green and cream, each
// square a button, so a click picks a piece up and another puts it down.

import type { ElementTable } from 'claude-code'

import { boardOf, colorOf, glyphOf, squareName } from './chess.ts'

export const GREEN = '#004225'
export const CREAM = '#F3E9D2'

const LIGHT = '#EEE3C6'
const DARK = '#7A9E7E'
const LIGHT_LAST = '#E3D68E'
const DARK_LAST = '#A4B46A'
const SELECTED = '#D9B44A'
const TARGET = '#D8A47F'
const INK = '#1A1A1A'

export type BoardProps = {
  fen: string
  /** Black at the bottom. */
  isFlipped: boolean
  selected: string | null
  /** The squares the selected piece can go to. */
  targets: readonly string[]
  /** The last move, in UCI, to highlight. */
  lastMove: string | null
  pieces: 'symbols' | 'letters'
  onPress?: (square: string) => unknown
}

export const drawBoard = (table: ElementTable, props: BoardProps) => {
  const { Box, Text, Button } = table
  const squares = boardOf(props.fen)
  const order = props.isFlipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7]
  const lastFrom = props.lastMove?.slice(0, 2)
  const lastTo = props.lastMove?.slice(2, 4)

  const cell = (index: number) => {
    const square = squareName(index)
    const piece = squares[index]
    const isDark = (Math.floor(index / 8) + (index % 8)) % 2 === 1
    const isLast = square === lastFrom || square === lastTo
    const isTarget = props.targets.includes(square)
    const background =
      props.selected === square ? SELECTED : isTarget && piece ? TARGET : isLast ? (isDark ? DARK_LAST : LIGHT_LAST) : isDark ? DARK : LIGHT
    const glyph = piece ? glyphOf(piece, props.pieces) : isTarget ? '•' : ' '
    const text = (
      <Text color={piece ? INK : GREEN} backgroundColor={background} bold={piece !== null && piece !== undefined && colorOf(piece) === 'w' && props.pieces === 'letters'}>
        {` ${glyph} `}
      </Text>
    )
    if (!props.onPress) return <Text key={square}>{text}</Text>
    const onPress = props.onPress
    return (
      <Button key={square} plain onPress={() => onPress(square)}>
        {text}
      </Button>
    )
  }

  return (
    <Box flexDirection="column" marginY={1}>
      {order.map(rank => (
        <Box key={`rank-${rank}`} flexDirection="row">
          <Text dimColor>{8 - rank} </Text>
          {order.map(file => cell(rank * 8 + file))}
        </Box>
      ))}
      <Text dimColor>{'  ' + order.map(file => ` ${'abcdefgh'[file]} `).join('')}</Text>
    </Box>
  )
}
