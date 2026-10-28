# Plate

A free calorie and diet tracker that installs on an iPhone from Safari. No App Store and no subscription, and your data stays on your phone.

## What it does

- Works out a daily calorie target from your age, height, weight, activity and goal (Mifflin–St Jeor), with a safe minimum.
- Food diary for breakfast, lunch, dinner and snacks, with calories, protein, carbs and fat.
- About 270 built-in foods and dishes, including 36 Georgian dishes (khachapuri, khinkali, mtsvadi, lobio, pkhali…), with real portion sizes.
- Barcode scanner for packaged food (Open Food Facts) and online search (USDA FoodData Central).
- Free AI through Google Gemini: photograph a meal, describe it in words, read a nutrition label, or chat with a diet coach.
- Your own foods and recipes (Plate works out the calories per portion).
- Weight log with a chart, water tracking, exercise, a 7-day calorie view, and backup/restore.

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
