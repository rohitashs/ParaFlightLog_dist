# Architecture Cross-Cutting: Security & Pilot Data Privacy

* **Status**: `Living Specification`
* **Parent Architecture**: [`Docs/Architecture/README.md`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Docs/Architecture/README.md)
* **Governing Tenet**: Tenet 1 (Single-Tenant Absolute Data Sovereignty)

---

## 1. Absolute Data Sovereignty

**ParaFlightLog** operates under a foundational privacy tenet:
* **Zero Telemetry**: The system contains no external analytics beacons, Google Analytics trackers, centralized crash reporters, or phone-home servers.
* **Single-Tenant Sandbox**: All flight records, aircraft details, credentials, and sensor streams live strictly within the pilot's own authenticated Google account (Google Drive and Google Sheets).
* **Open-Source Auditable**: Every line of code running in the pilot's container is 100% readable and auditable directly from the Google Apps Script script editor.

---

## 2. Pilot Personally Identifiable Information (PII) Protection

Free flight logbooks contain highly sensitive personal and physical telemetry:
* Home takeoff/landing coordinates.
* Emergency contact names, phone numbers, and relation.
* Medical information: blood type, severe allergies, health conditions.
* Live tracking URLs (Garmin inReach MapShare, Flymaster Live, XContest Live) and satellite beacon HEX IDs.

### Guardrail Policies:
1. **Never Leaked to Logs**: `Logger.gs` automatically redacts or isolates personal credentials; debug logging writes strictly to the pilot's private `Activity Logs` sheet.
2. **Template Sanitization**: When exporting sheets or configuration JSON snapshots (`SaveConfigDialog.html`), pilots can individually uncheck `Pilot Profile` to prevent sharing private credentials when sharing setup templates with flying club members.
3. **Git Pre-Commit Scanning**: Development workflows enforce scanning tools to ensure private pilot credentials and API keys are never committed to version control.

---

## 3. Google OAuth Scopes & Authorization Minimization

The application requests only the minimum required OAuth permissions, declared strictly in `Code/appsscript.json`:

| OAuth Scope | Purpose | Security Boundary |
| :--- | :--- | :--- |
| `.../auth/spreadsheets` | Read/write access to the active spreadsheet workbook. | Restricted to the logbook spreadsheet container. |
| `.../auth/drive` | Manage flight tracklog files in designated folders (`Master Log`, `Upload`, `Trash`, `Error`). | Limited strictly to folders declared in `Config`. |
| `.../auth/script.container.ui` | Display modal dialogs and the Universal Execution Sidebar. | Sandboxed within Google Sheets UI. |
| `.../auth/script.external_request` | Fetch weather from Open-Meteo and geocodes from OpenStreetMap. | Outbound HTTPS requests only. |

---

## 4. API Key & Credential Storage

Third-party API credentials (such as `VISUAL_CROSSING_API_KEY`) are managed strictly through two secure channels:
1. **`Config` Tab Parameter**: Stored in cell `Config!B` with soft cell protections.
2. **`PropertiesService.getUserProperties()`**: Pilot-specific private storage invisible to other shared spreadsheet viewers.
