/**
 * chess.js — Complete chess logic: board state, legal move generation, FEN, check/checkmate/stalemate.
 * No external dependencies.
 */
const Chess = (function () {
  const WHITE = 'w', BLACK = 'b';
  const PAWN = 'p', KNIGHT = 'n', BISHOP = 'b', ROOK = 'r', QUEEN = 'q', KING = 'k';

  const PIECE_UNICODE = {
    wk: '\u2654', wq: '\u2655', wr: '\u2656', wb: '\u2657', wn: '\u2658', wp: '\u2659',
    bk: '\u265A', bq: '\u265B', br: '\u265C', bb: '\u265D', bn: '\u265E', bp: '\u265F',
  };

  const PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

  const FILES = 'abcdefgh';
  const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  // --- Coordinate helpers ---
  function sq(r, c) { return r * 8 + c; }
  function row(s) { return s >> 3; }
  function col(s) { return s & 7; }
  function inBounds(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }
  function toAlg(s) { return FILES[col(s)] + (8 - row(s)); }
  function fromAlg(a) { return sq(8 - parseInt(a[1]), FILES.indexOf(a[0])); }

  function create(fen) {
    return parseFEN(fen || START_FEN);
  }

  function parseFEN(fen) {
    const parts = fen.split(' ');
    const board = new Array(64).fill(null);
    const rows = parts[0].split('/');
    for (let r = 0; r < 8; r++) {
      let c = 0;
      for (const ch of rows[r]) {
        if (ch >= '1' && ch <= '8') { c += parseInt(ch); }
        else {
          const color = ch === ch.toUpperCase() ? WHITE : BLACK;
          board[sq(r, c)] = { color, type: ch.toLowerCase() };
          c++;
        }
      }
    }
    return {
      board,
      turn: parts[1],
      castling: parts[2],
      enPassant: parts[3] === '-' ? -1 : fromAlg(parts[3]),
      halfmove: parseInt(parts[4]),
      fullmove: parseInt(parts[5]),
    };
  }

  function toFEN(state) {
    let fen = '';
    for (let r = 0; r < 8; r++) {
      let empty = 0;
      for (let c = 0; c < 8; c++) {
        const p = state.board[sq(r, c)];
        if (!p) { empty++; }
        else {
          if (empty) { fen += empty; empty = 0; }
          fen += p.color === WHITE ? p.type.toUpperCase() : p.type;
        }
      }
      if (empty) fen += empty;
      if (r < 7) fen += '/';
    }
    fen += ' ' + state.turn;
    fen += ' ' + (state.castling || '-');
    fen += ' ' + (state.enPassant >= 0 ? toAlg(state.enPassant) : '-');
    fen += ' ' + state.halfmove;
    fen += ' ' + state.fullmove;
    return fen;
  }

  function cloneState(s) {
    return {
      board: s.board.slice(),
      turn: s.turn,
      castling: s.castling,
      enPassant: s.enPassant,
      halfmove: s.halfmove,
      fullmove: s.fullmove,
    };
  }

  function findKing(board, color) {
    for (let i = 0; i < 64; i++) {
      if (board[i] && board[i].color === color && board[i].type === KING) return i;
    }
    return -1;
  }

  // --- Attack detection ---
  function isAttackedBy(board, square, byColor) {
    const r = row(square), c = col(square);
    // Pawn attacks
    const pawnDir = byColor === WHITE ? 1 : -1;
    for (const dc of [-1, 1]) {
      const pr = r + pawnDir, pc = c + dc;
      if (inBounds(pr, pc)) {
        const p = board[sq(pr, pc)];
        if (p && p.color === byColor && p.type === PAWN) return true;
      }
    }
    // Knight attacks
    for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
      const nr = r + dr, nc = c + dc;
      if (inBounds(nr, nc)) {
        const p = board[sq(nr, nc)];
        if (p && p.color === byColor && p.type === KNIGHT) return true;
      }
    }
    // King attacks
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const nr = r + dr, nc = c + dc;
        if (inBounds(nr, nc)) {
          const p = board[sq(nr, nc)];
          if (p && p.color === byColor && p.type === KING) return true;
        }
      }
    }
    // Sliding attacks (bishop/rook/queen)
    const dirs = [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]];
    for (let d = 0; d < 8; d++) {
      const [dr, dc] = dirs[d];
      const isBishopDir = d < 4;
      const isRookDir = d >= 4;
      for (let i = 1; i < 8; i++) {
        const nr = r + dr * i, nc = c + dc * i;
        if (!inBounds(nr, nc)) break;
        const p = board[sq(nr, nc)];
        if (p) {
          if (p.color === byColor) {
            if (p.type === QUEEN) return true;
            if (isBishopDir && p.type === BISHOP) return true;
            if (isRookDir && p.type === ROOK) return true;
          }
          break;
        }
      }
    }
    return false;
  }

  function isInCheck(board, color) {
    const kingSq = findKing(board, color);
    return kingSq >= 0 && isAttackedBy(board, kingSq, color === WHITE ? BLACK : WHITE);
  }

  // --- Pseudo-legal move generation ---
  function pseudoMoves(state) {
    const { board, turn, castling, enPassant } = state;
    const moves = [];
    const enemy = turn === WHITE ? BLACK : WHITE;

    for (let from = 0; from < 64; from++) {
      const p = board[from];
      if (!p || p.color !== turn) continue;
      const r = row(from), c = col(from);

      if (p.type === PAWN) {
        const dir = turn === WHITE ? -1 : 1;
        const startRow = turn === WHITE ? 6 : 1;
        const promoRow = turn === WHITE ? 0 : 7;
        // Forward
        const f1 = sq(r + dir, c);
        if (!board[f1]) {
          if (r + dir === promoRow) {
            for (const promo of [QUEEN, ROOK, BISHOP, KNIGHT])
              moves.push({ from, to: f1, promotion: promo });
          } else {
            moves.push({ from, to: f1 });
          }
          // Double push
          if (r === startRow) {
            const f2 = sq(r + dir * 2, c);
            if (!board[f2]) moves.push({ from, to: f2 });
          }
        }
        // Captures
        for (const dc of [-1, 1]) {
          const nc = c + dc;
          if (!inBounds(r + dir, nc)) continue;
          const to = sq(r + dir, nc);
          const target = board[to];
          if ((target && target.color === enemy) || to === enPassant) {
            if (r + dir === promoRow) {
              for (const promo of [QUEEN, ROOK, BISHOP, KNIGHT])
                moves.push({ from, to, promotion: promo });
            } else {
              moves.push({ from, to, enPassant: to === enPassant });
            }
          }
        }
      }

      if (p.type === KNIGHT) {
        for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
          const nr = r + dr, nc = c + dc;
          if (!inBounds(nr, nc)) continue;
          const target = board[sq(nr, nc)];
          if (!target || target.color === enemy) moves.push({ from, to: sq(nr, nc) });
        }
      }

      if (p.type === BISHOP || p.type === QUEEN) {
        for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
          for (let i = 1; i < 8; i++) {
            const nr = r + dr * i, nc = c + dc * i;
            if (!inBounds(nr, nc)) break;
            const target = board[sq(nr, nc)];
            if (!target) { moves.push({ from, to: sq(nr, nc) }); }
            else {
              if (target.color === enemy) moves.push({ from, to: sq(nr, nc) });
              break;
            }
          }
        }
      }

      if (p.type === ROOK || p.type === QUEEN) {
        for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
          for (let i = 1; i < 8; i++) {
            const nr = r + dr * i, nc = c + dc * i;
            if (!inBounds(nr, nc)) break;
            const target = board[sq(nr, nc)];
            if (!target) { moves.push({ from, to: sq(nr, nc) }); }
            else {
              if (target.color === enemy) moves.push({ from, to: sq(nr, nc) });
              break;
            }
          }
        }
      }

      if (p.type === KING) {
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (!dr && !dc) continue;
            const nr = r + dr, nc = c + dc;
            if (!inBounds(nr, nc)) continue;
            const target = board[sq(nr, nc)];
            if (!target || target.color === enemy) moves.push({ from, to: sq(nr, nc) });
          }
        }
        // Castling
        if (!isInCheck(board, turn)) {
          const baseRow = turn === WHITE ? 7 : 0;
          if (from === sq(baseRow, 4)) {
            // Kingside
            const ksChar = turn === WHITE ? 'K' : 'k';
            if (castling.includes(ksChar) &&
                !board[sq(baseRow, 5)] && !board[sq(baseRow, 6)] &&
                !isAttackedBy(board, sq(baseRow, 5), enemy) &&
                !isAttackedBy(board, sq(baseRow, 6), enemy)) {
              moves.push({ from, to: sq(baseRow, 6), castle: 'k' });
            }
            // Queenside
            const qsChar = turn === WHITE ? 'Q' : 'q';
            if (castling.includes(qsChar) &&
                !board[sq(baseRow, 3)] && !board[sq(baseRow, 2)] && !board[sq(baseRow, 1)] &&
                !isAttackedBy(board, sq(baseRow, 3), enemy) &&
                !isAttackedBy(board, sq(baseRow, 2), enemy)) {
              moves.push({ from, to: sq(baseRow, 2), castle: 'q' });
            }
          }
        }
      }
    }
    return moves;
  }

  // --- Legal moves (filter out moves that leave king in check) ---
  function legalMoves(state) {
    const pseudo = pseudoMoves(state);
    const legal = [];
    for (const move of pseudo) {
      const next = applyMoveUnchecked(state, move);
      if (!isInCheck(next.board, state.turn)) {
        legal.push(move);
      }
    }
    return legal;
  }

  function legalMovesFrom(state, from) {
    return legalMoves(state).filter(m => m.from === from);
  }

  function isLegal(state, from, to, promotion) {
    return legalMoves(state).find(m =>
      m.from === from && m.to === to && (!m.promotion || m.promotion === promotion)
    );
  }

  // --- Apply move (does NOT check legality) ---
  function applyMoveUnchecked(state, move) {
    const s = cloneState(state);
    // Deep copy affected squares
    s.board = state.board.map(p => p ? { ...p } : null);
    const p = s.board[move.from];
    const captured = s.board[move.to];

    // En passant capture
    if (move.enPassant) {
      const capSq = sq(row(move.from), col(move.to));
      s.board[capSq] = null;
    }

    // Move piece
    s.board[move.to] = p;
    s.board[move.from] = null;

    // Promotion
    if (move.promotion) {
      s.board[move.to] = { color: p.color, type: move.promotion };
    }

    // Castling — move rook
    if (move.castle) {
      const r = row(move.from);
      if (move.castle === 'k') {
        s.board[sq(r, 5)] = s.board[sq(r, 7)];
        s.board[sq(r, 7)] = null;
      } else {
        s.board[sq(r, 3)] = s.board[sq(r, 0)];
        s.board[sq(r, 0)] = null;
      }
    }

    // Update castling rights
    let c = s.castling;
    if (p.type === KING) {
      c = c.replace(s.turn === WHITE ? /[KQ]/g : /[kq]/g, '');
    }
    if (p.type === ROOK) {
      if (move.from === sq(7, 7)) c = c.replace('K', '');
      if (move.from === sq(7, 0)) c = c.replace('Q', '');
      if (move.from === sq(0, 7)) c = c.replace('k', '');
      if (move.from === sq(0, 0)) c = c.replace('q', '');
    }
    // Rook captured
    if (move.to === sq(7, 7)) c = c.replace('K', '');
    if (move.to === sq(7, 0)) c = c.replace('Q', '');
    if (move.to === sq(0, 7)) c = c.replace('k', '');
    if (move.to === sq(0, 0)) c = c.replace('q', '');
    s.castling = c || '-';

    // En passant square
    if (p.type === PAWN && Math.abs(row(move.to) - row(move.from)) === 2) {
      s.enPassant = sq((row(move.from) + row(move.to)) / 2, col(move.from));
    } else {
      s.enPassant = -1;
    }

    // Halfmove clock
    if (p.type === PAWN || captured) s.halfmove = 0;
    else s.halfmove++;

    // Fullmove
    if (s.turn === BLACK) s.fullmove++;

    s.turn = s.turn === WHITE ? BLACK : WHITE;
    return s;
  }

  function makeMove(state, from, to, promotion) {
    const move = isLegal(state, from, to, promotion);
    if (!move) return null;
    return {
      state: applyMoveUnchecked(state, move),
      move,
      captured: state.board[to] || (move.enPassant ? state.board[sq(row(from), col(to))] : null),
    };
  }

  // --- Game status ---
  function getStatus(state) {
    const legal = legalMoves(state);
    const inCheck = isInCheck(state.board, state.turn);
    if (legal.length === 0) {
      if (inCheck) return { over: true, result: state.turn === WHITE ? 'black' : 'white', reason: 'checkmate' };
      return { over: true, result: 'draw', reason: 'stalemate' };
    }
    if (inCheck) return { over: false, inCheck: true };
    if (state.halfmove >= 100) return { over: true, result: 'draw', reason: '50-move rule' };
    if (isInsufficientMaterial(state.board)) return { over: true, result: 'draw', reason: 'insufficient material' };
    return { over: false, inCheck: false };
  }

  function isInsufficientMaterial(board) {
    const pieces = { w: [], b: [] };
    for (let i = 0; i < 64; i++) {
      if (board[i]) pieces[board[i].color].push(board[i].type);
    }
    const wp = pieces.w.filter(t => t !== KING);
    const bp = pieces.b.filter(t => t !== KING);
    // K vs K
    if (wp.length === 0 && bp.length === 0) return true;
    // K+B vs K or K+N vs K
    if (wp.length === 0 && bp.length === 1 && (bp[0] === BISHOP || bp[0] === KNIGHT)) return true;
    if (bp.length === 0 && wp.length === 1 && (wp[0] === BISHOP || wp[0] === KNIGHT)) return true;
    return false;
  }

  // --- SAN (Standard Algebraic Notation) ---
  function toSAN(state, move) {
    const p = state.board[move.from];
    if (move.castle) return move.castle === 'k' ? 'O-O' : 'O-O-O';

    let san = '';
    const isCapture = state.board[move.to] || move.enPassant;

    if (p.type === PAWN) {
      if (isCapture) san += FILES[col(move.from)];
    } else {
      san += p.type.toUpperCase();
      // Disambiguation
      const others = legalMoves(state).filter(m =>
        m.to === move.to && m.from !== move.from &&
        state.board[m.from] && state.board[m.from].type === p.type
      );
      if (others.length > 0) {
        const sameCol = others.some(m => col(m.from) === col(move.from));
        const sameRow = others.some(m => row(m.from) === row(move.from));
        if (!sameCol) san += FILES[col(move.from)];
        else if (!sameRow) san += (8 - row(move.from));
        else san += FILES[col(move.from)] + (8 - row(move.from));
      }
    }

    if (isCapture) san += 'x';
    san += toAlg(move.to);
    if (move.promotion) san += '=' + move.promotion.toUpperCase();

    // Check / checkmate
    const next = applyMoveUnchecked(state, move);
    const nextStatus = getStatus(next);
    if (nextStatus.over && nextStatus.reason === 'checkmate') san += '#';
    else if (nextStatus.inCheck) san += '+';

    return san;
  }

  // --- UCI move string ---
  function toUCI(move) {
    return toAlg(move.from) + toAlg(move.to) + (move.promotion || '');
  }

  return {
    create, toFEN, parseFEN, cloneState,
    legalMoves, legalMovesFrom, isLegal, makeMove,
    getStatus, isInCheck, findKing,
    toSAN, toUCI, toAlg, fromAlg,
    sq, row, col,
    PIECE_UNICODE, PIECE_VALUES,
    WHITE, BLACK, START_FEN,
  };
})();
