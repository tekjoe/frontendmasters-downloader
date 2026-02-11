#!/usr/bin/env node

import { downloadCourse } from './index.js';

// Simple CLI argument parsing
const args = process.argv.slice(2);

function showHelp() {
  console.log(`
Frontend Masters Downloader

Usage:
  node src/cli.js <course-url> [options]

Arguments:
  course-url           The Frontend Masters course URL to download

Options:
  --email, -e          Your Frontend Masters email (or set FEMAIL env var)
  --password, -p       Your Frontend Masters password (or set FPASS env var)
  --output, -o         Output directory (default: ./downloads/<course-slug>)
  --keep-temp          Keep temporary segment files after download
  --help, -h           Show this help message

Environment Variables:
  FEMAIL               Your Frontend Masters email
  FPASS                Your Frontend Masters password

Examples:
  # Using command line arguments
  node src/cli.js https://frontendmasters.com/courses/react-nextjs-state/ -e user@example.com -p password

  # Using environment variables
  FEMAIL=user@example.com FPASS=password node src/cli.js https://frontendmasters.com/courses/react-nextjs-state/

  # With custom output directory
  node src/cli.js https://frontendmasters.com/courses/react-nextjs-state/ -e user@example.com -p password -o ~/Videos/FEM
`);
}

// Parse arguments
let courseUrl = '';
const options = {
  email: process.env.FEMAIL || '',
  password: process.env.FPASS || '',
  outputDir: '',
  keepTemp: false
};

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  
  switch (arg) {
    case '--help':
    case '-h':
      showHelp();
      process.exit(0);
      break;
      
    case '--email':
    case '-e':
      options.email = args[++i];
      break;
      
    case '--password':
    case '-p':
      options.password = args[++i];
      break;
      
    case '--output':
    case '-o':
      options.outputDir = args[++i];
      break;
      
    case '--keep-temp':
      options.keepTemp = true;
      break;
      
    default:
      if (!arg.startsWith('-') && !courseUrl) {
        courseUrl = arg;
      }
      break;
  }
}

// Validate required arguments
if (!courseUrl) {
  console.error('❌ Error: Course URL is required');
  console.error('   Run with --help for usage information');
  process.exit(1);
}

if (!options.email) {
  console.error('❌ Error: Email is required (use --email or FEMAIL env var)');
  process.exit(1);
}

if (!options.password) {
  console.error('❌ Error: Password is required (use --password or FPASS env var)');
  process.exit(1);
}

// Start download
console.log('🚀 Frontend Masters Downloader\n');
downloadCourse(courseUrl, options).catch(err => {
  console.error(`\n❌ Fatal error: ${err.message}`);
  process.exit(1);
});
