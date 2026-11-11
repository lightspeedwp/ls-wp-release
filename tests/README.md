# Tests

This directory contains test configurations and examples for release skill validation and WordPress block plugin/theme testing.

## What actually runs in this repository

`npm test` runs Vitest (`vitest run --coverage`) over `tests/*.test.cjs`. These are the only executable tests here:

| File | Covers |
| ---- | ------ |
| `validate-json.test.cjs` | `scripts/validate-json.js` |
| `validate-links.test.cjs` | `scripts/validate-links.js` |
| `validate-skill-structure.test.cjs` | `scripts/validate-skill-structure.js` |
| `lint-yaml.test.cjs` | the `lint:yaml` script in `package.json` (mock `yamllint`) |
| `helper-scripts.test.cjs` | `audit-log-approval.js`, `generate-approval-report.js` and `validate-package-group.js` |
| `validators.inprocess.test.cjs` | `validate-json.js`, `validate-links.js` and `validate-skill-structure.js`, in-process |
| `svn-sync-validator.inprocess.test.cjs` | `svn-sync-validator.js`, in-process |
| `check-cross-dependencies.inprocess.test.cjs` | `check-cross-dependencies.js`, in-process |
| `validate-package-group.inprocess.test.cjs` | `validate-package-group.js`, in-process |
| `audit-log-approval.inprocess.test.cjs` | `audit-log-approval.js`, in-process |
| `generate-approval-report.inprocess.test.cjs` | `generate-approval-report.js`, in-process |
| `release-notes-parse-format.inprocess.test.cjs` | `parse-changelog.js` and `format-release-notes.js`, in-process |
| `extract-contributors.inprocess.test.cjs` | `extract-contributors.js`, in-process |

The `*.inprocess.test.cjs` files (listed below) load each real script with `require()`, so V8
coverage can see it. The older files run copies of the scripts as subprocesses, which V8
cannot see, so they check behaviour but add no coverage.

They use temporary fixtures and need `npm install` (Node 22.12 or newer, for Vitest) but no
network. `npm test` reports coverage (text, `json-summary` and `lcov` in `coverage/`) and
fails if global statements, branches, functions or lines fall below **80%**. That is the
agreed starting point; raise it toward 90% in `vitest.config.ts` as the tests improve.
Everything below this section is **reference material for a downstream plugin or theme
project** being released. The Jest, PHPUnit, Playwright, coverage and hook examples are
not configured or run in this repository.

## Purpose

The tests folder provides:

- Test configuration examples (Jest, PHPUnit, Playwright)
- Example test cases for WordPress block projects
- Release validation test cases
- Compliance verification tests
- Hook and filter testing patterns

## Test Types

### Unit Tests

Unit tests validate individual functions and classes in isolation.

**File location:** Tests stay in project root (e.g., `jest.config.js`, `phpunit.xml`)

**For WordPress Blocks:**
```javascript
// tests/blocks/hero-block.test.js
describe('Hero Block', () => {
  it('renders with default attributes', () => {
    // Test block registration
  });
  
  it('validates required attributes', () => {
    // Test block validation
  });
});
```

### Integration Tests

Integration tests validate how components work together.

**For WordPress Plugins:**
```php
// tests/integration/test-plugin-activation.php
class Plugin_Activation_Tests extends WP_UnitTestCase {
  public function test_plugin_activates() {
    // Verify hooks are registered
  }
  
  public function test_blocks_register() {
    // Verify block types exist
  }
}
```

### E2E Tests (Playwright)

End-to-end tests validate user workflows in the block editor.

```javascript
// tests/e2e/hero-block.spec.js
test('Hero block workflow', async ({ page }) => {
  // Navigate to block editor
  // Insert block
  // Configure settings
  // Verify output
});
```

## Test Configuration Files

### Jest (JavaScript/TypeScript)

**jest.config.js** (planned example)
- Test environment setup
- Transform configurations
- Coverage thresholds (70% recommended)
- Module resolution

### PHPUnit (PHP)

**phpunit.xml** (planned example)
- WordPress test bootstrap
- Database configuration
- Test directory paths
- Filter groups

### Playwright (E2E)

**playwright.config.ts** (planned example)
- Browser configurations
- Timeout settings
- Screenshot options
- Report generation

## Release Validation Tests

### Pre-Release Tests

Tests that verify release readiness:

```javascript
// tests/release/version-alignment.test.js
describe('Version Alignment', () => {
  it('VERSION file matches plugin header', () => {
    // Compare VERSION file with plugin.php
  });
  
  it('readme.txt stable tag matches version', () => {
    // Compare readme.txt with version files
  });
});
```

### Changelog Tests

```javascript
// tests/release/changelog-format.test.js
describe('CHANGELOG.md Format', () => {
  it('follows Keep a Changelog format', () => {
    // Validate CHANGELOG.md structure
  });
  
  it('has [Unreleased] section', () => {
    // Verify [Unreleased] exists
  });
  
  it('entries have valid subsections', () => {
    // Check for Added, Changed, Fixed, etc.
  });
});
```

### WordPress Compliance Tests

