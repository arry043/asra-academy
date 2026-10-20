# Live Classes (PHASE 11)

Live classes extend the PHASE 08 scheduling (`docs/FACULTY-PORTAL.md §6`) with administrator management, host assignment, Google Meet link creation, completion, manual recording links and notifications. Notifications are described in [NOTIFICATIONS.md](./NOTIFICATIONS.md).

Workflow: **Create class → assign course → assign faculty (host) → schedule → notify students → join → add recording link.**

## 1. Who can do what

| Actor                                    | Scope                                                  | Can                                                                                                                                                       |
| ---------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Administrator (`live_classes.manage`)    | Any course                                             | Create, edit, choose/replace the host, cancel, mark completed, create/retry the Google Meet link, add/replace/remove the recording link, list all classes |
| Faculty (`live_classes.manage_assigned`) | Only courses they are assigned to (`CourseInstructor`) | Same actions for their courses; they are the host of classes they schedule                                                                                |
| Student (`content.view_enrolled`)        | ACTIVE enrolment in a PUBLISHED course                 | See upcoming/past classes, join (link shown until the class ends), open the recording of a held class                                                     |

`live_classes.manage` is granted to **Admin** (and Super Admin via "all permissions") by the seed. Existing databases need `npm run db:seed` once to receive the new permission (the seed is additive).

Every rule is enforced by the API: course assignment, host eligibility (the host must be assigned to the course), enrolment, and state. Hiding a button is never access control.

## 2. Data model (`live_class_sessions`)

Existing PHASE 08 table, extended additively (migration `20261020090000_phase11_live_classes_notifications`):

| Column                                     | Meaning                                                                                                  |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `course_id`, `host_faculty_profile_id`     | Course (no duplicate course entity) and host faculty profile (no duplicate faculty entity)               |
| `starts_at`, `duration_minutes`            | UTC instant + 15–480 minutes. The end is derived                                                         |
| `time_zone`                                | IANA zone the class is scheduled/shown in. Only `Asia/Kolkata` is accepted (V-09); defaults for old rows |
| `status`                                   | `SCHEDULED` → `CANCELLED` (before it ends) or `COMPLETED` (once it has started). No "live" state         |
| `provider`, `join_url`                     | `manual` (pasted link) or `google_meet`; the link                                                        |
| `provider_meeting_id`                      | Provider id (Google: `spaces/{id}`). `UNIQUE(provider, provider_meeting_id)`                             |
| `meeting_claimed_at`, `meeting_last_error` | Creation lease (prevents duplicate meetings) and the last staff-safe provider error                      |
| `completed_at`, `cancelled_at`             | Set with their status (CHECKs)                                                                           |
| `recording_url`, `recording_updated_at`    | Canonical YouTube link (CHECK https)                                                                     |
| `created_by_id`, `updated_by_id`           | Audit: who created / last changed the class                                                              |

**Time-zone strategy.** Instants are always stored and compared in UTC. The browser sends an ISO instant with an explicit offset (the portal converts the IST `datetime-local` input to `+05:30`); the class keeps its zone so every screen, in-app message and email shows the same time labelled "IST (UTC+05:30)".

## 3. Provider abstraction

```
LiveClassService ──► MeetingProvider (port) ──► GoogleMeetProvider (adapter)
```

- `src/modules/live-classes/providers/meeting-provider.ts` — the port: `createMeeting(): { meetingId, joinUrl }`, `configured`, and `MeetingProviderError` with kinds `NOT_CONFIGURED | AUTHORIZATION | PERMISSION | RATE_LIMITED | UNAVAILABLE | INVALID_RESPONSE` and a staff-safe message.
- `google-meet.provider.ts` — the only file that knows Google URLs, scopes or OAuth.
- The domain stores only a provider id and an opaque meeting id, so another provider would be another adapter.

**No fake provider.** When Google Meet is not configured, requesting an automatic link fails with HTTP 503 and a clear message, before anything is created. Tests replace the provider with a test double through `setGoogleMeetProviderForTests`, which throws outside `NODE_ENV=test`.

