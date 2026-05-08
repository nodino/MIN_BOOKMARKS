# MIN MARKERS - User Manual

Version: **1.0.11**

_For detailed architecture, design decisions, and component internals, see the **Technical Documentation**: `DOCS/TECHNICAL_DOCUMENTATION_EN.md`._

## Overview
**MIN MARKERS** is a professional timecode logging and marker application operating in **Free Run** mode as a standalone timing tool. It enables rapid creation, management, and color‑coding of event markers and supports export to Adobe Premiere Pro.

## Modes

### Free Run Mode
Stand‑alone mode where you manually control the timecode without needing external hardware.
- **Start Time:** Enter your desired start timecode (e.g., `10:00:00:00`) in the input box provided.
- **Framerate:** Select your project's framerate (23.98, 24, 25, 29.97, 30, 50, 59.94, 60) from the dropdown. This ensures accurate timecode calculation.
- **Start / Pause:** Click the **Start** button to run the timecode. You can pause and resume as needed.
- **Reset:** Click **Reset** to return the timecode to your chosen start time.

## Creating & Managing Markers

**1. Live Entry (Manual Type)**
- Focus on the main text input field.
- Type your comment and press **Enter**.
- Before logging, you can assign a color (Accent, Blue, Purple) to help visualize different types of events (e.g., Errors, Highlights, Starts).

**2. Instant Actions Grid**
Quickly tap pre-configured buttons in the "Instant Actions" area to log a marker with a single click.

**3. Editing Markers**
You can modify any logged marker directly in the **Session History**:
- Hover over a marker and click the **Pencil icon**.
- Update the text or the timecode as needed.
- Click the **Check icon** to save or **X** to cancel.

**4. Keyboard Shortcuts**
- Connect actions to specific Function keys (`F1`, `F2`, ... `F8`).
- Pressing a configured function key will instantly log the current timecode with the associated description.
- To configure shortcuts:
  1. Click **Config** (the gear icon on the sidebar).
  2. Map function keys to your preferred note names.
  3. Click **Save Configuration**.

## Exporting for Post-Production
Once your session is complete, you can download all recorded markers into professional post-production formats.
1. Select your preferred format: **CSV**, **XML**, or **SRT**. 
   - **CSV:** Generates standard spreadsheet columns compatible with Adobe Premiere Pro and other NLEs.
   - **XML:** Generates an Apple FCP XML document for direct timeline import.
   - **SRT:** Generates a standard SubRip subtitle file (e.g., for closed captions or specific VFX review tools).
2. Click **Download for Premiere**.
3. A file will securely download to your computer, containing your markers exactly at the saved timecodes.

## Session Management
- **Clear Markers:** Click **Clear** (trash icon) from the sidebar to completely wipe your session history. Ensure you export first if you need to keep data.
- **Sync Logging:** Toggling the **Sync / Free** status on the sidebar dictates whether markers must be restricted to active tracking times. If in "Sync" mode, markers can only be logged when the timecode is actively running (or Tricaster is recording).

## Server Shutdown (Windows executable)

When the application runs as the packaged `min-markers.exe`, a **Shutdown** button appears in the UI (top‑right corner). Clicking it opens a confirmation modal; confirming sends a `POST /api/shutdown` request to the server. The server then stops gracefully after a short delay. This provides a clean way to stop the app without terminating the console manually.

