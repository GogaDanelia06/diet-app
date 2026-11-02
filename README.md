# Plate

A free calorie and diet tracker that installs on an iPhone from Safari. No App Store and no subscription, and your data stays on your phone.

## What it does

- Works out a daily calorie target from your age, height, weight, activity and goal (Mifflin–St Jeor), with a safe minimum.
- Food diary for breakfast, lunch, dinner and snacks, with calories, protein, carbs and fat.
- About 270 built-in foods and dishes, including 36 Georgian dishes (khachapuri, khinkali, mtsvadi, lobio, pkhali…), with real portion sizes.
- Barcode scanner for packaged food (Open Food Facts) and online search (USDA FoodData Central).
- Restaurant food: Mac Shaurma's shaurma (chicken and pork, standard, medium and big) as clearly marked estimates, since Mac Shaurma publishes no nutrition facts. Typing a chain's name (McDonald's, KFC, Burger King, Wendy's, Domino's, Subway… in English or Georgian) searches USDA's lab data for that chain automatically, marked as official US-recipe data. Search also understands shaurma/shawarma/შაურმა and other common spellings.
- Is it a good choice? Scanned products show their Nutri-Score, how processed they are and their sugar, fat and salt, with a plain verdict (Good choice, Fine in moderation, Best to limit) and up to five better-rated alternatives. Every other food gets Plate's own estimate, and Today shows how much of the day's food was a good pick. Free, no AI needed.
- Allergy and diet warnings: pick your allergens and what you eat, and scanned products that contain them, may contain traces, or aren't vegan or vegetarian get a red warning.
- Free AI through Google Gemini: photograph a meal, describe it in words, read a nutrition label, or chat with a diet coach.
- AI meal plans: a 1-, 3- or 7-day menu that fits your calorie target and preferences, with one-tap logging, meal swaps and a shopping list. Planned meals also show on the Today screen.
- Your own foods, recipes (Plate works out the calories per portion) and saved meals you can re-log in one tap.
- Workouts: about 60 activities, calories from time or distance (speed sets the effort), daily steps with a goal, AI that turns a described workout into calories, and a choice to eat back none, half or all of them. Calories are counted above resting, so nothing is double-counted.
- Workouts page: a weekly plan that fits your goal (lose, keep or gain weight) and where, how often, how long and how hard you train, with each move's sets, reps and how-to. It shows what each session burns, how much it adds to your budget, how much protein to eat and what to eat before and after (matched to your diet and allergies). Mark as done logs it to Today's exercise.
- Live workout tracker: Start workout opens a timer and every set to tick off, with kg and reps for gym moves, reps or seconds otherwise. Last time's numbers are filled in, and Plate suggests adding 2.5 kg (or reps) once you hit the top of the range. A rest timer starts after each set (+15 s, Skip, vibrates when done) and the screen stays on. Finishing logs the real time and calories to Today and keeps the sets in Recent workouts, with total kg lifted and new personal bests. Start an empty workout to add any of 30+ exercises (barbell squat, deadlift, pull-ups…), and set a workout time for a reminder in the iPhone app.
- Intermittent fasting timer (12:12 to 24 h) with history.
- Weight chart with a 7-day trend line and your real weekly rate, body measurements, private progress photos with before/after compare, a weekly nutrition report, an activity summary and a logging streak.
- Water tracking and backup/restore.
- Dark design with 3D: a glass calorie orb that fills as you eat, a spinning plate on the welcome screen and when food is logged, and a gold medal with confetti for achievements. Respects the iPhone's Reduce Motion setting.
- 21 achievements, a month calendar coloured by how each day went, and an AI weekly report with a score and three tips.
- English and Georgian (ქართული), including Georgian names for every built-in food and exercise; the AI answers in the chosen language.

- Apple Watch and WHOOP: a one-tap iPhone Shortcut copies today's active calories and steps from Apple Health, and Plate imports them (or you type them in). Only calories above a normal day for your activity level count, and logged workouts aren't counted twice. The setup guide is in Me → Apple Watch & WHOOP.

- Reminders in the iPhone app: meal reminders that skip meals you've already logged, water reminders until you reach your goal, and a note when your fast is done. They're scheduled on the phone, so there's no server.

A web app can't read Apple Health directly, which is why the Shortcut is needed; on the website there are no reminders, because they would need a paid push server.

## Install on iPhone

1. Open the app's web address in **Safari**.
2. Tap the **Share** button, then **Add to Home Screen**.
3. Open Plate from the home screen. It runs full-screen and keeps working offline (except AI, barcode lookup and online search).

## Install the iPhone app (Apple Health comes in by itself)

iPhone doesn't let websites read Apple Health, so the website needs a Shortcut. Plate's iPhone app reads it by itself instead: steps, active calories, workouts and weight, whenever you open it, and it catches up on the days you didn't. It's free to put on your own iPhone:

1. You need a Mac with Xcode (free in the Mac App Store) and a cable for your iPhone.
2. In the project folder run `pnpm install`, then `npm run ios` (or `pnpm ios`). It builds Plate, copies it into the iPhone project and opens Xcode.
3. In Xcode, click **App** in the left sidebar, open **Signing & Capabilities** and, under **Team**, choose **Add an Account…** and sign in with your Apple ID. Pick your **(Personal Team)**. If Xcode says the bundle identifier is taken, change it to something only you use, like `com.yourname.plate`.
4. On the iPhone, turn on **Settings → Privacy & Security → Developer Mode** (the phone restarts). Plug it in, pick it at the top of the Xcode window and press **Run** (▶).
5. The first time, open **Settings → General → VPN & Device Management**, tap your Apple ID and **Trust**. Then open Plate and allow Apple Health.
6. Move your data across: on the website open **Me → Backup → Save backup**, then in the app **Me → Backup → Restore** and pick the file.

With a free Apple ID the app stops opening after 7 days: plug the iPhone in and press **Run** again, and your data stays. A paid Apple Developer account ($99 a year) makes it last a year. Apple doesn't say for certain that free accounts can use Apple Health; if Xcode shows a HealthKit signing error with a free account, that's why.

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