**Duplicate prevention.** The Meet API has no idempotency key, so the class row is the lock: one process sets `meeting_claimed_at` with a conditional UPDATE (only one wins; concurrent callers get 409), calls Google once, and stores the result only if it still holds the claim. A failure clears the claim and records `meeting_last_error`; nothing is retried automatically (after a timeout a space may already exist on Google's side — an unused space is harmless). Staff retry explicitly with "Retry Google Meet" (`POST …/live-classes/:id/meeting`), which is idempotent: a class that already has its link is returned unchanged.

**Failure reporting.** If a class is scheduled with "Create a Google Meet link" and Google fails, the class is still saved (students are told the schedule), the response message says the link could not be created, `meetingState = FAILED` and `meetingError` explain why (staff only). It is never reported as success.

## 4. Google Meet setup (operator steps — not yet performed)

> **Status:** the adapter is implemented and unit-tested against a simulated Google API. **Live meeting creation has not been verified** because no Google credentials were available. Complete these steps, set the three variables, then schedule a test class with "Create a Google Meet link".

### 4.1 What Google requires (verified 2026-10-20 against developers.google.com)

- API: **Google Meet REST API** — `POST https://meet.googleapis.com/v2/spaces` returns `name` (`spaces/{id}`) and `meetingUri` (`https://meet.google.com/…`).
- Scope: `https://www.googleapis.com/auth/meetings.space.created` — classified by Google as **sensitive**.
- Authentication: the Meet REST API accepts **user authentication only**. Options:
  1. **OAuth user grant (implemented):** the academy's Google account authorises the app once; the API stores its refresh token.
  2. **Service account with domain-wide delegation (not implemented):** only for Google Workspace domains, configured by a Workspace administrator. Choose this only if the client confirms Workspace (AE-02).
- Account eligibility: Google's Meet REST API documentation does **not** state whether personal (free `@gmail.com`) accounts can create spaces through the API. This must be verified with the academy's actual account (AE-01). Do not assume it works.
- The meeting organiser is the authorising account. Admission ("knock to join"), recording and other defaults follow that account's Meet settings; the integration creates spaces with default settings.

### 4.2 Google Cloud project

1. Google Cloud Console → create (or choose) a project owned by the academy.
2. **APIs & Services → Library → "Google Meet REST API" → Enable.**
3. **APIs & Services → OAuth consent screen:** user type _External_ (personal accounts) or _Internal_ (Workspace, no verification needed); app name "ASRA Academy"; support/developer email; add the scope `…/auth/meetings.space.created`; while in _Testing_, add the organiser account as a test user.
4. **Credentials → Create credentials → OAuth client ID → Web application.** Add the authorised redirect URI used to obtain the token (for the OAuth Playground method below: `https://developers.google.com/oauthplayground`).
5. Put the client id/secret in `GOOGLE_MEET_CLIENT_ID` / `GOOGLE_MEET_CLIENT_SECRET` (server environment only).

### 4.3 Obtaining the refresh token (one-time)

Using Google's OAuth 2.0 Playground with the academy's own client:

1. Open `https://developers.google.com/oauthplayground` → gear icon → tick **Use your own OAuth credentials** → paste the client id and secret.
2. Step 1: enter the scope `https://www.googleapis.com/auth/meetings.space.created` → **Authorize APIs** → sign in **as the account that should own the meetings** and grant access.
3. Step 2: **Exchange authorization code for tokens** → copy the **refresh token** into `GOOGLE_MEET_REFRESH_TOKEN`.
4. Restart the API. Admin → Live classes now shows "Create a Google Meet link automatically" as available.

Never commit or paste these values into documentation, tickets or chat.

### 4.4 Keeping it working

- **Testing vs. Production:** Google issues refresh tokens that **expire after 7 days** to an _External_ app whose consent screen is in _Testing_. For lasting use, publish the app to _Production_; because the scope is sensitive, Google may require **app verification** for External apps. _Internal_ (Workspace) apps avoid both.
- A refresh token also stops working if the account revokes access, after 6 months without use, or when more than 100 tokens exist for the same client and account.
- Symptoms: staff see "Google rejected the academy's Google Meet authorisation …" on new classes. Repeat §4.3 and update `GOOGLE_MEET_REFRESH_TOKEN`.
- Errors are mapped as: 401/`invalid_grant` → re-authorise; 403 `SERVICE_DISABLED` → enable the API; 403 scope/permission → re-authorise with the scope / check account eligibility; 429 → try again later (API returns 429); 5xx/timeout → try again (API returns 503).

## 5. Scheduling rules

- Start must be in the future and at most 366 days ahead; duration 15–480 minutes; zone `Asia/Kolkata`.
- Archived courses cannot get new classes. Draft courses can (students are only notified once they can access the course).
- Editing (title, description, time, duration, link, host) is allowed while `SCHEDULED` and not ended. Cancelled and completed classes are frozen.
- A pasted link replaces any existing link (including a Google one). A Google link is never created over a pasted link (409 — remove the pasted link first).
- Cancelling is idempotent; an ended class cannot be cancelled after the fact.
- "Mark completed" is allowed once the class has started; idempotent.
- Students receive the joining link only for a `SCHEDULED` class until it ends; never for cancelled or completed classes. Staff keep seeing it.

## 6. Recording workflow (manual, F-04)

1. Faculty records the class on their device (or uses the organiser account's Meet recording, outside the platform).
2. Faculty uploads it to the academy's YouTube channel (unlisted recommended).
3. Faculty/admin clicks **Add recording** on the class and pastes the YouTube link (allowed once the class has started; not for cancelled classes).
4. Enrolled students see **Watch recording** under _Classes → Past and recordings_ and get an in-app notification.

Validation: `https://` YouTube watch, `youtu.be`, `/live/` and `/embed/` links with an 11-character video id; normalised to `https://www.youtube.com/watch?v=<id>` (tracking/time parameters dropped). Other hosts, playlists, look-alike domains and credentials in URLs are refused.

**Privacy.** The LMS decides who is _shown_ the link: only students with an ACTIVE enrolment in the PUBLISHED course (plus the course's faculty and administrators). An **unlisted YouTube video is not private** — anyone who has the link can watch it and links can be forwarded. YouTube's own privacy settings are separate from LMS authorisation; the UI does not promise that sharing is impossible. Use YouTube "Private" with named viewers if that is required (AE-04).

Not implemented (out of scope): automatic recording capture, YouTube uploads, YouTube API, paid storage.

## 7. API

| Method & path                                                                            | Permission                     | Purpose                                                      |
| ---------------------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------ |
| `GET /admin/live-classes?when&courseId&status&page`                                      | `live_classes.manage`          | List (upcoming soonest-first / past newest-first)            |
| `GET /admin/live-classes/settings`                                                       | `live_classes.manage`          | Google Meet availability, accepted time zones                |
| `GET /admin/courses/:id/live-class-hosts`                                                | `live_classes.manage`          | Faculty assigned to the course (valid hosts)                 |
| `POST /admin/live-classes`                                                               | `live_classes.manage`          | Create (`courseId`, `hostFacultyProfileId`, `meeting: manual | google_meet`, `joinUrl?`) |
| `GET/PATCH /admin/live-classes/:id`                                                      | `live_classes.manage`          | Detail / edit (incl. host)                                   |
| `POST /admin/live-classes/:id/{cancel,complete,meeting}`                                 | `live_classes.manage`          | Cancel / mark completed / create or retry Google Meet link   |
| `PUT /admin/live-classes/:id/recording`                                                  | `live_classes.manage`          | `{ recordingUrl: string                                      | null }`                   |
| `GET /faculty/live-classes`, `GET /faculty/live-classes/settings`                        | `live_classes.manage_assigned` | Assigned courses only                                        |
| `POST /faculty/courses/:id/live-classes`                                                 | `live_classes.manage_assigned` | Create (host = caller)                                       |
| `PATCH /faculty/live-classes/:id`, `POST …/{cancel,complete,meeting}`, `PUT …/recording` | `live_classes.manage_assigned` | Same as admin, assigned courses only                         |
| `GET /student/live-classes?when&courseId`                                                | `content.view_enrolled`        | Enrolled, published courses only                             |

Responses never include credentials; `meetingError` and `hostFacultyProfileId` are null for students.

## 8. Known limitations

- Live Google Meet creation is **unverified** (no credentials); see §4 and AE-01/AE-02.
- No attendance tracking (F-05), no embedded meetings (F-06), no automatic reminders before class (see NOTIFICATIONS.md §7).
- The Google space is not deleted when a class is cancelled (the Meet API has no delete; an unused space expires on its own) and its join link is hidden from students.
- Only IST scheduling is accepted (V-09).
- The background email sweep runs in the long-running API process only; on serverless deployments emails are sent right after the event, and one that fails stays `PENDING` until a long-running process (or a scheduled job, not yet set up) sweeps the outbox (NOTIFICATIONS.md §6).
