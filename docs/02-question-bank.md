# 2. Question Bank & Tests

**Phase:** 2 · **Depends on:** [01-student-management](01-student-management.md), [10-android-protection](10-android-protection.md)

## Requirement
MCQs, multiple options, answer keys, subject/topic/course categorization, timed tests, automatic evaluation, marks, negative marking, percentage, correct/incorrect/unanswered analysis.

## Scope V1
- Question bank: MCQ (single correct), multiple correct, optional image in question/options.
- Categorization: course → subject → topic, plus difficulty.
- Answer key + explanation (optional).
- Test creation: questions manually chunna ya topic se random.
- Settings: duration, marks per question, **negative marking**, start/end window, batch assignment, shuffle questions/options.
- Student test attempt: timer, question palette (answered / unanswered / marked), auto-submit on time up.
- Auto evaluation: marks, percentage, correct/incorrect/unanswered count.
- Result analysis: topic-wise performance, rank in batch.
- Bulk question import (CSV/Excel) — Phase 2 end.
- **Written-answer (subjective) questions:** student types the answer and/or takes camera photos of the answer sheet (max 5 per question). Teacher gives marks + feedback on the check page; the result (score, rank, review) shows only after checking.

## Database tables
- `subjects` (id, course_id, name), `topics` (id, subject_id, name)
- `questions` (id, topic_id, text, image_url, type, difficulty, explanation, created_by)
- `question_options` (id, question_id, text, image_url, is_correct)
- `tests` (id, title, course_id, duration_min, total_marks, negative_mark, start_at, end_at, shuffle, status)
- `test_questions` (test_id, question_id, marks, order)
- `test_batches` (test_id, batch_id)
- `attempts` (id, test_id, student_id, started_at, submitted_at, score, percentage, correct, incorrect, unanswered)
- `attempt_answers` (attempt_id, question_id, selected_option_ids, marked_for_review)

## API endpoints
- `CRUD /subjects`, `/topics`, `/questions` (+ filters), `POST /questions/import`
- `CRUD /tests`, `POST /tests/:id/publish`
- Student: `GET /tests/available`, `POST /tests/:id/start`, `PUT /attempts/:id/answers`, `POST /attempts/:id/submit`
- `GET /attempts/:id/result`, `GET /tests/:id/leaderboard`, `GET /students/:id/test-history`

## Screens
- **Admin web:** question list/filter, add question (rich text + image), test builder, results per test, leaderboard.
- **Android app:** available tests, instructions, test screen (timer + palette), result + analysis. **FLAG_SECURE + watermark on.**
- **Student web:** tests basic ya skip (protected content). Decide later.

## Kaise banana hai (steps)
1. Tables + migrations.
2. Question CRUD with option handling in a transaction.
3. Test builder API, validation (duration, marks).
4. **Server-side timer**: `started_at + duration` se tay ho; client timer sirf display. Time khatam hone par submit reject / auto-submit.
5. Answers har change par autosave (network drop se bachne ke liye).
6. Evaluation function: `score = correct*marks - incorrect*negative`, percentage, counts. Server par hi calculate.
7. Result analysis queries (topic-wise).
8. Flutter test UI: palette, timer, autosave, resume attempt.
9. Import via CSV template.
10. Tests: negative marking edge cases, resume, double submit, time-up.

## Progress
- [x] Subjects / topics / questions API
- [x] Options + answer key
- [x] Image upload for questions
- [x] Test builder API
- [x] Attempt start/autosave/submit
- [x] Server-side timer + auto-submit
- [x] Evaluation + negative marking
- [x] Result + topic analysis
- [x] Leaderboard
- [x] Admin web: question bank UI
- [x] Admin web: test builder + results
- [x] Android: test screen
- [x] Android: result screen
- [x] CSV import
- [x] Tests

- [x] Written-answer questions: typed + photos, teacher checking (`PUT /tests/:id/attempts/:attemptId/marks`)
- [x] Exam security: leave limit + auto-submit, no paste, no split screen (`npm run smoke:subjective`)

## Exam security (app)
- **Leaving the app** (home button, other app, call) is reported when the student comes back (`POST /attempts/:id/background`). Each test has `maxLeaves` (default 3): that many warnings, one more auto-submits the test (`endReason = LEFT_APP`). 0 = only counted. Reopening a test after the app was killed also counts as a leave.
- Camera trips for answer photos are not counted (up to 3 minutes).
- **No copy/paste:** the answer box has no selection/context menu, no suggestions, and rejects text that arrives in one go (keyboard clipboard paste). The clipboard is cleared at start and on every return.
- **No split screen / pop-up window:** `resizeableActivity="false"`. Screenshots and recording: FLAG_SECURE (whole app). Overlays hidden on Android 12+.
- **Time:** the server owns the clock; deadline = min(start + duration, window end). Autosave until deadline + 10 s, auto-submit by the cron and on every read.
- Limits: nothing in the app can stop a second phone or a book. Calls count as leaving; the rules screen tells students to turn on Do Not Disturb.

## Notes
- Answer key student API se kabhi mat bhejo jab tak test khatam na ho.
- Test ke dauran app background mein jaye to log karo (cheating signal).
