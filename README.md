# 🪂 ParaFlightLog

> **Your Flight Data. Sovereign. Intelligent. Infinitely Extensible.**
> 
> *An enterprise-grade, serverless paragliding flight analytics, gear lifecycle, and automation engine running 100% inside your personal Google Workspace. Zero subscription fees. Zero third-party databases. Complete data sovereignty.*

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Google Apps Script](https://img.shields.io/badge/Runtime-Apps%20Script%20V8-4285F4.svg?logo=google)](https://developers.google.com/apps-script)
[![Google Sheets](https://img.shields.io/badge/Database-Google%20Sheets-34A853.svg?logo=googlesheets)](https://www.google.com/sheets/about/)
[![Gemini Ready](https://img.shields.io/badge/AI-Gemini%20Native-8E24AA.svg?logo=googlebard)](https://gemini.google.com/)

---

## 📖 Complete Documentation Hub

ParaFlightLog follows an industry-standard, 5-tier documentation architecture catering to pilots, contributors, software architects, and AI assistants:

| Tier | Document | Purpose & Target Audience |
| :---: | :--- | :--- |
| **Tier 1: Strategic Vision** | [**Strategic Roadmap**](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Docs/Roadmap.md) | The 5 Evolution Horizons (H1–H5), Open-Source Charter, Non-Negotiable Tenets & Governance. |
| **Tier 2: Public Manifesto** | [**Product Brochure**](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Docs/Brochure.md) | High-level platform whitepaper, Gemini AI advantages, "Why Sheets + Apps Script", and future horizons. |
| **Tier 3: Product Capabilities** | [**Features & Capabilities**](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Docs/Features.md)<br>[**User Guide**](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Docs/User_Guide.md) | **Features**: Complete functional capability catalog.<br>**User Guide**: Step-by-step pilot handbook, operations manual, and metric dictionary. |
| **Tier 4: Architecture & Specs** | [**Systems Architecture**](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Docs/Architecture.md)<br>[**Technical Specification**](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Docs/Technical_Specification.md)<br>[**Formal Designs (`Docs/Design/`)**](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Docs/Design/README.md) | **Architecture**: C4 topology, ERD model, unified data dictionary, execution lifecycles, and security.<br>**Tech Specs**: Low-level math algorithms, function indexes, and module references.<br>**Design**: RFC specifications ([DSGN-AUT-001](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Docs/Design/DSGN-AUT-001_Table_Driven_Automation_Engine.md), [DSGN-UI-001](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Docs/Design/DSGN-UI-001_Tri_Mode_Execution_and_Universal_Sidebar.md)). |
| **Tier 5: Execution & Memory** | [**Backlog**](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Docs/Backlog.md)<br>[**ChangeLog**](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Docs/ChangeLog.md)<br>[**Context**](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Docs/Context.md) | **Backlog**: Actionable Requirements (`RQ`), Change Requests (`CR`), and Bugs.<br>**ChangeLog**: Historical release log.<br>**Context**: Ways of Working, agent memory, and engineering SOPs. |

---

## ⚡ Core Features at a Glance

* **Multi-Source Ingestion**: Drag-and-drop web uploader, Drive folder/URL import, multi-archive (`.zip`/`.gz`) extraction, and automatic background Watch Folder scanning.
* **Aeronautical Physics Engine**: Automatic sliding-window flight mode classification (Thermal, Soaring, Glide), climb/sink rate calculation, and glide ratio ($L/D$) diagnostics.
* **FAI Cross-Country Scoring**: Trajectory simplification via Ramer-Douglas-Peucker (RDP) and brute-force 3-Turnpoint optimization for Free Flight, Out-and-Return, Flat Triangle, and FAI Triangle scoring.
* **Automated Weather & Geo Enrichment**: Automatic Open-Meteo historical backfill (surface winds, gusts, temps, cloud cover %, Lawrence cloudbase) and OpenStreetMap takeoff/landing site resolution.
* **Competition & 3D Sync**: Direct XContest.org flight verification with 14-day claiming deadline alerts, and one-click 3D visualization on SeeYou Cloud.
* **Cockpit Dashboard & Currency**: Resilient 6-column dashboard with KPI summary banners, rolling 6-month pilot currency alerts (Green/Yellow/Orange), and an 8-card dynamic leaderboard matrix.
* **Tri-Mode Execution**: Run operations in a standard modal, dock them to a modeless sidebar while editing flights, or dispatch them headlessly into a time-budgeted background queue.
* **Native Gemini AI Analysis**: Interrogate your flight data with natural language prompts directly in Google Sheets.

---

## 🚀 Quick Start in 3 Minutes

1. **Copy the Sheet**: Open the Golden Starter Template and select `File > Make a copy` into your Google Drive.
2. **First-Time Setup**: Click `Flight Log > First-Time Setup Wizard` from the spreadsheet menu and select your storage folders.
3. **Drop Flight Logs**: Drag and drop your `.igc` files or paste a Google Drive folder link into the uploader.
4. **View Dashboard**: Open the `Dashboard` tab to see your career statistics, recent airtime currency, and personal leaderboards!

---

## 🛡️ License

This project is licensed under the **MIT License** — free for personal, commercial, and educational use. See [Docs/Roadmap.md](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Docs/Roadmap.md) for details on our open-source charter and community governance.
