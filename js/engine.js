/**
 * engine.js — Stockfish integration via Web Worker.
 * Uses a local copy of stockfish.js (same-origin, no CORS issues).
 * Supports: best move, position evaluation, multi-PV analysis,
 *           streaming info callbacks, and hint generation.
 */
const Engine = (function () {
  let worker = null;
  let ready = false;
  let onBestMove = null;
  let onEval = null;
  let resolveReady = null;
  let latestInfo = null;
  let onInfoCallback = null;   // streaming callback for live thinking display
  let multiPVResults = {};     // multipv index → latest info

  // Difficulty presets: { depth, skill, moveTime (ms) }
  const LEVELS = {
    1: { depth: 1, skill: 0, moveTime: 200, label: 'Beginner' },
    2: { depth: 8, skill: 8, moveTime: 500, label: 'Intermediate' },
    3: { depth: 15, skill: 15, moveTime: 1500, label: 'Advanced' },
    4: { depth: 22, skill: 20, moveTime: 5000, label: 'Maximum' },
  };

  function init() {
    return new Promise((resolve, reject) => {
      try {
        worker = new Worker('js/stockfish.js');
      } catch (e) {
        reject(new Error('Failed to create Stockfish worker: ' + e.message));
        return;
      }

      resolveReady = resolve;

      worker.onmessage = function (e) {
        const line = typeof e.data === 'string' ? e.data : (e.data && e.data.data) || '';

        if (line === 'uciok') {
          worker.postMessage('isready');
        }
        if (line === 'readyok') {
          ready = true;
          if (resolveReady) { resolveReady(); resolveReady = null; }
        }

        // Parse info lines for evaluation
        if (line.startsWith('info') && line.includes('score')) {
          const parsed = parseInfoLine(line);
          latestInfo = parsed;

          // Track multi-PV results
          const pvIdx = parsed.multipv || 1;
          multiPVResults[pvIdx] = parsed;

          // Stream info to live callback
          if (onInfoCallback) {
            onInfoCallback({
              ...parsed,
              allLines: { ...multiPVResults },
            });
          }
        }

        if (line.startsWith('bestmove')) {
          const parts = line.split(' ');
          const best = parts[1];
          if (onEval) {
            onEval({ bestMove: best, info: latestInfo, allLines: { ...multiPVResults } });
            onEval = null;
            latestInfo = null;
          }
          if (onBestMove) {
            onBestMove(best);
            onBestMove = null;
          }
          multiPVResults = {};
        }
      };

      worker.onerror = function (e) {
        console.error('Stockfish worker error:', e);
        if (resolveReady) { reject(e); resolveReady = null; }
      };

      worker.postMessage('uci');
    });
  }

  function parseInfoLine(line) {
    const result = {};
    const tokens = line.split(' ');
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i] === 'depth') result.depth = parseInt(tokens[i + 1]);
      if (tokens[i] === 'seldepth') result.seldepth = parseInt(tokens[i + 1]);
      if (tokens[i] === 'multipv') result.multipv = parseInt(tokens[i + 1]);
      if (tokens[i] === 'nodes') result.nodes = parseInt(tokens[i + 1]);
      if (tokens[i] === 'nps') result.nps = parseInt(tokens[i + 1]);
      if (tokens[i] === 'time') result.time = parseInt(tokens[i + 1]);
      if (tokens[i] === 'score') {
        if (tokens[i + 1] === 'cp') {
          result.score = parseInt(tokens[i + 2]) / 100; // centipawns to pawns
          result.scoreType = 'cp';
        } else if (tokens[i + 1] === 'mate') {
          result.mate = parseInt(tokens[i + 2]);
          result.scoreType = 'mate';
        }
      }
      if (tokens[i] === 'pv') {
        result.pv = tokens.slice(i + 1);
        break;
      }
    }
    return result;
  }

  function setDifficulty(level) {
    if (!worker || !ready) return;
    const cfg = LEVELS[level] || LEVELS[3];
    worker.postMessage('setoption name Skill Level value ' + cfg.skill);
  }

  /**
   * Set a streaming callback for live thinking info.
   * callback receives { depth, score, scoreType, mate, pv, nodes, nps, allLines }
   */
  function setInfoCallback(callback) {
    onInfoCallback = callback;
  }

  function clearInfoCallback() {
    onInfoCallback = null;
  }

  function getBestMove(fen, level) {
    return new Promise((resolve) => {
      if (!worker || !ready) { resolve(null); return; }
      const cfg = LEVELS[level] || LEVELS[3];
      onBestMove = resolve;
      latestInfo = null;
      multiPVResults = {};
      worker.postMessage('position fen ' + fen);
      worker.postMessage('go depth ' + cfg.depth + ' movetime ' + cfg.moveTime);
    });
  }

  /**
   * Get best move with streaming info (for engine thinking display).
   * Returns same as getBestMove but onInfoCallback fires during search.
   */
  function getBestMoveWithInfo(fen, level, infoCallback) {
    return new Promise((resolve) => {
      if (!worker || !ready) { resolve(null); return; }
      const cfg = LEVELS[level] || LEVELS[3];
      onBestMove = resolve;
      onInfoCallback = infoCallback;
      latestInfo = null;
      multiPVResults = {};
      worker.postMessage('position fen ' + fen);
      worker.postMessage('go depth ' + cfg.depth + ' movetime ' + cfg.moveTime);
    });
  }

  /**
   * Evaluate a position at a given depth.
   * Returns { bestMove, info: { depth, score, scoreType, mate, pv }, allLines }
   */
  function evaluate(fen, depth) {
    return new Promise((resolve) => {
      if (!worker || !ready) { resolve(null); return; }
      latestInfo = null;
      multiPVResults = {};
      // Reset skill level to max for accurate analysis
      worker.postMessage('setoption name Skill Level value 20');
      onBestMove = null;
      onEval = resolve;
      worker.postMessage('position fen ' + fen);
      worker.postMessage('go depth ' + (depth || 16));
    });
  }

  /**
   * Quick evaluation for coaching — moderate depth, returns fast.
   * Returns { bestMove, info, allLines }
   */
  function quickEval(fen, depth) {
    return new Promise((resolve) => {
      if (!worker || !ready) { resolve(null); return; }
      latestInfo = null;
      multiPVResults = {};
      worker.postMessage('setoption name Skill Level value 20');
      worker.postMessage('setoption name MultiPV value 3');
      onBestMove = null;
      onEval = (result) => {
        // Reset MultiPV back to 1
        worker.postMessage('setoption name MultiPV value 1');
        resolve(result);
      };
      worker.postMessage('position fen ' + fen);
      worker.postMessage('go depth ' + (depth || 12));
    });
  }

  /**
   * Get hint for current position — returns { bestMove, info }
   */
  function getHint(fen) {
    return new Promise((resolve) => {
      if (!worker || !ready) { resolve(null); return; }
      latestInfo = null;
      multiPVResults = {};
      worker.postMessage('setoption name Skill Level value 20');
      onBestMove = null;
      onEval = resolve;
      worker.postMessage('position fen ' + fen);
      worker.postMessage('go depth 14 movetime 1000');
    });
  }

  function stop() {
    if (worker) worker.postMessage('stop');
  }

  function newGame() {
    if (worker) {
      worker.postMessage('ucinewgame');
      worker.postMessage('setoption name MultiPV value 1');
    }
    multiPVResults = {};
  }

  return {
    init, setDifficulty, getBestMove, getBestMoveWithInfo,
    evaluate, quickEval, getHint,
    stop, newGame, LEVELS,
    setInfoCallback, clearInfoCallback,
  };
})();
