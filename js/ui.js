/**
 * ui.js — Board rendering, interaction, game flow controller.
 * Modes: "vs-engine" (standard play) and "handoff" (play both sides, delegate to Stockfish).
 * Post-game analysis with move classification.
 */
(function () {
  // --- DOM refs ---
  const $board = document.getElementById('board');
  const $status = document.getElementById('status');
  const $moveList = document.getElementById('move-list');
  const $difficulty = document.getElementById('difficulty');
  const $btnNew = document.getElementById('btn-new');
  const $btnUndo = document.getElementById('btn-undo');
  const $btnFlip = document.getElementById('btn-flip');
  const $promoModal = document.getElementById('promotion-modal');
  const $promoChoices = document.getElementById('promotion-choices');
  const $gameOverModal = document.getElementById('game-over-modal');
  const $gameOverTitle = document.getElementById('game-over-title');
  const $gameOverReason = document.getElementById('game-over-reason');
  const $btnPlayAgain = document.getElementById('btn-play-again');
  const $thinking = document.getElementById('thinking-indicator');
  const $playerCaptures = document.getElementById('player-captures');
  const $opponentCaptures = document.getElementById('opponent-captures');
  const $btnWhite = document.getElementById('btn-white');
  const $btnBlack = document.getElementById('btn-black');
  const $handoffControls = document.getElementById('handoff-controls');
  const $btnHandoffWhite = document.getElementById('btn-handoff-white');
  const $btnHandoffBlack = document.getElementById('btn-handoff-black');
  const $btnHandoffStop = document.getElementById('btn-handoff-stop');
  const $handoffStatus = document.getElementById('handoff-status');
  const $analysisPanel = document.getElementById('analysis-panel');
  const $btnAnalyze = document.getElementById('btn-analyze');
  const $analysisProgress = document.getElementById('analysis-progress');
  const $progressBar = document.getElementById('progress-bar');
  const $progressText = document.getElementById('progress-text');
  const $evalBarContainer = document.getElementById('eval-bar-container');
  const $evalBar = document.getElementById('eval-bar');
  const $evalText = document.getElementById('eval-text');
  const $analysisSummary = document.getElementById('analysis-summary');
  const $colorChooser = document.getElementById('color-chooser');

  // --- Game state ---
  let gameState = null;
  let history = [];         // Array of { state, move, san, captured, enginePlayed }
  let selected = -1;
  let highlights = [];
  let lastMove = null;
  let lastMovePiece = null;
  let flipped = false;
  let playerColor = Chess.WHITE;
  let engineThinking = false;
  let capturedByWhite = [];
  let capturedByBlack = [];
  let engineReady = false;

  // --- Mode state ---
  let gameMode = 'vs-engine'; // 'vs-engine' | 'handoff'
  let handoffColor = null;    // null = human plays both, 'w' or 'b' = engine plays that color
  let analysisRunning = false;
  let analysisResults = [];   // per-move analysis: { eval, classification, bestMove }

  // --- Drag state ---
  let dragFrom = -1;
  let dragGhost = null;

  // --- Init ---
  async function init() {
    createBoard();
    bindControls();
    createDragGhost();

    $status.textContent = 'Loading engine...';
    try {
      await Engine.init();
      engineReady = true;
      $status.textContent = '';
      newGame();
    } catch (e) {
      $status.textContent = 'Engine failed to load. Try refreshing.';
      console.error(e);
    }
  }

  function newGame() {
    gameState = Chess.create();
    history = [];
    selected = -1;
    highlights = [];
    lastMove = null;
    lastMovePiece = null;
    capturedByWhite = [];
    capturedByBlack = [];
    engineThinking = false;
    handoffColor = null;
    analysisResults = [];
    $gameOverModal.classList.add('hidden');
    $promoModal.classList.add('hidden');
    $thinking.classList.add('hidden');
    $analysisSummary.classList.remove('visible');
    $analysisSummary.innerHTML = '';
    $analysisProgress.classList.remove('visible');
    $evalBarContainer.classList.remove('visible');

    if (gameMode === 'vs-engine') {
      flipped = playerColor === Chess.BLACK;
    } else {
      flipped = false;
    }

    if (engineReady) {
      Engine.newGame();
      Engine.setDifficulty(getDifficulty());
    }

    updateModeUI();
    updateColorButtons();
    updateHandoffUI();
    updateAll();

    // In vs-engine mode, if player is black, engine moves first
    if (gameMode === 'vs-engine' && playerColor === Chess.BLACK && engineReady) {
      engineMove();
    }
  }

  function getDifficulty() {
    return parseInt($difficulty.value) || 3;
  }

  // --- Board creation ---
  function createBoard() {
    $board.innerHTML = '';
    for (let i = 0; i < 64; i++) {
      const div = document.createElement('div');
      div.className = 'square';
      div.dataset.sq = i;
      $board.appendChild(div);
    }
    $board.addEventListener('mousedown', onMouseDown);
    $board.addEventListener('touchstart', onTouchStart, { passive: false });
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd);
  }

  function createDragGhost() {
    dragGhost = document.createElement('div');
    dragGhost.id = 'drag-ghost';
    document.body.appendChild(dragGhost);
  }

  // --- Render ---
  function render() {
    const squares = $board.children;
    const checkSq = Chess.isInCheck(gameState.board, gameState.turn)
      ? Chess.findKing(gameState.board, gameState.turn) : -1;

    for (let i = 0; i < 64; i++) {
      const dispSq = flipped ? 63 - i : i;
      const r = Chess.row(dispSq), c = Chess.col(dispSq);
      const isLight = (r + c) % 2 === 0;
      const piece = gameState.board[dispSq];
      const sq = squares[i];

      // Base classes
      let cls = 'square ' + (isLight ? 'light' : 'dark');
      if (dispSq === selected) cls += ' selected';
      if (highlights.includes(dispSq)) cls += ' highlight';
      if (lastMove && (dispSq === lastMove.from || dispSq === lastMove.to)) cls += ' last-move';
      if (dispSq === checkSq) cls += ' in-check';
      if (dragFrom === dispSq) cls += ' dragging';
      sq.className = cls;
      sq.dataset.sq = dispSq;

      // Build content
      let html = '';

      // Coordinate labels
      const fileIdx = flipped ? 7 - c : c;
      const rankIdx = flipped ? r : 7 - r;
      // File label on bottom row
      if (i >= 56) {
        html += '<span class="coord-label coord-file">' + 'abcdefgh'[fileIdx] + '</span>';
      }
      // Rank label on left column
      if (i % 8 === 0) {
        html += '<span class="coord-label coord-rank">' + (rankIdx + 1) + '</span>';
      }

      // Piece
      if (piece) {
        const pieceClass = piece.color === 'w' ? 'white-piece' : 'black-piece';
        html += '<span class="piece ' + pieceClass + '">' + Chess.PIECE_UNICODE[piece.color + piece.type] + '</span>';
      }

      // Last-move piece indicator on the "from" square
      if (lastMove && lastMovePiece && dispSq === lastMove.from && !piece) {
        html += '<span class="last-move-indicator">' + lastMovePiece + '</span>';
      }

      // Analysis marker on the "to" square of last move
      if (analysisResults.length > 0 && lastMove) {
        const moveIdx = history.length - 1;
        if (moveIdx >= 0 && moveIdx < analysisResults.length && dispSq === lastMove.to) {
          const cls = analysisResults[moveIdx] ? analysisResults[moveIdx].classification : null;
          if (cls && cls !== 'best' && cls !== 'good') {
            html += '<div class="analysis-marker ' + cls + '"></div>';
          }
        }
      }

      // Move indicators
      if (selected >= 0 && highlights.includes(dispSq)) {
        if (gameState.board[dispSq] != null) {
          html += '<div class="capture-ring"></div>';
        } else {
          html += '<div class="move-dot"></div>';
        }
      }
      sq.innerHTML = html;
    }

    renderCaptures();
  }

  function renderCaptures() {
    const topIsBlack = !flipped;
    const topCaptures = topIsBlack ? capturedByBlack : capturedByWhite;
    const botCaptures = topIsBlack ? capturedByWhite : capturedByBlack;

    $opponentCaptures.textContent = topCaptures
      .sort((a, b) => Chess.PIECE_VALUES[b.type] - Chess.PIECE_VALUES[a.type])
      .map(p => Chess.PIECE_UNICODE[p.color + p.type]).join('');
    $playerCaptures.textContent = botCaptures
      .sort((a, b) => Chess.PIECE_VALUES[b.type] - Chess.PIECE_VALUES[a.type])
      .map(p => Chess.PIECE_UNICODE[p.color + p.type]).join('');
  }

  function renderMoveList() {
    $moveList.innerHTML = '';
    for (let i = 0; i < history.length; i += 2) {
      const moveNum = Math.floor(i / 2) + 1;
      const pair = document.createElement('div');
      pair.className = 'move-pair';

      const num = document.createElement('span');
      num.className = 'move-num';
      num.textContent = moveNum + '.';
      pair.appendChild(num);

      // White's move
      const w = document.createElement('span');
      let wCls = 'move-text';
      if (i === history.length - 1) wCls += ' current';
      if (history[i].enginePlayed) wCls += ' engine-move';
      w.className = wCls;
      w.textContent = history[i].san;
      // Add analysis annotation dot
      if (analysisResults[i] && analysisResults[i].classification) {
        const dot = document.createElement('span');
        dot.className = 'move-annotation ' + analysisResults[i].classification;
        w.appendChild(dot);
      }
      w.addEventListener('click', () => goToMove(i));
      pair.appendChild(w);

      // Black's move
      if (i + 1 < history.length) {
        const b = document.createElement('span');
        let bCls = 'move-text';
        if (i + 1 === history.length - 1) bCls += ' current';
        if (history[i + 1].enginePlayed) bCls += ' engine-move';
        b.className = bCls;
        b.textContent = history[i + 1].san;
        if (analysisResults[i + 1] && analysisResults[i + 1].classification) {
          const dot = document.createElement('span');
          dot.className = 'move-annotation ' + analysisResults[i + 1].classification;
          b.appendChild(dot);
        }
        b.addEventListener('click', () => goToMove(i + 1));
        pair.appendChild(b);
      }

      $moveList.appendChild(pair);
    }
    $moveList.scrollTop = $moveList.scrollHeight;
  }

  function goToMove(idx) {
    // Navigate to a specific position in history
    if (idx < 0 || idx >= history.length) return;
    // We can't truly go back in time without replaying, so just show eval info
    // For now, highlight the move and show its eval
    if (analysisResults[idx]) {
      const ar = analysisResults[idx];
      showEvalBar(ar.eval, history[idx].state.turn);
    }
  }

  function showEvalBar(evalScore, turn) {
    if (evalScore == null) return;
    $evalBarContainer.classList.add('visible');
    // Score is from white's perspective
    const clamped = Math.max(-10, Math.min(10, evalScore));
    const pct = 50 + (clamped / 10) * 50;
    $evalBar.style.width = pct + '%';
    const sign = evalScore > 0 ? '+' : '';
    $evalText.textContent = sign + evalScore.toFixed(1);
  }

  function updateStatus() {
    const status = Chess.getStatus(gameState);
    if (status.over) {
      showGameOver(status);
      return;
    }
    if (engineThinking) {
      $status.textContent = 'Stockfish is thinking...';
    } else if (gameMode === 'vs-engine') {
      if (gameState.turn === playerColor) {
        $status.textContent = status.inCheck ? 'You are in check!' : 'Your move';
      } else {
        $status.textContent = '';
      }
    } else {
      // Handoff mode
      const turnLabel = gameState.turn === Chess.WHITE ? 'White' : 'Black';
      if (handoffColor === gameState.turn) {
        $status.textContent = 'Stockfish is playing as ' + turnLabel + '...';
      } else {
        $status.textContent = turnLabel + ' to move' + (status.inCheck ? ' (in check!)' : '');
      }
    }
  }

  function updateAll() {
    render();
    renderMoveList();
    updateStatus();
  }

  // --- Interaction ---
  function getSquareFromEvent(e) {
    const target = e.target.closest('.square');
    if (!target) return -1;
    return parseInt(target.dataset.sq);
  }

  function canInteract() {
    if (engineThinking) return false;
    if (Chess.getStatus(gameState).over) return false;
    if (gameMode === 'vs-engine') {
      return gameState.turn === playerColor;
    }
    // Handoff mode: can interact if engine is NOT controlling current turn
    return handoffColor !== gameState.turn;
  }

  function selectSquare(sq) {
    if (sq < 0) { clearSelection(); return; }
    const piece = gameState.board[sq];

    // If we have a selection and clicked a valid target, try to move
    if (selected >= 0 && highlights.includes(sq)) {
      tryMove(selected, sq);
      return;
    }

    // In handoff mode, can pick up any piece of the current turn's color
    const allowedColor = (gameMode === 'handoff') ? gameState.turn : playerColor;
    if (piece && piece.color === allowedColor) {
      selected = sq;
      highlights = Chess.legalMovesFrom(gameState, sq).map(m => m.to);
    } else {
      clearSelection();
    }
    render();
  }

  function clearSelection() {
    selected = -1;
    highlights = [];
  }

  function tryMove(from, to) {
    const piece = gameState.board[from];
    if (piece && piece.type === 'p') {
      const promoRow = piece.color === Chess.WHITE ? 0 : 7;
      if (Chess.row(to) === promoRow) {
        showPromotionModal(from, to, piece.color);
        return;
      }
    }
    executeMove(from, to, null, false);
  }

  function executeMove(from, to, promotion, isEnginePlayed) {
    const movedPiece = gameState.board[from];
    const result = Chess.makeMove(gameState, from, to, promotion);
    if (!result) return;

    const san = Chess.toSAN(gameState, result.move);
    if (result.captured) {
      // Track captures by which color made the capture
      if (gameState.turn === Chess.WHITE) {
        capturedByWhite.push(result.captured);
      } else {
        capturedByBlack.push(result.captured);
      }
    }

    history.push({
      state: gameState,
      move: result.move,
      san,
      captured: result.captured,
      enginePlayed: isEnginePlayed,
    });
    gameState = result.state;
    lastMove = result.move;
    lastMovePiece = movedPiece ? Chess.PIECE_UNICODE[movedPiece.color + (promotion || movedPiece.type)] : null;
    clearSelection();
    updateAll();

    // Check if game over
    const status = Chess.getStatus(gameState);
    if (status.over) return;

    if (gameMode === 'vs-engine') {
      // Engine plays the other color
      if (gameState.turn !== playerColor && engineReady) {
        engineMove();
      }
    } else {
      // Handoff mode: if engine controls the next turn's color, let it play
      if (handoffColor === gameState.turn && engineReady) {
        setTimeout(() => engineMoveHandoff(), 300);
      }
    }
  }

  // --- Engine move (vs-engine mode) ---
  async function engineMove() {
    engineThinking = true;
    $thinking.classList.remove('hidden');
    updateStatus();

    const fen = Chess.toFEN(gameState);
    const bestUci = await Engine.getBestMove(fen, getDifficulty());

    engineThinking = false;
    $thinking.classList.add('hidden');

    if (!bestUci) return;

    const from = Chess.fromAlg(bestUci.substring(0, 2));
    const to = Chess.fromAlg(bestUci.substring(2, 4));
    const promo = bestUci.length > 4 ? bestUci[4] : null;

    const movedPiece = gameState.board[from];
    const result = Chess.makeMove(gameState, from, to, promo);
    if (!result) { console.error('Engine returned illegal move:', bestUci); return; }

    const san = Chess.toSAN(gameState, result.move);
    if (result.captured) {
      if (gameState.turn === Chess.WHITE) {
        capturedByWhite.push(result.captured);
      } else {
        capturedByBlack.push(result.captured);
      }
    }

    history.push({
      state: gameState,
      move: result.move,
      san,
      captured: result.captured,
      enginePlayed: true,
    });
    gameState = result.state;
    lastMove = result.move;
    lastMovePiece = movedPiece ? Chess.PIECE_UNICODE[movedPiece.color + (promo || movedPiece.type)] : null;
    updateAll();
  }

  // --- Engine move (handoff mode) ---
  async function engineMoveHandoff() {
    if (handoffColor !== gameState.turn) return; // user took back control
    if (Chess.getStatus(gameState).over) return;

    engineThinking = true;
    $thinking.classList.remove('hidden');
    updateStatus();

    const fen = Chess.toFEN(gameState);
    const bestUci = await Engine.getBestMove(fen, getDifficulty());

    engineThinking = false;
    $thinking.classList.add('hidden');

    if (!bestUci) return;
    // Check again — user might have stopped handoff while we were thinking
    if (handoffColor !== history.length > 0 ? gameState.turn : null) {
      // Re-check: if handoff is still active for this color
    }

    const from = Chess.fromAlg(bestUci.substring(0, 2));
    const to = Chess.fromAlg(bestUci.substring(2, 4));
    const promo = bestUci.length > 4 ? bestUci[4] : null;

    executeMove(from, to, promo, true);
  }

  // --- Undo ---
  function undo() {
    if (engineThinking) return;
    if (history.length === 0) return;

    if (gameMode === 'vs-engine') {
      // Undo two moves (player + engine) so it's the player's turn again
      const count = gameState.turn === playerColor ? 2 : 1;
      for (let i = 0; i < count && history.length > 0; i++) {
        undoOne();
      }
    } else {
      // Handoff mode: undo one move
      undoOne();
    }
    lastMove = history.length > 0 ? history[history.length - 1].move : null;
    lastMovePiece = null;
    clearSelection();
    updateAll();
  }

  function undoOne() {
    const entry = history.pop();
    if (!entry) return;
    gameState = entry.state;
    if (entry.captured) {
      if (entry.state.turn === Chess.WHITE) {
        capturedByWhite.pop();
      } else {
        capturedByBlack.pop();
      }
    }
    // Trim analysis results if needed
    if (analysisResults.length > history.length) {
      analysisResults.length = history.length;
    }
  }

  // --- Promotion modal ---
  function showPromotionModal(from, to, color) {
    $promoChoices.innerHTML = '';
    for (const type of ['q', 'r', 'b', 'n']) {
      const btn = document.createElement('div');
      btn.className = 'promo-option';
      btn.textContent = Chess.PIECE_UNICODE[color + type];
      btn.addEventListener('click', () => {
        $promoModal.classList.add('hidden');
        executeMove(from, to, type, false);
      });
      $promoChoices.appendChild(btn);
    }
    $promoModal.classList.remove('hidden');
  }

  // --- Game over ---
  function showGameOver(status) {
    let title = '';
    if (status.result === 'draw') {
      title = 'Draw';
    } else if (gameMode === 'vs-engine') {
      if (status.result === (playerColor === Chess.WHITE ? 'white' : 'black')) title = 'You Win!';
      else title = 'Stockfish Wins';
    } else {
      title = status.result === 'white' ? 'White Wins!' : 'Black Wins!';
    }

    const reasons = {
      checkmate: 'by checkmate',
      stalemate: 'by stalemate',
      '50-move rule': 'by 50-move rule',
      'insufficient material': 'by insufficient material',
    };

    $gameOverTitle.textContent = title;
    $gameOverReason.textContent = reasons[status.reason] || status.reason;
    $gameOverModal.classList.remove('hidden');
  }

  // --- Drag and drop ---
  function onMouseDown(e) {
    if (e.button !== 0) return;
    if (!canInteract()) return;
    const sq = getSquareFromEvent(e);
    if (sq < 0) return;

    const piece = gameState.board[sq];
    const allowedColor = (gameMode === 'handoff') ? gameState.turn : playerColor;

    // If clicking a move target with existing selection
    if (selected >= 0 && highlights.includes(sq)) {
      tryMove(selected, sq);
      return;
    }

    if (!piece || piece.color !== allowedColor) {
      clearSelection();
      render();
      return;
    }

    // Start drag
    selected = sq;
    highlights = Chess.legalMovesFrom(gameState, sq).map(m => m.to);
    dragFrom = sq;
    const pieceClass = piece.color === 'w' ? 'white-piece' : 'black-piece';
    dragGhost.className = pieceClass;
    dragGhost.id = 'drag-ghost';
    dragGhost.textContent = Chess.PIECE_UNICODE[piece.color + piece.type];
    dragGhost.style.display = 'block';
    moveDragGhost(e.clientX, e.clientY);
    render();
  }

  function onMouseMove(e) {
    if (dragFrom < 0) return;
    moveDragGhost(e.clientX, e.clientY);
  }

  function onMouseUp(e) {
    if (dragFrom < 0) return;
    dragGhost.style.display = 'none';
    const sq = getSquareFromEvent(e);
    const oldDragFrom = dragFrom;
    dragFrom = -1;

    if (sq >= 0 && highlights.includes(sq)) {
      tryMove(selected, sq);
    } else if (sq === oldDragFrom) {
      render();
    } else {
      clearSelection();
      render();
    }
  }

  function onTouchStart(e) {
    if (!canInteract()) return;
    const touch = e.touches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!el) return;
    const sqEl = el.closest('.square');
    if (!sqEl) return;
    const sq = parseInt(sqEl.dataset.sq);

    const piece = gameState.board[sq];
    const allowedColor = (gameMode === 'handoff') ? gameState.turn : playerColor;

    if (selected >= 0 && highlights.includes(sq)) {
      e.preventDefault();
      tryMove(selected, sq);
      return;
    }

    if (!piece || piece.color !== allowedColor) {
      clearSelection();
      render();
      return;
    }

    e.preventDefault();
    selected = sq;
    highlights = Chess.legalMovesFrom(gameState, sq).map(m => m.to);
    dragFrom = sq;
    const pieceClass = piece.color === 'w' ? 'white-piece' : 'black-piece';
    dragGhost.className = pieceClass;
    dragGhost.id = 'drag-ghost';
    dragGhost.textContent = Chess.PIECE_UNICODE[piece.color + piece.type];
    dragGhost.style.display = 'block';
    moveDragGhost(touch.clientX, touch.clientY);
    render();
  }

  function onTouchMove(e) {
    if (dragFrom < 0) return;
    e.preventDefault();
    const touch = e.touches[0];
    moveDragGhost(touch.clientX, touch.clientY);
  }

  function onTouchEnd(e) {
    if (dragFrom < 0) return;
    dragGhost.style.display = 'none';
    const touch = e.changedTouches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    const sqEl = el ? el.closest('.square') : null;
    const sq = sqEl ? parseInt(sqEl.dataset.sq) : -1;
    const oldDragFrom = dragFrom;
    dragFrom = -1;

    if (sq >= 0 && highlights.includes(sq)) {
      tryMove(selected, sq);
    } else if (sq === oldDragFrom) {
      render();
    } else {
      clearSelection();
      render();
    }
  }

  function moveDragGhost(x, y) {
    dragGhost.style.left = x + 'px';
    dragGhost.style.top = y + 'px';
  }

  // ===================== MODE & HANDOFF =====================

  function setMode(mode) {
    gameMode = mode;
    // Update mode buttons
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    newGame();
  }

  function updateModeUI() {
    // Show/hide color chooser in vs-engine mode
    $colorChooser.style.display = gameMode === 'vs-engine' ? 'flex' : 'none';
    // Show/hide handoff controls
    $handoffControls.classList.toggle('visible', gameMode === 'handoff');
    // Always show analysis panel
    $analysisPanel.classList.add('visible');
  }

  function updateHandoffUI() {
    $btnHandoffWhite.classList.toggle('active-handoff', handoffColor === Chess.WHITE);
    $btnHandoffBlack.classList.toggle('active-handoff', handoffColor === Chess.BLACK);
    $btnHandoffStop.style.display = handoffColor ? 'block' : 'none';

    if (handoffColor) {
      const label = handoffColor === Chess.WHITE ? 'White' : 'Black';
      $handoffStatus.textContent = 'Stockfish is playing ' + label;
    } else {
      $handoffStatus.textContent = 'You control both sides';
    }
  }

  function startHandoff(color) {
    if (engineThinking) return;
    handoffColor = color;
    Engine.setDifficulty(getDifficulty());
    updateHandoffUI();
    updateStatus();

    // If it's currently this color's turn, start engine immediately
    if (gameState.turn === handoffColor && !Chess.getStatus(gameState).over) {
      engineMoveHandoff();
    }
  }

  function stopHandoff() {
    handoffColor = null;
    Engine.stop();
    updateHandoffUI();
    updateStatus();
  }

  // ===================== ANALYSIS =====================

  async function runAnalysis() {
    if (history.length === 0) return;
    if (analysisRunning) return;

    analysisRunning = true;
    analysisResults = [];
    $btnAnalyze.disabled = true;
    $btnAnalyze.textContent = 'Analyzing...';
    $analysisProgress.classList.add('visible');
    $analysisSummary.classList.remove('visible');
    $evalBarContainer.classList.add('visible');

    const depth = 14; // analysis depth
    let prevEval = 0; // starting eval (equal position)

    for (let i = 0; i < history.length; i++) {
      if (!analysisRunning) break;

      const pct = Math.round(((i + 1) / history.length) * 100);
      $progressBar.style.width = pct + '%';
      $progressText.textContent = 'Analyzing move ' + (i + 1) + ' of ' + history.length + '...';

      // Evaluate the position AFTER this move was played
      const fenAfter = Chess.toFEN(
        i + 1 < history.length ? history[i + 1].state : gameState
      );

      const result = await Engine.evaluate(fenAfter, depth);

      let evalScore = 0;
      if (result && result.info) {
        if (result.info.scoreType === 'mate') {
          evalScore = result.info.mate > 0 ? 100 : -100;
        } else {
          evalScore = result.info.score || 0;
        }
        // Stockfish score is from the side-to-move's perspective after the move
        // We need to normalize to always be from White's perspective
        // After move i, it's the opponent's turn to move
        // The state stored at history[i].state is BEFORE the move (the mover's turn)
        // So the FEN we evaluated is from the perspective of the player who DIDN'T just move
        const moverColor = history[i].state.turn; // who made move i
        if (moverColor === Chess.WHITE) {
          // After white moved, it's black's turn, Stockfish gives score for black
          evalScore = -evalScore;
        }
        // Now evalScore is from White's perspective
      }

      // Classify the move by comparing eval before and after
      const evalDelta = evalScore - prevEval;
      const moverColor = history[i].state.turn;
      // If white moved and eval went down, it's bad for white. If black moved and eval went up, it's bad for black.
      const isGoodForMover = moverColor === Chess.WHITE ? evalDelta >= 0 : evalDelta <= 0;
      const absLoss = moverColor === Chess.WHITE ? -evalDelta : evalDelta;

      let classification;
      if (absLoss <= -0.5) {
        classification = 'brilliant'; // significantly improved position beyond expectation
      } else if (absLoss <= 0) {
        classification = 'best';
      } else if (absLoss < 0.2) {
        classification = 'good';
      } else if (absLoss < 0.5) {
        classification = 'inaccuracy';
      } else if (absLoss < 1.5) {
        classification = 'mistake';
      } else {
        classification = 'blunder';
      }

      analysisResults.push({
        eval: evalScore,
        prevEval,
        delta: evalDelta,
        classification,
        bestMove: result ? result.bestMove : null,
      });

      prevEval = evalScore;
      showEvalBar(evalScore);
    }

    // Restore engine difficulty after analysis
    if (engineReady) {
      Engine.setDifficulty(getDifficulty());
    }

    analysisRunning = false;
    $btnAnalyze.disabled = false;
    $btnAnalyze.textContent = 'Re-analyze';
    $analysisProgress.classList.remove('visible');

    renderAnalysisSummary();
    renderMoveList(); // re-render with annotations
    render(); // re-render board with markers
  }

  function renderAnalysisSummary() {
    if (analysisResults.length === 0) return;

    // Count classifications per side
    const counts = {
      w: { brilliant: 0, best: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 },
      b: { brilliant: 0, best: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 },
    };

    for (let i = 0; i < analysisResults.length; i++) {
      const color = history[i].state.turn;
      const cls = analysisResults[i].classification;
      if (counts[color][cls] !== undefined) counts[color][cls]++;
    }

    // Calculate accuracy (simplified: % of moves that are best/good/brilliant)
    const wTotal = Object.values(counts.w).reduce((a, b) => a + b, 0);
    const bTotal = Object.values(counts.b).reduce((a, b) => a + b, 0);
    const wGood = counts.w.brilliant + counts.w.best + counts.w.good;
    const bGood = counts.b.brilliant + counts.b.best + counts.b.good;
    const wAccuracy = wTotal > 0 ? Math.round((wGood / wTotal) * 100) : 0;
    const bAccuracy = bTotal > 0 ? Math.round((bGood / bTotal) * 100) : 0;

    let html = '';
    html += '<div class="accuracy-score" style="color:var(--text)">' + wAccuracy + '% / ' + bAccuracy + '%</div>';
    html += '<div class="accuracy-label">White accuracy / Black accuracy</div>';

    const categories = [
      { key: 'brilliant', label: 'Brilliant', color: 'var(--brilliant)' },
      { key: 'best', label: 'Best move', color: 'var(--best)' },
      { key: 'good', label: 'Good', color: 'var(--good)' },
      { key: 'inaccuracy', label: 'Inaccuracy', color: 'var(--inaccuracy)' },
      { key: 'mistake', label: 'Mistake', color: 'var(--mistake)' },
      { key: 'blunder', label: 'Blunder', color: 'var(--blunder)' },
    ];

    for (const cat of categories) {
      const wCount = counts.w[cat.key];
      const bCount = counts.b[cat.key];
      if (wCount === 0 && bCount === 0) continue;
      html += '<div class="summary-row">';
      html += '<span class="summary-label"><span class="summary-dot" style="background:' + cat.color + '"></span>' + cat.label + '</span>';
      html += '<span class="summary-value">' + wCount + ' / ' + bCount + '</span>';
      html += '</div>';
    }

    $analysisSummary.innerHTML = html;
    $analysisSummary.classList.add('visible');
  }

  // ===================== CONTROLS =====================

  function bindControls() {
    $btnNew.addEventListener('click', newGame);
    $btnUndo.addEventListener('click', undo);
    $btnFlip.addEventListener('click', () => {
      flipped = !flipped;
      render();
    });
    $btnPlayAgain.addEventListener('click', newGame);
    $difficulty.addEventListener('change', () => {
      if (engineReady) Engine.setDifficulty(getDifficulty());
    });

    // Color chooser (vs-engine mode)
    $btnWhite.addEventListener('click', () => {
      if (playerColor === Chess.WHITE) return;
      playerColor = Chess.WHITE;
      updateColorButtons();
      newGame();
    });
    $btnBlack.addEventListener('click', () => {
      if (playerColor === Chess.BLACK) return;
      playerColor = Chess.BLACK;
      updateColorButtons();
      newGame();
    });

    // Mode selector
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => setMode(btn.dataset.mode));
    });

    // Handoff controls
    $btnHandoffWhite.addEventListener('click', () => {
      if (handoffColor === Chess.WHITE) {
        stopHandoff();
      } else {
        startHandoff(Chess.WHITE);
      }
    });
    $btnHandoffBlack.addEventListener('click', () => {
      if (handoffColor === Chess.BLACK) {
        stopHandoff();
      } else {
        startHandoff(Chess.BLACK);
      }
    });
    $btnHandoffStop.addEventListener('click', stopHandoff);

    // Analysis
    $btnAnalyze.addEventListener('click', () => {
      if (analysisRunning) return;
      runAnalysis();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'z' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); undo(); }
      if (e.key === 'n' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); newGame(); }
      if (e.key === 'f' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); flipped = !flipped; render(); }
    });
  }

  function updateColorButtons() {
    $btnWhite.classList.toggle('active', playerColor === Chess.WHITE);
    $btnBlack.classList.toggle('active', playerColor === Chess.BLACK);
    const $playerName = document.querySelector('#player-info .player-name');
    const $opponentName = document.querySelector('#opponent-info .player-name');
    if (gameMode === 'vs-engine') {
      if ($playerName) $playerName.textContent = 'You (' + (playerColor === Chess.WHITE ? 'White' : 'Black') + ')';
      if ($opponentName) $opponentName.textContent = 'Stockfish (' + (playerColor === Chess.WHITE ? 'Black' : 'White') + ')';
    } else {
      if ($playerName) $playerName.textContent = 'Black';
      if ($opponentName) $opponentName.textContent = 'White';
    }
  }

  // --- Boot ---
  init();
})();
