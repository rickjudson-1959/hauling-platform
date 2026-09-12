# Phase 1 gap audit

**Date:** 2026-09-09
**Repo:** `main` at `441e22c` (Ticket 8 invoicing). Compared against `docs/hauling-platform-phase1-tickets.md`.
**Live project:** Supabase `hauling-platform` (`upeiucqxepcrspjoikyo`), plus production on Vercel (Rick confirmed login + signup work).
**Scope:** audit only. No feature work. Ticket 10 (Stripe) is Fenrir-owned — status noted, not implemented.

**How status is scored**

| Status | Meaning |
| --- | --- |
| **SOLID** | Acceptance criteria met in the app (and usually proven by live data). Remaining notes are polish or repo-sync debt, not a blocked feature. |
| **THIN** | Feature exists and the happy path mostly works, but a criterion is stale, the guard is weaker than specified, or the SQL never landed in git. |
| **MISSING / BROKEN** | Not built, or clearly fails the ticket’s “done when”. |

---

## Snapshot

Live usage (counts only, no PII): 2 orgs, 3 memberships (`admin` + `driver`), 1 haul type (`litres`), 1 customer, 2 trucks, 1 job (`invoiced`, with photo + signature), 1 invoice (`sent`) with 1 line item and 2 audit rows.

`supabase/migrations/` history on the live project is **empty** — schema was pasted in the SQL Editor. The checked-in file `supabase/migrations/20260617000000_initial_schema.sql` is behind production (units, invoice extras, RPCs, storage).

GitHub **PR #1** (`cursor/fix-supabase-database-types-bd3f`, “Fix Vercel TypeScript build with generated Supabase types”) is still **OPEN**, not merged. `main` still has the placeholder `export type Database = Record<string, unknown>` in `src/shared/types/database.ts`. Do not treat that as already on the default branch.

Preview Deployment Protection is **not** an app bug.

---

## Ticket-by-ticket

### Ticket 1 — Database schema and RLS

**Acceptance:** migration with orgs, memberships, haul_types, customers, trucks, jobs, invoices, invoice_lines; RLS on every table; org-scoped via memberships; drivers can read/update only assigned jobs. Done when it runs in the SQL Editor and tables show RLS enabled.

**Status: SOLID** (original tables + RLS are live)

- Checked-in migration `supabase/migrations/20260617000000_initial_schema.sql` matches the build-spec tables and enables RLS.
- Live: all those tables exist with RLS on. Driver job policies `drivers can view/update their assigned jobs` are present.
- Helpers `my_org_id()`, `my_role()`, `my_membership_id()` exist (SECURITY DEFINER).

**Gaps (not Ticket 1 blockers, but they matter for later tickets):** live schema has drifted — `invoice_line_items`, `invoice_audit_log`, `invoice_number_seq`, extra invoice columns, `org_drivers` / `org_members` / `create_invoice` / `update_invoice_status` / `next_invoice_number`. Haul-type CHECK on live allows metric units; the repo file still lists only `gallons, loads, tons, cubic_yards, hours`. Leftover unused `invoice_lines` (0 rows) sits beside the real `invoice_line_items`. None of this is in git migrations. Supabase advisors also flag SECURITY DEFINER RPCs executable by `anon`.

---

### Ticket 2 — Org signup and auth wiring

**Acceptance:** signup (email, password, company name) creates auth user + org + admin membership; login wired to Supabase; `orgQuery` resolves org and scopes reads; after login land on dashboard. Second signup is a separate org.

**Status: SOLID**

- `src/features/auth/SignupPage.tsx` → `create-org` edge function (deployed, ACTIVE). Service-role work stays server-side. Client then `signInWithPassword` and `navigate('/dashboard')`.
- `src/features/auth/index.tsx` login is real Supabase auth; same dashboard redirect.
- `AuthContext` loads membership + org; `ProtectedRoute` gates session and `staffOnly` (drivers → `/driver`).
- `src/shared/utils/db.ts` `orgQuery` exists; unit tests in `src/shared/utils/db.test.ts`.
- Live: 2 orgs, 3 memberships — second-org isolation is in place at the data layer. Rick is inside the app.

**Notes (do not re-do signup):** not every later read uses `orgQuery` (invoicing, driver detail, team RPC). Convention leak, not a signup bug. Post-login dashboard is empty (Ticket 9).

---

### Ticket 3 — Haul types and trucks

**Acceptance:** settings for haul type name + unit; trucks list/add/edit (label, optional haul type, capacity, status). Done when a couple of types and trucks can be added and listed.

**Status: SOLID**

- Settings: `src/features/settings/index.tsx` — CRUD, units grouped Metric / Imperial / Other (`litres` default).
- Trucks: `src/features/trucks/index.tsx` — list/add/edit, org-scoped writes.
- Live: 1 haul type (`litres`) and 2 trucks. Live CHECK includes the expanded unit list; **repo migration does not**.

