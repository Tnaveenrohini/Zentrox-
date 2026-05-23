# ⚡ Zentrox — Student Rewards Platform

Download Instagram Reels in HD · Earn ZPoints · Redeem for Study Supplies

---

## Features

### 📥 Instagram Downloader
- Paste any Instagram reel/video/TV link
- Download HD video instantly, no watermark
- Auto clipboard paste detection
- Earn **+50 ZPoints** per download

### ⭐ ZPoints Rewards System
- Earn points: downloads (+50), daily bonus (+100), reading articles (+25)
- Full activity history with timestamps
- Points balance shown live in navbar and hero
- Points stored in localStorage (persist across sessions)

### 🛍️ Zentrox Store (20 items)
- Stationery: pencils, gel pens, notebooks, geometry box, highlighters
- Books: NCERT textbooks, practice books, grammar guides, GK almanac
- Digital: Coursera, Khan Academy Pro, Audible, Google Drive
- Science kits: lab kit, magnet circuits, globe, astronomy posters
- Filter by category · Claim modal with delivery form

### 📚 Study Hub
- **9 curated articles** across Maths, Physics, Biology, Chemistry, History, English, CS
- **9 free tools**: Desmos, Quizlet, Khan Academy, PhET, Wolfram Alpha, Pomofocus…
- **8 subject directories** with topic tags
- Reading an article earns +25 ZPoints (once per article)

### UI/UX
- Deep navy + indigo + cyan premium dark theme
- Syne + DM Sans fonts
- Animated gradient orb background with noise texture
- Sticky navbar with live ZPoints pill
- Mobile responsive (320px–1440px+)
- Animated hero card stack
- ZPoints ring chart

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start the server
npm start

# 3. Open browser
http://localhost:3000
```

### Development (auto-restart on save)
```bash
npm run dev
```

---

## API

### `POST /download`
```json
// Request
{ "url": "https://www.instagram.com/reel/ABC123/" }

// Success response
{
  "status": true,
  "download": "https://cdn...mp4",
  "downloadSD": null,
  "thumbnail": "https://cdn...jpg",
  "quality": "HD",
  "title": "Instagram Video",
  "author": "username"
}
```

### `GET /proxy-download?url=<CDN_URL>&filename=video.mp4`
Proxies the video through the server for a proper browser download dialog.

### `GET /health`
```json
{ "status": "ok", "app": "Zentrox", "version": "2.0.0" }
```

---

## Project Structure
```
zentrox/
├── index.html    ← Full single-page app markup
├── style.css     ← Premium dark UI (vars, components, responsive)
├── script.js     ← All frontend logic (ZPoints, Store, Study Hub, DL)
├── server.js     ← Express backend (RapidAPI primary + scrape fallback)
├── package.json  ← Dependencies
└── README.md
```

---

## RapidAPI Key
The key `e1a114cc67msh944af74a26bd9edp1735d9jsn28ed5df7737f` is pre-configured.
To use a different key: `RAPIDAPI_KEY=your_key node server.js`

---

## Legal
Zentrox is not affiliated with Instagram or Meta. For personal/educational use only.

© 2025 Zentrox
