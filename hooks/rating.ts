// Your puzzle rating: Glicko-2, as Lichess rates puzzle solvers, each puzzle
// one game against its own rating. A clean solve is a win; a wrong move, a
// hint or the solution shown is a loss. Nothing is sent anywhere.

export type Rating = {
  rating: number
  /** Rating deviation: how unsure the rating still is. */
  deviation: number
  volatility: number
}

export const START: Rating = { rating: 1500, deviation: 350, volatility: 0.09 }

const SCALE = 173.7178
const TAU = 0.75
const MIN_DEVIATION = 45
const MAX_DEVIATION = 350
/** The deviation a puzzle's own rating is taken to have. */
export const PUZZLE_DEVIATION = 80

/** Lichess shows a rating with a question mark while it is this unsure. */
export const isProvisional = (rating: { deviation: number }): boolean => rating.deviation > 110

const g = (phi: number) => 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI))

/** The rating after one result against a puzzle rated `opponent`: 1 a win, 0 a loss. */
export const rate = (player: Rating, opponent: number, score: 0 | 1, opponentDeviation = PUZZLE_DEVIATION): Rating => {
  const mu = (player.rating - 1500) / SCALE
  const phi = player.deviation / SCALE
  const muJ = (opponent - 1500) / SCALE
  const phiJ = opponentDeviation / SCALE
  const gJ = g(phiJ)
  const expected = 1 / (1 + Math.exp(-gJ * (mu - muJ)))
  const v = 1 / (gJ * gJ * expected * (1 - expected))
  const delta = v * gJ * (score - expected)

  // The new volatility, by the Illinois method of Glickman's paper.
  const a = Math.log(player.volatility * player.volatility)
  const f = (x: number) => {
    const ex = Math.exp(x)
    return (ex * (delta * delta - phi * phi - v - ex)) / (2 * (phi * phi + v + ex) ** 2) - (x - a) / (TAU * TAU)
  }
  let lo = a
  let hi: number
  if (delta * delta > phi * phi + v) {
    hi = Math.log(delta * delta - phi * phi - v)
  } else {
    let k = 1
    while (f(a - k * TAU) < 0 && k < 100) k++
    hi = a - k * TAU
  }
  let fLo = f(lo)
  let fHi = f(hi)
  for (let step = 0; step < 100 && Math.abs(hi - lo) > 0.000001; step++) {
    const next = lo + ((lo - hi) * fLo) / (fHi - fLo)
    const fNext = f(next)
    if (fNext * fHi <= 0) {
      lo = hi
      fLo = fHi
    } else {
      fLo /= 2
    }
    hi = next
    fHi = fNext
  }
  const volatility = Math.exp(lo / 2)

  const phiStar = Math.sqrt(phi * phi + volatility * volatility)
  const phiNew = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v)
  const muNew = mu + phiNew * phiNew * gJ * (score - expected)

  return {
    rating: Math.round((muNew * SCALE + 1500) * 10) / 10,
    deviation: Math.min(MAX_DEVIATION, Math.max(MIN_DEVIATION, phiNew * SCALE)),
    volatility,
  }
}
