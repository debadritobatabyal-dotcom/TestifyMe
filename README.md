# TestifyMe — Mobile-First Online Examination Platform

TestifyMe is a production-grade, mobile-first online examination platform designed for private educators, tutors, and their students. Built strictly to production standards (**No Demo Mode, No Mock Previews**), it features secure role-based authorization, multiple question input pipelines (PDF text + OCR fallback, plain text, CSV, Excel), a mandatory staged review screen, randomized exam generation (strictly 40 questions: 5 Assertion–Reason and 35 standard MCQs), persistent student profiles, server-authoritative timed exams with debounced autosave, configurable negative marking, and 4-sheet Excel (.xlsx) / CSV exports.

---

## 📱 Mobile-First Design & Aesthetic

TestifyMe follows a **restrained claymorphism** design system engineered specifically for mobile devices (360px, 375px, 390px, 412px, 430px up to desktop):
- **Typography**: Nunito (700/800/900) for tactile headings and DM Sans (400/500/700) for comfortable reading.
- **Palette**:
  - Background: `#F4F1FA`
  - Primary text: `#332F3A`
  - Secondary text: `#635F69`
  - Primary violet: `#7C3AED`
  - Secondary pink: `#DB2777`
  - Success emerald: `#10B981`
  - Warning amber: `#F59E0B`
  - Danger rose: `#E11D48`
  - Info sky: `#0EA5E9`
- **Claymorphic Controls**: 24–32px rounded cards, 16–20px tactile buttons, 16–20px inputs, with soft layered shadows and zero distracting exam animations.
- **Touch Targets**: All interactive elements strictly guarantee $\ge 44\text{px}$ touch targets.
- **Reduced Motion**: Full `@media (prefers-reduced-motion: reduce)` support.

---

## 🛠 Tech Stack

- **Frontend**: React 19, TypeScript, Vite
- **Styling**: Tailwind CSS v4, Custom Claymorphism Tokens
- **Icons**: Lucide React
- **Document & Question Extraction**:
  - `pdfjs-dist`: Selectable text stream extraction from PDFs
  - `tesseract.js`: Client-side OCR fallback for scanned question sheets
  - `xlsx` (SheetJS): Excel spreadsheet parser and 4-sheet workbook exporter
- **Celebration Effects**: Canvas Confetti
- **Testing**: Vitest, JSDOM (13 comprehensive tests covering all functional, multi-teacher isolation, security, scoring, and export requirements)
- **Backend / Database**:
  - Firebase Authentication & Firestore (with production security rules in `firestore.rules`)
  - Local persistent reactive storage (`safeStorage` with `localStorage` + in-memory fallback) enabling zero-config out-of-the-box local operation.

---

## 🔒 Multi-Teacher Architecture & Security Isolation

### 1. Isolated Multi-Teacher Portal
- The Teacher Portal is built on a **multi-tenant architecture** where every educator has their own completely isolated workspace.
- **Teacher Registration & Login**: Real Firebase Authentication (`createUserWithEmailAndPassword` / `signInWithEmailAndPassword`).
  - Required fields: Name, Email, Password, Confirm Password (plus optional Institution, Department, and Faculty Title).
  - Primary Identity: Firebase `uid` (NOT email address) is used as the universal database identifier and security boundary.
- **Strict Data Ownership**:
  - All resources (`tests/{testId}`, `questions/{questionId}`, `attempts/{attemptId}`, exports) are stamped with `ownerId: teacherUid`.
  - Queries are strictly scoped to the authenticated teacher's UID: `WHERE ownerId == authenticatedUser.uid`.
  - A newly registered teacher starts with a clean, empty workspace (0 tests, 0 questions, 0 active tests, 0 results) with helpful empty states.
  - Active tests are teacher-specific: Teacher A's active tests are never visible in Teacher B's dashboard or question bank.
- **Backend Authorization & Firestore Security Rules (`firestore.rules`)**:
  - Direct URL, ID, or API access to another educator's test, question, result, or export is stopped with **Permission Denied**.
  - Student clients are strictly prevented from reading question banks, unpublished tests, answer keys, or other students' attempts.
- **Teacher Profile & Account Management**:
  - Dedicated Profile modal displaying total created tests, active tests, question bank count, and student participants.
  - Editable profile fields: Full Name, Institution/School, Department, and Academic Title.
- **Clean Session Clearing**:
  - Logout cleanly purges all client-side cached data to prevent data leakage between different teacher logins on shared devices.

### 2. Student Profile Persistence
- During first registration, students enter their:
  - Full Name
  - Student ID / Roll Number (e.g. `ROLL-2026-042`)
  - Email Address
  - Phone Number (optional)
  - Password
- After account creation, the student profile is securely saved.
- On subsequent visits, students log in with their email and password, and their full profile is automatically loaded without having to re-enter details.
- Every exam attempt is automatically bound to the authenticated student's identity (`studentId`, `studentName`, `studentRollNumber`) to prevent identity spoofing.

