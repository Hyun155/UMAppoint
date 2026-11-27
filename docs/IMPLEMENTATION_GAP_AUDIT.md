# UMAppoint Implementation Gap Audit

**Audit date:** 26 November 2026  
**Repository:** https://github.com/GeokLiu/UMAppoint  
**Reviewed branch:** `main` (head at `9943d4852d552385d3cfaa30b17b4938c9ccc5f1`)  
**Audit branch:** `audit/implementation-gap-review`

## 1. Scope and evidence

This review inspected the committed frontend, FastAPI backend, tests, SQL migrations, environment examples, README, and the user's reported local verification.

The user confirmed:
- The website currently runs locally (not deployed).
- Student survey collection is completed.
- Existing System FDD and Proposed UMAppoint FDD are completed.
- FastAPI connected successfully to Supabase PostgreSQL.
- The user successfully registered/logged in a student account, retrieved lecturer records, created an appointment (HTTP 201), and retrieved the appointment.
- Lecturer approval testing was blocked when a student JWT was used against a lecturer-only endpoint (HTTP 403). This is expected role enforcement, not proof that lecturer approval is broken.

A successful endpoint response is not equivalent to a verified end-to-end browser workflow. Items below distinguish code presence from runtime proof.

## 2. Confirmed repository capabilities

| Area | Evidence in repository | Audit status |
|---|---|---|
| React/TypeScript website | `src/routes`, `src/components`, `package.json` | Implemented |
| FastAPI application | `backend/main.py`, `backend/app` | Implemented |
| PostgreSQL/Supabase connection | `backend/app/config.py`, `backend/app/database.py` | User confirmed DB connection |
| Registration/login/JWT | `backend/app/routers/auth.py`, `backend/app/security.py` | Implemented; role and seed-account issues need attention |
| Lecturer search and slot listing | `backend/app/routers/lecturers.py` | Implemented; user reported GET lecturers succeeded |
| Student appointment creation/list | `backend/app/routers/appointments.py` | Implemented; user reported POST 201 and GET result |
| Lecturer request list and approve/reject | `backend/app/routers/appointments.py` | Implemented; needs test with a real lecturer JWT |
| Mark consultation completed | `backend/app/routers/appointments.py` | Implemented |
| History | `backend/app/routers/appointments.py` | Implemented |
| Notifications and mark-read | `backend/app/routers/notifications.py` | Implemented |
| Profile read/update | `backend/app/routers/auth.py` | Implemented |
| Frontend/backend API client | `src/lib/backend.ts` | Implemented |
| Automated tests | `src/test`, `backend/tests` | Test files exist; passing status not verified |
| Existing/Proposed FDD | User confirmation | Completed outside repository; check report/slide inclusion |
| Student survey collection | User confirmation | Completed outside repository; analysis/report inclusion not verified |

## 3. High-priority implementation gaps

### P0 — Availability management uses a different authentication path

`src/routes/_authenticated/availability.tsx` performs direct Supabase queries and mutations for `availability_slots` and `appointments`. However, the application login in `src/lib/auth.tsx` authenticates through FastAPI and stores a FastAPI JWT in local storage. It does not establish a Supabase Auth session.

The database RLS policies inspected by the user require the Supabase `authenticated` role and `auth.uid()`. A FastAPI JWT is not a Supabase Auth session, so the direct browser-side availability operations may be rejected by RLS even though FastAPI database access works.

**Required action:** Move availability list/create/update/delete operations behind authenticated FastAPI endpoints, enforce lecturer ownership in the backend, and update the availability page to call those endpoints. Do not disable RLS or expose the database password/service-role key to the browser.

### P0 — Demo fallbacks can hide live API failures

The frontend includes fallback demo data in:
- `src/routes/_authenticated/lecturers.tsx`
- `src/lib/api.ts`
- other preview-oriented route components

For example, the lecturer directory falls back to static demo lecturers when the backend returns no records or errors. `fetchMyAppointments()` in `src/lib/api.ts` can return demo appointments after a live API failure or an empty response.

**Required action:** Keep demo data only when the user explicitly selects preview/demo mode. For a real authenticated session, show the actual API error or a genuine empty state; never silently replace live data with demo records.

### P1 — Cancellation and rescheduling workflow is incomplete in FastAPI

The database enum contains `cancellation_requested` and `rescheduling_requested`, and the frontend has related UI concepts. However, the inspected appointment API exposes student booking/listing, lecturer listing, lecturer status updates, and history. It does not expose complete student endpoints to request cancellation or rescheduling, nor a complete lecturer response workflow for rescheduling.

The lecturer status transition map currently supports:
- pending -> approved/rejected
- approved -> completed
- cancellation_requested -> cancelled/approved

It does not implement a full rescheduling flow.

**Required action:** Define and implement student cancellation/rescheduling request endpoints, lecturer responses, validation of replacement slots, appointment history/status records, notifications, and frontend mutations. Preserve the original appointment and slot history as required by the database design.

### P1 — Demo credentials and backend test fixtures disagree

