# Privacy Policy — LichessRadar

*Last updated: June 2026*

---

## Overview

LichessRadar is a Chrome browser extension that helps users save and organize Lichess tournaments. This privacy policy explains what data the extension accesses and how it is handled.

---

## Data Collection

**LichessRadar does not collect, transmit, or share any personal data.**

All data created by the extension is stored exclusively on your local device using the Chrome `storage.local` API and never leaves your browser.

---

## What the Extension Stores Locally

When you save a tournament, the following information is stored **only on your device**:

- Tournament title, URL, type (Arena or Swiss), and start time
- Whether you marked it as a prize tournament or favorite
- Any personal note you added
- The date and time you saved it

This data is accessible only to you and is never transmitted to any server.

---

## Permissions Used

| Permission | Why it is needed |
|---|---|
| `storage` | Save your tournament list locally on your device |
| `alarms` | Schedule notifications before tournaments start |
| `notifications` | Display reminders before a tournament begins |
| `host_permissions` (lichess.org) | Inject the Save button on tournament pages and fetch tournament details via the public Lichess API |

---

## Lichess API

When you add a tournament by pasting a link, the extension makes a request to the **public Lichess API** (`lichess.org/api/tournament/` or `lichess.org/api/swiss/`) to fetch the tournament title and start time. This is a read-only request to a public endpoint. No personal data is sent.

---

## Third-Party Services

LichessRadar does not use any analytics, tracking, or advertising services.

The extension contains a link to [buymeacoffee.com/nightintel](https://buymeacoffee.com/nightintel). Clicking this link opens an external website subject to its own privacy policy. The extension does not interact with this service in any other way.

---

## Data Removal

You can remove all locally stored data at any time by:
- Opening the extension popup → Settings → **Clear all saved tournaments**
- Uninstalling the extension from Chrome

---

## Contact

For any questions regarding this privacy policy:

- Email: selfmonk@gmail.com
- Buy Me a Coffee: [buymeacoffee.com/nightintel](https://buymeacoffee.com/nightintel)

---

## Changes

If this privacy policy changes in the future, the updated version will be published in this repository with a new date.
