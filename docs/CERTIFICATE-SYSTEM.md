# ASRA Academy — Certificate System (Phase 13)

| Field   | Value                                                                                            |
| ------- | ------------------------------------------------------------------------------------------------ |
| Version | 1.0.0                                                                                            |
| Status  | Phase 13 — Complete Production Implementation                                                    |
| Scope   | Certificate lifecycle, eligibility engine, PDF generation, public verification, admin management |

---

## 1. Overview & Lifecycle

The Certificate System provides durable, verifiable credentials awarded to learners upon satisfying all academic and curriculum requirements of an enrolled course.

```
       Course Completion (Lessons 100%)
                     ↓
       Assessment Checks (Exams Passed)
                     ↓
             Eligibility Engine
                     ↓
            Certificate Issued
                     ↓
       Cryptographic Unique Identifier
          (e.g. ASRA-2026-F9KC-M28V)
                     ↓
      ┌──────────────┴──────────────┐
      ▼                             ▼
Student PDF Download      Public Verification
 (Landscape A4 Branded)   (/verify/:certificateNumber)
```

---

## 2. Eligibility Engine

Eligibility is calculated strictly server-side by `certificatesService.checkEligibility(auth, courseId)`. The client is never trusted to assert completion or supply completion dates.

### Requirements Evaluated

1. **Authentication & Identity**: Requestor must be an active student account (`status === 'ACTIVE'`).
2. **Active Enrolment**: An `ACTIVE` enrolment row must exist for `(userId, courseId)`. Cancelled enrolments are disqualified (`ENROLLMENT_INACTIVE`).
3. **Curriculum Completion**:
   - Evaluated against authoritative progress rules: `enrollment.completedAt !== null` or `isCourseComplete(progress)`.
   - `isCourseComplete`: `progress.totalLessons > 0 && progress.completedLessons === progress.totalLessons`.
   - Counting lessons exclude non-interactive placeholders (per `countsTowardProgress`).
4. **Assessment / Examination Requirements**:
   - If the course has published examinations (`status === 'PUBLISHED'`), the student must have completed and passed each published examination (`passed === true`).
   - If an examination attempt is currently submitted and waiting for manual teacher grading (`evaluationStatus === 'PENDING'`), eligibility is held with code `EXAM_PENDING_GRADING`.
   - Courses without published examinations require only 100% curriculum completion.
5. **Idempotent Already-Issued Handling**:
   - If a certificate has already been issued for this enrolment, the engine reports state `ALREADY_ISSUED` and returns the existing certificate details safely.

---

## 3. Certificate Identifier Format & Uniqueness

Public certificate identifiers use the format:

```
ASRA-YYYY-XXXX-XXXX
```

- `YYYY`: 4-digit Gregorian issuance year (e.g. `2026`).
- `XXXX-XXXX`: 8 characters drawn from Crockford's Base32 alphabet (`23456789ABCDEFGHJKMNPQRSTVWXYZ`), omitting ambiguous characters `0`, `O`, `1`, `I`, `L`.
- Entropy: 40 bits of cryptographic randomness (~1.1 trillion permutations per calendar year).
- Constraint: Enforced in PostgreSQL via CHECK constraint `certificates_certificate_number_format` and UNIQUE index `certificates_certificate_number_key`.
- Collision handling: Generation retries up to 5 times in the astronomically unlikely event of an identifier collision.
- One-per-enrolment guarantee: Enforced at the database level via UNIQUE constraint `certificates_enrollment_id_key`.

---

## 4. PDF Generation & Styling

Generated server-side using `pdfkit` in Landscape A4 format (`841.89 × 595.28` pt):

- **Brand Palette**:
  - Deep Forest Green: `#012114`
  - Emerald Green: `#034729`
  - Academy Gold: `#C88717` / `#D89E34`
  - Ivory / Warm Cream Background: `#FDFBF7`
- **Visual Elements**:
  - Triple nested border with gold corner diamond flourishes.
  - Centered ASRA Academy emblem (or typographic wordmark header).
  - Title: "CERTIFICATE OF COMPLETION".
  - Recipient's frozen full name with elegant gold underline.
  - Course title snapshot.
  - Completion date and issuance date formatted in UTC.
  - Official Academy circular seal graphic.
  - Authorized signatory line: "Academic Director, ASRA Academy".
  - Bottom bar featuring Certificate ID and direct public verification URL (`/verify/:certificateNumber`).

---

## 5. Public Verification & Privacy Guarantees

Public verification is available at:

```
GET /api/v1/certificates/verify/:certificateNumber
```

and via the public web page `/verify/:certificateNumber`.

### Privacy Boundaries

To protect learner privacy in compliance with data protection principles:

- **Exposed fields**: `valid`, `certificateNumber`, `status` (`ISSUED` or `REVOKED`), `recipientName`, `courseTitle`, `academyName`, `completedAt`, `issuedAt`, `revokedAt`, and `revokedReason`.
- **Strictly omitted**: Student email address, internal database UUIDs, user phone number, assessment scores, and payment details.
- **Rate limiting**: Protected by per-IP rate limiting (`CERTIFICATE_RATE_LIMITS.verify`: 60 requests/minute) to prevent automated harvesting.

---

## 6. Administration & Revocation

Administrators with `certificates.view` permission can list, filter, search, and download certificates across all courses via:

```
GET /api/v1/admin/certificates
GET /api/v1/admin/certificates/:id
GET /api/v1/admin/certificates/:id/download
```

Administrators with `certificates.manage` permission can revoke credentials:

```
POST /api/v1/admin/certificates/:id/revoke
Body: { "reason": "Mandatory justification string (min 3 chars)" }
```

- Sets `status = 'REVOKED'`, records `revoked_at` timestamp and `revoked_reason`.
- Immediately reflects on the public verification page with a red warning notice.
- Automatically writes an immutable entry to `admin_audit_logs` (`action: "certificate.revoked_by_admin"`).

---

## 7. API Reference

### Student Endpoints (require `STUDENT` role + `content.view_enrolled`)

| Method | Path                                                  | Description                         |
| ------ | ----------------------------------------------------- | ----------------------------------- |
| `GET`  | `/api/v1/student/certificates`                        | List student's earned certificates  |
| `GET`  | `/api/v1/student/certificates/:id`                    | Get single certificate details      |
| `GET`  | `/api/v1/student/certificates/:id/download`           | Download PDF certificate            |
| `GET`  | `/api/v1/student/courses/:id/certificate/eligibility` | Check course completion eligibility |
| `POST` | `/api/v1/student/courses/:id/certificate`             | Claim / issue certificate           |

### Public Endpoints (no auth required)

| Method | Path                                             | Description                             |
| ------ | ------------------------------------------------ | --------------------------------------- |
| `GET`  | `/api/v1/certificates/verify/:certificateNumber` | Verify credential validity and metadata |

### Admin Endpoints (require `ADMIN` or `SUPER_ADMIN`)

| Method | Path                                      | Permission            | Description                    |
| ------ | ----------------------------------------- | --------------------- | ------------------------------ |
| `GET`  | `/api/v1/admin/certificates`              | `certificates.view`   | Paginated search and listing   |
| `GET`  | `/api/v1/admin/certificates/:id`          | `certificates.view`   | Certificate details            |
| `GET`  | `/api/v1/admin/certificates/:id/download` | `certificates.view`   | Download certificate PDF       |
| `POST` | `/api/v1/admin/certificates/:id/revoke`   | `certificates.manage` | Revoke certificate with reason |
