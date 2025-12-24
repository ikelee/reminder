# Project Structure

This document describes the reorganized project structure.

## Directory Layout

```
reminder/
├── src/
│   ├── ui/              # Web UI code
│   │   ├── index.html
│   │   ├── style.css
│   │   ├── app.js
│   │   └── voiceInput.js
│   ├── cli/             # CLI interface
│   │   └── cli.js
│   ├── business/        # Business logic
│   │   ├── aiParser.js
│   │   └── obligationManager.js
│   ├── helpers/         # Utility functions
│   │   └── dateUtils.js
│   └── server.js        # Express server
├── tests/               # Test files
│   ├── test-runner.js
│   ├── test-cases.json
│   ├── test-cases-1.json
│   └── dateUtils.test.js
├── data/                # Data storage
│   └── obligations.json
└── package.json
```

## Key Changes

1. **Date Utilities Extracted**: Date-related logic moved from `aiParser.js` to `src/helpers/dateUtils.js`
2. **Comprehensive Tests**: Added `tests/dateUtils.test.js` with extensive end-of-year edge case tests
3. **Organized Structure**: Code separated into UI, CLI, business logic, and helpers
4. **Updated Paths**: All import paths updated to reflect new structure

## Running Tests

- **Date utilities**: `npm run test:date`
- **AI parser tests**: `npm test` or `npm test -- test-cases-1.json`

## Date Utility Tests

The date utility tests cover:
- Mid-year dates
- End of year (December 30, 31)
- New Year (January 1)
- Leap years (February 28/29)
- Month boundaries
- Weekday calculations

All tests handle timezone-aware date operations correctly.

