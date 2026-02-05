Mobile-optimized Portfolio

What I changed:
- Added a mobile fallback image and a `View 3D` button to avoid heavy GPU work on phones.
- Made 3D loading lazy on mobile/low-power devices; user can opt-in to load the model.
- Preferred a lighter `.glb` on mobile and reduced renderer pixel ratio and shadows on low-power devices.
- Added CSS to hide the canvas until the model is loaded and improved responsive styles.

How to push to GitHub (run these locally):

1. Create a new repo on GitHub or use an existing one.
2. Add remote and push:

```bash
# replace <your-remote-url> with the repo URL (SSH or HTTPS)
git remote add origin <your-remote-url>
git branch -M main
git push -u origin main
```

Enable GitHub Pages from the repository settings and set the source to the `main` branch (root) to publish.

If you prefer, authenticate with GitHub CLI and run:

```bash
# with gh authenticated
gh repo create my-repo --public --source=. --remote=origin --push
```

Notes:
- If you want me to push the repo for you, I can run `gh repo create` and push, but that requires `gh` to be installed and authenticated on this machine.
- Tell me the remote URL or confirm you want me to create the repo and push (I will need permission to use your account).