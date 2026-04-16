---
name: migrate-endpoint-to-postman
description: Migrate .NET API endpoints to Postman collection. Supports multiple input modes — single API Code, multiple API Codes, single Controller, multiple Controllers, controller folder, or spec-only. Only migrates endpoints with API Spec documents by default.
disable-model-invocation: false
argument-hint: "<targets> --folder-id <id> [--dry-run] — targets can be API codes (MM0046), controllers (path.cs), folder path, or comma-separated list"
user-invocable: true
---

# Migrate Endpoint to Postman — `/migrate-endpoint-to-postman $ARGUMENTS`

Extract API endpoints and sync them to a Postman collection folder. Supports multiple input modes.

## Input Modes

### Mode 1: Single API Code
```bash
/migrate-endpoint-to-postman MM0046 --folder-id <id>
```
- Find the controller containing this API Code
- Extract only that endpoint from the controller
- Read API Spec `MM0046-API-*.md` for enrichment
- Create one Postman request

### Mode 2: Multiple API Codes (comma-separated)
```bash
/migrate-endpoint-to-postman MM0046,MM0047,MM0048 --folder-id <id>
```
- For each API Code: find controller, extract endpoint, read spec
- May span multiple controllers — that's OK
- Create one Postman request per API Code

### Mode 3: Single Controller
```bash
/migrate-endpoint-to-postman src/backend/Feec.Master/src/Api/Controllers/V1/ConstructionsController.cs --folder-id <id>
```
- Read controller, extract ALL endpoints with API Codes
- Validate each has an API Spec (skip those without)
- Create Postman requests for all qualified endpoints

### Mode 4: Multiple Controllers (comma-separated)
```bash
/migrate-endpoint-to-postman ConstructionsController.cs,PaintedAreasController.cs --folder-id <id>
```
- Short names auto-resolve: search `src/backend/` for matching `*Controller.cs`
- Process each controller independently (same as Mode 3 per controller)

### Mode 5: Controller Folder (auto-detect all controllers)
```bash
/migrate-endpoint-to-postman src/backend/Feec.Master/src/Api/Controllers/V1/MasterManagement/ --folder-id <id>
```
- Glob `{folder}/*Controller.cs` to find all controllers in the directory
- Process each controller (same as Mode 3 per controller)
- Ideal for batch migration of an entire API group (e.g., all Master Management APIs)
- Shows total summary across all controllers at the end

### Mode 6: Spec-only (API Code without controller)
```bash
/migrate-endpoint-to-postman MM0046 --folder-id <id> --spec-only
```
- Read API Spec document directly (no controller needed)
- Build Postman request entirely from spec (endpoint, params, body example)
- Useful when controller doesn't exist yet or is in a different repo

## Prerequisites

- Custom Postman MCP server running (`mcp__custom-postman__*` tools)
- Verify: call `mcp__custom-postman__list_collections` first

## Arguments

**Required:**
- **Targets**: API Code(s) or Controller path(s) — see Input Modes above
- **`--folder-id <id>`**: Postman folder ID (user provides from Postman URL). Supports both UID format (`51464854-xxx`) and bare UUID (`xxx`).

**Optional:**
- `--collection <id>`: Override Postman collection ID (default: `97f3e1da-a4e9-44f6-8d1a-83766a827e54`)
- `--dry-run`: Preview only — show validation table, don't push to Postman
- `--skip-spec-check`: Bypass API Spec validation (migrate ALL endpoints from controller)
- `--spec-only`: Build request from API Spec document only (no controller parsing)
- `--base-url <url>`: Override base URL (default: auto-detect from system)

## Execution Steps

### Step 1: Detect Input Mode & Parse Arguments

Parse `$ARGUMENTS` and detect the mode:

```
Input is a directory path (ends with "/" or exists as dir)  → Folder mode (Mode 5)
Input contains ".cs"                                        → Controller mode (Mode 3 or 4)
Input contains "," with ".cs"                               → Multiple Controllers (Mode 4)
Input matches /^[A-Z]{2}\d{4}$/                             → Single API Code (Mode 1)
Input matches /^[A-Z]{2}\d{4}(,[A-Z]{2}\d{4})+$/           → Multiple API Codes (Mode 2)
Has --spec-only flag                                        → Spec-only (Mode 6)
```

**For folder mode** (Mode 5):
- Glob `{folder}/*Controller.cs` to find all controllers
- If no controllers found, report error
- Show discovered controllers list, then process each

