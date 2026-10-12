// A Lichess daily-puzzle answer in the shape https://lichess.org/api/puzzle/daily
// gives, built on Legal's mate (Legal vs Saint Brie, Paris 1750).
export const DAILY_JSON = JSON.stringify({
  game: {
    id: 'legal1750',
    perf: { key: 'classical', name: 'Classical' },
    rated: true,
    players: [
      { name: 'Legal', id: 'legal', color: 'white', rating: 2000 },
      { name: 'SaintBrie', id: 'saintbrie', color: 'black', rating: 1900 },
    ],
    pgn: 'e4 e5 Nf3 d6 Bc4 Bg4 Nc3 g6',
    clock: '15+0',
  },
  puzzle: {
    id: 'Lgl50',
    rating: 1621,
    plays: 1000,
    solution: ['f3e5', 'g4d1', 'c4f7', 'e8e7', 'c3d5'],
    themes: ['mateIn3', 'opening', 'sacrifice'],
    initialPly: 7,
  },
})
