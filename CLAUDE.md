# Noolagam – Personal Book Tracker

Noolagam (நூலகம்) means "library" in Tamil. A multi-user app to track the books people own and read, with one React codebase for web and Android. This is a public resume project: code quality, tests, documentation and commit history matter as much as features.

The full requirements are in [docs/SPEC.txt](docs/SPEC.txt): functional and non-functional requirements, schema, API, screens, folder structure and phases. Read the relevant section before building a feature.

The mockups are at https://claude.ai/artifact/775XGwPuNp5CxbVfPLz1tQ (Design canvas, "Noolagam App Screens"). The spec decides behaviour; the mockups decide visual details.

## Working agreement

- Build one agreed step at a time. Stop after each step and wait for confirmation before starting the next.
- After each step, explain what was built, the key decisions, and exactly how to run and test it.
- Suggest a Conventional Commits message after each step. Only commit when asked.
- Never commit secrets. Keep `.env.example` up to date.
- Use current, non-deprecated APIs: SQLAlchemy 2.0 style, Pydantic v2, FastAPI lifespan, React 18 + TypeScript strict.
- If a requirement is unclear or conflicts with another, ask before building.

## Build order

The owner changed the order from section 16 of the spec: frontend screens come first, one at a time.

1. Login page (done)
2. Sign up and Forgot password pages (done)
3. Backend for login, registration and password reset, plus the Reset password page (done)
4. Dashboard (Home) with its backend, session handling, email verification and a basic Profile page (done)
5. Add book with ISBN lookup and background enrichment (done)
6. My books and Book details, with search, filters, edit, delete, notes and reset (done)
7. Stats, with Redis caching (done)
8. Profile: edit name and change password (done)
9. Email verification removed at the owner's request (done)
10. README with diagrams, screenshots and tested commands (done). Update its Status, Roadmap and test counts as things change.
11. Android APK with Capacitor, tested in an emulator (done; not yet on a physical phone).
12. Cover photo upload on Add book and Edit, on the web and Android (done; tested in an Android 15 emulator, not yet on a physical phone).
13. Home titled "Noolagam", an About section, and days taken per book (done; tested on the web and in the emulator).

Every screen and feature in the spec now exists. Not built yet: JSON logging and tracing, Beat cleanup of old tokens, the rest of `cli.py`, PWA, the production frontend image, GitHub Actions, hosting. The next step has not been agreed yet. The spec's phases remain the checklist of what has to exist in the end.

## Decisions that refine the spec

Security and stack:
- Use `bcrypt` directly instead of `passlib`, which is unmaintained. Use PyJWT, and `uvicorn-worker` for Gunicorn.
- Password rule everywhere: at least 8 characters and at most 72 bytes. The mockup's "number or symbol" line is dropped.
- The web refresh cookie needs a same-site deployment: Nginx proxies `/api` so frontend and API share one origin. Cookie settings come from env. Android gets the refresh token in JSON.
- Change password also logs out other sessions, starts a new session for this device and cancels unused reset links. A wrong current password is 400, not 401, because the app reads 401 as an expired session. It is rate limited per IP and email. Reusing a refresh token revokes all of the user's sessions, and the web app locks refreshes so two tabs cannot trigger this by accident.
- Android: requests send `X-Client-Type: native`, and login, register and change-password then return the refresh token in the body, with no cookie, because the app stores it with `@capacitor/preferences`. `/auth/refresh` and `/auth/logout` take it in the body. A cookie alone never returns a token in the body, or a script in a browser could read what the cookie hides. `allowBackup` is off, so the token is not copied to cloud backups.
- Android build: `http://` is allowed, with `androidScheme: http`, only when `VITE_API_URL` is `http://`, for testing on Wi-Fi. `build-apk.sh` keeps the debug signing key in the `noolagam-gradle-cache` volume, because Android refuses to update an app signed with a different key. Deleting that volume means uninstalling the app once.
- Android Back: `androidBackButton.ts` uses `@capacitor/app`, without which Back closes the app. WebView's `canGoBack` can be false when there are screens to return to, so it also checks React Router's `history.state.idx`.
- Logout authenticates with the refresh token, so an expired access token cannot block it.
- Email verification does not exist: the owner removed it, overriding FR-2, the Verify email screen, the Home banner, `users.is_verified`, `/auth/verify-email`, `/auth/resend-verification` and `send_verification_email` in docs/SPEC.txt. Password reset emails stay. Do not add verification back unless asked.
- `POST /auth/register` returns the same token response as login and sets the refresh cookie, so a new user goes straight to Home.
- `POST /auth/reset-password` returns 204, and 400 `INVALID_RESET_TOKEN` for an unknown, expired or used link. Requesting a new link cancels the previous one.
- A refresh token from before a password reset gets a plain 401. It must not count as reuse, or a stale device would log out the session created after the reset.
- The reset token is created in the Celery task, so the raw token never passes through Redis. The task is queued after the response, so timing does not reveal whether an email is registered.
- Rate limits fail open if Redis is down. Failed-login timing is equalised with a dummy bcrypt check.
- Session: the app calls `/auth/refresh` on load, because the access token lives in memory. Refreshes are shared within a tab and serialised across tabs with `navigator.locks`, since a replayed token revokes every session. `navigator.locks` needs HTTPS or localhost, so several tabs over plain `http://` on the LAN can still trigger this.
- Only a 401 from `/auth/refresh` ends the session; a network failure keeps it. The React Query cache is cleared when a session ends.
- In development the browser calls the same origin and the Vite proxy forwards `/api`, so laptop and phone both work without CORS or env changes. This mirrors the planned Nginx setup.

