Original prompt: in admi npanel access not allowed Firebase: Error (auth/operation-not-allowed). also in citizen add email and pass login and signup

- Investigating Firebase auth failures and extending citizen auth beyond Google-only.
- Added clearer Firebase auth error messages, including a specific message for `auth/operation-not-allowed` when Email/Password or Google providers are disabled.
- Added citizen Email/Password sign-up and sign-in flow while keeping Google sign-in available.
- Admin flow now reports Firebase Email/Password provider problems more clearly instead of failing with the raw Firebase message.
- Fixed the default admin password constant to a 6+ character value so Firebase Email/Password account creation no longer fails validation on first login.
- Verification: `pnpm exec tsc --noEmit` passed.
- Verification gap: `pnpm lint` could not run because `eslint` is not installed in this workspace.
- Verification gap: `pnpm build` is blocked by network-restricted Google Fonts fetches, unrelated to the auth changes.
- Next suggestion: enable Email/Password in Firebase Authentication for project `community-portal-5d362`, or admin and citizen email login will still fail with the new clearer message.

## 2026-04-02 Redesign Track

- Current redesign prompt: Revamp the entire portal into a professional Indian national community portal, replace the 100-upvote escalation flow with direct routing to local administration, switch feed ranking to like/dislike, improve location indexing, add credit-coin rewards for citizens and government workers, and significantly improve all three dashboards.
- Read `.codex/SKILL.md` and `.codex/mistakes.md` before starting. Relevant watch-outs: preserve stepwise execution, keep progress logged, and avoid assuming the current theme wiring works because `next-themes` is present but not mounted in the app shell.
- Audit findings:
- `app/layout.tsx` does not mount the shared theme provider, so the navbar theme toggle is effectively broken.
- Global tokens in `app/globals.css` explicitly implement a Reddit-like palette and interaction language.
- `lib/db.ts` still models post escalation around `upvotes >= 100`, and `components/HomePage.tsx`, `components/ReportedPostsPage.tsx`, and `components/PostCard.tsx` all encode that threshold in the UI.
- The current post model only stores a loose `location` string, so there is no strong jurisdiction indexing for state/district/local routing.
- Execution plan:
- Step 1: Refactor the shared data model for direct administration routing, richer location indexing, and like/dislike driven ranking with backward compatibility.
- Step 2: Rebuild the global design system and app shell into an India-focused government portal aesthetic, including a working theme toggle.
- Step 3: Redesign the citizen experience around complaint filing, top-feed discovery, status tracking, and credit-coin rewards.
- Step 4: Redesign the authority and admin dashboards around routed complaints, performance metrics, approvals, and rewards.
- Step 5: Verify with typecheck/build and document any environment blockers.
- Completed:
- Added `lib/portal.ts` and refactored `lib/db.ts` so complaints are routed to administration on creation, support structured location metadata, use like/dislike reactions, and track credit coins plus redemptions.
- Rebuilt the app shell in `app/layout.tsx` and `app/globals.css`, mounted `ThemeProvider`, and replaced the old Reddit-inspired palette with a more formal Indian government portal aesthetic.
- Reworked `components/Navbar.tsx`, `components/HomePage.tsx`, `components/ReportedPostsPage.tsx`, `components/GovernmentDashboard.tsx`, `components/AdminDashboard.tsx`, `components/TokenWallet.tsx`, `components/Leaderboard.tsx`, `components/WallOfWins.tsx`, `components/PostCard.tsx`, `components/CreatePostForm.tsx`, and `components/AuthPage.tsx`.
- Verification:
- `pnpm exec tsc --noEmit` passed for the redesign branch.
- `pnpm build` failed under Turbopack with a sandbox/process-port error while processing `app/globals.css`, but `pnpm exec next build --webpack` passed successfully.
- Remaining gap:
- Browser screenshot validation is still pending because Playwright is not installed/available in this workspace at the moment.
- Verification: pnpm exec tsc --noEmit passed for the redesign branch.
- Verification: pnpm build failed under Turbopack with a sandbox/process-port error while processing app/globals.css, but pnpm exec next build --webpack passed successfully.
