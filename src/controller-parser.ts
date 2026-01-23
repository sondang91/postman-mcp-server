/**
 * Enhanced .NET Controller Parser
 * Parses C# controller code to extract API endpoint information
 */

export interface ParsedEndpoint {
  name: string;
  method: string;
  url: string;
  headers?: Array<{ key: string; value: string }>;
  description?: string;
  parameters?: Array<{
    name: string;
    type: string;
    location: "path" | "query" | "body";
    required: boolean;
  }>;
  apiCode?: string;
  screenId?: string;
}

export interface ParseOptions {
  baseUrl: string;
  apiVersion?: string;
  defaultHeaders?: Record<string, string>;
}

/**
 * Parse .NET controller code to extract API endpoints
 */
export function parseControllerEndpoints(
  controllerCode: string,
  options: ParseOptions
): ParsedEndpoint[] {
  const endpoints: ParsedEndpoint[] = [];

  // Extract controller name
  const controllerNameMatch = controllerCode.match(
    /public\s+class\s+(\w+Controller)\s*:/
  );
  const controllerName = controllerNameMatch
    ? controllerNameMatch[1]
    : "UnknownController";

  // Extract base route from [Route] attribute
  const routeMatch = controllerCode.match(/\[Route\(["']([^"']+)["']\)\]/);
  const controllerRoute = routeMatch ? routeMatch[1] : "";

  // Extract API version from [ApiVersion] attribute
  const versionMatch = controllerCode.match(
    /\[ApiVersion\(["']([^"']+)["']\)\]/
  );
  const fullVersion = versionMatch ? versionMatch[1] : options.apiVersion || "1.0";
  // Extract major version only (e.g., "1.0" -> "1", "2.1" -> "2")
  const version = fullVersion.split(".")[0];

  // Build base route with version replacement
  let baseRoute = controllerRoute.replace("{version:apiVersion}", version);
  if (!baseRoute.startsWith("/")) {
    baseRoute = "/" + baseRoute;
  }
  
  // Extract controller name without "Controller" suffix for [controller] replacement
  const controllerNameForRoute = controllerName.replace("Controller", "");

  // Extract method endpoints - handle multiline patterns with attributes between [HttpGet] and method
  // Pattern: [HttpGet("route")] ... [ProducesResponseType(...)] ... public async Task<IActionResult> MethodName(
  
  // First, find all [HttpMethod] attributes
  // Pattern: [HttpGet("route")] or [HttpGet('route')]
  // Use a two-step approach: first find [HttpMethod](, then extract the route manually
  // Pattern is [HttpGet("route")] - note: no ] between HttpGet and (
  const httpMethodNames = ['Get', 'Post', 'Put', 'Delete', 'Patch'];
  const httpMethodMatches: Array<{
    method: string;
    route: string;
    index: number;
  }> = [];
  
  // Find all [HttpMethod]( occurrences (no ] between method name and opening paren)
  httpMethodNames.forEach((methodName) => {
    const methodPattern = new RegExp(`\\[Http${methodName}\\(`, 'g');
    let match;
    while ((match = methodPattern.exec(controllerCode)) !== null) {
      const startIndex = match.index;
      const afterParen = controllerCode.substring(startIndex + match[0].length);
      
      // Manually extract route by finding the opening quote and matching content
      // Try double quotes first
      if (afterParen.startsWith('"')) {
        const endQuoteIndex = afterParen.indexOf('"', 1);
        if (endQuoteIndex !== -1 && afterParen[endQuoteIndex + 1] === ')') {
          const route = afterParen.substring(1, endQuoteIndex);
          httpMethodMatches.push({
            method: methodName.toUpperCase(),
            route: route,
            index: startIndex,
          });
          continue;
        }
      }
      
      // Try single quotes
      if (afterParen.startsWith("'")) {
        const endQuoteIndex = afterParen.indexOf("'", 1);
        if (endQuoteIndex !== -1 && afterParen[endQuoteIndex + 1] === ')') {
          const route = afterParen.substring(1, endQuoteIndex);
          httpMethodMatches.push({
            method: methodName.toUpperCase(),
            route: route,
            index: startIndex,
          });
        }
      }
    }
  });
  
  // Sort by index to maintain order in file
  httpMethodMatches.sort((a, b) => a.index - b.index);

  // Check if controller class has [Authorize] or [AllowAnonymous] attribute
  // Look for attributes before the class declaration
  const classDeclarationIndex = controllerCode.indexOf("public class");
  const controllerAttributesSection = classDeclarationIndex !== -1 
    ? controllerCode.substring(0, classDeclarationIndex)
    : "";
  const controllerHasAuthorize = /\[Authorize\]/i.test(controllerAttributesSection);
  const controllerHasAllowAnonymous = /\[AllowAnonymous\]/i.test(controllerAttributesSection);

  // For each HTTP method, find the corresponding method signature
  for (const httpMethodMatch of httpMethodMatches) {
    // Find method signature after this [HttpMethod] attribute
    // Look for: public async Task<IActionResult> MethodName(
      const afterHttpMethod = controllerCode.substring(httpMethodMatch.index);
      
      // Try with async first, then without async - handle multiline with attributes in between
      const methodSignatureMatch = afterHttpMethod.match(
        /public\s+(?:async\s+)?Task<[^>]+>\s+(\w+)\s*\(/m
      );
      
      if (!methodSignatureMatch) {
        continue; // Skip if we can't find method signature
      }
      
      const methodName = methodSignatureMatch[1];
      const methodStartIndex = httpMethodMatch.index + (methodSignatureMatch.index || 0);

    // Check if method has [Authorize] or [AllowAnonymous] attribute
    // Look between [HttpMethod] and method signature
    const methodAttributesSection = controllerCode.substring(httpMethodMatch.index, methodStartIndex);
    const methodHasAuthorize = /\[Authorize\]/i.test(methodAttributesSection);
    const methodHasAllowAnonymous = /\[AllowAnonymous\]/i.test(methodAttributesSection);
    
    // Determine if Authorization header is needed
    // Only add Authorization header if [Authorize] is explicitly defined
    // Priority: Method-level [Authorize] > Controller-level [Authorize]
    // [AllowAnonymous] on method overrides controller-level [Authorize]
    let requiresAuth = false;
    if (methodHasAllowAnonymous) {
      // Method explicitly allows anonymous, no auth needed
      requiresAuth = false;
    } else if (methodHasAuthorize) {
      // Method explicitly requires authorization
      requiresAuth = true;
    } else if (controllerHasAuthorize && !controllerHasAllowAnonymous) {
      // Controller requires authorization and method doesn't override
      requiresAuth = true;
    }
    // If no [Authorize] anywhere, requiresAuth remains false

    // Extract XML comments for description (before method signature)
    // Find comment block by looking backwards from method start
    const commentStart = controllerCode.lastIndexOf("///", methodStartIndex);
    const commentEnd = methodStartIndex;
    let description = "";
    let apiCode = "";
    let screenId = "";

    if (commentStart !== -1) {
      // Get comment block (from first /// to method start)
      const commentBlock = controllerCode.substring(commentStart, commentEnd);

      // Extract <summary>
      const summaryMatch = commentBlock.match(/<summary>([\s\S]*?)<\/summary>/);
      if (summaryMatch) {
        description = summaryMatch[1]
          .trim()
          .replace(/\s+/g, " ")
          .replace(/\n/g, " ");
      }

      // Extract API Code (e.g., "API Code: QS0031")
      // Search in entire comment block (including lines outside <summary>)
      const apiCodePatterns = [
        /API\s+Code:\s*([A-Z0-9]+)/i,  // Standard format: "API Code: QS0031" (with space)
        /API\s*Code\s*:\s*([A-Z0-9]+)/i, // Flexible spacing
      ];
      
      for (const pattern of apiCodePatterns) {
        const apiCodeMatch = commentBlock.match(pattern);
        if (apiCodeMatch && apiCodeMatch[1]) {
          apiCode = apiCodeMatch[1].trim();
          break;
        }
      }

      // Extract Screen ID (e.g., "Screen ID: SCR-001")
      const screenIdMatch = commentBlock.match(/Screen\s+ID:\s*([A-Z0-9-]+)/i);
      if (screenIdMatch) {
        screenId = screenIdMatch[1];
      }
    }

    // Extract method parameters
    const methodSignatureEnd = controllerCode.indexOf(")", methodStartIndex);
    if (methodSignatureEnd === -1) continue;
    
    const methodSignature = controllerCode.substring(
      methodStartIndex,
      methodSignatureEnd + 1
    );
    const parameters = extractParameters(methodSignature);

    // Build full route
    let fullRoute = baseRoute;
    const route = httpMethodMatch.route;
    if (route) {
      if (route.startsWith("/")) {
        fullRoute = route;
      } else {
        fullRoute = baseRoute + (baseRoute.endsWith("/") ? "" : "/") + route;
      }
    }

    // Replace [controller] with actual controller name
    fullRoute = fullRoute.replace(/\[controller\]/gi, controllerNameForRoute);

    // Replace route parameters: {param} -> :param (Postman format)
    // Also handle {param:type} -> :param
    fullRoute = fullRoute.replace(/{(\w+)(?::[^}]+)?}/g, ":$1");

    // Build full URL using {{baseUrl}} Postman variable instead of hardcoded URL
    const url = `{{baseUrl}}${fullRoute}`;

    // Build request name: {API Code} - {API Name}
    // API Name: Use summary from XML comments (first sentence, cleaned up) or method name as fallback
    let apiName = methodName;
    if (description) {
      // Extract first sentence from summary (before period, comma, or parentheses)
      const firstSentence = description
        .split(/[.,(]/)[0]
        .trim();
      if (firstSentence) {
        apiName = firstSentence;
      }
    }
    
    // Format: {API Code} - {API Name}
    // If no API Code, use fallback format
    const requestName = apiCode
      ? `${apiCode} - ${apiName}`
      : `${httpMethodMatch.method} ${controllerName.replace("Controller", "")} - ${apiName}`;
    
    // Debug: Log if API Code is missing (for troubleshooting)
    if (!apiCode && description) {
      // API Code should be in comment block, but wasn't found
      // This is expected if API Code is not present in XML comments
    }

    // Build headers - only add headers that are explicitly defined in code
    const headersMap = new Map<string, { key: string; value: string }>();
    
    // Helper to add header without duplicates
    const addHeader = (key: string, value: string) => {
      const keyLower = key.toLowerCase();
      if (!headersMap.has(keyLower)) {
        headersMap.set(keyLower, { key, value });
      }
    };
    
    // 1. Authorization header (only if authentication is required)
    // Default policy is RequireAuthenticatedUser, so add Authorization unless [AllowAnonymous] is present
    // This is based on explicit authorization attributes in code, so it's considered "explicit"
    if (requiresAuth) {
      addHeader("Authorization", "Bearer {{bearerToken}}");
    }
    
    // 2. Parse [FromHeader] parameters from method signature
    // Example: [FromHeader(Name = "X-Custom-Header")] string customHeader
    const fromHeaderRegex = /\[FromHeader(?:\(Name\s*=\s*["']([^"']+)["']\))?\]\s*\w+\s+(\w+)/g;
    let headerMatch;
    while ((headerMatch = fromHeaderRegex.exec(methodSignature)) !== null) {
      const headerName = headerMatch[1] || headerMatch[2]; // Use Name if provided, otherwise use parameter name
      // Add as Postman variable placeholder
      addHeader(headerName, `{{${headerName}}}`);
    }
    
    // 3. Custom headers from options (explicitly provided)
    if (options.defaultHeaders) {
      Object.entries(options.defaultHeaders).forEach(([key, value]) => {
        addHeader(key, value);
      });
    }
    
    // Convert map to array (preserve insertion order)
    const headers: Array<{ key: string; value: string }> = Array.from(
      headersMap.values()
    );

    endpoints.push({
      name: requestName,
      method: httpMethodMatch.method,
      url,
      description: description || `${httpMethodMatch.method} ${methodName}`,
      headers,
      parameters,
      apiCode,
      screenId,
    });
  }

  return endpoints;
}

/**
 * Extract method parameters from method signature
 */
function extractParameters(
  methodSignature: string
): Array<{
  name: string;
  type: string;
  location: "path" | "query" | "body";
  required: boolean;
}> {
  const parameters: Array<{
    name: string;
    type: string;
    location: "path" | "query" | "body";
    required: boolean;
  }> = [];

  // Match parameters with various patterns:
  // - [FromQuery] Guid versionId
  // - [FromQuery(Name = "vendorId")] List<Guid> vendorIds
  // - [FromRoute] Guid vendorId
  // - [FromBody] CreateCommand command
  // - Guid versionId (defaults to query)
  // Skip method declaration line (public async Task<...> MethodName)
  const methodDeclEnd = methodSignature.indexOf("(");
  if (methodDeclEnd === -1) return parameters;
  
  const paramsSection = methodSignature.substring(methodDeclEnd + 1);
  const paramRegex =
    /(?:\[From(Query|Route|Body)(?:\(Name\s*=\s*["'](\w+)["']\))?\])?\s*(\w+(?:<[^>]+>)?\??)\s+(\w+)(?:\s*=\s*[^,)]+)?/g;
  let match;

  while ((match = paramRegex.exec(paramsSection)) !== null) {
    const fromAttribute = match[1]?.toLowerCase();
    const queryParamName = match[2]; // Name from [FromQuery(Name = "vendorId")]
    const type = match[3];
    const name = match[4]; // Parameter name in code

    // Skip CancellationToken
    if (name === "cancellationToken" || type.includes("CancellationToken")) {
      continue;
    }

    // Handle PagedRequest - expand to individual query params
    if (type.includes("PagedRequest")) {
      parameters.push(
        { name: "pageNumber", type: "int", location: "query", required: false },
        { name: "pageSize", type: "int", location: "query", required: false },
        { name: "searchTerm", type: "string", location: "query", required: false }
      );
      continue;
    }

    // Use queryParamName if provided, otherwise use parameter name
    const paramName = queryParamName || name;

    let location: "path" | "query" | "body" = "query";
    if (fromAttribute === "route" || fromAttribute === "path") {
      location = "path";
    } else if (fromAttribute === "body") {
      location = "body";
    } else {
      // Default to query if no attribute or FromQuery
      location = "query";
    }

    const required = !type.includes("?") && !match[0].includes("=");

    parameters.push({
      name: paramName, // Use the query param name if specified
      type,
      location,
      required,
    });
  }

  return parameters;
}

/**
 * Generate Postman request body example from parameters
 */
export function generateRequestBodyExample(
  parameters: Array<{
    name: string;
    type: string;
    location: "path" | "query" | "body";
    required: boolean;
  }>
): string | undefined {
  const bodyParams = parameters.filter((p) => p.location === "body");

  if (bodyParams.length === 0) {
    return undefined;
  }

  const example: Record<string, unknown> = {};

  bodyParams.forEach((param) => {
    switch (param.type.toLowerCase()) {
      case "string":
      case "guid":
        example[param.name] = param.name === "id" ? "00000000-0000-0000-0000-000000000000" : "string";
        break;
      case "int":
      case "int32":
      case "int64":
      case "long":
        example[param.name] = 0;
        break;
      case "decimal":
      case "double":
      case "float":
        example[param.name] = 0.0;
        break;
      case "bool":
      case "boolean":
        example[param.name] = false;
        break;
      case "datetime":
        example[param.name] = "2024-01-01T00:00:00Z";
        break;
      default:
        example[param.name] = null;
    }
  });

  return Object.keys(example).length > 0 ? JSON.stringify(example, null, 2) : undefined;
}