**Skip** unless Bob is syncing the migration file to the live CHECK.

---

### Ticket 4 — Customers

**Acceptance:** list/add/edit; fields name, contact, phone, email, billing address, notes; profile with job history and open balance (zero OK until invoicing).

**Status: THIN**

- `src/features/customers/index.tsx` and `CustomerProfile.tsx` cover list, add, edit, profile, job history. Live: 1 customer.
- Open balance is still hardcoded `$0.00` with copy **“Invoicing not yet enabled”** (`CustomerProfile.tsx`) even though Ticket 8 invoicing is live and this org has a `sent` invoice.

---

### Ticket 5 — Jobs

**Acceptance:** list with status + haul-type filters; add/edit; fields customer, haul type, site, schedule, quantity, price, truck, driver, status, notes; statuses scheduled → cancelled.

**Status: SOLID**

- `src/features/jobs/index.tsx` has the full form, filters, and status set.
- Driver dropdown via live RPC `org_drivers()` (not in the repo migration).
- Live: 1 job exists and has moved through to `invoiced`.

---

### Ticket 6 — Dispatch board

**Acceptance:** day or week view; trucks as columns; jobs as cards; drag onto a truck assigns truck and flips scheduled → assigned; color by status; filter by haul type.

**Status: SOLID**

- `src/features/dispatch/index.tsx` — day/week toggle, unassigned + truck columns, HTML5 drag-and-drop, optimistic update, haul-type filter, status colors.
- Week view is the same board filtered to Mon–Sun (date on cards), not a calendar grid. Still meets “day or week view”.

**Skip** unless someone wants touch/mobile dispatch or a true week calendar.

---

### Ticket 7 — Driver mobile view

**Acceptance:** today’s jobs for the logged-in driver only; tap to set en route / on site / completed, log quantity, photo, signature, notes; media in Supabase Storage. Mobile-first, big targets.

**Status: SOLID**

- `src/features/driver/index.tsx` + `JobDetail.tsx` — today’s `driver_id` list, large tap targets, no staff nav, camera + canvas signature, uploads to `job-media` at `{org_id}/{job_id}/…`.
- Live: `job-media` bucket exists (public); 1 job has both `photo_url` and `signature_url`. Storage policies allow authenticated upload; SELECT is public.
- Driver role exists on a membership; staff routes are `staffOnly`.

**Notes:** bucket/policies are not in git. Public bucket means anyone with the URL can see photos/signatures. `JobDetail` update is not `.eq('org_id')` (RLS still applies).

---

### Ticket 8 — Invoicing

**Acceptance:** pick a customer’s completed-uninvoiced jobs, generate invoice + line items, draft/sent/paid/void, mark sent/paid manually, jobs flip to `invoiced`. Watch: never invoice a job twice (hard guard); audit every invoice write.

**Status: THIN**

- UI is in `src/features/invoicing/index.tsx` + `InvoiceDetail.tsx`. Routes are `staffOnly`.
- Live objects exist and the happy path has been used: 1 `sent` invoice, 1 `invoice_line_items` row, unique `job_id`, 2 `invoice_audit_log` rows, job status `invoiced`.
- **SQL is not in the repo.** Ticket 8 commit only added React. Live RPCs are weaker than that commit message:
  - `create_invoice` inserts lines only for `status = 'completed'`, then sets **all** passed job IDs to `invoiced` (no exception if some are not completed). Double-invoice protection is the UNIQUE `job_id` on `invoice_line_items`, not a status-transition guard.
  - `update_invoice_status` does **not** enforce draft → sent → paid/void, and does **not** revert jobs to `completed` on void — but the UI confirm still says it will.
- Customer profile still pretends invoicing is off (Ticket 4).
- Dead table `invoice_lines` remains (0 rows).

---

### Ticket 9 — Dashboard

**Acceptance:** jobs today and this week, revenue, asset utilization (truck hours or loads), driver completion counts, total open invoice amount. Numbers must reflect real data.

**Status: MISSING / BROKEN**

```tsx
// src/features/dashboard/index.tsx
export default function DashboardPage() {
  return (
    <Layout>
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
    </Layout>
  )
}
```

Login and signup both `navigate('/dashboard')`, so every new session lands on an empty page. Live already has a job + sent invoice that these tiles should show.

---

### Ticket 10 — Stripe subscription gate — **FENRIR**

**Acceptance:** one flat monthly plan; no active subscription → billing screen instead of the app; Stripe secrets server-side only, never in the Vite client. Done when a new org hits a paywall, subscribes in Stripe test mode, then reaches the app.

**Status: MISSING (owned by Fenrir — do not implement here)**

