# Paragliding Flight Log Project Reboot

## Phase 1: Analysis & Documentation
- [x] **Analyze Source Materials**
    - [x] Review `Code_1.gs` and `Code_2.gs` for logic, overlaps, and conflicts.
    - [x] Review `OrigFeatures_specs.txt` and `features2.md` for requirements.
- [x] **Create Documentation**
    - [x] Create `Features.md`: Comprehensive feature list (Phase 1, 2, 3).
    - [x] Create `Technical_Specifications.md`: Detailed implementation logic and algorithms.
    - [x] Create `Setup_Guide.md`: Instructions for setting up from scratch.
- [x] **Review & Refine**
    - [x] Incorporate user feedback on documentation.

## Phase 2: Implementation (Fresh Start)
- [x] **Core Setup**
    - [x] Project scaffolding (Sheet structure, Properties, Menu).
    - [x] File watcher & Import logic (MD5 deduplication).
- [x] **Parser Module**
    - [x] Robust IGC parser (Header, Fix records, B-record validation).
    - [x] Support for ZIP/GZ archives.
- [x] **Analysis Engine**
    - [x] Track stats (Dist, Duration, Max Alt).
    - [x] Flight mode detection (Thermal, Glide, Soar).
    - [x] Flight Validation (Driving, Kiting, Short hop).
    - [x] XC Scoring (Free, Flat, FAI).
- [x] **Enrichment Services**
    - [x] Geocoding (Nominatim/OSM) & Site detection.
- [x] **Test Harness**
    - [x] Dedicated debug functions.
    - [x] Unit tests for parser and scoring logic.

## Phase 3: Deployment & Handoff
- [ ] **Deployment**
    - [ ] App Script Copy-Paste.
    - [ ] Run `scaffoldAll_`.
    - [ ] Run `runAllTests`.
