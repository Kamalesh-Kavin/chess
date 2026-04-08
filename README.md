# Chess

A browser-based chess game with Stockfish AI integration. Play against the engine at four difficulty levels, or use handoff mode for local two-player games with optional AI assistance. Includes post-game analysis that classifies every move (brilliant, best, good, inaccuracy, mistake, blunder) with accuracy percentages.

Zero dependencies, no build step — just static files and a locally-hosted Stockfish WASM engine.

## Features

- **Play vs Stockfish AI** with 4 difficulty levels (Beginner → Maximum)
- **Choose your color**: Play as White or Black
- **Handoff mode**: Local 2-player with optional AI delegation for either side
- **Post-game analysis**: Per-move evaluation, classification, and accuracy % per player
- **Drag-and-drop** and **click-to-move** piece interaction (mouse + touch)
- **Pawn promotion** modal (Queen, Rook, Bishop, Knight)
- **Smart undo**: In vs-engine mode, undoes both your move and the engine's response
- **Board flip**: Rotate the board perspective
- **Legal move highlighting**: Dots for empty squares, rings for captures
- **Last-move indicator**: Highlighted squares with ghost piece on the origin
- **Check highlighting**: Red-tinted king square
- **Captured pieces** display sorted by value
- **Move list** sidebar with SAN notation (clickable for review)
- **Eval bar** visualization during analysis
- **Keyboard shortcuts**: Ctrl+Z (undo), Ctrl+N (new game), Ctrl+F (flip)
- **Responsive layout**: Stacks vertically on mobile
- **Dark theme** with warm board colors

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Chess engine | Custom rules engine (465 lines) |
| AI | Stockfish.js (WASM, runs as Web Worker) |
| Frontend | Vanilla JavaScript + CSS |
| Build | None — static files only |

**~2,556 lines of code** across 5 source files. Zero npm dependencies.

## Getting Started

Since Stockfish runs as a Web Worker, files need to be served over HTTP (not `file://`):

```bash
git clone https://github.com/Kamalesh-Kavin/chess.git
cd chess
python3 -m http.server 8000
```

Open `http://localhost:8000` in your browser.

Any static file server works — `npx serve`, VS Code Live Server, nginx, etc.

## How to Play

1. **Choose a mode**: "vs Engine" to play against Stockfish, or "Handoff" for local 2-player
2. **Select difficulty** (vs Engine): Beginner, Intermediate, Advanced, or Maximum
3. **Choose your color** (vs Engine): White or Black
4. **Move pieces**: Drag-and-drop or click a piece then click a destination
5. **Undo**: Click Undo or Ctrl+Z — in vs-engine mode it undoes both your move and the engine's reply
6. **Analyze**: After the game ends (or anytime), click "Analyze" to evaluate every move

### Analysis Classifications

| Classification | Eval Loss | Color |
|---------------|-----------|-------|
| Brilliant | Gained ≥ 0.5 pawns | Cyan |
| Best | No loss | Green |
| Good | < 0.2 pawns lost | Light green |
| Inaccuracy | < 0.5 pawns lost | Yellow |
| Mistake | < 1.5 pawns lost | Orange |
| Blunder | ≥ 1.5 pawns lost | Red |

---

## System Architecture

```
┌────────────────────────────────────────────────────┐
│                     Browser                         │
│                                                     │
│  ┌──────────┐    ┌──────────┐    ┌───────────────┐ │
│  │ chess.js  │    │ engine.js│    │ ui.js         │ │
│  │ (Model)   │◄───│(AI Adapt)│◄───│(Controller/   │ │
│  │           │    │          │    │  View)        │ │
│  │ Rules,    │    │ Stockfish│    │ DOM, Canvas,  │ │
│  │ move gen, │    │ Worker   │    │ drag/drop,    │ │
│  │ FEN, SAN  │    │ wrapper  │    │ game flow     │ │
│  └──────────┘    └─────┬────┘    └───────────────┘ │
│                        │                            │
│                  ┌─────┴──────┐                     │
│                  │stockfish.js│                      │
│                  │(Web Worker)│                      │
│                  │ WASM Engine│                      │
│                  └────────────┘                      │
└────────────────────────────────────────────────────┘
```

