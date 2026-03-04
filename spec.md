# Reverse Engineering Toolkit

## Current State
New project. No existing code.

## Requested Changes (Diff)

### Add
- Desktop-style dashboard layout with sidebar navigation
- Binary/File Analyzer tool: upload a file, display hex dump, ASCII view, file metadata (size, type, magic bytes, entropy)
- String Extractor tool: extract printable strings from binary input, filter by min length, display offset + string
- Disassembler viewer tool: paste or upload binary, view mock disassembly output (x86/x64 instruction-like display)
- PE/ELF Header Inspector: parse and display structured header fields from uploaded binary (sections, imports, exports, entry point)
- Pattern/Signature Scanner: input hex pattern, scan uploaded file, show matching offsets
- Dashboard home: summary cards showing recent activity, tool usage counts, and quick-launch shortcuts
- Persistent analysis sessions stored in backend (file name, tool used, timestamp, result summary)
- Sidebar navigation linking to each tool and the dashboard
- Top bar with app title and session info

### Modify
- N/A (new project)

### Remove
- N/A (new project)

## Implementation Plan
1. Backend (Motoko):
   - Store analysis session records: id, filename, tool, timestamp, resultSummary
   - CRUD: createSession, getSessions, deleteSession
   - Store tool usage counters per tool type
   - getStats: return counts per tool and total sessions

2. Frontend:
   - App shell: fixed sidebar + top bar + main content area (desktop layout)
   - Dashboard page: stat cards (total sessions, tool usage), recent sessions table, quick-launch buttons
   - Binary Analyzer page: file upload, hex dump display, ASCII panel, metadata display
   - String Extractor page: file upload or text input, extracted strings list with offset
   - Disassembler page: binary input, styled instruction listing (address | opcode | mnemonic)
   - Header Inspector page: file upload, parsed sections/imports table
   - Pattern Scanner page: hex pattern input, file upload, results list with offsets
   - All tools save a session record to backend on analysis
