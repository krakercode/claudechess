"""Checks the puzzle set with python-chess and Stockfish.

Needs `pip install chess==1.10.0` and a Stockfish 16 binary (`apt-get install
stockfish` on Ubuntu 24.04; set STOCKFISH to point at another one). Reads the
puzzles as JSON on stdin:
  node --experimental-strip-types -e "import('./hooks/puzzles.ts').then(m => console.log(JSON.stringify(m.PUZZLES)))" \
    | python3 scripts/check_puzzles.py

For every puzzle: the line is legal, its SAN is as written, and it ends on the
solver's move in mate or a clear advantage. At each of the solver's moves the
engine's best move is the one in the line, and every other move is clearly
worse. A "Mate in N" puzzle mates in exactly N with best defence, and no other
move mates as fast. The engine runs on one thread with a node budget, so the
verdicts are the same on every machine with the same Stockfish. Puzzles are
checked in parallel, one engine each.
"""
import json
import math
import multiprocessing
import os
import re
import shutil
import sys

import chess
import chess.engine

NODES = 1_500_000
# How much better the solution must be than the second-best move, in win
# chances (-1 lost, 0 equal, 1 won), and how good the end position must be.
MIN_GAP = 0.3
MIN_FINAL_CP = 200
LEVELS = ("easy", "medium", "hard")


def win_chances(score):
    if score.is_mate():
        return 1.0 if score.mate() > 0 else -1.0
    return 2 / (1 + math.exp(-0.00368208 * score.score())) - 1


def open_engine():
    path = os.environ.get("STOCKFISH") or shutil.which("stockfish") or "/usr/games/stockfish"
    engine = chess.engine.SimpleEngine.popen_uci(path)
    engine.configure({"Threads": 1, "Hash": 64})
    return engine


def top_two(engine, board):
    engine.configure({"Clear Hash": None})
    lines = engine.analyse(board, chess.engine.Limit(nodes=NODES), multipv=2)
    best = lines[0]
    second = lines[1]["score"].pov(board.turn) if len(lines) > 1 else None
    return best["pv"][0], best["score"].pov(board.turn), second


def solver_move_problem(engine, board, move, mate_left):
    """Why this move is not clearly the only good one, or None if it is."""
    best, score, second = top_two(engine, board)
    if best != move:
        return f"the engine prefers {board.san(best)} ({score})"
    if mate_left:
        if score != chess.engine.Mate(mate_left):
            return f"it is {score}, not mate in {mate_left}"
        if second is not None and second.is_mate() and 0 < second.mate() <= mate_left:
            return f"another move also mates in {second.mate()}"
        return None
    gap = win_chances(score) - (win_chances(second) if second is not None else -1)
    if gap < MIN_GAP:
        return f"the second-best move is close ({score} against {second})"
    return None


def check(engine, puzzle):
    board = chess.Board(puzzle["fen"])
    solver = board.turn
    moves, sans = puzzle["moves"], puzzle["san"]
    if len(moves) != len(sans) or len(moves) % 2 == 0:
        return "the line must end on the solver's move"
    if puzzle.get("level") not in LEVELS:
        return f"level is {puzzle.get('level')!r}"
    if not puzzle.get("game"):
        return "the game it comes from is missing"
    mate = re.fullmatch(r"Mate in (\d+)", puzzle["title"])
    solver_moves = (len(moves) + 1) // 2
    if mate and int(mate.group(1)) != solver_moves:
        return "the line length does not match the title"
    if not mate and puzzle["title"] != "Find the win":
        return f"unknown title {puzzle['title']!r}"

    for ply, (uci, san) in enumerate(zip(moves, sans)):
        move = chess.Move.from_uci(uci)
        if move not in board.legal_moves:
            return f"{uci} is illegal"
        if board.san(move) != san:
            return f"{uci} is {board.san(move)}, not {san}"
        if ply % 2 == 0:
            left = solver_moves - ply // 2 if mate else 0
            problem = solver_move_problem(engine, board, move, left)
            if problem:
                return f"move {ply + 1} {san}: {problem}"
        board.push(move)

    if mate:
        return None if board.is_checkmate() else "the line does not end in mate"
    if board.is_checkmate():
        return "the line ends in mate, so the title should say so"
    engine.configure({"Clear Hash": None})
    final = engine.analyse(board, chess.engine.Limit(nodes=NODES))["score"].pov(solver)
    if final.is_mate() and final.mate() > 0:
        return None
    if final.is_mate() or final.score() < MIN_FINAL_CP:
        return f"the end position is only {final}"
    return None


def check_alone(puzzle):
    engine = open_engine()
    try:
        return check(engine, puzzle)
    finally:
        engine.quit()


def main():
    puzzles = json.load(sys.stdin)
    with multiprocessing.Pool() as pool:
        problems = pool.map(check_alone, puzzles)
    failed = 0
    for index, (puzzle, problem) in enumerate(zip(puzzles, problems)):
        if problem:
            failed += 1
            print(f"puzzle {index + 1} ({puzzle['fen']}): {problem}")
    print(f"{len(puzzles) - failed} of {len(puzzles)} puzzles check out")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
