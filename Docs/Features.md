# Features & Capabilities

## Overview
This document describes the *intent* and *capabilities* of the Paragliding Flight Log system.
*   **Technical Spec**: See `Technical_Specification.md` for *how* it works.
*   **Requirements**: See `Backlog.md` for the status of these features (`RQ-*`).

---

## 1. 📂 Intelligent File Ingestion
*Maps to `RQ-ING-001`*

The system automates the import of flight logs (IGC) to reduce manual entry.
*   **Watch Folder**: Automatically detects and processes new files dropped into one or more designated Google Drive folders (comma-separated list supported).
*   **Recursive Traversal**: Recursively scans all subfolders up to 10 levels deep for supported files (`.igc`, `.igx`, `.zip`, `.gz`).
*   **Smart Deduplication**: Uses MD5 hashing and time-overlap detection to prevent duplicate entries.
*   **Multi-Source**: Supports Drag-and-Drop Uploads, Drive Folder/File URL imports, and Bulk ZIP extraction.
*   **Parsing**: Extracts pilot details, glider type, and high-fidelity G-Record data (GNSS/Pressure altitude).
*   **Master Log Mirror**: Automatically copies and standardizes flight logs to a public folder (e.g. for SeeYou Cloud and direct download).
*   **Automated Cleanup**: Moves successfully processed files out of source folders (trashed once preserved in Master Log) and moves corrupt/errored files into the designated Error Folder.

## 2. ✈️ Automated Flight Logging
*Maps to `RQ-ING-002`*

Converts raw data into a structured Pilot Logbook in Google Sheets.
*   **Auto-Summary**: Generates human-readable summaries (e.g. "2h 10m XC at Bir Billing").
*   **Data Validation**: Flags flights as `Needs Review`, `Valid`, or `Invalid` based on heuristic checks (e.g. Flight looks like a car drive).
*   **Gear Tracking**: Auto-fills Wing, Harness, and Reserve based on the last valid flight ("Sticky Defaults") or IGC headers.
*   **Snapshotting**: Records equipment performance metrics (e.g. Trim Speed, Glide) at the time of the flight.

## 3. 📊 Flight Analysis
*Maps to `RQ-ANA-001`, `RQ-ANA-002`*

Analyzes the track log to understand *how* you flew.
*   **Mode Detection**: Automatically classifies segments as **Thermal** (Circling), **Soaring** (Ridge), **Glide** (Transition), or **Sink**.
*   **Performance Metrics**: accurate calculation of Max Climb rates, Height Gains, Soar Efficiency (m/km), and in-flight Glide L/D.
*   **Safety Checks**: Flags abnormally high sink rates or ground proximity events.

## 4. 🏆 XC Scoring (League Rules)
*Maps to `RQ-SCR-001`*

Applies standard XContest/FAI scoring rules to every flight.
*   **Optimization**: Finds the optimal 3 Turnpoints to maximize distance.
*   **Triangle Detection**: Identifies **Flat Triangles** (<20% gap) and **FAI Triangles** (strict leg geometry).
*   **Scoring**: Calculates points with appropriate multipliers (e.g. 1.4x for FAI Triangle).

## 5. 📍 Geo-Spatial Enrichment
*Maps to `RQ-SCR-002`*

Adds location context to raw GPS coordinates.
*   **Reverse Geocoding**: Converts Lat/Lon to "Nearest Town, Region, Country".
*   **Site Detection**: Identifies known Paragliding Takeoffs/Landings within search radius using Paragliding Earth (primary) with OpenStreetMap Overpass API fallback.
*   **Interactive Links**: Generates links to view the flight on SeeYou Cloud (planned).
*   **SeeYou Cloud Integration**: Valid flights are automatically uploaded to a public folder and linked directly to SeeYou Cloud for 3D visualization.

## 6. �️ User Interface (UI)
*Maps to `RQ-SYS-002`*

