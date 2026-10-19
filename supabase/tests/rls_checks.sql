-- Manual RLS checklist (run with service role to create users, then as each JWT)
-- Expected: all assertions pass. Document results in CI notes.

-- 1. Anonymous denied
-- set role anon; select * from households; → 0 rows / permission denied

-- 2. Employer accesses own household only
-- 3. Employer cannot access another household
-- 4. Helper reads assigned household tasks
-- 5. Helper cannot become employer (update role blocked / no policy)
-- 6. Helper cannot delete tasks
-- 7. Removed helper loses access (status=removed → is_active_member false)
-- 8. Expired invite rejected (accept_household_invite)
-- 9. Used invite cannot be reused
-- 10. Guessed household UUID returns no data
-- 11. Helper cannot change household_id (guard trigger)
-- 12. Users cannot list all households / invites

-- Automated helper via SQL (requires test helpers):
-- See scripts/rls-smoke.mjs for JWT-based checks against the REST API.

-- ---------------------------------------------------------------------------
-- Task preset library RLS (13–19)
-- ---------------------------------------------------------------------------
-- 13. Authenticated can select active system presets
-- 14. Authenticated cannot insert/update/delete system presets
-- 15. Employer can insert household preset for own household
-- 16. Helper cannot insert/update/delete household presets
-- 17. Employer cannot read another household's presets
-- 18. Favourites: employer insert/delete; helper select only
-- 19. Usage: employer insert; members select; no cross-household
-- See scripts/rls-smoke.mjs for REST checks when tokens available.

-- ---------------------------------------------------------------------------
-- Phase 1 batch creation (20–26)
-- ---------------------------------------------------------------------------
-- 20. create_tasks_from_presets requires employer/owner (NOT_AUTHORIZED otherwise)
-- 21. Atomicity: invalid second item → zero new occurrences/templates/usage
-- 22. Idempotency: same key+hash returns replayed; no duplicate rows
-- 23. Same key different hash → DUPLICATE_REQUEST
-- 24. INVALID_ASSIGNEE for non-active-helper / cross-household
-- 25. BATCH_LIMIT_EXCEEDED for >20 items
-- 26. task_creation_batches: anon denied; members select own HH only; no delete policy
-- See docs/PHASE1_BATCH.md and scripts/phase1-sql-smoke notes (run via Supabase SQL with JWT claims).
