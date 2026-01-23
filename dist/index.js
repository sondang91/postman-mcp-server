#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, ErrorCode, McpError, } from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import { z } from "zod";
// Import enhanced parser
import { parseControllerEndpoints, generateRequestBodyExample, } from "./controller-parser.js";
const POSTMAN_API_BASE = "https://api.getpostman.com";
// Postman API Request Schema
const PostmanRequestSchema = z.object({
    name: z.string(),
    method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"]),
    header: z.array(z.object({
        key: z.string(),
        value: z.string(),
        type: z.string().optional(),
    })).optional(),
    url: z.union([
        z.string(), // Simple string URL
        z.object({
            raw: z.string(),
            protocol: z.string().optional(),
            host: z.array(z.string()).optional(),
            path: z.array(z.string()).optional(),
            query: z.array(z.object({
                key: z.string(),
                value: z.string(),
                disabled: z.boolean().optional(),
            })).optional(),
        }),
    ]),
    body: z.object({
        mode: z.enum(["raw", "urlencoded", "formdata", "file", "graphql"]).optional(),
        raw: z.string().optional(),
        urlencoded: z.array(z.object({
            key: z.string(),
            value: z.string(),
        })).optional(),
        formdata: z.array(z.object({
            key: z.string(),
            value: z.string(),
            type: z.string().optional(),
        })).optional(),
    }).optional(),
    description: z.string().optional(),
});
const server = new Server({
    name: "postman-mcp-server",
    version: "1.0.0",
}, {
    capabilities: {
        tools: {},
    },
});
// Get Postman API Key from environment
function getPostmanApiKey() {
    const apiKey = process.env.POSTMAN_API_KEY;
    if (!apiKey) {
        throw new McpError(ErrorCode.InvalidRequest, "POSTMAN_API_KEY environment variable is required");
    }
    return apiKey;
}
// Helper: Make Postman API request
async function postmanRequest(method, endpoint, data) {
    const apiKey = getPostmanApiKey();
    try {
        const response = await axios({
            method,
            url: `${POSTMAN_API_BASE}${endpoint}`,
            headers: {
                "X-Api-Key": apiKey,
                "Content-Type": "application/json",
            },
            data,
        });
        return response.data;
    }
    catch (error) {
        if (axios.isAxiosError(error)) {
            const axiosError = error;
            // Try to extract detailed error information
            const errorData = axiosError.response?.data;
            let errorMessage = axiosError.message;
            if (errorData?.error) {
                errorMessage = errorData.error.message || errorData.error.name || errorMessage;
                // Include details if available
                if (errorData.error.details) {
                    errorMessage += `\nDetails: ${JSON.stringify(errorData.error.details, null, 2)}`;
                }
            }
            // Include response data if available for debugging
            if (axiosError.response?.data && typeof axiosError.response.data === 'object') {
                const fullError = JSON.stringify(axiosError.response.data, null, 2);
                errorMessage += `\nFull error response: ${fullError}`;
            }
            throw new McpError(ErrorCode.InternalError, `Postman API error: ${errorMessage}`);
        }
        throw error;
    }
}
// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "list_collections",
                description: "List all Postman collections",
                inputSchema: {
                    type: "object",
                    properties: {},
                },
            },
            {
                name: "get_collection",
                description: "Get details of a specific Postman collection by ID",
                inputSchema: {
                    type: "object",
                    properties: {
                        collectionId: {
                            type: "string",
                            description: "Postman collection ID (UID)",
                        },
                    },
                    required: ["collectionId"],
                },
            },
            {
                name: "create_request",
                description: "Create a new API request in a Postman collection",
                inputSchema: {
                    type: "object",
                    properties: {
                        collectionId: {
                            type: "string",
                            description: "Postman collection ID (UID) where to add the request",
                        },
                        name: {
                            type: "string",
                            description: "Request name (e.g., 'Get User by ID')",
                        },
                        method: {
                            type: "string",
                            enum: ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"],
                            description: "HTTP method",
                        },
                        url: {
                            type: "string",
                            description: "Full URL or path (e.g., 'https://api.example.com/users/{id}' or '/api/v1/users/{id}')",
                        },
                        headers: {
                            type: "object",
                            description: "HTTP headers as key-value pairs",
                            additionalProperties: {
                                type: "string",
                            },
                        },
                        body: {
                            type: "object",
                            description: "Request body (for POST/PUT/PATCH)",
                            properties: {
                                mode: {
                                    type: "string",
                                    enum: ["raw", "urlencoded", "formdata"],
                                    default: "raw",
                                },
                                raw: {
                                    type: "string",
                                    description: "JSON string for raw body",
                                },
                            },
                        },
                        description: {
                            type: "string",
                            description: "Request description/documentation",
                        },
                        folderId: {
                            type: "string",
                            description: "Optional: Folder ID to organize requests. If provided, request will be created in this folder.",
                        },
                        folderName: {
                            type: "string",
                            description: "Optional: Folder name to organize requests. Will auto-find folderId. Takes precedence over folderId if both provided.",
                        },
                    },
                    required: ["collectionId", "name", "method", "url"],
                },
            },
            {
                name: "update_request",
                description: "Update an existing API request in a Postman collection",
                inputSchema: {
                    type: "object",
                    properties: {
                        collectionId: {
                            type: "string",
                            description: "Postman collection ID",
                        },
                        requestId: {
                            type: "string",
                            description: "Request ID (UID) to update",
                        },
                        name: {
                            type: "string",
                            description: "Updated request name",
                        },
                        method: {
                            type: "string",
                            enum: ["GET", "POST", "PUT", "DELETE", "PATCH"],
                        },
                        url: {
                            type: "string",
                        },
                        headers: {
                            type: "object",
                            additionalProperties: { type: "string" },
                        },
                        body: {
                            type: "object",
                            properties: {
                                mode: { type: "string", enum: ["raw", "urlencoded", "formdata"] },
                                raw: { type: "string" },
                            },
                        },
                        description: {
                            type: "string",
                        },
                    },
                    required: ["collectionId", "requestId"],
                },
            },
            {
                name: "delete_request",
                description: "Delete an API request from a Postman collection",
                inputSchema: {
                    type: "object",
                    properties: {
                        collectionId: {
                            type: "string",
                            description: "Postman collection ID (UID)",
                        },
                        requestId: {
                            type: "string",
                            description: "Request ID (UID) to delete. Can also use request name to find and delete.",
                        },
                        requestName: {
                            type: "string",
                            description: "Optional: Request name to find and delete (alternative to requestId)",
                        },
                    },
                    required: ["collectionId"],
                },
            },
            {
                name: "create_collection",
                description: "Create a new Postman collection",
                inputSchema: {
                    type: "object",
                    properties: {
                        name: {
                            type: "string",
                            description: "Collection name",
                        },
                        description: {
                            type: "string",
                            description: "Collection description",
                        },
                    },
                    required: ["name"],
                },
            },
            {
                name: "create_folder",
                description: "Create a new folder in a Postman collection",
                inputSchema: {
                    type: "object",
                    properties: {
                        collectionId: {
                            type: "string",
                            description: "Postman collection ID (UID)",
                        },
                        name: {
                            type: "string",
                            description: "Folder name",
                        },
                        description: {
                            type: "string",
                            description: "Optional folder description",
                        },
                    },
                    required: ["collectionId", "name"],
                },
            },
            {
                name: "sync_from_controller",
                description: "Auto-migrate API endpoint from .NET controller code to Postman",
                inputSchema: {
                    type: "object",
                    properties: {
                        collectionId: {
                            type: "string",
                            description: "Postman collection ID",
                        },
                        controllerCode: {
                            type: "string",
                            description: "Full C# controller code with XML comments",
                        },
                        baseUrl: {
                            type: "string",
                            description: "Base URL (e.g., 'http://localhost:5020' or 'https://api.example.com')",
                        },
                        apiVersion: {
                            type: "string",
                            description: "API version (e.g., '1.0') - extracted from [ApiVersion] attribute",
                            default: "1.0",
                        },
                        folderName: {
                            type: "string",
                            description: "Optional: Folder name to organize requests (will be created if not exists)",
                        },
                        folderId: {
                            type: "string",
                            description: "Optional: Folder ID to organize requests. Takes precedence over folderName if both provided.",
                        },
                    },
                    required: ["collectionId", "controllerCode", "baseUrl"],
                },
            },
        ],
    };
});
// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
        switch (name) {
            case "list_collections": {
                const collections = await postmanRequest("GET", "/collections");
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(collections, null, 2),
                        },
                    ],
                };
            }
            case "get_collection": {
                const { collectionId } = args;
                const collection = await postmanRequest("GET", `/collections/${collectionId}`);
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(collection, null, 2),
                        },
                    ],
                };
            }
            case "create_request": {
                const createArgs = args;
                // Get collection first to understand structure
                const collection = await postmanRequest("GET", `/collections/${createArgs.collectionId}`);
                const collectionData = collection.collection;
                // Helper function to recursively find folder by ID or name
                const findFolder = (items, targetId, targetName) => {
                    for (const item of items) {
                        const folderItem = item;
                        // Check if this is a folder (has "item" array and "name", no "request")
                        if (folderItem.item && Array.isArray(folderItem.item) && folderItem.name && !folderItem.request) {
                            // Match by ID or name
                            if (targetId && folderItem.id === targetId) {
                                return folderItem;
                            }
                            if (targetName && folderItem.name === targetName) {
                                return folderItem;
                            }
                            // Recursively search in subfolders
                            const found = findFolder(folderItem.item, targetId, targetName);
                            if (found)
                                return found;
                        }
                    }
                    return null;
                };
                // Determine target folder ID
                let targetFolderId = createArgs.folderId;
                let targetFolderName = createArgs.folderName;
                // If folderName provided but no folderId, find folderId by name
                if (targetFolderName && !targetFolderId) {
                    const foundFolder = findFolder(collectionData.item || [], undefined, targetFolderName);
                    if (foundFolder && foundFolder.id) {
                        targetFolderId = foundFolder.id;
                    }
                    else {
                        // Folder not found - will create at root with warning
                        targetFolderId = undefined;
                        targetFolderName = undefined;
                    }
                }
                // Build request object
                const requestObj = {
                    name: createArgs.name,
                    request: {
                        method: createArgs.method,
                        url: createArgs.url,
                    },
                };
                // Add headers
                if (createArgs.headers && Object.keys(createArgs.headers).length > 0) {
                    requestObj.request.header = Object.entries(createArgs.headers).map(([key, value]) => ({
                        key,
                        value,
                    }));
                }
                // Add body
                if (createArgs.body) {
                    requestObj.request.body = {
                        mode: createArgs.body.mode || "raw",
                        raw: createArgs.body.raw || "",
                    };
                }
                // Add description
                if (createArgs.description) {
                    requestObj.request.description = createArgs.description;
                }
                // Helper function to recursively add request to folder
                const addRequestToFolder = (items, folderId, request) => {
                    for (const item of items) {
                        const folderItem = item;
                        // Check if this is the target folder
                        if (folderItem.id === folderId && folderItem.item && Array.isArray(folderItem.item)) {
                            folderItem.item.push(request);
                            return true;
                        }
                        // Recursively search in subfolders
                        if (folderItem.item && Array.isArray(folderItem.item)) {
                            if (addRequestToFolder(folderItem.item, folderId, request)) {
                                return true;
                            }
                        }
                    }
                    return false;
                };
                // Add request to folder or collection root
                let addedToFolder = false;
                if (targetFolderId) {
                    addedToFolder = addRequestToFolder(collectionData.item || [], targetFolderId, requestObj);
                }
                // If not added to folder (folder not found or no folderId), add to collection root
                if (!addedToFolder) {
                    collectionData.item = collectionData.item || [];
                    collectionData.item.push(requestObj);
                }
                // Fix collection variables before update
                if (collectionData.variable && Array.isArray(collectionData.variable)) {
                    const validTypes = ["string", "any", "secret", "boolean", "number"];
                    collectionData.variable = collectionData.variable.map((v) => {
                        const fixedVar = {
                            key: v.key,
                            value: v.value,
                            type: "string",
                        };
                        Object.keys(v).forEach((key) => {
                            if (key !== "type" && key !== "key" && key !== "value") {
                                fixedVar[key] = v[key];
                            }
                        });
                        if (v.type && typeof v.type === "string" && validTypes.includes(v.type)) {
                            fixedVar.type = v.type;
                        }
                        return fixedVar;
                    });
                }
                // Update collection via PUT
                const updated = await postmanRequest("PUT", `/collections/${createArgs.collectionId}`, { collection: collectionData });
                const locationMessage = addedToFolder
                    ? `in folder '${targetFolderName || targetFolderId}'`
                    : "at collection root";
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                success: true,
                                message: `Request '${createArgs.name}' created successfully ${locationMessage}`,
                                folderId: targetFolderId,
                                folderName: targetFolderName,
                                collection: updated,
                            }, null, 2),
                        },
                    ],
                };
            }
            case "delete_request": {
                const deleteArgs = args;
                // Get collection first
                const collectionResult = await postmanRequest("GET", `/collections/${deleteArgs.collectionId}`);
                const collectionData = collectionResult.collection;
                // Helper function to recursively find and remove request
                const removeRequestFromItems = (items, targetId, targetName) => {
                    for (let i = 0; i < items.length; i++) {
                        const item = items[i];
                        // Check if this is the request to delete
                        if (targetId && item.id === targetId) {
                            items.splice(i, 1);
                            return true;
                        }
                        if (targetName && item.name === targetName && item.request) {
                            items.splice(i, 1);
                            return true;
                        }
                        // Recursively search in folders
                        if (item.item && Array.isArray(item.item)) {
                            if (removeRequestFromItems(item.item, targetId, targetName)) {
                                return true;
                            }
                        }
                    }
                    return false;
                };
                // Find and remove request
                if (!collectionData.item || !Array.isArray(collectionData.item)) {
                    return {
                        content: [
                            {
                                type: "text",
                                text: JSON.stringify({
                                    success: false,
                                    message: "Collection has no items",
                                }, null, 2),
                            },
                        ],
                    };
                }
                const found = removeRequestFromItems(collectionData.item, deleteArgs.requestId, deleteArgs.requestName);
                if (!found) {
                    return {
                        content: [
                            {
                                type: "text",
                                text: JSON.stringify({
                                    success: false,
                                    message: deleteArgs.requestId
                                        ? `Request with ID '${deleteArgs.requestId}' not found`
                                        : `Request with name '${deleteArgs.requestName}' not found`,
                                }, null, 2),
                            },
                        ],
                    };
                }
                // Fix collection variables before update
                if (collectionData.variable && Array.isArray(collectionData.variable)) {
                    const validTypes = ["string", "any", "secret", "boolean", "number"];
                    collectionData.variable = collectionData.variable.map((v) => {
                        const fixedVar = {
                            key: v.key,
                            value: v.value,
                            type: "string",
                        };
                        Object.keys(v).forEach((key) => {
                            if (key !== "type" && key !== "key" && key !== "value") {
                                fixedVar[key] = v[key];
                            }
                        });
                        if (v.type && typeof v.type === "string" && validTypes.includes(v.type)) {
                            fixedVar.type = v.type;
                        }
                        return fixedVar;
                    });
                }
                // Update collection
                const updated = await postmanRequest("PUT", `/collections/${deleteArgs.collectionId}`, {
                    collection: collectionData,
                });
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                success: true,
                                message: deleteArgs.requestId
                                    ? `Request with ID '${deleteArgs.requestId}' deleted successfully`
                                    : `Request '${deleteArgs.requestName}' deleted successfully`,
                                collection: updated,
                            }, null, 2),
                        },
                    ],
                };
            }
            case "create_collection": {
                const { name, description } = args;
                const collection = await postmanRequest("POST", "/collections", {
                    collection: {
                        name,
                        description: description || "",
                        item: [],
                    },
                });
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                success: true,
                                message: `Collection '${name}' created successfully`,
                                collectionId: collection.collection.uid,
                                collection,
                            }, null, 2),
                        },
                    ],
                };
            }
            case "create_folder": {
                const { collectionId, name, description } = args;
                // Get collection first
                const collectionResult = await postmanRequest("GET", `/collections/${collectionId}`);
                const originalCollection = collectionResult.collection;
                // Check if folder already exists
                const existingFolder = originalCollection.item?.find((item) => item.name === name && Array.isArray(item.item));
                if (existingFolder) {
                    return {
                        content: [
                            {
                                type: "text",
                                text: JSON.stringify({
                                    success: false,
                                    message: `Folder '${name}' already exists`,
                                    folderName: name,
                                }, null, 2),
                            },
                        ],
                    };
                }
                // Deep clone collection to avoid mutation issues
                const collectionData = JSON.parse(JSON.stringify(originalCollection));
                // Fix collection-level variables with invalid types
                // Postman schema requires variable.type to be one of: "string", "any", "secret", "boolean", "number"
                // Some collections may have "default" which is invalid - we'll set it to "string" (the default)
                if (collectionData.variable && Array.isArray(collectionData.variable)) {
                    const validTypes = ["string", "any", "secret", "boolean", "number"];
                    // Fix each variable - ensure type is valid
                    collectionData.variable = collectionData.variable.map((v) => {
                        // Create a completely new object to avoid any reference issues
                        const fixedVar = {
                            key: v.key,
                            value: v.value,
                            type: "string", // Default to string
                        };
                        // Copy any other properties (like id, etc.)
                        Object.keys(v).forEach((key) => {
                            if (key !== "type" && key !== "key" && key !== "value") {
                                fixedVar[key] = v[key];
                            }
                        });
                        // Only set type to original value if it's valid
                        if (v.type && typeof v.type === "string" && validTypes.includes(v.type)) {
                            fixedVar.type = v.type;
                        }
                        return fixedVar;
                    });
                }
                // Ensure item array exists
                if (!collectionData.item) {
                    collectionData.item = [];
                }
                // Create folder structure (Postman v2.1.0 schema)
                // Postman validation requires folders to have at least one item
                // We'll create folder with a placeholder request to avoid validation errors
                const folderItem = {
                    name,
                    item: [
                        // Add a placeholder request to avoid "empty folder" validation error
                        {
                            name: "Placeholder - Delete Me",
                            request: {
                                method: "GET",
                                url: {
                                    raw: "{{baseUrl}}/placeholder",
                                    host: ["{{baseUrl}}"],
                                    path: ["placeholder"],
                                },
                                description: "This is a placeholder request. Delete it after adding real requests to this folder.",
                            },
                        },
                    ],
                };
                // Only add description if provided (not empty string)
                if (description && description.trim() !== "") {
                    folderItem.description = description.trim();
                }
                // Add folder to collection (at the beginning to make it easy to find)
                collectionData.item.unshift(folderItem);
                // Update collection - send the entire collection object
                // Postman API expects: { collection: { ... } }
                const updated = await postmanRequest("PUT", `/collections/${collectionId}`, {
                    collection: collectionData,
                });
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                success: true,
                                message: `Folder '${name}' created successfully in collection`,
                                folderName: name,
                                collectionId,
                                collection: updated,
                            }, null, 2),
                        },
                    ],
                };
            }
            case "sync_from_controller": {
                const syncArgs = args;
                // Parse controller code to extract endpoints using enhanced parser
                const endpoints = parseControllerEndpoints(syncArgs.controllerCode, {
                    baseUrl: syncArgs.baseUrl,
                    apiVersion: syncArgs.apiVersion || "1.0",
                    // Note: Headers are only added when explicitly defined in code:
                    // - Authorization: based on [AllowAnonymous] attribute
                    // - [FromHeader] parameters: parsed from method signature
                    // - Custom headers: via defaultHeaders option
                    defaultHeaders: {},
                });
                // Get collection first
                const collectionResult = await postmanRequest("GET", `/collections/${syncArgs.collectionId}`);
                const collectionData = collectionResult.collection;
                // Fix collection variables before update
                if (collectionData.variable && Array.isArray(collectionData.variable)) {
                    const validTypes = ["string", "any", "secret", "boolean", "number"];
                    collectionData.variable = collectionData.variable.map((v) => {
                        const fixedVar = {
                            key: v.key,
                            value: v.value,
                            type: "string",
                        };
                        Object.keys(v).forEach((key) => {
                            if (key !== "type" && key !== "key" && key !== "value") {
                                fixedVar[key] = v[key];
                            }
                        });
                        if (v.type && typeof v.type === "string" && validTypes.includes(v.type)) {
                            fixedVar.type = v.type;
                        }
                        return fixedVar;
                    });
                }
                // Ensure item array exists
                if (!collectionData.item) {
                    collectionData.item = [];
                }
                // Helper function to recursively find folder by ID or name
                const findFolderByIdOrName = (items, targetId, targetName) => {
                    for (const item of items) {
                        const folderItem = item;
                        // Check if this is a folder (has "item" array and "name", no "request")
                        if (folderItem.item && Array.isArray(folderItem.item) && folderItem.name && !folderItem.request) {
                            // Match by ID or name
                            if (targetId && folderItem.id === targetId) {
                                return folderItem;
                            }
                            if (targetName && folderItem.name === targetName) {
                                return folderItem;
                            }
                            // Recursively search in subfolders
                            const found = findFolderByIdOrName(folderItem.item, targetId, targetName);
                            if (found)
                                return found;
                        }
                    }
                    return null;
                };
                // Find or create folder if folderId or folderName is provided
                // folderId takes precedence over folderName
                let targetFolder = null;
                if (syncArgs.folderId) {
                    // Find by folderId
                    targetFolder = findFolderByIdOrName(collectionData.item || [], syncArgs.folderId, undefined);
                }
                else if (syncArgs.folderName) {
                    // Find by folderName
                    targetFolder = findFolderByIdOrName(collectionData.item || [], undefined, syncArgs.folderName);
                    // Create folder if it doesn't exist
                    if (!targetFolder) {
                        targetFolder = {
                            name: syncArgs.folderName,
                            item: [],
                        };
                        collectionData.item = collectionData.item || [];
                        collectionData.item.unshift(targetFolder);
                    }
                }
                const results = [];
                for (const endpoint of endpoints) {
                    try {
                        // Generate request body if needed
                        let requestBody;
                        if (["POST", "PUT", "PATCH"].includes(endpoint.method) &&
                            endpoint.parameters) {
                            const bodyExample = generateRequestBodyExample(endpoint.parameters);
                            if (bodyExample) {
                                requestBody = {
                                    mode: "raw",
                                    raw: bodyExample,
                                };
                            }
                        }
                        // Build Postman URL object with query parameters
                        const urlString = endpoint.url;
                        // Extract query parameters from endpoint.parameters
                        const queryParams = [];
                        if (endpoint.parameters) {
                            endpoint.parameters
                                .filter((p) => p.location === "query")
                                .forEach((param) => {
                                // Generate example value based on type and name
                                let exampleValue = "";
                                const typeLower = param.type.toLowerCase();
                                const nameLower = param.name.toLowerCase();
                                if (typeLower.includes("guid")) {
                                    exampleValue = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
                                }
                                else if (typeLower.includes("int") || typeLower.includes("long")) {
                                    if (nameLower.includes("round")) {
                                        exampleValue = "5";
                                    }
                                    else if (nameLower.includes("page")) {
                                        exampleValue = "1";
                                    }
                                    else if (nameLower.includes("size")) {
                                        exampleValue = "10";
                                    }
                                    else {
                                        exampleValue = "1";
                                    }
                                }
                                else if (typeLower.includes("string")) {
                                    exampleValue = "string";
                                }
                                else if (typeLower.includes("list")) {
                                    // For List<Guid>, use example GUID
                                    exampleValue = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
                                }
                                else {
                                    exampleValue = "value";
                                }
                                queryParams.push({
                                    key: param.name,
                                    value: exampleValue,
                                    disabled: !param.required,
                                });
                            });
                        }
                        // Build Postman URL object
                        // Parse URL: {{baseUrl}}/api/v1/Vendors/:vendorId/quotations/:quotationPk/items
                        const urlObj = {
                            raw: urlString,
                        };
                        // Parse path segments
                        if (urlString.includes("{{baseUrl}}")) {
                            const pathPart = urlString.replace("{{baseUrl}}", "").split("?")[0];
                            urlObj.host = ["{{baseUrl}}"];
                            urlObj.path = pathPart.split("/").filter((p) => p.length > 0);
                        }
                        // Add query parameters if any
                        if (queryParams.length > 0) {
                            urlObj.query = queryParams;
                        }
                        // Build headers array, removing duplicates by key (case-insensitive)
                        const headersMap = new Map();
                        if (endpoint.headers) {
                            endpoint.headers.forEach((h) => {
                                // Use lowercase key for comparison to avoid duplicates
                                const keyLower = h.key.toLowerCase();
                                if (!headersMap.has(keyLower)) {
                                    headersMap.set(keyLower, h.value);
                                }
                            });
                        }
                        // Convert to array with original casing from first occurrence
                        const uniqueHeaders = [];
                        if (endpoint.headers) {
                            const seenKeys = new Set();
                            endpoint.headers.forEach((h) => {
                                const keyLower = h.key.toLowerCase();
                                if (!seenKeys.has(keyLower)) {
                                    seenKeys.add(keyLower);
                                    uniqueHeaders.push({ key: h.key, value: h.value });
                                }
                            });
                        }
                        // Build request object
                        const requestObj = {
                            name: endpoint.name,
                            request: {
                                method: endpoint.method,
                                url: urlObj,
                                header: uniqueHeaders.length > 0 ? uniqueHeaders : undefined,
                                description: endpoint.description || "",
                            },
                        };
                        if (requestBody) {
                            requestObj.request.body = requestBody;
                        }
                        // Add to folder if specified, otherwise add to collection root
                        if (targetFolder) {
                            targetFolder.item.push(requestObj);
                        }
                        else {
                            collectionData.item.push(requestObj);
                        }
                        results.push({
                            endpoint: endpoint.name,
                            method: endpoint.method,
                            url: endpoint.url,
                            status: "created",
                            apiCode: endpoint.apiCode,
                        });
                    }
                    catch (error) {
                        results.push({
                            endpoint: endpoint.name,
                            status: "failed",
                            error: error instanceof Error ? error.message : String(error),
                        });
                    }
                }
                // Update collection with all new requests
                if (results.some((r) => r.status === "created")) {
                    await postmanRequest("PUT", `/collections/${syncArgs.collectionId}`, {
                        collection: collectionData,
                    });
                }
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                success: true,
                                message: `Synced ${endpoints.length} endpoints from controller`,
                                summary: {
                                    total: endpoints.length,
                                    created: results.filter((r) => r.status === "created").length,
                                    failed: results.filter((r) => r.status === "failed").length,
                                },
                                results,
                            }, null, 2),
                        },
                    ],
                };
            }
            default:
                throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }
    }
    catch (error) {
        if (error instanceof McpError) {
            throw error;
        }
        throw new McpError(ErrorCode.InternalError, `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }
});
// Start server
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Postman MCP Server running on stdio");
}
main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map