### 3. Server-Authoritative Answer Security
- Question answer keys and explanations are **never leaked** to student clients during exams.
- The `ExamService` strips correct answers into `StudentSafeQuestion` payloads before delivery.
- Scoring and negative marking are calculated server-side upon submission.
- Students view their final score, percentage, correct/incorrect/unanswered counts, but cannot see answer keys or question-by-question correctness unless explicitly permitted.

---

## 📥 Question Bank: Multi-Source Import & Review Workflow

Teachers never have to manually type every question. TestifyMe supports four practical input methods:
1. **Plain Text Import**: Paste raw text with questions and options.
2. **PDF Question Import**: Upload PDF question papers (`pdfjs-dist` text stream extraction).
3. **Scanned PDF OCR Fallback**: If selectable text is insufficient, the system activates `tesseract.js` optical character recognition.
4. **Spreadsheets (CSV / XLSX)**: Upload questions structured in standard columns.

### Automatic Structure Detection:
- **Assertion–Reason Detection**: Automatically identifies `Assertion: ...` and `Reason: ...` blocks and classifies them as `ASSERTION_REASON` with standard 4-option logic.
- **Answer Key Extraction**: Automatically detects and maps answer blocks (e.g., `Answer Key: 1-A, 2-B, 3-C` or `Answer: B`).
- **Answer Integrity**: If the source does not provide an answer, the parser marks the question with `"Correct answer required"`—it **never invents answers**.

### Mandatory Staged Question Review Screen:
Before any questions enter the active Question Bank:
- Teachers review every extracted question in the **Review Imported Questions** modal.
- Inspect and edit question text, assertion/reason, and options.
- Assign or correct missing answers.
- Toggle question types (`MCQ` vs `ASSERTION_REASON`).
- View validation status summary (Imported, Valid, Needs Review, Duplicates).
- Publish validated questions to the Question Bank with one click.

---

## 📝 Test Creation & Examination Flow

### Test Settings & Rules (Requirement 17–20):
- **40 Questions**: Exactly **5 Assertion–Reason** questions and **35 standard MCQs**.
- **Bank Availability Validation**: Verifies that sufficient active questions exist in the bank before generating the test.
- **Configurable Negative Marking**:
  - `ON` / `OFF` toggle
  - Configurable positive marks (e.g., `+1` or `+4`)
  - Configurable negative deduction (e.g., `-0.25` or `-1.0`)
  - Unanswered: `0`
- **Examination Settings**:
  - Configurable duration (e.g. 40 minutes)
  - Start and end schedule windows
  - Randomize question order
  - Randomize options order
  - Maximum allowed attempts (default: 1)
  - Shareable Test Code (e.g., `CHEM-7X92`) and direct link
- **Fixed Exam Set**: Once an attempt starts, the student's randomized question sequence is permanently fixed. Refreshing the browser preserves the exact same paper and auto-saves progress.

---

## 📊 Teacher Analytics & Multi-Sheet Exports

Teachers can inspect student performance and export data:
- **Class Results Summary**: View all student submissions, roll numbers, percentage scores, and submission timestamps.
- **Detailed Student Response Sheet**: Open any attempt to view every question, the student's selected answer, the correct answer, and marks awarded.
- **Multi-Sheet Excel Workbook (`.xlsx`)**:
  - **Sheet 1 — Class Summary**: Student Name, Roll Number, Email, Attempted, Correct, Incorrect, Unanswered, Score, Percentage, Submission Time.
  - **Sheet 2 — Detailed Responses**: Student Name, Student ID, Question #, Question Text, Selected Answer, Correct Answer, Result (`CORRECT` / `INCORRECT` / `UNANSWERED`), Marks.
  - **Sheet 3 — Question Analysis**: Question #, Question Text, Subject, Type, Attempts, Correct, Incorrect, Accuracy (%).
  - **Sheet 4 — Test Configuration**: Test Name, Duration, Question Count, AR Count, MCQ Count, Positive Marks, Negative Marks, Start Time, End Time, Access Code.
- **CSV Exports**: Export Class Summary, Question Analysis, or Google Forms compatible CSV.
- **Google Sheets Abstraction**: Clean service integration (`GoogleSheetsService`) configured for OAuth credentials.

---

## 🚀 Running the Project

### Development Server
```bash
npm run dev
```
Accessible at `http://127.0.0.1:5173/`.

### Run Test Suite
```bash
npm test
```
Executes all 12 Vitest acceptance tests verifying student registration, profile persistence, teacher authorization, text parsing, review screening, test generation, negative marking, answer stripping, and multi-sheet exports.

### Build Production Bundle
```bash
npm run build
```
Type checks via `tsc` and bundles via `vite` with zero errors.