**For controller short names** (no path, just `ConstructionsController.cs`):
- Search: `src/backend/**/Controllers/**/{name}` using Glob
- If multiple matches, show list and ask user to pick

**Extract `--folder-id`** — REQUIRED in all modes. If missing, ask the user.

### Step 2: Resolve API Codes → Controller + Spec (Mode 1 & 2)

For each API Code (e.g., `MM0046`):

1. **Detect system** from API Code prefix:
   | Prefix | System | Code Path | Spec Folder |
   |--------|--------|-----------|-------------|
   | `PM` | PMSystem | `Feec.PMSystem` | `Feec.PMSystem` |
   | `DC` | DCSystem | `Feec.DCSystem` | `Feec.DCSystem` |
   | `ES` | ESSystem | `Feec.ESSystem` | `Feec.ESSystem` |
   | `QS` | QSSystem | `Feec.QSSystem` | `Feec.QSSystem` |
   | `MM`,`MS`,`UM` | Master | `Feec.Master` | `Feec.MasterSystem` |

2. **Find API Spec**: Glob `docs/design/basic-design/{SpecFolder}/api-design/{APICode}-API-*.md`
   - If not found → report error, skip this code

3. **Find Controller**: Grep `API Code: {APICode}` in `src/backend/{CodePath}/**/Controllers/**/*.cs`
   - If not found → fall back to `--spec-only` behavior for this code

4. **Read API Spec** for enrichment (endpoint URL, params, body example, description)

5. **Read Controller** to extract the specific endpoint (HTTP method, route, params)

### Step 3: Resolve Controller → Endpoints + Specs (Mode 3 & 4)

For each controller file:

1. **Read the controller file**
2. **Detect system** from file path (same mapping as CLAUDE.md)
3. **Extract all endpoints**: parse `[HttpGet/Post/Put/Delete/Patch]` methods
4. **Extract API Code** from each method's XML `/// API Code: XXXX` comments
   - Also check class-level `<remarks>` for codes mentioned there
5. **Validate API Specs** for each extracted code:
   - Glob `docs/design/basic-design/{SpecFolder}/api-design/{APICode}-API-*.md`
   - Classify: `HAS_SPEC` / `NO_SPEC` / `NO_CODE`
6. **Read each found API Spec** for enrichment

### Step 4: Build & Display Validation Summary

Show a table of all endpoints to be processed:

```
## API Spec Validation

| # | API Code | Method | Route | Spec? | Action |
|---|----------|--------|-------|-------|--------|
| 1 | MM0046   | GET    | /api/v1/constructions | HAS_SPEC | Migrate |
| 2 | MM0047   | GET    | /api/v1/painted-areas | HAS_SPEC | Migrate |
| 3 | -        | DELETE | /api/v1/constructions/:id | NO_CODE | Skip |

**Result**: 2 of 3 endpoints qualify — migrating 2, skipping 1
```

If `--dry-run` is set, **stop here**.

### Step 5: Enrich from API Spec & Create Postman Requests

For each qualified endpoint:

1. **Read API Spec** to extract:
   - Exact endpoint path from `## API Endpoint` section
   - Query parameters with types and descriptions
   - Request body JSON example (POST/PUT/PATCH)
   - Description text from Overview

2. **Build Postman request**:
   - **Name**: `{APICode} - {API Name}` (e.g., `MM0046 - Get Constructions`)
   - **URL**: `{{baseUrl}}{path}` with query params
   - **Headers**: `Accept: application/json`, `Authorization: Bearer {{bearerToken}}` (if auth required)
   - **Body**: JSON from spec (for POST/PUT/PATCH), `Content-Type: application/json`
   - **Description**: Metadata + overview from spec

3. **Load MCP tool**: `ToolSearch` → `select:mcp__custom-postman__create_request`

4. **Call `create_request`** with:
   - `collectionId`, `folderId`, `name`, `method`, `url`, `headers`, `body`, `description`

### Step 6: Report Results

```
## Migration Results

**Mode**: Multiple API Codes
**Collection**: PMSystem (97f3e1da-...)
**Folder ID**: b9e4288d-321e-43f7-a902-cfbad88e7726

| # | Status  | API Code | Method | Name |
|---|---------|----------|--------|------|
| 1 | created | MM0046   | GET    | MM0046 - Get Constructions |
| 2 | created | MM0047   | GET    | MM0047 - Get Painted Areas |
| 3 | skipped | MM9999   | -      | No API Spec found |

**Created**: 2 | **Skipped**: 1 | **Failed**: 0
```

