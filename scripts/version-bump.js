#!/usr/bin/env node

/**
 * Version Bump Script for Sonami
 * 
 * Usage:
 *   node scripts/version-bump.js <version>
 *   bun scripts/version-bump.js <version>
 * 
 * Examples:
 *   bun scripts/version-bump.js 0.1.0-alpha.2
 *   bun scripts/version-bump.js 0.2.0-beta.1
 *   bun scripts/version-bump.js 1.0.0
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const version = process.argv[2];

if (!version) {
  console.error('❌ Please provide a version number');
  console.error('   Usage: bun scripts/version-bump.js <version>');
  console.error('   Example: bun scripts/version-bump.js 0.1.0-alpha.2');
  process.exit(1);
}

// Validate version format (semver with optional prerelease)
const semverRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9]+(\.[a-zA-Z0-9]+)*)?$/;
if (!semverRegex.test(version)) {
  console.error('❌ Invalid version format. Use semantic versioning (e.g., 1.0.0, 0.1.0-alpha.1)');
  process.exit(1);
}

console.log(`📦 Bumping version to ${version}\n`);

// Files to update
const files = [
  {
    path: 'package.json',
    update: (content) => {
      const pkg = JSON.parse(content);
      pkg.version = version;
      return JSON.stringify(pkg, null, 2) + '\n';
    }
  },
  {
    path: 'src-tauri/tauri.conf.json',
    update: (content) => {
      const config = JSON.parse(content);
      config.version = version;
      return JSON.stringify(config, null, 2) + '\n';
    }
  },
  {
    path: 'src-tauri/Cargo.toml',
    update: (content) => {
      return content.replace(
        /^version = ".*"$/m,
        `version = "${version}"`
      );
    }
  }
];

for (const file of files) {
  const filePath = join(rootDir, file.path);
  try {
    const content = readFileSync(filePath, 'utf-8');
    const updated = file.update(content);
    writeFileSync(filePath, updated);
    console.log(`✅ Updated ${file.path}`);
  } catch (error) {
    console.error(`❌ Failed to update ${file.path}: ${error.message}`);
    process.exit(1);
  }
}

console.log(`\n🎉 Version bumped to ${version}`);
console.log('\n📋 Next steps:');
console.log('   1. Review changes: git diff');
console.log('   2. Commit: git commit -am "chore: bump version to ' + version + '"');
console.log('   3. Tag: git tag v' + version);
console.log('   4. Push: git push && git push --tags');
console.log('\n   The GitHub Action will automatically build and create a release.');
