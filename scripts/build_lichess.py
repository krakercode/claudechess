"""Builds hooks/puzzles.ts: a sample of the Lichess puzzle database.

The source is Lichess's own puzzle export (CC0), one puzzle a row:
  https://database.lichess.org/lichess_db_puzzle.csv.zst
  python3 scripts/build_lichess.py lichess_db_puzzle.csv.zst > hooks/puzzles.ts
(`.csv`, `.csv.zst` with `pip install zstandard`, or a SQLite copy of the same
rows in a table named `puzzles`.)

The sample spreads across ratings: up to PER_BUCKET puzzles in every 100 points
from 400 to 3000, taken first from puzzles many people have played and liked,
then from less played ones where a rating band has too few. On top of that,
every theme the pane lets you drill gets at least PER_THEME_BAND puzzles in
each 300-point band where the database has them. The sample is seeded, so a
rebuild from the same export gives the same puzzles.

Every line is replayed with python-chess before it is written: the moves are
legal, the first is the opponent's, and the line ends on the solver's move.
"""
import csv
import io
import random
import sqlite3
import sys

import chess

PER_BUCKET = 180
PER_THEME_BAND = 12
SEED = 20261016
LOW, HIGH = 400, 3000
THEME_BANDS = [(0, 800), (800, 1100), (1100, 1400), (1400, 1700), (1700, 2000), (2000, 2300), (2300, 2600), (2600, 9999)]

# Quality tiers, strictest first: (minimum popularity, minimum plays, maximum rating deviation).
TIERS = [(90, 1000, 80), (85, 300, 90), (75, 100, 110)]

# Every theme Lichess tags, in the order the codes are given. Appending keeps old codes.
THEMES = [
    "advancedPawn", "advantage", "anastasiaMate", "arabianMate", "attackingF2F7", "attraction",
    "backRankMate", "bishopEndgame", "bodenMate", "capturingDefender", "castling", "clearance",
    "crushing", "defensiveMove", "deflection", "discoveredAttack", "doubleBishopMate", "doubleCheck",
    "dovetailMate", "enPassant", "endgame", "equality", "exposedKing", "fork", "hangingPiece",
    "hookMate", "interference", "intermezzo", "killBoxMate", "kingsideAttack", "knightEndgame",
    "long", "master", "masterVsMaster", "mate", "mateIn1", "mateIn2", "mateIn3", "mateIn4",
    "mateIn5", "middlegame", "oneMove", "opening", "pawnEndgame", "pin", "promotion",
    "queenEndgame", "queenRookEndgame", "queensideAttack", "quietMove", "rookEndgame",
    "sacrifice", "short", "skewer", "smotheredMate", "superGM", "trappedPiece", "underPromotion",
    "veryLong", "vukovicMate", "xRayAttack", "zugzwang",
]
CODE = {theme: index for index, theme in enumerate(THEMES)}

# The themes the pane offers as drills; hooks/themes.ts names them.
DRILLS = [
    "mateIn1", "mateIn2", "mateIn3", "mateIn4", "mateIn5", "fork", "pin", "skewer",
    "discoveredAttack", "doubleCheck", "xRayAttack", "sacrifice", "deflection", "attraction",
    "clearance", "interference", "intermezzo", "capturingDefender", "hangingPiece", "trappedPiece",
    "exposedKing", "kingsideAttack", "queensideAttack", "attackingF2F7", "backRankMate",
    "smotheredMate", "anastasiaMate", "arabianMate", "hookMate", "bodenMate", "dovetailMate",
    "advancedPawn", "promotion", "underPromotion", "enPassant", "castling", "quietMove",
    "defensiveMove", "zugzwang", "equality", "opening", "middlegame", "endgame", "rookEndgame",
    "pawnEndgame", "bishopEndgame", "knightEndgame", "queenEndgame", "queenRookEndgame",
    "long", "veryLong", "master", "masterVsMaster", "superGM",
]

FIELDS = ["PuzzleId", "FEN", "Moves", "Rating", "RatingDeviation", "Popularity", "NbPlays", "Themes", "GameUrl", "OpeningTags"]


def rows(path):
    if path.endswith(".db"):
        db = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
        query = f"select {', '.join(FIELDS[:8])} from puzzles"
        for row in db.execute(query):
            yield dict(zip(FIELDS[:8], row))
        return
    if path.endswith(".zst"):
        import zstandard

        raw = zstandard.ZstdDecompressor().stream_reader(open(path, "rb"))
        text = io.TextIOWrapper(raw, encoding="utf-8")
    else:
        text = open(path, encoding="utf-8")
    reader = csv.reader(text)
    first = next(reader)
    header = first if first[0] == "PuzzleId" else FIELDS
    if first[0] != "PuzzleId":
        yield dict(zip(header, first))
    for row in reader:
        yield dict(zip(header, row))


