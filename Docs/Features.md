# Features & Capabilities

## Overview
This document describes the *intent* and *capabilities* of the Paragliding Flight Log system.
*   **Technical Spec**: See `Technical_Specification.md` for *how* it works.
*   **Requirements**: See `Backlog.md` for the status of these features (`RQ-*`).

---

## 1. 📂 Intelligent File Ingestion
*Maps to `RQ-ING-001`*

The system automates the import of flight logs (IGC) to reduce manual entry.
*   **Watch Folder**: Automatically detects and processes new files dropped into a designated Google Drive folder.
*   **Smart Deduplication**: Uses MD5 hashing and time-overlap detection to prevent duplicate entries.
*   **Multi-Source**: Supports Drag-and-Drop Uploads, Drive URL imports, and Bulk ZIP extraction.
*   **Parsing**: Extracts pilot details, glider type, and high-fidelity G-Record data (GNSS/Pressure altitude).
*   **Master Log Mirror**: Automatically copies and standardizes flight logs to a public folder (e.g. for SeeYou Cloud).

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
*   **Performance Metrics**: accurate calculation of Max Climb rates, Height Gains, and Thermal efficiency.
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
*   **Site Detection**: Identifies known Paragliding Takeoffs/Landings within 3km using OpenStreetMap data.
*   **Interactive Links**: Generates links to view the flight on SeeYou Cloud (planned).
*   **SeeYou Cloud Integration**: Valid flights are automatically uploaded to a public folder and linked directly to SeeYou Cloud for 3D visualization.

## 6. �️ User Interface (UI)
*Maps to `RQ-SYS-002`*

The visual layer where users interact with the data.
*   **Flights Tab**: The main logbook view. Uses a **2-Row Header** design (Category + Field) for clarity.
*   **Column Grouping**: Columns are physically grouped and colored by function (e.g. *Flight Info* is Blue, *Scoring* is Orange). Groups can be collapsed to reduce clutter.
*   **Menus**: A custom "Flight Log" menu provides one-click access to common actions (Add Flight, Upload, Update validation).
*   **Dialogs**: Custom HTML interfaces for File Uploads and URL imports, capable of handling complex interactions.
*   **Flight Inspector**: A dedicated sidebar to view, edit, and audit flight details without horizontal scrolling. Includes collapsible sections and direct SeeYou Cloud links.

## 7. 🛡️ Administration & Setup
*Maps to `RQ-SYS-001`*

Tools for managing the system's lifecycle.
*   **First Time Setup**: A "Scaffold" feature automatically creates all necessary sheets, headers, and validation rules if they are missing or deleted.
*   **Configuration**: A simpler `Parameters` sheet allows users to change system behavior (e.g. "Min Height Gain", "Watch Folder ID") without touching code.
*   **Maintenance**: Admin tools to "Reset System", "Reformat Sheets", and "Backup Data".
*   **Equipment Manager**: dedicated tabs for `Wings`, `Harnesses`, and `Reserves`. Rows added here immediately appear in the Flights dropdowns.

## 8. ⚙️ System Internals
*Maps to `RQ-ING-001`, `RQ-ANA-001`*

Under-the-hood capabilities that drive reliability.
*   **Automated Triggers**: Time-based triggers checking for new files in the background every hour (if enabled).
*   **Robust Logging**: A dedicated `Import_Log` tab (or `App_Log`) captures detailed success/failure messages, including specific API errors or validation reasons.
*   **Rate Limiting**: Intelligent caching and throttling to prevent hitting Google or OpenStreetMap API quotas.
*   **Unit Tests**: A comprehensive suite of tests (`Test.gs`) ensures parsing and scoring logic remains accurate during updates.
