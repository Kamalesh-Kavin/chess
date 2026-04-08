/**
 * engine.js — Stockfish integration via Web Worker.
 * Uses a local copy of stockfish.js (same-origin, no CORS issues).
 * Supports: best move, position evaluation, and multi-PV analysis.
 */
const Engine = (function () {
  let worker = null;
  let ready = false;
  let onBestMove = null;
  let onEval = null;
  let resolveReady = null;
  let latestInfo = null; // latest 'info' line data

  // Difficulty presets: { depth, skill, moveTime (ms) }
  const LEVELS = {
    1: { depth: 1, skill: 0, moveTime: 200 },     // Beginner
    2: { depth: 8, skill: 8, moveTime: 500 },      // Intermediate
    3: { depth: 15, skill: 15, moveTime: 1500 },    // Advanced
    4: { depth: 22, skill: 20, moveTime: 5000 },    // Maximum
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
          latestInfo = parseInfoLine(line);
        }

        if (line.startsWith('bestmove')) {
          const parts = line.split(' ');
          const best = parts[1];
          if (onEval) {
            onEval({ bestMove: best, info: latestInfo });
            onEval = null;
            latestInfo = null;
          }
          if (onBestMove) {
            onBestMove(best);
            onBestMove = null;
          }
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

  function getBestMove(fen, level) {
    return new Promise((resolve) => {
      if (!worker || !ready) { resolve(null); return; }
      const cfg = LEVELS[level] || LEVELS[3];
      onBestMove = resolve;
      latestInfo = null;
      worker.postMessage('position fen ' + fen);
      worker.postMessage('go depth ' + cfg.depth + ' movetime ' + cfg.moveTime);
    });
  }

  /**
   * Evaluate a position at a given depth.
   * Returns { bestMove, info: { depth, score, scoreType, mate, pv } }
   */
  function evaluate(fen, depth) {
    return new Promise((resolve) => {
      if (!worker || !ready) { resolve(null); return; }
      latestInfo = null;
      // Reset skill level to max for accurate analysis
      worker.postMessage('setoption name Skill Level value 20');
      onBestMove = null; // clear any pending best-move callback
      onEval = resolve;
      worker.postMessage('position fen ' + fen);
      worker.postMessage('go depth ' + (depth || 16));
    });
  }

  function stop() {
    if (worker) worker.postMessage('stop');
  }

  function newGame() {
    if (worker) worker.postMessage('ucinewgame');
  }

  return { init, setDifficulty, getBestMove, evaluate, stop, newGame, LEVELS };
})();
