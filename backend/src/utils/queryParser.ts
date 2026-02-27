/**
 * Utility functions for parsing and validating query parameters
 * Prevents type errors when query parameters come as strings from Express
 */

/**
 * Parse a query parameter as an integer with validation
 * @param value - The value to parse (string or number)
 * @param defaultValue - Default value if parsing fails
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @returns Parsed integer value
 */
export function parseInteger(
  value: string | number | undefined,
  defaultValue: number,
  min?: number,
  max?: number
): number {
  if (value === undefined || value === null) {
    return defaultValue;
  }

  const num = typeof value === 'string' ? parseInt(value, 10) : value;

  if (isNaN(num)) {
    return defaultValue;
  }

  let result = num;
  if (min !== undefined && result < min) {
    result = min;
  }
  if (max !== undefined && result > max) {
    result = max;
  }

  return result;
}

/**
 * Parse pagination parameters (page and limit)
 * @param page - Page number (string or number)
 * @param limit - Items per page (string or number)
 * @param defaultLimit - Default limit if not provided
 * @param maxLimit - Maximum allowed limit
 * @returns Object with parsed page and limit
 */
export function parsePagination(
  page: string | number | undefined,
  limit: string | number | undefined,
  defaultLimit: number = 10,
  maxLimit: number = 100
): { page: number; limit: number; skip: number } {
  const pageNum = parseInteger(page, 1, 1);
  const limitNum = parseInteger(limit, defaultLimit, 1, maxLimit);
  const skip = (pageNum - 1) * limitNum;

  return {
    page: pageNum,
    limit: limitNum,
    skip,
  };
}

/**
 * Parse a query parameter as a string
 * @param value - The value to parse
 * @param defaultValue - Default value if undefined
 * @returns String value or default
 */
export function parseString(
  value: string | undefined,
  defaultValue?: string
): string | undefined {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  return String(value).trim() || defaultValue;
}
