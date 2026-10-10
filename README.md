# claudechess

A Claude Code mod that hands you a chess puzzle while Claude is working.

When a turn starts, a **Chess puzzle** pane opens beside the conversation with a
mate-in-1 or mate-in-2 position. Click a piece and then its target square, or
type the move (`Nf7`, `Qxd2+`, `e7e8q`, `O-O-O`). On a mate in 2 the defence is
played for you. The pane keeps your solved count and clean-solve streak across
sessions, and picks up at the next puzzle where you left off.

- **Hint** (`h`) names the piece to move.
- **Show solution** (`s`) prints the solution line.
- **Skip** / **Next puzzle** (`n`) deals the next one.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install chess-puzzles --marketplace krakercode/claudechess
```

Answer `y` to add the marketplace, then pick a scope.

## Commands

- `/chess` opens the pane. `/chess next` opens it on a fresh puzzle.
- `/chess off` stops it opening by itself when Claude starts working; `/chess on` turns that back on.

On a narrow terminal the pane waits for room when it opens by itself; `/chess` opens it at any width.

## Puzzles

The 60 puzzles in `hooks/puzzles.ts` were mined from generated games and checked
with python-chess: each first move is the only one that mates in the stated
number of moves, with no shorter mate, and each later move is the only mate
after the defence shown. CI re-checks them with `scripts/check_puzzles.py`.

## Developing

```
claude --plugin-dir .            # run it from this folder
claude plugin validate .
claude plugin test .             # pane tests (tests/*.test.tsx)
node --experimental-strip-types --test tests/*.spec.ts   # chess logic and puzzle set
```
