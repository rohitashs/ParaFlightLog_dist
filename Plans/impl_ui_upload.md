# Implementation Plan - UI & Upload Features

## 1. Goal
Implement enhanced Admin tools, Menu restructuring, and a File Upload interface to improve usability and data ingestion options.

## 2. Menu & Admin Improvements ([CR-UI-004], [CR-CFG-003], [REQ-SYS-003])
*   **Menu Renaming**:
    *   `Setup & Tools` -> `Admin`.
    *   `Scaffold: ...` -> `First Time Setup`.
*   **New Admin Items**:
    *   `Update Watch Folder`: Prompts for URL, extracts ID, updates `WATCH_FOLDER_ID`.
    *   `Update Upload Folder`: Prompts for URL, extracts ID, updates `UPLOAD_FOLDER_ID`.
    *   `Enable Watch Folder`: Sets `ENABLE_WATCH_FOLDER = true`.
    *   `Disable Watch Folder`: Sets `ENABLE_WATCH_FOLDER = false`.
*   **Dialog Usability**:
    *   Ensure "Enter" key submits the dialog (Javascript `onkeyup` event in HTML output).

## 3. Watch Folder Logic ([CR-CFG-003])
*   **Lookups**: Add `ENABLE_WATCH_FOLDER` (default `false`) and `UPLOAD_FOLDER_ID`.
*   **Trigger Logic (`processWatchFolder_`)**:
    *   Read `ENABLE_WATCH_FOLDER`.
    *   If `false` (or 'No'), log "Watch Folder Disabled" and exit.
    *   If `true`, proceed with existing logic.

## 4. File Upload Feature ([CR-ING-002], [REQ-ING-003])
*   **Menu**: `Add Flight from Upload` -> Opens HTML Sidebar/Dialog.
*   **HTML UI (`Picker.html`)**:
    *   File Input (`<input type="file" multiple accept=".igc,.zip,.igx,.gz">`).
    *   "Upload" Button.
    *   Status Div (Progress/Result).
*   **Server-Side Handler (`handleFileUpload`)**:
    *   Receives form data (Blob).
    *   Saves file to `UPLOAD_FOLDER_ID` (or root if not set).
    *   **Immediate Processing**: Calls `processFlightFile(file)` for each uploaded file.
    *   Returns JSON summary: `{ uploaded: N, processed: N, flights: N, errors: [] }`.

## 5. Implementation Steps
1.  **Refactor Lookups**: Add new parameters to `scaffoldLookups_`.
2.  **Update `Code.gs`**:
    *   Update `onOpen` menu structure.
    *   Implement `uiSetFolder_` helpers (dialogs).
    *   Implement `uiToggleWatch_` helpers.
    *   Implement `showUploadDialog_`.
3.  **Create `Picker.html`**: New HTML file for the upload UI.
4.  **Update `Ingestion.gs`**:
    *   Modify `scanWatchFolder` to check `ENABLE_WATCH_FOLDER`.
    *   Implement `handleFileUpload` logic.

## 6. Verification
*   **Admin**: Change Folder IDs via menu -> Verify in Lookups.
*   **Toggle**: Disable Watch Folder -> Run "Scan Now" -> Verify it skips.
*   **Upload**: Upload IGC -> Verify it lands in Drive & Flight row created.
