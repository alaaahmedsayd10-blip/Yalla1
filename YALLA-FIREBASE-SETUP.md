# Yalla1 — Firebase login, rules and animal shop

This is an updated WorkAdventure Map Starter Kit. It adds a Firebase Authentication login modal, Firestore player profiles, a gold banner, an animal shop zone, game rules confirmation, and a “موقعي الأول” action-bar button.

## Setup

1. In Firebase Console, enable **Authentication → Sign-in method → Email/Password**. This starter kit maps the phone number to an internal synthetic email because Firebase's standard Email/Password provider does not authenticate phone + password directly. It does **not** send an SMS OTP. For real phone verification, implement Firebase Phone Authentication instead.
2. Create a Firestore database and publish `firestore.rules` from the Firebase Console (Firestore Database → Rules).
3. Update the Firebase web configuration in both `src/firebase-config.ts` and `public/firebase-config.js` (the values currently match the config provided for project `game-af286`). Keep both files in sync. The Firebase web config is public client configuration; protect the project with Authentication and Firestore Rules, and never put service-account keys in the repository.
4. Deploy the repository to GitHub Pages so `public/login.html` and `public/firebase-config.js` are served at `https://alaaahmedsayd10-blip.github.io/Yalla1/login.html` and `/firebase-config.js`. If your GitHub username/repository changes, update `LOGIN_URL` in `src/main.ts`.
5. Run `npm install`, then `npm run buildmap`. Commit and push the changed files so the GitHub Pages workflow deploys them.

## Security notes

- Passwords are handled by Firebase Authentication. They are **not** stored in the Firestore `users` document, hashed or otherwise. Do not store a client-generated password hash in Firestore; it is not a safe substitute for Authentication.
- New profiles start with exactly 5 gold. The included Firestore rules allow a player to buy one animal per update and enforce the listed prices. Review/test rules in the Firebase Emulator before launch.
- The rules layer protects profile ownership and the basic purchase shape, but for a production economy you should move purchases to a trusted Cloud Function to protect against edge cases and future client changes.
- The “موقعي الأول” URL is set to `https://first-xxx.com` in `src/main.ts`. Change `SITE_URL` when you have the final address.
- The shop zone is a Tiled object layer named `shop` in `conference.tmj`. Move/resize its rectangles in Tiled if you want the shop in a different location.
- Rules acceptance is stored in localStorage per Firebase UID on the current browser/device.