### Module Roles

| Module | Role | Lines |
|--------|------|-------|
| `chess.js` | **Model** — Pure game logic. Board state, move generation, legality validation, FEN/SAN conversion, check/checkmate/stalemate/draw detection. Zero DOM or I/O. | 465 |
| `engine.js` | **AI Adapter** — Stockfish Web Worker wrapper. UCI protocol handshake, difficulty presets, eval score parsing. Returns Promises. | 138 |
| `ui.js` | **Controller/View** — DOM rendering, drag-and-drop, click-to-move, game flow state machine, analysis pipeline, keyboard shortcuts. Self-executing IIFE. | 1002 |

### Data Flow

```
User input (click/drag)
  → ui.js: selectSquare() / tryMove()
    → chess.js: legalMovesFrom() → isLegal() → makeMove()
      → Returns new state + move + captured piece
    → ui.js: push to history[], update gameState, render()
      → If engine's turn:
        → engine.js: getBestMove(FEN, level)
          → Web Worker: "position fen ... go depth N"
            → Stockfish: "bestmove e2e4"
          → Resolves Promise with UCI move
        → chess.js: makeMove()
        → ui.js: push to history[], render()
```

### Analysis Flow

```
ui.js: runAnalysis()
  → For each move in history[]:
    → chess.js: toFEN(position after move)
    → engine.js: evaluate(fen, depth=14) [skill forced to max]
    → Stockfish evaluates at full strength
    → Normalize score to White's perspective
    → Compute centipawn loss vs previous position
    → Classify: brilliant / best / good / inaccuracy / mistake / blunder
  → Render: analysis markers on board, annotations in move list, accuracy summary
```

---

## Implementation Details

### Chess Engine (`js/chess.js` — 465 lines)

Pure logic module exposing a `Chess` object. No dependencies.

**Board Representation:**
- Flat 64-element array, index 0 = a8 (top-left), index 63 = h1 (bottom-right)
- Each cell: `null` or `{ color: 'w'|'b', type: 'p'|'n'|'b'|'r'|'q'|'k' }`
- Coordinate helpers: `sq(r,c) = r*8+c`, `row(s) = s>>3`, `col(s) = s&7`

**State Object:**
```javascript
{ board, turn, castling, enPassant, halfmove, fullmove }
```

**Move Generation** (two-phase):
1. **Pseudo-legal generation** (`pseudoMoves`): Iterates all squares, generates moves per piece type:
   - Pawn: push, double push, captures, en passant, promotion (4 variants per promoting move)
   - Knight: 8 L-shaped offsets
   - Bishop/Queen: 4 diagonal ray-casts (slide until blocked)
   - Rook/Queen: 4 orthogonal ray-casts
   - King: 8 adjacent + castling (kingside/queenside)
2. **Legality filter** (`legalMoves`): Applies each pseudo-legal move, checks if own king would be in check — discards if yes

**Attack Detection** (`isAttackedBy`): Checks if any piece of a given color attacks a square — used for check detection, castling validation. Checks pawns, knights, king adjacency, then 8-direction ray-casts for sliding pieces.

**Special Move Handling:**
- Castling: validates no check on king, clear path, squares not attacked, rights exist. Applies rook teleport in `applyMoveUnchecked`
- En passant: captures pawn on adjacent file. Removes captured pawn from its actual square
- Promotion: replaces pawn with chosen piece type

**Game End Detection** (`getStatus`):
- Checkmate: no legal moves + in check
- Stalemate: no legal moves + not in check
- 50-move rule: halfmove counter ≥ 100
- Insufficient material: K vs K, K+B vs K, K+N vs K

**SAN Notation** (`toSAN`): Generates standard algebraic notation with disambiguation (file, rank, or both when multiple same-type pieces can reach the same square), capture markers, promotion suffix, check/checkmate indicators.

