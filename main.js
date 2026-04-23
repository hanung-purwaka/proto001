const OPERATORS = ["+", "-", "x", ":"];
const MAX_SEGMENT_VALUE = 30;

const LEVELS = [
  {
    id: 1,
    rows: 6,
    cols: 6,
    segments: 10,
    advancePerSecond: 0.025,
    setback: 0.12,
    numberRange: [1, 9],
    probabilities: { number: 0.46, operator: 0.22, empty: 0.32 },
  },
  {
    id: 2,
    rows: 6,
    cols: 7,
    segments: 10,
    advancePerSecond: 0.0325,
    setback: 0.13,
    numberRange: [1, 12],
    probabilities: { number: 0.43, operator: 0.24, empty: 0.33 },
  },
  {
    id: 3,
    rows: 7,
    cols: 7,
    segments: 10,
    advancePerSecond: 0.04,
    setback: 0.14,
    numberRange: [2, 16],
    probabilities: { number: 0.4, operator: 0.27, empty: 0.33 },
  },
  {
    id: 4,
    rows: 7,
    cols: 8,
    segments: 10,
    advancePerSecond: 0.0475,
    setback: 0.15,
    numberRange: [3, 20],
    probabilities: { number: 0.38, operator: 0.29, empty: 0.33 },
  },
  {
    id: 5,
    rows: 8,
    cols: 8,
    segments: 10,
    advancePerSecond: 0.055,
    setback: 0.16,
    numberRange: [4, 24],
    probabilities: { number: 0.36, operator: 0.31, empty: 0.33 },
  },
];

const boardElement = document.getElementById("board");
const segmentsLeftElement = document.getElementById("segmentsLeft");
const selectionValueElement = document.getElementById("selectionValue");
const selectionTrayElement = document.getElementById("selectionTray");
const snakeTrackElement = document.getElementById("snakeTrack");
const submitButton = document.getElementById("submitButton");
const clearButton = document.getElementById("clearButton");
const restartButton = document.getElementById("restartButton");

const state = {
  levelIndex: 0,
  board: [],
  selectionPath: [],
  selectionTokens: [],
  snake: {
    segments: [],
    progress: 0,
  },
  blockedCell: null,
  gamePhase: "idle",
  lastTimestamp: 0,
  animationFrame: null,
};

function createCell(row, col, type = "empty", value = null) {
  return { row, col, type, value };
}