Reading flow:
- Add, start, finish and edit accept an optional date, defaulting to the user's local today. This allows backfilling old books and avoids UTC date errors.
- Status changes only happen through the action endpoints, never `PATCH`. `/start` on a finished book and `/progress` on a book that is not being read return 409. Calling `/finish` again only updates the rating.
- Lowering `page_count` below `current_page` is rejected. Enrichment skips a page count lower than `current_page` and invalidates the stats cache.

API additions:
- `GET /books/facets` returns the values for the Author and Gifted by filters.
- `/search` takes the same filters and pagination as `/books`.
- `/books/counts` includes the gift count.
- `POST /books` accepts `cover_url` and `description` from a lookup.
- `/stats` adds `available_years` and returns all 12 months. Top authors covers the selected year, up to 5; gifted-by is all-time. Pages read sums `page_count` of books finished that year, and unknown page counts add 0.
- `avg_days_per_book` leaves out books started and finished on the same day, because that means the dates were not tracked, such as a book added long after it was read. It is null if no book qualifies.
- The stats cache key contains a per-user version number, and invalidating increments it. A calculation that overlaps a change saves under the old version, where nothing reads it, so stale stats cannot be cached. Entries last 1 hour; a Redis outage only skips the cache. Updating the current page does not invalidate, as stats only count finished books. Every other book change does, including enrichment and `seed-books`.

Schema:
- Extra indexes: `(user_id, finished_at)`, `(user_id, title)`, `refresh_tokens.user_id`. Extra check: `page_count > 0`.
- Known quirk: check constraints in the database have doubled names such as `ck_books_ck_books_status`, because the migrations passed full names and Alembic applied the naming convention again. They are enforced correctly. Keep the existing names when referring to them, and use `op.f("name")` for new constraints.

Background and search:
- Celery tasks run async code with `asyncio.run` and a `NullPool` engine. Enqueue after commit; a Redis outage must not fail the request.
- Open Library title and author matches must be close, to avoid wrong covers: at least 0.9 similarity on the title, and any numbers in it must match, so "Part 1" never matches "Part 2".
- ISBN lookup calls both `/search.json?isbn=` and `/api/books` and combines them. Edition data is often missing the author, pages or cover; search data can have the title of the original work in another language ("O Alquimista").
- ISBNs are normalised and checksum-validated on both client and server.
- Search uses the `simple` config, with the last word matched as a prefix. Tamil text is tested and works: whole words, several words and prefixes all find the right book.
- Jaeger is an optional Compose profile.

