// Generated and checked with python-chess: each puzzle's first move is the
// only one that forces mate in the stated number of moves, and every later move
// of the person's is the only mate after the defence shown.

export type Puzzle = {
  title: string
  fen: string
  /** The solution line in UCI, the person's moves and the replies alternating. */
  moves: string[]
  /** The same line in SAN. */
  san: string[]
}

export const PUZZLES: Puzzle[] = [
  {
    title: 'Mate in 1',
    fen: 'rn2k1n1/1pp1pp1r/p5pb/3p3p/1P1P1q1P/1QPK3P/P3P3/RNB2B1R b q - 1 11',
    moves: ['f4e4'],
    san: ['Qe4#'],
  },
  {
    title: 'Mate in 2',
    fen: '1r1q4/2p4p/Bp2kp2/8/7P/2N4R/2PB2r1/4K2R b K - 3 25',
    moves: ['d8d2', 'e1f1', 'd2f2'],
    san: ['Qxd2+', 'Kf1', 'Qf2#'],
  },
  {
    title: 'Mate in 1',
    fen: 'rnbq1b2/pp1pp1p1/7r/7k/4N2p/P2P1N2/RP1P2PP/2BQ2KR w - - 1 17',
    moves: ['f3e5'],
    san: ['Ne5#'],
  },
  {
    title: 'Mate in 2',
    fen: '6b1/8/p1k3p1/P2p1p2/5P2/4r2p/P4R1P/7K b - - 3 43',
    moves: ['e3e1', 'f2f1', 'e1f1'],
    san: ['Re1+', 'Rf1', 'Rxf1#'],
  },
  {
    title: 'Mate in 1',
    fen: '3k1b2/8/2Rp1P2/8/p4PBP/P7/b4K2/8 w - - 2 39',
    moves: ['c6c8'],
    san: ['Rc8#'],
  },
  {
    title: 'Mate in 1',
    fen: '2r5/1b1n1pk1/1b5p/p4p2/5N1P/P2K4/3P2P1/RN5R b - - 3 33',
    moves: ['b7a6'],
    san: ['Ba6#'],
  },
  {
    title: 'Mate in 1',
    fen: '5rk1/5p1p/5PpQ/8/8/8/5PPP/6K1 w - - 0 1',
    moves: ['h6g7'],
    san: ['Qg7#'],
  },
  {
    title: 'Mate in 1',
    fen: 'rnb1kb1r/1p1p1p1p/p3pnp1/2p3N1/5q1P/NP6/2PPP1P1/R1BQKB1R b Qkq - 0 9',
    moves: ['f4g3'],
    san: ['Qg3#'],
  },
  {
    title: 'Mate in 1',
    fen: 'k7/8/1K6/8/8/8/8/7R w - - 0 1',
    moves: ['h1h8'],
    san: ['Rh8#'],
  },
  {
    title: 'Mate in 1',
    fen: '1r6/1b1k1pp1/p3p3/1p1p3Q/3P3P/q4N2/4PPP1/4KB1R b - - 0 21',
    moves: ['a3c1'],
    san: ['Qc1#'],
  },
  {
    title: 'Mate in 1',
    fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
    moves: ['h5f7'],
    san: ['Qxf7#'],
  },
  {
    title: 'Mate in 1',
    fen: '8/8/8/8/8/8/R7/R3K2k w Q - 0 1',
    moves: ['e1c1'],
    san: ['O-O-O#'],
  },
  {
    title: 'Mate in 1',
    fen: '6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1',
    moves: ['g5f7'],
    san: ['Nf7#'],
  },
  {
    title: 'Mate in 2',
    fen: 'rnb1kr2/3p1p1p/p1p2Q2/1p6/3P4/2b2K2/2P1P1PP/2B2BNR w q - 1 15',
    moves: ['c1g5', 'c3b4', 'f6d8'],
    san: ['Bg5', 'Bb4', 'Qd8#'],
  },
  {
    title: 'Mate in 2',
    fen: '3k4/3p4/2p3n1/4Q3/8/q2PB1P1/2P1B3/3K4 w - - 1 40',
    moves: ['e3b6', 'd8c8', 'e5c7'],
    san: ['Bb6+', 'Kc8', 'Qc7#'],
  },
  {
    title: 'Mate in 2',
    fen: '4kb1r/p2n1ppp/4q3/4p1B1/4P3/1Q6/PPP2PPP/2KR4 w k - 1 1',
    moves: ['b3b8', 'd7b8', 'd1d8'],
    san: ['Qb8+', 'Nxb8', 'Rd8#'],
  },
  {
    title: 'Mate in 1',
    fen: '1Qb1kb1r/p1p1ppp1/1p5p/8/1P3P2/4PN2/4PKPP/1q3B1R w k - 0 12',
    moves: ['b8c8'],
    san: ['Qxc8#'],
  },
  {
    title: 'Mate in 2',
    fen: '1nb1k3/rp1p4/p3p2p/7p/3P2rP/q7/P1PKP1P1/R2Q1BNR b - - 2 17',
    moves: ['g4d4', 'd2e1', 'a3g3'],
    san: ['Rxd4+', 'Ke1', 'Qg3#'],
  },
  {
    title: 'Mate in 2',
    fen: '3qkbr1/1b1pp3/1pp2p1p/5Q2/1n1P1P2/2N5/2P1P2P/4KBNR w K - 2 20',
    moves: ['f5h5', 'g8g6', 'h5g6'],
    san: ['Qh5+', 'Rg6', 'Qxg6#'],
  },
  {
    title: 'Mate in 2',
    fen: 'r2k1b1r/pb2ppp1/B2p1n2/q1p3K1/7p/1P2PP1P/P1PP2P1/RNB2QNR b - - 0 14',
    moves: ['h8h5', 'g5f4', 'e7e5'],
    san: ['Rh5+', 'Kf4', 'e5#'],
  },
  {
    title: 'Mate in 1',
    fen: '1n2kbnr/4pppp/1p6/8/P7/6P1/Q1q1PP1P/RNB1K2R b KQk - 1 12',
    moves: ['c2c1'],
    san: ['Qxc1#'],
  },
  {
    title: 'Mate in 1',
    fen: 'rnb1kb1r/pp1p1pp1/7p/2q2p2/P5n1/5K2/1PPBP1PP/RN1Q1BNR b kq - 1 9',
    moves: ['c5f2'],
    san: ['Qf2#'],
  },
  {
    title: 'Mate in 2',
    fen: 'k5nr/pr6/1p3pp1/3R4/5P2/2PBP2P/P4K1R/6N1 w - - 5 29',
    moves: ['d5d8', 'b7b8', 'd3e4'],
    san: ['Rd8+', 'Rb8', 'Be4#'],
  },
  {
    title: 'Mate in 1',
    fen: '1r2k2r/p2b3p/1pp4n/5p2/PP4q1/2PK4/R1PQP1PP/5B1R b k - 5 17',
    moves: ['g4e4'],
    san: ['Qe4#'],
  },
  {
    title: 'Mate in 2',
    fen: '3rk3/2R3pr/3p4/3P4/b4Npp/8/P5PP/4KR2 w - - 0 32',
    moves: ['f4g6', 'a4d7', 'f1f8'],
    san: ['Ng6', 'Bd7', 'Rf8#'],
  },
  {
    title: 'Mate in 1',
    fen: '2b1k3/3p4/2p5/1N1p2r1/5q2/PR5K/1P1P4/RNB5 b - - 7 28',
    moves: ['d7d6'],
    san: ['d6#'],
  },
  {
    title: 'Mate in 2',
    fen: '8/6R1/r4n1p/p7/2P2P1k/2PB3P/1r3PPR/4K3 w - - 9 34',
    moves: ['g2g3', 'h4h5', 'd3g6'],
    san: ['g3+', 'Kh5', 'Bg6#'],
  },
  {
    title: 'Mate in 1',
    fen: '3r2k1/5ppp/8/8/8/8/5PPP/6K1 b - - 0 1',
    moves: ['d8d1'],
    san: ['Rd1#'],
  },
  {
    title: 'Mate in 2',
    fen: 'rnb1kbnr/1pqpp2p/5p2/2p3p1/p3KP2/7P/PPPPP1P1/RNBQ1BNR b kq - 0 10',
    moves: ['c7f4', 'e4d3', 'f4d4'],
    san: ['Qxf4+', 'Kd3', 'Qd4#'],
  },
  {
    title: 'Mate in 2',
    fen: '4k1r1/2p1pp2/2K2npp/8/1r3P2/RP1P3P/1P2P2P/2B4R w - - 1 25',
    moves: ['a3a8', 'b4b8', 'a8b8'],
    san: ['Ra8+', 'Rb8', 'Rxb8#'],
  },
  {
    title: 'Mate in 1',
    fen: '7k/7p/5N2/8/8/8/8/6RK w - - 0 1',
    moves: ['g1g8'],
    san: ['Rg8#'],
  },
  {
    title: 'Mate in 1',
    fen: 'rn1qk1r1/pppb3p/3pp1pb/K4p2/P2P3P/5PP1/1PP1P3/RN1Q1BNR b q - 2 11',
    moves: ['c7c5'],
    san: ['c5#'],
  },
  {
    title: 'Mate in 2',
    fen: 'rn1k1b1r/pb2ppp1/3p1n2/qBp3K1/7p/1P2PP1P/P1PP2P1/RNB2QNR b - - 0 13',
    moves: ['h8h5', 'g5f4', 'e7e5'],
    san: ['Rh5+', 'Kf4', 'e5#'],
  },
  {
    title: 'Mate in 1',
    fen: 'r1b1k1r1/pp1p2pp/n7/2p1p1q1/PbP2p2/3P1P1K/1P2P3/RNBQ1BN1 b q - 0 16',
    moves: ['g5g3'],
    san: ['Qg3#'],
  },
  {
    title: 'Mate in 2',
    fen: '3Q1R2/1k6/1pr2p1r/p1p1p3/P3P2P/2P5/1P6/7K w - - 2 39',
    moves: ['d8b8', 'b7a6', 'b8a8'],
    san: ['Qb8+', 'Ka6', 'Qa8#'],
  },
  {
    title: 'Mate in 2',
    fen: 'rnbqkb1r/3pp1pn/p1p4p/1p3p2/4P3/P1PP2PP/1P1N1P1R/R1BQKBN1 w Qkq - 0 9',
    moves: ['d1h5', 'g7g6', 'h5g6'],
    san: ['Qh5+', 'g6', 'Qxg6#'],
  },
  {
    title: 'Mate in 1',
    fen: 'rn1qkb1r/p1ppp1p1/b4p2/7p/1Pp3n1/N5PN/P1QPPP1P/R1B1KBR1 w Qkq - 4 9',
    moves: ['c2g6'],
    san: ['Qg6#'],
  },
  {
    title: 'Mate in 1',
    fen: '6k1/R7/1R6/8/8/8/8/6K1 w - - 0 1',
    moves: ['b6b8'],
    san: ['Rb8#'],
  },
  {
    title: 'Mate in 2',
    fen: '4k1r1/2K1pp2/6pp/8/1r2nP2/RP1P3P/1P2P2P/2B4R w - - 1 26',
    moves: ['a3a8', 'b4b8', 'a8b8'],
    san: ['Ra8+', 'Rb8', 'Rxb8#'],
  },
  {
    title: 'Mate in 2',
    fen: '1r6/8/p3R2b/k2p2p1/3P2p1/K1P5/P3PP2/5B2 b - - 0 35',
    moves: ['h6f8', 'e6d6', 'f8d6'],
    san: ['Bf8+', 'Rd6', 'Bxd6#'],
  },
  {
    title: 'Mate in 1',
    fen: '1n1qkbr1/r1ppp1pQ/b4p2/1p6/8/2P1P3/P1P2PPP/R1B1K1NR w KQ - 1 9',
    moves: ['h7g6'],
    san: ['Qg6#'],
  },
  {
    title: 'Mate in 1',
    fen: '8/3kpn2/4p2P/7R/5P1N/4r3/5rP1/2K5 b - - 3 37',
    moves: ['e3e1'],
    san: ['Re1#'],
  },
  {
    title: 'Mate in 1',
    fen: '2bqkbQ1/rppnp3/7p/1P1p2p1/8/7p/P2PPP1P/RNB1K1NR w KQ - 1 11',
    moves: ['g8g6'],
    san: ['Qg6#'],
  },
  {
    title: 'Mate in 1',
    fen: 'r7/3kb3/2Rp3p/1P2p3/p3P1P1/3q1B1P/1P6/2K2RN1 b - - 16 38',
    moves: ['e7g5'],
    san: ['Bg5#'],
  },
  {
    title: 'Mate in 1',
    fen: '6nr/5kpp/3Q4/2p1p1b1/8/N7/PPPP1Pq1/R1BK4 b - - 0 21',
    moves: ['g2f1'],
    san: ['Qf1#'],
  },
  {
    title: 'Mate in 1',
    fen: 'nn1r2k1/2p2p2/7R/4B1p1/P1p5/4P3/2PP1P2/3K4 w - - 1 22',
    moves: ['h6h8'],
    san: ['Rh8#'],
  },
  {
    title: 'Mate in 2',
    fen: 'rnb1kbnr/1pqpp2p/5pp1/2p5/p3K3/5P1P/PPPPP1P1/RNBQ1BNR b kq - 1 9',
    moves: ['c7e5', 'e4d3', 'e5d4'],
    san: ['Qe5+', 'Kd3', 'Qd4#'],
  },
  {
    title: 'Mate in 2',
    fen: 'r2k1b1r/p3ppp1/b2p1n2/2p2K2/7p/1P2PP1P/P1PP2P1/RNB3NR b - - 1 16',
    moves: ['h8h5', 'f5f4', 'e7e5'],
    san: ['Rh5+', 'Kf4', 'e5#'],
  },
  {
    title: 'Mate in 1',
    fen: '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1',
    moves: ['d1d8'],
    san: ['Rd8#'],
  },
  {
    title: 'Mate in 1',
    fen: '6k1/5q2/7p/3p4/2RPn1KP/4P2R/1P4P1/5B2 b - - 6 37',
    moves: ['h6h5'],
    san: ['h5#'],
  },
  {
    title: 'Mate in 1',
    fen: 'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq g3 0 2',
    moves: ['d8h4'],
    san: ['Qh4#'],
  },
  {
    title: 'Mate in 2',
    fen: 'rnbqk1nN/p2pp1b1/1p3p2/7p/8/3P4/P4PPP/RNBQKB1R w KQq - 1 10',
    moves: ['d1h5', 'e8f8', 'h5f7'],
    san: ['Qxh5+', 'Kf8', 'Qf7#'],
  },
  {
    title: 'Mate in 2',
    fen: '8/4br1p/Q2p1p1q/3k2p1/8/5P2/P3K2P/1R2B2R w - - 1 34',
    moves: ['b1b5', 'd5c4', 'a6a4'],
    san: ['Rb5+', 'Kc4', 'Qa4#'],
  },
  {
    title: 'Mate in 2',
    fen: '1nb4r/3pk2p/p3p3/p3q1p1/6K1/1PP5/P1R3PP/1Q4NR b - - 1 21',
    moves: ['e5f4', 'g4h3', 'f4h4'],
    san: ['Qf4+', 'Kh3', 'Qh4#'],
  },
  {
    title: 'Mate in 2',
    fen: 'r1q2k2/1nr4p/1p1p2p1/p1p1p3/P1P1K3/R3P2P/1P2B3/2B1Q1NR b - - 2 27',
    moves: ['c8f5', 'e4d5', 'e5e4'],
    san: ['Qf5+', 'Kd5', 'e4#'],
  },
  {
    title: 'Mate in 2',
    fen: 'rn2k1n1/1pp1pp1r/p5pb/3p1q1p/1P1P1P1P/1QP1K2P/P3P3/RNB2B1R b q - 2 10',
    moves: ['f5f4', 'e3d3', 'f4e4'],
    san: ['Qxf4+', 'Kd3', 'Qe4#'],
  },
  {
    title: 'Mate in 1',
    fen: '7k/8/5NKB/8/8/8/8/8 w - - 0 1',
    moves: ['h6g7'],
    san: ['Bg7#'],
  },
  {
    title: 'Mate in 1',
    fen: 'rn2k3/p3bpp1/1p1p1n1r/4N2p/8/P3PKP1/1BqPBP1P/4Q1NR b q - 0 17',
    moves: ['c2e4'],
    san: ['Qe4#'],
  },
  {
    title: 'Mate in 1',
    fen: 'r2qkbQ1/1ppnp3/p2p1pp1/7p/1P1P3P/2P4N/P3PPP1/RN2KB2 w Qq - 1 13',
    moves: ['g8g6'],
    san: ['Qxg6#'],
  },
  {
    title: 'Mate in 1',
    fen: 'rn2kbnr/4p3/b4pP1/2p4p/7P/PP1q3N/3P2PR/RNBQK3 b Qkq - 1 14',
    moves: ['d3f1'],
    san: ['Qf1#'],
  },
]
