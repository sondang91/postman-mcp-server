/**
 * Enhanced .NET Controller Parser
 * Parses C# controller code to extract API endpoint information
 */
export interface ParsedEndpoint {
    name: string;
    method: string;
    url: string;
    headers?: Array<{
        key: string;
        value: string;
    }>;
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
export declare function parseControllerEndpoints(controllerCode: string, options: ParseOptions): ParsedEndpoint[];
/**
 * Generate Postman request body example from parameters
 */
export declare function generateRequestBodyExample(parameters: Array<{
    name: string;
    type: string;
    location: "path" | "query" | "body";
    required: boolean;
}>): string | undefined;
//# sourceMappingURL=controller-parser.d.ts.map