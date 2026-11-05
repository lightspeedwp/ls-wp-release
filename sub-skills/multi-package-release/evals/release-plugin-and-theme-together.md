# Test Case: Release Plugin and Theme Together

## Scenario
Coordinate a synchronized release of a WordPress block plugin and companion theme with locked versioning.

> **Note:** the `lspeed` command used in this test case is not included in this repository. Treat its commands
> and outputs as illustrative of the intended workflow, not as something you can run today.

## Setup

### Initial State
- **Plugin**: `my-blocks` v1.1.0 (previous)
- **Theme**: `my-theme` v1.1.0 (previous)
- Target: Release both at v1.2.0
- Version strategy: **locked** (identical versions)

### Release Config
```json
{
  "group": "blocks-and-theme",
  "packages": [
    {
      "repo": "my-blocks",
      "type": "plugin",
      "releaseOrder": 1
    },
    {
      "repo": "my-theme",
      "type": "theme",
      "releaseOrder": 2
    }
  ],
  "versionStrategy": "locked",
  "dependencies": [
    {
      "from": "my-theme",
      "to": "my-blocks",
      "constraint": "^1.2.0"
    }
  ]
}
```

### Changes Included
**Plugin (my-blocks v1.2.0)**:
- Add new testimonial block
- Fix column alignment on mobile
- Update block documentation
- 5 commits since v1.1.0

**Theme (my-theme v1.2.0)**:
- Add testimonial block styles
- Update color palette
- Add custom block patterns
- 3 commits since v1.1.0

---

## Test Execution Steps

### Step 1: Validate Preparation
Command:
```bash
lspeed release --group blocks-and-theme --prepare
```

Expected Behavior:
- ✓ Both repositories checked out
- ✓ Working trees are clean
- ✓ No uncommitted changes
- ✓ Versions read: plugin=1.1.0, theme=1.1.0
- ✓ Target versions confirmed: plugin=1.2.0, theme=1.2.0

### Step 2: Validate Dependencies
Command:
```bash
lspeed release --group blocks-and-theme --validate-deps
```

Expected Behavior:
- ✓ Theme's package.json peerDependencies includes: `"@lspeed/blocks": "^1.2.0"`
- ✓ Plugin v1.2.0 satisfies theme requirement
- ✓ Both require WordPress 6.4+
- ✓ No breaking changes between versions

### Step 3: Generate Unified Changelog
Command:
```bash
lspeed release --group blocks-and-theme --generate-changelog
```

Expected Output:
```markdown
## [1.2.0] - 2024-01-15 (Block System Release)

### Plugin: my-blocks v1.2.0
- ✨ Add new testimonial block
- 🐛 Fix column alignment on mobile
- 📚 Update block documentation

### Theme: my-theme v1.2.0
- ✨ Add testimonial block styles
- 💅 Update color palette
- 🎨 Add custom block patterns

### Compatibility
- Both packages require WordPress 6.4+
- Install plugin first, then theme
```

### Step 4: Execute Coordinated Release
Command:
```bash
lspeed release --group blocks-and-theme --execute
```

Expected Execution Order:
1. **Plugin Release (my-blocks v1.2.0)**
   - ✓ Version bumped: 1.1.0 → 1.2.0 in my-blocks.php
   - ✓ Changelog updated
   - ✓ git commit: "Release my-blocks v1.2.0"
   - ✓ git tag: v1.2.0 created
   - ✓ git push to origin
   - ✓ npm publish: @lspeed/blocks@1.2.0
   - ✓ GitHub Release created with changelog
   - ⏳ Wait for npm publish to complete (verify on npm registry)

2. **Sequencing Delay** (2 minutes)
   - Allows npm edge caching
   - Prevents race conditions

3. **Theme Release (my-theme v1.2.0)**
   - ✓ Version bumped: 1.1.0 → 1.2.0 in style.css
   - ✓ Changelog updated
   - ✓ git commit: "Release my-theme v1.2.0"
   - ✓ git tag: v1.2.0 created
   - ✓ git push to origin
   - ✓ GitHub Release created with changelog
   - ✓ Linked to plugin release

4. **Multi-Package Release**
   - ✓ GitHub Release created: "Block System v1.2.0"
   - ✓ Release body includes:
     - Plugin: https://github.com/org/my-blocks/releases/tag/v1.2.0
     - Theme: https://github.com/org/my-theme/releases/tag/v1.2.0
     - Installation instructions
     - Breaking changes (if any)

### Step 5: Verify Completion
Command:
```bash
lspeed release --group blocks-and-theme --status
```

Expected Output:
```
Multi-Package Release: blocks-and-theme ✓

Package Status:
├─ my-blocks v1.2.0
│  ├─ GitHub: ✓ Released
│  ├─ npm: ✓ Published
│  └─ git tag: ✓ v1.2.0
│
└─ my-theme v1.2.0
   ├─ GitHub: ✓ Released
   ├─ git tag: ✓ v1.2.0
   └─ linked: ✓ Cross-referenced

Release Links:
- Plugin: https://github.com/org/my-blocks/releases/tag/v1.2.0
- Theme: https://github.com/org/my-theme/releases/tag/v1.2.0
- Unified: https://github.com/org/my-blocks/releases/tag/blocks-v1.2.0
```

---

## Acceptance Criteria

✓ Both packages released simultaneously with identical version numbers  
✓ Plugin released first, theme released second  
✓ Dependencies validated before any release  
✓ Unified changelog includes entries from both packages  
✓ GitHub Releases created for both packages  
✓ Multi-package Release links both individual releases  
✓ npm registry shows plugin v1.2.0  
✓ WordPress.org plugin directory shows v1.2.0 (if applicable)  
✓ Release notes explain why packages move together  

---

## Rollback Test

If needed to verify rollback functionality:

```bash
lspeed release --group blocks-and-theme --rollback
```

Expected:
- ✓ Git tags deleted: v1.2.0 (both repos)
- ✓ GitHub Releases deleted
- ✓ npm unpublish: @lspeed/blocks@1.2.0
- ✓ Versions reverted to 1.1.0
- ✓ All packages back to pre-release state
