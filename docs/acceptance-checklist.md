# Acceptance Checklist

This checklist helps reviewers verify the current FalconArena product flow before a demo or final review.

## 1. User Roles

- `ADMIN`: creates tournaments, rounds, users, updates statuses, distributes assignments, finishes evaluation.
- `ORGANIZER`: separate admin-like role without permission to create `ADMIN` users.
- `TEAM`: registers through the site, registers a team in a tournament, submits work, and views profile/results.
- `JURY`: views assigned work and submits category-based scores with a comment.

Status: implemented.

## 2. Tournaments

- Public tournament list: `/app`
- Statuses: `Draft`, `Registration`, `Running`, `Finished`
- Tournament creation through UI: `Admin panel`
- Registration window, description, and team limit are supported

Status: implemented.

## 3. Team Registration

- Public `TEAM` account registration: `/app/register`
- Automatic sign-in after registration
- Team registration inside a tournament: `/app/team`
- Email and duplicate validation: backend-enforced, with additional client-side validation
- Team editing after registration deadline: not supported in UI

Status: implemented.

## 4. Rounds / Tasks

- Round creation through UI: `Admin panel`
- Statuses: `Draft`, `Active`, `SubmissionClosed`, `Evaluated`
- `TEAM` sees active task, description, deadline, and must-have checklist in `My team`

Status: implemented.

## 5. Submissions

- Submission fields: GitHub repository, video demo, live demo, short summary
- Editing before deadline: allowed
- Editing after deadline or round closure: blocked

Status: implemented.

## 6. Jury Evaluation

- Random assignment distribution: available through admin action
- Evaluation criteria: 6 categories, `0-100` scale
- `JURY` sees assignments, repository/demo links, and evaluation form
- `ADMIN` can finish evaluation normally or with `force`

Status: implemented.

## 7. Leaderboard

- Page available at: `/app/leaderboard`
- Shows ranked teams, total and average scores, category averages, and round results
- Publicly accessible

Status: implemented.

## 8. Home Page

- Public list of active, upcoming, and finished tournaments
- Filters: `Registration open`, `Running`, `Finished`
- `TEAM` quick block for current tournament, active round, and submission state

Status: implemented.

## 9. About Page

- Available at `/app/about`
- Shows platform copy, a banner, workflow block, role cards, CTA, contacts, and user reviews
- CTA sends guests to registration and signed-in users to tournaments
- Contact channels support email, messengers, and social links
- Reviews show approved user feedback or demo examples when no public reviews exist yet
- Signed-in users can open the review modal and submit feedback for moderation
- `ADMIN` manages About page content and review moderation from `/app/integrations`

Status: implemented.

## 10. User Profile

- Basic info: full name, email, role
- `TEAM`: participation, submissions, round-by-round history
- `JURY`: assignments, statuses, evaluated work history
- `ADMIN` / `ORGANIZER`: created tournaments and round counts

Status: implemented.

## 11. Documentation, Tests, CI

- Ukrainian main `README.md` and English `README.en.md`
- Deployment docs, smoke scenarios, architectural decision docs, and this review checklist
- Frontend unit tests: available
- Backend unit tests: available
- CI: `lint + test + build`
- Manual smoke workflow: available

Status: implemented.

## 12. Additional Product Capabilities

Implemented as full strengths on top of the base specification:

- announcements, system notifications, and direct dialogs
- email delivery for system events
- auto-refresh for leaderboard, messages, and notifications
- CSV export
- Google Sheets export
- certificates through printable preview and browser print flow
- tournament schedule
- managed `About` page with contacts and moderated user reviews
- archive of previous tournaments
- monitoring, activity history, integration settings, audit trail, and background jobs

Status: implemented.

## Recommended Demo Scenario

1. `TEAM`: register through the site and sign in.
2. `ADMIN`: sign in, create a tournament and a round.
3. `ADMIN`: create a `JURY` user through the UI.
4. `TEAM`: register a team and submit work.
5. `ADMIN`: distribute assignments.
6. `JURY`: submit an evaluation.
7. `ADMIN`: finish evaluation.
8. Review `Leaderboard`, `Archive`, `Messages`, `Integrations`, `About`, `Monitoring`, and `Profile`.