```javascript
// tests/release/wordpress-compliance.test.js
describe('WordPress Compliance', () => {
  it('plugin header is complete', () => {
    // Validate all required fields
  });
  
  it('readme.txt has required sections', () => {
    // Check Description, Installation, FAQ
  });
  
  it('block.json is valid', () => {
    // Validate block schema
  });
});
```

## Test Patterns for Blocks

### Block Registration Test

```php
// tests/test-block-registration.php
public function test_hero_block_registers() {
  $blocks = WP_Block_Type_Registry::get_instance();
  $this->assertTrue( 
    $blocks->is_registered( 'my-plugin/hero-block' )
  );
}
```

### Block Rendering Test

```javascript
// tests/blocks/hero-block-render.test.js
describe('Hero Block Rendering', () => {
  it('renders correct HTML', () => {
    const attributes = {
      heading: 'Welcome',
      imageUrl: 'image.jpg'
    };
    // Assert rendered HTML
  });
});
```

### Block Attributes Test

```javascript
// tests/blocks/hero-block-attributes.test.js
describe('Hero Block Attributes', () => {
  it('validates required attributes', () => {
    const blockSettings = getBlockType('my-plugin/hero-block');
    // Verify attributes schema
  });
});
```

## Test Patterns for Themes

### Theme Support Test

```php
// tests/test-theme-support.php
public function test_block_theme_support() {
  $this->assertTrue( current_theme_supports( 'wp-block-styles' ) );
}
```

### Template Test

```php
// tests/test-templates.php
public function test_templates_exist() {
  $templates = glob( get_theme_file_path( '/templates/*.html' ) );
  $this->assertNotEmpty( $templates );
}
```

### theme.json Validation

```javascript
// tests/theme-json-valid.test.js
describe('theme.json', () => {
  it('has valid JSON structure', () => {
    const themeJson = require('../theme.json');
    // Verify structure
  });
  
  it('includes required settings', () => {
    // Check color, typography, spacing
  });
});
```

## Running Tests

> The commands in this and the following sections describe a downstream project with
> Jest, PHPUnit and Playwright configured. In this repository, `npm test` runs only the
> validator fixture tests listed at the top of this file.

### Before Commit

```bash
npm test
# The project's own test script; lefthook only runs it if you add it to pre-commit
```

### Before Push

```bash
npm test
# This repository's .lefthook.yml runs npm test on pre-push
```

### Manual Test Run

```bash
# Run all tests
npm test

# Run specific test file
npm test -- hero-block.test.js

# Run with coverage
npm test -- --coverage

# For PHP tests
composer test

# For E2E tests
npm run test:e2e
```

## Coverage Requirements

**Minimum coverage thresholds:**

- **Overall:** 70%
- **New code:** 80%
- **Critical paths:** > 85%
- **Statements:** 70%
- **Branches:** 65%
- **Functions:** 70%
- **Lines:** 70%

Verify coverage:

```bash
npm test -- --coverage

# Output:
# SUMMARY (after running unit tests):
# Statements   : 82.5% ( 99/120 )
# Branches     : 78.3% ( 47/60 )
# Functions    : 81.0% ( 17/21 )
# Lines        : 84.2% ( 106/126 )
```

## CI Integration

Tests run automatically via GitHub Actions:

### Pre-Commit Hook

```yaml
# .lefthook.yml
pre-commit:
  commands:
    test:
      run: npm test
```

### Pre-Push Hook

```yaml
pre-push:
  commands:
    test:
      run: npm test -- --coverage
```

### GitHub Actions

```yaml
# .github/workflows/test.yml
- name: Run Tests
  run: npm test

- name: Upload Coverage
  run: codecov
```

## Debugging Test Failures

### Test Timeout

```
Jest: Tests are timing out

Fix:
1. Increase timeout: jest.setTimeout(10000)
2. Check for unresolved promises
3. Verify mocks are working
```

### Mock Setup Issues

```
Error: Cannot find module when testing blocks

Fix:
1. Verify jest.config.js moduleNameMapper
2. Check WordPress mock setup
3. Import WordPress globals in test setup
```

### Block Type Not Found

```
Error: Block type 'my-plugin/hero-block' not found

Fix:
1. Verify block.json location
2. Ensure block register runs before test
3. Check registerBlockType is called
```

## Test Development Workflow

```
1. Write failing test
   ↓
2. Run tests to confirm failure
   ↓
3. Implement code to pass test
   ↓
4. Run tests to confirm pass
   ↓
5. Refactor if needed
   ↓
6. Commit with test coverage
```

## Integration with Release Skills

Tests are required before release:

```bash
# Pre-push validation runs tests
/pre-push-validation

# Release QA requires passing tests
/release-qa

# Full release requires test success
/release --dry-run
```

## Contributing Tests

To add new tests:

1. Create test file in `tests/` directory
2. Follow naming convention: `*.test.js` or `Test_*.php`
3. Write descriptive test names
4. Achieve > 70% coverage
5. Update this README if adding new test category

## See Also

- [[pre-push-validation]] — Tests required before push
- [[release-qa]] — Pre-release validation including tests
- [[release]] — Main release skill
- [Jest Documentation](https://jestjs.io/)
- [PHPUnit Documentation](https://phpunit.de/)
- [Playwright Documentation](https://playwright.dev/)
