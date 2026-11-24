# TutorConnect

React, TypeScript, Supabase and Paystack prototype.

## Local setup

1. Run `npm install`.
2. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. Run migrations `001_schema.sql` through `009_auth_profile_recovery.sql` in numeric order in the Supabase SQL editor. Migration 005 creates the source-labelled learning-resource table, migration 007 associates tutor resources with approved courses, migration 008 adds paid resource publishing and private file storage, and migration 009 makes new-user profile creation idempotent and repairs missing profiles after sign-in.
4. To enable the protected admin dashboard for a trusted account, find the account ID with `select id, email from auth.users where email='admin@example.com';`, then run `update public.profiles set role='admin' where id='<account-uuid>';`. Never add an admin option to public sign-up.
5. Start the app with `npm run dev`.

The interface can be previewed without Supabase credentials, but authentication and data-backed screens require a configured Supabase project. After applying migration 008, redeploy `supabase/functions/payments` and configure the Paystack secret and webhook in test mode.

## Presentation demo

Open `/?demo=1` (or choose **Presentation demo** in the navigation) to show fictional tutor profiles, example programmes, and a sample learning-resource library. The page labels mock content, does not write demo records to Supabase, and disables contact unlocks and payments for demo profiles. **Create a real account** opens the normal Supabase signup flow; use a valid project URL/key and the project’s email-confirmation settings. Exiting the demo returns to the live app.

## Netlify deployment

The GitHub repository keeps the app in the `tutorconnect` subdirectory. The repository-root `netlify.toml` configures Netlify to build from that directory with `npm run build` and publish `dist`. The `public/_redirects` file sends direct requests for app paths back to the SPA entry point.

Connect the repository in Netlify and deploy the branch containing these files. If configuring build settings in the Netlify UI, use `tutorconnect` as the base directory, `npm run build` as the build command, and `dist` as the publish directory.

## Tutor plans and verification

Approved tutors can purchase a monthly or semester listing from the tutor dashboard. The blue TutorConnect check appears only when the tutor application is approved and `premium_until` is still in the future. The plan is activated by the server only after Paystack verifies the transaction; the browser cannot grant the badge or unlock contacts by itself. Students pay GHS 10 once per tutor to unlock contact details. An active student receives the same badge after at least one such payment is verified by Paystack. Contact information is returned only after the Edge Function confirms the payment.

Email confirmation may be enabled in Supabase Auth. In that case, new users must follow the confirmation link before logging in; the app displays this requirement instead of attempting an early sign-in. Password recovery links open a secure password-update form. Set the Supabase Auth site URL to the deployed app origin and add each local/deployed redirect URL to the allowed redirect URLs. If an existing authenticated account has no `profiles` row, migration 009 allows the app to create its own safe student/tutor profile and retry loading it; it never creates or grants an admin role.

Publishing a tutor resource costs GHS 50 per resource. A verified payment creates one publishing credit; each credit can publish one tutor resource and cannot be reused after deletion. Approved tutors can upload a video or study file (up to 50 MB) to the private `tutor-resources` bucket or publish a YouTube/HTTPS link. The app creates short-lived signed links for authorized students. RLS and a database trigger enforce payment and credit use, so a client-side bypass cannot publish unpaid resources. Apply migration 008 and redeploy the payments function before enabling this flow. Configure the Paystack **secret test key** as the `PAYSTACK_SECRET` Supabase Edge Function secret. Never put the secret key in a `VITE_` variable or browser code.

## Student AI assistant

The floating student assistant uses Gemini through the `student-assistant` Supabase Edge Function. It can answer general and academic questions across subjects, explain concepts, work through steps, prepare study plans and help with TutorConnect. AI chat requires an active signed-in account; the email, phone and WhatsApp support links remain available to everyone. The Gemini key is read only by the Edge Function and must never be added to a `VITE_` variable or browser code.

To enable AI chat:

1. Apply `006_student_assistant_quota.sql` after migrations 001–005.
2. Create a Gemini API key in Google AI Studio and add it as the `GEMINI_API_KEY` Edge Function secret in the Supabase project settings. Do not commit the key or share it in chat.
3. Deploy the function with `supabase functions deploy student-assistant`.

The function enforces per-user request limits and bounds message size and response length. Gemini requests may take up to 60 seconds; timeouts return a specific retry suggestion instead of a generic gateway error. Set Netlify's `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to the same Supabase project and trigger a new deploy after changing them; these values are compiled into the static app at build time. Gemini's free-tier availability and quotas are controlled by Google and can change; when the provider quota is reached, the assistant displays the function's error and students can still contact the administrators directly.

## Validation

- `npm run build` type-checks and builds the application.
- `npm run test:unit` checks account-verification rules.
- `npx playwright install chromium` installs the browser for the UI tests.
- `npm run test:e2e` runs the authentication, presentation-demo, accessibility, assistant-support, catalogue, resource-library, and mobile-layout browser checks. If Chromium cannot be downloaded and Chrome is already installed, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to that browser executable path before running the tests.

## Academic catalogue

UCC's public resources list colleges, faculties/schools, departments and admissions programmes:

