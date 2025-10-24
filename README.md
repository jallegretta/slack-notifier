# slack-notifier

Slack DM notifier userscript (Tampermonkey)

This repository contains a small userscript that shows a popup notification when you receive a direct message (DM) in Slack Web.

Files:
- `slack-message-input.js` — the userscript (already present in this workspace)

How to publish this to GitHub and enable Tampermonkey auto-updates

1. (Optional) Inspect the script and adjust the `@updateURL` / `@downloadURL` lines in the userscript header. They are already set to:

   `https://raw.githubusercontent.com/jallegretta/slack-notifier/main/slack-message-input.js`

2. Create the remote repository on GitHub (two options):

   - Using the GitHub website: create a new repo named `slack-notifier` under your `jallegretta` account.
   - Or using the GitHub CLI (if installed):

     ```powershell
     gh repo create jallegretta/slack-notifier --public --source=. --remote=origin --push
     ```

3. If you created the repo on the website, run these commands in this folder (PowerShell):

   ```powershell
   git remote add origin https://github.com/jallegretta/slack-notifier.git
   git branch -M main
   git push -u origin main
   ```

4. After the file is on GitHub, the raw URL will be:

   `https://raw.githubusercontent.com/jallegretta/slack-notifier/main/slack-message-input.js`

   Tampermonkey will use that for updates when you installed the userscript with the `@updateURL` set.

Notes
- If you prefer a Gist instead of a repo, create a public Gist and update `@updateURL`/`@downloadURL` to point to the raw Gist URL.
- If you want, I can add a GitHub Actions workflow to automatically bump versions or publish releases; tell me if you'd like that.
