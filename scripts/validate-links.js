#!/usr/bin/env node

/**
 * Link Validation Script
 * Checks that relative file links in markdown files resolve to existing files.
 * Network-free: http(s) links and #anchors are counted but not checked.
 */

const fs = require('fs');
const path = require('path');

// Get all markdown files
function getMarkdownFiles(dir, files = []) {
  const entries = fs.readdirSync(dir);

  entries.forEach((entry) => {
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory() && !entry.startsWith('.')) {
      getMarkdownFiles(fullPath, files);
    } else if (entry.endsWith('.md')) {
      files.push(fullPath);
    }
  });

  return files;
}

// Extract markdown links
function extractLinks(content) {
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const links = [];
  let match;

  while ((match = linkRegex.exec(content)) !== null) {
    links.push({
      text: match[1],
      url: match[2],
    });
  }

  return links;
}

// Validate internal file links
function validateInternalLink(link, baseDir) {
  // Skip external links
  if (link.startsWith('http://') || link.startsWith('https://')) {
    return { valid: true, type: 'external' };
  }

  // Skip anchors
  if (link.startsWith('#')) {
    return { valid: true, type: 'anchor' };
  }

  // Extract file path (remove anchor if present)
  const filePart = link.split('#')[0];

  // Empty path
  if (!filePart) {
    return { valid: true, type: 'anchor' };
  }

  const fullPath = path.join(baseDir, filePart);

  if (fs.existsSync(fullPath)) {
    return { valid: true, type: 'internal' };
  } else {
    return { valid: false, type: 'internal', reason: `File not found: ${fullPath}` };
  }
}

console.log('🔍 Validating links in markdown files...\n');

const baseDir = path.join(__dirname, '..');
const markdownFiles = getMarkdownFiles(baseDir);

let totalLinks = 0;
let brokenLinks = 0;
let externalNotChecked = 0;
let anchorsNotChecked = 0;

markdownFiles.forEach((file) => {
  const content = fs.readFileSync(file, 'utf8');
  const links = extractLinks(content);
  const relativeFile = path.relative(baseDir, file);

  if (links.length === 0) {
    return;
  }

  console.log(`📄 ${relativeFile}`);

  links.forEach((link) => {
    totalLinks++;

    const validation = validateInternalLink(link.url, path.dirname(file));

    // External targets and #fragments are never resolved by this script
    if (validation.type === 'external') {
      externalNotChecked++;
    } else if (link.url.includes('#')) {
      anchorsNotChecked++;
    }

    if (validation.valid) {
      const typeIcon = {
        internal: '📎',
        external: '🌐',
        anchor: '⚓',
      }[validation.type];
      console.log(`   ${typeIcon} [${link.text}](${link.url})`);
    } else {
      brokenLinks++;
      console.error(`   ❌ [${link.text}](${link.url})`);
      console.error(`      Reason: ${validation.reason}`);
    }
  });

  console.log('');
});

console.log(`\n📊 Summary:`);
console.log(`   Total links: ${totalLinks}`);
console.log(`   Broken links: ${brokenLinks}`);
console.log(`   External links not checked: ${externalNotChecked}`);
console.log(`   Anchors not checked: ${anchorsNotChecked}`);

if (brokenLinks > 0) {
  console.error('\n❌ Link validation failed');
  process.exit(1);
} else {
  console.log('\n✅ All internal file links resolve (external links and anchors were not checked)');
  process.exit(0);
}
