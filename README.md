# Frontend Masters Downloader

Download Frontend Masters courses as MP4 files using Puppeteer automation.

## Features

- ✅ Puppeteer-based authentication (bypasses CORS)
- ✅ Automatic M3U8 playlist extraction
- ✅ 1080p video quality selection
- ✅ Automatic M3U8 → MP4 merging with ffmpeg
- ✅ Resume capability for interrupted downloads
- ✅ Progress tracking and logging
- ✅ Organized output: `downloads/{course-slug}/{number}-{title}.mp4`

## Prerequisites

- Node.js 18+ 
- ffmpeg installed on your system
- Frontend Masters account

### Installing ffmpeg

**macOS:**
```bash
brew install ffmpeg
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install ffmpeg
```

**Windows:**
Download from https://ffmpeg.org/download.html and add to PATH

## Setup

1. Clone or navigate to the project directory
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up your credentials (choose one method):

   **Option A: Environment variables**
   ```bash
   export FEMAIL="your-email@example.com"
   export FPASS="your-password"
   ```

   **Option B: Command line arguments**
   (See usage below)

## Usage

### Basic Usage

```bash
# Using environment variables
export FEMAIL="your-email@example.com"
export FPASS="your-password"
node src/cli.js https://frontendmasters.com/courses/react-nextjs-state/
```

```bash
# Using command line arguments
node src/cli.js https://frontendmasters.com/courses/react-nextjs-state/ \
  -e your-email@example.com \
  -p your-password
```

### Advanced Options

```bash
# Custom output directory
node src/cli.js https://frontendmasters.com/courses/react-nextjs-state/ \
  -e your-email@example.com \
  -p your-password \
  -o ~/Videos/FrontendMasters

# Keep temporary segment files (for debugging)
node src/cli.js https://frontendmasters.com/courses/react-nextjs-state/ \
  -e your-email@example.com \
  -p your-password \
  --keep-temp
```

### Help

```bash
node src/cli.js --help
```

## Output Structure

```
downloads/
└── react-nextjs-state/
    ├── 01-introduction.mp4
    ├── 02-getting-started.mp4
    ├── 03-state-management.mp4
    └── ...
```

## Resume Capability

If a download is interrupted, the tool will automatically resume from where it left off on the next run. Progress is saved in `.download-progress.json` in the output directory.

## How It Works

1. **Authentication** - Puppeteer opens Frontend Masters and logs you in
2. **Course Discovery** - Extracts lesson metadata from the course page
3. **M3U8 Extraction** - Visits each lesson and captures the video playlist URL
4. **Segment Download** - Downloads all .ts video segments using authenticated requests
5. **Video Merging** - Uses ffmpeg to merge segments into a single MP4 file
6. **Cleanup** - Removes temporary files (unless `--keep-temp` is used)

## Project Structure

```
src/
├── cli.js           # CLI entry point
├── index.js         # Main download orchestration
├── auth.js          # Puppeteer authentication
├── extractor.js     # M3U8 URL extraction
├── downloader.js    # Segment download logic
├── merger.js        # MP4 merging with ffmpeg
└── utils.js         # Helper functions
```

## Troubleshooting

### "ffmpeg is not installed"
Install ffmpeg using the instructions in Prerequisites above.

### "No video segments found"
The course page structure may have changed. Check if you're logged in and have access to the course.

### Download fails partway through
Run the command again - it will resume from where it left off.

### "Failed to download M3U8 playlist"
Check your credentials and ensure you have an active Frontend Masters subscription.

## Technical Details

- Uses Puppeteer with stealth plugin to avoid detection
- Intercepts network requests to capture M3U8 URLs
- Downloads segments using the same authenticated session
- Merges using ffmpeg's concat demuxer for lossless joining

## Notes

- Downloads are for personal use only
- Respect Frontend Masters' terms of service
- Requires an active Frontend Masters subscription
