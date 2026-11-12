import type { ToolSpec } from '@openuidev/react-lang';

/**
 * Tools for CSV data that run entirely in the browser.
 * The model writes Query("csv_group", {...}) in OpenUI Lang and the Renderer calls these functions
 * through toolProvider, so the UI can re-filter / re-group on $state changes without calling the model.
 */

export type CsvRow = Record<string, string | number | null>;

export interface CsvDataset {
  columns: string[];
  numericColumns: string[];
  rows: CsvRow[];
}

type Op = 'count' | 'sum' | 'avg' | 'min' | 'max';
type Order = 'asc' | 'desc';

const str = (v: unknown) => (v === undefined || v === null ? '' : String(v));

function applyFilter(rows: CsvRow[], column?: unknown, value?: unknown) {
  const col = str(column);
  const val = str(value);
  // "" or "__all__" disables the filter, so an "All" option in a Select works.
  if (!col || !val || val === '__all__') return rows;
  return rows.filter((r) => str(r[col]) === val);
}

export function createCsvToolProvider(data: CsvDataset) {
  const assertColumn = (c: unknown, field: string) => {
    if (c !== undefined && c !== null && c !== '' && !data.columns.includes(String(c)))
      throw new Error(`Unknown column "${String(c)}" in ${field}. Available: ${data.columns.join(', ')}`);
  };

  return {
    csv_rows: async (args: Record<string, unknown>) => {
      assertColumn(args.filter_column, 'filter_column');
      assertColumn(args.sort_by, 'sort_by');
      let rows = applyFilter(data.rows, args.filter_column, args.filter_value);
      const total = rows.length;
      const sortBy = str(args.sort_by);
      if (sortBy) {
        const dir = (args.order as Order) === 'asc' ? 1 : -1;
        rows = [...rows].sort((a, b) => {
          const x = a[sortBy];
          const y = b[sortBy];
          if (typeof x === 'number' && typeof y === 'number') return (x - y) * dir;
          return str(x).localeCompare(str(y)) * dir;
        });
      }
      const limit = Math.min(Math.max(Number(args.limit) || 20, 1), 200);
      return { rows: rows.slice(0, limit), total };
    },

    csv_group: async (args: Record<string, unknown>) => {
      const by = str(args.group_by);
      const valueCol = str(args.value_column);
      const op = ((args.op as Op) || 'count') as Op;
      if (!by) throw new Error('group_by is required.');
      assertColumn(by, 'group_by');
      assertColumn(args.filter_column, 'filter_column');
      if (op !== 'count') {
        assertColumn(valueCol, 'value_column');
        if (!data.numericColumns.includes(valueCol))
          throw new Error(
            `value_column "${valueCol}" is not numeric. Numeric columns: ${data.numericColumns.join(', ')}`,
          );
      }

      const buckets = new Map<string, number[]>();
      for (const r of applyFilter(data.rows, args.filter_column, args.filter_value)) {
        const key = str(r[by]) || '(empty)';
        const list = buckets.get(key) ?? [];
        const v = r[valueCol];
        list.push(typeof v === 'number' ? v : NaN);
        buckets.set(key, list);
      }

      const agg = (vals: number[]) => {
        if (op === 'count') return vals.length;
        const nums = vals.filter(Number.isFinite);
        if (!nums.length) return 0;
        if (op === 'sum') return nums.reduce((a, b) => a + b, 0);
        if (op === 'avg') return nums.reduce((a, b) => a + b, 0) / nums.length;
        if (op === 'min') return Math.min(...nums);
        return Math.max(...nums);
      };

      const dir = (args.order as Order) === 'asc' ? 1 : -1;
      const limit = Math.min(Math.max(Number(args.limit) || 12, 1), 50);
      const rows = [...buckets.entries()]
        .map(([key, vals]) => ({ key, value: Math.round(agg(vals) * 100) / 100 }))
        .sort((a, b) => (a.value - b.value) * dir)
        .slice(0, limit);
      return { rows, groups: buckets.size };
    },
  };
}

const filterProps = {
  filter_column: { type: 'string', description: 'Optional column to filter on (exact match).' },
  filter_value: { type: 'string', description: 'Value for filter_column. "" or "__all__" disables the filter.' },
};

