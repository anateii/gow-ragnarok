import { formatCountdown } from "../countdown";

declare function acquireVsCodeApi(): { postMessage(message: unknown): void };

type Mood = "idle" | "pleased" | "annoyed";

type Message =
  | { type: "say"; line: string }
  | { type: "mood"; mood: Mood; line: string }
  | { type: "pin"; mood: Mood; line: string }
  | { type: "unpin" }
  | { type: "waterReadyAt"; time: number }
  | { type: "vitality"; value: number; stage: Stage };

type Stage = "wilting" | "steady" | "thriving";

const face = document.getElementById("face") as HTMLImageElement;
const statusLine = document.getElementById("status") as HTMLDivElement;

const faces: Record<Mood, string> = {
  idle: face.dataset.idle ?? face.src,
  pleased: face.dataset.pleased ?? face.src,
  annoyed: face.dataset.annoyed ?? face.src,
};

function show(line: string): void {
  statusLine.textContent = line;
}

function setFace(next: Mood): void {
  face.src = faces[next] || faces.idle;
}

function setVitality(value: number, stage: Stage): void {
  const fill = document.getElementById("vitality-fill");
  if (fill) {
    fill.style.width = `${Math.round(value)}%`;
  }
  const score = document.getElementById("vitality-score");
  if (score) {
    score.textContent = `${Math.round(value)}/100`;
  }
  const stageEl = document.getElementById("stage");
  stageEl?.classList.remove("wilting", "steady", "thriving");
  stageEl?.classList.add(stage);
  document
    .getElementById("vitality")
    ?.setAttribute("title", `Vitality ${Math.round(value)}/100 (${stage})`);
}

// A pinned mood and line (e.g. an unresolved error) stay on screen; other
// messages show briefly and then give way to it again.
let pinned: { mood: Mood; line: string } | undefined;
let revertTimer: ReturnType<typeof setTimeout> | undefined;

function settle(): void {
  if (pinned) {
    setFace(pinned.mood);
    show(pinned.line);
  } else {
    setFace("idle");
  }
}

function showBriefly(line: string, mood?: Mood): void {
  clearTimeout(revertTimer);
  if (mood) {
    setFace(mood);
  }
  show(line);
  if (pinned || (mood && mood !== "idle")) {
    revertTimer = setTimeout(settle, 4000);
  }
}

window.addEventListener("message", (event: MessageEvent<Message>) => {
  const msg = event.data;
  if (
    !msg ||
    (msg.type !== "say" &&
      msg.type !== "mood" &&
      msg.type !== "pin" &&
      msg.type !== "unpin" &&
      msg.type !== "vitality" &&
      msg.type !== "waterReadyAt")
  ) {
    return;
  }
  if (msg.type === "waterReadyAt") {
    setWaterReadyAt(msg.time);
    return;
  }
  if (msg.type === "vitality") {
    setVitality(msg.value, msg.stage);
    return;
  }
  if (msg.type === "pin") {
    clearTimeout(revertTimer);
    pinned = { mood: msg.mood, line: msg.line };
    settle();
    return;
  }
  if (msg.type === "unpin") {
    pinned = undefined;
    return;
  }
  if (msg.type === "say") {
    showBriefly(msg.line);
    return;
  }
  showBriefly(msg.line, msg.mood);
});

const vscode = acquireVsCodeApi();

const drinkButton = document.getElementById("drink-water") as HTMLButtonElement;
let waterReadyAt = 0;
let waterTimer: ReturnType<typeof setInterval> | undefined;

function renderWaterButton(): void {
  const now = Date.now();
  if (waterReadyAt <= now) {
    clearInterval(waterTimer);
    waterTimer = undefined;
    drinkButton.disabled = false;
    drinkButton.textContent = "💧 Drink water";
    return;
  }
  drinkButton.disabled = true;
  drinkButton.textContent = `💧 Drink again in ${formatCountdown(waterReadyAt, now)}`;
}

function setWaterReadyAt(time: number): void {
  waterReadyAt = time;
  renderWaterButton();
  if (waterTimer === undefined && time > Date.now()) {
    waterTimer = setInterval(renderWaterButton, 1000);
  }
}

drinkButton.addEventListener("click", () => {
  vscode.postMessage({ type: "drinkWater" });
});

document.getElementById("take-break")?.addEventListener("click", () => {
  vscode.postMessage({ type: "takeBreak" });
});

vscode.postMessage({ type: "ready" });
