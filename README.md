# Postman MCP Server

Model Context Protocol (MCP) server for integrating Postman API with Cursor IDE, enabling automatic migration of API endpoints from .NET controllers to Postman collections.

## 🎯 Features

- ✅ **List Collections**: List all Postman collections in workspace
- ✅ **Get Collection**: Get detailed collection information
- ✅ **Create Collection**: Create new Postman collections
- ✅ **Create Folder**: Create folders to organize requests (with auto-fix validation errors)
- ✅ **Create Request**: Create API requests manually
- ✅ **Update Request**: Update existing requests
- ✅ **Delete Request**: Delete requests by ID or name (with recursive search)
- ✅ **Sync from Controller**: Automatically parse .NET controller code and migrate endpoints to Postman

## 📋 Requirements

- Node.js >= 18.0.0
- Postman API Key ([Get from Postman Account Settings](https://web.postman.co/settings/me/api-keys))
- Cursor IDE with MCP support

## 🚀 Quick Start

### Step 1: Install Dependencies

```bash
cd .cursor/mcp-servers/postman
npm install
```

### Step 2: Build Project

```bash
npm run build
```

Or use the setup script:

```bash
./setup.sh
```

### Step 3: Get Postman API Key

1. Go to [Postman Account Settings](https://web.postman.co/settings/me/api-keys)
2. Create or copy your API Key (format: `PMAK-xxxxx-xxxxx`)

### Step 4: Configure Cursor MCP Settings

Add to Cursor MCP configuration (usually in `~/.cursor/mcp.json` or Cursor Settings):

**macOS - Get absolute path:**
```bash
cd .cursor/mcp-servers/postman
./get-path.sh
# Script will copy path to clipboard
```

**Configuration:**
```json
{
  "mcpServers": {
    "postman": {
      "command": "node",
      "args": ["/absolute/path/to/.cursor/mcp-servers/postman/dist/index.js"],
      "env": {
        "POSTMAN_API_KEY": "your-postman-api-key-here"
      }
    }
  }
}
```

**Example for macOS:**
```json
{
  "mcpServers": {
    "postman": {
      "command": "node",
      "args": ["/Users/dangvietson/Desktop/feec-phase1-pm/feec-phase1-pmsystem/.cursor/mcp-servers/postman/dist/index.js"],
      "env": {
        "POSTMAN_API_KEY": "PMAK-xxxxx-xxxxx-xxxxx"
      }
    }
  }
}
```

**Note**: Replace `/absolute/path/to/` with your actual absolute path.

### Step 5: Restart Cursor IDE

1. **Quit Cursor completely** (`Cmd + Q` on macOS)
2. **Reopen Cursor**
3. **Test**: Type "List all Postman collections" in Cursor chat

## 📖 Usage Examples

### 1. List Collections

```
List all Postman collections
```

### 2. Create Collection

```
Create a new Postman collection named "FEEC PM System APIs" with description "Project Management System API endpoints"
```

### 3. Create Folder

```
Create folder "API V1" with description "Version 1.0 endpoints" in Postman collection 97f3e1da-a4e9-44f6-8d1a-83766a827e54
```

### 4. Create Request Manually

```
Create a new GET request in collection 97f3e1da-a4e9-44f6-8d1a-83766a827e54:
- Name: "Get User by ID"
- Method: GET
- URL: {{baseUrl}}/api/v1/users/{userId}
- Headers: Content-Type: application/json
- Description: Retrieve user details by ID
```

### 5. Auto-Sync from Controller (Recommended)

Use the custom command `/migrate-endpoint-to-postman` or manually:

```
Sync API endpoints from this controller code to Postman collection 97f3e1da-a4e9-44f6-8d1a-83766a827e54:

[Paste full C# controller code here]

Base URL: http://localhost:5020
API Version: 1.0
Folder: PM System API V1
```

The server will automatically:
- Parse all HTTP endpoints (`[HttpGet]`, `[HttpPost]`, etc.)
- Extract routes from `[Route]` attributes
- Extract API version from `[ApiVersion]` attributes
- Extract XML comments for descriptions
- Extract API Code and Screen ID from comments
- Generate request names: `{API Code} - {API Name}`
- Generate request bodies for POST/PUT/PATCH
- Handle path parameters (`{id:guid}` → `:id`)
- Handle query parameters (`[FromQuery]`)
- Expand `PagedRequest` into `pageNumber`, `pageSize`, `searchTerm`
- Add Authorization header only if `[Authorize]` attribute is present

### 6. Delete Request

```
Delete request "Test API Request" from Postman collection PMSystem
```

Or by ID:
```
Delete request with ID 8ea7c1f4-c9ba-4293-bbf4-b037f7962854 from collection 97f3e1da-a4e9-44f6-8d1a-83766a827e54
```

## 🔧 API Reference

### Tool: `list_collections`
- **Description**: List all Postman collections
- **Parameters**: None
- **Returns**: Array of collections with `id`, `name`, `uid`

### Tool: `get_collection`
- **Description**: Get detailed collection information
- **Parameters**: 
  - `collectionId` (string, required): Collection ID (UID)
- **Returns**: Full collection object with items, variables, etc.

### Tool: `create_collection`
- **Description**: Create new Postman collection
- **Parameters**:
  - `name` (string, required): Collection name
  - `description` (string, optional): Collection description
- **Returns**: Created collection object

### Tool: `create_folder`
- **Description**: Create folder in collection to organize requests
- **Parameters**:
  - `collectionId` (string, required): Collection ID
  - `name` (string, required): Folder name
  - `description` (string, optional): Folder description
- **Returns**: Updated collection object
- **Features**:
  - Auto-fixes invalid collection variables (type validation)
  - Creates folder with placeholder request (avoids empty folder validation error)
  - Preserves entire collection structure

### Tool: `create_request`
- **Description**: Create API request in collection
- **Parameters**:
  - `collectionId` (string, required): Collection ID
  - `name` (string, required): Request name
  - `method` (string, required): HTTP method (GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS)
  - `url` (string, required): Full URL or path
  - `headers` (object, optional): HTTP headers as key-value pairs
  - `body` (object, optional): Request body for POST/PUT/PATCH
    - `mode`: "raw", "urlencoded", "formdata"
    - `raw`: JSON string for raw body
  - `description` (string, optional): Request description
  - `folderId` (string, optional): Folder ID to organize requests
- **Returns**: Updated collection object

### Tool: `update_request`
- **Description**: Update existing request
- **Parameters**:
  - `collectionId` (string, required): Collection ID
  - `requestId` (string, required): Request ID (UID) to update
  - `name`, `method`, `url`, `headers`, `body`, `description` (optional): Fields to update
- **Returns**: Updated collection object

### Tool: `delete_request`
- **Description**: Delete API request from collection
- **Parameters**:
  - `collectionId` (string, required): Collection ID
  - `requestId` (string, optional): Request ID (UID) to delete
  - `requestName` (string, optional): Request name to find and delete
- **Returns**: Updated collection object
- **Features**:
  - Delete by ID or name
  - Recursive search in folders
  - Auto-fixes collection variables
  - Preserves collection structure

### Tool: `sync_from_controller`
- **Description**: Automatically migrate endpoints from .NET controller code
- **Parameters**:
  - `collectionId` (string, required): Postman collection ID
  - `controllerCode` (string, required): Full C# controller code with XML comments
  - `baseUrl` (string, required): Base URL (e.g., `http://localhost:5020`)
  - `apiVersion` (string, optional): API version (default: "1.0")
  - `folderName` (string, optional): Folder name to organize requests (will be created if not exists)
- **Returns**: Summary of created requests with endpoint details
- **Features**:
  - Parses `[Route]`, `[HttpGet]`, `[HttpPost]`, `[HttpPut]`, `[HttpDelete]`, `[HttpPatch]` attributes
  - Extracts XML comments (`/// <summary>`, `API Code:`, `Screen ID:`)
  - Generates request names: `{API Code} - {API Name}` (from summary)
  - Generates request bodies from DTO properties
  - Handles path parameters (`{id:guid}` → `:id` Postman format)
  - Handles query parameters (`[FromQuery]`)
  - Expands `PagedRequest` into individual query parameters
  - Adds Authorization header only if `[Authorize]` attribute is present
  - Replaces `[controller]` placeholder with actual controller name
  - Extracts major version from API version (e.g., "1.0" → "v1")
  - Uses `{{baseUrl}}` Postman variable for URLs

## 🎨 Controller Code Requirements

For `sync_from_controller` to work optimally:

- ✅ Controller must have `[ApiController]` attribute
- ✅ Methods must have HTTP method attributes (`[HttpGet]`, `[HttpPost]`, etc.)
- ✅ XML comments with `/// <summary>` for descriptions
- ✅ `API Code: XXXX` in comments for request naming
- ✅ `Screen ID: XXXX` in comments (optional)

**Example:**
```csharp
/// <summary>
/// Get vendor quotation history for specified vendors within a specific ES Version (v1.0)
/// API Code: QS0041
/// Screen ID: QS-L0004-2 (Estimation quotation vendor history)
/// </summary>
[HttpGet("quotation-history")]
public async Task<IActionResult> GetVendorQuotationHistory(
    [FromQuery] Guid versionId,
    [FromQuery(Name = "vendorId")] List<Guid> vendorIds,
    CancellationToken cancellationToken)
{
    // Implementation...
}
```

**Generated Request:**
- **Name**: `QS0041 - Get vendor quotation history for specified vendors within a specific ES Version`
- **URL**: `{{baseUrl}}/api/v1/Vendors/quotation-history?versionId=...&vendorId=...`
- **Method**: GET
- **Headers**: Only Authorization if `[Authorize]` is present

## 🔄 Development Workflow

### Workflow 1: Manual Migration (Step-by-step)

1. **Create Collection** for each system (PM, DC, ES, QS, Master)
2. **Develop API** in .NET controller
3. **Create Request** in Postman via Cursor prompt
4. **Test** in Postman

### Workflow 2: Auto-Sync (Bulk Migration) ⭐ Recommended

1. **Develop API** in .NET controller with complete XML comments
2. **Use `/migrate-endpoint-to-postman` command** or sync manually
3. **Verify** in Postman
4. **Update** if needed

### Workflow 3: GitHub Actions Integration (Future)

Create GitHub Action workflow to auto-sync when PR is merged:

```yaml
name: Sync APIs to Postman

on:
  pull_request:
    types: [closed]

jobs:
  sync-postman:
    if: github.event.pull_request.merged == true
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: |
          # Parse changed controllers
          # Call Postman MCP Server
          # Create/update requests
```

## 🔐 Security Notes

- **API Key**: Do not commit `POSTMAN_API_KEY` to git (already in `.gitignore`)
- **Local Only**: Server runs locally, not exposed externally
- **Environment Variables**: Use `.env` file if needed (do not commit)

## 🐛 Troubleshooting

### Server Not Starting

- Check Node.js version: `node --version` (requires >= 18)
- Check build: `npm run build`
- Check absolute path in MCP config (must be absolute path)
- **After code changes**: Quit Cursor completely and rebuild with `npm run build`

### Postman API Errors

- Verify API Key: Check key format (`PMAK-...`)
- Check API limits: Postman has rate limits
- Verify Collection ID: Collection ID must be UID (not name)
- Check workspace permissions: Need Editor or Admin role

### Endpoints Not Parsed

- Ensure controller code has complete attributes
- Check XML comments format (must use `///`)
- Verify route patterns
- Check for `[ApiController]` attribute

### Request Names Not Correct

- Ensure `API Code: XXXX` is present in XML comments
- Check summary format in `<summary>` tags
- Rebuild MCP server after code changes: `npm run build`

### Headers Not Added

- Authorization header is only added when `[Authorize]` attribute is explicitly present
- No default headers (X-API-Version, Accept, Content-Type) are added automatically
- Headers are only added when explicitly defined in code (e.g., `[FromHeader]` parameters)

## 📁 Project Structure

```
.cursor/mcp-servers/postman/
├── src/
│   ├── index.ts              # Main MCP server implementation
│   └── controller-parser.ts  # .NET controller parser
├── dist/                     # Compiled JavaScript (after build)
├── package.json
├── tsconfig.json
├── .gitignore
├── README.md                 # This file
├── get-path.sh              # Helper script to get absolute path
├── setup.sh                 # Setup script
└── rebuild-after-quit.sh    # Rebuild script after quitting Cursor
```

## 🛠️ Development

### Run in Development Mode

```bash
npm run dev
```

### Type Check

```bash
npm run type-check
```

### Build

```bash
npm run build
```

**Important**: After making code changes, you must:
1. Quit Cursor completely
2. Run `npm run build`
3. Reopen Cursor

Or use the helper script:
```bash
./rebuild-after-quit.sh
```

## 📚 References

- [Postman API Documentation](https://www.postman.com/postman/workspace/postman-public-workspace/documentation/12959542-c8142d51-e97c-46b6-bd77-52c667e1afe6)
- [MCP SDK Documentation](https://modelcontextprotocol.io/)
- [Cursor MCP Setup](https://docs.cursor.com/mcp)

## 🗺️ Roadmap

### ✅ Completed Features

- [x] List collections
- [x] Get collection details
- [x] Create collection
- [x] Create folder (with auto-fix validation errors)
- [x] Create request
- [x] Update request
- [x] Delete request (by ID or name, recursive search)
- [x] Sync from .NET controller (parse routes, methods, parameters)
- [x] Extract XML comments (summary, API Code, Screen ID)
- [x] Generate request names: `{API Code} - {API Name}`
- [x] Handle path/query parameters
- [x] Expand `PagedRequest` into individual parameters
- [x] Authorization header based on `[Authorize]` attribute
- [x] No default headers (only explicit headers from code)

### 🔄 Planned Enhancements

#### Phase 1: Enhanced Parsing
- [ ] Support for `[FromForm]` parameters (multipart/form-data)
- [ ] Support for `[FromHeader]` parameters (already parsed, need to add to headers)
- [ ] Better DTO property type detection
- [ ] Support for nested DTOs
- [ ] Extract validation rules from FluentValidation

#### Phase 2: Advanced Features
- [ ] Update existing requests (detect changes and update)
- [ ] Delete deprecated endpoints
- [ ] Support for multiple API versions in same collection
- [ ] Generate Postman tests from controller code
- [ ] Support for authentication (JWT, API Key, etc.)

#### Phase 3: Integration
- [ ] GitHub Actions integration (auto-sync on PR merge)
- [ ] Support for other frameworks (FastAPI, Express.js, etc.)
- [ ] Export collection to OpenAPI/Swagger
- [ ] Import from OpenAPI/Swagger

## 📝 Best Practices

1. **Naming**: Use API Code in XML comments for consistent naming
2. **Organization**: Create folders by system/version for easy management
3. **Documentation**: Add descriptions for requests for better understanding
4. **Testing**: Test requests after migration to ensure correctness
5. **Authorization**: Use `[Authorize]` attribute explicitly when authentication is required
6. **Headers**: Only add headers when explicitly defined in code

## 🤝 Contributing

When adding new features:
1. Update this README with new features
2. Test thoroughly
3. Update roadmap section
4. Rebuild and test in Cursor

---

**Last Updated**: 2026-01-23  
**Version**: 1.0.0  
**Status**: ✅ Production Ready