export const CSV_TOOL_SPECS: ToolSpec[] = [
  {
    name: 'csv_rows',
    description: 'Returns rows of the loaded CSV dataset, optionally filtered and sorted. Numeric columns are numbers.',
    inputSchema: {
      type: 'object',
      properties: {
        ...filterProps,
        sort_by: { type: 'string', description: 'Column to sort by.' },
        order: { type: 'string', enum: ['asc', 'desc'] },
        limit: { type: 'number', description: 'Max rows (default 20, max 200).' },
      },
    },
    outputSchema: {
      type: 'object',
      properties: {
        rows: { type: 'array', items: { type: 'object', description: 'One row keyed by column name.' } },
        total: { type: 'number', description: 'Row count after filtering, before limit.' },
      },
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'csv_group',
    description:
      'Groups the CSV dataset by a column and aggregates. Result rows are {key, value}, sorted by value. Use for charts and rankings.',
    inputSchema: {
      type: 'object',
      required: ['group_by'],
      properties: {
        group_by: { type: 'string', description: 'Column to group by.' },
        op: { type: 'string', enum: ['count', 'sum', 'avg', 'min', 'max'], description: 'Default count.' },
        value_column: { type: 'string', description: 'Numeric column to aggregate (required unless op is count).' },
        ...filterProps,
        order: { type: 'string', enum: ['asc', 'desc'], description: 'Default desc.' },
        limit: { type: 'number', description: 'Max groups (default 12, max 50).' },
      },
    },
    outputSchema: {
      type: 'object',
      properties: {
        rows: {
          type: 'array',
          items: { type: 'object', properties: { key: { type: 'string' }, value: { type: 'number' } } },
        },
        groups: { type: 'number', description: 'Total number of groups before limit.' },
      },
    },
    annotations: { readOnlyHint: true },
  },
];

export const CSV_TOOL_EXAMPLES = [
  `root = Card([header, tldr, filters, chart, tbl, followUps])
header = CardHeader("Sales dataset", "1,240 rows · 6 columns")
tldr = TextContent("Revenue is concentrated in the North region; Q4 is the strongest quarter.")
$region = "__all__"
byProduct = Query("csv_group", {group_by: "product", op: "sum", value_column: "revenue", filter_column: "region", filter_value: $region}, {rows: [], groups: 0})
topRows = Query("csv_rows", {filter_column: "region", filter_value: $region, sort_by: "revenue", order: "desc", limit: 5}, {rows: [], total: 0})
filters = Form("filters", Buttons([]), [regionField])
regionField = FormControl("Region", Select("region", [SelectItem("__all__", "All regions"), SelectItem("North", "North"), SelectItem("South", "South")], null, null, $region))
chart = HorizontalBarChart(byProduct.rows.key, [Series("Revenue", byProduct.rows.value)])
tbl = Table([Col("Product", topRows.rows.product), Col("Revenue", topRows.rows.revenue, "number")])
followUps = FollowUpBlock([FollowUpItem("Which month had the highest revenue?"), FollowUpItem("Are there any outliers?")])`,
];

/**
 * A number as spreadsheets display it: "1234", "-3.5", "1,234,567.89", "$1,200", "12%", "€ 30".
 * Comma decimals ("1,5") stay text: they cannot be told apart from thousands reliably.
 */
export function parseNumber(value: string): number | null {
  let v = value.trim();
  if (!v) return null;
  const negative = /^\(.*\)$/.test(v);
  if (negative) v = v.slice(1, -1).trim();
  v = v
    .replace(/^(-?)\s*[$€£¥₫₹]\s*/, '$1')
    .replace(/\s*[$€£¥₫₹]$/, '')
    .replace(/%$/, '');
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(v)) v = v.replace(/,/g, '');
  if (!/^-?(\d+\.?\d*|\.\d+)(e-?\d+)?$/i.test(v)) return null;
  const n = Number(v);
  return Number.isFinite(n) ? (negative ? -n : n) : null;
}

/** Spreadsheet column letter for a 0-based index: 0 → A, 25 → Z, 26 → AA. */
function columnLetter(i: number): string {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

/**
 * Unique column names from a CSV header row, the way a spreadsheet user would read them: an empty
 * header becomes "Column C", a repeated one "Price (2)". Columns with neither a header nor any
 * value are dropped (null). Spreadsheet exports often have both.
 */
export function csvColumnNames(header: string[], rows: string[][]): (string | null)[] {
  // A loop, not Math.max(...rows): a large sheet would overflow the argument list.
  const width = rows.reduce((w, r) => Math.max(w, r.length), header.length);
  const used = new Map<string, number>();
  const names: (string | null)[] = [];
  for (let i = 0; i < width; i++) {
    let name = (header[i] ?? '').trim();
    if (!name) {
      if (!rows.some((r) => (r[i] ?? '').trim())) {
        names.push(null);
        continue;
      }
      name = `Column ${columnLetter(i)}`;
    }
    const seen = used.get(name) ?? 0;
    used.set(name, seen + 1);
    names.push(seen ? `${name} (${seen + 1})` : name);
  }
  // A renamed column could collide with a real header ("Price (2)"): number again until unique.
  const taken = new Set<string>();
  return names.map((n) => {
    if (n === null) return null;
    let unique = n;
    for (let k = 2; taken.has(unique); k++) unique = `${n} (${k})`;
    taken.add(unique);
    return unique;
  });
}