function getLevel() {
  return LEVELS[state.levelIndex];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sampleCellType(probabilities) {
  const roll = Math.random();
  if (roll < probabilities.number) {
    return "number";
  }
  if (roll < probabilities.number + probabilities.operator) {
    return "operator";
  }
  return "empty";
}

function sampleCellContent(level) {
  const type = sampleCellType(level.probabilities);
  if (type === "number") {
    return { type, value: randomInt(level.numberRange[0], level.numberRange[1]) };
  }
  if (type === "operator") {
    return { type, value: OPERATORS[randomInt(0, OPERATORS.length - 1)] };
  }
  return { type: "empty", value: null };
}

function populateCell(row, col) {
  const content = sampleCellContent(getLevel());
  state.board[row][col] = createCell(row, col, content.type, content.value);
}

function buildBoard() {
  const level = getLevel();
  state.board = Array.from({ length: level.rows }, (_, row) =>
    Array.from({ length: level.cols }, (_, col) => {
      const content = sampleCellContent(level);
      return createCell(row, col, content.type, content.value);
    })
  );

  ensureBoardHasPlayableContent();
}

function ensureBoardHasPlayableContent() {
  const level = getLevel();
  const flattened = state.board.flat();
  const numbers = flattened.filter((cell) => cell.type === "number");
  const operators = flattened.filter((cell) => cell.type === "operator");

  if (numbers.length < 4) {
    for (let i = numbers.length; i < 4; i += 1) {
      const row = randomInt(0, level.rows - 1);
      const col = randomInt(0, level.cols - 1);
      state.board[row][col] = createCell(row, col, "number", randomInt(level.numberRange[0], level.numberRange[1]));
    }
  }

  if (operators.length < 2) {
    for (let i = operators.length; i < 2; i += 1) {
      const row = randomInt(0, level.rows - 1);
      const col = randomInt(0, level.cols - 1);
      state.board[row][col] = createCell(row, col, "operator", OPERATORS[randomInt(0, OPERATORS.length - 1)]);
    }
  }
}

function buildSnake() {
  const level = getLevel();
  state.snake.segments = [];
  state.snake.progress = 0;

  for (let i = 0; i < level.segments; i += 1) {
    state.snake.segments.push(generateSegmentValue(level, i));
  }

  ensureBoardHasAttackOption();
}

function generateSegmentValue(level, index) {
  const expression = generateSolvableExpression(level, index);
  return expression.value;
}

function startLevel(levelIndex) {
  state.levelIndex = levelIndex;
  state.selectionPath = [];
  state.selectionTokens = [];
  state.gamePhase = "playing";
  state.lastTimestamp = 0;
  buildBoard();
  buildSnake();
  updateStatus("Build an expression that matches any snake segment.", "");
  render();
  startLoop();
}

function restartGame() {
  cancelLoop();
  startLevel(0);
}

function startLoop() {
  cancelLoop();
  state.animationFrame = requestAnimationFrame(gameLoop);
}

function cancelLoop() {
  if (state.animationFrame) {
    cancelAnimationFrame(state.animationFrame);
    state.animationFrame = null;
  }
}

function gameLoop(timestamp) {
  if (state.gamePhase !== "playing") {
    return;
  }

  if (!state.lastTimestamp) {
    state.lastTimestamp = timestamp;
  }

  const delta = (timestamp - state.lastTimestamp) / 1000;
  state.lastTimestamp = timestamp;

  state.snake.progress += getLevel().advancePerSecond * delta;
  const headX = getSnakeHeadX();

  if (headX <= 10) {
    renderMotion();
    endLevel(false);
    return;
  }

  renderMotion();
  state.animationFrame = requestAnimationFrame(gameLoop);
}

function endLevel(didWin) {
  cancelLoop();

  if (!didWin) {
    state.gamePhase = "lost";
    updateStatus("The snake head reached the target post. Restart or try the level again.", "status-danger");
    return;
  }

  if (state.levelIndex === LEVELS.length - 1) {
    state.gamePhase = "won";
    updateStatus("All 5 levels cleared. The prototype win flow is complete.", "status-success");
    return;
  }

  state.gamePhase = "transition";
  updateStatus(`Level ${getLevel().id} cleared. Advancing to level ${getLevel().id + 1}.`, "status-success");
  window.setTimeout(() => startLevel(state.levelIndex + 1), 1200);
}

function updateStatus(message, className) {
  void message;
  void className;
}

function render() {
  renderHud();
  renderSnake();
  renderSelectionTray();
  renderBoard();
}

function renderMotion() {
  renderHud();
  renderSnake();
  renderSelectionTray();
}

function renderHud() {
  segmentsLeftElement.textContent = `${state.snake.segments.length} segments left`;
  selectionValueElement.textContent = getSelectionPreview();
  updateSubmitState();
}

function updateSubmitState() {
  const tokens = selectedTokenCells().map((cell) => cell.value);
  const evaluation = evaluateTokens(tokens);
  submitButton.disabled = state.gamePhase !== "playing" || !evaluation.valid;
}

function generateSolvableExpression(level, depthBias = 0, exactTarget = null) {
  const [min, max] = level.numberRange;
  const preferredOperators = depthBias >= 4 ? ["+", "-", "x", ":"] : ["+", "-", "x"];
  const operators = exactTarget === null ? preferredOperators : OPERATORS;
  const candidates = [];

  for (const operator of operators) {
    if (operator === "+") {
      for (let left = min; left <= max; left += 1) {
        const right = exactTarget === null ? randomInt(min, max) : exactTarget - left;
        const value = left + right;
        if (right >= min && right <= max && value > 0) {
          candidates.push({ tokens: [left, "+", right], value });
        }
      }
    } else if (operator === "-") {
      for (let left = min; left <= max; left += 1) {
        const right = exactTarget === null ? randomInt(min, max) : left - exactTarget;
        const value = left - right;
        if (right >= min && right <= max && value > 0) {
          candidates.push({ tokens: [left, "-", right], value });
        }
      }
    } else if (operator === "x") {
      for (let left = min; left <= max; left += 1) {
        if (exactTarget === null) {
          const right = randomInt(min, max);
          candidates.push({ tokens: [left, "x", right], value: left * right });
        } else if (exactTarget % left === 0) {
          const right = exactTarget / left;
          if (right >= min && right <= max) {
            candidates.push({ tokens: [left, "x", right], value: exactTarget });
          }
        }
      }
    } else if (operator === ":") {
      for (let right = min; right <= max; right += 1) {
        if (exactTarget === null) {
          const value = randomInt(min, max);
          const left = value * right;
          if (left >= min && left <= max) {
            candidates.push({ tokens: [left, ":", right], value });
          }
        } else {
          const left = exactTarget * right;
          if (left >= min && left <= max) {
            candidates.push({ tokens: [left, ":", right], value: exactTarget });
          }
        }
      }
    }
  }

  const validCandidates = exactTarget === null
    ? candidates.filter((candidate) => candidate.value > 0 && candidate.value <= MAX_SEGMENT_VALUE)
    : candidates.filter((candidate) => candidate.value === exactTarget);

  if (!validCandidates.length) {
    const fallbackRight = Math.min(min, Math.max(1, MAX_SEGMENT_VALUE - min));
    return { tokens: [min, "+", fallbackRight], value: min + fallbackRight };
  }

  return validCandidates[randomInt(0, validCandidates.length - 1)];
}

function renderSnake() {
  snakeTrackElement.innerHTML = "";
  const lane = document.createElement("div");
  lane.className = "snake-lane";
  snakeTrackElement.appendChild(lane);

  const segmentSpacing = 12;
  const frontX = getSnakeHeadX();
  const rowCapacity = 5;

  state.snake.segments.forEach((value, index) => {
    const segment = document.createElement("div");
    segment.className = `snake-segment ${index === 0 ? "head" : ""}`;
    segment.textContent = String(value);
    const isTopRow = index < rowCapacity;
    const col = isTopRow ? index : (rowCapacity - 1) - (index - rowCapacity);
    const x = frontX + col * segmentSpacing;
    const baseY = isTopRow ? 32 : 68;
    const y = baseY + Math.sin((state.snake.progress * 6) + index * 0.55) * 4;
    segment.style.left = `${x}%`;
    segment.style.top = `${y}%`;
    lane.appendChild(segment);
  });
}

function getSnakeHeadX() {
  return 96 - state.snake.progress * 86;
}

function renderBoard() {
  const level = getLevel();
  boardElement.style.gridTemplateColumns = `repeat(${level.cols}, minmax(0, 1fr))`;
  boardElement.innerHTML = "";

  for (let row = 0; row < level.rows; row += 1) {
    for (let col = 0; col < level.cols; col += 1) {
      const cell = state.board[row][col];
      const cellElement = document.createElement("div");
      cellElement.className = `cell ${cell.type}`;
      cellElement.dataset.row = String(row);
      cellElement.dataset.col = String(col);
      cellElement.textContent = cell.value ?? "";

      const pathIndex = findPathIndex(row, col);
      if (pathIndex >= 0) {
        cellElement.classList.add("path");
        if (cell.type !== "empty") {
          cellElement.classList.add("selected");
        }
      }

      if (state.blockedCell?.row === row && state.blockedCell?.col === col) {
        cellElement.classList.add("blocked");
      }

      boardElement.appendChild(cellElement);
    }
  }
}

function renderSelectionTray() {
  selectionTrayElement.innerHTML = "";
  const tokens = selectedTokenCells();
  const slotCount = Math.max(tokens.length + 1, 3);

  for (let index = 0; index < slotCount; index += 1) {
    const cell = tokens[index];

    if (cell) {
      const chip = document.createElement("div");
      chip.className = `selection-chip ${cell.type === "operator" ? "operator-chip" : ""}`.trim();
      chip.textContent = String(cell.value);
      selectionTrayElement.appendChild(chip);
      continue;
    }

    const placeholder = document.createElement("div");
    placeholder.className = `selection-placeholder ${index % 2 === 0 ? "slot-number" : "slot-operator"}`;
    selectionTrayElement.appendChild(placeholder);
  }
}

function getSelectionPreview() {
  const tokens = selectedTokenCells().map((cell) => cell.value);
  if (!tokens.length) {
    return "Tap to select";
  }

  const expression = tokens.join(" ");
  const result = evaluateTokens(tokens);
  if (result.valid) {
    return `${expression} = ${result.value}`;
  }
  return expression;
}

function selectedTokenCells() {
  return state.selectionTokens;
}

function evaluateTokens(tokens) {
  if (!tokens.length || tokens.length % 2 === 0) {
    return { valid: false, value: null };
  }

  if (typeof tokens[0] !== "number") {
    return { valid: false, value: null };
  }

  let total = tokens[0];

  for (let i = 1; i < tokens.length; i += 2) {
    const operator = tokens[i];
    const operand = tokens[i + 1];

    if (!OPERATORS.includes(operator) || typeof operand !== "number") {
      return { valid: false, value: null };
    }

    if (operator === "+") {
      total += operand;
    } else if (operator === "-") {
      total -= operand;
    } else if (operator === "x") {
      total *= operand;
    } else if (operator === ":") {
      if (operand === 0 || total % operand !== 0) {
        return { valid: false, value: null };
      }
      total /= operand;
    }
  }

  return { valid: Number.isFinite(total), value: total };
}

function submitSelection() {
  if (state.gamePhase !== "playing") {
    return;
  }

  const tokens = selectedTokenCells().map((cell) => cell.value);
  const evaluation = evaluateTokens(tokens);
  if (!evaluation.valid) {
    updateStatus("The selected path is not a valid math expression.", "status-warning");
    clearSelection();
    render();
    return;
  }

  const targetIndex = state.snake.segments.findIndex((segment) => segment === evaluation.value);

  if (targetIndex >= 0) {
    consumeSelectedCells();
    const matchedValue = state.snake.segments[targetIndex];
    state.snake.segments.splice(targetIndex, 1);
    state.snake.progress = Math.max(0, state.snake.progress - 0.08);
    clearSelection();
    refillBoard();

    if (!state.snake.segments.length) {
      render();
      endLevel(true);
      return;
    }

    ensureBoardHasAttackOption();
    updateStatus(`Matched ${matchedValue}. The corresponding segment is destroyed.`, "status-success");
    render();
    return;
  }

  state.snake.progress = Math.max(0, state.snake.progress - getLevel().setback);
  updateStatus(`Expression equals ${evaluation.value}, which matches no segment. The snake is pushed back.`, "status-warning");
  clearSelection();
  render();
}

function consumeSelectedCells() {
  for (const step of state.selectionPath) {
    const cell = state.board[step.row][step.col];
    if (cell.type !== "empty") {
      state.board[step.row][step.col] = createCell(step.row, step.col, "empty", null);
    }
  }
}

function refillBoard() {
  const level = getLevel();
  const flattened = state.board.flat();
  const filledCount = flattened.filter((cell) => cell.type !== "empty").length;
  const targetFilled = Math.round(level.rows * level.cols * (1 - level.probabilities.empty));
  let cellsToFill = Math.max(1, targetFilled - filledCount);

  while (cellsToFill > 0) {
    const row = randomInt(0, level.rows - 1);
    const col = randomInt(0, level.cols - 1);
    if (state.board[row][col].type === "empty") {
      populateCell(row, col);
      cellsToFill -= 1;
    }
  }

  ensureBoardHasPlayableContent();
}

function ensureBoardHasAttackOption() {
  const target = state.snake.segments[randomInt(0, state.snake.segments.length - 1)];
  if (target === undefined) {
    return;
  }

  const expression = generateSolvableExpression(getLevel(), state.levelIndex, target);
  placeGuaranteedPath(expression.tokens);
}

function placeGuaranteedPath(tokens) {
  const level = getLevel();
  const used = new Set();

  for (let index = 0; index < tokens.length; index += 1) {
    let row = 0;
    let col = 0;
    let guard = 0;

    do {
      row = randomInt(0, level.rows - 1);
      col = randomInt(0, level.cols - 1);
      guard += 1;
    } while (used.has(`${row},${col}`) && guard < 100);

    used.add(`${row},${col}`);
    state.board[row][col] = createCell(
      row,
      col,
      index % 2 === 0 ? "number" : "operator",
      tokens[index]
    );
  }
}

function clearSelection() {
  state.selectionPath = [];
  state.selectionTokens = [];
}

function flashBlockedCell(row, col) {
  state.blockedCell = { row, col };
  renderBoard();
  window.setTimeout(() => {
    if (state.blockedCell?.row === row && state.blockedCell?.col === col) {
      state.blockedCell = null;
      renderBoard();
    }
  }, 180);
}

function findPathIndex(row, col) {
  return state.selectionPath.findIndex((step) => step.row === row && step.col === col);
}

function canExtendPath(nextStep) {
  const cell = state.board[nextStep.row][nextStep.col];
  const existingIndex = findPathIndex(nextStep.row, nextStep.col);

  if (!state.selectionTokens.length) {
    return cell.type !== "empty";
  }

  if (existingIndex >= 0) {
    return false;
  }

  const expectedType = state.selectionTokens.length % 2 === 0 ? "number" : "operator";
  return cell.type === expectedType;
}

function replaceLastSelection(row, col) {
  const cell = state.board[row][col];
  if (cell.type === "empty" || !state.selectionTokens.length) {
    return false;
  }

  const lastToken = state.selectionTokens[state.selectionTokens.length - 1];
  if (lastToken.type !== cell.type) {
    return false;
  }

  state.selectionPath[state.selectionPath.length - 1] = { row, col };
  state.selectionTokens[state.selectionTokens.length - 1] = {
    row,
    col,
    type: cell.type,
    value: cell.value,
  };
  renderHud();
  renderSelectionTray();
  renderBoard();
  return true;
}

function extendPath(row, col) {
  const step = { row, col };
  if (!canExtendPath(step)) {
    flashBlockedCell(row, col);
    return;
  }

  state.selectionPath.push(step);
  const cell = state.board[row][col];
  state.selectionTokens.push({
    row,
    col,
    type: cell.type,
    value: cell.value,
  });
  renderHud();
  renderSelectionTray();
  renderBoard();
}

function beginSelection(row, col) {
  clearSelection();
  extendPath(row, col);
}

function handleCellSelection(row, col) {
  if (!state.selectionPath.length) {
    beginSelection(row, col);
    return;
  }

  if (replaceLastSelection(row, col)) {
    return;
  }

  if (canExtendPath({ row, col })) {
    extendPath(row, col);
  } else {
    flashBlockedCell(row, col);
  }
}

function handleBoardPress(event) {
  const cellButton = event.target.closest(".cell");
  if (!cellButton || state.gamePhase !== "playing") {
    return;
  }

  handleCellSelection(Number(cellButton.dataset.row), Number(cellButton.dataset.col));
}

submitButton.addEventListener("click", submitSelection);
clearButton.addEventListener("click", () => {
  clearSelection();
  updateStatus("Selection cleared.", "");
  render();
});
restartButton.addEventListener("click", restartGame);
boardElement.addEventListener("pointerdown", handleBoardPress);

startLevel(0);
