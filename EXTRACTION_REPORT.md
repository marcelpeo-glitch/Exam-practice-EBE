# Extraction report

Six QM1 (EBC1005/1006/1007) exam files were converted to JSON in `data/exams/`. Figures are cropped into `data/exams/img/<exam>/`. All maths is written in LaTeX.

**How the files were read.** The four text-based PDFs were rendered to 200-dpi images and read page by page. Their formulas are embedded images, so text extraction alone was not enough. The two scanned files (Studydrive screenshots) were read the same way, by visual inspection of the page images. No OCR engine was installed in the build environment, so "OCR" here means reading the scans visually; every formula was retyped in LaTeX.

**How answers were checked.** Every AI-solved answer was solved by hand and then checked with a SymPy/SciPy script (derivatives, inverses, stationary points, Hessians, normal/binomial/t probabilities, confidence intervals). The automated test `npm test` also renders every LaTeX snippet in every file with KaTeX in strict mode, and checks that every image referenced by the JSON exists.

## Summary

| Exam file (JSON) | Source file | Questions | Answer key | Explanations | Figures cropped |
|---|---|---|---|---|---|
| `qm1-2018-2019-first-sit.json` | `2018-2019_FIRST_SIT.pdf` (paper exam, Version H) | 40 (20 maths, 20 stats) | **AI-solved: 40** (no key in the folder) | AI | 2 (+ formula sheets and tables) |
| `qm1-2019-2020-first-sit.json` | `2019-2020_FIRST_SIT.pdf` (paper exam, Version A) | 40 (20 + 20) | **AI-solved: 40** (no key in the folder) | AI | 1 |
| `qm1-2021-2022-first-sit.json` | `ExamQM1_2122_FirstSit.pdf` (TestVision export) | 28 (14 + 14) | **Official: 28** (correct option marked in the export) | AI (the export has no feedback) | 2 |
| `qm1-2023-first-sit.json` | `Exam_2023_first_sit.pdf` (TestVision export) | 40 (20 + 20) | **Official: 40** | Official TestVision feedback | 11 (incl. 5 image options and 1 feedback diagram) |
| `qm1-2024-2025-first-sit.json` | `First_Sit_2024-2025_QM1_Exam_with_answers.docx.pdf` (scanned student results view) | 28 (14 + 14) | **Official: 21**, **AI-solved: 7** | AI | 2 |
| `qm1-2025-exam.json` | `preview_2196210_QM1_exam__solutions_2025.pdf.pdf` (scanned review with feedback pop-ups) | 28 (14 + 14) | **Official: 27**, **AI-solved: 1** | Official feedback (2 written by AI) | 3 |
| **Total** | | **204** | **116 official, 88 AI-solved** | | 21 |

AI-solved answers carry `"answerSource": "ai"`, and the results screen shows an **"AI-solved, verify"** badge on them. Where only the explanation was written by AI, the question has `"explanationSource": "ai"` and an "Explanation by AI" label.

The formula sheet, Z tables and T table from the 2018-19 paper exam (pages 11-15) are attached to every QM1 exam as **Formula sheets**. The 2019-20 exam contains the same pages. The newer TestVision exams may have used a different sheet.

## Per exam

### 2018-2019 first sit (Version H)
- The duration (13.00-16.00, so 180 min) and the norm come from the cover page: ≥ 27 of 40 correct and ≥ 9 correct in both maths and statistics. Both are encoded as the exam's pass rule. Course bonus points are not simulated.
- **AI-solved: all 40 questions.** Each one was double-checked numerically.
- Q40 is ambiguous: options C ("power decreases as the effect size decreases") and D ("power decreases as β increases") are both true statements. **Both are accepted.**
- Q13's table and Q24's StatCrunch summary table were retyped as HTML tables. Q23's histograms and Q26's histograms with box plots were cropped.

### 2019-2020 first sit (Version A)
- The duration (9.00-12.00, so 180 min) and the same norm (27/40, ≥ 9 per part) come from the cover page.
- **AI-solved: all 40 questions.**
- Q7: the exact demand drop is 2.05, in (2, 10], which is the answer used here. A marginal (linear) approximation would give exactly 2.0, in (1, 2]. Flagged in the question note.
- Q9: "extremes" is read as interior stationary extremes (one maximum at q = 120). The boundary values TR(0) = TR(180) = 0 are not counted.
- Q7-8 (source quirk, kept as is): the stem calls demand *d* but the formula uses *q*.
- Q24 (source quirk): the summary table lists a mean of 4.67 next to a median of 15.5, probably a typo in the original. The question only needs Q1 and Q3.

### 2021-2022 first sit
- Answers are **official** (the correct option is boxed in the TestVision export). The export has no feedback, so **all 28 explanations were written by AI**.
- Q26's answer options (z-statistic formulas) were images and were retyped in LaTeX.
- The duration is not stated, so 180 min is assumed.

