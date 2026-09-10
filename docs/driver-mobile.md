# Driver phone app

The driver path is the same web app, not a separate App Store app. Drivers sign in and use **My Jobs** at `/driver`.

## Invite a driver (office)

1. Sign in as an admin.
2. Open **Settings** and find **Team**.
3. Invite with the **Driver** role.
4. If they are new, copy the invite link and send it to them (text or email). They open the link, set a password, and land on My Jobs.
5. If they already have an account, tell them to sign in with that email. The app sends them to My Jobs.

Assign jobs to that driver from **Jobs** or **Dispatch**. They only see jobs assigned to them for today.

In the Supabase dashboard, add `https://<your-domain>/set-password` to Auth redirect URLs so the invite link can return here.

## Sign in as a driver

1. Open the app URL (or the home screen icon).
2. Sign in with the invited email and password.
3. You land on **My Jobs**. Staff screens (dispatch, dashboard, settings) stay in the office layout.

## Add to Home Screen

Install the web app on a phone so it opens like an app.

**iPhone (Safari)**

1. Open the site in Safari (not an in-app browser).
2. Tap **Share**.
3. Tap **Add to Home Screen**.
4. Tap **Add**.

**Android (Chrome)**

1. Open the site in Chrome.
2. Tap the browser menu (three dots).
3. Tap **Add to Home Screen** or **Install app**.
4. Confirm.

The icon opens on My Jobs. Sign in once; the session stays on the phone.
