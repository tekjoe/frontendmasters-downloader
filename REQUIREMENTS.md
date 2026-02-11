# Project Requirements

## Goal
Build a Puppeteer-based downloader for Frontend Masters courses that:
1. Authenticates with user credentials
2. Navigates to course pages
3. Extracts M3U8 video URLs
4. Downloads video segments
5. Merges to MP4 files

## Technical Stack
- Puppeteer (with stealth plugin)
- Node.js native fetch for downloads
- ffmpeg for video merging (shell exec)

## File Structure
```
src/
├── index.js          # CLI entry point
├── auth.js           # Login automation
├── extractor.js      # M3U8 URL extraction
├── downloader.js     # Segment download logic
├── merger.js         # MP4 merging with ffmpeg
└── utils.js          # Helpers (sanitize names, etc.)
```

## First Course to Download
https://frontendmasters.com/courses/react-nextjs-state/

## Acceptance Criteria
- [ ] Authenticates with credentials from config/credentials.json
- [ ] Navigates to specified course URL
- [ ] Extracts all lesson M3U8 URLs (1080p quality)
- [ ] Downloads organized as: downloads/{course-slug}/{lesson-number}-{lesson-title}.mp4
- [ ] Each lesson merged to single MP4
- [ ] Resume capability for partial downloads
- [ ] Progress logging to console
- [ ] Handles errors gracefully (network, auth, etc.)
