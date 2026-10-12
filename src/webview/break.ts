import { formatCountdown } from "../countdown";

declare function acquireVsCodeApi(): { postMessage(message: unknown): void };

const vscode = acquireVsCodeApi();
const root = document.getElementById("break") as HTMLElement;
const countdown = document.getElementById("break-countdown") as HTMLElement;
const endsAt = Number(root.dataset.endsAt);

function render(): void {
  countdown.textContent = formatCountdown(endsAt, Date.now());
}

render();
setInterval(render, 1000);

document.getElementById("end-break")?.addEventListener("click", () => {
  vscode.postMessage({ type: "endBreak" });
});
