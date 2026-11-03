#!/usr/bin/env node

/**
 * JSON Validation Script
 * Validates JSON files for syntax errors
 *
 * Usage:
 *   node scripts/validate-json.js                    # Validate default files
 *   node scripts/validate-json.js file1.json file2.json  # Validate specific files
 */

const fs = require('fs');
const path = require('path');

// Files to validate if none provided
const defaultFiles = [
  '.markdownlint.json',
  'package.json',
];

// Get files from command line arguments or use defaults
const filesToCheck = process.argv.length > 2 ? process.argv.slice(2) : defaultFiles;

let hasErrors = false;
let validCount = 0;
let skippedCount = 0;

console.log('🔍 Validating JSON files...\n');

filesToCheck.forEach((file) => {
  // Skip non-JSON files
  if (!file.endsWith('.json')) {
    console.log(`⏭️  Skipped (not a .json file): ${file}`);
    skippedCount++;
    return;
  }

  const filePath = path.isAbsolute(file) ? file : path.join(__dirname, '..', file);

  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${file}`);
    hasErrors = true;
    return;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    JSON.parse(content);
    console.log(`✅ ${file}`);
    validCount++;
  } catch (error) {
    console.error(`❌ ${file}`);
    console.error(`   Error: ${error.message}`);
    hasErrors = true;
  }
});

console.log('');

if (hasErrors) {
  console.error('❌ JSON validation failed');
  process.exit(1);
} else if (validCount === 0) {
  console.log(`ℹ️  No JSON files were validated (${skippedCount} skipped)`);
  process.exit(0);
} else {
  console.log(`✅ ${validCount} JSON file(s) valid`);
  process.exit(0);
}
