# Changelog

Versions follow MAJOR.MINOR.PATCH:

- **Major** (first number): big updates or changes.
- **Minor** (second number): smaller updates and new features.
- **Patch** (third number): bug fixes and patches.

The current version shows in the top-left corner of the home screen. It is set in one place, `version.js`.
Change that number with every release: it is what tells open and installed copies that an update is ready. A release that changes other files but not `version.js` will not be offered as an update.

## 1.4.0
- Update prompt: while the app is open it checks for a new version every 15 seconds (only when on screen and online) and shows a bar with Update and Later. Update applies the new version and reloads straight away; Later hides the bar until the app is next opened.
- The version number now lives in `version.js`.

## 1.3.0
- Install app button on the home screen. It hides once the app is installed and comes back if the app is removed from the device (Chrome, Edge, Android). On iPhone and iPad it shows Add to Home Screen steps.
- App version shown on the home screen.

## 1.2.0
- Formation picker with half-court sets and inbounds formations.

## 1.1.0
- Sign-in page with a continue-without-account option.
- Home screen with the scratchboard, playbooks and scratch plays on this device.
- Cloud playbooks with Owner, Admin, Editor and Viewer roles; add people by username or email, with invites for new emails.
- Add a scratch play to any playbook you can edit.

## 1.0.0
- First release: wood-court whiteboard with multi-step animated plays, playbook, settings, sharing by link, image, PDF and video, offline support, and account sync.
