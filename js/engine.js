/**
 * engine.js — Stockfish WASM integration via Web Worker.
 * Uses stockfish.js from CDN.
 */
const Engine = (function () {
  const STOCKFISH_CDN = 'https://cdn.jsdelivr.net/npm/stockfish.js@10.0.2/stockfish.js';

  let worker = null;
  let ready = false;
  let onBestMove = null;
  let resolveReady = null;

  // Difficulty presets: { depth, skill, moveTime (ms) }
  const LEVELS = {
    1: { depth: 1, skill: 0, moveTime: 200 },     // Beginner
    2: { depth: 8, skill: 8, moveTime: 500 },      // Intermediate
    3: { depth: 15, skill: 15, moveTime: 1500 },    // Advanced
    4: { depth: 22, skill: 20, moveTime: 5000 },    // Maximum (GM crusher)
  };

  function init() {
    return new Promise((resolve, reject) => {
      try {
        worker = new Worker(STOCKFISH_CDN);
      } catch (e) {
        // If direct worker creation fails (CORS), use a blob worker
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
        if (line.startsWith('bestmove')) {
          const parts = line.split(' ');
          const best = parts[1];
          if (onBestMove) { onBestMove(best); onBestMove = null; }
        }
      };

      worker.onerror = function (e) {
        console.error('Stockfish worker error:', e);
        if (resolveReady) { reject(e); resolveReady = null; }
      };

      worker.postMessage('uci');
    });
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
      worker.postMessage('position fen ' + fen);
      worker.postMessage('go depth ' + cfg.depth + ' movetime ' + cfg.moveTime);
    });
  }

  function stop() {
    if (worker) worker.postMessage('stop');
  }

  function newGame() {
    if (worker) worker.postMessage('ucinewgame');
  }

  return { init, setDifficulty, getBestMove, stop, newGame, LEVELS };
})();
