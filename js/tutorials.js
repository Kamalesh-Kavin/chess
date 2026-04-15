/**
 * tutorials.js — Interactive chess tutorial system.
 * Lessons covering piece movement, tactics, openings, and checkmate patterns.
 * Each lesson has explanations + interactive puzzles on the board.
 */
const Tutorials = (function () {

  /* ════════════════════════════════════════════════════════════════════
   *  LESSON DATA
   * ════════════════════════════════════════════════════════════════════ */

  const LESSONS = [
    // ─── CATEGORY: BASICS ───
    {
      id: 'pawn',
      category: 'Basics',
      title: 'The Pawn',
      icon: '♟',
      description: 'Pawns move forward one square, capture diagonally, and can promote!',
      steps: [
        {
          type: 'explain',
          text: 'Pawns are the soul of chess. They move forward one square at a time, but capture diagonally. From their starting position, pawns can move two squares forward on their first move.',
          fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
          highlights: ['a2','b2','c2','d2','e2','f2','g2','h2'],
        },
        {
          type: 'explain',
          text: 'Pawns capture diagonally forward — one square to the left or right. They cannot capture straight ahead. If a pawn is blocked, it cannot move!',
          fen: '8/8/8/3p4/2P1P3/8/8/8 w - - 0 1',
          highlights: ['c4','e4','d5'],
          arrows: [['c4','d5'],['e4','d5']],
        },
        {
          type: 'explain',
          text: 'When a pawn reaches the other side of the board (8th rank for White, 1st for Black), it PROMOTES — you replace it with a Queen, Rook, Bishop, or Knight. Almost always pick Queen!',
          fen: '8/4P3/8/8/8/8/8/4K2k w - - 0 1',
          highlights: ['e7'],
          arrows: [['e7','e8']],
        },
        {
          type: 'puzzle',
          text: 'Capture the black pawn! Move your pawn from e4 to d5.',
          fen: '8/8/8/3p4/4P3/8/8/4K2k w - - 0 1',
          solution: ['e4d5'],
          hint: 'Pawns capture diagonally — move e4 to d5.',
        },
        {
          type: 'puzzle',
          text: 'Move the pawn two squares forward from its starting position.',
          fen: '8/8/8/8/8/8/4P3/4K2k w - - 0 1',
          solution: ['e2e4'],
          hint: 'From the starting row, pawns can move two squares forward.',
        },
      ],
    },
    {
      id: 'knight',
      category: 'Basics',
      title: 'The Knight',
      icon: '♞',
      description: 'Knights move in an L-shape and can jump over other pieces!',
      steps: [
        {
          type: 'explain',
          text: 'The Knight moves in an L-shape: two squares in one direction and one square perpendicular (or vice versa). It\'s the only piece that can jump over others!',
          fen: '8/8/8/8/3N4/8/8/4K2k w - - 0 1',
          highlights: ['d4','c6','e6','f5','f3','e2','c2','b3','b5'],
        },
        {
          type: 'explain',
          text: 'Knights are especially powerful in closed positions (lots of pawns blocking). Since they jump, blocked pawns don\'t affect them. A knight on the rim is dim — knights are strongest in the center!',
          fen: '8/8/3p1p2/2p3p1/3N4/2p3p1/3p1p2/4K2k w - - 0 1',
          highlights: ['d4'],
        },
        {
          type: 'puzzle',
          text: 'Use the knight to capture the undefended black rook!',
          fen: '8/8/5r2/8/3N4/8/8/4K2k w - - 0 1',
          solution: ['d4f5','d4e6'],
          hint: 'The knight can reach f6 via e6 — but can it go there directly? Think about the L-shape.',
        },
      ],
    },
    {
      id: 'bishop',
      category: 'Basics',
      title: 'The Bishop',
      icon: '♝',
      description: 'Bishops move diagonally any number of squares.',
      steps: [
        {
          type: 'explain',
          text: 'Bishops move diagonally any number of squares. Each bishop stays on its starting color for the entire game — one on light squares, one on dark squares. That\'s why the "bishop pair" (having both) is valuable!',
          fen: '8/8/8/8/3B4/8/8/4K2k w - - 0 1',
          highlights: ['d4','a1','b2','c3','e5','f6','g7','h8','a7','b6','c5','e3','f2','g1'],
        },
        {
          type: 'puzzle',
          text: 'Capture the hanging black queen with your bishop!',
          fen: '8/6q1/8/8/3B4/8/8/4K2k w - - 0 1',
          solution: ['d4g7'],
          hint: 'The bishop on d4 can slide diagonally to g7.',
        },
      ],
    },
    {
      id: 'rook',
      category: 'Basics',
      title: 'The Rook',
      icon: '♜',
      description: 'Rooks move in straight lines — horizontally or vertically.',
      steps: [
        {
          type: 'explain',
          text: 'Rooks move any number of squares along a rank (row) or file (column). They are powerful in open positions and on open files. Rooks are worth about 5 points — much more than bishops or knights (3 each).',
          fen: '8/8/8/8/3R4/8/8/4K2k w - - 0 1',
          highlights: ['d4','d1','d2','d3','d5','d6','d7','d8','a4','b4','c4','e4','f4','g4','h4'],
        },
        {
          type: 'explain',
          text: 'Rooks are most effective on open files (columns with no pawns) and on the 7th rank (2nd rank for Black) where they can attack pawns and trap the king.',
          fen: '6k1/ppppRppp/8/8/8/8/PPPPPPPP/4K3 w - - 0 1',
          highlights: ['e7'],
        },
        {
          type: 'puzzle',
          text: 'Put the rook on the open file to control it! Move Rd1 to d8.',
          fen: '4k3/8/8/8/8/8/8/3RK3 w - - 0 1',
          solution: ['d1d8'],
          hint: 'The d-file is wide open — slide the rook all the way up!',
        },
      ],
    },
    {
      id: 'queen',
      category: 'Basics',
      title: 'The Queen',
      icon: '♛',
      description: 'The Queen combines the power of a Rook and Bishop.',
      steps: [
        {
          type: 'explain',
          text: 'The Queen is the most powerful piece — she combines the Rook\'s straight-line movement with the Bishop\'s diagonals. She\'s worth about 9 points. But be careful: don\'t bring her out too early or she\'ll be chased by minor pieces!',
          fen: '8/8/8/8/3Q4/8/8/4K2k w - - 0 1',
          highlights: ['d4','d1','d2','d3','d5','d6','d7','d8','a4','b4','c4','e4','f4','g4','h4','a1','b2','c3','e5','f6','g7','h8','a7','b6','c5','e3','f2','g1'],
        },
        {
          type: 'puzzle',
          text: 'Capture the undefended rook with your queen!',
          fen: '7r/8/8/8/3Q4/8/8/4K2k w - - 0 1',
          solution: ['d4h8','d4d8'],
          hint: 'The queen can reach h8 diagonally or move along the d-file then across.',
        },
      ],
    },
    {
      id: 'king',
      category: 'Basics',
      title: 'The King',
      icon: '♚',
      description: 'The King moves one square in any direction. Protect it at all costs!',
      steps: [
        {
          type: 'explain',
          text: 'The King moves one square in any direction. It cannot move to a square attacked by an opponent\'s piece. The game ends when the king is checkmated — trapped with no escape from attack.',
          fen: '8/8/8/8/3K4/8/8/7k w - - 0 1',
          highlights: ['d4','c5','d5','e5','c4','e4','c3','d3','e3'],
        },
        {
          type: 'explain',
          text: 'CASTLING is a special king move. The king moves two squares toward a rook, and the rook jumps over. Castling is only allowed if: neither piece has moved, no pieces are between them, the king isn\'t in check, and doesn\'t pass through check.',
          fen: 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1',
          arrows: [['e1','g1'],['e1','c1']],
        },
        {
          type: 'puzzle',
          text: 'Castle kingside! Move your king from e1 to g1.',
          fen: '8/8/8/8/8/8/8/R3K2R w KQ - 0 1',
          solution: ['e1g1'],
          hint: 'Move the king two squares toward the h1 rook to castle.',
        },
      ],
    },

    // ─── CATEGORY: TACTICS ───
    {
      id: 'fork',
      category: 'Tactics',
      title: 'The Fork',
      icon: '🍴',
      description: 'Attack two pieces at once! One of the most common tactics.',
      steps: [
        {
          type: 'explain',
          text: 'A FORK is when one piece attacks two (or more) enemy pieces at the same time. The opponent can only save one, so you win material. Knights are fork masters because of their unusual movement!',
          fen: '8/8/8/8/4N3/8/8/2k1K1r1 w - - 0 1',
          arrows: [['e4','d2'],['e4','f2']],
        },
        {
          type: 'puzzle',
          text: 'Fork the black king and rook with your knight!',
          fen: 'r3k3/8/8/8/4N3/8/8/4K3 w - - 0 1',
          solution: ['e4d6','e4c5'],
          hint: 'Find a square where the knight attacks both the king on e8 and the rook on a8.',
        },
        {
          type: 'puzzle',
          text: 'Use the queen to fork the king and the undefended bishop!',
          fen: '4k3/8/2b5/8/8/8/8/3QK3 w - - 0 1',
          solution: ['d1a4'],
          hint: 'Find a queen square that attacks both c6 and e8.',
        },
      ],
    },
    {
      id: 'pin',
      category: 'Tactics',
      title: 'The Pin',
      icon: '📌',
      description: 'Pin a piece so it cannot move without exposing a more valuable piece behind it.',
      steps: [
        {
          type: 'explain',
          text: 'A PIN occurs when an attacking piece (bishop, rook, or queen) targets an enemy piece that cannot move because doing so would expose a more valuable piece behind it (often the king). An ABSOLUTE pin means the pinned piece truly cannot move (king is behind). A RELATIVE pin means it can move but would lose material.',
          fen: '4k3/4r3/8/8/4B3/8/8/4K3 w - - 0 1',
          arrows: [['e4','e7'],['e7','e8']],
        },
        {
          type: 'puzzle',
          text: 'Pin the black knight to the black king using your bishop! Move Bf1 to b5.',
          fen: 'r1bqk2r/pppppppp/2n5/8/8/8/PPPPPPPP/RNBQKB1R w KQkq - 0 1',
          solution: ['f1b5'],
          hint: 'Place the bishop on the a4-e8 diagonal so it pins the knight on c6 against the king.',
        },
      ],
    },
    {
      id: 'skewer',
      category: 'Tactics',
      title: 'The Skewer',
      icon: '🗡️',
      description: 'Attack a valuable piece that must move, exposing a piece behind it.',
      steps: [
        {
          type: 'explain',
          text: 'A SKEWER is like a reverse pin. You attack a more valuable piece (like the king), forcing it to move, which exposes a less valuable piece behind it that you can then capture. Bishops, rooks, and queens can skewer.',
          fen: '8/8/8/8/R3k2r/8/8/4K3 w - - 0 1',
          arrows: [['a4','e4'],['e4','h4']],
        },
        {
          type: 'puzzle',
          text: 'Skewer the black king and queen with your rook! Place the rook on the e-file.',
          fen: '4q3/4k3/8/8/8/8/8/R3K3 w Q - 0 1',
          solution: ['a1e1'],
          hint: 'If the rook checks the king on e7, the king must move, exposing the queen on e8.',
        },
      ],
    },
    {
      id: 'discovered',
      category: 'Tactics',
      title: 'Discovered Attack',
      icon: '💥',
      description: 'Move one piece to unleash an attack from the piece behind it.',
      steps: [
        {
          type: 'explain',
          text: 'A DISCOVERED ATTACK happens when you move a piece out of the way, revealing an attack from a piece behind it. A DISCOVERED CHECK is especially powerful because the opponent must deal with the check, giving your moved piece a free move.',
          fen: '4k3/8/8/4N3/8/8/8/4K2R w - - 0 1',
          arrows: [['e5','c6'],['h1','h8']],
        },
        {
          type: 'puzzle',
          text: 'Move the knight to reveal a discovered check from the bishop. Pick the best knight move!',
          fen: 'r1bk4/pppppppp/8/3nB3/8/8/PPPPPPPP/RN1QKB1R w KQ - 0 1',
          solution: ['e5c6','e5f7'],
          hint: 'Move the knight from e5 to unleash the bishop behind it.',
        },
      ],
    },

    // ─── CATEGORY: OPENINGS ───
    {
      id: 'opening-principles',
      category: 'Openings',
      title: 'Opening Principles',
      icon: '📖',
      description: 'The golden rules for the first 10-15 moves of every game.',
      steps: [
        {
          type: 'explain',
          text: '1. CONTROL THE CENTER — Place pawns and pieces to control e4, d4, e5, d5. The center is the most important part of the board early on.',
          fen: 'rnbqkbnr/pppppppp/8/8/3PP3/8/PPP2PPP/RNBQKBNR b KQkq - 0 1',
          highlights: ['d4','e4','d5','e5'],
        },
        {
          type: 'explain',
          text: '2. DEVELOP YOUR PIECES — Get your knights and bishops out to active squares quickly. Don\'t move the same piece twice in the opening. Knights before bishops is a common guideline.',
          fen: 'r1bqkb1r/pppppppp/2n2n2/8/3PP3/2N2N2/PPP2PPP/R1BQKB1R w KQkq - 0 1',
          highlights: ['c3','f3','c6','f6'],
        },
        {
          type: 'explain',
          text: '3. KING SAFETY — Castle early! Castling tucks your king away safely and connects your rooks. Don\'t leave your king in the center where it can be attacked.',
          fen: 'r1bq1rk1/ppppbppp/2n2n2/4p3/3PP3/2N2N2/PPP1BPPP/R1BQ1RK1 w - - 0 1',
          arrows: [['e1','g1']],
        },
        {
          type: 'explain',
          text: '4. DON\'T move the queen out too early (she\'ll be chased), don\'t make too many pawn moves, don\'t block your own pieces, and connect your rooks (all pieces developed, king castled).',
          fen: 'rnbqkbnr/pppppppp/8/8/8/5Q2/PPPPPPPP/RNB1KBNR b KQkq - 0 1',
          highlights: ['f3'],
        },
        {
          type: 'puzzle',
          text: 'Play the best opening move: control the center with a pawn!',
          fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
          solution: ['e2e4','d2d4'],
          hint: 'e4 or d4 are the strongest opening moves — they control the center immediately.',
        },
      ],
    },
    {
      id: 'italian',
      category: 'Openings',
      title: 'Italian Game',
      icon: '🇮🇹',
      description: 'One of the oldest and most natural openings: 1.e4 e5 2.Nf3 Nc6 3.Bc4',
      steps: [
        {
          type: 'explain',
          text: 'The Italian Game begins: 1.e4 e5 2.Nf3 Nc6 3.Bc4. White develops the bishop to an active diagonal pointing at f7 — the weakest point in Black\'s position (only defended by the king!).',
          fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 0 1',
          arrows: [['c4','f7']],
        },
        {
          type: 'explain',
          text: 'Black\'s most solid reply is 3...Bc5 (the Giuoco Piano — "quiet game"). Both sides develop naturally. White aims to castle and build a strong center; Black mirrors the development.',
          fen: 'r1bqk1nr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 1',
          highlights: ['c4','c5'],
        },
        {
          type: 'puzzle',
          text: 'You\'re White after 1.e4 e5 2.Nf3 Nc6. Develop the bishop to its best square!',
          fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 1',
          solution: ['f1c4','f1b5'],
          hint: 'Place the bishop where it eyes the f7 pawn — the weakest square in Black\'s camp.',
        },
      ],
    },

    // ─── CATEGORY: CHECKMATES ───
    {
      id: 'back-rank',
      category: 'Checkmates',
      title: 'Back Rank Mate',
      icon: '🏰',
      description: 'Trap the enemy king on its back rank with a rook or queen.',
      steps: [
        {
          type: 'explain',
          text: 'A BACK RANK MATE happens when the king is trapped on the first (or eighth) rank by its own pawns, and a rook or queen delivers check on that rank. Always be aware of your own back rank weakness — give your king a "luft" (escape square) by pushing h3/h6!',
          fen: '6k1/5ppp/8/8/8/8/8/R3K3 w Q - 0 1',
          arrows: [['a1','a8']],
        },
        {
          type: 'puzzle',
          text: 'Deliver back rank checkmate!',
          fen: '6k1/5ppp/8/8/8/8/5PPP/R3K3 w Q - 0 1',
          solution: ['a1a8'],
          hint: 'The black king is trapped behind its own pawns. Slide the rook to the 8th rank!',
        },
      ],
    },
    {
      id: 'smothered',
      category: 'Checkmates',
      title: 'Smothered Mate',
      icon: '🐴',
      description: 'A knight delivers checkmate while the king is trapped by its own pieces.',
      steps: [
        {
          type: 'explain',
          text: 'A SMOTHERED MATE is a checkmate delivered by a knight where the enemy king is surrounded (smothered) by its own pieces and cannot escape. It\'s one of the most beautiful patterns in chess!',
          fen: '6rk/5Npp/8/8/8/8/8/4K3 w - - 0 1',
          highlights: ['f7','h8','g8','g7','h7'],
        },
        {
          type: 'puzzle',
          text: 'Deliver the smothered mate! Move the knight to checkmate the trapped king.',
          fen: 'r4rk1/5Npp/8/8/8/8/8/R3K3 w Q - 0 1',
          solution: ['f7h6'],
          hint: 'The knight on f7 can jump to h6 — the king is surrounded by its own pieces!',
        },
      ],
    },
    {
      id: 'scholars',
      category: 'Checkmates',
      title: "Scholar's Mate",
      icon: '🎓',
      description: 'The 4-move checkmate every beginner should know (and know how to defend!).',
      steps: [
        {
          type: 'explain',
          text: "Scholar's Mate: 1.e4 e5 2.Bc4 Nc6 3.Qh5 Nf6?? 4.Qxf7#. The queen and bishop combine to attack f7. While this is easily defended, MANY beginners fall for it. Always watch f7/f2!",
          fen: 'r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 1',
          arrows: [['f7','e8'],['c4','f7']],
        },
        {
          type: 'explain',
          text: 'HOW TO DEFEND: After 1.e4 e5 2.Bc4 Nc6 3.Qh5, Black should play 3...g6! This attacks the queen and defends f7. The queen must retreat, and Black has gained a tempo (a free developing move).',
          fen: 'r1bqkbnr/pppp1p1p/2n3p1/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 0 1',
          highlights: ['g6'],
          arrows: [['g6','h5']],
        },
        {
          type: 'puzzle',
          text: 'You\'re Black and White just played Qh5. Defend against Scholar\'s Mate!',
          fen: 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 1',
          solution: ['g7g6'],
          hint: 'Push g6 to attack the queen and cover f7 at the same time!',
        },
      ],
    },
  ];

  /* ════════════════════════════════════════════════════════════════════
   *  LESSON CATEGORIES
   * ════════════════════════════════════════════════════════════════════ */

  function getCategories() {
    const cats = {};
    for (const l of LESSONS) {
      if (!cats[l.category]) cats[l.category] = [];
      cats[l.category].push(l);
    }
    return cats;
  }

  function getLessonById(id) {
    return LESSONS.find(l => l.id === id) || null;
  }

  function getAllLessons() {
    return LESSONS;
  }

  /* ════════════════════════════════════════════════════════════════════
   *  COACHING TEXT GENERATOR
   * ════════════════════════════════════════════════════════════════════ */

  /**
   * Generate a plain-English coaching message for a move.
   * @param {object} params
   *   - classification: 'brilliant'|'best'|'good'|'inaccuracy'|'mistake'|'blunder'
   *   - playerMove: UCI string (e.g. 'e2e4')
   *   - bestMove: UCI string
   *   - evalBefore: number (from White's perspective)
   *   - evalAfter: number
   *   - pv: array of UCI moves (best continuation)
   *   - piece: { type, color } of the moved piece
   *   - captured: boolean
   *   - wasCheck: boolean
   *   - moverColor: 'w' | 'b'
   * @returns {object} { title, message, detail, pvMoves }
   */
  function coachMessage(params) {
    const {
      classification, playerMove, bestMove,
      evalBefore, evalAfter, pv,
      piece, captured, wasCheck, moverColor,
      boardState,
    } = params;

    const evalDelta = Math.abs((evalAfter || 0) - (evalBefore || 0));
    const isSameAsBest = playerMove === bestMove;

    // Get readable description of the best move if we have board state
    const bestMoveReadable = (bestMove && boardState) ? describeUCIMove(bestMove, boardState) : bestMove;
    const pvReadable = (pv && pv.length > 1 && boardState) ? pvToReadable(pv.slice(0, 4), boardState) : '';

    let title, message, detail;

    switch (classification) {
      case 'brilliant':
        title = 'Brilliant Move!';
        message = 'Outstanding — you found a move that was better than expected. This significantly improved your position.';
        detail = '';
        break;
      case 'best':
        title = 'Best Move';
        message = 'This is the engine\'s top choice. Well played!';
        detail = '';
        break;
      case 'good':
        title = 'Good Move';
        message = 'A solid move. Very close to the best option.';
        if (!isSameAsBest && bestMoveReadable) {
          detail = 'The engine slightly preferred ' + bestMoveReadable + ', but the difference is negligible.';
        }
        break;
      case 'inaccuracy':
        title = 'Inaccuracy';
        message = 'This move is okay but not the best. You lost about ' + evalDelta.toFixed(1) + ' of an advantage.';
        if (bestMoveReadable) {
          detail = 'The best move was ' + bestMoveReadable + '.';
          if (pvReadable) {
            detail += ' The idea: ' + pvReadable;
          }
        }
        break;
      case 'mistake':
        title = 'Mistake';
        message = 'This move loses about ' + evalDelta.toFixed(1) + ' pawns worth of advantage. ';
        if (captured) {
          message += 'The capture looked tempting, but there was a better option.';
        } else if (wasCheck) {
          message += 'Not every check is a good check!';
        } else {
          message += 'Try to consider all your opponent\'s threats before moving.';
        }
        if (bestMoveReadable) {
          detail = 'The best move was ' + bestMoveReadable + '.';
          if (pvReadable) {
            detail += ' Best line: ' + pvReadable;
          }
        }
        break;
      case 'blunder':
        title = 'Blunder!';
        message = 'This move loses significant material or advantage (' + evalDelta.toFixed(1) + ' pawns). ';
        message += 'Always ask yourself: "What does my opponent threaten after this move?"';
        if (bestMoveReadable) {
          detail = 'The best move was ' + bestMoveReadable + '.';
          if (pvReadable) {
            detail += ' Best line: ' + pvReadable;
          }
        }
        break;
      default:
        title = 'Move Played';
        message = '';
        detail = '';
    }

    return { title, message, detail, pvMoves: pv || [] };
  }

  /**
   * Explain why Stockfish chose its move in human-readable terms.
   * @param {object} params — { move, score, scoreType, mate, depth, pv, captured, wasCheck, isOpening, boardState }
   * @returns {object} { title, message, pvMoves } — pvMoves is the raw UCI array for arrow drawing
   */
  function engineExplanation(params) {
    const { move, score, scoreType, mate, depth, pv, captured, wasCheck, isOpening, boardState } = params;
    const readableMove = boardState ? describeUCIMove(move, boardState) : (move || '?');
    let title = 'Stockfish played ' + readableMove;
    let message = '';

    if (scoreType === 'mate') {
      if (mate > 0) {
        message = 'Stockfish sees forced checkmate in ' + Math.abs(mate) + ' moves!';
      } else {
        message = 'Stockfish is trying to delay checkmate (mate in ' + Math.abs(mate) + ' for you).';
      }
    } else {
      const absScore = Math.abs(score || 0);
      if (absScore < 0.3) {
        message = 'The position is roughly equal.';
      } else if (absScore < 1) {
        message = (score > 0 ? 'White' : 'Black') + ' has a slight edge (' + (score > 0 ? '+' : '') + score.toFixed(1) + ').';
      } else if (absScore < 3) {
        message = (score > 0 ? 'White' : 'Black') + ' has a clear advantage (' + (score > 0 ? '+' : '') + score.toFixed(1) + ').';
      } else {
        message = (score > 0 ? 'White' : 'Black') + ' is winning (' + (score > 0 ? '+' : '') + score.toFixed(1) + ').';
      }
    }

    if (captured) {
      message += ' This move captures material.';
    }
    if (wasCheck) {
      message += ' This move gives check.';
    }
    if (pv && pv.length > 1 && boardState) {
      const readable = pvToReadable(pv.slice(0, 5), boardState);
      if (readable) {
        message += ' Expected continuation: ' + readable;
      }
    }

    return { title, message, pvMoves: pv || [] };
  }

  /* ════════════════════════════════════════════════════════════════════
   *  UCI → READABLE MOVE HELPERS
   *  Convert engine notation like "d8e7" into "Queen to e7"
   * ════════════════════════════════════════════════════════════════════ */

  const PIECE_NAMES = { p: 'Pawn', n: 'Knight', b: 'Bishop', r: 'Rook', q: 'Queen', k: 'King' };
  const FILE_NAMES = { a: 'a', b: 'b', c: 'c', d: 'd', e: 'e', f: 'f', g: 'g', h: 'h' };
  const PROMO_NAMES = { q: 'Queen', r: 'Rook', b: 'Bishop', n: 'Knight' };

  /**
   * Describe a single UCI move in plain English given a board state.
   * e.g. "e2e4" → "Pawn to e4", "d4g7" → "Bishop takes g7"
   */
  function describeUCIMove(uci, state) {
    if (!uci || uci.length < 4) return uci || '?';
    const fromAlg = uci.substring(0, 2);
    const toAlg = uci.substring(2, 4);
    const promo = uci.length > 4 ? uci[4] : null;

    const fromSq = Chess.fromAlg(fromAlg);
    const toSq = Chess.fromAlg(toAlg);
    const piece = state.board[fromSq];
    const target = state.board[toSq];

    if (!piece) return toAlg; // fallback

    // Detect castling
    if (piece.type === 'k' && Math.abs(Chess.col(fromSq) - Chess.col(toSq)) === 2) {
      return Chess.col(toSq) > Chess.col(fromSq) ? 'Castle kingside' : 'Castle queenside';
    }

    const pieceName = PIECE_NAMES[piece.type] || 'Piece';
    const isCapture = !!target;
    let desc;

    if (isCapture) {
      const targetName = PIECE_NAMES[target.type] || 'piece';
      desc = pieceName + ' takes ' + targetName + ' on ' + toAlg;
    } else {
      desc = pieceName + ' to ' + toAlg;
    }

    if (promo) {
      desc += ', promotes to ' + (PROMO_NAMES[promo] || 'Queen');
    }

    return desc;
  }

  /**
   * Convert a PV line (array of UCI moves) into a readable sentence.
   * Walks the board state forward so each move is described accurately.
   * Returns something like: "Knight to f3, then Bishop takes e4, then Pawn to d3"
   */
  function pvToReadable(uciMoves, state) {
    if (!uciMoves || uciMoves.length === 0) return '';

    const descriptions = [];
    let currentState = state;

    for (const uci of uciMoves) {
      if (!uci || uci.length < 4) break;

      const desc = describeUCIMove(uci, currentState);
      descriptions.push(desc);

      // Advance the board state so next move's piece lookup is correct
      const fromSq = Chess.fromAlg(uci.substring(0, 2));
      const toSq = Chess.fromAlg(uci.substring(2, 4));
      const promo = uci.length > 4 ? uci[4] : null;
      const result = Chess.makeMove(currentState, fromSq, toSq, promo);
      if (!result) break; // illegal or invalid — stop
      currentState = result.state;
    }

    if (descriptions.length === 0) return '';
    if (descriptions.length === 1) return descriptions[0];
    return descriptions[0] + ', then ' + descriptions.slice(1).join(', then ');
  }

  /**
   * Describe a single UCI best-move string for display (e.g. "Knight to f3").
   * Convenience wrapper used in coach "Best was:" display.
   */
  function describeBestMove(uci, state) {
    return describeUCIMove(uci, state);
  }

  /* ════════════════════════════════════════════════════════════════════
   *  EXPLAIN WHY THE BEST MOVE IS GOOD
   * ════════════════════════════════════════════════════════════════════
   *
   *  Analyzes the board and the best move to give a short plain-English
   *  reason: wins material, gives check, develops a piece, controls the
   *  center, defends an attacked piece, etc.
   */

  var CENTER_SQUARES = [27, 28, 35, 36]; // d4, e4, d5, e5
  var WIDE_CENTER    = [18, 19, 20, 21, 26, 29, 34, 37, 42, 43, 44, 45]; // c3-f3, c4, f4, c5, f5, c6-f6

  function explainBestMove(uci, state) {
    if (!uci || uci.length < 4 || !state) return '';

    var fromSq  = Chess.fromAlg(uci.substring(0, 2));
    var toSq    = Chess.fromAlg(uci.substring(2, 4));
    var promo   = uci.length > 4 ? uci[4] : null;
    var piece   = state.board[fromSq];
    var target  = state.board[toSq];
    if (!piece) return '';

    var color   = piece.color;
    var enemy   = color === 'w' ? 'b' : 'w';
    var reasons = [];

    // 1. Promotion
    if (promo) {
      reasons.push('promotes the pawn — gaining a powerful new piece');
      return reasons[0];
    }

    // 2. Capture — explain material gain
    if (target && target.color === enemy) {
      var myVal  = Chess.PIECE_VALUES[piece.type] || 0;
      var theirVal = Chess.PIECE_VALUES[target.type] || 0;
      var targetName = PIECE_NAMES[target.type] || 'piece';

      if (theirVal > myVal) {
        reasons.push('wins material — takes a ' + targetName + ' worth more than the ' + PIECE_NAMES[piece.type]);
      } else if (theirVal === myVal) {
        reasons.push('trades pieces, which simplifies the position');
      } else {
        // Even a "bad" trade can be the best move — it might be defended
        reasons.push('captures the ' + targetName);
      }
    }

    // 3. Does this move give check?
    var moveResult = Chess.makeMove(state, fromSq, toSq, promo);
    if (moveResult) {
      var afterState = moveResult.state;
      if (Chess.isInCheck(afterState.board, afterState.turn)) {
        reasons.push('gives check, putting the king under immediate pressure');
      }

      // 4. Does this move checkmate?
      var status = Chess.getStatus(afterState);
      if (status.over && status.winner) {
        return 'this is checkmate!';
      }
    }

    // 5. Castling — king safety
    if (piece.type === 'k' && Math.abs(Chess.col(fromSq) - Chess.col(toSq)) === 2) {
      return 'castling gets the king to safety and activates the rook';
    }

    // 6. Defends an attacked piece
    // After the best move, check if the piece on toSq is defending something
    // Simpler: check if any friendly piece was attacked and this move blocks/defends
    if (!target && moveResult) {
      // Was the from-square piece defending something? Check if any friendly piece
      // is attacked by the enemy
      var friendlyPieces = [];
      for (var sq = 0; sq < 64; sq++) {
        var p = state.board[sq];
        if (p && p.color === color && sq !== fromSq && Chess.PIECE_VALUES[p.type] > 0) {
          if (Chess.isAttackedBy(state.board, sq, enemy)) {
            friendlyPieces.push({ sq: sq, piece: p });
          }
        }
      }

      // Does moving to toSq now defend any of those attacked pieces?
      // (after the move, is the attacked piece still attacked but now also defended?)
      if (friendlyPieces.length > 0 && moveResult) {
        for (var i = 0; i < friendlyPieces.length; i++) {
          var fp = friendlyPieces[i];
          // Check if our moved piece now defends fp.sq
          if (Chess.isAttackedBy(moveResult.state.board, fp.sq, color)) {
            reasons.push('defends the ' + PIECE_NAMES[fp.piece.type] + ' that was under attack');
            break;
          }
        }
      }
    }

    // 7. Developing a minor piece (knight/bishop) from back rank
    if ((piece.type === 'n' || piece.type === 'b')) {
      var backRank = color === 'w' ? 7 : 0;
      if (Chess.row(fromSq) === backRank) {
        reasons.push('develops the ' + PIECE_NAMES[piece.type] + ' — getting pieces off the back rank and into the game');
      }
    }

    // 8. Center control — moving to or toward center squares
    if (CENTER_SQUARES.indexOf(toSq) >= 0) {
      if (piece.type === 'p') {
        reasons.push('controls the center with a pawn, limiting your opponent\'s options');
      } else {
        reasons.push('places the ' + PIECE_NAMES[piece.type] + ' on a strong central square');
      }
    } else if (WIDE_CENTER.indexOf(toSq) >= 0 && reasons.length === 0) {
      reasons.push('moves toward the center, improving the piece\'s activity');
    }

    // 9. Pawn advance creating threats
    if (piece.type === 'p' && !target && reasons.length === 0) {
      // Check if the pawn advance attacks enemy pieces
      var pawnDir = color === 'w' ? -1 : 1;
      var pawnRow = Chess.row(toSq);
      var pawnCol = Chess.col(toSq);
      var leftAttack = (pawnCol > 0) ? state.board[Chess.sq(pawnRow + pawnDir, pawnCol - 1)] : null;
      var rightAttack = (pawnCol < 7) ? state.board[Chess.sq(pawnRow + pawnDir, pawnCol + 1)] : null;
      // Actually check what the pawn attacks AFTER it moves (attacking diagonals from toSq)
      var atkRow = pawnRow + pawnDir;
      if (atkRow >= 0 && atkRow < 8) {
        var atkL = (pawnCol > 0) ? state.board[Chess.sq(atkRow, pawnCol - 1)] : null;
        var atkR = (pawnCol < 7) ? state.board[Chess.sq(atkRow, pawnCol + 1)] : null;
        if ((atkL && atkL.color === enemy) || (atkR && atkR.color === enemy)) {
          reasons.push('advances the pawn, creating an attack on an enemy piece');
        }
      }
    }

    // 10. Fallback — piece is moving to a more active square
    if (reasons.length === 0) {
      reasons.push('improves the position of the ' + PIECE_NAMES[piece.type]);
    }

    // Return the first (most important) reason only — keep it short
    return reasons[0];
  }

  return {
    getCategories,
    getLessonById,
    getAllLessons,
    coachMessage,
    engineExplanation,
    describeBestMove,
    explainBestMove,
    pvToReadable,
    LESSONS,
  };
})();
