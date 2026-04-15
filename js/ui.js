/**
 * ui.js — Board rendering, interaction, game flow controller.
 * Modes: "vs-engine", "handoff", "learn" (tutorials).
 * Features: live move coach, engine thinking panel, hint arrows, post-game analysis.
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
  const $btnHint = document.getElementById('btn-hint');
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
  const $arrowSvg = document.getElementById('arrow-svg');

  // Coach panel refs
  const $coachPanel = document.getElementById('coach-panel');
  const $coachToggle = document.getElementById('coach-toggle');
  const $coachContent = document.getElementById('coach-content');
  const $coachIcon = document.getElementById('coach-icon');
  const $coachTitleText = document.getElementById('coach-title-text');
  const $coachDetail = document.getElementById('coach-detail');

  // Suggestion panel refs
  const $suggestionPanel = document.getElementById('suggestion-panel');
  const $suggestionMove = document.getElementById('suggestion-move');
  const $suggestionReason = document.getElementById('suggestion-reason');

  // Thinking panel refs
  const $thinkingPanel = document.getElementById('thinking-panel');
  const $thinkingEval = document.getElementById('thinking-eval');
  const $thinkingDepth = document.getElementById('thinking-depth');
  const $thinkingPV = document.getElementById('thinking-pv');
  const $thinkingNPS = document.getElementById('thinking-nps');

  // Tutorial refs
  const $gameLayout = document.getElementById('game-layout');
  const $tutorialLayout = document.getElementById('tutorial-layout');
  const $tutorialBrowser = document.getElementById('tutorial-browser');
  const $tutorialCategories = document.getElementById('tutorial-categories');
  const $tutorialLesson = document.getElementById('tutorial-lesson');
  const $btnTutorialBack = document.getElementById('btn-tutorial-back');
  const $tutorialLessonTitle = document.getElementById('tutorial-lesson-title');
  const $tutorialStepCounter = document.getElementById('tutorial-step-counter');
  const $tutorialBoard = document.getElementById('tutorial-board');
  const $tutorialArrowSvg = document.getElementById('tutorial-arrow-svg');
  const $tutorialText = document.getElementById('tutorial-text');
  const $tutorialHint = document.getElementById('tutorial-hint');
  const $tutorialFeedback = document.getElementById('tutorial-feedback');
  const $btnTutorialPrev = document.getElementById('btn-tutorial-prev');
  const $btnTutorialNext = document.getElementById('btn-tutorial-next');
  const $btnTutorialHint = document.getElementById('btn-tutorial-hint');

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
  let gameMode = 'vs-engine'; // 'vs-engine' | 'handoff' | 'learn'
  let handoffColor = null;
  let analysisRunning = false;
  let analysisResults = [];

  // --- Coach state ---
  let coachEnabled = true;
  let suggestionSquares = [];      // squares to show best-move dots on

  // --- Hint state ---
  let hintPending = false;

  // --- Drag state ---
  let dragFrom = -1;
  let dragGhost = null;

  // --- Tutorial state ---
  let tutorialLesson = null;       // current lesson object
  let tutorialStepIdx = 0;         // current step index
  let tutorialGameState = null;    // Chess state for tutorial board
  let tutorialSelected = -1;
  let tutorialHighlights = [];
  let tutorialPuzzleSolved = false;

  // ===================== INIT =====================

  async function init() {
    createBoard();
    createTutorialBoard();
    bindControls();
    createDragGhost();
    initArrowDefs($arrowSvg, 'arrowhead', 'rgba(88,166,255,0.6)');
    initArrowDefs($tutorialArrowSvg, 'arrowhead-tutorial', 'rgba(255,170,50,0.6)');

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
    hintPending = false;
    $gameOverModal.classList.add('hidden');
    $promoModal.classList.add('hidden');
    $thinking.classList.add('hidden');
    $analysisSummary.classList.remove('visible');
    $analysisSummary.innerHTML = '';
    $analysisProgress.classList.remove('visible');
    $evalBarContainer.classList.remove('visible');
    clearArrows($arrowSvg);
    resetCoachPanel();

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
    // If player is white, suggest best opening move
    if (gameMode === 'vs-engine' && playerColor === Chess.WHITE && engineReady) {
      runSuggestion();
    }
  }

  function getDifficulty() {
    return parseInt($difficulty.value) || 3;
  }

  // ===================== BOARD CREATION =====================

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

  function createTutorialBoard() {
    $tutorialBoard.innerHTML = '';
    for (let i = 0; i < 64; i++) {
      const div = document.createElement('div');
      div.className = 'square';
      div.dataset.sq = i;
      $tutorialBoard.appendChild(div);
    }
    $tutorialBoard.addEventListener('click', onTutorialBoardClick);
  }

  function createDragGhost() {
    dragGhost = document.createElement('div');
    dragGhost.id = 'drag-ghost';
    document.body.appendChild(dragGhost);
  }

  // ===================== ARROW DRAWING =====================

  function initArrowDefs(svgEl, markerId, color) {
    // Create SVG defs with arrowhead marker
    const ns = 'http://www.w3.org/2000/svg';
    const defs = document.createElementNS(ns, 'defs');
    const marker = document.createElementNS(ns, 'marker');
    marker.setAttribute('id', markerId);
    marker.setAttribute('markerWidth', '10');
    marker.setAttribute('markerHeight', '7');
    marker.setAttribute('refX', '10');
    marker.setAttribute('refY', '3.5');
    marker.setAttribute('orient', 'auto');
    marker.setAttribute('markerUnits', 'strokeWidth');
    const polygon = document.createElementNS(ns, 'polygon');
    polygon.setAttribute('points', '0 0, 10 3.5, 0 7');
    polygon.setAttribute('fill', color);
    marker.appendChild(polygon);
    defs.appendChild(marker);
    svgEl.appendChild(defs);
  }

  /**
   * Draw an arrow on the SVG overlay.
   * @param {SVGElement} svgEl - the SVG overlay element
   * @param {string} fromSq - algebraic square (e.g. 'e2')
   * @param {string} toSq - algebraic square (e.g. 'e4')
   * @param {string} cssClass - CSS class(es) for the arrow line (space-separated)
   * @param {boolean} isFlipped - whether the board is flipped
   * @param {string} [markerId] - SVG marker ID for arrowhead (e.g. 'arrowhead-pv')
   */
  function drawArrow(svgEl, fromSq, toSq, cssClass, isFlipped, markerId) {
    const ns = 'http://www.w3.org/2000/svg';
    const from = squareToCoords(fromSq, isFlipped);
    const to = squareToCoords(toSq, isFlipped);
    const line = document.createElementNS(ns, 'line');
    line.setAttribute('x1', from.x);
    line.setAttribute('y1', from.y);
    line.setAttribute('x2', to.x);
    line.setAttribute('y2', to.y);
    // classList.add doesn't accept space-separated strings; split them
    cssClass.split(' ').forEach(function(cls) { if (cls) line.classList.add(cls); });
    if (markerId) {
      line.setAttribute('marker-end', 'url(#' + markerId + ')');
    }
    svgEl.appendChild(line);
  }

  function squareToCoords(algSq, isFlipped) {
    const file = algSq.charCodeAt(0) - 97; // 0-7
    const rank = parseInt(algSq[1]) - 1;    // 0-7
    let col = isFlipped ? 7 - file : file;
    let row = isFlipped ? rank : 7 - rank;
    return {
      x: col * 12.5 + 6.25,  // center of square
      y: row * 12.5 + 6.25,
    };
  }

  function clearArrows(svgEl) {
    // Remove all children except <defs>
    const children = Array.from(svgEl.children);
    for (const child of children) {
      if (child.tagName !== 'defs') {
        svgEl.removeChild(child);
      }
    }
  }

  // ===================== RENDER =====================

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

      let cls = 'square ' + (isLight ? 'light' : 'dark');
      if (dispSq === selected) cls += ' selected';
      if (highlights.includes(dispSq)) cls += ' highlight';
      if (lastMove && (dispSq === lastMove.from || dispSq === lastMove.to)) cls += ' last-move';
      if (dispSq === checkSq) cls += ' in-check';
      if (dragFrom === dispSq) cls += ' dragging';
      sq.className = cls;
      sq.dataset.sq = dispSq;

      let html = '';

      // Coordinate labels
      const fileIdx = flipped ? 7 - c : c;
      const rankIdx = flipped ? r : 7 - r;
      if (i >= 56) {
        html += '<span class="coord-label coord-file">' + 'abcdefgh'[fileIdx] + '</span>';
      }
      if (i % 8 === 0) {
        html += '<span class="coord-label coord-rank">' + (rankIdx + 1) + '</span>';
      }

      // Piece
      if (piece) {
        const pieceClass = piece.color === 'w' ? 'white-piece' : 'black-piece';
        html += '<span class="piece ' + pieceClass + '">' + Chess.PIECE_UNICODE[piece.color + piece.type] + '</span>';
      }

      // Last-move piece indicator on "from" square
      if (lastMove && lastMovePiece && dispSq === lastMove.from && !piece) {
        html += '<span class="last-move-indicator">' + lastMovePiece + '</span>';
      }

      // Analysis marker on "to" square
      if (analysisResults.length > 0 && lastMove) {
        const moveIdx = history.length - 1;
        if (moveIdx >= 0 && moveIdx < analysisResults.length && dispSq === lastMove.to) {
          const clsName = analysisResults[moveIdx] ? analysisResults[moveIdx].classification : null;
          if (clsName && clsName !== 'best' && clsName !== 'good') {
            html += '<div class="analysis-marker ' + clsName + '"></div>';
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

      // Best-move suggestion dots (from coach)
      if (suggestionSquares.includes(dispSq)) {
        if (gameState.board[dispSq] != null) {
          html += '<div class="suggest-ring"></div>';
        } else {
          html += '<div class="suggest-dot"></div>';
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
    if (idx < 0 || idx >= history.length) return;
    if (analysisResults[idx]) {
      const ar = analysisResults[idx];
      showEvalBar(ar.eval, history[idx].state.turn);
    }
  }

  function showEvalBar(evalScore) {
    if (evalScore == null) return;
    $evalBarContainer.classList.add('visible');
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
    } else if (gameMode === 'handoff') {
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

  // ===================== INTERACTION =====================

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
    if (gameMode === 'handoff') {
      return handoffColor !== gameState.turn;
    }
    return false; // learn mode — no interaction on main board
  }

  function selectSquare(sq) {
    if (sq < 0) { clearSelection(); return; }
    const piece = gameState.board[sq];

    if (selected >= 0 && highlights.includes(sq)) {
      tryMove(selected, sq);
      return;
    }

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

  async function executeMove(from, to, promotion, isEnginePlayed) {
    const movedPiece = gameState.board[from];
    const prevFEN = Chess.toFEN(gameState); // FEN before move — for coaching
    const result = Chess.makeMove(gameState, from, to, promotion);
    if (!result) return;

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
      enginePlayed: isEnginePlayed,
    });
    gameState = result.state;
    lastMove = result.move;
    lastMovePiece = movedPiece ? Chess.PIECE_UNICODE[movedPiece.color + (promotion || movedPiece.type)] : null;
    clearSelection();
    // Only clear coach suggestions when the player moves, not when Stockfish moves
    if (!isEnginePlayed) {
      clearArrows($arrowSvg);
      hideSuggestion();
    }
    updateAll();

    // Check if game over
    const status = Chess.getStatus(gameState);
    if (status.over) return;

    // Live coaching — evaluate the player's move BEFORE engine responds
    // (must await so both don't send 'go' commands to the same worker concurrently)
    if (!isEnginePlayed && coachEnabled && gameMode === 'vs-engine' && engineReady) {
      await runCoach(prevFEN, from, to, promotion, movedPiece, result);
    }

    if (gameMode === 'vs-engine') {
      if (gameState.turn !== playerColor && engineReady) {
        engineMove();
      }
    } else if (gameMode === 'handoff') {
      if (handoffColor === gameState.turn && engineReady) {
        setTimeout(() => engineMoveHandoff(), 300);
      }
    }
  }

  // ===================== LIVE COACH =====================

  async function runCoach(prevFEN, from, to, promotion, movedPiece, result) {
    const playerMoveUCI = Chess.toAlg(from) + Chess.toAlg(to) + (promotion || '');
    const preMoveState = Chess.parseFEN(prevFEN); // board state before the move

    // Quick eval the position BEFORE the move to get best move + eval
    const evalResult = await Engine.quickEval(prevFEN, 12);
    if (!evalResult || !evalResult.info) return;

    // Restore difficulty after coach eval
    if (engineReady) Engine.setDifficulty(getDifficulty());

    const bestMoveUCI = evalResult.bestMove;
    const evalBefore = evalResult.info.score || 0;
    const evalBeforeNorm = movedPiece.color === Chess.WHITE ? evalBefore : -evalBefore;

    // We also need eval AFTER the move — use the info from multi-PV or do a quick single eval
    // For simplicity, compare with best move: if player played best move, no loss
    const isBestMove = playerMoveUCI === bestMoveUCI;

    // Estimate eval loss from multi-PV: PV1 is best, check if player's move matches any PV
    let evalAfterNorm = evalBeforeNorm;
    let classification = 'best';
    let pvLine = evalResult.info.pv || [];

    if (!isBestMove) {
      // The player didn't play the best move — estimate the loss
      // Check PV2 and PV3 from multi-PV
      const allLines = evalResult.allLines || {};
      let playerLineEval = null;

      for (const idx in allLines) {
        const lineInfo = allLines[idx];
        if (lineInfo.pv && lineInfo.pv[0] === playerMoveUCI) {
          playerLineEval = lineInfo.score || 0;
          playerLineEval = movedPiece.color === Chess.WHITE ? playerLineEval : -playerLineEval;
          break;
        }
      }

      // If we found the player's move in multi-PV lines, use that eval
      // Otherwise estimate a larger loss
      const bestEval = movedPiece.color === Chess.WHITE ? evalBefore : -evalBefore;
      if (playerLineEval !== null) {
        evalAfterNorm = playerLineEval;
      } else {
        // Player's move wasn't in top 3 — likely a bigger mistake. Do a quick single eval.
        evalAfterNorm = bestEval - 0.8; // rough estimate — actual eval would need another engine call
      }

      const absLoss = bestEval - evalAfterNorm;
      if (absLoss <= -0.5) {
        classification = 'brilliant';
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
    }

    const coachMsg = Tutorials.coachMessage({
      classification,
      playerMove: playerMoveUCI,
      bestMove: bestMoveUCI,
      evalBefore: evalBeforeNorm,
      evalAfter: evalAfterNorm,
      pv: pvLine,
      piece: movedPiece,
      captured: !!result.captured,
      wasCheck: Chess.isInCheck(gameState.board, gameState.turn),
      moverColor: movedPiece.color,
      boardState: preMoveState,
    });

    showCoachFeedback(classification, coachMsg, bestMoveUCI, isBestMove, pvLine, preMoveState);
  }

  function showCoachFeedback(classification, msg, bestMoveUCI, isBestMove, pvMoves, boardState) {
    // Icon symbols per classification
    const icons = {
      brilliant: '!!',
      best: '!',
      good: '=',
      inaccuracy: '?!',
      mistake: '?',
      blunder: '??',
    };

    $coachIcon.textContent = icons[classification] || '?';
    $coachIcon.className = 'coach-icon ' + classification;
    $coachTitleText.textContent = msg.title;

    // Build detail text — include what the best move was if they missed it
    let detail = (msg.message || '') + (msg.detail ? ' ' + msg.detail : '');
    if (!isBestMove && bestMoveUCI && boardState) {
      const bestReadable = Tutorials.describeBestMove(bestMoveUCI, boardState);
      const reason = Tutorials.explainBestMove(bestMoveUCI, boardState);
      detail += ' Best was ' + bestReadable + '.';
      if (reason) detail += ' (' + reason + ')';
    }
    $coachDetail.textContent = detail;
  }

  function resetCoachPanel() {
    $coachIcon.textContent = '';
    $coachIcon.className = 'coach-icon';
    $coachTitleText.textContent = 'Play a move to get feedback';
    $coachDetail.textContent = '';
    hideSuggestion();
  }

  // ===================== SUGGESTION (auto-hint for current position) =====================

  function showSuggestion(bestUci) {
    if (!bestUci || bestUci.length < 4) { hideSuggestion(); return; }

    const fen = Chess.toFEN(gameState);
    const currentState = Chess.parseFEN(fen);
    const fromSq = Chess.fromAlg(bestUci.substring(0, 2));
    const toSq = Chess.fromAlg(bestUci.substring(2, 4));
    const piece = currentState.board[fromSq];

    // Readable move name + reason
    const moveText = Tutorials.describeBestMove(bestUci, currentState);
    const reason = Tutorials.explainBestMove(bestUci, currentState);

    $suggestionMove.textContent = moveText;
    $suggestionReason.textContent = reason || '';
    $suggestionPanel.classList.remove('hidden');

    // Dots on the board
    suggestionSquares = [];
    if (piece && piece.type === 'p' && Math.abs(Chess.row(fromSq) - Chess.row(toSq)) === 2) {
      const midRow = (Chess.row(fromSq) + Chess.row(toSq)) / 2;
      const midSq = Chess.sq(midRow, Chess.col(fromSq));
      suggestionSquares = [fromSq, midSq, toSq];
    } else {
      suggestionSquares = [fromSq, toSq];
    }
    render();
  }

  function hideSuggestion() {
    $suggestionPanel.classList.add('hidden');
    $suggestionMove.textContent = '';
    $suggestionReason.textContent = '';
    suggestionSquares = [];
  }

  async function runSuggestion() {
    if (!engineReady || engineThinking || !coachEnabled) return;
    if (gameMode !== 'vs-engine') return;
    if (gameState.turn !== playerColor) return;
    if (Chess.getStatus(gameState).over) return;

    const fen = Chess.toFEN(gameState);
    const result = await Engine.getHint(fen);
    if (engineReady) Engine.setDifficulty(getDifficulty());

    if (!result || !result.bestMove) { hideSuggestion(); return; }

    // Only show if it's still the player's turn (game state may have changed during await)
    if (gameState.turn !== playerColor) return;

    showSuggestion(result.bestMove);
  }

  // ===================== ENGINE MOVE (VS-ENGINE) =====================

  async function engineMove() {
    engineThinking = true;
    $thinking.classList.remove('hidden');
    $thinkingPanel.classList.remove('hidden');
    updateStatus();

    // Clear stale thinking panel data from previous engine move
    $thinkingPV._lastPV = [];
    $thinkingEval._lastScore = 0;
    $thinkingEval._lastScoreType = 'cp';
    $thinkingEval._lastMate = null;

    // Use streaming info callback for thinking panel
    const fen = Chess.toFEN(gameState);
    const preEngineState = Chess.parseFEN(fen); // save for readable coach text
    const bestUci = await Engine.getBestMoveWithInfo(fen, getDifficulty(), onEngineThinkingInfo);

    engineThinking = false;
    $thinking.classList.add('hidden');
    $thinkingPanel.classList.add('hidden');
    Engine.clearInfoCallback();

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
    clearArrows($arrowSvg);
    updateAll();

    // Coach panel is NOT overwritten here — your feedback stays visible
    // through Stockfish's turn until your next move.

    // Auto-suggest the best move for the player's upcoming turn
    runSuggestion();
  }

  function onEngineThinkingInfo(info) {
    // Update thinking panel with streaming data
    if (info.scoreType === 'mate') {
      $thinkingEval.textContent = 'M' + Math.abs(info.mate);
      $thinkingEval._lastScore = info.mate > 0 ? 100 : -100;
      $thinkingEval._lastScoreType = 'mate';
      $thinkingEval._lastMate = info.mate;
    } else if (info.score !== undefined) {
      const sign = info.score > 0 ? '+' : '';
      $thinkingEval.textContent = sign + info.score.toFixed(1);
      $thinkingEval._lastScore = info.score;
      $thinkingEval._lastScoreType = 'cp';
      $thinkingEval._lastMate = null;
    }

    if (info.depth) {
      $thinkingDepth.textContent = info.depth + (info.seldepth ? '/' + info.seldepth : '');
    }

    if (info.pv && info.pv.length > 0) {
      $thinkingPV.textContent = info.pv.slice(0, 6).join(' ');
      $thinkingPV._lastPV = info.pv;
    }

    if (info.nps) {
      const kNps = Math.round(info.nps / 1000);
      $thinkingNPS.textContent = kNps + 'k n/s';
    }
  }

  // ===================== ENGINE MOVE (HANDOFF) =====================

  async function engineMoveHandoff() {
    if (handoffColor !== gameState.turn) return;
    if (Chess.getStatus(gameState).over) return;

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

    executeMove(from, to, promo, true);
  }

  // ===================== HINT SYSTEM =====================

  async function showHint() {
    if (!engineReady || engineThinking || hintPending) return;
    if (gameMode !== 'vs-engine' || gameState.turn !== playerColor) return;
    if (Chess.getStatus(gameState).over) return;

    hintPending = true;
    $btnHint.disabled = true;
    $btnHint.textContent = '...';

    const fen = Chess.toFEN(gameState);
    const result = await Engine.getHint(fen);

    // Restore difficulty
    if (engineReady) Engine.setDifficulty(getDifficulty());

    hintPending = false;
    $btnHint.disabled = false;
    $btnHint.textContent = 'Hint';

    if (!result || !result.bestMove) return;

    // Delegate to showSuggestion — single source of truth for dots + panel
    showSuggestion(result.bestMove);
  }

  // ===================== UNDO =====================

  function undo() {
    if (engineThinking) return;
    if (history.length === 0) return;

    if (gameMode === 'vs-engine') {
      const count = gameState.turn === playerColor ? 2 : 1;
      for (let i = 0; i < count && history.length > 0; i++) {
        undoOne();
      }
    } else {
      undoOne();
    }
    lastMove = history.length > 0 ? history[history.length - 1].move : null;
    lastMovePiece = null;
    clearSelection();
    clearArrows($arrowSvg);
    resetCoachPanel();
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
    if (analysisResults.length > history.length) {
      analysisResults.length = history.length;
    }
  }

  // ===================== PROMOTION MODAL =====================

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

  // ===================== GAME OVER =====================

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

  // ===================== DRAG AND DROP =====================

  function onMouseDown(e) {
    if (e.button !== 0) return;
    if (!canInteract()) return;
    const sq = getSquareFromEvent(e);
    if (sq < 0) return;

    const piece = gameState.board[sq];
    const allowedColor = (gameMode === 'handoff') ? gameState.turn : playerColor;

    if (selected >= 0 && highlights.includes(sq)) {
      tryMove(selected, sq);
      return;
    }

    if (!piece || piece.color !== allowedColor) {
      clearSelection();
      render();
      return;
    }

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
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    if (mode === 'learn') {
      $gameLayout.classList.add('hidden');
      $tutorialLayout.classList.remove('hidden');
      renderTutorialBrowser();
    } else {
      $gameLayout.classList.remove('hidden');
      $tutorialLayout.classList.add('hidden');
      newGame();
    }
  }

  function updateModeUI() {
    // Show/hide controls per mode
    $colorChooser.style.display = gameMode === 'vs-engine' ? 'flex' : 'none';
    $handoffControls.classList.toggle('visible', gameMode === 'handoff');
    $analysisPanel.classList.add('visible');

    // Show/hide coach panel + hint in game modes
    const inGameMode = gameMode === 'vs-engine' || gameMode === 'handoff';
    $coachPanel.style.display = gameMode === 'vs-engine' ? 'block' : 'none';
    $btnHint.style.display = gameMode === 'vs-engine' ? 'inline-block' : 'none';

    // Game controls visibility
    const gameControls = [$btnNew, $btnUndo, $btnFlip, $difficulty];
    gameControls.forEach(el => {
      el.style.display = (gameMode === 'learn') ? 'none' : '';
    });
    $colorChooser.style.display = (gameMode === 'vs-engine') ? 'flex' : 'none';
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

    const depth = 14;
    let prevEval = 0;

    for (let i = 0; i < history.length; i++) {
      if (!analysisRunning) break;

      const pct = Math.round(((i + 1) / history.length) * 100);
      $progressBar.style.width = pct + '%';
      $progressText.textContent = 'Analyzing move ' + (i + 1) + ' of ' + history.length + '...';

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
        const moverColor = history[i].state.turn;
        if (moverColor === Chess.WHITE) {
          evalScore = -evalScore;
        }
      }

      const evalDelta = evalScore - prevEval;
      const moverColor = history[i].state.turn;
      const absLoss = moverColor === Chess.WHITE ? -evalDelta : evalDelta;

      let classification;
      if (absLoss <= -0.5) {
        classification = 'brilliant';
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

    if (engineReady) {
      Engine.setDifficulty(getDifficulty());
    }

    analysisRunning = false;
    $btnAnalyze.disabled = false;
    $btnAnalyze.textContent = 'Re-analyze';
    $analysisProgress.classList.remove('visible');

    renderAnalysisSummary();
    renderMoveList();
    render();
  }

  function renderAnalysisSummary() {
    if (analysisResults.length === 0) return;

    const counts = {
      w: { brilliant: 0, best: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 },
      b: { brilliant: 0, best: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 },
    };

    for (let i = 0; i < analysisResults.length; i++) {
      const color = history[i].state.turn;
      const cls = analysisResults[i].classification;
      if (counts[color][cls] !== undefined) counts[color][cls]++;
    }

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

  // ===================== TUTORIAL SYSTEM =====================

  function renderTutorialBrowser() {
    $tutorialBrowser.classList.remove('hidden');
    $tutorialLesson.classList.add('hidden');
    $tutorialCategories.innerHTML = '';

    const categories = Tutorials.getCategories();
    for (const catName in categories) {
      const section = document.createElement('div');
      section.className = 'tutorial-category';

      const title = document.createElement('div');
      title.className = 'tutorial-category-title';
      title.textContent = catName;
      section.appendChild(title);

      const grid = document.createElement('div');
      grid.className = 'tutorial-lesson-grid';

      for (const lesson of categories[catName]) {
        const card = document.createElement('div');
        card.className = 'tutorial-lesson-card';
        card.addEventListener('click', () => openLesson(lesson.id));

        const header = document.createElement('div');
        header.className = 'tutorial-card-header';

        const icon = document.createElement('span');
        icon.className = 'tutorial-card-icon';
        icon.textContent = lesson.icon;
        header.appendChild(icon);

        const titleSpan = document.createElement('span');
        titleSpan.className = 'tutorial-card-title';
        titleSpan.textContent = lesson.title;
        header.appendChild(titleSpan);

        card.appendChild(header);

        const desc = document.createElement('div');
        desc.className = 'tutorial-card-desc';
        desc.textContent = lesson.description;
        card.appendChild(desc);

        const meta = document.createElement('div');
        meta.className = 'tutorial-card-meta';
        const puzzleCount = lesson.steps.filter(s => s.type === 'puzzle').length;
        const explainCount = lesson.steps.filter(s => s.type === 'explain').length;
        meta.textContent = explainCount + ' explanation' + (explainCount !== 1 ? 's' : '') +
          ', ' + puzzleCount + ' puzzle' + (puzzleCount !== 1 ? 's' : '');
        card.appendChild(meta);

        grid.appendChild(card);
      }

      section.appendChild(grid);
      $tutorialCategories.appendChild(section);
    }
  }

  function openLesson(lessonId) {
    tutorialLesson = Tutorials.getLessonById(lessonId);
    if (!tutorialLesson) return;

    tutorialStepIdx = 0;
    $tutorialBrowser.classList.add('hidden');
    $tutorialLesson.classList.remove('hidden');
    $tutorialLessonTitle.textContent = tutorialLesson.icon + ' ' + tutorialLesson.title;

    renderTutorialStep();
  }

  function renderTutorialStep() {
    if (!tutorialLesson) return;
    const step = tutorialLesson.steps[tutorialStepIdx];
    if (!step) return;

    tutorialPuzzleSolved = false;
    tutorialSelected = -1;
    tutorialHighlights = [];

    // Step counter
    $tutorialStepCounter.textContent = 'Step ' + (tutorialStepIdx + 1) + ' / ' + tutorialLesson.steps.length;

    // Navigation buttons
    $btnTutorialPrev.disabled = tutorialStepIdx === 0;
    $btnTutorialNext.textContent = tutorialStepIdx === tutorialLesson.steps.length - 1 ? 'Finish' : 'Next →';

    // Text content
    $tutorialText.textContent = step.text;

    // Hide hint/feedback
    $tutorialHint.classList.add('hidden');
    $tutorialFeedback.classList.add('hidden');

    // Show hint button for puzzle steps
    if (step.type === 'puzzle') {
      $btnTutorialHint.classList.remove('hidden');
      $btnTutorialNext.disabled = true; // must solve puzzle first
    } else {
      $btnTutorialHint.classList.add('hidden');
      $btnTutorialNext.disabled = false;
    }

    // Set up the board from FEN
    if (step.fen) {
      tutorialGameState = Chess.parseFEN(step.fen);
    }

    renderTutorialBoard(step);
  }

  function renderTutorialBoard(step) {
    if (!tutorialGameState) return;
    const squares = $tutorialBoard.children;
    const highlightSquares = (step.highlights || []).map(sq => Chess.fromAlg(sq));

    clearArrows($tutorialArrowSvg);

    for (let i = 0; i < 64; i++) {
      const dispSq = i; // tutorial board is not flipped (always White perspective)
      const r = Chess.row(dispSq), c = Chess.col(dispSq);
      const isLight = (r + c) % 2 === 0;
      const piece = tutorialGameState.board[dispSq];
      const sq = squares[i];

      let cls = 'square ' + (isLight ? 'light' : 'dark');
      if (highlightSquares.includes(dispSq)) cls += ' tutorial-highlight';
      if (dispSq === tutorialSelected) cls += ' selected';

      // Show move indicators for puzzle interaction
      if (tutorialSelected >= 0 && tutorialHighlights.includes(dispSq)) {
        cls += ' tutorial-target';
      }

      sq.className = cls;
      sq.dataset.sq = dispSq;

      let html = '';
      if (piece) {
        const pieceClass = piece.color === 'w' ? 'white-piece' : 'black-piece';
        html += '<span class="piece ' + pieceClass + '">' + Chess.PIECE_UNICODE[piece.color + piece.type] + '</span>';
      }

      // Move indicators for puzzle
      if (tutorialSelected >= 0 && tutorialHighlights.includes(dispSq)) {
        if (tutorialGameState.board[dispSq] != null) {
          html += '<div class="capture-ring"></div>';
        } else {
          html += '<div class="move-dot"></div>';
        }
      }

      sq.innerHTML = html;
    }

    // Draw arrows if step has them
    if (step.arrows) {
      for (const [from, to] of step.arrows) {
        drawArrow($tutorialArrowSvg, from, to, 'tutorial-arrow', false, 'arrowhead-tutorial');
      }
    }
  }

  function onTutorialBoardClick(e) {
    if (!tutorialLesson) return;
    const step = tutorialLesson.steps[tutorialStepIdx];
    if (!step || step.type !== 'puzzle' || tutorialPuzzleSolved) return;

    const target = e.target.closest('.square');
    if (!target) return;
    const sq = parseInt(target.dataset.sq);

    // If we have a selected piece and clicked a target, try the move
    if (tutorialSelected >= 0 && tutorialHighlights.includes(sq)) {
      const moveUCI = Chess.toAlg(tutorialSelected) + Chess.toAlg(sq);
      checkTutorialPuzzleAnswer(moveUCI, tutorialSelected, sq);
      return;
    }

    // Select a piece
    const piece = tutorialGameState.board[sq];
    if (piece && piece.color === tutorialGameState.turn) {
      tutorialSelected = sq;
      tutorialHighlights = Chess.legalMovesFrom(tutorialGameState, sq).map(m => m.to);
      renderTutorialBoard(step);
    } else {
      tutorialSelected = -1;
      tutorialHighlights = [];
      renderTutorialBoard(step);
    }
  }

  function checkTutorialPuzzleAnswer(moveUCI, from, to) {
    const step = tutorialLesson.steps[tutorialStepIdx];
    if (!step || !step.solution) return;

    if (step.solution.includes(moveUCI)) {
      // Correct!
      tutorialPuzzleSolved = true;
      $tutorialFeedback.classList.remove('hidden', 'incorrect');
      $tutorialFeedback.classList.add('correct');
      $tutorialFeedback.textContent = 'Correct! Well done!';
      $btnTutorialNext.disabled = false;
      $btnTutorialHint.classList.add('hidden');

      // Execute the move on the tutorial board
      const result = Chess.makeMove(tutorialGameState, from, to, null);
      if (result) {
        tutorialGameState = result.state;
      }
      tutorialSelected = -1;
      tutorialHighlights = [];
      renderTutorialBoard(step);
    } else {
      // Wrong move
      $tutorialFeedback.classList.remove('hidden', 'correct');
      $tutorialFeedback.classList.add('incorrect');
      $tutorialFeedback.textContent = 'Not quite — try again!';
      tutorialSelected = -1;
      tutorialHighlights = [];
      renderTutorialBoard(step);
    }
  }

  function showTutorialHint() {
    const step = tutorialLesson.steps[tutorialStepIdx];
    if (!step || !step.hint) return;
    $tutorialHint.classList.remove('hidden');
    $tutorialHint.textContent = step.hint;
  }

  // ===================== CONTROLS =====================

  function bindControls() {
    $btnNew.addEventListener('click', newGame);
    $btnUndo.addEventListener('click', undo);
    $btnFlip.addEventListener('click', () => {
      flipped = !flipped;
      clearArrows($arrowSvg);
      render();
    });
    $btnPlayAgain.addEventListener('click', newGame);
    $difficulty.addEventListener('change', () => {
      if (engineReady) Engine.setDifficulty(getDifficulty());
    });

    // Hint
    $btnHint.addEventListener('click', showHint);

    // Coach toggle
    $coachToggle.addEventListener('change', () => {
      coachEnabled = $coachToggle.checked;
      $coachContent.classList.toggle('collapsed', !coachEnabled);
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

    // Mode selector
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => setMode(btn.dataset.mode));
    });

    // Handoff controls
    $btnHandoffWhite.addEventListener('click', () => {
      if (handoffColor === Chess.WHITE) stopHandoff();
      else startHandoff(Chess.WHITE);
    });
    $btnHandoffBlack.addEventListener('click', () => {
      if (handoffColor === Chess.BLACK) stopHandoff();
      else startHandoff(Chess.BLACK);
    });
    $btnHandoffStop.addEventListener('click', stopHandoff);

    // Analysis
    $btnAnalyze.addEventListener('click', () => {
      if (analysisRunning) return;
      runAnalysis();
    });

    // Tutorial controls
    $btnTutorialBack.addEventListener('click', () => {
      tutorialLesson = null;
      renderTutorialBrowser();
    });
    $btnTutorialPrev.addEventListener('click', () => {
      if (tutorialStepIdx > 0) {
        tutorialStepIdx--;
        renderTutorialStep();
      }
    });
    $btnTutorialNext.addEventListener('click', () => {
      if (!tutorialLesson) return;
      if (tutorialStepIdx < tutorialLesson.steps.length - 1) {
        tutorialStepIdx++;
        renderTutorialStep();
      } else {
        // Finished lesson — go back to browser
        tutorialLesson = null;
        renderTutorialBrowser();
      }
    });
    $btnTutorialHint.addEventListener('click', showTutorialHint);

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'z' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); undo(); }
      if (e.key === 'n' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); newGame(); }
      if (e.key === 'f' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); flipped = !flipped; clearArrows($arrowSvg); render(); }
      if (e.key === 'h' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); showHint(); }
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
