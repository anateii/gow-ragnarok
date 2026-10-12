// Everything Mimir says, grouped by the situation that triggers it.
// Add a line to a group and he'll start using it; no other changes needed.

export const lines = {
  /** Summoning him, or when the view opens with nothing else to say. */
  idle: [
    "Brother!",
    "Aye.",
    "Head's up, brother.",
    "The hell's an olive?",
    "I have seen worse realms than this file.",
    "Save your work. Even gods forget.",
    "Now, hold on a moment, Brother.",
  ],

  /** A plain save with nothing else going on. */
  saved: [
    "Saved. Even gods forget, sometimes.",
    "Aye. Saved.",
    "Saved, Brother. Wise.",
  ],

  /** Put before the exact error when a new one appears while editing. */
  errorAppeared: [
    "Behind you, Brother!",
    "Careful, Brother!",
    "Bloody hell!",
    "Well, that's just perfect.",
  ],

  /** Put before the error instead when the file has piled up errors. */
  manyErrors: [
    "That's a fine mess we've gotten ourselves into.",
    "Oh, for the love of—",
  ],

  /** Put before the error when you save and it's still there. */
  errorStillThere: [
    "Aye, there's the rub.",
    "Would you listen to yourself, Brother?",
    "Well, that's just perfect.",
  ],

  /** Put before the summary when you open a file that already has errors. */
  fileHasErrors: ["Now, hold on a moment, Brother.", "Careful, Brother!"],

  /** You saved and the file is error-free. */
  errorsCleared: [
    "Aye. Not a single error left in this file.",
    "Clean. Not a single error left in this file.",
    "Now that's more like it, Brother.",
  ],

  testSaved: [
    "A test! Now the bugs have to fight fair.",
    "Aye, a test. Kratos would approve. Silently.",
  ],

  testsPassed: [
    "You're on fire, Kratos!",
    "Green runes across the board!",
  ],

  water: [
    "Water. Even the World Serpent stays hydrated.",
    "Aye, drink up, Brother.",
  ],

  waterCooldown: [
    "You just drank, Brother. Give it a few minutes.",
    "Would you listen to yourself, Brother? You've only just had some.",
  ],

  waterReminder: [
    "Drink some water, Brother. Heads need it too.",
    "Brother! Water. Now.",
  ],

  /** You walked away from VS Code for a while. */
  walkedAway: [
    "You walked away and came back. Wise, Brother.",
    "Aye, a little air does wonders.",
  ],

  breakReminder: [
    "Now, hold on a moment, Brother. You've been at this an hour. Stretch your legs.",
    "You've been staring at this realm for an hour. Stretch your legs.",
  ],

  breakCompleted: [
    "Welcome back, Brother. You look ten years younger. Well, I would.",
    "Aye, there you are. Rested and ready.",
  ],

  breakEndedEarly: [
    "You daft bastard! Back already?",
    "Back already? The code wasn't going anywhere, Brother.",
    "Oh, for the love of— it's a break, Brother. Take it.",
  ],

  /** Shown while he's dozed off from too long without a break. */
  dozing: ["Zzz…", "Zzz… five more minutes, Brother… zzz…", "Zzz… olives… zzz…"],

  breakExpiredWhileAway: ["The break ended while you were away. Welcome back."],

  thriving: ["You're on fire, Kratos!", "I feel like a young god again!"],
  steady: ["Steady, Brother. Steady.", "Aye."],
  wilting: [
    "Bloody hell! I'm wilting here. A break, a test, some water... anything.",
    "Oh, for the love of— I'm wilting, Brother.",
  ],
} satisfies Record<string, readonly string[]>;

export type Situation = keyof typeof lines;

const lastPicked = new Map<Situation, string>();

/**
 * A random line for the situation, avoiding the one used last time so Mimir
 * doesn't repeat himself back to back.
 */
export function pick(situation: Situation, random = Math.random): string {
  const options = lines[situation];
  const previous = lastPicked.get(situation);
  const pool =
    options.length > 1 ? options.filter((line) => line !== previous) : options;
  const line = pool[Math.floor(random() * pool.length)];
  lastPicked.set(situation, line);
  return line;
}

/** "Behind you, Brother! Line 12: …" — a reaction followed by the details. */
export function withReaction(situation: Situation, details: string): string {
  return `${pick(situation)} ${details}`;
}
