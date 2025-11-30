---
description: Documentation Generation and Maintenance Workflow
---

# Documentation Workflow

## 1. Changelog Management

Maintain a `CHANGELOG.md` following the [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) format.

### Format
```markdown
## [Version] - Date
### Added
- New features
### Changed
- Changes in existing functionality
### Deprecated
- Features to be removed
### Removed
- Removed features
### Fixed
- Bug fixes
### Security
- Security updates
```

## 2. API Documentation

### JSDoc
Ensure all public functions and classes have JSDoc comments.

```javascript
/**
 * Calculates the total price.
 * @param {number} price - The base price.
 * @param {number} taxRate - The tax rate (0.0 to 1.0).
 * @returns {number} The total price including tax.
 */
function calculateTotal(price, taxRate) { ... }
```

### Auto-generation
Use tools like `jsdoc-to-markdown` or `swagger-markdown` to generate API docs from code/specs.

## 3. Best Practices

1.  **Proximity**: Keep documentation close to the code (comments/JSDoc).
2.  **Consistency**: Use consistent formatting.
3.  **Examples**: Include usage examples for libraries/APIs.
4.  **Updates**: Update docs *with* code changes, not after.
5.  **Versioning**: Version documentation alongside code.
