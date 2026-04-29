/**
 * Shared connector types for REST API wrappers.
 */

/** Rate-limit configuration for a connector. */
export interface RateLimit {
	/** Maximum requests allowed per second. */
	requestsPerSecond: number;
	/** Maximum number of retries on transient failures. */
	maxRetries: number;
}

/** Generic connector for bioinformatics REST APIs. */
export interface BioConnector {
	/** Human-readable connector name. */
	name: string;
	/** Base URL for all requests. */
	baseUrl: string;
	/** Rate-limit settings. */
	rateLimit: RateLimit;
	/**
	 * Perform an HTTP request.
	 * @param endpoint - API endpoint path (e.g., "/esearch").
	 * @param params - Query or body parameters.
	 * @returns The parsed JSON response.
	 */
	request<T>(endpoint: string, params?: Record<string, unknown>): Promise<T>;
}

/** Error thrown when a connector request fails. */
export class ConnectorError extends Error {
	/** HTTP status code, if available. */
	statusCode: number;
	/** Endpoint path that triggered the error. */
	endpoint: string;

	constructor(message: string, statusCode: number, endpoint: string) {
		super(message);
		this.name = "ConnectorError";
		this.statusCode = statusCode;
		this.endpoint = endpoint;
	}
}
