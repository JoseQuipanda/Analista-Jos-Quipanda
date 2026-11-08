# Portal Analista José Quipanda — repair build

This folder is a **tested, unpublished static-site patch** based on the current public GitHub `main/index.html` (fetched 2026-11-08, SHA-256 `e8ce4f1389c6e42f56deb0fa4799f9d3646eb1bd3dcfefd9db35d99954d03c2c`). It also preserves the uploaded HTML as a reference. No Firebase/Vercel console configuration was changed and nothing was published.

The original design, page structure, articles and external ChatGPT URL are retained. The latest upstream module had a dangling fragment from an absent AI feature; that fragment caused a JavaScript syntax error and was removed. The existing external ChatGPT study link remains untouched. The six original relative JPG assets are included at the deployment root; `assets/` is a convenience copy.

## Included repair

- Email/password signup, login, sign-out and password reset stay on Firebase Auth.
- Public course cards read only metadata from `publicCourses`; full/legacy course records are kept admin-only in `courses`, while lesson modules/URLs are in `courseLessons/{courseId}` and only admins or currently approved students can read them. Separate projection avoids Firestore's rules-not-filters query limitation and prevents historic lesson fields in `courses` leaking through public listing.
- New self-service accounts can create only their own `users/{uid}` student profile; the auth-state handler creates it, so signup is not blocked by a competing auth-state/profile-write race. Students can safely repair/update that profile only without changing role or email. Client security rules do not allow role escalation. `scripts/provision-admin.mjs` is for a trusted operator only; it requires Firebase Admin credentials outside this folder.
- Students can create one pending request at `enrollments/{uid}_{courseId}` only for a published course. The admin may approve/reject.
- Existing editor/publication, certificates and verification remain; course lesson data is now separated from public metadata. Unpublished content is admin-only.
- The public HTML uses Firebase web config (`apiKey`/project identifiers), which is not a service-account secret. Data protection depends on the restrictive Firestore rules, not hiding the config. The upstream public repo also exposes `firebase-config.txt`; do not add service-account private keys or R2 secrets to GitHub/browser code.

## Deploy only after operator review

1. **Back up** the GitHub repo and current Firestore rules/settings. Check existing Firestore documents first: migration is not automatic. The reported database was empty, but verify before replacing any existing setup.
2. Review `firestore/firestore.rules`; deploy exactly these rules to the `analista-cacf0` Firestore database. Do **not** use test mode or open rules. These are default-deny rules. Start with emulator/rules testing or a staging Firebase project. In a migration, first preserve existing `courses` documents as admin-only records, create `publicCourses/{id}` containing only title/description/duration/status/createdBy/createdAt/updatedAt for courses intended to list, and ensure `courseLessons/{id}` holds private lesson content. Do not copy legacy/mixed fields into `publicCourses`. Keep the same IDs across all three records; app admin edits/deletes and publication toggle maintain the projections together once deployed.
3. In Firebase Authentication, confirm Email/Password provider is enabled; signup is self-service. Add the final production hostname to Authentication → Settings → Authorized domains. Do not create or assign an administrator in browser/client code.
4. Create the intended owner account through the site's signup (or Firebase Auth), then run the trusted Admin SDK provisioning script from a private machine with Node and `firebase-admin` installed. Keep the service-account/ADC credential outside the repo, restrict access, unset/remove it after use, and run only for the exact verified account:
   ```sh
   npm install firebase-admin
   GOOGLE_APPLICATION_CREDENTIALS=/secure/path/admin-service-account.json \
     node scripts/provision-admin.mjs josequipanda70@gmail.com
   ```
   A trusted operator with Application Default Credentials may use that instead of the env var. The script assigns Firestore `users/{uid}.role = admin`; do not give this script to public users. Test that a normal newly-created account cannot edit its own role.
5. Publish `index.html` and the six JPG files (`bioquimica-clinica.jpg`, `coproparasitologia.jpg`, `hematologia.jpg`, `imunohematologia.jpg`, `microbiologia.jpg`, `urinologia.jpg`) from this folder at the site's static root. This project is standalone HTML; no Vercel build step is required. This task intentionally did not commit or publish it.
6. Test signup/login/reset, public course listing, a student's pending enrollment, admin approval, student access to the lesson, and a different/unapproved student's denied lesson read. Test draft content and course metadata privacy. Verify the public certificate lookup and admin-only issuing flow.

