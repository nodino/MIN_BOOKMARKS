const fs = require('fs');
const path = require('path');

// Read the new version from package.json (npm already updated it)
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const newVersion = pkg.version; // e.g. "1.2.3"

// List the markdown files that contain a version badge
const files = [
  'README_EN.md',
  'README.md',
  'DOCS/TECHNICAL_DOCUMENTATION_EN.md',
  'DOCS/TECHNICAL_DOCUMENTATION_FR.md',
  'DOCS/USER_MANUAL_EN.md',
  'DOCS/USER_MANUAL_FR.md'
];

// Replace the line that looks like “Version: **x.y.z**” (handles EN & FR formats)
const replaceVersion = (content) =>
  content.replace(/(Version[:\s]*\*{0,2})\d+\.\d+\.\d+(\*{0,2})/g, `$1${newVersion}$2`);

files.forEach((rel) => {
  const abs = path.resolve(__dirname, '..', rel);
  if (!fs.existsSync(abs)) {
    console.warn(`⚠️  ${rel} not found, skipping`);
    return;
  }
  let txt = fs.readFileSync(abs, 'utf8');
  txt = replaceVersion(txt);
  fs.writeFileSync(abs, txt, 'utf8');
  console.log(`✓ Updated ${rel} → ${newVersion}`);
});
  // End of loop
}
