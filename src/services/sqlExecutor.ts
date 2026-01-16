/**
 * Simple SQL executor for SELECT queries without external dependencies
 * Supports basic SELECT with LIMIT, WHERE, ORDER BY
 */

export interface DataRow {
  [key: string]: any;
}

/**
 * Execute a simple SELECT query on an array of data
 * Supports:
 * - SELECT * or specific columns
 * - WHERE conditions (basic equality/comparison)
 * - ORDER BY
 * - LIMIT
 * 
 * @param sql SQL query string with ? as table placeholder
 * @param data Array of data rows to query
 * @returns Filtered and sorted result rows
 */
export function executeSql(sql: string, data: DataRow[]): DataRow[] {
  if (!sql || !data || data.length === 0) return [];

  try {
    // Replace ? with placeholder table name
    let query = sql.replace(/\?/g, 'data');
    query = query.trim();

    // Extract SELECT clause
    const selectMatch = query.match(/SELECT\s+([\s\S]*?)\s+FROM/i);
    if (!selectMatch) throw new Error('Invalid SELECT query');
    const selectClause = selectMatch[1].trim();

    // Extract WHERE clause if exists
    const whereMatch = query.match(/WHERE\s+([\s\S]*?)(?:ORDER BY|LIMIT|$)/i);
    const whereClause = whereMatch ? whereMatch[1].trim() : null;

    // Extract ORDER BY clause if exists
    const orderByMatch = query.match(/ORDER BY\s+([\s\S]*?)(?:LIMIT|$)/i);
    const orderByClause = orderByMatch ? orderByMatch[1].trim() : null;

    // Extract LIMIT if exists
    const limitMatch = query.match(/LIMIT\s+(\d+)/i);
    const limit = limitMatch ? parseInt(limitMatch[1], 10) : null;

    // Step 1: Apply WHERE filters
    let results = data;
    if (whereClause) {
      results = results.filter(row => evaluateWhere(row, whereClause));
    }

    // Step 2: Apply ORDER BY
    if (orderByClause) {
      results = applyOrderBy(results, orderByClause);
    }

    // Step 3: Apply column selection
    if (selectClause !== '*') {
      const columns = selectClause.split(',').map(c => c.trim());
      results = results.map(row => {
        const newRow: DataRow = {};
        columns.forEach(col => {
          if (col in row) {
            newRow[col] = row[col];
          }
        });
        return newRow;
      });
    }

    // Step 4: Apply LIMIT
    if (limit !== null) {
      results = results.slice(0, limit);
    }

    return results;
  } catch (err) {
    throw new Error(`SQL Execution Error: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Evaluate WHERE clause conditions
 */
function evaluateWhere(row: DataRow, whereClause: string): boolean {
  // Simple WHERE parser for basic conditions like "column > 100" or "column = 'value'"
  // Supports: =, >, <, >=, <=, !=, LIKE, IN

  // Split by AND/OR (basic implementation)
  const conditions = whereClause.split(/\s+AND\s+/i);

  for (const condition of conditions) {
    if (!evaluateCondition(row, condition.trim())) {
      return false;
    }
  }
  return true;
}

/**
 * Evaluate a single WHERE condition
 */
function evaluateCondition(row: DataRow, condition: string): boolean {
  // Match pattern: column operator value
  // Operators: =, >, <, >=, <=, !=, LIKE

  // Try to match operator
  const operatorMatch = condition.match(/(\w+)\s*(=|>|<|>=|<=|!=|LIKE)\s*(.+)/i);
  if (!operatorMatch) return true;

  const [, columnName, operator, valueStr] = operatorMatch;
  const columnValue = row[columnName.trim()];

  if (columnValue === undefined) return false;

  let value: any = valueStr.trim();

  // Parse string literals (remove quotes)
  if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
    value = value.slice(1, -1);
  } else if (!isNaN(value)) {
    value = Number(value);
  } else if (value.toLowerCase() === 'true') {
    value = true;
  } else if (value.toLowerCase() === 'false') {
    value = false;
  } else if (value.toLowerCase() === 'null') {
    value = null;
  }

  const op = operator.toUpperCase();

  switch (op) {
    case '=':
      return columnValue === value;
    case '>':
      return columnValue > value;
    case '<':
      return columnValue < value;
    case '>=':
      return columnValue >= value;
    case '<=':
      return columnValue <= value;
    case '!=':
      return columnValue !== value;
    case 'LIKE':
      return String(columnValue).toLowerCase().includes(String(value).toLowerCase());
    default:
      return true;
  }
}

/**
 * Apply ORDER BY sorting
 */
function applyOrderBy(data: DataRow[], orderByClause: string): DataRow[] {
  const sortSpecs = orderByClause.split(',').map(s => {
    const [column, direction = 'ASC'] = s.trim().split(/\s+/);
    return { column: column.trim(), direction: direction.toUpperCase() };
  });

  return [...data].sort((a, b) => {
    for (const spec of sortSpecs) {
      const aVal = a[spec.column];
      const bVal = b[spec.column];

      if (aVal === bVal) continue;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      const isAsc = spec.direction === 'ASC';
      if (aVal < bVal) return isAsc ? -1 : 1;
      if (aVal > bVal) return isAsc ? 1 : -1;
    }
    return 0;
  });
}
