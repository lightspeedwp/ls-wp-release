# Multi-Package Configuration Format

Complete reference for `.lightspeed/release-groups.json` configuration.

> **Note:** the `lspeed` command mentioned in this reference is not included in this repository. Treat its
> commands as illustrative of the intended workflow, not as something you can run today. The scripts in
> `scripts/` (`validate-package-group.js`, `check-cross-dependencies.js`) are the parts that exist.

## File Location
```
.lightspeed/
├── release-groups.json     # Multi-package release configuration
├── settings.json           # Global LightSpeed settings
└── ...
```

## Configuration Structure

### Root Object

```json
{
  "$schema": "https://lightspeedwp.agency/schemas/release-groups.json",
  "version": "1.0.0",
  "groups": [
    { /* release group object */ }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `version` | string | Yes | Config format version (currently `1.0.0`) |
| `groups` | array | Yes | Array of release group definitions |

---

## Release Group Object

```json
{
  "id": "blocks-and-theme",
  "name": "Block Plugin + Theme Release",
  "description": "Coordinated release of block plugin and companion theme",
  "active": true,
  "packages": [ /* package array */ ],
  "versionStrategy": "locked",
  "dependencies": [ /* dependency array */ ],
  "releaseOrder": [ "plugin", "theme" ],
  "sequencing": { /* sequencing config */ },
  "failureMode": "hold-release",
  "github": { /* GitHub config */ },
  "notifications": { /* notification config */ }
}
```

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique identifier for this release group |
| `name` | string | Yes | Human-readable name |
| `description` | string | No | Purpose of this group |
| `active` | boolean | No | Enable/disable without deleting (default: true) |
| `packages` | array | Yes | Packages that release together |
| `versionStrategy` | string | Yes | "locked" or "independent" |
| `dependencies` | array | No | Cross-package dependency definitions |
| `releaseOrder` | array | Yes | Ordered list of package IDs |
| `sequencing` | object | No | Timing and wait conditions |
| `failureMode` | string | No | Error handling strategy |
| `github` | object | No | GitHub-specific configuration |
| `notifications` | object | No | Notification settings |

---

## Package Object

```json
{
  "id": "my-blocks",
  "repo": "my-blocks-plugin",
  "type": "plugin",
  "path": ".",
  "versionFile": "my-blocks.php",
  "versionField": "Version",
  "changelog": "CHANGELOG.md",
  "tagPrefix": "v",
  "publishTargets": ["npm", "github"]
}
```

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Package identifier (used in releaseOrder) |
| `repo` | string | Yes | Repository name (GitHub repo name) |
| `type` | string | Yes | "plugin", "theme", or "library" |
| `path` | string | No | Path within repo (default: ".") |
| `versionFile` | string | Yes | File containing version number |
| `versionField` | string | Yes | Field/line pattern to find version |
| `changelog` | string | No | Changelog file path (default: "CHANGELOG.md") |
| `tagPrefix` | string | No | Git tag prefix (default: "v") |
| `publishTargets` | array | No | Where to publish: ["npm", "github", "wp-org"] |

### Version File Examples

**PHP Plugin (my-blocks.php)**:
```php
<?php
/**
 * Plugin Name: My Blocks
 * Version: 1.2.0
 */
