# LEVEL UP — Personal Productivity & Study Management App

LEVEL UP is a local-first personal productivity and study management application designed for desktop (web/Vercel) and mobile (proper native Android app). It combines rigorous academic organization (curriculum, syllabus chapters, tasks, examination countdowns, and Pomodoro focus tracking) with subtle, meaningful RPG progression.

---

## 📱 Proper Android Native App (Capacitor)

The Android application is a genuine native Android app powered by [Capacitor](https://capacitorjs.com/) and configured inside the `client/android/` directory with native Android Gradle tooling, `AndroidManifest.xml`, launcher icons, and local device storage.

### Option 1: Open & Run with Android Studio
1. Install [Android Studio](https://developer.android.com/studio) on your machine.
2. From the repository root, run:
   ```bash
   npm run android:open
   ```
   *(Or launch Android Studio and choose **Open an Existing Project** → navigate to `client/android`)*.
3. In Android Studio, connect your Android phone via USB (or start an emulator) and press the green **Play (Run)** button.
4. To generate an `.apk` file directly:
   - In Android Studio, click **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
   - The compiled APK is created at `client/android/app/build/outputs/apk/debug/app-debug.apk`.

### Option 2: Automated APK Build via GitHub Actions
We have configured a pre-built GitHub Actions workflow in [`.github/workflows/android-build.yml`](.github/workflows/android-build.yml).
1. Push this repository to GitHub.
2. Go to the **Actions** tab on your GitHub repository.
3. The **Build Android APK** workflow will compile the project in the cloud using JDK 21 and the Android SDK.
4. Download the generated `level-up-android-debug-apk` artifact directly to your phone and install it!

### Option 3: Command-Line Gradle Build
If you have JDK 21 and the Android SDK installed on your system:
```bash
cd client/android
./gradlew assembleDebug
```
The APK will be generated at `client/android/app/build/outputs/apk/debug/app-debug.apk`.

---

## 🌐 Desktop Deployment on Vercel

The desktop web application is pre-configured for instant deployment on [Vercel](https://vercel.com/) via [`vercel.json`](vercel.json).

### Method 1: Deploy with Vercel CLI
1. From the repository root, run:
   ```bash
   npx vercel
   ```
2. Follow the prompt to log in and select your Vercel team/account.
3. Vercel will detect the `vercel.json` configuration and deploy your app in seconds!

### Method 2: Deploy via GitHub (Recommended)
1. Push this repository to GitHub.
2. Go to [vercel.com/new](https://vercel.com/new) and import your repository.
3. Vercel automatically detects the project and builds both the frontend and the built-in Vercel Serverless Backend API (`api/index.ts`).
4. Click **Deploy**. Your desktop web app and backend API will be live on `https://<your-project>.vercel.app`.

---

## 🚀 Persistent Cloud Backend (Render / Railway / Docker)

For 24/7 cross-device sync with persistent WebSockets and SQLite database, you can deploy the backend using the included configurations:

### Option 1: Render (Free 24/7 Web Service)
- Push to GitHub and go to [dashboard.render.com](https://dashboard.render.com/).
- Click **New → Blueprint** and connect this repository. Render automatically reads [`render.yaml`](render.yaml) and provisions the service!

### Option 2: Docker / Railway / Fly.io / VPS
- A production [`Dockerfile`](Dockerfile) is included at root. Deploy with `docker build -t level-up . && docker run -p 3000:3000 level-up`.

### Local-First on Vercel:
Because LEVEL UP is engineered with a **local-first IndexedDB architecture**, the desktop app on Vercel works **100% out of the box with zero external backend or database setup required**:
- All subjects, syllabus chapters, tasks, exams, focus timer, gamification XP, and CSV exports run directly in the browser's persistent storage.
- If you wish to sync with your Android phone, simply enter your sync server's URL in **Settings → Remote Sync Server URL** (e.g. your laptop's local Wi-Fi IP `http://192.168.1.x:3000` or a free cloud backend hosted on Render/Railway).

---

## ⚡ Local Development Quick Start

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher (v20+ or v22 recommended)
- **npm**: v9.0.0 or higher

### 2. Install Dependencies
```bash
npm run install:all
```

### 3. Run Development Mode
To start both the sync backend server and Vite frontend dev server simultaneously:
```bash
npm run dev
```
- **Web App**: [http://localhost:5173](http://localhost:5173)
- **Sync Server**: [http://localhost:3000](http://localhost:3000) (WebSocket: `ws://localhost:3000/ws`)

### 4. Production Single-Port Server
To compile the production frontend and backend into an all-in-one deployable server:
```bash
npm run build
npm start
```
The entire application will run unified on **http://localhost:3000**.

---

## 🔄 Synchronizing Changes to the Android Project

Whenever you make changes to the frontend code and want them reflected in the native Android app:
```bash
npm run android:sync
```
This builds the latest web bundle and copies all assets into `client/android/app/src/main/assets/public/`.

---

## 🎮 Gamification & Rules

| Activity | XP Award | Rule |
|---|---:|---|
| **Completed Focus Session** | **+10 XP** | Requires at least 10 minutes of actual recorded focus duration. Breaks do not count. |
| **Completed Chapter** | **+20 XP** | Awarded once when all chapter syllabus items reach `Completed`. |
| **Completed Task** | **+10 XP** | Awarded upon marking a study or revision task as completed. |
| **Mastered Subject** | **+50 XP** | Awarded once when 100% of all chapters in a subject are completed. |
| **Achievements** | **+25 to +100 XP** | Unlocked for streaks, milestones (e.g. 10 hours of focus, 5-day streak). |

*Note: The XP ledger is append-only and uses deterministic idempotency keys, preventing duplicate XP farming if a user toggles an item between completed and incomplete.*

---

## 💾 Data Backup & Restore

- **Full JSON Backup**: In **Settings → Full Data Backup & Restore**, click **Export Full JSON Backup** to save a complete snapshot of all subjects, syllabus progress, timers, and achievements.
- **Restore**: Upload the backup JSON in Settings with an instant record preview before committing.
- **CSV Analytics**: Under **Progress → Export CSV**, download formatted spreadsheets of your study sessions with custom date filters.
