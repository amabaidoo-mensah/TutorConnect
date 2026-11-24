# TutorConnect

React, TypeScript, Supabase and Paystack prototype.

## Local setup

1. Run `npm install`.
2. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. Run migrations `001_schema.sql`, `002_academic_units_and_moderation.sql`, `003_profiles_and_tutor_resources.sql`, `004_academic_programmes.sql`, `005_verified_courses_and_resources.sql`, `006_student_assistant_quota.sql`, and `007_tutor_resource_course_associations.sql` in order in the Supabase SQL editor. Migration 005 creates the source-labelled learning-resource table; migration 007 lets tutor resources be linked to approved courses.
4. Promote a trusted account to administrator: `update profiles set role='admin' where id='<uuid>';`.
5. Start the app with `npm run dev`.

The interface can be previewed without Supabase credentials, but authentication and data-backed screens require a configured Supabase project. For payments, deploy `supabase/functions/payments` and configure the Paystack secret and webhook in test mode.

## Tutor plans and verification

Approved tutors can purchase a monthly or semester listing from the tutor dashboard. The blue TutorConnect check appears only when the tutor application is approved and `premium_until` is still in the future. The plan is activated by the server only after Paystack verifies the transaction; the browser cannot grant the badge or unlock contacts by itself. Configure the Paystack **secret test key** as the `PAYSTACK_SECRET` Supabase Edge Function secret and deploy `supabase/functions/payments` before testing checkout. Never put the secret key in a `VITE_` variable or browser code.

## Student AI assistant

The floating student assistant uses Gemini through the `student-assistant` Supabase Edge Function. It can answer general and academic questions across subjects, explain concepts, work through steps, prepare study plans and help with TutorConnect. AI chat requires an active signed-in account; the email, phone and WhatsApp support links remain available to everyone. The Gemini key is read only by the Edge Function and must never be added to a `VITE_` variable or browser code.

To enable AI chat:

1. Apply `006_student_assistant_quota.sql` after migrations 001–005.
2. Create a Gemini API key in Google AI Studio and add it as the `GEMINI_API_KEY` Edge Function secret in the Supabase project settings. Do not commit the key or share it in chat.
3. Deploy the function with `supabase functions deploy student-assistant`.

The function enforces per-user request limits and bounds message size and response length. Gemini's free-tier availability and quotas are controlled by Google and can change; when the provider quota is reached, the assistant displays an error and students can still contact the administrators directly.

## Validation

- `npm run build` type-checks and builds the application.
- `npx playwright install chromium` installs the browser for the UI tests.
- `npm run test:e2e` runs the sign-in/sign-up, catalogue-error, course-resource-library, and mobile-layout browser checks. If Chromium cannot be downloaded and Chrome is already installed, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to that browser executable path before running the tests.

## Academic catalogue

UCC's public resources list colleges, faculties/schools, departments and admissions programmes:

- https://academics.ucc.edu.gh/colleges
- https://academics.ucc.edu.gh/faculties.schools
- https://academics.ucc.edu.gh/departments
- https://admissions.ucc.edu.gh/catalogue/departments

The admissions catalogue describes degree programmes, not semester course units. Official semester course-unit lists with verifiable codes and academic-unit mappings have not yet been established for UCC, the University of Ghana (Legon), or KNUST, so no course-unit seed data is included. Add courses only after confirming the code, title, academic unit and source URL against an official course outline or teaching schedule. Course and tutor search are grouped by their academic unit.

The signed-in and public-facing programme catalogue is separate from tutor course search. Migration 004 imports the 535 active programmes currently listed on UCC's official admissions catalogue, including the programme title, award, level, offering unit, and source link. The catalogue's departments page reports a slightly different programme count; each imported entry comes from an individual official programme listing. College and school labels are included only where the admissions catalogue supplies that relationship. This data does not represent semester course units or course codes.

The public **Courses & resources** library is separate from tutor profiles. Migration 005 creates its source-labelled resource table, but it does not seed course units or materials: verified official course outlines and lawful, course-matched materials are still needed. External videos, notes and open textbooks must not be represented as a university lecturer's own teaching or endorsement. Past papers should be listed only when an official, public archive is verified; open practice materials should be labeled separately. The catalogue remains empty until its course records can be sourced accurately.

## Profiles and teaching resources

Students, tutors and administrators can edit a short bio and upload or replace a JPG, PNG or WebP profile photo (up to 5 MB). The profile editor previews a selected image before saving. Photos are stored in the private `profile-photos` bucket; owners and administrators can view them, and approved active tutor photos can appear in tutor search. Tutors can add HTTPS links to teaching videos, course materials and past questions. Share only materials you own or are authorized to distribute; links are labeled by their source and are not represented as UCC resources unless verified.

External learning examples and the course library:

- MIT OpenCourseWare's [18.06 Linear Algebra](https://ocw.mit.edu/courses/18-06-linear-algebra-spring-2010/) includes lecture videos, problem sets, exams and solutions. Its [Spring 2005 video playlist](https://www.youtube.com/watch?v=J7DzL2_Na80&list=PLE7DDD91010BC51F8) is external course content, not a university lecturer's lesson.
- Harvard's [CS50x](https://cs50.harvard.edu/x/) provides public computer-science lectures and problem sets.
- The [UCC Library materials portal](https://library.ucc.edu.gh/FindMaterials) is a starting point for institution-accessible resources. A public, verified UCC past-question archive has not been identified.

Contact the administrators at [baidoomensahama@gmail.com](mailto:baidoomensahama@gmail.com), [0245664985](tel:0245664985), or [WhatsApp](https://wa.me/2332456698495).

## Trust and moderation

Students can search approved tutors, unlock private contact details through verified payment, review tutors after an unlock, and send private reports. Tutors can manage their profiles and request course associations. Administrators can review tutor and course requests, moderate reviews and reports, and inspect the audit log. Moderation actions require a reason and are recorded in `admin_actions`.

Contact details remain protected by row-level security. Payment, contact unlock and premium writes are handled by the Edge Function using the service-role key. The live Supabase project now has migrations 004, 005 and 006 applied: 535 UCC admissions programmes are available, the public learning-resource table is created, and the assistant quota table exists. The `payments` Edge Function is deployed and the `PAYSTACK_SECRET` server secret is configured. Gemini setup is intentionally disabled until the user supplies a valid Gemini key and approves deployment. For Paystack test mode, set the callback URL to `https://127.0.0.1:5173/` for the current local preview and set the test webhook URL to `https://lenwoopmxlgzlymfbmfh.supabase.co/functions/v1/payments`. The callback used by checkout is also supplied dynamically by the app. The `payments` Edge Function is deployed with JWT verification disabled and validates Paystack's HMAC-SHA512 signature internally. Replace the local callback with the public HTTPS origin before launching to users.
