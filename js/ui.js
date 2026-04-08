/**
 * ui.js — Board rendering, interaction, and game flow controller.
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

  // --- Game state ---
  let gameState = null;
  let history = [];         // Array of { state, move, san, captured }
  let selected = -1;
  let highlights = [];
  let lastMove = null;
  let lastMovePiece = null; // Unicode of the piece that last moved
  let flipped = false;
  let playerColor = Chess.WHITE;
  let engineThinking = false;
  let capturedByPlayer = [];
  let capturedByEngine = [];
  let engineReady = false;

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
    capturedByPlayer = [];
    capturedByEngine = [];
    engineThinking = false;
    $gameOverModal.classList.add('hidden');
    $promoModal.classList.add('hidden');
    $thinking.classList.add('hidden');

    // Auto-flip board to match player color
    flipped = playerColor === Chess.BLACK;

    if (engineReady) {
      Engine.newGame();
      Engine.setDifficulty(getDifficulty());
    }

    updateColorButtons();
    updateAll();

    // If player is black, engine moves first
    if (playerColor === Chess.BLACK && engineReady) {
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

      // Content
      let html = '';
      if (piece) {
        html = '<span class="piece">' + Chess.PIECE_UNICODE[piece.color + piece.type] + '</span>';
      }
      // Last-move piece indicator on the "from" square
      if (lastMove && lastMovePiece && dispSq === lastMove.from && !piece) {
        html += '<span class="last-move-indicator">' + lastMovePiece + '</span>';
      }
      // Move indicators
      if (selected >= 0 && highlights.includes(dispSq)) {
        const isCapture = gameState.board[dispSq] != null;
        if (isCapture) {
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
    $playerCaptures.textContent = capturedByPlayer
      .sort((a, b) => Chess.PIECE_VALUES[b.type] - Chess.PIECE_VALUES[a.type])
      .map(p => Chess.PIECE_UNICODE[p.color + p.type]).join('');
    $opponentCaptures.textContent = capturedByEngine
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

      const w = document.createElement('span');
      w.className = 'move-text' + (i === history.length - 1 ? ' current' : '');
      w.textContent = history[i].san;
      pair.appendChild(w);

      if (i + 1 < history.length) {
        const b = document.createElement('span');
        b.className = 'move-text' + (i + 1 === history.length - 1 ? ' current' : '');
        b.textContent = history[i + 1].san;
        pair.appendChild(b);
      }

      $moveList.appendChild(pair);
    }
    $moveList.scrollTop = $moveList.scrollHeight;
  }

  function updateStatus() {
    const status = Chess.getStatus(gameState);
    if (status.over) {
      showGameOver(status);
      return;
    }
    if (engineThinking) {
      $status.textContent = 'Stockfish is thinking...';
    } else if (gameState.turn === playerColor) {
      $status.textContent = status.inCheck ? 'You are in check!' : 'Your move';
    } else {
      $status.textContent = '';
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
    return !engineThinking && gameState.turn === playerColor && !Chess.getStatus(gameState).over;
  }

  function selectSquare(sq) {
    if (sq < 0) { clearSelection(); return; }
    const piece = gameState.board[sq];

    // If we have a selection and clicked a valid target, try to move
    if (selected >= 0 && highlights.includes(sq)) {
      tryMove(selected, sq);
      return;
    }

    // Select own piece
    if (piece && piece.color === playerColor) {
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
    // Check if promotion
    if (piece && piece.type === 'p') {
      const promoRow = playerColor === Chess.WHITE ? 0 : 7;
      if (Chess.row(to) === promoRow) {
        showPromotionModal(from, to);
        return;
      }
    }
    executeMove(from, to, null);
  }

  function executeMove(from, to, promotion) {
    const movedPiece = gameState.board[from];
    const result = Chess.makeMove(gameState, from, to, promotion);
    if (!result) return;

    const san = Chess.toSAN(gameState, result.move);
    if (result.captured) {
      if (gameState.turn === playerColor) capturedByPlayer.push(result.captured);
      else capturedByEngine.push(result.captured);
    }

    history.push({ state: gameState, move: result.move, san, captured: result.captured });
    gameState = result.state;
    lastMove = result.move;
    lastMovePiece = movedPiece ? Chess.PIECE_UNICODE[movedPiece.color + (promotion || movedPiece.type)] : null;
    clearSelection();
    updateAll();

    // Check if game over
    const status = Chess.getStatus(gameState);
    if (!status.over && gameState.turn !== playerColor && engineReady) {
      engineMove();
    }
  }

  // --- Engine move ---
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
    if (result.captured) capturedByEngine.push(result.captured);

    history.push({ state: gameState, move: result.move, san, captured: result.captured });
    gameState = result.state;
    lastMove = result.move;
    lastMovePiece = movedPiece ? Chess.PIECE_UNICODE[movedPiece.color + (promo || movedPiece.type)] : null;
    updateAll();
  }

  // --- Undo ---
  function undo() {
    if (engineThinking) return;
    // Undo two moves (player + engine) so it's the player's turn again
    const count = gameState.turn === playerColor ? 2 : 1;
    for (let i = 0; i < count && history.length > 0; i++) {
      const entry = history.pop();
      gameState = entry.state;
      // Remove captured pieces
      if (entry.captured) {
        if (entry.state.turn === playerColor) {
          capturedByPlayer.pop();
        } else {
          capturedByEngine.pop();
        }
      }
    }
    lastMove = history.length > 0 ? history[history.length - 1].move : null;
    lastMovePiece = null; // Reset — we don't track piece through undo chain
    clearSelection();
    updateAll();
  }

  // --- Promotion modal ---
  function showPromotionModal(from, to) {
    $promoChoices.innerHTML = '';
    const color = playerColor;
    for (const type of ['q', 'r', 'b', 'n']) {
      const btn = document.createElement('div');
      btn.className = 'promo-option';
      btn.textContent = Chess.PIECE_UNICODE[color + type];
      btn.addEventListener('click', () => {
        $promoModal.classList.add('hidden');
        executeMove(from, to, type);
      });
      $promoChoices.appendChild(btn);
    }
    $promoModal.classList.remove('hidden');
  }

  // --- Game over ---
  function showGameOver(status) {
    let title = '';
    if (status.result === 'draw') title = 'Draw';
    else if (status.result === (playerColor === Chess.WHITE ? 'white' : 'black')) title = 'You Win!';
    else title = 'Stockfish Wins';

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

    // If clicking a move target with existing selection
    if (selected >= 0 && highlights.includes(sq)) {
      tryMove(selected, sq);
      return;
    }

    if (!piece || piece.color !== playerColor) {
      clearSelection();
      render();
      return;
    }

    // Start drag
    selected = sq;
    highlights = Chess.legalMovesFrom(gameState, sq).map(m => m.to);
    dragFrom = sq;
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
      // Clicked same square — keep selection for click-click mode
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

    if (selected >= 0 && highlights.includes(sq)) {
      e.preventDefault();
      tryMove(selected, sq);
      return;
    }

    if (!piece || piece.color !== playerColor) {
      clearSelection();
      render();
      return;
    }

    e.preventDefault();
    selected = sq;
    highlights = Chess.legalMovesFrom(gameState, sq).map(m => m.to);
    dragFrom = sq;
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

  // --- Controls ---
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

    // Color chooser
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
    // Update player labels
    const $playerName = document.querySelector('#player-info .player-name');
    const $opponentName = document.querySelector('#opponent-info .player-name');
    if ($playerName) $playerName.textContent = 'You (' + (playerColor === Chess.WHITE ? 'White' : 'Black') + ')';
    if ($opponentName) $opponentName.textContent = 'Stockfish (' + (playerColor === Chess.WHITE ? 'Black' : 'White') + ')';
  }

  // --- Boot ---
  init();
})();
