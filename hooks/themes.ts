// The Lichess puzzle themes the pane lets you drill, in plain words, grouped
// as the Themes view lists them. Every theme a puzzle carries is still counted
// in your stats; these are the ones worth practising on purpose.

export type Drill = { theme: string; name: string }
export type DrillGroup = { name: string; drills: Drill[] }

export const DRILL_GROUPS: DrillGroup[] = [
  {
    name: 'Mates',
    drills: [
      { theme: 'mateIn1', name: 'Mate in 1' },
      { theme: 'mateIn2', name: 'Mate in 2' },
      { theme: 'mateIn3', name: 'Mate in 3' },
      { theme: 'mateIn4', name: 'Mate in 4' },
      { theme: 'mateIn5', name: 'Mate in 5+' },
      { theme: 'backRankMate', name: 'Back-rank mate' },
      { theme: 'smotheredMate', name: 'Smothered mate' },
      { theme: 'anastasiaMate', name: "Anastasia's mate" },
      { theme: 'arabianMate', name: 'Arabian mate' },
      { theme: 'hookMate', name: 'Hook mate' },
      { theme: 'bodenMate', name: "Boden's mate" },
      { theme: 'dovetailMate', name: 'Dovetail mate' },
    ],
  },
  {
    name: 'Tactics',
    drills: [
      { theme: 'fork', name: 'Fork' },
      { theme: 'pin', name: 'Pin' },
      { theme: 'skewer', name: 'Skewer' },
      { theme: 'discoveredAttack', name: 'Discovered attack' },
      { theme: 'doubleCheck', name: 'Double check' },
      { theme: 'xRayAttack', name: 'X-ray attack' },
      { theme: 'sacrifice', name: 'Sacrifice' },
      { theme: 'deflection', name: 'Deflection' },
      { theme: 'attraction', name: 'Attraction' },
      { theme: 'clearance', name: 'Clearance' },
      { theme: 'interference', name: 'Interference' },
      { theme: 'intermezzo', name: 'In-between move' },
      { theme: 'capturingDefender', name: 'Remove the defender' },
      { theme: 'hangingPiece', name: 'Hanging piece' },
      { theme: 'trappedPiece', name: 'Trapped piece' },
    ],
  },
  {
    name: 'Attack and defence',
    drills: [
      { theme: 'exposedKing', name: 'Exposed king' },
      { theme: 'kingsideAttack', name: 'Kingside attack' },
      { theme: 'queensideAttack', name: 'Queenside attack' },
      { theme: 'attackingF2F7', name: 'Attacking f2 or f7' },
      { theme: 'quietMove', name: 'Quiet move' },
      { theme: 'defensiveMove', name: 'Defensive move' },
      { theme: 'zugzwang', name: 'Zugzwang' },
      { theme: 'equality', name: 'Save the game' },
    ],
  },
  {
    name: 'Pawns and special moves',
    drills: [
      { theme: 'advancedPawn', name: 'Advanced pawn' },
      { theme: 'promotion', name: 'Promotion' },
      { theme: 'underPromotion', name: 'Underpromotion' },
      { theme: 'enPassant', name: 'En passant' },
      { theme: 'castling', name: 'Castling' },
    ],
  },
  {
    name: 'Phase of the game',
    drills: [
      { theme: 'opening', name: 'Opening' },
      { theme: 'middlegame', name: 'Middlegame' },
      { theme: 'endgame', name: 'Endgame' },
      { theme: 'rookEndgame', name: 'Rook endgame' },
      { theme: 'pawnEndgame', name: 'Pawn endgame' },
      { theme: 'bishopEndgame', name: 'Bishop endgame' },
      { theme: 'knightEndgame', name: 'Knight endgame' },
      { theme: 'queenEndgame', name: 'Queen endgame' },
      { theme: 'queenRookEndgame', name: 'Queen and rook endgame' },
    ],
  },
  {
    name: 'Length and origin',
    drills: [
      { theme: 'long', name: 'Three-move puzzles' },
      { theme: 'veryLong', name: 'Four moves or more' },
      { theme: 'master', name: 'From titled players' },
      { theme: 'masterVsMaster', name: 'Titled vs titled' },
      { theme: 'superGM', name: 'From super GM games' },
    ],
  },
]

export const DRILLS: Drill[] = DRILL_GROUPS.flatMap(group => group.drills)

const OTHER_NAMES: Record<string, string> = {
  advantage: 'Advantage',
  crushing: 'Crushing',
  mate: 'Mate',
  middlegame: 'Middlegame',
  oneMove: 'One move',
  short: 'Two moves',
  doubleBishopMate: 'Double bishop mate',
  killBoxMate: 'Kill box mate',
  vukovicMate: 'Vuković mate',
}

/** A theme's name as the pane writes it. */
export const themeName = (theme: string): string =>
  DRILLS.find(drill => drill.theme === theme)?.name ?? OTHER_NAMES[theme] ?? theme

/** Themes that say how a puzzle ends or how long it is, which tell you nothing about the idea. */
const QUIET_THEMES = new Set(['advantage', 'crushing', 'mate', 'oneMove', 'short', 'long', 'veryLong', 'middlegame', 'endgame', 'opening', 'master', 'masterVsMaster', 'superGM'])

/** The themes worth naming under a puzzle once it is over: the ideas in it. */
export const ideasOf = (themes: readonly string[]): string[] =>
  themes.filter(theme => !QUIET_THEMES.has(theme) && !/^mateIn\d$/.test(theme)).map(themeName)

/** Finds a drill by its theme key or its name, loosely: `fork`, `Back-rank mate`, `mate in 2`, `mateIn2`. */
export const findDrill = (text: string): Drill | undefined => {
  const plain = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '')
  const wanted = plain(text)
  return DRILLS.find(drill => plain(drill.theme) === wanted || plain(drill.name) === wanted)
}
