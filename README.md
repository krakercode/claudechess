# claudechess

A Claude Code mod that hands you a chess puzzle while Claude is working.

When a turn starts, a **Chess puzzle** pane opens beside the conversation with a
position from a real game, and the player who won it to move: find the
mate or the winning line they played. Under the puzzle is the game it comes
from. Click a piece and then its target square, or type the move (`Nf7`,
`Qxd2+`, `e7e8q`, `O-O-O`). The opponent's replies are played for you. The pane keeps your solved count and clean-solve streak across
sessions, and picks up at the next puzzle where you left off.

- **Hint** (`h`) names the piece to move.
- **Show solution** (`s`) prints the solution line.
- **Skip** / **Next puzzle** (`n`) deals the next one.
- **Level** (`l`) switches between Mixed (easiest to hardest, then round again),
  Easy, Medium and Hard. The pane remembers the level.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install chess-puzzles --marketplace krakercode/claudechess
```

Answer `y` to add the marketplace, then pick a scope.

## Commands

- `/chess` opens the pane. `/chess next` opens it on a fresh puzzle.
- `/chess easy`, `/chess medium`, `/chess hard` or `/chess mixed` picks the level.
- `/chess off` stops it opening by itself when Claude starts working; `/chess on` turns that back on.

On a narrow terminal the pane waits for room when it opens by itself; `/chess` opens it at any width.

## Puzzles

The puzzles in `hooks/puzzles.ts` come from positions in real games, from
Steinitz and Lasker to Carlsen and Nakamura, collected in the PGN of the
[chess-console-puzzles](https://www.npmjs.com/package/chess-console-puzzles)
package (MIT). `scripts/build_puzzles.py` turns them into puzzles with
Stockfish 16: the solution is the longest start of the line played in which
every one of the winner's moves is the engine's choice and clearly better than
any other, ending in mate or a clear advantage. Positions without such a line
are dropped. The level comes from how deep the engine must look to find the
first move and how long and quiet the line is, split into even thirds.

CI re-checks every puzzle with `scripts/check_puzzles.py` (python-chess and
Stockfish, on one thread with a fixed node budget, so the verdict is the same
on every run).

## Developing

```
claude --plugin-dir .            # run it from this folder
claude plugin validate .
claude plugin test .             # pane tests (tests/*.test.tsx)
node --experimental-strip-types --test tests/*.spec.ts   # chess logic and puzzle set
```

Rebuilding the puzzles needs `pip install chess==1.10.0` and Stockfish 16
(`apt-get install stockfish` on Ubuntu 24.04):

```
npm pack chess-console-puzzles && tar xzf chess-console-puzzles-*.tgz
python3 scripts/build_puzzles.py package/assets/puzzles/puzzles_Oli1970.pgn > hooks/puzzles.ts
node --experimental-strip-types -e "import('./hooks/puzzles.ts').then(m => console.log(JSON.stringify(m.PUZZLES)))" \
  | python3 scripts/check_puzzles.py
```
