# Berry List

Personal to-do calendar + notes. Plain static files, works on GitHub Pages.

## Put it online (GitHub Pages)
1. Make a new repo on GitHub (e.g. `berry-list`).
2. Upload everything in this folder to the repo (Add file > Upload files).
3. Repo Settings > Pages > Source: "Deploy from a branch", Branch: `main`, folder `/ (root)`. Save.
4. After a minute it's live at `https://<your-username>.github.io/berry-list/`.

## Use it on your phone
- Open that link in Safari, tap Share > "Add to Home Screen". It opens like an app.
- To see the same list on laptop and phone, tap the "local only" chip (top right) > Sync settings,
  make a GitHub token with only the `gist` box ticked, and paste the same token on both devices.
  Your list saves to a private gist. Without this, each device keeps its own list.

## How it works
- Paste an assignment title anywhere on the page (or into the title box): the link attached to it is saved and shows as a ↗ button. "Links to an external site." from Canvas gets stripped.
- Tap the circle on a task to mark it done. "move" sends it to today / tomorrow / +1 day / +1 week / any date. Drag and drop works on desktop.
- Tasks left "In progress" or "STUCK" automatically roll over to today.
- Quick links (top right): Resume, LinkedIn, Canvas, Gmail. "edit links" to change them (add your resume link there).
- Notes: + New section, choose a template (Checklist, Free write, Links, Budget, Recipe).
- Footer: export/import a backup file.

Files: `index.html`, `style.css`, `app.js` (app), `bg.js` (3D porcelain background), icons + manifest.
