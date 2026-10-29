# Plate

A free calorie and diet tracker that installs on an iPhone from Safari. No App Store and no subscription, and your data stays on your phone.

## What it does

- Works out a daily calorie target from your age, height, weight, activity and goal (Mifflin–St Jeor), with a safe minimum.
- Food diary for breakfast, lunch, dinner and snacks, with calories, protein, carbs and fat.
- About 270 built-in foods and dishes, including 36 Georgian dishes (khachapuri, khinkali, mtsvadi, lobio, pkhali…), with real portion sizes.
- Barcode scanner for packaged food (Open Food Facts) and online search (USDA FoodData Central).
- Free AI through Google Gemini: photograph a meal, describe it in words, read a nutrition label, or chat with a diet coach.
- AI meal plans: a 1-, 3- or 7-day menu that fits your calorie target and preferences, with one-tap logging, meal swaps and a shopping list. Planned meals also show on the Today screen.
- Your own foods, recipes (Plate works out the calories per portion) and saved meals you can re-log in one tap.
- Workouts: about 60 activities, calories from time or distance (speed sets the effort), daily steps with a goal, AI that turns a described workout into calories, and a choice to eat back none, half or all of them. Calories are counted above resting, so nothing is double-counted.
- Intermittent fasting timer (12:12 to 24 h) with history.
- Weight chart with a 7-day trend line and your real weekly rate, body measurements, private progress photos with before/after compare, a weekly nutrition report, an activity summary and a logging streak.
- Water tracking and backup/restore.
- Dark design with 3D: a glass calorie orb that fills as you eat, a spinning plate on the welcome screen and when food is logged, and a gold medal with confetti for achievements. Respects the iPhone's Reduce Motion setting.
- 21 achievements, a month calendar coloured by how each day went, and an AI weekly report with a score and three tips.
- English and Georgian (ქართული), including Georgian names for every built-in food and exercise; the AI answers in the chosen language.

Apple Health can't be read by a web app, so steps are typed in; reminders would need a paid push server, so there are none.

## Install on iPhone

1. Open the app's web address in **Safari**.
2. Tap the **Share** button, then **Add to Home Screen**.
3. Open Plate from the home screen. It runs full-screen and keeps working offline (except AI, barcode lookup and online search).

## Turn on the free AI

1. Go to <https://aistudio.google.com/apikey> and sign in with a Google account.
2. Tap **Create API key** and copy it.
3. In Plate, open **Me → AI assistant**, paste the key and tap **Save**.

## Develop

```bash
npm install
npm run dev      # local dev server
npm test         # unit tests
npm run build    # production build in dist/
```

Pushing to `main` on GitHub publishes the app to GitHub Pages through `.github/workflows/deploy.yml`.

## Logo

The logo is the GD heart with a leaf growing from the G. Files are in `brand/`: `gd-diet-logo-light.svg` for light backgrounds, `gd-diet-logo-dark.svg` for dark ones, and `gd-diet-app-icon.svg` (the app icon). `brand/build-logo.py` draws them from geometry; after changing `public/favicon.svg`, run `npm run icons` to regenerate the iPhone and web icons.
