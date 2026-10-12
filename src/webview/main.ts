declare function acquireVsCodeApi(): { postMessage(message: unknown): void };

type Mood = "idle" | "pleased" | "annoyed";

type Message =
  | { type: "say"; line: string }
  | { type: "mood"; mood: Mood; line: string }
  | { type: "rune" }
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

function dropRune(): void {
  document.getElementById("rune")?.remove();
  const rune = document.createElement("div");
  rune.id = "rune";
  rune.textContent = "ᚱ";
  document.getElementById("stage")?.appendChild(rune);
  setFace("pleased");
  show("A rune. Catch it, brother.");
  setTimeout(() => {
    rune.remove();
    setFace("idle");
  }, 4000);
}

window.addEventListener("message", (event: MessageEvent<Message>) => {
  const msg = event.data;
  if (
    !msg ||
    (msg.type !== "say" &&
      msg.type !== "mood" &&
      msg.type !== "rune" &&
      msg.type !== "vitality")
  ) {
    return;
  }
  if (msg.type === "vitality") {
    setVitality(msg.value, msg.stage);
    return;
  }
  if (msg.type === "rune") {
    dropRune();
    return;
  }
  if (msg.type === "say") {
    show(msg.line);
    return;
  }
  setFace(msg.mood);
  show(msg.line);
  if (msg.mood !== "idle") {
    setTimeout(() => setFace("idle"), 4000);
  }
});

acquireVsCodeApi().postMessage({ type: "ready" });