Cover photos:
- `POST /books/{id}/cover` takes one multipart file, `photo`. `cover_files.process` rebuilds it as a JPEG of at most 1200 px, turned upright, which strips EXIF including GPS. Only JPEG, PNG and WebP are accepted, judged from the content. HEIC is not supported, to avoid another native dependency.
- Android: "Take photo" needs the `IMAGE_CAPTURE` entry under `<queries>` in the manifest. Without it, Android 11+ hides the camera app from Capacitor, which silently opens the picker. `CoverPhotoPicker` reads the chosen file into memory, because the first photo picked on a newly set-up device failed to display when read directly (seen twice, fine after this change and on later picks; the cause inside Android wasn't identified).
- Files live in `MEDIA_DIR` (the `uploads` Compose volume) under random names. `cover_url` holds a relative `/api/v1/media/covers/<name>.jpg`, which `Cover` prefixes with `VITE_API_URL` because the Android app's pages aren't at the API's address.
- `GET /media/covers/{name}` needs no login, since `<img>` can't send a bearer token. The unguessable name is what keeps a photo private. A new photo always gets a new name, so the response can be cached for a year.
- `RequestSizeLimitMiddleware` refuses large and chunked requests before reading them, as FastAPI saves a whole form to disk before it runs the route's login and size checks. It runs inside CORS so the app can read the error.
- Add book saves the book first, then uploads. A failed upload is not a failed save: the book stays, the form clears, and the message links to Edit, as saving again would add a duplicate.
- Replacing a photo or deleting the book deletes the file, after the commit. Enrichment only fills empty fields and re-reads under a lock, so it can't replace a photo. `POST /books` still only accepts `https://` covers, so a client can't point a book at another user's file.
- There is no way to go back to having no cover yet, only to replace it.
- Real email is set with `SMTP_*`, `EMAIL_FROM` and `FRONTEND_URL` in the root `.env`, which Git ignores; `.env.example` documents them. All blank means Mailpit. Run `docker compose up -d` to apply changes, because `restart` does not reread `.env`. Connections use STARTTLS with certificate checking, so port 465 is not supported.

UI:
- Home is titled "Noolagam", not the spec's and mockup's "Your bookshelf", at the owner's request.
- Profile has an About section with the description, version, developer, contact email and copyright notice, all kept in `frontend/src/appInfo.ts`. The owner chose to publish that address, in the app and in this public repository. The version comes from `frontend/package.json` through Vite's `define`, so it has one source. `versionName` in `frontend/android/app/build.gradle` is separate, so change both for a new version.
- Days taken are worked out on the client, because "today" must be the user's local date. They count like the Stats average: finish date minus start date. A finished book with the same start and finish date says "Started and finished the same day", never "Read in a day", because a book added as already finished has only one date. Book rows leave out a length of 0.
- Home gets an "Up next" section with up to 3 to-read books and a Start button, to meet NFR-26.
- Profile is reached from an avatar in the mobile header and the bottom of the laptop sidebar.
- Book detail also shows description, rating and ISBN.
- On phones the compact Currently reading cards also have Update page and Mark finished buttons, unlike the mockup, because NFR-26 needs both within 2 taps for every book.
- The Stats page is lazy-loaded, because Recharts is about 100 KB compressed. The chart is hidden from screen readers, which get the same values from a visually hidden table. Bars show their value as the spec asks, except for empty months. Months are three letters, or single letters below 360 px where three letters touch.
- Saving on Add book stays on the page with a confirmation, unlike the mockup's jump to My books, so that several books can be entered in a row.
- My books keeps its filters in the URL, so Back from a book restores them. Status tabs show a count on every tab, stacked under the label, because FR-25 asks for counts and they don't fit on one line on phones. The counts are for the whole library, not the current search.
- Filter chips are native dropdowns, 44 px tall rather than the mockup's 36 px, because a dropdown cannot have a separate tap area.
- Book detail and Edit have a back button instead of the phone's bottom bar, as in the mockup. Edit is its own page, `/books/:id/edit`, and can correct reading dates and the description.
- Notes save when the field loses focus. Moving back to To-read asks for confirmation because it clears dates, progress and rating. Notes stay.
- API messages for 4xx responses are written for people, and `apiErrorMessage` shows them. It never shows the text of a 5xx.
- Editing the title, author or ISBN queues enrichment again. It still only fills empty fields, so a corrected ISBN does not replace an existing wrong cover.
- Add book shows a date field for Reading and Finished, plus an optional rating for Finished, so old books can be backfilled.
- Controls drawn smaller than 44 px get a larger tap area with a pseudo-element, which must not overlap neighbouring inputs.

## Commands

The host has no Node, so everything runs in containers.

```bash
# Whole stack: app http://localhost:5173, API docs http://localhost:8000/docs, emails http://localhost:8025
docker compose up -d --build

# Backend checks (from the repo root). pytest uses a separate noolagam_test database and Redis db 15.
docker compose run --rm api sh -c "ruff check . && ruff format --check . && mypy app && pytest"

# Frontend checks (from frontend/)
docker run --rm --user 1000:1000 -e HOME=/tmp -v "$PWD":/app -w /app node:22-alpine \
  sh -c "npm run -s typecheck && npm run -s lint && npm run -s test && npm run -s build"
```

The worker does not auto-reload: run `docker compose restart worker` after changing task or email code. After adding a frontend dependency, run `docker compose restart frontend`.

To build the Android app (Java and the Android SDK are in Docker): `frontend/build-apk.sh http://<computer-address>:8000`. The result is `apk/noolagam-debug.apk`, which Git ignores. `frontend/android/` is committed, apart from its build output.

To add sample books to an account: `docker compose exec api python -m app.cli seed-books you@example.com`