### 2023 first sit
- Answers and explanations are **official** (TestVision export with "Feedback at question level").
- The source only says "Exam 2023 first sit"; the academic year (2022-23 or 2023-24) is not stated.
- Q2's official feedback began with a sentence copied from Q1 ("Since the denominator is positive…"). It was removed.
- Q34's five answer options are images (histograms); each was cropped separately.
- The duration is not stated, so 180 min is assumed.

### 2024-2025 first sit (scanned student results view)
- The file shows one student's answers with TestVision's verdict. When the verdict is **"Your answer is correct"**, the selected option is taken as **official** (21 questions).
- **AI-solved: Q4, Q6, Q9, Q11, Q17, Q25, Q28.** For these the screenshot says "Your answer is incorrect (See correct answer below)", but the correct answer below is not in the file. Each was solved independently, and in every case the marked option is the correct one. This suggests the uploader re-marked the correct options ("with answers"). Notes:
  - Q4 (other stationary points of 4(y−1)² + 4x² − (y−1)²x²) gives 4 other points, so "4 or more". The same question in 2021-22 and 2023 has the official answer "4 or more".
  - **Q28 (explanatory variables) is worth verifying.** The marked option (screen time, sex, age, mother's education, …) is the only one that fits, yet the source labels it incorrect.
- TestVision shuffles options per student, so option order follows this student's screen.
- The Wonkyworld survey (Q19) was retyped as a table. Q21's histogram/box-plot figure and Q26's infant-mortality histogram were cropped.
- The duration is not stated, so 180 min is assumed.

### 2025 (scanned review with official feedback pop-ups)
- The file is titled "QM1 exam solutions 2025" and does not say which sitting (first sit or resit) or academic year. It is labelled **2025, regular (assumed)**.
- Answers come from the **official feedback** pop-ups, or from TestVision's "correct" label for Q1 and Q17, whose explanations were written by AI.
- **AI-solved: Q15** (teddy bears, drag-and-drop): no verdict or feedback is visible. The answer used is Observational unit = a teddy bear, Variable = prescription, Variable type = **ordinal** (herbal tea < regular pills < extra-strong pills). "Nominal" is defensible too; see the question note.
- Q2: the question claims (3, 2) is a stationary point of 4(y−1)² + 4x² − (y−1)²x², but it is not (the gradient there is (18, −10)). The intended point was probably (2, 3), which is also a saddle point. The official answer "saddle point" is kept.
- Q6 (sigmoid inverse): options A (−ln((1−y)/y)) and C (ln(y/(1−y))) are mathematically identical. **Both are accepted.**
- Q26 (best 10 % of sandals): the feedback computes 622.56, but in the source the answer 623 was labelled incorrect, so the key may have been 622. **622 and 623 are both accepted.**
- Q27 (sample size): the feedback says 97, with 96 also counted correct. Both are accepted.
- Partly hidden behind feedback pop-ups and **reconstructed**:
  - Q16: part of the instruction text.
  - Q18: the top-right of the satisfaction histogram (masked in the image so no hint shows).
  - Q20 and Q28: the multi-select lists may have had more options (the student got "partially correct" despite ticking both visible correct options).
  - Q22: the drop-down choices.
  - Q23, Q24, Q27: parts of the instructions.
  - Q25: the pool of draggable sampling methods.
- New question types in this exam, all supported by the schema and the app:
  - **numeric** (Q7, Q8, Q12, Q23, Q24, Q26, Q27, with tolerances or accepted ranges);
  - **multi-field numeric** (Q16: t*, lower and upper bound, 1/3 point each);
  - **multi-select** (Q20, Q28, partial credit);
  - **matching** (Q15, Q22, Q25, shown as drop-downs instead of drag-and-drop).
- The duration is not stated, so 180 min is assumed.

## Things that could not be determined from the files
- **Durations** of the TestVision exams (2021-22, 2023, 2024-25, 2025). They are set to 180 min with `"durationSource": "assumed"` (marked with * on the start screen). Change `durationMinutes` in the JSON if you know the real value.
- **Grading rules** of the TestVision exams. None is stated, so the default applies: grade = 10 × points / max, one decimal, pass ≥ 5.5. None of the files mentions a guessing correction.
- **Open questions:** none of the six exams contains one. The open-question flow (model answer plus self-marking) is demonstrated by `data/examples/schema-demo.json`, which appears when the app is opened with `?demo=1`.
- Nothing was completely unreadable. The partly hidden items above are the only gaps.

## Topic tags used
Mathematics: Functions & domains · Derivatives · Inverse functions · Elasticity · Economic applications · Monotonicity, convexity & extremes · Exponential & logistic growth · Two variables: partial derivatives & level curves · Two variables: stationary points.
Statistics: Data & displays · Describing distributions · Probability · Random variables & binomial · Normal model · Sampling & study design · Sampling distributions · Confidence intervals · Hypothesis tests · Errors & power.
