"""Checks the puzzle set with python-chess (pip install chess).

Reads the puzzles as JSON on stdin:
  node --experimental-strip-types -e "import('./hooks/puzzles.ts').then(m => console.log(JSON.stringify(m.PUZZLES)))" \
    | python3 scripts/check_puzzles.py

For every puzzle: the line is legal, its SAN is as written, it ends in mate,
the first move is the only one that mates in the stated number of moves (and
no shorter mate exists), and each later move of the solver is the only mate
available after the defence shown.
"""
import json
import re
import sys

import chess


def forced(board, n):
    """The side to move is mated within n more moves of the attacker."""
    if board.is_checkmate():
        return True
    if n == 0 or board.is_game_over():
        return False
    for defence in list(board.legal_moves):
        board.push(defence)
        ok = any(mates(board, move, n) for move in list(board.legal_moves))
        board.pop()
        if not ok:
            return False
    return True


def mates(board, move, n):
    board.push(move)
    result = forced(board, n - 1)
    board.pop()
    return result


def winning(board, n):
    return [move for move in list(board.legal_moves) if mates(board, move, n)]


def check(puzzle):
    n = int(re.match(r"Mate in (\d)", puzzle["title"]).group(1))
    board = chess.Board(puzzle["fen"])
    if len(puzzle["moves"]) != 2 * n - 1:
        return "line length does not match the title"
    for shorter in range(1, n):
        if winning(board, shorter):
            return f"has a mate in {shorter}"
    for ply, (uci, san) in enumerate(zip(puzzle["moves"], puzzle["san"])):
        move = chess.Move.from_uci(uci)
        if move not in board.legal_moves:
            return f"{uci} is illegal"
        if board.san(move) != san:
            return f"{uci} is {board.san(move)}, not {san}"
        if ply % 2 == 0:
            left = n - ply // 2
            found = winning(board, left)
            if found != [move]:
                return f"move {ply + 1}: {len(found)} moves mate in {left}"
        board.push(move)
    if not board.is_checkmate():
        return "the line does not end in mate"
    return None


def main():
    puzzles = json.load(sys.stdin)
    failed = 0
    for index, puzzle in enumerate(puzzles):
        problem = check(puzzle)
        if problem:
            failed += 1
            print(f"puzzle {index + 1} ({puzzle['fen']}): {problem}")
    print(f"{len(puzzles) - failed} of {len(puzzles)} puzzles check out")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
