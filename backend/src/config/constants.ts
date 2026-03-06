/**
 * Central URL constants - single source for API base URLs.
 * Backend scripts and services should use these.
 */
import { config } from './config';

/** Backend API base URL (e.g. http://localhost:5001/api/v1) */
export const API_BASE_URL = `${config.baseUrl.replace(/\/$/, '')}/api/v1`;

/** Backend server base (e.g. http://localhost:5001) */
export const SERVER_BASE_URL = config.baseUrl;