- No Stripe dependency, Checkout/Customer Portal routes, webhook, or billing screen.
- No `stripe_*` columns on `orgs` (or any other table).
- Client env is only `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (`.env.example`). No Stripe secret in the Vite bundle today — keep it that way.
- `ProtectedRoute` only checks session + `staffOnly`, not subscription.

**Fenrir should own:** Stripe product/price (do not invent products in this repo), server-side checkout + webhook (Supabase Edge Function or Vercel Function — never `VITE_STRIPE_SECRET_*`), persist org subscription status server-side, gate `ProtectedRoute` / a `/billing` screen. Bob should not invent catalog or ship a fake paywall.

---

## Status table

| Ticket | Name | Status | One-line evidence |
| --- | --- | --- | --- |
| 1 | Schema + RLS | **SOLID** | Live tables + RLS match spec; repo migration is the original paste and is now stale vs live extras. |
| 2 | Org signup + auth | **SOLID** | `create-org` + login + `orgQuery` + `/dashboard` redirect; 2 live orgs; Rick is in the app. |
| 3 | Haul types + trucks | **SOLID** | Settings + trucks CRUD; live 1 type + 2 trucks. |
| 4 | Customers | **THIN** | CRUD + profile + job history; open balance still `$0` / “Invoicing not yet enabled”. |
| 5 | Jobs | **SOLID** | Full list/add/edit + filters; live job present. |
| 6 | Dispatch board | **SOLID** | Day/week columns, DnD assign, status color, haul filter. |
| 7 | Driver mobile | **SOLID** | Today’s jobs + status/qty/photo/sig; live job has photo + signature; `job-media` exists. |
| 8 | Invoicing | **THIN** | Happy path works live; SQL not in git; void does not restore jobs; invoice RPC guards are weaker than advertised. |
| 9 | Dashboard | **MISSING / BROKEN** | Title-only placeholder; this is the post-login home. |
| 10 | Stripe gate | **MISSING** | **Fenrir.** No billing code or schema. Do not invent Stripe products. |

---

## Already solid — skip

Do **not** rebuild these unless a specific bug is reported:

- Signup / login / org membership / driver vs staff routing
- Haul types and trucks screens
- Jobs CRUD and filters
- Dispatch day/week board + drag-assign
- Driver mobile happy path (list, status, photo, signature)
- Invoice generate + mark sent (already used in production)

Also skip: inventing Stripe products, a fake paywall, or treating Vercel preview protection as an app defect.

---

## Top 5 gaps for Bob (highest impact first)

1. **Build Ticket 9 dashboard against real data.** Highest user-facing hole: login already dumps people on `/dashboard`, and live data (today/week jobs, invoiced revenue, open invoice total, driver completions, truck utilization) is sitting unused. Org-scope every query. No Stripe.

2. **Backfill git migrations from live (schema sync).** Ticket 8+ SQL, metric unit CHECK, `org_drivers` / `org_members`, storage `job-media` + policies never landed in `supabase/migrations/`. Live `supabase_migrations` is empty. Until this is captured, a new environment cannot recreate production and PR #1 types will keep drifting.

3. **Harden Ticket 8 invoicing (no new product).** Make `create_invoice` reject non-completed / already-lined jobs (don’t flip extras to `invoiced`). Make `update_invoice_status` enforce transitions and **actually revert jobs on void** (UI already claims this). Wire customer open balance to sent-unpaid invoices. Optionally drop unused `invoice_lines`.

4. **Land PR #1 (generated `Database` types) on `main`.** Still open. `main` cannot type-check inserts/RPCs against the placeholder. Needed so Vercel `tsc -b` on the default branch matches the live schema. Not a product ticket, but it blocks clean deploys.

5. **Tighten storage + RPC grants (security, not a new screen).** `job-media` is a public bucket; prefer org-scoped authenticated read. Revoke `anon` EXECUTE on SECURITY DEFINER RPCs (`create_invoice`, `update_invoice_status`, `org_members`, …). Drivers can currently call invoice RPCs via PostgREST even though the UI is `staffOnly`.

**Out of scope for Bob:** Ticket 10 Stripe catalog, Checkout, webhooks, paywall — Fenrir.

---

## Cross-cutting notes

| Item | Detail |
| --- | --- |
| Tests | Vitest covers `orgQuery`, `AuthContext`, `ProtectedRoute` only (~11 tests). No feature tests for jobs, dispatch, driver, invoicing, dashboard. `staffOnly` driver redirect is untested. |
| `orgQuery` convention | Ticket 2 watch is not applied uniformly (invoicing uses raw `.from().eq('org_id')`; driver detail is RLS-only). |
| README | Still the Vite template — not useful for operators. |
| No Stripe secrets in client | Confirmed. Keep it that way when Fenrir adds billing. |

---

## Suggested next tickets (for Bob, in order)

1. Dashboard (Ticket 9) — real tiles, org-scoped.
2. Pull live schema into dated migrations (copyable SQL, do not auto-apply) + merge PR #1 types.
3. Invoice RPC + void + customer balance fix.
4. Storage / GRANT hygiene.

Then Fenrir: Ticket 10.
