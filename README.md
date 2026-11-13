# Timeout – Basketball Play Designer

A wood-court whiteboard for drawing, animating, saving and sharing basketball plays.
It is a plain static web app (no build step) that installs to the home screen on Android, iPhone and desktop.

## Run it locally

```bash
python3 -m http.server 8080
```

Then open http://localhost:8080.

## Host it free on GitHub Pages

Push these files to a repository, then in the repository choose Settings → Pages → Deploy from a branch → `main` / root.

## Turn on accounts and cloud sync

1. Create a Supabase project and run `supabase/schema.sql` in its SQL editor.
2. Put the project URL and publishable key in `config.js`.

With `config.js` left empty the app is a scratchboard that saves plays on the device only. Sharing by link, image, PDF and video works either way.

## Playbooks and roles

Signed-in users create playbooks and add people by username or email. Roles: Owner (full control), Admin (edit plays and manage people), Editor (create and edit plays), Viewer (view only). An email with no account yet becomes an invite that is applied when that person signs up.

## Files

- `index.html`, `styles.css`, `app.js` – the app
- `court.js` – court drawing and play rendering
- `sw.js`, `manifest.webmanifest`, `icons/` – install and offline support
- `version.js` – the app version; change it with every release so installed copies are offered the update
- `CHANGELOG.md` – version history and numbering rules
- `vendor/supabase.js` – Supabase client (v2.119.0), loaded only when sync is configured
