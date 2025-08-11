import dedent from 'dedent';

const chartComponent = dedent(`import React, { useMemo } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface ChartProps {
  data: any[];
  config: ChartConfig;
}

interface ChartConfig {
  type: 'bar' | 'line' | 'pie' | 'area' | 'scatter';
  title?: string;
  xAxis?: string;
  yAxis?: string | string[];
  colors?: string[];
  width?: number;
  height?: number;
}

const COLORS = [
  '#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00',
  '#ff0000', '#00ffff', '#ff00ff', '#ffff00', '#000080'
];

const ChartRenderer: React.FC<ChartProps> = ({ data, config }) => {
  const { type, title, xAxis, yAxis, colors = COLORS, width = 800, height = 400 } = config;

  const chartColors = useMemo(() => colors.length > 0 ? colors : COLORS, [colors]);

  const renderChart = () => {
    switch (type) {
      case 'bar':
        return (
          <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey={xAxis} stroke="#9CA3AF" />
            <YAxis stroke="#9CA3AF" />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#1F2937', 
                border: '1px solid #374151',
                borderRadius: '6px',
                color: '#F9FAFB'
              }} 
            />
            <Legend />
            {Array.isArray(yAxis) ? yAxis.map((key, index) => (
              <Bar 
                key={key} 
                dataKey={key} 
                fill={chartColors[index % chartColors.length]} 
                radius={[2, 2, 0, 0]}
              />
            )) : (
              <Bar 
                dataKey={yAxis} 
                fill={chartColors[0]} 
                radius={[2, 2, 0, 0]}
              />
            )}
          </BarChart>
        );

      case 'line':
        return (
          <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey={xAxis} stroke="#9CA3AF" />
            <YAxis stroke="#9CA3AF" />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#1F2937', 
                border: '1px solid #374151',
                borderRadius: '6px',
                color: '#F9FAFB'
              }} 
            />
            <Legend />
            {Array.isArray(yAxis) ? yAxis.map((key, index) => (
              <Line 
                key={key} 
                type="monotone" 
                dataKey={key} 
                stroke={chartColors[index % chartColors.length]}
                strokeWidth={2}
                dot={{ fill: chartColors[index % chartColors.length], strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6 }}
              />
            )) : (
              <Line 
                type="monotone" 
                dataKey={yAxis} 
                stroke={chartColors[0]}
                strokeWidth={2}
                dot={{ fill: chartColors[0], strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6 }}
              />
            )}
          </LineChart>
        );

      case 'area':
        return (
          <AreaChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey={xAxis} stroke="#9CA3AF" />
            <YAxis stroke="#9CA3AF" />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#1F2937', 
                border: '1px solid #374151',
                borderRadius: '6px',
                color: '#F9FAFB'
              }} 
            />
            <Legend />
            {Array.isArray(yAxis) ? yAxis.map((key, index) => (
              <Area 
                key={key} 
                type="monotone" 
                dataKey={key} 
                stackId="1"
                stroke={chartColors[index % chartColors.length]}
                fill={chartColors[index % chartColors.length]}
                fillOpacity={0.7}
              />
            )) : (
              <Area 
                type="monotone" 
                dataKey={yAxis} 
                stroke={chartColors[0]}
                fill={chartColors[0]}
                fillOpacity={0.7}
              />
            )}
          </AreaChart>
        );

      case 'pie':
        const pieData = data.map((item, index) => ({
          ...item,
          fill: chartColors[index % chartColors.length]
        }));
        
        return (
          <PieChart margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => \`\${name} \${(percent * 100).toFixed(0)}%\`}
              outerRadius={Math.min(width, height) * 0.3}
              fill="#8884d8"
              dataKey={Array.isArray(yAxis) ? yAxis[0] : yAxis}
            >
              {pieData.map((entry, index) => (
                <Cell key={\`cell-\${index}\`} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#1F2937', 
                border: '1px solid #374151',
                borderRadius: '6px',
                color: '#F9FAFB'
              }} 
            />
            <Legend />
          </PieChart>
        );

      case 'scatter':
        return (
          <ScatterChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey={xAxis} stroke="#9CA3AF" />
            <YAxis dataKey={Array.isArray(yAxis) ? yAxis[0] : yAxis} stroke="#9CA3AF" />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#1F2937', 
                border: '1px solid #374151',
                borderRadius: '6px',
                color: '#F9FAFB'
              }} 
            />
            <Legend />
            <Scatter 
              data={data} 
              fill={chartColors[0]}
            />
          </ScatterChart>
        );

      default:
        return <div className="text-red-400 p-4">Unsupported chart type: {type}</div>;
    }
  };

  return (
    <div className="w-full h-full bg-gray-900 p-6 text-white">
      {title && (
        <h3 className="text-xl font-semibold mb-4 text-center text-gray-100">
          {title}
        </h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        {renderChart()}
      </ResponsiveContainer>
    </div>
  );
};

export default ChartRenderer;`);

const wrapChartRenderer = (content: string) => {
  try {
    const config = JSON.parse(content);
    return dedent(`import React from 'react';
import ChartRenderer from '/components/ui/ChartRenderer';

const chartData = ${JSON.stringify(config.data, null, 2)};
const chartConfig = ${JSON.stringify({
  type: config.type,
  title: config.title,
  xAxis: config.xAxis,
  yAxis: config.yAxis,
  colors: config.colors,
  width: config.width || 800,
  height: config.height || 400
}, null, 2)};

export default function App() {
  return (
    <ChartRenderer data={chartData} config={chartConfig} />
  );
}
`);
  } catch (error) {
    return dedent(`import React from 'react';

export default function App() {
  return (
    <div className="p-4 text-red-400 bg-gray-900">
      <h3 className="text-lg font-semibold mb-2">Chart Configuration Error</h3>
      <p>Invalid JSON configuration. Please check your chart data format.</p>
      <pre className="mt-4 p-2 bg-gray-800 rounded text-xs overflow-auto">
${content}
      </pre>
    </div>
  );
}
`);
  }
};

export const getChartFiles = (content: string) => {
  return {
    'App.tsx': wrapChartRenderer(content),
    'index.tsx': dedent(`import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

import App from "./App";

const root = createRoot(document.getElementById("root"));
root.render(<App />);
;`),
    '/components/ui/ChartRenderer.tsx': chartComponent,
  };
};