The root README advertises demo accounts with password `Demo@1234`. Backend test fixtures in `backend/tests/conftest.py` and `backend/tests/test_auth.py` attempt to log in using `Password123!`.

The inspected SQL seed migration creates Supabase Auth users with a bcrypt password hash, while the FastAPI login implementation verifies credentials in the separate `public.app_credentials` table. The migration content inspected does not establish that the FastAPI credential table is seeded with matching hashes.

**Required action:** Choose one documented source of demo credentials and ensure the FastAPI `app_credentials` records are seeded for the test accounts. Do not assume Supabase Auth password records are automatically usable by the custom FastAPI login.

### P1 — Public registration allows self-selection of lecturer role

`RegisterRequest` accepts both `student` and `lecturer`, and `POST /api/auth/register` creates a lecturer record and role when the request specifies lecturer. Anyone who can access public registration can therefore attempt to create a lecturer account.

**Required action:** Decide the intended lecturer onboarding policy. Prefer administrator/invitation-controlled lecturer provisioning; keep public student registration separate. Do not implement a policy change without team approval because it changes the account-creation workflow.

### P1 — Production CORS is unrestricted

`backend/main.py` currently uses `allow_origins=["*"]` with credentials enabled.

**Required action:** Configure an explicit environment-driven allowlist for local development and the eventual deployed frontend origin before deployment.

## 4. Other gaps to complete

| Item | Current evidence | Next action |
|---|---|---|
| Double-booking protection | Booking route uses `SELECT ... FOR UPDATE` and checks active appointments | Add a concurrency/integration test against PostgreSQL |
| Slot overlap prevention | Not evident in inspected availability implementation | Reject overlapping slots for the same lecturer/date |
| Appointment status history | Table exists in schema; writes are not evident in inspected status update route | Record every transition with actor, old/new status, and note |
| Notification reliability | Status route catches and suppresses notification insert errors | Make status + notification persistence atomic or log/retry failures |
| Lecturer account verification | Lecturer endpoint requires lecturer role | Test with a separately registered/provisioned lecturer JWT |
| Frontend build and lint | Scripts exist in `package.json` | Run `bun run test`, `bun run lint`, and `bun run build` locally/CI |
| Backend tests | Pytest suite exists | Run `pytest` against a dedicated test database; avoid mutating production/demo data |
| Deployment | User says website is local; no deployment configuration was found in the inspected root tree | Select hosting, configure secrets, HTTPS, CORS, health checks, and backup |
| AI chatbot/autoreply | No implementation found in inspected routes | Confirm whether this is mandatory or optional for the prototype; scope before building |
| Automated reminders | No scheduled worker/automation implementation found | Decide reminder channels, timing, and delivery mechanism |

## 5. Work outside GitHub

These items require the team, project owner, Supabase dashboard, or actual deployment account. They cannot be completed safely from repository code alone.

1. **Supabase owner access and database:** Confirm the owner can maintain credentials, rotate any shared database password, verify RLS policies, confirm schema/migrations are applied, and create/verify the FastAPI demo credentials in `app_credentials`. Keep `backend/.env` private and never commit it.
2. **Lecturer account:** Obtain an authorized lecturer test account or ask the project owner to provision one. Do not use a student token for lecturer-only actions.
3. **Survey evidence:** Analyse the completed survey responses, create charts and findings, and include the questionnaire and raw/summary evidence in the SRDS appendix.
4. **Requirements evidence:** Include completed lecturer interview findings, FDD diagrams, problem/limitation list, recommendations, and user stories in the report/slides.
5. **Remaining system models:** Confirm completion of Context Diagram, DFD Diagram 0, data dictionary, ERD, Use Case Diagram, and Activity Diagrams; only the two FDDs are confirmed complete in this audit.
6. **Hosting and domain:** The website is local. The team must choose and configure hosting, domain/demo URL, SSL, production API URL, environment secrets, and a contingency local demo.
7. **User evaluation:** Recruit pilot students/lecturers, execute test scenarios, collect usability feedback, and preserve test evidence for the report.

## 6. Recommended order of work

1. Resolve the FastAPI-vs-Supabase Auth mismatch for lecturer availability management.
2. Remove silent demo-data fallback for real authenticated users.
3. Provision and verify one student and one lecturer test account; demonstrate the complete booking -> lecturer approval/rejection -> student status workflow.
4. Implement cancellation and rescheduling request/response workflows.
5. Add appointment status history and reliable notifications.
6. Align demo seed credentials and test fixtures.
7. Run frontend and backend tests, lint, and production build.
8. Complete report evidence, user evaluation, deployment, and presentation preparation.

## 7. Safety notes

- Never commit `.env`, database passwords, JWT secrets, Supabase service-role keys, or real student/lecturer personal data.
- Keep RLS enabled. Do not work around authorization errors by granting broad public access.
- Do not force-push or rewrite the Lovable-synchronized `main` branch.
- All implementation fixes should be made on a feature branch and reviewed before merging.

---
**Audit limitation:** This is a source-code and user-evidence review, not a live penetration test or successful execution of the full application. Repository code cannot prove that the deployed/local environment, external Supabase configuration, lecturer credentials, or survey/report files are complete.
