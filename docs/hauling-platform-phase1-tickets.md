# Hauling Platform: Phase 1 Tickets

How to use this: paste one ticket into Claude Code, let it build, review what it did, commit and push, then paste the next. Do not paste two at once. The order matters because each ticket builds on the one before it.

Before Ticket 1: add the build spec to the repo so Claude Code can read it. Drop `hauling-platform-build-spec.md` into a `docs/` folder, commit, and push. Then start below.

---

## Ticket 1: Database schema and RLS
Goal: create every table the app needs, with row-level security scoping data to each org.

Build:
- Create a Supabase migration with the full schema from docs/hauling-platform-build-spec.md: orgs, memberships, haul_types, customers, trucks, jobs, invoices, invoice_lines.
- Enable RLS on every table.
- Add a policy on each table so a row is visible only when its org_id is in the caller's orgs (via the memberships table for the current auth user).
- Drivers can read and update only jobs where they are the assigned driver.

Done when: the migration runs clean in the Supabase SQL Editor and the tables show up with RLS enabled.

Watch: deliver the migration as plain copyable text so I can paste it into the Supabase SQL Editor myself. Do not auto-run it.

---

## Ticket 2: Org signup and auth wiring
Goal: a real signup that creates an org and makes the signer its admin, plus working login.

Build:
- Signup flow: user enters email, password, and company name. On submit, create the auth user, create an org with that company name, and create a membership row linking the user to the org with role admin.
- Wire the existing AuthContext and login page to real Supabase auth.
- Make the orgQuery helper resolve the current user's org_id and scope all reads to it.
- After login, land the user on the dashboard page.

Done when: I can sign up a new company, get logged in, and the app knows my org. A second signup creates a separate org that cannot see the first one's data.

Watch: every data read from here on goes through orgQuery. No unscoped queries.

---

## Ticket 3: Haul types and trucks
Goal: let an org set up its haul types and its trucks, since jobs depend on both.

Build:
- Settings screen to manage haul types: name plus unit of measure (gallons, loads, tons, cubic yards, hours).
- Trucks page: list, add, edit. Each truck has a label, an optional haul type, a capacity, and a status (available, in use, maintenance, out of service).

Done when: I can add a couple of haul types (for example Water Delivery in gallons) and a couple of trucks, and see them listed.

Watch: org-scope everything. A truck belongs to one org only.

---

## Ticket 4: Customers
Goal: manage the customers who request hauls.

Build:
- Customers page: list, add, edit.
- Fields: name, contact name, phone, email, billing address, notes.
- Customer profile view showing their job history and open balance (balance can read zero for now until invoicing exists).

Done when: I can add a customer and open their profile.

---

## Ticket 5: Jobs
Goal: create and manage hauls.

Build:
- Jobs page: list with filters by status and haul type, plus add and edit.
- A job has: customer, haul type, site address, scheduled date and time, quantity, price, assigned truck, assigned driver, status, notes.
- Status starts at scheduled and can move through assigned, en route, on site, completed, invoiced, cancelled.

Done when: I can create a job, assign a truck and driver, and see it in the list.

---

## Ticket 6: Dispatch board
Goal: the day-to-day screen where a dispatcher assigns jobs to trucks.

Build:
- A day or week view with trucks as columns and jobs as cards.
- Drag a job onto a truck to assign it (assigning sets the truck and flips status to assigned).
- Color the cards by status. Filter by haul type.

Done when: I can see today's jobs, drag one onto a truck, and the assignment sticks.

---

## Ticket 7: Driver mobile view
Goal: the phone screen a driver uses in the truck.

Build:
- Shows only today's jobs assigned to the logged-in driver.
- Tap a job to set status (en route, on site, completed), log the actual quantity, add a photo, capture a signature, and add notes.
- Photos and signatures save to Supabase Storage.

Done when: logged in as a driver, I see only my jobs and can mark one complete with a photo and signature.

Watch: mobile-first, big tap targets, has to work one-handed.

---

## Ticket 8: Invoicing
Goal: turn completed jobs into an invoice.

Build:
- For a customer, select their completed-but-uninvoiced jobs and generate an invoice with line items.
- Invoice has draft, sent, paid, void states. Mark sent and mark paid manually for now.
- Generating an invoice flips those jobs to status invoiced.

Done when: I can pick a customer's completed jobs, generate an invoice, and the jobs show as invoiced.

Watch: a job must never get invoiced twice. Hard guard on the transition to invoiced. Audit-log every invoice write.

---

## Ticket 9: Dashboard
Goal: the at-a-glance home screen.

Build:
- Jobs today and this week, revenue, asset utilization (truck hours or loads used), driver completion counts, and total open invoice amount.

Done when: the numbers reflect the real data I have entered.

---

## Ticket 10: Stripe subscription gate
Goal: each org pays a monthly subscription to use the app.

Build:
- One Stripe plan to start (flat monthly).
- After signup, an org must have an active subscription to reach the app. No active subscription means a billing screen instead.
- Stripe keys live server-side only, never in the client bundle.

Done when: a new org is sent to a paywall, can subscribe through Stripe test mode, and then reaches the app.

Watch: keep the Stripe secret key out of the VITE bundle. Server-side only.

---

That is all of Phase 1. After Ticket 10 you have a working app: companies sign up, pay, set up trucks and customers, dispatch jobs, drivers run them from a phone, and you invoice and see the numbers. Phase 2 (customer online payment, recurring jobs, customer portal) comes after this is solid.