## Data/rules model

- `users/{uid}`: owner can read/create a `student` profile only; admin can read/update/delete. Self-role elevation is forbidden.
- `courses/{courseId}`: admin-only full/legacy record. `publicCourses/{courseId}`: bounded metadata-only projection; published docs public, drafts admin-only. Public client query is `where status == published`. Never place lesson fields in `publicCourses`; old mixed `courses` documents remain private until cleaned/migrated.
- `courseLessons/{courseId}`: admin writes; admin or currently approved student for the published course can `get`; enumeration is denied.
- `enrollments/{uid}_{courseId}`: student can create own `pending` request; only admin can list/review. Deterministic IDs prevent duplicate requests.
- `contents/{id}`: published items public, drafts admin-only.
- `certificates/{code}` private/admin-only; `certificatePublic/{code}` allows direct public `get` but not list. Issuance writes private and public certificate documents atomically to prevent partial publication.
- Anything else is denied by final catch-all.

Do not import old public course documents containing lesson bodies into `courses`: they are not accepted by the metadata rules, and if any old rules were permissive they must be replaced before public launch. Carefully migrate any real data into the two collections.

## R2 uploads — not implemented yet

The R2 bucket is reported private, and there is no safe upload/download authorization service in this build. The uploader is deliberately not enabled. The publication editor currently allows a direct HTTPS image URL only; externally hosted URLs are public and should contain no private material.

For a later private R2 integration, add a server-side Worker/API that (a) verifies Firebase ID tokens, (b) checks the Firestore user admin role for uploads, (c) validates MIME type/size and generates random object keys, and (d) issues short-lived presigned PUT URLs. Store only object keys—not long-lived public links—in lesson records. For downloads, server-check admin or approved enrollment and return a short-lived presigned GET URL. Do not expose R2 access key/secret or permit arbitrary client paths; test revocation and expiry. Public gallery images should use a deliberately public delivery path or controlled public endpoint, separate from private course assets.

## Validation performed (offline only; not a release certification)

- Compared current GitHub root `index.html` with uploaded input: byte-identical at fetch time. Design, original article DOM IDs and external ChatGPT link remain regression-checked.
- `python3 tests/validate.py` passes static HTML/asset/feature checks. Its optional Tree-sitter JavaScript parser check was skipped because the parser dependencies are not installed.
- `python3 tests/security_regression.py` passes source-contract checks plus an explicit allow/deny policy truth table for lessons and enrollment. **This does not evaluate Firestore Rules syntax or runtime semantics.**
- Emulator execution was attempted but unavailable: Node/npm, Java and Firebase CLI were absent. Downloading local runtimes exceeded the sandbox workspace limit and they were removed; no Firebase emulator/test project could be run. There are no positive/negative emulator tests, browser tests, or real Auth signup tests here. Prior to any release, run Firebase Emulator Suite rules-unit-testing for the cases in the operator checklist below.
- Source review found and fixed the signup/auth-state profile creation race by moving student profile creation into the auth-state handler with retry/read-on-race, and permitting safe self-profile updates only while keeping role and email immutable. Certificate private/public writes now commit atomically.
- No live Firebase, GitHub or Vercel resource was accessed or modified. YouTube embeds and externally hosted PDF/material URLs are public URLs: Firestore protects stored lesson metadata, not access to those third-party resources once their URLs are known. Use authenticated short-lived media delivery if material confidentiality is required.

### Mandatory emulator scenarios before release

Test unauthenticated and student/admin identities: create own student profile allowed; set own role to admin denied; update name allowed but role/email changes denied; query/get published course metadata allowed while draft/private lesson fields are absent; non-admin enrollment create for own published course pending allowed, forged identity/course/status, unpublished-course request and duplicate create denied; enrollment list/review denied to student and allowed to admin; lesson read denied before approval, allowed after admin approval, denied to other student and after course unpublish; drafts denied to public; certificate private read/list denied to public, public direct code verification allowed and collection list denied; admin-only writes for publishing/certificates. Use two clients to exercise duplicate signup/profile initialization and concurrent enrollment creation. Also verify Auth account creation and password reset in an isolated emulator project.
