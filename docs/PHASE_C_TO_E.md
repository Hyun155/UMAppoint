# UMAppoint Phase C–E Delivery Notes

This document records the feature work in the Phase C–E branch and the checks required before production use.

## Phase C — Lecturer operations

- Lecturer availability supports listing future slots, creating, editing and deleting owned slots.
- Slot creation/update validates past times, start/end ordering and overlapping availability.
- A slot with an active booking cannot be edited or deleted; slot history is preserved.
- Lecturer booking requests now show the student's cancellation/rescheduling reason.
- Lecturers can approve or reject new bookings, confirm cancellation requests, approve a requested new time, or decline a reschedule while keeping the original approved booking.
- The lecturer schedule and availability calendar remain backed by the authenticated FastAPI API.

## Phase D — Assistant and notifications

- The authenticated UMAppoint assistant can answer booking/status FAQs, retrieve open future slots, and summarize the signed-in user's latest appointments.
- In-app notifications remain the primary notification channel and are user-specific.
- The unread navigation badge now reads from the FastAPI notifications endpoint and refreshes every 30 seconds.
- The notifications page refreshes periodically and when the browser tab regains focus.
- Optional Telegram alerts can be sent to one private staff group for new booking, cancellation, rescheduling and appointment status events. The alert contains only an appointment reference/date/status and does not send student purpose, phone number, email or request reason.

### Telegram setup (optional)

1. Create a bot with Telegram's official BotFather.
2. Add the bot to a private staff group and grant it permission to send messages.
3. Obtain the bot token and the group's chat ID.
4. Set these backend environment variables (never commit real values):

   ```env
   TELEGRAM_BOT_TOKEN=your_bot_token
   TELEGRAM_CHAT_ID=your_private_group_chat_id
   ```

5. Restart the FastAPI service. Leave both values blank to disable Telegram; in-app notifications continue working.

Telegram is the recommended first external channel for this project because it is simpler to configure for an internal staff group. WhatsApp Cloud API requires Meta Business setup, a registered phone number, access tokens and approved message templates for many business-initiated messages. It can be added later behind the same notification adapter if the faculty specifically requires WhatsApp.

## Phase E — Quality and deployment readiness

### Automated checks

The GitHub Actions workflow runs:
- Frontend dependency installation, Vitest and production build.
- Backend Python compilation.
- Isolated Telegram adapter tests that mock the network and verify disabled, success and failure behavior.

The existing backend API tests under `backend/tests` are integration tests that use the configured Supabase/PostgreSQL database and seeded demo accounts. They are not run by the isolated CI job because this repository does not provide a disposable CI database or seed process.

### Required pre-production checks

- Run the complete backend integration suite against a dedicated test database with the expected demo student and lecturer accounts.
- Verify role boundaries with student and lecturer accounts, including cross-user appointment IDs.
- Exercise booking, cancellation, reschedule approval/rejection, completion, notification read states and overlapping slot attempts end-to-end.
- Set a strong unique `JWT_SECRET`; never use the development fallback.
- Set `DB_URL` using the provider's recommended secure connection/pooler settings.
- Set `CORS_ORIGINS` to the exact deployed frontend origin(s), not a wildcard.
- Serve the frontend and API over HTTPS in production.
- Keep Supabase service-role keys, Telegram bot tokens, database passwords and JWT secrets only in deployment secret storage.
- Configure database backups and test restoration before launch.
- Leave Telegram disabled until a private staff group and its access policy are confirmed.

### Local commands

Frontend:

```powershell
bun install
bun run test
bun run build
```

Backend:

```powershell
cd backend
python -m pip install -r requirements.txt
python -m compileall -q app tests
python -m pytest tests/test_telegram.py -q
```

For the full integration suite, configure `backend/.env` with a dedicated test database and seeded demo accounts, then run `python -m pytest tests -q`.

## Known release boundary

The GitHub workflow and isolated tests do not prove connectivity to the user's live Supabase project, browser behavior against real accounts, Telegram delivery to a real group, or production deployment. Those checks require the project's private environment and credentials and must be completed before launch.
