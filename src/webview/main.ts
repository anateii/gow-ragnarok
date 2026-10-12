import { formatCountdown } from "../countdown";

declare function acquireVsCodeApi(): { postMessage(message: unknown): void };

type Mood = "idle" | "pleased" | "annoyed";

type Message =
  | { type: "say"; line: string }
  | { type: "mood"; mood: Mood; line: string }
  | { type: "pin"; mood: Mood; line: string }
  | { type: "unpin" }
  | { type: "waterReadyAt"; time: number }
  | { type: "doze"; line: string | null }
  | { type: "vitality"; value: number; stage: Stage };

type Stage = "wilting" | "steady" | "thriving";

const mimirEl = document.getElementById("mimir") as HTMLDivElement;
const face = document.getElementById("face") as HTMLImageElement;
const faceNext = document.getElementById("face-next") as HTMLImageElement;
const statusLine = document.getElementById("status") as HTMLDivElement;

/** A face to show: one of the moods, or his sleepy resting face. */
type Face = Mood | "sleepy";

const faces: Record<Face, string> = {
  idle: face.dataset.idle ?? face.src,
  pleased: face.dataset.pleased ?? face.src,
  annoyed: face.dataset.annoyed ?? face.src,
  sleepy: face.dataset.sleepy ?? face.src,
};

// At or below this vitality score (as displayed), Mimir rests with his
// sleepy face instead of the idle one.
const SLEEPY_AT_OR_BELOW = 30;
let lowVitality = false;

// Keep in sync with the #face-next transition in style.css.
const FADE_MS = 350;

/** Restarts a CSS animation class, even if it's already applied. */
function replay(el: HTMLElement, className: string): void {
  el.classList.remove(className);
  el.getBoundingClientRect(); // force a reflow so the animation starts over
  el.classList.add(className);
}

function show(line: string, asleep = false): void {
  statusLine.classList.toggle("asleep", asleep);
  if (statusLine.textContent === line) {
    return;
  }
  statusLine.textContent = line;
  replay(statusLine, "pop");
}

let currentMood: Face = "idle";
// Bumped on every change so a slow fade can't overwrite a newer mood.
let faceChange = 0;

function setFace(next: Face): void {
  if (next === currentMood) {
    return;
  }
  currentMood = next;
  const change = ++faceChange;
  const url = faces[next] || faces.idle;

  mimirEl.classList.remove("gesture-pleased", "gesture-annoyed");
  if (next === "pleased" || next === "annoyed") {
    replay(mimirEl, `gesture-${next}`);
  }

  // Crossfade: fade the new face in on top, then swap it underneath.
  faceNext.src = url;
  void faceNext
    .decode()
    .catch(() => undefined)
    .then(() => {
      if (change !== faceChange) {
        return;
      }
      faceNext.classList.add("visible");
      setTimeout(() => {
        if (change !== faceChange) {
          return;
        }
        face.src = url;
        // Hide the overlay instantly; the face underneath now matches it.
        faceNext.style.transition = "none";
        faceNext.classList.remove("visible");
        faceNext.getBoundingClientRect();
        faceNext.style.transition = "";
      }, FADE_MS);
    });
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

  const low = Math.round(value) <= SLEEPY_AT_OR_BELOW;
  if (low !== lowVitality) {
    lowVitality = low;
    // Only swap the resting face now; a brief reaction finishes first.
    if (!pinned && revertTimer === undefined) {
      setFace(restingFace());
    }
  }
}

/** His face when nothing else is going on. */
function restingFace(): Face {
  return dozeLine || lowVitality ? "sleepy" : "idle";
}

// A pinned mood and line (e.g. an unresolved error) stay on screen; other
// messages show briefly and then give way to it again. While Mimir is dozing,
// his sleepy line is the fallback when nothing is pinned.
let pinned: { mood: Mood; line: string } | undefined;
let dozeLine: string | undefined;
let revertTimer: ReturnType<typeof setTimeout> | undefined;

function settle(): void {
  revertTimer = undefined;
  if (pinned) {
    setFace(pinned.mood);
    show(pinned.line);
  } else if (dozeLine) {
    setFace("sleepy");
    show(dozeLine, true);
  } else {
    setFace(restingFace());
  }
}

function showBriefly(line: string, mood?: Mood): void {
  clearTimeout(revertTimer);
  revertTimer = undefined;
  if (mood) {
    setFace(mood);
  }
  show(line);
  if (pinned || dozeLine || (mood && mood !== "idle")) {
    revertTimer = setTimeout(settle, 4000);
  }
}

function setDozing(line: string | undefined): void {
  dozeLine = line;
  document.getElementById("stage")?.classList.toggle("dozing", !!line);
  // Fall asleep now unless a brief message is still showing; it will settle
  // into the sleepy line by itself. Waking up leaves the current line alone
  // so the reward message that woke him stays visible.
  if (line && revertTimer === undefined) {
    settle();
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
      msg.type !== "waterReadyAt" &&
      msg.type !== "doze")
  ) {
    return;
  }
  if (msg.type === "doze") {
    setDozing(msg.line ?? undefined);
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
    // Fall back to the sleepy line if he's dozing, unless a message is showing.
    if (dozeLine && revertTimer === undefined) {
      settle();
    }
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