- https://academics.ucc.edu.gh/colleges
- https://academics.ucc.edu.gh/faculties.schools
- https://academics.ucc.edu.gh/departments
- https://admissions.ucc.edu.gh/catalogue/departments

The admissions catalogue describes degree programmes, not semester course units. Official semester course-unit lists with verifiable codes and academic-unit mappings have not yet been established for UCC, the University of Ghana (Legon), or KNUST, so no course-unit seed data is included. Add courses only after confirming the code, title, academic unit and source URL against an official course outline or teaching schedule. Course and tutor search are grouped by their academic unit.

The signed-in and public-facing programme catalogue is separate from tutor course search. Migration 004 imports the 535 active programmes currently listed on UCC's official admissions catalogue, including the programme title, award, level, offering unit, and source link. The catalogue's departments page reports a slightly different programme count; each imported entry comes from an individual official programme listing. College and school labels are included only where the admissions catalogue supplies that relationship. This data does not represent semester course units or course codes.

The public **Courses & resources** library is separate from tutor profiles. Migration 005 creates its source-labelled, course-linked resource table, but no UCC course units are seeded because official semester course codes have not been verified. The app also provides a small curated subject library for Mathematics, Computer Science, and Business/Management; these are independent third-party study links, not UCC course records, tutor lessons, or endorsements. Past papers should be listed only when an official, public archive is verified; open practice materials should be labeled separately.

The curated links were checked against their publishers: [MIT OpenCourseWare Linear Algebra 18.06](https://ocw.mit.edu/courses/18-06-linear-algebra-spring-2010/) and its [YouTube lecture playlist](https://www.youtube.com/playlist?list=PLE7DDD91010BC51F8); [3Blue1Brown's Essence of Calculus playlist](https://www.youtube.com/playlist?list=PLZHQObOWTQDMsr9K-rj53DwVRMYO3t5Yr); [Harvard CS50x](https://cs50.harvard.edu/x/) and its [Week 0 lecture video](https://youtu.be/2WtPyqwTLKM); the [CS50P Python video playlist](https://www.youtube.com/playlist?list=PLhQjrBD2T3817j24-GogXmWqO5Q5vYy0V); [OpenStax Principles of Management](https://openstax.org/books/principles-management/pages/1-introduction); and [MIT OpenCourseWare Financial and Managerial Accounting](https://ocw.mit.edu/courses/15-501-introduction-to-financial-and-managerial-accounting-spring-2004/). MIT OCW course materials and the OpenStax management text state CC BY-NC-SA 4.0 terms; check individual asset credits and license terms before reuse. TutorConnect links to these materials but does not copy or redistribute them.

## Profiles and teaching resources

Students, tutors and administrators can edit a short bio and upload or replace a JPG, PNG or WebP profile photo (up to 5 MB). The profile editor previews a selected image before saving. Photos are stored in the private `profile-photos` bucket; owners and administrators can view them, and approved active tutor photos can appear in tutor search. Tutors may request approval for multiple courses. Approved tutors can publish separate paid files or HTTPS/YouTube links for each approved course; search groups those courses under one tutor profile and displays only resources linked to the matching course. Share only materials you own or are authorized to distribute; links are labeled by their source and are not represented as UCC resources unless verified.

External learning examples and the course library:

- MIT OpenCourseWare's [18.06 Linear Algebra](https://ocw.mit.edu/courses/18-06-linear-algebra-spring-2010/) includes lecture videos, problem sets, exams and solutions. Its [Spring 2005 video playlist](https://www.youtube.com/watch?v=J7DzL2_Na80&list=PLE7DDD91010BC51F8) is external course content, not a university lecturer's lesson.
- Harvard's [CS50x](https://cs50.harvard.edu/x/) provides public computer-science lectures and problem sets.
- The [UCC Library materials portal](https://library.ucc.edu.gh/FindMaterials) is a starting point for institution-accessible resources. A public, verified UCC past-question archive has not been identified.

Contact the administrators at [baidoomensahama@gmail.com](mailto:baidoomensahama@gmail.com), [0245664985](tel:0245664985), or [WhatsApp](https://wa.me/2332456698495).

## Trust and moderation

Students can search approved tutors, unlock private contact details through verified payment, review tutors after an unlock, and send private reports. Tutors can manage their profiles and request course associations. Administrators can review tutor and course requests, moderate reviews and reports, and inspect the audit log. Moderation actions require a reason and are recorded in `admin_actions`.

Contact details remain protected by row-level security. Payment, contact unlock and premium writes are handled by the Edge Function using the service-role key. The live Supabase project has migrations 004, 005 and 006 applied: 535 UCC admissions programmes are available, the public learning-resource table is created, and the assistant quota table exists. The `payments` and `student-assistant` Edge Functions are deployed. For Paystack test mode, set the callback URL to `https://127.0.0.1:5173/` for the current local preview and set the test webhook URL to `https://lenwoopmxlgzlymfbmfh.supabase.co/functions/v1/payments`. The callback used by checkout is also supplied dynamically by the app. The `payments` Edge Function is deployed with JWT verification disabled and validates Paystack's HMAC-SHA512 signature internally. Replace the local callback with the public HTTPS origin before launching to users.
