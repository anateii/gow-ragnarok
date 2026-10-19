# God of War: Ragnarök for VS Code

A dark color theme, a file icon theme and Mimir, a virtual pet who lives in your sidebar. Inspired by _God of War Ragnarök_.

👀 Mimir watches you code.
🫤 He reacts when you save and warns you when new errors appear.
💧 He keeps an eye on your project through the Nine Realms, and nags you to drink water and take breaks.
⏰ Keep good habits and he thrives.
😴 Skip your breaks for too long and he dozes off

## Features

### Ragnarok color theme

A dark theme in the colors of the game. Select it with **Preferences: Color Theme**, then **Ragnarok**.

### Ragnarok file icons

Custom file and folder icons. Select them with **Preferences: File Icon Theme**, then **Ragnarok Icons**.

| Icon       | Files                                                                                                                                                        |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| TypeScript | `.ts`, `.mts`, `.cts`                                                                                                                                        |
| JavaScript | `.js`, `.mjs`, `.cjs`                                                                                                                                        |
| React      | `.tsx`, `.jsx`                                                                                                                                               |
| Angular    | `.component.ts`, `.service.ts`, `.module.ts`, `.directive.ts`, `.pipe.ts`, `.guard.ts`, `.interceptor.ts`, `.resolver.ts`, `.component.html`, `angular.json` |
| Python     | `.py`, `.pyi`, `.pyw`, `.ipynb`, `requirements.txt`, `pyproject.toml`, `Pipfile`, `setup.py`                                                                 |
| Ruby       | `.rb`, `.erb`, `.rake`, `.gemspec`, `Gemfile`, `Rakefile`                                                                                                    |
| HTML / CSS | `.html`, `.css`, `.scss`, `.sass`                                                                                                                            |
| JSON       | `.json`, `.jsonc`                                                                                                                                            |
| YAML       | `.yml`, `.yaml`                                                                                                                                              |
| Markdown   | `.md`, `.mdx`, `.markdown`                                                                                                                                   |
| Docker     | `Dockerfile`, `.dockerfile`, `.dockerignore`, `docker-compose.yml`, `compose.yml`                                                                            |
| Git        | `.gitignore`, `.gitattributes`, `.gitmodules`, `.gitkeep`, `.gitconfig`                                                                                      |
| Secrets    | `.env`, `.env.*`, `credentials`                                                                                                                              |
| Lockfiles  | `package.json`, `package-lock.json`, `pnpm-lock.yaml`, `*.lock`                                                                                              |
| Images     | `.png`, `.jpg`, `.jpeg`, `.gif`, `.svg`, `.webp`, `.ico`, `.bmp`, `.tiff`                                                                                    |

### Mimir, your virtual pet

Mimir lives in the secondary sidebar. To open him, click **⚡ Summon Mimir** in the status bar or run **Mimir: Summon**.

**Reactions**

- 🪂 **Saves:** he says something when you save a file.
- ‼️ **Errors:** when a new error appears in the file you're editing, he points out the line and the message. The error stays pinned until a save leaves the file error-free.
- ❓ **Mess:** with 5 or more errors in a file, he reacts to the mess as a whole.

**Vitality**

Mimir's vitality drains over time and grows when you look after yourself:

| Habit        | How it's detected                                                               | Vitality |
| ------------ | ------------------------------------------------------------------------------- | -------- |
| Take a break | A Mimir break, or 5+ minutes away from VS Code                                  | +20      |
| Drink water  | **Mimir: I drank water**, or **Drank it** on the reminder (once per 15 minutes) | +12      |
| Run tests    | Saving a test file, or a test task that passes (once per 2 minutes)             | +8       |

Vitality drains by 12 points an hour. Closing VS Code counts as a break, so he won't drain while you're away.

**The break clock**

The status bar shows the time since your last break (`⏱ 1h12m`). Click it to take a break.

| Time without a break | What happens                                                 |
| -------------------- | ------------------------------------------------------------ |
| Under 60 minutes     | Fresh                                                        |
| 60 minutes           | A break is due: the clock turns orange and Mimir reminds you |
| 90 minutes           | Tired: the clock turns red and vitality drains twice as fast |
| 2 hours              | Mimir dozes off until you take a break                       |

**Break mode**

**Mimir: Take a break** starts a soft lock for the length set in `mimir.breakMinutes`:

- VS Code enters Zen mode and shows a full-screen break screen with a countdown.
- Every file is read-only until the timer runs out.
- Closing the break screen doesn't end the break. To stop early, run **Mimir: End break early** (Mimir won't be pleased).
- If VS Code closes mid-break, the break resumes on the next start, or is cleaned up if the time has already run out.

> Break mode makes files read-only by adding `"**": true` to your global `files.readonlyInclude` setting. Your previous value is saved and restored when the break ends.

### The Nine Realms

Mimir's view shows nine tiles. Each realm stands for one part of your project, marked with an Elder Futhark rune. Click a tile to jump to the related view.

| Realm          | Shows                            | Click to            |
| -------------- | -------------------------------- | ------------------- |
| ᛗ Midgard      | Project name and version         | Open `package.json` |
| ᚨ Asgard       | Git branch, commits ahead/behind | Open Source Control |
| ᛜ Vanaheim     | Uncommitted changes              | Open Source Control |
| ᚺ Helheim      | Errors in the workspace          | Open Problems       |
| ᚲ Muspelheim   | Warnings in the workspace        | Open Problems       |
| ᛁ Niflheim     | `TODO` and `FIXME` comments      | Search for them     |
| ᛋ Alfheim      | Test files and the last test run | Run the test task   |
| ᚷ Svartalfheim | Number of dependencies           | Open `package.json` |
| ᚦ Jötunheim    | Your largest file                | Open it             |

## Commands

| Command                            | What it does                              |
| ---------------------------------- | ----------------------------------------- |
| `Mimir: Summon`                    | Opens Mimir's view                        |
| `Mimir: I drank water`             | Records a glass of water                  |
| `Mimir: Take a break`              | Starts break mode                         |
| `Mimir: End break early`           | Ends break mode before the timer runs out |
| `Mimir: Remind me to take a break` | Sends a break reminder now                |

## Settings

| Setting                      | Default | Description                                                                        |
| ---------------------------- | ------- | ---------------------------------------------------------------------------------- |
| `mimir.breakReminderMinutes` | `60`    | Minutes of work before Mimir asks you to take a break. `0` turns the reminder off. |
| `mimir.breakMinutes`         | `15`    | Length of a break started with **Take a break**.                                   |
| `mimir.waterReminderMinutes` | `45`    | Minutes between water reminders. `0` turns the reminder off.                       |

## Requirements

VS Code 1.140.0 or newer.

## Development

```sh
npm install
npm run watch     # rebuild on change
npm test          # type-check, lint and run the tests
npm run package   # production build
```

Press **F5** to open an Extension Development Host with the extension loaded.

| Path                         | Contents                                                              |
| ---------------------------- | --------------------------------------------------------------------- |
| [src/](src/)                 | Extension code                                                        |
| [src/webview/](src/webview/) | Code for the Mimir view and the break screen                          |
| [src/lines.ts](src/lines.ts) | Everything Mimir says; add a line to a group and he'll start using it |
| [themes/](themes/)           | Color theme and icon theme definitions                                |
| [icons/](icons/)             | SVGs for the icon theme                                               |
| [assets/](assets/)           | Mimir's portraits                                                     |

To add a file icon, put the SVG in [icons/](icons/), then in [themes/ragnarok-icon-theme.json](themes/ragnarok-icon-theme.json):

1. Declare it in `iconDefinitions`.
2. Map it under `fileExtensions` (extensions, without the leading dot) or `fileNames` (exact names such as `Dockerfile` or `.gitignore`).

## Release notes

| Version | Changes                                                         |
| ------- | --------------------------------------------------------------- |
| 0.1.7   | File icon theme                                                 |
| 0.1.6   | Fixed the project name in Midgard                               |
| 0.1.5   | Nine Realms project stats                                       |
| 0.1.4   | Break mode: Zen mode, read-only files, resuming after a restart |
| 0.1.3   | Break notification in the status bar                            |
| 0.1.2   | Mimir quotes                                                    |
| 0.1.1   | Drink water                                                     |
| 0.1.0   | Vitality bar                                                    |

---

This is a fan project. It isn't affiliated with or endorsed by Santa Monica Studio or Sony Interactive Entertainment. _God of War_ is a trademark of Sony Interactive Entertainment LLC.