## System Detection

### From file path (Controller modes):
| Path contains | System | Port | Base URL | Spec Folder |
|---|---|---|---|---|
| `Feec.PMSystem` | PM | 5020 | `http://localhost:5020` | `Feec.PMSystem` |
| `Feec.DCSystem` | DC | 5000 | `http://localhost:5000` | `Feec.DCSystem` |
| `Feec.ESSystem` | ES | 5010 | `http://localhost:5010` | `Feec.ESSystem` |
| `Feec.QSSystem` | QS | 5030 | `http://localhost:5030` | `Feec.QSSystem` |
| `Feec.Master` | Master | 5070 | `http://localhost:5070` | `Feec.MasterSystem` |
| `Feec.SQASystem` | SQA | 5040 | `http://localhost:5040` | `Feec.SQASystem` |

### From API Code prefix (API Code modes):
| Prefix | System | Spec Folder |
|--------|--------|-------------|
| `PM` | PMSystem | `Feec.PMSystem` |
| `DC` | DCSystem | `Feec.DCSystem` |
| `ES` | ESSystem | `Feec.ESSystem` |
| `QS` | QSSystem | `Feec.QSSystem` |
| `MM`, `MS`, `UM` | Master | `Feec.MasterSystem` |

## API Spec Location

```
docs/design/basic-design/
├── Feec.PMSystem/api-design/         # PM0xxx-API-*.md
├── Feec.DCSystem/api-design/         # DC0xxx-API-*.md
├── Feec.ESSystem/api-design/         # ES0xxx-API-*.md
├── Feec.QSSystem/api-design/         # QS0xxx-API-*.md
├── Feec.MasterSystem/api-design/     # MM0xxx, MS0xxx, UM0xxx-API-*.md
└── Feec.SQASystem/api-design/        # (if exists)
```

## Error Handling

| Error | Action |
|---|---|
| `--folder-id` missing | Ask user for Postman folder ID |
| API Code not found in any controller | Fall back to `--spec-only` or report error |
| Controller file not found | Show error, suggest correct path |
| No endpoints qualify (all NO_SPEC) | Show warning — nothing to migrate |
| MCP server unavailable | Show error, suggest `/mcp` reconnect |
| Postman API error | Show error per endpoint, continue with others |
| Duplicate API Code in request | Warn but still create (no upsert yet) |

## Examples

```bash
# --- Mode 1: Single API Code ---
/migrate-endpoint-to-postman MM0046 --folder-id b9e4288d-321e-43f7-a902-cfbad88e7726

# --- Mode 2: Multiple API Codes ---
/migrate-endpoint-to-postman MM0046,MM0047,MM0048 --folder-id b9e4288d-321e-43f7-a902-cfbad88e7726

# --- Mode 3: Single Controller ---
/migrate-endpoint-to-postman src/backend/Feec.Master/src/Api/Controllers/V1/MasterManagement/ConstructionsController.cs --folder-id b9e4288d-321e-43f7-a902-cfbad88e7726

# --- Mode 4: Multiple Controllers (short names) ---
/migrate-endpoint-to-postman ConstructionsController.cs,PaintedAreasController.cs --folder-id b9e4288d-321e-43f7-a902-cfbad88e7726

# --- Mode 5: Controller Folder (batch all controllers in directory) ---
/migrate-endpoint-to-postman src/backend/Feec.Master/src/Api/Controllers/V1/MasterManagement/ --folder-id b9e4288d-321e-43f7-a902-cfbad88e7726

# --- Mode 6: Spec-only (no controller needed) ---
/migrate-endpoint-to-postman MM0046 --folder-id b9e4288d-321e-43f7-a902-cfbad88e7726 --spec-only

# --- Dry run any mode ---
/migrate-endpoint-to-postman MM0046,MM0047 --folder-id xxx --dry-run

# --- Skip spec check (controller mode) ---
/migrate-endpoint-to-postman ProjectsController.cs --folder-id xxx --skip-spec-check
```

## Known Limitations

1. **No duplicate detection**: Running twice creates duplicate requests — MCP `create_request` does not upsert
2. **Body generation depends on spec quality**: If API Spec has no request body example, body will be empty for POST/PUT
3. **`[HttpGet]` without route string**: MCP parser may miss `[HttpGet]` with no parentheses
4. **API Code in base class only**: If API Code annotation is only on the controller class (not method), may not match per-endpoint
5. **Cross-system API Codes**: An API Code prefix that doesn't match the system prefix mapping will not auto-detect correctly
