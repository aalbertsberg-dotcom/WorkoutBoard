# WorkSet update journal

Me > Settings & Account > What's New is available to all signed-in users. Keep five main navigation destinations.

- Add a dated plain-language entry in src/worksetUpdateNotes.js for each user-facing update. Group related changes. Do not claim unverified release certification.
- Build-time Git history automatically captures reachable commit subjects, dates and SHAs, including minor changes, CI and tests. Production and native packaging use full-depth checkout. Local shallow builds identify incomplete history.
- The journal works offline with the installed build. GitHub links open the latest repository or linked source revision, not necessarily the installed release.
- Never add account data, credentials or private operational details to highlights. Keep native packaging manual during web-first stabilization.
