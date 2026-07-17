# Archived Documents

**Created:** 2026-07-18
**Purpose:** Compressed snapshots of documentation and BMad output artifacts

---

## Archives

| File | Contents | Original Size | Compressed |
|------|----------|---------------|------------|
| `bmad-output-2026-07-18.tar.gz` | Full `_bmad-output/` directory (planning, implementation, brainstorming artifacts) | ~1.2 MB | ~292 KB |
| `docs-2026-07-18.tar.gz` | Current `docs/` directory state (all documentation + diagrams) | ~176 KB | ~36 KB |

### bmad-output Archive Contents

```
_bmad-output/
├── planning-artifacts/          # Architecture, PRDs, epics, technical docs, approved diagrams
├── implementation-artifacts/    # 9 epic archives (45 story specs + 7 retrospectives), sprint status
├── brainstorming/               # Design brainstorming session logs
├── party-mode/                  # (empty)
├── test-artifacts/              # (empty)
└── project-context.md           # AI agent context file
```

### docs Archive Contents

```
docs/
├── index.md                     # Master documentation hub
├── project-overview.md          # Executive summary
├── architecture.md              # System architecture
├── api-reference.md             # API endpoint documentation
├── database-schema.md           # PostgreSQL + MongoDB + Redis schema
├── authentication-flows.md      # Auth flow documentation
├── key-management.md            # RSA key lifecycle
├── deployment.md                # Docker + deployment guide
├── development-guide.md         # Developer setup + workflow
├── retrospective-report.md      # Combined retro report + next steps
└── diagrams/                    # 15 Mermaid diagram files (.mmd)
```

---

## Restore Instructions

### Restore bmad-output

```bash
# From project root
tar -xzf docs/archived/bmad-output-2026-07-18.tar.gz .
```

### Restore docs snapshot

```bash
# WARNING: This overwrites current docs/ content
# Back up current docs first if needed
tar -xzf docs/archived/docs-2026-07-18.tar.gz .
```

### List archive contents without extracting

```bash
tar -tzf docs/archived/bmad-output-2026-07-18.tar.gz
tar -tzf docs/archived/docs-2026-07-18.tar.gz
```

---

## Notes

- Archives use gzip compression (`tar -czf`)
- The `docs/` archive excludes the `archived/` directory itself to avoid recursion
- The `bmad-output/` archive includes all files including hidden `.memlog.md` files
- Empty directories (`party-mode/`, `test-artifacts/`) are included in the archive for completeness
