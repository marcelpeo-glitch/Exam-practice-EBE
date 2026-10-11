# Mock TestVision

A local practice version of TestVision for SBE exams. It ships with six past **QM1** exams (EBC1005/1006/1007). You take an exam under exam conditions (one question at a time, a countdown, flags, a calculator and formula sheets, autosave) and get marked when you hand in.

## Start the app

You need [Node.js](https://nodejs.org) 18 or newer. In this folder, run:

```bash
npm start
```

This installs the dependencies (the first run takes a few seconds) and opens the app at <http://localhost:5173>. Stop it with `Ctrl+C`.

## What it does

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
npm test           # unit tests + data validation (KaTeX renders every formula)
npm run typecheck
npm run build      # static build in dist/
```

End-to-end checks (optional, need Playwright with Chromium): start the dev server, then run `node tests/e2e/main.mjs` (a full exam with a known mix of right, wrong, partial and blank answers; it checks the score, timer, refresh, flags, calculator, hand-in, auto hand-in, retry and self-marking) `node tests/e2e/sweep.mjs` (every question of every exam renders, with no answers visible during the exam) and `node tests/e2e/regressions.mjs` (Back/Forward and Resume keep progress, the calculator continues from Ans, and Back after hand-in is not stuck). If Playwright is installed globally, point `PLAYWRIGHT_MODULE` at it.

Everything is stored in your browser's `localStorage` (keys starting with `mtv:`). **Clear saved data** on the start screen removes it.
