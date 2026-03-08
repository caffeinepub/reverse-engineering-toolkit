# Reverse Engineering Toolkit v3

## Current State
The app is a full-stack RE toolkit with a Motoko backend storing analysis sessions (createSession, getSessions, deleteSession, clearAllSessions, updateSessionNote) and a React frontend with 9 pages:
- Dashboard (stats, quick launch, tool bar chart, sessions table with notes/delete/export)
- Binary Analyzer, String Extractor, Disassembler (x86/ARM/ARM64), Header Inspector, Pattern Scanner, Checksums, Deobfuscator, File Diff

Each tool logs sessions to the backend, supports JSON/CSV export, and session notes.

## Requested Changes (Diff)

### Add
- **YARA Rule Builder** (`/yara-rule`): A GUI builder to compose YARA-style detection rules. Inputs for rule name, metadata (author, description, date), string definitions (hex, text, regex), and a condition block editor. Live preview of the generated rule text. Export as `.yar` file. Session logging.
- **Hex Editor** (`/hex-editor`): Interactive hex editor. Paste or upload binary data. Display 16-byte-wide hex+ASCII grid. Allow users to click any byte and edit it. Highlight changed bytes in amber. Copy modified bytes as hex string. Export modified binary. Diff view toggled to show original vs. modified in a split pane. Session logging.
- **Entropy Heatmap** (`/entropy-heatmap`): Upload a binary file. Divide into 256-byte blocks and compute Shannon entropy per block. Render a color-coded heatmap (low entropy = cool colors, high entropy = hot colors like red for packed/encrypted sections). Show block index, entropy value, and classification (code/data/packed/encrypted) on hover. Export as PNG (canvas). Session logging.
- **Import Table Analyzer** (`/import-table`): Paste hex bytes of a PE binary's import section or load a file. Parse and display a table of DLL names, function names/ordinals, and hint values. Highlight suspicious imports (e.g., VirtualAlloc, WriteProcessMemory, CreateRemoteThread). Export as JSON/CSV. Session logging.
- **PE Resource Extractor** (`/pe-resources`): Paste or upload a PE binary. Parse the resource directory structure. List resource types (RT_ICON, RT_STRING, RT_MANIFEST, RT_VERSION, RT_DIALOG, etc.) with sizes and offsets. Allow extracting each resource as a binary blob download. Show a tree view of the resource directory. Session logging.

### Modify
- **App.tsx**: Add 5 new routes for all new tools.
- **Dashboard Quick Launch grid**: Add 5 new tool cards.
- **Dashboard tool bar chart**: Already dynamic — no changes needed.
- **Sidebar/Layout navigation**: Add new tools to the navigation list.

### Remove
- Nothing removed.

## Implementation Plan
1. Add 5 new page components (YaraRuleBuilder, HexEditor, EntropyHeatmap, ImportTableAnalyzer, PEResourceExtractor).
2. Update App.tsx with 5 new routes.
3. Update Dashboard.tsx tools array with 5 new entries.
4. Update Layout.tsx navigation links to include the 5 new tools.
5. Each tool must: accept file upload or text/hex paste, perform client-side analysis, display results, support JSON/CSV/file export where applicable, and log a session to the backend on completion.
