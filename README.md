# PreGame

PreGame is a local practice version of TestVision for SBE exams. It ships with six past **QM1** exams (EBC1005/1006/1007) and can **generate a predicted QM1 exam** with new questions. You take an exam under exam conditions (one question at a time, a countdown, flags, a calculator and formula sheets, autosave) and get marked when you hand in. The interface is available in all 24 official EU languages.

## Open it in Chrome (no installation)

Download **[`standalone/pregame.html`](standalone/pregame.html)** (on GitHub: open the file, then use the download button at the top right of the file view) and double-click it. It opens in your default browser. If that is not Chrome (for example Edge or Safari), right-click the file, choose **Open with**, then **Google Chrome**, or drag the file into a Chrome window. It is one self-contained file with all six exams, the maths fonts, the figures and the formula sheets inside, so it needs no internet, no login and no installation. It works on Windows, Mac and Chromebook.

- On a **Chromebook**, open the Files app, find the download and double-click it.
- Your answers, attempt history and best scores are saved in your browser (not in the file). Open the file in the same browser each time, and not in an incognito or guest window, or the history is not kept. Clearing the browser's site data deletes it. If a browser setting or a school policy blocks saving, the app shows a red warning: the exam still works in that tab, but nothing is kept after a reload.
- Keep an exam open in **one tab only**. If you open it in a second tab, the first tab stops saving and asks you to continue in the other one, so the two never overwrite each other.
- The file only changes when someone rebuilds it. After adding or changing an exam in `data/exams/`, run `npm run build:standalone` to rebuild it.

## Run it from the source code

