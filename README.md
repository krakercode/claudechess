# Claude Chess

A Claude Code mod that gives you chess to play while Claude is working.

When a turn starts, a **Claude Chess** pane opens beside the conversation. It
has four tabs:

- **Puzzle** (`1`): a rated puzzle from the Lichess puzzle database, picked near
  your rating. Click a piece and then its square, or type the move (`Nf7`,
  `Qxd2+`, `e7e8q`, `O-O-O`). The opponent's replies are played for you.
- **Themes** (`2`): drill one idea (forks, pins, back-rank mates, rook endgames
  and 50 more), or switch to the 110 puzzles from master games.
- **Famous games** (`3`): 30 famous games, from the Immortal Game to Gukesh's
  title win. Step through them, guess the winner's moves, or play on from any
  position against Stockfish.
- **Stats** (`4`): your rating and how it has moved, your streaks, and your
  strongest and weakest themes.

The pane stays open if Claude finishes mid-puzzle, and remembers where you
were across sessions.

## How puzzles are scored

Your puzzle rating works the way Lichess's does: Glicko-2, each puzzle a game
against the puzzle's own rating. It starts at 1500 with a question mark, which
goes once it has settled.

- A **clean solve** wins. A wrong move, a hint or showing the solution loses,
  at the first one of those, and only once per puzzle.
- After a wrong move you get **one more try**; a second wrong move shows the
  solution. Moves that aren't legal don't count against you.
- On the last move of a mating puzzle, any mate solves it, as on Lichess.
- **Hint** (`h`) names the piece to move. **Show solution** (`s`) shows the rest
  of the line. **Skip** (`n`) on a puzzle you haven't touched costs nothing.
- **Try again** (`r`) replays a finished puzzle for practice; it counts for nothing.
- **Difficulty** (`d`) deals puzzles easier or harder than your rating: Easiest
  (-600), Easier (-300), Normal, Harder (+300) or Hardest (+600).

The master-game puzzles are unrated: they count towards your solves and streak,
not your rating.

## Famous games

Open one from the list, then:

- `<` and `>` (`b` and `n`) step back and forward, `|<` and `>|` (`a` and `e`) jump to the ends.
- **Guess the moves** (`g`) plays the opponent's moves and asks you for the
  winner's, from wherever you are in the game. You get one more try at each,
  and the pane keeps score.
- **Play from here** (`p`) starts a game against Stockfish from the position on
  the board. **Take back** (`t`) undoes your last move and its reply, and `k`
  sets its strength (1320 to 2500, or full strength).

Stockfish is not bundled. Play from here runs the `stockfish` on your PATH; on
Windows, or if it lives somewhere else, give the mod its path with
`/chess engine C:\path\to\stockfish.exe`. Install it from
[stockfishchess.org](https://stockfishchess.org/download/) or your package
manager (`brew install stockfish`, `apt install stockfish`).

Each game has a short note on why it is famous, checked against the source
linked under it.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install chess-puzzles --marketplace krakercode/claudechess
```

Answer `y` to add the marketplace, then pick a scope.

## Commands

- `/chess` opens the pane; `/chess next` deals a fresh puzzle.
- `/chess easiest`, `easier`, `normal`, `harder` or `hardest` sets the difficulty.
- `/chess theme fork` (or `mate in 2`, `back-rank mate`, ...) drills a theme;
  `/chess theme any` goes back to all of them; `/chess masters` deals the master-game puzzles.
- `/chess famous` opens the famous games; `/chess famous opera` opens one.
- `/chess stats` shows your rating.
- `/chess letters` draws pieces as letters, for a terminal whose font draws the
  chess symbols badly; `/chess symbols` goes back.
- `/chess engine <command or path>` says which Stockfish to run.
- `/chess off` stops the pane opening by itself when Claude starts working;
  `/chess on` turns that back on.

On a narrow terminal the pane waits for room when it opens by itself; `/chess`
opens it at any width.

## Where the chess comes from

- **Puzzles**: 6,636 puzzles from the [Lichess puzzle database](https://database.lichess.org/#puzzles)
  (CC0), rated 399 to 3193. `scripts/build_lichess.py` takes up to 180 in
  every 100 rating points from 400 to 3000, preferring puzzles many people have
  played and liked, then tops up every theme to at least 12 puzzles in each
  300-point band where the database has them. The sample is seeded, so a rebuild gives the same puzzles.
- **Master-game puzzles**: positions from real games, Steinitz to Carlsen, from
  the PGN in the [chess-console-puzzles](https://www.npmjs.com/package/chess-console-puzzles)
  package (MIT), cut into puzzles with Stockfish 16 by `scripts/build_masters.py`.
- **Famous games**: `scripts/famous.pgn`, one game a record with its name,
  a note on why it is famous and the page it was checked against.
- **Move checking**: [chess.js](https://github.com/jhlywa/chess.js) 1.4.0
  (BSD-2-Clause), vendored in `hooks/vendor/` with its licence.

Nothing is sent anywhere: the puzzles, your rating and your stats live on your
machine.

## Developing

```
claude --plugin-dir .            # run it from this folder
claude plugin validate .
claude plugin test .             # pane tests (tests/*.test.tsx)
node --experimental-strip-types --test tests/*.spec.ts   # chess logic, rating, every bundled game
```

The scripts need `pip install chess==1.10.0`.

Rebuilding the Lichess sample (add `pip install zstandard` for the `.zst`):

```
curl -O https://database.lichess.org/lichess_db_puzzle.csv.zst
python3 scripts/build_lichess.py lichess_db_puzzle.csv.zst > hooks/puzzles.ts
```

Rebuilding the famous games after editing `scripts/famous.pgn`:

```
python3 scripts/build_famous.py scripts/famous.pgn > hooks/famous.ts
```

Rebuilding and checking the master-game puzzles needs Stockfish 16
(`apt-get install stockfish` on Ubuntu 24.04):

```
npm pack chess-console-puzzles && tar xzf chess-console-puzzles-*.tgz
python3 scripts/build_masters.py package/assets/puzzles/puzzles_Oli1970.pgn > hooks/masters.ts
node --experimental-strip-types -e "import('./hooks/masters.ts').then(m => console.log(JSON.stringify(m.MASTERS)))" \
  | python3 scripts/check_masters.py
```

CI runs the Node tests, checks `hooks/famous.ts` is built from the PGN, and
re-checks every master-game puzzle with Stockfish.