def tier(row):
    """The strictest quality tier the puzzle meets, or None."""
    for index, (popularity, plays, deviation) in enumerate(TIERS):
        if int(row["Popularity"]) >= popularity and int(row["NbPlays"]) >= plays and int(row["RatingDeviation"]) <= deviation:
            return index
    return None


def replays(row):
    """Whether the line plays legally and ends on the solver's move."""
    moves = row["Moves"].split()
    if len(moves) < 2 or len(moves) % 2:
        return False
    board = chess.Board(row["FEN"])
    for uci in moves:
        move = chess.Move.from_uci(uci)
        if move not in board.legal_moves:
            return False
        board.push(move)
    return True


def select(candidates, excluded):
    """The puzzle ids to keep: a spread across ratings, then every drill topped up."""
    rng = random.Random(SEED)
    picked = set()

    def take(pool, count):
        """Takes up to count puzzles from pool, strictest tier first."""
        taken = 0
        by_tier = {}
        for puzzle_id in pool:
            if puzzle_id not in picked and puzzle_id not in excluded:
                by_tier.setdefault(candidates[puzzle_id][1], []).append(puzzle_id)
        for level in sorted(by_tier):
            group = by_tier[level]
            rng.shuffle(group)
            for puzzle_id in group[: count - taken]:
                picked.add(puzzle_id)
                taken += 1
        return taken

    ordered = sorted(candidates)
    buckets, by_theme = {}, {}
    for puzzle_id in ordered:
        rating, _, codes = candidates[puzzle_id]
        bucket = min(max(rating, LOW), HIGH) // 100 * 100
        buckets.setdefault(bucket, []).append(puzzle_id)
        for code in codes:
            by_theme.setdefault(code, []).append(puzzle_id)
    for bucket in sorted(buckets):
        got = take(buckets[bucket], PER_BUCKET)
        print(f"rating {bucket}: {got}", file=sys.stderr)

    for theme in DRILLS:
        code = CODE[theme]
        for low, high in THEME_BANDS:
            in_band = [puzzle_id for puzzle_id in by_theme.get(code, []) if low <= candidates[puzzle_id][0] < high]
            have = sum(1 for puzzle_id in in_band if puzzle_id in picked)
            if have < PER_THEME_BAND:
                take(in_band, PER_THEME_BAND - have)
    return picked


def main():
    path = sys.argv[1]
    candidates = {}
    for row in rows(path):
        rating = int(row["Rating"])
        level = tier(row)
        if level is None or not LOW - 100 <= rating < HIGH + 400:
            continue
        themes = row["Themes"].split()
        if any(theme not in CODE for theme in themes):
            print(f"unknown theme in {row['PuzzleId']}: {row['Themes']}", file=sys.stderr)
            continue
        candidates[row["PuzzleId"]] = (rating, level, tuple(CODE[theme] for theme in themes))
    print(f"{len(candidates)} candidates", file=sys.stderr)

    excluded = set()
    for _ in range(5):
        picked = select(candidates, excluded)
        lines = {}
        for row in rows(path):
            if row["PuzzleId"] in picked:
                lines[row["PuzzleId"]] = (row["FEN"], row["Moves"])
        broken = {puzzle_id for puzzle_id, (fen, moves) in lines.items() if not replays({"FEN": fen, "Moves": moves})}
        for puzzle_id in sorted(broken):
            print(f"dropped {puzzle_id}: the line does not replay", file=sys.stderr)
        if not broken:
            break
        excluded |= broken
    else:
        sys.exit("puzzles kept failing to replay")

    chosen = sorted(picked, key=lambda puzzle_id: (candidates[puzzle_id][0], puzzle_id))
    print(f"{len(chosen)} puzzles", file=sys.stderr)
    for theme in DRILLS:
        count = sum(1 for puzzle_id in chosen if CODE[theme] in candidates[puzzle_id][2])
        print(f"  {theme}: {count}", file=sys.stderr)
    print(render(chosen, candidates, lines))


def render(chosen, candidates, sources):
    lines = []
    for puzzle_id in chosen:
        rating, _, codes = candidates[puzzle_id]
        fen, moves = sources[puzzle_id]
        board = " ".join(fen.split()[:4])
        codes = ".".join(format(code, "x") for code in codes)
        lines.append(f"{puzzle_id}|{board}|{moves}|{rating}|{codes}")
    themes = ",\n  ".join(f"'{theme}'" for theme in THEMES)
    return f"""// Generated by scripts/build_lichess.py from the Lichess puzzle database
// (database.lichess.org, CC0): {len(chosen)} puzzles from {chosen and candidates[chosen[0]][0]} to {chosen and candidates[chosen[-1]][0]}, ordered by rating.
// One puzzle a line: id|FEN (no move counters)|moves in UCI|rating|theme codes.
// The first move is the opponent's; the solver answers it. A theme code is an
// index into LICHESS_THEMES, in hex, the codes joined with dots.

export const LICHESS_THEMES = [
  {themes},
] as const

export const POOL = `{chr(10).join(lines)}`
"""


if __name__ == "__main__":
    main()
