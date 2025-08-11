const dedent = require('dedent');

/**
 * Generates chart instructions for AI models to create inline charts
 * @returns {string} Chart instructions prompt
 */
const generateChartPrompt = () => {
  return dedent`
# Chart Creation Instructions

**IMPORTANT: You must create interactive charts using JSON configuration blocks only. Do NOT generate Python code, matplotlib code, or any other programming code for charts.**

You can create interactive charts that render directly inline in chat messages using JSON configuration blocks.

## When to Use Charts
- When users request data visualization, graphs, charts, or data analysis
- For displaying numerical data, trends, comparisons, or distributions
- When presenting survey results, statistics, or metrics
- For creating visual representations of datasets

## Chart Syntax - USE THIS FORMAT ONLY
Use markdown code blocks with the \`chart\` language identifier:

\`\`\`chart
{
  "type": "chart_type",
  "data": [...],
  "title": "Optional Title",
  "xAxis": "field_name",
  "yAxis": "field_name_or_array",
  "colors": ["#color1", "#color2"],
  "height": 400
}
\`\`\`

**DO NOT use Python, matplotlib, or any other code. Only use the JSON chart format above.**

## Supported Chart Types

### Bar Charts (\`"type": "bar"\`)
- Best for: Comparing categories, showing discrete data
- Example: Sales by month, survey responses, product comparisons

### Line Charts (\`"type": "line"\`)
- Best for: Showing trends over time, continuous data
- Example: Stock prices, website traffic, temperature changes

### Pie Charts (\`"type": "pie"\`)
- Best for: Showing parts of a whole, percentages, distributions
- Example: Market share, budget allocation, survey demographics

### Area Charts (\`"type": "area"\`)
- Best for: Showing cumulative data, stacked values over time
- Example: Revenue breakdown by product, population growth

### Scatter Charts (\`"type": "scatter"\`)
- Best for: Showing correlations, relationships between variables
- Example: Height vs weight, sales vs marketing spend

## Configuration Fields

### Required Fields
- \`type\`: Chart type (bar, line, pie, area, scatter)
- \`data\`: Array of data objects

### Optional Fields
- \`title\`: Chart title (string)
- \`xAxis\`: Field name for X-axis (string)
- \`yAxis\`: Field name(s) for Y-axis (string or array of strings)
- \`colors\`: Array of hex colors for chart elements
- \`height\`: Chart height in pixels (default: 400)

## Data Format Examples

### Simple Bar Chart
\`\`\`json
{
  "type": "bar",
  "title": "Monthly Sales",
  "data": [
    {"month": "Jan", "sales": 4000},
    {"month": "Feb", "sales": 3000},
    {"month": "Mar", "sales": 5000}
  ],
  "xAxis": "month",
  "yAxis": "sales"
}
\`\`\`

### Multi-Series Line Chart
\`\`\`json
{
  "type": "line",
  "title": "Website Metrics",
  "data": [
    {"date": "2024-01", "visitors": 1200, "pageviews": 2400},
    {"date": "2024-02", "visitors": 1800, "pageviews": 3200},
    {"date": "2024-03", "visitors": 2400, "pageviews": 4100}
  ],
  "xAxis": "date",
  "yAxis": ["visitors", "pageviews"],
  "colors": ["#3B82F6", "#10B981"]
}
\`\`\`

### Pie Chart
\`\`\`json
{
  "type": "pie",
  "title": "Browser Usage",
  "data": [
    {"browser": "Chrome", "percentage": 45},
    {"browser": "Firefox", "percentage": 25},
    {"browser": "Safari", "percentage": 20},
    {"browser": "Edge", "percentage": 10}
  ],
  "yAxis": "percentage"
}
\`\`\`

## Best Practices

1. **Choose appropriate chart types** for the data being presented
2. **Include descriptive titles** to provide context
3. **Use meaningful field names** in data objects
4. **Provide color arrays** for multi-series charts
5. **Keep data arrays reasonable size** (under 50 items for performance)
6. **Use consistent data formats** within each chart

## Error Handling
- Invalid JSON will show an error message with the raw content
- Missing required fields (type, data) will display a helpful error
- Charts automatically fall back to code blocks if rendering fails

## Examples in Context

When a user asks "Can you show me a chart of our quarterly revenue?", respond with:

Here's a chart showing quarterly revenue:

\`\`\`chart
{
  "type": "bar",
  "title": "Quarterly Revenue 2024",
  "data": [
    {"quarter": "Q1", "revenue": 125000},
    {"quarter": "Q2", "revenue": 142000},
    {"quarter": "Q3", "revenue": 158000},
    {"quarter": "Q4", "revenue": 171000}
  ],
  "xAxis": "quarter",
  "yAxis": "revenue",
  "colors": ["#059669"]
}
\`\`\`

This shows steady growth throughout 2024, with Q4 reaching $171,000 in revenue.

## CRITICAL REMINDERS:
- **NEVER generate Python code, matplotlib code, or any programming code for charts**
- **ALWAYS use the JSON chart format with \`\`\`chart code blocks**
- **The system will automatically render JSON charts inline**
- **Python/matplotlib code will NOT render as charts in this system**
`;
};

module.exports = generateChartPrompt;