The visual layer where users interact with the data.
*   **Flights Tab**: The main logbook view. Uses a **2-Row Header** design (Category + Field) for clarity, with Cell A2 providing a direct hyperlink to the Master Flight Log Drive folder.
*   **Column Grouping**: Columns are physically grouped and colored by function (e.g. *Flight Info* is Blue, *Scoring* is Orange). Groups can be collapsed to reduce clutter.
*   **Download & Visualization Links**: `FlightID` links directly to SeeYou Cloud 3D visualization, while `Flight No` wraps sequential numbering with a direct download hyperlink to the master IGC file.
*   **Header Tooltips**: Header cells on Row 4 contain cell notes (e.g. "Click to view flight" and "Click to download igc") for intuitive guidance.
*   **Menus**: A custom "Flight Log" menu provides one-click access to common actions (Add Flight, Upload, Update validation).
*   **Dialogs**: Custom HTML interfaces for File Uploads and "Add files from URL (folder, igc, zip)" supporting both manual URL/ID entry and native Google Drive folder exploration with optional "Delete from source" cleanup.
*   **Flight Inspector**: A dedicated sidebar to view, edit, and audit flight details without horizontal scrolling. Includes collapsible sections and direct SeeYou Cloud links.
*   **Flight Maintenance & Bulk Operations (`RQ-SYS-007`)**: A planned unified modal dialog to execute bulk operations across all or selected flights (recomputing physics/modes, recalculating XC score, backfilling missing Town/Country/Site geo data, re-checking XContest status, and sorting flights by date).

## 7. 📊 Flight Dashboard
*Maps to `RQ-SYS-005`*

A high-level dashboard providing visual metrics and summaries.
*   **Master Log Folder Link**: Row 2 features a prominent direct hyperlink to the Master Flight Log Google Drive folder.
*   **Key Metrics**: Total Flights, Hours, Distance.
*   **Top Lists**: Longest flights, furthest distance, and favorite sites.
*   **Geography**: Breakdown of flights by country.
*   **Recent Activity**: Quick view of flights in the last week/month/quarter.

## 8. 🛡️ Administration & Setup
*Maps to `RQ-SYS-001`, `RQ-SYS-008`*

Tools for managing the system's lifecycle.
*   **In-App Folder Picker**: Built-in Drive folder browser dialog allowing users to navigate "My Drive", drill down into subfolders, verify URLs/IDs, and select folders with "Replace" or "Add to List" actions.
*   **Human-Readable Path Enrichment**: Folder parameter updates automatically write human-readable folder breadcrumb paths (`[Path: My Drive / ...]`) to the `Description` column in the `Parameters` sheet.
*   **First Time Setup & Scaffold**: A "Scaffold" feature automatically creates all necessary sheets, headers, and validation rules if they are missing or deleted.
*   **Interactive Setup Wizard & Templating (`RQ-SYS-008`)**: Streamlined onboarding workflow designed to replace manual script setup with a copyable sheet template and an interactive setup wizard guiding initial folder configuration, pilot credentials, equipment defaults, and trigger installation.
*   **Configuration**: A simpler `Parameters` sheet allows users to change system behavior (e.g. "Min Height Gain", "Watch Folder ID") without touching code.
*   **Maintenance**: Admin tools to "Reset System", "Reformat Sheets", and "Backup Data".
*   **Equipment Manager**: dedicated tabs for `Wings`, `Harnesses`, and `Reserves`. Rows added here immediately appear in the Flights dropdowns.

## 9. ⚙️ System Internals
*Maps to `RQ-ING-001`, `RQ-ANA-001`*

Under-the-hood capabilities that drive reliability.
*   **Automated Triggers**: Time-based triggers checking for new files in the background every hour (if enabled).
*   **Robust Logging**: A dedicated `Import_Log` tab (or `App_Log`) captures detailed success/failure messages, including specific API errors or validation reasons.
*   **Rate Limiting**: Intelligent caching and throttling to prevent hitting Google or OpenStreetMap API quotas.
*   **Unit Tests**: A comprehensive suite of tests (`Test.gs`) ensures parsing and scoring logic remains accurate during updates.

## 10. 📖 User Guide & Onboarding
*Maps to `RQ-SYS-006`*

Comprehensive documentation designed to guide pilots from initial setup to day-to-day operation.
*   **In-App User Guide Tab (`RQ-SYS-006.1`)**: A dedicated sheet tab within the Google Sheet containing structured reference documentation: System Overview, Initial Setup, Normal Flight Logging Usage, and System Maintenance/Troubleshooting.
*   **External Onboarding Guide (`RQ-SYS-006.2`)**: A standalone document (viewable in Markdown/web) containing the high-level system overview, prerequisites, and initial setup steps so new pilots can review and prepare before creating their Google Sheet.