You need [Node.js](https://nodejs.org) 18 or newer. In this folder, run:

```bash
npm start
```

This installs the dependencies (the first run takes a few seconds) and opens the app at <http://localhost:5173>. Stop it with `Ctrl+C`.

## What it does

- **Languages:** the language menu in the header lists the 24 official EU languages by their own names (Deutsch, Eesti, Ελληνικά, Français, ...). The first visit follows your browser's language (English if it is not one of the 24), and your choice is remembered. Dates and numbers are written the way your language writes them. Only the interface is translated: exam questions, topics and explanations stay in English, as in the real exam.
- **Generate predicted exam** (QM1): a new 28-question, 2-hour exam in the format of the past ones, with a note that it is a prediction, not the real exam. See [Predicted exam](#predicted-exam).
- **Start screen:** every exam with its year, regular/resit, number of questions, duration, answer-key source and your best score so far, plus your attempt history.
- **Start page:** like TestVision's: exam details and instructions, and you tick a box before you can start.
- **Exam screen:**
  - A countdown timer.
  - Question tiles that show answered, not answered and flagged.
  - Previous/Next buttons, Flag, a scientific Calculator, and Formula sheets (the QM1 formula sheet, Z and T tables).
  - Answers, flags, the current question and the remaining time are saved on every change, so a refresh loses nothing. The timer pauses while the page is closed.
- **Hand-in:** **Ready** shows the unanswered and flagged questions, then asks for confirmation. When the timer reaches zero, the exam is handed in automatically.
- **Results:**
  - Points, percentage, grade (10 × points ÷ max, one decimal, pass ≥ 5.5, unless the exam has its own pass rule) and time used.
  - Score per part and per topic.
  - A question-by-question review: your answer, the correct answer, the explanation, and an **AI-solved, verify** badge where no official key existed.
  - Open questions show the model answer and let you award yourself points; the total updates live.
- **Retake** the exam, or **retry only the questions you didn't get fully right** (with proportionally less time).

How each answer key was obtained (official or AI-solved) and every known issue in the source files is listed in [EXTRACTION_REPORT.md](EXTRACTION_REPORT.md).

## Predicted exam

**Generate predicted exam** (in the QM1 card on the start screen) builds a new exam:

- **Format:** 28 questions in 2 hours (120:00). Section 1 is Mathematics, then Section 2 is Statistics. The split follows the past exams: all six give the two sections the same number of questions (20 + 20 or 14 + 14), a 50 : 50 ratio, so the prediction has **14 Mathematics + 14 Statistics** questions. Every question is worth 1 point, as in the past exams. The grade is 10 × points ÷ 28 and you pass with 5.5.
- **Blueprint:** `npm run blueprint` turns the past exams into `data/blueprints/<course>.json`. For every question it records the topic, position, type, points and an estimated difficulty (from the stem length, the answer format and whether there is a figure or table). The app reads this stored file and never recomputes it. A test fails if the file no longer matches `data/exams`.
- **Topics:** a topic's weight is its share of its section, averaged over the past exams, with recent exams counting more: the newest counts 1, the one before ½, then ¼, and so on. Every topic that was in **every** past exam always gets at least one question. These are all 9 maths topics and 8 of the 10 statistics topics. The remaining questions are drawn according to the weights. The **How the prediction works** table on the start screen shows each topic's weight and expected number of questions.
- **Question types** follow the same recency weighting, so the 2025 exam's numeric, matching and multi-select questions appear next to multiple choice. Multiple-choice questions have 5 options, the most common number in the recent exams. Questions are ordered as the topics usually appear.
- **New questions, answers checked in code:**
  - Each question comes from a parametric template in `src/predict/templates/`. The template draws new numbers, contexts and wording, and it never copies a past question: a check rejects any stem that shares half of its 5-word runs with a past stem.
  - The answer is **computed in code**, not written by hand or by an AI. Maths uses mathjs for symbolic derivatives and evaluation plus numerical root finding. Statistics uses the normal and t distributions, the binomial, and descriptive statistics in `src/predict/stats.ts`. Critical values come from the formula sheet's printed Table T (df rounded down, as the exam instructs). A test compares that table with the exact quantiles.
  - Wrong options come from realistic student mistakes (forgetting the chain rule, *n* instead of *n* − 1, a one-sided instead of a two-sided value, ...). An option that happens to equal the correct answer is dropped.
  - Every template has its own test that recomputes the key a different way (numerical differentiation, brute force, simulation, ...) for hundreds of seeds. A generic test also checks every template's structure and LaTeX.
- **During the exam:** a 2:00:00 countdown with warnings at 10 minutes and 1 minute, and an automatic hand-in at 0:00. The timer and your answers survive a refresh. The navigator shows tiles 1–28 grouped by section, as answered, not answered or flagged.
- **Results:** your total, separate Mathematics and Statistics scores, the per-topic breakdown, and a full worked solution for every question (KaTeX). Each generated question is marked **Computed in code**.
- Generated exams are stored in your browser, like your attempts. Retaking one gives the same questions; generate again for a new exam.

There is no server and no AI call at run time: everything is generated in the browser by deterministic code from a random seed, so no API key exists to leak.

## Adding exams (any SBE course)

Put a JSON file in `data/exams/` and its images in `data/exams/img/<exam-id>/`, then reload the page. `data/examples/schema-demo.json` is a complete example with every question type; open the app with `?demo=1` to see it. Problems in a file (missing fields, wrong answer ids, missing images) are listed on the start screen. `npm run validate` checks every file, including that all LaTeX renders.

```jsonc
{
  "schemaVersion": 1,
  "id": "ebc1010-2025-2026-resit",          // unique
  "courseCode": "EBC1010",
  "courseName": "Microeconomics",
  "academicYear": "2025-2026",
  "examType": "resit",                       // "regular" | "resit"
  "title": "Resit",
  "durationMinutes": 120,
  "durationSource": "stated",               // or "assumed"
  "grading": {                               // optional
    "passGrade": 5.5,
    "passRule": { "minPoints": 27, "minSectionPoints": { "Mathematics": 9 } },  // optional
    "multiSelectScoring": "partial",         // or "all-or-nothing"
    "guessingCorrection": false              // true: −points/(k−1) per wrong single-choice answer
  },
  "resources": [{ "title": "Formula sheet", "src": "img/shared/formulas.png" }],  // optional
  "questions": [ /* see below */ ]
}
```

Every question has `id`, `number`, `type`, `topic`, `points`, `stem`, `explanation` and `answerSource` (`"official"` or `"ai"`). Optional fields: `section`, `instruction`, `images` (`[{ "src", "alt" }]`), `table` (`{ "header": [...], "rows": [[...]] }`), `explanationSource` and `sourceNote`.

| `type` | Answer fields |
|---|---|
| `single-choice` | `options: [{id, text?, image?}]`, `correctAnswer: "B"`, optional `alsoAccepted: ["C"]` |
| `multi-select` | `options`, `correctAnswer: ["A", "C"]` (partial credit: (right − wrong) ÷ number correct) |
| `numeric` | `correctAnswer: 0.253`, `tolerance: 0.002`, optional `acceptRange: [622, 623]`, `prefix`, `suffix`; or several boxes with `fields: [{id, label, answer, tolerance}]`. Default tolerance is 0.5 % of the answer; a comma decimal is accepted. |
| `open` | `modelAnswer` (you mark yourself on the results page), `correctAnswer: null` |
| `matching` | `prompts: [{id, text, choiceIds?}]`, `choices: [{id, text}]`, `correctAnswer: {promptId: choiceId}` (drop-downs; partial credit) |

Text fields support `$inline$` and `$$display$$` LaTeX (rendered with KaTeX), `**bold**`, `*italic*` and line breaks (`\n`). Write a literal dollar sign as `\$`. In JSON, backslashes are doubled: `"$\\frac{1}{2}$"`.

## Development

```bash
npm run dev        # dev server without reinstalling
npm test           # unit tests, data validation (KaTeX renders every formula), dictionaries, question templates
npm run blueprint  # rebuild data/blueprints/ after adding or changing an exam
npm run typecheck
npm run build      # static build in dist/
npm run build:standalone   # the single-file version in standalone/pregame.html
```

End-to-end checks (optional, need Playwright with Chromium): start the dev server, then run `node tests/e2e/main.mjs` (a full exam with a known mix of right, wrong, partial and blank answers; it checks the score, timer, refresh, flags, calculator, hand-in, auto hand-in, retry and self-marking) `node tests/e2e/sweep.mjs` (every question of every exam renders, with no answers visible during the exam) and `node tests/e2e/regressions.mjs` (Back/Forward and Resume keep progress, the calculator continues from Ans, and Back after hand-in is not stuck). `node tests/e2e/i18n.mjs` checks all 24 languages in the browser: language detection, the switcher, `<html lang>`, no untranslated keys, no overflow on a 375 px phone (with screenshots for de, fi and hu), and that Greek and Cyrillic letters render. `node tests/e2e/predicted.mjs` generates a predicted exam and checks the start page, the 2-hour timer, refresh persistence, both time warnings, the automatic hand-in and the results. For the single-file version, run `npm run build:standalone` and then `node tests/e2e/standalone.mjs`: it opens the file from disk with the network switched off and checks that maths, figures, saving, marking and the calculator all work. Any of the other scripts can also be pointed at the file with `BASE_URL=file:///full/path/to/standalone/pregame.html`. If Playwright is installed globally, point `PLAYWRIGHT_MODULE` at it.

Everything is stored in your browser's `localStorage` (keys starting with `mtv:`). **Clear saved data** on the start screen removes it.

## Translations

The interface text lives in `src/i18n/`: `ui-en.ts` is the source of truth, and each other language has its own file (`ui-de.ts`, `ui-et.ts`, ...) typed against it. A missing, extra or wrongly shaped key in any language fails `npm run typecheck`. `npm test` also checks that every translation keeps the `{placeholders}` and `**bold**` markers and has the plural forms its language needs. To change a text, edit `ui-en.ts` and the same key in the other 23 files.
