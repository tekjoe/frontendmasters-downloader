# Frontend Masters Downloader

Download Frontend Masters courses as MP4 files using Puppeteer automation.

## Setup

1. Copy the config template and fill in your credentials:
   ```bash
   cp config/credentials.json.example config/credentials.json
   ```

2. Edit `config/credentials.json` with your Frontend Masters login:
   ```json
   {
     "email": "your-email@example.com",
     "password": "your-password"
   }
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

## Usage

### Download a specific course
```bash
npm run download -- "https://frontendmasters.com/courses/react-nextjs-state/"
```

### Download multiple courses
```bash
node src/index.js \
  "https://frontendmasters.com/courses/react-nextjs-state/" \
  "https://frontendmasters.com/courses/another-course/"
```

## Output Structure

```
downloads/
└── react-nextjs-state/
    ├── 01-introduction.mp4
    ├── 02-getting-started.mp4
    └── ...
```

## Features

- ✅ Puppeteer-based authentication (bypasses CORS)
- ✅ 1080p video quality
- ✅ Automatic M3U8 → MP4 merging
- ✅ Organized by course/lesson
- ✅ Resume partial downloads

## How It Works

1. Puppeteer opens Frontend Masters in a headless browser
2. Logs in with your credentials
3. Navigates to the course page
4. Extracts M3U8 playlist URLs for each lesson
5. Downloads .ts segments via the authenticated browser context
6. Merges segments into MP4 files using ffmpeg

## Notes

- Requires ffmpeg to be installed for video merging
- Downloads are for personal use only
- Respect Frontend Masters' terms of service