### Stockfish Integration (`js/engine.js` — 138 lines)

Web Worker wrapper using UCI protocol.

**Initialization:**
```
new Worker('js/stockfish.js')
  → send "uci" → wait for "uciok"
  → send "isready" → wait for "readyok"
  → Ready
```

**Difficulty Presets:**

| Level | Label | Search Depth | Skill Level | Move Time |
|-------|-------|-------------|-------------|-----------|
| 1 | Beginner | 1 | 0 | 200ms |
| 2 | Intermediate | 8 | 8 | 500ms |
| 3 | Advanced | 15 | 15 | 1500ms |
| 4 | Maximum | 22 | 20 | 5000ms |

**Eval Score Parsing**: Extracts depth, centipawn score (`cp`), mate-in-N (`mate`), and principal variation (`pv`) from Stockfish `info` output lines.

**Analysis Mode**: Forces Skill Level to 20 (maximum) regardless of game difficulty for accurate post-game evaluation. Default analysis depth: 14.

### UI System (`js/ui.js` — 1002 lines)

Self-executing IIFE that initializes on page load.

**Rendering Pipeline** (`render()`):
1. Iterate 64 squares (respecting board flip)
2. Apply CSS classes: light/dark, selected, highlight, last-move, in-check, dragging
3. Render per square: piece Unicode, coordinate labels, move indicators (dots/rings), analysis markers, last-move ghost
4. Update captured pieces display (sorted by piece value)

**Drag-and-Drop:**
- Mouse: `mousedown` → create ghost element following cursor → `mouseup` on target → `tryMove()`
- Touch: mirror of mouse with `touchstart`/`touchmove`/`touchend`, using `elementFromPoint` for hit testing
- Click-to-move: integrated — clicking a highlighted square executes the move without drag

**Promotion Flow**: Detects pawn reaching last rank → shows modal with 4 piece options → selected piece passed to `executeMove()`

**Game Flow State Machine:**
```
init() → Engine.init() → newGame()
  → [player turn] → selectSquare → tryMove → executeMove → push history → render
    → [engine turn] → engineMove() → getBestMove → makeMove → push history → render
      → [check game over] → loop or show result
```

**Undo Logic:**
- vs-engine mode: undoes 2 moves (your move + engine response) if it's your turn, or 1 move if engine is thinking — always returns to your turn
- Handoff mode: undoes 1 move

**Analysis System** (`runAnalysis()`):
- Evaluates each position at depth 14 using Stockfish at full strength
- Normalizes scores to White's perspective (negates when it's Black's evaluation)
- Computes centipawn loss per move relative to previous position
- Classifies based on thresholds: brilliant (≤-0.5), best (≤0), good (<0.2), inaccuracy (<0.5), mistake (<1.5), blunder (≥1.5)
- Renders accuracy percentage per side: `(brilliant + best + good) / total moves`

### CSS (`css/style.css` — 841 lines)

Dark theme with warm board colors:
- 30 CSS custom properties (board colors, piece styles, analysis colors)
- Board size: `min(80vw, 80vh, 560px)`
- Responsive breakpoints: 800px (stacked layout), 600px (full-width board)
- Analysis color coding for each classification tier
- Smooth piece transitions and hover effects

## Project Structure

```
chess/
├── index.html          # Single-page app entry (110 lines)
├── css/
│   └── style.css       # All styling (841 lines)
├── js/
│   ├── chess.js        # Chess rules engine (465 lines)
│   ├── engine.js       # Stockfish Worker wrapper (138 lines)
│   ├── ui.js           # UI controller + renderer (1002 lines)
│   └── stockfish.js    # Stockfish WASM engine (vendored)
└── .gitignore
```

## Credits

- Chess engine AI powered by [Stockfish](https://stockfishchess.org/) via [stockfish.js](https://github.com/nicfab/stockfish.js) (GPL)
- Chess pieces rendered using Unicode characters

## License

ISC
