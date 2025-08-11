import React, { useMemo } from 'react';
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
} from 'recharts';

interface InlineChartProps {
  content: string;
  fallbackToCodeBlock?: boolean;
}

interface ChartConfig {
  type: 'bar' | 'line' | 'pie' | 'area' | 'scatter';
  data: any[];
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

const InlineChart: React.FC<InlineChartProps> = ({ content, fallbackToCodeBlock = false }) => {
  const { config, error } = useMemo(() => {
    try {
      const parsed = JSON.parse(content);
      if (!parsed.data || !Array.isArray(parsed.data) || !parsed.type) {
        return {
          config: null,
          error: 'Invalid chart configuration. Required: data (array) and type (string)'
        };
      }
      return { config: parsed as ChartConfig, error: null };
    } catch (e) {
      return { config: null, error: 'Invalid JSON format' };
    }
  }, [content]);

  if (error) {
    if (fallbackToCodeBlock) {
      return (
        <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded-md overflow-auto text-sm">
          <code>{content}</code>
        </pre>
      );
    }
    return (
      <div className="p-4 border border-red-300 rounded-md bg-red-50 dark:bg-red-900/20 dark:border-red-800">
        <p className="text-red-600 dark:text-red-300 text-sm">{error}</p>
      </div>
    );
  }

  if (!config) return null;

  const { type, data, title, xAxis, yAxis, colors = COLORS, height = 400 } = config;
  const chartColors = colors.length > 0 ? colors : COLORS;

  const renderChart = () => {
    const commonProps = {
      data,
      margin: { top: 20, right: 30, left: 20, bottom: 5 }
    };

    const tooltipStyle = {
      backgroundColor: 'rgb(31, 41, 55)',
      border: '1px solid rgb(55, 65, 81)',
      borderRadius: '6px',
      color: 'rgb(249, 250, 251)'
    };

    switch (type) {
      case 'bar':
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-300 dark:stroke-gray-600" />
            <XAxis dataKey={xAxis} className="fill-gray-600 dark:fill-gray-400" />
            <YAxis className="fill-gray-600 dark:fill-gray-400" />
            <Tooltip contentStyle={tooltipStyle} />
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
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-300 dark:stroke-gray-600" />
            <XAxis dataKey={xAxis} className="fill-gray-600 dark:fill-gray-400" />
            <YAxis className="fill-gray-600 dark:fill-gray-400" />
            <Tooltip contentStyle={tooltipStyle} />
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
          <AreaChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-300 dark:stroke-gray-600" />
            <XAxis dataKey={xAxis} className="fill-gray-600 dark:fill-gray-400" />
            <YAxis className="fill-gray-600 dark:fill-gray-400" />
            <Tooltip contentStyle={tooltipStyle} />
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
            )) : yAxis ? (
              <Area 
                type="monotone" 
                dataKey={yAxis} 
                stroke={chartColors[0]}
                fill={chartColors[0]}
                fillOpacity={0.7}
              />
            ) : null}
          </AreaChart>
        );

      case 'pie':
        return (
          <PieChart margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name || 'Unknown'} ${((percent || 0) * 100).toFixed(0)}%`}
              outerRadius={Math.min(800, height) * 0.3}
              fill="#8884d8"
              dataKey={Array.isArray(yAxis) ? yAxis[0] : yAxis}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
            <Legend />
          </PieChart>
        );

      case 'scatter':
        return (
          <ScatterChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-300 dark:stroke-gray-600" />
            <XAxis dataKey={xAxis} className="fill-gray-600 dark:fill-gray-400" />
            <YAxis dataKey={Array.isArray(yAxis) ? yAxis[0] : yAxis} className="fill-gray-600 dark:fill-gray-400" />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend />
            <Scatter data={data} fill={chartColors[0]} />
          </ScatterChart>
        );

      default:
        return (
          <div className="text-red-500 p-4">
            Unsupported chart type: {type}
          </div>
        );
    }
  };

  return (
    <div className="my-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
      {title && (
        <h3 className="text-lg font-semibold mb-4 text-center text-gray-800 dark:text-gray-200">
          {title}
        </h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        {renderChart()}
      </ResponsiveContainer>
    </div>
  );
};

export default InlineChart;
