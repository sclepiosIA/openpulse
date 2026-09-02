# Playwright Tests for Marque Compass

## Overview
This directory contains end-to-end tests using Playwright to ensure critical user journeys work correctly.

## Test Scenarios

### 1. Authentication (`auth.spec.ts`)
- ✅ Login with valid credentials
- ✅ Error handling for invalid credentials  
- ✅ Logout functionality

### 2. Task Management (`task-management.spec.ts`)
- ✅ Create new task
- ✅ Filter tasks by status
- ✅ Mark task as completed

### 3. Establishment Search (`establishment-search.spec.ts`)
- ✅ Search establishments by name
- ✅ Filter by status
- ✅ Display establishment details
- ✅ Handle empty search results
- ✅ Clear search functionality

## Running Tests

### Locally
```bash
# Install Playwright
npm install @playwright/test

# Install browsers
npx playwright install

# Run all tests
npx playwright test

# Run tests in headed mode
npx playwright test --headed

# Run specific test file
npx playwright test auth.spec.ts

# Run tests in debug mode
npx playwright test --debug
```

### In CI
Tests run automatically on:
- Push to main/develop branches
- Pull requests

Reports are uploaded as GitHub Actions artifacts.

## Configuration

### Browser Support
- Chromium (Desktop)
- Firefox (Desktop)  
- WebKit/Safari (Desktop)
- Mobile Chrome (Pixel 5)
- Mobile Safari (iPhone 12)

### Test Features
- **Parallel execution**: Tests run in parallel for speed
- **Retry on failure**: 2 retries in CI environment
- **Screenshots**: Captured on test failure
- **Video recording**: Retained on failure
- **Tracing**: Available for debugging
- **HTML Reports**: Generated with detailed results

### Environment Variables
- `CI`: Enables CI-specific settings (retries, reporters)

## Best Practices

### Selectors
Tests use resilient selectors:
- Text content when possible
- Data attributes (`data-testid`)
- ARIA labels
- Fallback to CSS selectors

### Waiting Strategy
- `waitForSelector()` for dynamic content
- `waitForURL()` for navigation
- `waitForTimeout()` only when necessary

### Test Isolation
- Each test starts fresh
- Authentication handled per test
- No shared state between tests

## Debugging

### Local Debugging
```bash
# Step through tests
npx playwright test --debug

# Generate trace for failed tests
npx playwright test --trace on

# Show test report
npx playwright show-report
```

### CI Debugging
1. Download artifacts from failed CI runs
2. Open `playwright-report/index.html`
3. View screenshots, videos, and traces

## Updating Tests

When adding new features:
1. Add corresponding E2E tests
2. Use semantic selectors (data-testid, ARIA)
3. Test critical user paths
4. Ensure mobile compatibility

## Performance

Current test suite runs in ~2-3 minutes with:
- 3 test files
- 12 test scenarios
- 5 browser configurations
- Parallel execution enabled