# Implementation Plan - Paragliding Flight Log v2.0

## Goal Description
Reboot the Paragliding Flight Log project by analyzing legacy code and documentation to produce a clean, robust specification and "fresh start" implementation. The goal is to eliminate past bugs (parsing issues) and ensure a maintainable, testable codebase.

## User Review Required
> [!IMPORTANT]
> This plan focuses on **documentation first**. No code will be written until the Features, Technical Specifications, and Setup Guide are approved.

## Phase 1: Analysis & Documentation (Current)
We will generate three key artifacts based on `Old Files/`:
1.  **Features.md**: A categorized list of features (Phase 1: Restore, Phase 2: Enhance, Phase 3: Future).
2.  **Technical_Specifications.md**: Detailed implementation logic and algorithms.
3.  **Setup_Guide.md**: A user-friendly guide for setting up the Google Sheet and Script from scratch.
    
## Phase 2: Fresh Implementation (Upcoming)
Once documentation is approved, we will build the solution in the `Code/` directory:
-   **Architecture**: Modular design (Parser, Scorer, Geo, UI).
-   **Test Harness**: A standalone `Test.gs` or similar to validate functions without processing entire log files.
-   **Robustness**: Improved error handling for malformed IGCs and API rate limits.

## Verification Plan
### Automated Tests
-   Create a `runTests()` function in the new codebase to verify:
    -   IGC Parsing logic (against valid/invalid sample strings).
    -   Distance calculation accuracy.
    -   Geocoding fallbacks.

### Manual Verification
-   User will follow the `Setup_Guide.md` to deploy a fresh instance.
-   Import a known set of `.igc` files (provided in `Old Files` or samples) to verify stats match expected values.