```

Configuration:
```json
{
  "versionFile": "my-blocks.php",
  "versionField": "Version"
}
```

**CSS Theme (style.css)**:
```css
/*
Theme Name: My Theme
Version: 1.2.0
*/
```

Configuration:
```json
{
  "versionFile": "style.css",
  "versionField": "Version"
}
```

**JavaScript (package.json)**:
```json
{
  "name": "my-blocks",
  "version": "1.2.0"
}
```

Configuration:
```json
{
  "versionFile": "package.json",
  "versionField": "version"
}
```

---

## Dependency Object

```json
{
  "from": "my-theme",
  "to": "my-blocks",
  "type": "peer",
  "constraint": "^1.2.0",
  "constraintType": "semver",
  "optional": false,
  "breakingChangeAware": true
}
```

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `from` | string | Yes | Dependent package ID |
| `to` | string | Yes | Dependency package ID (or "wordpress") |
| `type` | string | Yes | "peer", "feature", "capability" |
| `constraint` | string | Yes | Version constraint (semver or min version) |
| `constraintType` | string | Yes | "semver", "min", "exact", "range" |
| `optional` | boolean | No | Optional dependency (default: false) |
| `breakingChangeAware` | boolean | No | Check for breaking changes (default: true) |
| `description` | string | No | Why this dependency exists |

### Dependency Types

**Peer Dependency**:
```json
{
  "type": "peer",
  "from": "my-theme",
  "to": "my-blocks",
  "constraint": "^1.2.0",
  "description": "Theme requires specific plugin version"
}
```

**Feature Dependency**:
```json
{
  "type": "feature",
  "from": "my-blocks",
  "to": "my-theme",
  "constraint": "custom-block-colors",
  "description": "Plugin features require theme to declare support"
}
```

**Capability Dependency**:
```json
{
  "type": "capability",
  "from": "my-blocks",
  "to": "wordpress",
  "constraint": "6.4",
  "description": "Plugin requires WordPress 6.4+"
}
```

---

## Sequencing Object

```json
{
  "sequencing": {
    "delayMs": 120000,
    "steps": [
      {
        "packageId": "my-blocks",
        "order": 1,
        "waitFor": ["npm-publish"],
        "postDelay": 120000
      },
      {
        "packageId": "my-theme",
        "order": 2,
        "dependsOn": ["my-blocks:tag"],
        "waitFor": ["github-release"]
      }
    ]
  }
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `delayMs` | number | Default delay between packages (milliseconds) |
| `steps` | array | Ordered release steps |

### Sequencing Step

| Field | Type | Description |
|-------|------|-------------|
| `packageId` | string | Package to release |
| `order` | number | Release sequence number |
| `waitFor` | array | Wait for these to complete: "npm-publish", "github-release", "tag-propagation" |
| `dependsOn` | array | Require these to exist: "my-blocks:tag", "my-blocks:github-release" |
| `postDelay` | number | Wait before next step (milliseconds) |

---

## Failure Mode Options

```json
{
  "failureMode": "hold-release"
}
```

| Mode | Behavior |
|------|----------|
| `hold-release` | Stop orchestration, ask user what to do |
| `retry-once` | Automatically retry failed package once |
| `rollback-all` | Rollback all packages if any fails |
| `release-solo` | Release successful packages, hold others |

---

## GitHub Configuration

```json
{
  "github": {
    "useMultiReleaseTag": true,
    "multiReleaseTagPattern": "{name}-v{version}",
    "linkedReleases": true,
    "releaseBodyTemplate": "multi-package-release.md",
    "draftRelease": true,
    "gracePeriodMs": 600000
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `useMultiReleaseTag` | boolean | Create unified release tag |
| `multiReleaseTagPattern` | string | Pattern for multi-release tag |
| `linkedReleases` | boolean | Link individual releases together |
| `releaseBodyTemplate` | string | Template file for release body |
| `draftRelease` | boolean | Create draft (don't announce yet) |
| `gracePeriodMs` | number | Time before announcing release |

---

## Notifications Configuration

```json
{
  "notifications": {
    "slackChannel": "#releases",
    "emailRecipients": ["team@example.com"],
    "githubTeams": ["@org/release-team"],
    "notifyOn": ["success", "failure", "rollback"]
  }
}
```

---

## Complete Example

```json
{
  "$schema": "https://lightspeedwp.agency/schemas/release-groups.json",
  "version": "1.0.0",
  "groups": [
    {
      "id": "hero-block-system",
      "name": "Hero Block Plugin + Theme",
      "description": "Coordinated release of hero block plugin and companion theme",
      "active": true,
      "packages": [
        {
          "id": "hero-blocks",
          "repo": "hero-blocks-plugin",
          "type": "plugin",
          "path": ".",
          "versionFile": "hero-blocks.php",
          "versionField": "Version",
          "changelog": "CHANGELOG.md",
          "publishTargets": ["npm", "github", "wp-org"]
        },
        {
          "id": "hero-theme",
          "repo": "hero-theme",
          "type": "theme",
          "path": ".",
          "versionFile": "style.css",
          "versionField": "Version",
          "changelog": "CHANGELOG.md",
          "publishTargets": ["github"]
        }
      ],
      "versionStrategy": "locked",
      "dependencies": [
        {
          "from": "hero-theme",
          "to": "hero-blocks",
          "type": "peer",
          "constraint": "^1.5.0",
          "constraintType": "semver",
          "description": "Theme requires hero block plugin for styles"
        },
        {
          "from": "hero-blocks",
          "to": "wordpress",
          "type": "capability",
          "constraint": "6.4",
          "constraintType": "min",
          "description": "Plugin uses Block Bindings API (6.4+)"
        }
      ],
      "releaseOrder": ["hero-blocks", "hero-theme"],
      "sequencing": {
        "delayMs": 120000,
        "steps": [
          {
            "packageId": "hero-blocks",
            "order": 1,
            "waitFor": ["npm-publish"],
            "postDelay": 120000
          },
          {
            "packageId": "hero-theme",
            "order": 2,
            "dependsOn": ["hero-blocks:tag"],
            "waitFor": ["github-release"]
          }
        ]
      },
      "failureMode": "hold-release",
      "github": {
        "useMultiReleaseTag": true,
        "multiReleaseTagPattern": "blocks-v{version}",
        "linkedReleases": true,
        "draftRelease": true,
        "gracePeriodMs": 600000
      },
      "notifications": {
        "slackChannel": "#releases",
        "emailRecipients": ["ashley@lightspeedwp.agency"],
        "notifyOn": ["success", "failure"]
      }
    }
  ]
}
```

---

## Validation Rules

The configuration is validated against these rules:

1. **Uniqueness**: `id` must be unique across all groups
2. **Package References**: All package IDs in `releaseOrder` and dependencies must be defined
3. **Version Files**: Version files must exist in each package repository
4. **Constraints**: Dependency constraints must be valid semver or version strings
5. **Circular Dependencies**: No circular dependency chains allowed
6. **Ordering**: Packages in `releaseOrder` must respect dependency order
7. **Strategy Consistency**: `versionStrategy` must be "locked" or "independent"

---

## JSON Schema

Full JSON schema available at:
```
https://lightspeedwp.agency/schemas/release-groups.json
```

Validate your configuration:
```bash
lspeed release --validate-config .lightspeed/release-groups.json
```
