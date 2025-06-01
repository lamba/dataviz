// Copyright, Puneet Singh Lamba 
// pslamba@gmail.com
// inventica.com

import React, { useState, useEffect, useRef, DragEvent } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, Brush, LineChart, Line, AreaChart, Area,
  ScatterChart, Scatter, ZAxis, ComposedChart, ReferenceLine
} from 'recharts';
import Papa from 'papaparse';
import packageJson from '../../package.json';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip as ChartTooltip,
  Legend as ChartLegend,
} from 'chart.js';
import { Bar as ChartJSBar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  ChartTooltip,
  ChartLegend
);

const version = packageJson.version;

// Utility functions 
const normalizeColumnName = (column: string): string => {
  return column.replace(/[\s-]/g, '').toLowerCase();
};

const generateChartKey = (): string => {
  return `chart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/************
 * INTERFACES
 * **********/

interface GuidanceMessageProps {
  type: string;
  details: string;
}

// Column statistics interface
interface ColumnStats {
  min: number;
  max: number;
  avg: number;
}

// Enhanced filter interfaces
interface NumericFilterRange {
  type: 'numeric';
  min: number;
  max: number;
  value: number;
}

interface CategoricalFilter {
  type: 'categorical';
  availableValues: string[];
  selectedValues: string[];
}

type FilterConfig = NumericFilterRange | CategoricalFilter;

// Chart configuration interface
interface ChartConfig {
  selectedColumns: string[];
  groupByColumn: string | null;
  filterValues: Record<string, number>;
  filterConfigs: Record<string, FilterConfig>;
  chartType: string;
  sortBy: string;
  displayCount: number;
  secondaryAxis: string | null;
  xAxisColumn: string;
  isHorizontal?: boolean;
}

// Chart component props
interface GenericDataChartProps {
  // Data source
  csvPath?: string;
  csvData?: string;
  
  // Configuration
  defaultXAxis?: string;       // Default X-axis column
  defaultYColumns?: string[];  // Default Y-axis columns
  defaultChartType?: string;
  defaultDisplayCount?: number;
  availableChartTypes?: string[];
  
  // Customization
  calculateTotal?: (row: any) => number;
  colorMap?: Record<string, string>;
  title?: string;
  height?: number | string;
  
  // Initial filters
  initialFilters?: Record<string, number>;
  
  // Callbacks
  onDataLoad?: (data: any[]) => void;
  onConfigChange?: (config: ChartConfig) => void;

  // File upload options
  enableFileUpload?: boolean;
  onFileChange?: (file: File) => void;
  
  // Attribution
  attribution?: string;
  attributionUrl?: string;
}

/******************
 * COMPONENT PROPS
*******************/

export const GenericDataChart: React.FC<GenericDataChartProps> = ({
  // Data source
  csvPath,
  csvData,
  
  // Configuration with defaults
  defaultXAxis,
  defaultYColumns = [],
  defaultChartType = 'stackedBar',
  defaultDisplayCount = 20,
  availableChartTypes = ['stackedBar', 'stackedBar100', 'groupedBar', 'line', 'area', 'scatter', 'composed'],
  
  // Customization
  calculateTotal,
  colorMap = {},
  title = 'Data Visualization Dashboard',
  height = 600,
  
  // Initial filters
  initialFilters = {},
  
  // Callbacks
  onDataLoad,
  onConfigChange,

  // File upload options
  enableFileUpload = true,
  onFileChange,

  // Attribution
  attribution,
  attributionUrl

}) => {
  
  /************** 
  STATE VARIABLES
  ***************/

  const [calculatedColumns, setCalculatedColumns] = useState<Record<string, any>>({});

  const [chartKey, setChartKey] = useState<string>(generateChartKey());

  // Raw data from CSV
  const [rawData, setRawData] = useState<any[]>([]);
  
  // File upload
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Use for export to SVG
  const chartRef = useRef<HTMLDivElement>(null);

  // Processed data
  const [data, setData] = useState<Record<string, any>[]>([]);
  
  // UI state
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Column information
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  
  // Chart configuration
  const [config, setConfig] = useState<ChartConfig>({
    selectedColumns: defaultYColumns.map(col => normalizeColumnName(col)),
    groupByColumn: null,
    filterValues: initialFilters,
    filterConfigs: {},
    chartType: defaultChartType,
    sortBy: defaultYColumns.length > 0 ? normalizeColumnName(defaultYColumns[0]) : 'id',
    displayCount: defaultDisplayCount,
    secondaryAxis: null,
    xAxisColumn: defaultXAxis ? normalizeColumnName(defaultXAxis) : 'id'
  });
  
  // Saved configurations
  const [savedConfigs, setSavedConfigs] = useState<Record<string, ChartConfig>>({});
  const [configName, setConfigName] = useState<string>('');
  
  // Data statistics
  const [dataStats, setDataStats] = useState<Record<string, ColumnStats>>({});
  
  // Chart type labels
  const chartTypeLabels: Record<string, string> = {
    'stackedBar': 'Stacked Bar',
    'stackedBar100': '100% Stacked Bar',
    'groupedBar': 'Grouped Bar',
    'line': 'Line Chart',
    'area': 'Area Chart',
    'scatter': 'Scatter Plot',
    'composed': 'Composed Chart'
  };

  // Helper function to clean Excel error values
  const cleanExcelErrors = (value: any): any => {
    if (typeof value === 'string') {
      // Check for Excel error values
      if (value.startsWith('#') && (
        value.includes('DIV') || 
        value.includes('VALUE') || 
        value.includes('N/A') || 
        value.includes('REF') || 
        value.includes('NAME') || 
        value.includes('NUM') || 
        value.includes('NULL')
      )) {
        return 0; // Convert Excel errors to 0
      }
    }
    return value;
  };

  /**************************
   * COMPONENT FUNCTIONS - UI
  ***************************/

  const DebugButton = () => (
    <button 
      onClick={debugCalculatedColumns}
      style={{
        ...quickButtonStyle,
        backgroundColor: '#ffebee',
        border: '1px solid #f44336'
      }}
    >
      🐛 Debug Formulas
    </button>
  );

  const DebugChartDataButton = () => (
    <button 
      onClick={debugChartData}
      style={{
        ...quickButtonStyle,
        backgroundColor: '#ffe6e6',
        border: '1px solid #ff5722'
      }}
    >
      🔍 Debug Chart Data
    </button>
  );

  /*****************************
   * COMPONENT FUNCTIONS - OTHER
  ******************************/

  const GuidanceMessage: React.FC<GuidanceMessageProps> = ({ type, details }) => (
    <div style={{
      margin: '10px 0',
      padding: '12px',
      backgroundColor: '#fff3cd',
      border: '1px solid #ffeaa7',
      borderRadius: '4px',
      color: '#856404'
    }}>
      <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
        ⚠️ Setup Guidance
      </div>
      <div>{details}</div>
    </div>
  );

  const sortData = (data: any[], sortBy: string, xAxisColumn: string) => {
    return [...data].sort((a: any, b: any) => {
      const valA = a[sortBy];
      const valB = b[sortBy];
      
      // Handle nulls
      if (valA == null && valB == null) return 0;
      if (valA == null) return 1;
      if (valB == null) return -1;
      
      if (sortBy === 'count') {
        return b.count - a.count; // Descending count
      } else if (sortBy === xAxisColumn) {
        // X-axis: ascending
        return typeof valA === 'string' 
          ? valA.localeCompare(valB, undefined, { numeric: true })
          : (Number(valA) || 0) - (Number(valB) || 0);
      } else {
        // Y-axis: descending
        return (Number(valB) || 0) - (Number(valA) || 0);
      }
    });
  };

  const exportToSVG = () => {
    if (!chartRef.current) {
      alert('Chart not ready for export');
      return;
    }
    
    // Find the SVG element inside the chart container
    const svgElement = chartRef.current.querySelector('svg');
    
    if (!svgElement) {
      alert('No SVG found in chart');
      return;
    }
    
    // Clone the SVG to avoid modifying the original
    const svgClone = svgElement.cloneNode(true) as SVGElement;
    
    // Add proper SVG attributes for standalone file
    svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svgClone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    
    // Get the SVG content as string
    const svgData = new XMLSerializer().serializeToString(svgClone);
    
    // Create blob and download
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);
    
    // Create download link
    const downloadLink = document.createElement('a');
    downloadLink.href = svgUrl;
    downloadLink.download = `${title.replace(/\s+/g, '_').toLowerCase()}_chart.svg`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    
    // Clean up
    URL.revokeObjectURL(svgUrl);
  };

  const debugChartData = () => {
    const chartData = prepareChartData();
    console.log("🔍 CHART DATA DEBUG:");
    console.log("Chart data sample:", chartData[0]);
    console.log("Available keys in first row:", Object.keys(chartData[0] || {}));
    console.log("Selected columns:", config.selectedColumns);
    console.log("Calculated columns:", Object.keys(calculatedColumns));
    
    // Check if avg_revenue values exist
    config.selectedColumns.forEach(col => {
      const sampleValue = chartData.length > 0 ? (chartData[0] as any)[col] : undefined;
      console.log(`Column '${col}' sample value:`, sampleValue, typeof sampleValue);
    });
  };

  const debugCalculatedColumns = () => {
    console.log("🔍 DEBUGGING CALCULATED COLUMNS:");
    console.log("calculatedColumns object:", calculatedColumns);
    console.log("Available columns:", availableColumns);
    console.log("Sample data row:", data[0]);
    
    // Test the calculation manually
    if (Object.keys(calculatedColumns).length > 0) {
      Object.entries(calculatedColumns).forEach(([columnName, formula]) => {
        console.log(`\n--- Testing formula: ${columnName} ---`);
        console.log("Formula config:", formula);
        
        if (formula.type === 'custom_average' && formula.columns) {
          console.log("Columns to average:", formula.columns);
          
          // Test with first data row
          const testRow = data[0];
          const values = formula.columns.map((col: string) => {
            const value = testRow[col];
            console.log(`  ${col}: ${value} (type: ${typeof value})`);
            return value;
          });
          
          const numericValues = values.filter((val: any) => typeof val === 'number' && !isNaN(val));
          console.log("Numeric values found:", numericValues);
          
          const result = numericValues.length > 0 
            ? numericValues.reduce((sum: number, val: number) => sum + val, 0) / numericValues.length 
            : 0;
          console.log("Calculated average:", result);
        }
      });
    } else {
      console.log("No calculated columns found!");
    }
  };

  const calculateQuickFormulas = (data: any[]): any[] => {

    console.log("🧮 calculateQuickFormulas called with:", {
      dataLength: data.length,
      calculatedColumnsCount: Object.keys(calculatedColumns).length,
      calculatedColumns: calculatedColumns
    });

    if (Object.keys(calculatedColumns).length === 0) {
      console.log("No calculated columns, returning original data");
      return data;
    }

    const result = data.map((row, rowIndex) => {
      const enhancedRow = { ...row };
      
      // Apply each calculated column
      Object.entries(calculatedColumns).forEach(([columnName, formula]) => {
        console.log(`Processing formula ${columnName} for row ${rowIndex}:`, formula);
        
        switch (formula.type) {
          case 'custom_average':
            if (!formula.columns || !Array.isArray(formula.columns)) {
              console.error(`Invalid columns for ${columnName}:`, formula.columns);
              enhancedRow[columnName] = 0;
              break;
            }
            
            const avgValues = formula.columns
              .map((col: string) => {
                const value = row[col];
                console.log(`  Column ${col}: ${value} (type: ${typeof value})`);
                return value;
              })
              .filter((val: any) => typeof val === 'number' && !isNaN(val));
            
            console.log(`  Numeric values for average:`, avgValues);
            
            enhancedRow[columnName] = avgValues.length > 0 
              ? avgValues.reduce((sum: number, val: number) => sum + val, 0) / avgValues.length 
              : 0;
            
            console.log(`  Result: ${enhancedRow[columnName]}`);
            break;
              
          case 'custom_sum':
            if (!formula.columns || !Array.isArray(formula.columns)) {
              console.error(`Invalid columns for ${columnName}:`, formula.columns);
              enhancedRow[columnName] = 0;
              break;
            }
            
            enhancedRow[columnName] = formula.columns
              .reduce((sum: number, col: string) => {
                const value = row[col] || 0;
                console.log(`  Adding ${col}: ${value}`);
                return sum + value;
              }, 0);
            
            console.log(`  Sum result: ${enhancedRow[columnName]}`);
            break;
              
          case 'average_selected':
            const selectedValues = config.selectedColumns
              .map(col => row[col])
              .filter(val => typeof val === 'number' && !isNaN(val));
            enhancedRow[columnName] = selectedValues.length > 0 
              ? selectedValues.reduce((sum, val) => sum + val, 0) / selectedValues.length 
              : 0;
            break;
              
          case 'sum_selected':
            enhancedRow[columnName] = config.selectedColumns
              .reduce((sum, col) => sum + (row[col] || 0), 0);
            break;
              
          case 'ratio':
            const numerator = row[formula.column1] || 0;
            const denominator = row[formula.column2] || 1;
            enhancedRow[columnName] = denominator !== 0 ? numerator / denominator : 0;
            console.log(`  Ratio: ${numerator}/${denominator} = ${enhancedRow[columnName]}`);
            break;
              
          case 'percentage':
            const part = row[formula.column1] || 0;
            const total = row[formula.column2] || 1;
            enhancedRow[columnName] = total !== 0 ? (part / total) * 100 : 0;
            console.log(`  Percentage: (${part}/${total}) * 100 = ${enhancedRow[columnName]}`);
            break;
            
          default:
            console.warn(`Unknown formula type: ${formula.type}`);
        }
      });
      
      return enhancedRow;
    });
    
    console.log("🧮 calculateQuickFormulas result sample:", result[0]);
    return result;
  };

  const showColumnSelector = (message: string, columns: string[], allowMultiple: boolean): string[] | null => {
    if (allowMultiple) {
      // For multiple selection, use a simple prompt for now
      const selection = prompt(
        `${message}\n\nAvailable columns:\n${columns.map((col, i) => `${i + 1}. ${col}`).join('\n')}\n\nEnter numbers separated by commas (e.g., "1,3,5"):`
      );
      
      if (!selection) return null;
      
      const indices = selection.split(',')
        .map(s => parseInt(s.trim()) - 1)
        .filter(i => i >= 0 && i < columns.length);
      
      return indices.map(i => columns[i]);
    } else {
      // For single selection
      const selection = prompt(
        `${message}\n\nAvailable columns:\n${columns.map((col, i) => `${i + 1}. ${col}`).join('\n')}\n\nEnter the number:`
      );
      
      if (!selection) return null;
      
      const index = parseInt(selection.trim()) - 1;
      if (index >= 0 && index < columns.length) {
        return [columns[index]];
      }
      
      return null;
    }
  };

  const isColumnCategorical = (data: any[], column: string): boolean => {
    if (data.length === 0) return false;
    
    const values = data.map(row => row[column]).filter(val => val !== undefined && val !== null && val !== '');
    const uniqueValues = new Set(values);
    
    // Consider categorical if:
    // 1. All values are strings, OR
    // 2. Less than 20 unique values and at least one non-numeric value, OR
    // 3. Unique values are less than 10% of total values (and more than 1)
    const hasStringValues = values.some(val => typeof val === 'string' && val.trim() !== '');
    const uniqueRatio = uniqueValues.size / values.length;
    
    return hasStringValues || 
           (uniqueValues.size < 20 && values.some(val => typeof val !== 'number')) ||
           (uniqueValues.size > 1 && uniqueRatio < 0.1 && uniqueValues.size < 50);
  };

  // Denormalize column names (for display)
  const denormalizeColumnName = (column: string): string => {
    // Find the original column name from available columns
    for (const availCol of availableColumns) {
      if (normalizeColumnName(availCol) === column) {
        return availCol;
      }
    }
    
    // Return the input if no match is found
    return column.charAt(0).toUpperCase() + column.slice(1);
  };

  // File upload handling functions
  const handleDrag = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };
  
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      handleFile(file);
    }
  };
  
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      handleFile(file);
    }
  };
  
  const handleFile = (file: File) => {
    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      alert('Please upload a CSV file');
      return;
    }
    
    setUploadedFileName(file.name);
    
    // Call the callback if provided
    if (onFileChange) {
      onFileChange(file);
    }
    
    // Read the file
    const reader = new FileReader();
    reader.onload = (e) => {
      const csvData = e.target?.result as string;
      if (csvData) {
        // Reset state for new data
        setRawData([]);
        setData([]);
        setAvailableColumns([]);
        setDataStats({});
        setConfig(prev => ({
          ...prev,
          selectedColumns: [],
          filterValues: {},
          filterConfigs: {}
        }));
        setLoading(true);
        
        // Process the new CSV data
        const results = Papa.parse(csvData, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true
        });
        
        if (results.data.length > 0) {
          setRawData(results.data);
          processData(results.data);
        } else {
          setError('No data found in uploaded CSV file.');
          setLoading(false);
        }
      }
    };
    reader.onerror = () => {
      setError('Error reading the CSV file.');
      setLoading(false);
    };
    reader.readAsText(file);
  };

  useEffect(() => {
    const fetchData = async () => {
      console.log("Data source changed, resetting all state...");
      
      // Complete state reset
      setRawData([]);
      setData([]);
      setAvailableColumns([]);
      setDataStats({});
      setSavedConfigs({});
      setConfigName('');
      setUploadedFileName(null);
      setLoading(true);
      setError(null);
      
      // Reset config to initial state - CRITICAL: ensure filterValues is empty
      const initialConfig = {
        selectedColumns: defaultYColumns.map(col => normalizeColumnName(col)),
        groupByColumn: null,
        filterValues: {}, // CRITICAL: Start with empty filter values
        filterConfigs: {}, // CRITICAL: Start with empty filter configs
        chartType: defaultChartType,
        sortBy: defaultYColumns.length > 0 ? normalizeColumnName(defaultYColumns[0]) : 'id',
        displayCount: defaultDisplayCount,
        secondaryAxis: null,
        xAxisColumn: defaultXAxis ? normalizeColumnName(defaultXAxis) : 'id'
      };
      
      console.log("Setting initial config:", initialConfig);
      console.log("defaultYColumns:", defaultYColumns);
      setConfig(initialConfig);
      
      try {
        let csvText = '';
        
        // If direct CSV data is provided, use it
        if (csvData) {
          csvText = csvData;
        } 
        // Otherwise fetch from path
        else if (csvPath) {
          console.log('Fetching CSV data from:', csvPath);
          const response = await fetch(csvPath);
          
          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }
          
          csvText = await response.text();
        } else {
          throw new Error('No data source provided. Please provide either csvPath or csvData prop.');
        }
        
        console.log('CSV data received, parsing...');
        
        // Parse CSV
        const results = Papa.parse(csvText, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true,
          transform: (value, field) => {
            // Clean Excel error values during parsing
            return cleanExcelErrors(value);
          }
        });
        
        if (results.data.length === 0) {
          throw new Error('No data found in CSV file.');
        }
        
        console.log(`Parsed ${results.data.length} rows of data`);
        
        setRawData(results.data);
        processData(results.data);
        
        // Call onDataLoad callback if provided
        if (onDataLoad) {
          onDataLoad(results.data);
        }
      } catch (error) {
        console.error('Error fetching or processing data:', error);
        setError(`Error loading data: ${error instanceof Error ? error.message : String(error)}`);
        setLoading(false);
      }
    };
    
    fetchData();
  }, [csvPath, csvData, onDataLoad]);
  
  // Reset when grouping changes
  useEffect(() => {
    setChartKey(generateChartKey());
  }, [config.groupByColumn]); 

  // Update config callback
  useEffect(() => {
    if (onConfigChange) {
      onConfigChange(config);
    }
  }, [config, onConfigChange]);
  
  const chartTypeKey = config.groupByColumn 
    ? `${config.chartType}-grouped-by-${config.groupByColumn}`
    : `${config.chartType}-ungrouped`;

  // Process the data
  const processData = (rawData: any[]) => {
    console.log("processData - starting with raw data:", rawData.length, "rows");
    
    console.log("🔍 Data Quality Check:");
    console.log("- Total rows:", rawData.length);
    console.log("- Non-empty rows:", rawData.filter(row => Object.values(row).some(val => val !== null && val !== '')).length);
    console.log("- Sample row:", rawData[0]);
    console.log("- Last row:", rawData[rawData.length - 1]);

    // Extract all available columns
    const columnsArray = Object.keys(rawData[0] || {});
    console.log("processData - available columns:", columnsArray);
    setAvailableColumns(columnsArray);
    
    // Determine default x-axis column if not provided
    const effectiveXAxis = defaultXAxis ? 
      normalizeColumnName(defaultXAxis) : 
      normalizeColumnName(columnsArray[0]);
    
    // Determine Y-axis columns
    let effectiveYColumns = defaultYColumns.map(col => normalizeColumnName(col));
    
    if (effectiveYColumns.length === 0) {
      // Auto-select appropriate columns for Y-axis (numeric OR boolean columns)
      effectiveYColumns = columnsArray
        .filter(col => {
          const normalizedCol = normalizeColumnName(col);
          // Skip X-axis column
          if (normalizedCol === effectiveXAxis) return false;
          
          // Check if column contains numeric OR boolean values
          const hasNumericData = rawData.some(row => {
            const val = row[col];
            return (typeof val === 'number' && !isNaN(val) && val !== 0) || typeof val === 'boolean';
          });
          
          // Also accept categorical columns if no numeric columns found
          return hasNumericData;
        })
        .slice(0, 2)  // Take up to 2 columns by default
        .map(col => normalizeColumnName(col));
      
      // If still no good columns, fall back to any categorical columns
      if (effectiveYColumns.length === 0) {
        effectiveYColumns = columnsArray
          .filter(col => {
            const normalizedCol = normalizeColumnName(col);
            return normalizedCol !== effectiveXAxis && isColumnCategorical(rawData, col);
          })
          .slice(0, 2)
          .map(col => normalizeColumnName(col));
      }
    }
    
    console.log("processData - effectiveYColumns:", effectiveYColumns);
    
    // Calculate statistics for each column
    const stats: Record<string, ColumnStats> = {};
    const filterConfigs: Record<string, FilterConfig> = {};
    
    columnsArray.forEach(column => {
      const normalizedCol = normalizeColumnName(column);
      const columnValues = rawData.map(row => row[column])
        .filter(val => val !== undefined && val !== null && val !== '');
      
      console.log(`processData - analyzing column '${column}' (${normalizedCol}):`, columnValues.slice(0, 5));
      
      if (isColumnCategorical(rawData, column)) {
        // Categorical filter
        const uniqueValues = Array.from(new Set(columnValues))
          .map(val => String(val).trim())
          .filter(val => val !== '')
          .sort();
        
        console.log(`processData - categorical column '${column}': ${uniqueValues.length} unique values:`, uniqueValues);
        
        filterConfigs[normalizedCol] = {
          type: 'categorical',
          availableValues: uniqueValues,
          selectedValues: [...uniqueValues] // Create a new array, select all initially
        };
      } else {
        // Numeric filter and stats
        const numericValues = columnValues.filter(val => typeof val === 'number' && !isNaN(val));
        if (numericValues.length > 0) {
          const min = Math.min(...numericValues);
          const max = Math.max(...numericValues);
          const avg = numericValues.reduce((sum, val) => sum + val, 0) / numericValues.length;
          
          stats[column] = { min, max, avg };
          
          filterConfigs[normalizedCol] = {
            type: 'numeric',
            min,
            max,
            value: min
          };
          
          console.log(`processData - numeric column '${column}': min=${min}, max=${max}, avg=${avg}`);
        }
      }
    });
    
    console.log("processData - filter configs created:", filterConfigs);
    setDataStats(stats);
    
    // Process the data rows
    const processedData = rawData.map((row, index) => {
      const processedRow: Record<string, any> = { 
        id: index // Simple numeric ID
      };
      
      // Add all columns with normalized names
      columnsArray.forEach(column => {
        const columnKey = normalizeColumnName(column);
        const value = row[column];
        // Preserve boolean values, convert null/undefined to 0 for numbers, empty string for strings
        if (value === null || value === undefined || value === '') {
          processedRow[columnKey] = typeof rawData.find(r => r[column] !== null && r[column] !== undefined && r[column] !== '')?.[column] === 'string' ? '' : 0;
        } else {
          processedRow[columnKey] = value;
        }
      });
      
      // Calculate total if needed
      if (calculateTotal) {
        processedRow.total = calculateTotal(row);
      } else {
        // Default total calculation - sum of all numeric values
        processedRow.total = columnsArray.reduce((sum, col) => {
          const val = row[col];
          return sum + (typeof val === 'number' ? Math.abs(val) : 0);
        }, 0);
      }
      
      return processedRow;
    });
    
    console.log("processData - processed data sample:", processedData.slice(0, 2));
    console.log("🔍 TEST - I AM HERE!");
    
    // Update config with determined defaults AND filter configs
    console.log("processData - setting new config:");
    console.log("- effectiveXAxis:", effectiveXAxis);
    console.log("- effectiveYColumns:", effectiveYColumns);
    console.log("- filterConfigs:", filterConfigs);
    
    console.log("🔍 CALCULATED COLUMNS CHECK:", Object.keys(calculatedColumns));
    const dataWithFormulas = calculateQuickFormulas(processedData);
    const calculatedColumnNames = Object.keys(calculatedColumns);
    const allColumns = [...columnsArray, ...calculatedColumnNames];
    setAvailableColumns(allColumns);

    setConfig(prev => ({
      ...prev,
      selectedColumns: effectiveYColumns,
      xAxisColumn: effectiveXAxis,
      sortBy: effectiveYColumns.length > 0 ? effectiveYColumns[0] : effectiveXAxis,
      filterConfigs: filterConfigs // This is critical - we need to set the filter configs
    }));
    
    setData(dataWithFormulas);
    console.log("🔧 processData - setting loading to FALSE");

    /*
    The Loading Flow (State Management):
      -Component starts: loading = true (spinner shows)
      -Data fetches: CSV loads and gets processed
      -Processing completes: setLoading(false) (spinner disappears)
      -Chart renders: Your actual chart appears
    */

    // Component transitions from loading → showing chart
    setLoading(false); // ← Tells React "data is ready, show the chart"
    
    console.log("🔧 processData - completed successfully");
    console.log("🔧 Final state should be:");
    console.log("   - loading: false");
    console.log("   - data.length:", processedData.length);
    console.log("   - availableColumns:", columnsArray);
    console.log("   - selectedColumns:", effectiveYColumns);
    
    // Force a re-render by triggering a small state change
    setTimeout(() => {
      console.log("🔧 FORCING RE-RENDER after data load");
      setConfig(prev => ({ ...prev })); // This should trigger a re-render
    }, 100);
  };
  
  // Function to shorten text for display
  const shortenText = (text: string, maxLength = 20): string => {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  };

  const addQuickFormula = (type: string) => {
    const numericColumns = availableColumns.filter(col => {
      const normalizedCol = normalizeColumnName(col);
      // Check if column has numeric data
      const hasNumericData = data.some(row => {
        const val = row[normalizedCol];
        return typeof val === 'number' && !isNaN(val) && val !== 0;
      });
      return hasNumericData && normalizedCol !== config.xAxisColumn;
    });
    
    if (numericColumns.length < 1) {
      alert('Need at least 1 numeric column for calculations');
      return;
    }
    
    let columnName = '';
    let formula: any = {};
    
    switch (type) {
      case 'custom_average':
        // Let user select specific columns for averaging
        const avgColumns = showColumnSelector(
          'Select columns to average:', 
          numericColumns,
          true // allow multiple selection
        );
        if (!avgColumns || avgColumns.length === 0) return;
        
        columnName = `avg_${avgColumns.join('_').replace(/\s+/g, '_')}`;
        formula = { 
          type: 'custom_average', 
          name: `Avg of (${avgColumns.map(col => denormalizeColumnName(col)).join(', ')})`,
          columns: avgColumns.map(col => normalizeColumnName(col))
        };
        break;
        
      case 'custom_sum':
        // Let user select specific columns for summing
        const sumColumns = showColumnSelector(
          'Select columns to sum:', 
          numericColumns,
          true // allow multiple selection
        );
        if (!sumColumns || sumColumns.length === 0) return;
        
        columnName = `sum_${sumColumns.join('_').replace(/\s+/g, '_')}`;
        formula = { 
          type: 'custom_sum', 
          name: `Sum of (${sumColumns.map(col => denormalizeColumnName(col)).join(', ')})`,
          columns: sumColumns.map(col => normalizeColumnName(col))
        };
        break;
        
      case 'custom_ratio':
        // Let user select numerator and denominator
        const numeratorCol = showColumnSelector(
          'Select numerator column:', 
          numericColumns,
          false // single selection
        );
        if (!numeratorCol || numeratorCol.length === 0) return;
        
        const denominatorCol = showColumnSelector(
          'Select denominator column:', 
          numericColumns.filter(col => col !== numeratorCol[0]),
          false // single selection
        );
        if (!denominatorCol || denominatorCol.length === 0) return;
        
        columnName = `ratio_${numeratorCol[0]}_per_${denominatorCol[0]}`.replace(/\s+/g, '_');
        formula = { 
          type: 'ratio', 
          name: `${denormalizeColumnName(numeratorCol[0])} ÷ ${denormalizeColumnName(denominatorCol[0])}`,
          column1: normalizeColumnName(numeratorCol[0]),
          column2: normalizeColumnName(denominatorCol[0])
        };
        break;
        
      case 'custom_percentage':
        // Let user select part and total columns
        const partCol = showColumnSelector(
          'Select the "part" column:', 
          numericColumns,
          false // single selection
        );
        if (!partCol || partCol.length === 0) return;
        
        const totalCol = showColumnSelector(
          'Select the "total" column:', 
          numericColumns.filter(col => col !== partCol[0]),
          false // single selection
        );
        if (!totalCol || totalCol.length === 0) return;
        
        columnName = `pct_${partCol[0]}_of_${totalCol[0]}`.replace(/\s+/g, '_');
        formula = { 
          type: 'percentage', 
          name: `${denormalizeColumnName(partCol[0])} as % of ${denormalizeColumnName(totalCol[0])}`,
          column1: normalizeColumnName(partCol[0]),
          column2: normalizeColumnName(totalCol[0])
        };
        break;
        
      default:
        return;
    }
    
    // Add the calculated column
    setCalculatedColumns(prev => ({
      ...prev,
      [columnName]: formula
    }));
    
    // Trigger re-render
    setConfig(prev => ({ ...prev }));
  };

  // remove formula if user deletes it
  const removeCalculatedColumn = (columnName: string) => {
    setCalculatedColumns(prev => {
      const newCalc = { ...prev };
      delete newCalc[columnName];
      return newCalc;
    });
    
    // Remove from selected columns if it was selected
    updateConfig({
      selectedColumns: config.selectedColumns.filter(col => col !== columnName)
    });
    
    // Trigger data reprocessing
    setTimeout(() => {
      processData(rawData);
    }, 100);
  };
  
  // Prepare chart data with filtering, grouping, and sorting
  const prepareChartData = () => {
    console.log("🔥 prepareChartData CALLED - data.length:", data.length);
    console.log("🔥 prepareChartData - config.selectedColumns:", config.selectedColumns);
    console.log("🔥 prepareChartData - config.filterConfigs keys:", Object.keys(config.filterConfigs || {}));
    
    let filteredData = [...data];
    
    console.log("prepareChartData - starting with:", filteredData.length, "rows");
    console.log("prepareChartData - config:", config);
    
    // Apply legacy numeric filters (backward compatibility)
    Object.entries(config.filterValues).forEach(([column, value]) => {
      const beforeCount = filteredData.length;
      filteredData = filteredData.filter(row => {
        const rowValue = row[column];
        return rowValue !== undefined && rowValue >= value;
      });
      console.log(`Legacy filter ${column} >= ${value}: ${beforeCount} → ${filteredData.length}`);
    });
    
    // Apply new filter configurations
    Object.entries(config.filterConfigs || {}).forEach(([column, filterConfig]) => {
      const beforeCount = filteredData.length;
      if (filterConfig.type === 'numeric') {
        filteredData = filteredData.filter(row => {
          const rowValue = row[column];
          return rowValue !== undefined && rowValue >= filterConfig.value;
        });
        console.log(`Numeric filter ${column} >= ${filterConfig.value}: ${beforeCount} → ${filteredData.length}`);
      } else if (filterConfig.type === 'categorical') {
        if (filterConfig.selectedValues.length === 0) {
          console.log(`Categorical filter ${column}: No values selected, filtering out all rows`);
          filteredData = [];
        } else {
          filteredData = filteredData.filter(row => {
            const rowValue = row[column];
            const stringValue = String(rowValue).trim();
            const included = filterConfig.selectedValues.includes(stringValue);
            
            return included;
          });
          console.log(`Categorical filter ${column} (${filterConfig.selectedValues.length}/${filterConfig.availableValues.length} selected): ${beforeCount} → ${filteredData.length}`);
        }
      }
    });
    
    console.log("prepareChartData - after all filters:", filteredData.length, "rows");
    
    // Apply grouping if needed
    if (config.groupByColumn) {
      console.log("🔥 Taking GROUPED path - sorting won't work here yet");
      return prepareGroupedData(filteredData);
    }
    
    console.log("🔥 About to sort by:", config.sortBy);
    console.log("🔥 Data before sort:", filteredData.slice(0, 3));

    // Sort data
    filteredData = sortData(filteredData, config.sortBy, config.xAxisColumn);

    console.log("🔥 Data after sort:", filteredData.slice(0, 3));
    console.log("🔥 SORTING DEBUG - END");

    // Return the limited number of rows
    const result = filteredData.slice(0, config.displayCount);
    console.log("🔥 prepareChartData - final result:", result.length, "rows");
    console.log("🔥 prepareChartData - displayCount setting:", config.displayCount);
    console.log("🔥 prepareChartData - sample result:", result[0]);
    return result;
  };
  
  const prepareGroupedData = (filteredData: Record<string, any>[]) => {
    if (!config.groupByColumn) return filteredData;
    
    console.log("🔧 prepareGroupedData - starting with", filteredData.length, "rows");
    
    // Create groups
    const groups: Record<string, any> = {};
    
    filteredData.forEach(row => {
      const groupValue = row[config.groupByColumn!];
      const groupKey = String(groupValue).trim().replace(/[^\w\s-]/g, '');
      
      if (!groups[groupKey]) {
        groups[groupKey] = {
          id: groupKey,
          [config.xAxisColumn]: groupKey,
          count: 0
        };
        
        // Initialize all selected columns to 0
        config.selectedColumns.forEach(col => {
          groups[groupKey][col] = 0;
        });
        
        // Initialize ALL available columns (not just selected ones)
        // This ensures we have the base data for ratio calculations
        availableColumns.forEach(column => {
          const normalizedCol = normalizeColumnName(column);
          if (!groups[groupKey][normalizedCol]) {
            groups[groupKey][normalizedCol] = 0;
          }
        });
      }
      
      // Add values from this row to the group for ALL columns
      availableColumns.forEach(column => {
        const normalizedCol = normalizeColumnName(column);
        const value = row[normalizedCol] || 0;
        if (typeof value === 'number') {
          groups[groupKey][normalizedCol] += value;
        } else {
          // For non-numeric values, just take the first one
          if (!groups[groupKey][normalizedCol]) {
            groups[groupKey][normalizedCol] = value;
          }
        }
      });
      
      groups[groupKey].count += 1;
    });
    
    // Convert groups object to array
    const groupedData = Object.values(groups);
    
    console.log("🔧 prepareGroupedData - groups before ratio recalculation:");
    groupedData.forEach(group => {
      console.log(`  ${group.id}:`, {
        revenue: group.revenue,
        marketingspend: group.marketingspend,
        count: group.count
      });
    });
    
    // RECALCULATE all calculated columns on the grouped data
    const groupedDataWithCalculations = groupedData.map(group => {
      const enhancedGroup = { ...group };
      
      // Apply each calculated column formula to the grouped data
      Object.entries(calculatedColumns).forEach(([columnName, formula]) => {
        console.log(`🔧 Recalculating ${columnName} for group ${group.id}`);
        
        switch (formula.type) {
          case 'custom_average':
            const avgValues = formula.columns
              .map((col: string) => group[col])
              .filter((val: any) => typeof val === 'number' && !isNaN(val));
            enhancedGroup[columnName] = avgValues.length > 0 
              ? avgValues.reduce((sum: number, val: number) => sum + val, 0) / avgValues.length 
              : 0;
            console.log(`  Custom average: ${formula.columns.join('+')} = ${enhancedGroup[columnName]}`);
            break;
              
          case 'custom_sum':
            enhancedGroup[columnName] = formula.columns
              .reduce((sum: number, col: string) => sum + (group[col] || 0), 0);
            console.log(`  Custom sum: ${formula.columns.join('+')} = ${enhancedGroup[columnName]}`);
            break;
              
          case 'ratio':
            const numerator = group[formula.column1] || 0;
            const denominator = group[formula.column2] || 1;
            enhancedGroup[columnName] = denominator !== 0 ? numerator / denominator : 0;
            console.log(`  Ratio: ${numerator} / ${denominator} = ${enhancedGroup[columnName]}`);
            console.log(`  Formula details: column1=${formula.column1}, column2=${formula.column2}`);
            break;
              
          case 'percentage':
            const part = group[formula.column1] || 0;
            const total = group[formula.column2] || 1;
            enhancedGroup[columnName] = total !== 0 ? (part / total) * 100 : 0;
            console.log(`  Percentage: (${part} / ${total}) * 100 = ${enhancedGroup[columnName]}`);
            break;
        }
      });
      
      // sort grouped data
      const sortedGroupedData = sortData(groupedDataWithCalculations, config.sortBy, config.xAxisColumn);

      return sortedGroupedData.slice(0, config.displayCount);

    });
    
    console.log("🔧 prepareGroupedData - groups after ratio recalculation:");
    groupedDataWithCalculations.forEach(group => {
      const ratioColumns = Object.keys(calculatedColumns);
      const ratioValues = ratioColumns.reduce((acc, col) => {
        (acc as any)[col] = (group as any)[col] || 0;
        return acc;
      }, {} as Record<string, any>);
      
      console.log(`🔧 ${(group as any).id}:`, {
        revenue: (group as any).revenue,
        marketingspend: (group as any).marketingspend,
        count: (group as any).count,
        calculatedColumns: ratioValues
      });
    });
    
    // Sort grouped data
    if (config.sortBy === 'count') {
      groupedDataWithCalculations.sort((a: any, b: any) => (b as any).count - (a as any).count);
    } else if (config.selectedColumns.includes(config.sortBy)) {
      groupedDataWithCalculations.sort((a: any, b: any) => (b as any)[config.sortBy] - (a as any)[config.sortBy]);
    } else {
      groupedDataWithCalculations.sort((a: any, b: any) => String((a as any)[config.xAxisColumn]).localeCompare(String((b as any)[config.xAxisColumn])));
    }
    
    const limitedGroupedData = groupedDataWithCalculations.slice(0, config.displayCount);
    console.log("🔧 prepareGroupedData - final result:", limitedGroupedData.length, "groups");
    
    return limitedGroupedData;
  };
  
  // Get column color
  const getColumnColor = (column: string, index: number) => {
    // Use provided colorMap first
    if (colorMap[column]) {
      return colorMap[column];
    }
    
    // Fall back to color scheme
    const colorScheme = [
      '#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088fe', '#00c49f', 
      '#ffbb28', '#ff5733', '#1fd655', '#FFCC00', '#FF9900', '#FF6600'
    ];
    
    return colorScheme[index % colorScheme.length];
  };
  
  const CustomTooltip: React.FC<any> = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      
      console.log("🔍 TOOLTIP DEBUG:", {
        selectedColumns: config.selectedColumns,
        dataKeys: Object.keys(data),
        dataValues: data
      });
      
      return (
        <div style={{ 
          backgroundColor: '#fff', 
          padding: '10px', 
          border: '1px solid #ccc',
          borderRadius: '4px',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
        }}>
          <p style={{ margin: 0, fontWeight: 'bold' }}>
            {config.xAxisColumn}: {typeof data[config.xAxisColumn] === 'number' 
              ? data[config.xAxisColumn].toFixed(2) 
              : data[config.xAxisColumn]}
          </p>
          {config.selectedColumns.map(column => {
            // Try to find the value in the data object
            let value = data[column];
            
            // If not found, try to find it with different case variations
            if (value === undefined) {
              const dataKeys = Object.keys(data);
              const matchingKey = dataKeys.find(key => 
                key.toLowerCase() === column.toLowerCase()
              );
              if (matchingKey) {
                value = data[matchingKey];
              }
            }
            
            // If still not found, look for calculated columns
            if (value === undefined) {
              // Look for calculated column variations
              const calculatedKeys = Object.keys(calculatedColumns);
              const matchingCalcKey = calculatedKeys.find(calcKey => 
                normalizeColumnName(calcKey) === column
              );
              if (matchingCalcKey) {
                value = data[matchingCalcKey];
              }
            }
            
            return (
              <p key={column} style={{ margin: 0 }}>
                {denormalizeColumnName(column)}: {
                  value !== undefined 
                    ? (typeof value === 'number' ? value.toFixed(2) : value)
                    : 'N/A'
                }
              </p>
            );
          })}
          {data.count !== undefined && (
            <p style={{ margin: 0 }}>Count: {data.count}</p>
          )}
        </div>
      );
    }
    return null;
  };
  
  // Handle config changes
  const updateConfig = (changes: Partial<ChartConfig>) => {
    setConfig(prev => {
      const newConfig = { ...prev, ...changes };
      
      // If selected columns changed, validate sortBy
      if (changes.selectedColumns) {
        const validSortOptions = [
          ...newConfig.selectedColumns,
          newConfig.xAxisColumn,
          ...(newConfig.groupByColumn ? ['count'] : [])
        ];
        
        // If current sortBy is not valid, pick a new one
        if (!validSortOptions.includes(newConfig.sortBy)) {
          newConfig.sortBy = newConfig.selectedColumns.length > 0 
            ? newConfig.selectedColumns[0] 
            : newConfig.xAxisColumn;
          
          console.log(`🔧 Auto-updated sortBy from '${prev.sortBy}' to '${newConfig.sortBy}'`);
        }
      }
      
      return newConfig;
    });
  };

  // Helper function to update filter configurations (type-safe)
  const updateFilterConfig = (column: string, updates: Partial<FilterConfig>) => {
    setConfig(prev => {
      const currentFilter = prev.filterConfigs[column];
      if (!currentFilter) return prev;

      let updatedFilter: FilterConfig;
      
      if (currentFilter.type === 'numeric' && updates.type !== 'categorical') {
        // Safe to update numeric filter
        updatedFilter = {
          ...currentFilter,
          ...updates
        } as NumericFilterRange;
      } else if (currentFilter.type === 'categorical' && updates.type !== 'numeric') {
        // Safe to update categorical filter
        updatedFilter = {
          ...currentFilter,
          ...updates
        } as CategoricalFilter;
      } else {
        // Don't allow type changes
        updatedFilter = currentFilter;
      }

      return {
        ...prev,
        filterConfigs: {
          ...prev.filterConfigs,
          [column]: updatedFilter
        }
      };
    });
  };
  
  // Save current configuration
  const saveCurrentConfig = () => {
    if (!configName.trim()) return;
    
    setSavedConfigs(prev => ({
      ...prev,
      [configName]: { ...config }
    }));
    
    setConfigName('');
  };
  
  // Load a saved configuration
  const loadConfig = (name: string) => {
    if (!name || !savedConfigs[name]) return;
    setConfig(savedConfigs[name]);
  };
  
  // Export filtered data to CSV
  const exportToCSV = (data: any[]) => {
    // Prepare data for export
    const exportData = data.map(row => {
      const exportRow: Record<string, any> = { };
      
      // Add x-axis column
      const xAxisOriginalName = denormalizeColumnName(config.xAxisColumn);
      exportRow[xAxisOriginalName] = row[config.xAxisColumn];
      
      // Add selected columns
      config.selectedColumns.forEach(column => {
        exportRow[denormalizeColumnName(column)] = row[column];
      });
      
      // Add count if present
      if (row.count !== undefined) {
        exportRow.Count = row.count;
      }
      
      return exportRow;
    });
    
    // Generate CSV
    const csv = Papa.unparse(exportData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    // Create download link
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${title.replace(/\s+/g, '_').toLowerCase()}_export.csv`);
    document.body.appendChild(link);
    link.click();
    
    // Clean up
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const CustomLegend = () => {
    console.log("CustomLegend - config.selectedColumns:", config.selectedColumns);
    console.log("CustomLegend - availableColumns:", availableColumns);
    
    if (config.selectedColumns.length === 0) return null;
    
    const getSortingDescription = () => {
      if (config.sortBy === 'count') {
        return 'Sorted by Count (High to Low)';
      } else if (config.sortBy === config.xAxisColumn) {
        return `Sorted by ${denormalizeColumnName(config.xAxisColumn)} (Low to High)`;
      } else {
        return `Sorted by ${denormalizeColumnName(config.sortBy)} (High to Low)`;
      }
    };

    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        marginTop: '15px',
        marginBottom: '10px',
        padding: '10px',
        backgroundColor: '#f9f9f9',
        borderRadius: '4px',
        border: '1px solid #eee'
      }}>
        {/* Legend Label */}
        <div style={{
          fontSize: '12px',
          fontWeight: 'bold',
          color: '#333',
          marginBottom: '8px'
        }}>
          Selected Columns:
        </div>
        
        {/* Legend Items */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '20px',
          flexWrap: 'wrap'
        }}>
          {config.selectedColumns.map((column, index) => (
            <div key={`custom-legend-${column}`} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <div style={{
                width: '16px',
                height: '16px',
                backgroundColor: getColumnColor(column, index),
                border: '1px solid #ccc',
                borderRadius: '2px'
              }} />
              <span style={{
                fontSize: '12px',
                color: '#666'
              }}>
                {denormalizeColumnName(column)}
              </span>
            </div>
          ))}
        </div>

        {/* Sorting Information */}
        <div style={{
          fontSize: '11px',
          color: '#666',
          fontStyle: 'italic',
          textAlign: 'center',
          borderTop: '1px solid #ddd',
          paddingTop: '6px',
          marginTop: '4px'
        }}>
          {getSortingDescription()}
          {config.groupByColumn && (
            <span> • Grouped by {denormalizeColumnName(config.groupByColumn)}</span>
          )}
          <span> • Showing {mainChartData.length} of {data.length} records</span>
        </div>

      </div>
    );
  };

  const getFilterSummary = () => {
    const summaries = [];
    
    // Check categorical filters
    Object.entries(config.filterConfigs || {}).forEach(([column, filterConfig]) => {
      if (filterConfig.type === 'categorical') {
        const selectedCount = filterConfig.selectedValues.length;
        const totalCount = filterConfig.availableValues.length;
        
        // Only show if not all values are selected
        if (selectedCount < totalCount && selectedCount > 0) {
          const originalName = denormalizeColumnName(column);
          if (selectedCount === 1) {
            summaries.push(`${originalName}: ${filterConfig.selectedValues[0]}`);
          } else if (selectedCount <= 3) {
            summaries.push(`${originalName}: ${filterConfig.selectedValues.join(', ')}`);
          } else {
            summaries.push(`${originalName}: ${selectedCount}/${totalCount} selected`);
          }
        }
      } else if (filterConfig.type === 'numeric') {
        // Only show if filter value is above minimum
        if (filterConfig.value > filterConfig.min) {
          const originalName = denormalizeColumnName(column);
          summaries.push(`${originalName} ≥ ${filterConfig.value.toFixed(1)}`);
        }
      }
    });
    
    // Check legacy filters
    Object.entries(config.filterValues).forEach(([column, value]) => {
      if (value > 0) {
        const originalName = denormalizeColumnName(column);
        summaries.push(`${originalName} ≥ ${value}`);
      }
    });
    
    // Add grouping info
    if (config.groupByColumn) {
      summaries.push(`Grouped by ${denormalizeColumnName(config.groupByColumn)}`);
    }
    
    return summaries;
  };

  const renderFilters = () => (
    <div>
      <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>Filters:</div>
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
        gap: '15px',
        maxHeight: '400px',
        overflowY: 'auto',
        padding: '10px',
        border: '1px solid #eee',
        borderRadius: '4px',
        backgroundColor: '#fafafa'
      }}>
        {Object.entries(config.filterConfigs || {}).map(([column, filterConfig]) => {
          const originalColumnName = denormalizeColumnName(column);
          
          if (filterConfig.type === 'numeric') {
            return (
              <div key={`filter-${column}`} style={{ 
                padding: '10px', 
                border: '1px solid #ddd', 
                borderRadius: '4px',
                backgroundColor: 'white'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <label style={{ fontWeight: 'bold' }}>{originalColumnName}:</label>
                  <span style={{ 
                    backgroundColor: '#e6f3ff', 
                    padding: '2px 6px', 
                    borderRadius: '3px', 
                    fontSize: '0.9em' 
                  }}>
                    ≥ {filterConfig.value.toFixed(1)}
                  </span>
                </div>
                <input
                  type="range"
                  min={filterConfig.min}
                  max={filterConfig.max}
                  step={(filterConfig.max - filterConfig.min) / 100}
                  value={filterConfig.value}
                  onChange={e => updateFilterConfig(column, { value: parseFloat(e.target.value) })}
                  style={{ width: '100%', marginBottom: '5px' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8em', color: '#666' }}>
                  <span>{filterConfig.min.toFixed(1)}</span>
                  <span>{filterConfig.max.toFixed(1)}</span>
                </div>
              </div>
            );
          } else if (filterConfig.type === 'categorical') {
            return (
              <div key={`filter-${column}`} style={{ 
                padding: '10px', 
                border: '1px solid #ddd', 
                borderRadius: '4px',
                backgroundColor: 'white'
              }}>
                <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>{originalColumnName}:</div>
                
                {/* Select All/None buttons */}
                <div style={{ marginBottom: '8px', display: 'flex', gap: '5px' }}>
                  <button
                    onClick={() => updateFilterConfig(column, { 
                      selectedValues: [...filterConfig.availableValues] 
                    })}
                    style={{ 
                      padding: '3px 8px', 
                      fontSize: '0.8em', 
                      backgroundColor: '#e6f3ff', 
                      border: '1px solid #ccc', 
                      borderRadius: '3px',
                      cursor: 'pointer'
                    }}
                  >
                    All
                  </button>
                  <button
                    onClick={() => updateFilterConfig(column, { selectedValues: [] })}
                    style={{ 
                      padding: '3px 8px', 
                      fontSize: '0.8em', 
                      backgroundColor: '#ffe6e6', 
                      border: '1px solid #ccc', 
                      borderRadius: '3px',
                      cursor: 'pointer'
                    }}
                  >
                    None
                  </button>
                  <span style={{ 
                    fontSize: '0.8em', 
                    color: '#666', 
                    alignSelf: 'center' 
                  }}>
                    ({filterConfig.selectedValues.length}/{filterConfig.availableValues.length})
                  </span>
                </div>
                
                {/* Checkbox list */}
                <div style={{ 
                  maxHeight: '150px', 
                  overflowY: 'auto', 
                  border: '1px solid #eee', 
                  borderRadius: '3px',
                  padding: '5px'
                }}>
                  {filterConfig.availableValues.map(value => (
                    <label 
                      key={value} 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center',
                        padding: '2px 4px',
                        cursor: 'pointer'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={filterConfig.selectedValues.includes(value)}
                        onChange={() => {
                          const newSelected = filterConfig.selectedValues.includes(value)
                            ? filterConfig.selectedValues.filter(v => v !== value)
                            : [...filterConfig.selectedValues, value];
                          updateFilterConfig(column, { selectedValues: newSelected });
                        }}
                        style={{ marginRight: '6px' }}
                      />
                      <span style={{ fontSize: '0.9em' }}>{value}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          }
          
          return null;
        })}
      </div>
    </div>
  );

  const createChartBrush = (chartData: any[]) => {
    // Only show brush if we have enough data points
    if (chartData.length <= 10) return null;
    
    return (
      <Brush 
        key={`brush-${chartKey}-${config.xAxisColumn}-${chartData.length}`}
        dataKey={config.xAxisColumn} 
        height={25} 
        //y={375}
        stroke="#8884d8"
        startIndex={0}
        endIndex={Math.min(chartData.length - 1, Math.max(19, Math.floor(chartData.length * 0.8)))}
        travellerWidth={8}
      />
    );
  };

  const QuickFormulas = () => {
    return (
      <div style={{ 
        marginTop: '15px', 
        padding: '12px', 
        border: '1px solid #ddd', 
        borderRadius: '5px',
        backgroundColor: '#f9f9f9'
      }}>
        <h4 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>Quick Formulas</h4>
        
        {/* Show existing calculated columns */}
        {Object.keys(calculatedColumns).length > 0 && (
          <div style={{ marginBottom: '10px' }}>
            {Object.entries(calculatedColumns).map(([columnName, formula]) => (
              <div key={columnName} style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                padding: '4px 8px',
                backgroundColor: '#e6f3ff',
                borderRadius: '3px',
                marginBottom: '4px',
                fontSize: '12px'
              }}>
                <span><strong>{formula.name}</strong></span>
                <button 
                  onClick={() => removeCalculatedColumn(columnName)}
                  style={{ 
                    background: 'none', 
                    border: 'none', 
                    color: 'red', 
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
        
        {/* Enhanced formula buttons */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button 
            onClick={() => addQuickFormula('custom_average')}
            style={quickButtonStyle}
            title="Create average of selected columns"
          >
            📊 Custom Average
          </button>
          
          <button 
            onClick={() => addQuickFormula('custom_sum')}
            style={quickButtonStyle}
            title="Create sum of selected columns"
          >
            ➕ Custom Sum
          </button>
          
          <button 
            onClick={() => addQuickFormula('custom_ratio')}
            style={quickButtonStyle}
            title="Create ratio between two columns"
          >
            ➗ Custom Ratio
          </button>
          
          <button 
            onClick={() => addQuickFormula('custom_percentage')}
            style={quickButtonStyle}
            title="Create percentage calculation"
          >
            📈 Custom %
          </button>
          
          {/* DEBUGGING BUTTONS: */}
          <DebugButton />
          <DebugChartDataButton />

        </div>
        
        <div style={{ 
          marginTop: '8px', 
          fontSize: '11px', 
          color: '#666',
          fontStyle: 'italic'
        }}>
          Click buttons to create calculated columns. You'll be prompted to select specific columns for each calculation.
        </div>
      </div>
    );
  };

  const quickButtonStyle = {
    padding: '6px 10px',
    fontSize: '11px',
    backgroundColor: '#e3f2fd',
    border: '1px solid #2196f3',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  };

  const renderHorizontalStackedBar100 = (chartData: any[]) => {
    // Calculate percentage data for 100% stacked bars
    const percentageData = chartData.map(row => {
      const total = config.selectedColumns.reduce((sum, col) => sum + ((row as any)[col] || 0), 0);
      const percentageRow = { ...row };
      config.selectedColumns.forEach(col => {
        (percentageRow as any)[col] = total > 0 ? (((row as any)[col] || 0) / total) * 100 : 0;
      });
      return percentageRow;
    });

    // Prepare data for Chart.js format
    const labels = percentageData.map(row => String(row[config.xAxisColumn]));
    
    const datasets = config.selectedColumns.map((column, index) => ({
      label: denormalizeColumnName(column),
      data: percentageData.map(row => row[column] || 0),
      backgroundColor: getColumnColor(column, index),
      borderColor: getColumnColor(column, index),
      borderWidth: 1,
      stack: 'stack1', // This creates the stacking
    }));

    const data = {
      labels,
      datasets,
    };

    const options = {
      indexAxis: 'y' as const, // This makes it horizontal!
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top' as const,
        },
        title: {
          display: true,
          text: config.groupByColumn 
            ? `Aggregated Percentages (Grouped by ${denormalizeColumnName(config.groupByColumn)})`
            : 'Percentage Distribution',
        },
        tooltip: {
          callbacks: {
            title: (context: any) => {
              return `${denormalizeColumnName(config.xAxisColumn)}: ${context[0].label}`;
            },
            label: (context: any) => {
              return `${context.dataset.label}: ${context.parsed.x.toFixed(1)}%`;
            }
          }
        }
      },
      scales: {
        x: {
          stacked: true,
          max: 100,
          title: {
            display: true,
            text: 'Percentage (%)'
          }
        },
        y: {
          stacked: true,
          title: {
            display: true,
            text: denormalizeColumnName(config.xAxisColumn)
          }
        },
      },
    };

    return (
      <div style={{ height: '500px', width: '100%' }}>
        <ChartJSBar data={data} options={options} />
      </div>
    );
  };

  const renderHorizontalGroupedBar = (chartData: any[]) => {
    // Prepare data for Chart.js format
    const labels = chartData.map(row => String(row[config.xAxisColumn]));
    
    const datasets = config.selectedColumns.map((column, index) => ({
      label: denormalizeColumnName(column),
      data: chartData.map(row => row[column] || 0),
      backgroundColor: getColumnColor(column, index),
      borderColor: getColumnColor(column, index),
      borderWidth: 1,
      // CRITICAL: Remove any stack property - grouped bars should NOT stack
      // stack: undefined, // Make sure no stacking
    }));

    const data = {
      labels,
      datasets,
    };

    const options = {
      indexAxis: 'y' as const,
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top' as const,
        },
        title: {
          display: true,
          text: config.groupByColumn 
            ? `Grouped Values by ${denormalizeColumnName(config.groupByColumn)}`
            : 'Grouped Values',
        },
        tooltip: {
          callbacks: {
            title: (context: any) => {
              return `${denormalizeColumnName(config.xAxisColumn)}: ${context[0].label}`;
            },
            label: (context: any) => {
              return `${context.dataset.label}: ${context.parsed.x.toLocaleString()}`;
            }
          }
        }
      },
      scales: {
        x: {
          // CRITICAL: No stacking for grouped bars
          stacked: false,
          title: {
            display: true,
            text: config.selectedColumns.length === 1 
              ? denormalizeColumnName(config.selectedColumns[0])
              : 'Values'
          }
        },
        y: {
          // CRITICAL: No stacking for grouped bars
          stacked: false,
          title: {
            display: true,
            text: denormalizeColumnName(config.xAxisColumn)
          }
        },
      },
    };

    return (
      <div style={{ height: '500px', width: '100%' }}>
        <ChartJSBar 
          key={`horizontal-grouped-${chartKey}-${config.selectedColumns.join('-')}`}
          data={data} 
          options={options} 
        />
      </div>
    );
  };

  const renderHorizontalStackedBar = (chartData: any[]) => {
    const labels = chartData.map(row => String(row[config.xAxisColumn]));
    
    const datasets = config.selectedColumns.map((column, index) => ({
      label: denormalizeColumnName(column),
      data: chartData.map(row => row[column] || 0),
      backgroundColor: getColumnColor(column, index),
      borderColor: getColumnColor(column, index),
      borderWidth: 1,
      stack: 'stack1', // Ensure stacking
    }));

    const data = {
      labels,
      datasets,
    };

    const options = {
      indexAxis: 'y' as const,
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top' as const,
        },
        title: {
          display: true,
          text: config.groupByColumn 
            ? `Stacked Values by ${denormalizeColumnName(config.groupByColumn)}`
            : 'Stacked Values',
        },
        tooltip: {
          callbacks: {
            title: (context: any) => {
              return `${denormalizeColumnName(config.xAxisColumn)}: ${context[0].label}`;
            },
            label: (context: any) => {
              return `${context.dataset.label}: ${context.parsed.x.toLocaleString()}`;
            }
          }
        }
      },
      scales: {
        x: {
          stacked: true, // Enable stacking
          title: {
            display: true,
            text: config.selectedColumns.length === 1 
              ? denormalizeColumnName(config.selectedColumns[0])
              : 'Values'
          }
        },
        y: {
          stacked: true, // Enable stacking
          title: {
            display: true,
            text: denormalizeColumnName(config.xAxisColumn)
          }
        },
      },
    };

    return (
      <div style={{ height: '500px', width: '100%' }}>
        <ChartJSBar 
          key={`horizontal-stacked-${chartKey}-${config.selectedColumns.join('-')}`}
          data={data} 
          options={options} 
        />
      </div>
    );
  };

  // Chart rendering function 
  const renderChart = () => {
    console.log("renderChart - function called");
    const chartData = prepareChartData();
    
    // Helper function to generate Y-axis label
    const getYAxisLabel = () => {
      if (config.selectedColumns.length === 1) {
        return denormalizeColumnName(config.selectedColumns[0]);
      } else if (config.selectedColumns.length > 1) {
        // For multiple columns, show a generic label or combine names
        return config.selectedColumns.map(col => denormalizeColumnName(col)).join(' + ');
      }
      return 'Values';
    };

    // For grouped data, might want different y-axis label
    const getYAxisLabelForGrouped = () => {
      if (config.groupByColumn) {
        return `Aggregated Values (Grouped by ${denormalizeColumnName(config.groupByColumn)})`;
      }
      return getYAxisLabel();
    };

    // centralize margin definitions for all charts
    // Then use everywhere:
    //    <BarChart margin={getMargins()} data={chartData}>
    // these margin control the space outside the chart area, used by labels etc.
    const getMargins = () => {
      const base = { top: 20, right: 30, left: 100, bottom: 0 };

      switch (config.chartType) {
        case 'line':
        case 'groupedBar':
          return { ...base, bottom: 150 }; // More space for rotated X labels
        case 'composed':
          return { ...base, right: 60 };   // More space for right Y-axis
        default:
          return base;
      }
    };

    console.log("Chart rendering - data length:", chartData.length);
    console.log("Chart rendering - selected columns:", config.selectedColumns);
    console.log("Chart rendering - sample data:", chartData[0]);
    console.log("Chart rendering - X-axis column:", config.xAxisColumn);
    console.log("Chart rendering - available columns:", availableColumns);
    console.log("Chart rendering - X-axis values:", chartData.slice(0, 3).map(row => (row as any)[config.xAxisColumn]));
    
    if (chartData.length === 0) {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
          <div style={{ textAlign: 'center' }}>
            <h3>No Data to Display</h3>
            <p>Try adjusting your filters or selecting different columns</p>
          </div>
        </div>
      );
    }
    
    if (config.selectedColumns.length === 0) {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
          <div style={{ textAlign: 'center' }}>
            <h3>No Columns Selected</h3>
            <p>Please select at least one column to display in the chart</p>
          </div>
        </div>
      );
    }
    
    const isNumericXAxis = chartData.length > 0 && typeof (chartData[0] as any)[config.xAxisColumn] === 'number';
    
    /***************
     * STACKED 100 *
     ***************/

    if (config.chartType === 'stackedBar100') {
      if (config.isHorizontal) {
        return renderHorizontalStackedBar100(chartData);
      }
      // Calculate percentage data for 100% stacked bars
      const percentageData = chartData.map(row => {
        const total = config.selectedColumns.reduce((sum, col) => sum + ((row as any)[col] || 0), 0);
        const percentageRow = { ...row };
        config.selectedColumns.forEach(col => {
          (percentageRow as any)[col] = total > 0 ? (((row as any)[col] || 0) / total) * 100 : 0;
        });
        return percentageRow;
      });
      
      console.log("Rendering 100% stacked bar chart with data:", percentageData.length, "rows");
      return (
        <BarChart
          key={`${chartKey}-${chartTypeKey}`}
          data={percentageData}
          margin={getMargins()}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            key={`xaxis-${chartKey}-${chartTypeKey}`}
            dataKey={config.xAxisColumn}
            angle={isNumericXAxis ? 0 : -45} 
            textAnchor={isNumericXAxis ? 'middle' : 'end'}
            type={isNumericXAxis ? 'number' : 'category'}
            height={100} 
            interval={isNumericXAxis ? 'preserveStartEnd' : 0}
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => {
              const stringValue = String(value);
              return stringValue.length > 15 ? stringValue.substring(0, 15) + '...' : stringValue;
            }}
            name={denormalizeColumnName(config.xAxisColumn)}
          />
          <YAxis 
            key={`yaxis-${chartKey}-${chartTypeKey}`}
            domain={[0, 100]}
            tickFormatter={(value) => `${value}%`}
            label={{ 
              value: 'Percentage (%)', 
              angle: -90, 
              position: 'left',
              offset: 20,
              style: { textAnchor: 'middle' }
            }}
          />
          <Tooltip 
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload;
                return (
                  <div style={{ 
                    backgroundColor: '#fff', 
                    padding: '10px', 
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                  }}>
                    <p style={{ margin: 0, fontWeight: 'bold' }}>
                      {config.xAxisColumn}: {data[config.xAxisColumn]}
                    </p>
                    {config.selectedColumns.map(column => (
                      <p key={column} style={{ margin: 0 }}>
                        {denormalizeColumnName(column)}: {data[column].toFixed(1)}%
                      </p>
                    ))}
                  </div>
                );
              }
              return null;
            }}
          />
          {/* Legend removed - using custom legend below chart */}
          {config.selectedColumns.map((column, index) => (
            <Bar 
              key={column} 
              dataKey={column} 
              name={denormalizeColumnName(column)} 
              stackId="percentage" 
              fill={getColumnColor(column, index)} 
            />
          ))}
          {createChartBrush(chartData)}
        </BarChart>
      );
    }
    
    /***********
     * STACKED *
     ***********/

    // This is the default chart the app loads with
    if (config.chartType === 'stackedBar') {
      // Handle horizontal orientation with Chart.js
      if (config.isHorizontal) {
        return renderHorizontalStackedBar(chartData);
      }
      
      // Keep vertical orientation with Recharts (your existing code)
      return (
        <BarChart
          key={`${chartKey}-${chartTypeKey}`}
          data={chartData}
          margin={getMargins()}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey={config.xAxisColumn}
            angle={isNumericXAxis ? 0 : -45} 
            textAnchor={isNumericXAxis ? 'middle' : 'end'}
            height={100} 
            interval={0}
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => {
              const stringValue = String(value);
              return stringValue.length > 15 ? stringValue.substring(0, 15) + '...' : stringValue;
            }}
          />
          <YAxis 
            label={{ 
              value: config.groupByColumn ? getYAxisLabelForGrouped() : getYAxisLabel(), 
              angle: -90, 
              position: 'left',
              offset: 20,
              style: { textAnchor: 'middle' }
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          {config.selectedColumns.map((column, index) => (
            <Bar 
              key={column}
              dataKey={column} 
              name={denormalizeColumnName(column)} 
              stackId="a" 
              fill={getColumnColor(column, index)} 
            />
          ))}
        </BarChart>
      );
    }

    /***********
     * GROUPED *
     ***********/

    if (config.chartType === 'groupedBar') {
      if (config.isHorizontal) {
        return renderHorizontalGroupedBar(chartData);
      }
      return (
        <BarChart
          key={`${chartKey}-${chartTypeKey}`}
          data={chartData}
          margin={getMargins()}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            key={`xaxis-${chartKey}-${chartTypeKey}`}
            dataKey={config.xAxisColumn}
            angle={isNumericXAxis ? 0 : -45} 
            textAnchor={isNumericXAxis ? 'middle' : 'end'}
            type={isNumericXAxis ? 'number' : 'category'}
            height={100} 
            interval={isNumericXAxis ? 'preserveStartEnd' : 0}
            tick={{ fontSize: 12 }}
            name={denormalizeColumnName(config.xAxisColumn)}
          />
          <YAxis 
            key={`yaxis-${chartKey}-${chartTypeKey}`}
            label={{ 
              value: config.groupByColumn ? getYAxisLabelForGrouped() : getYAxisLabel(), 
              //     ^^^^ Same conditional logic as stackedBar
              angle: -90, 
              position: 'left',
              offset: 20,
              style: { textAnchor: 'middle' }
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          {/* Legend removed - using custom legend below chart */}
          {config.selectedColumns.map((column, index) => (
            <Bar 
              key={column} 
              dataKey={column} 
              name={denormalizeColumnName(column)} 
              fill={getColumnColor(column, index)} 
            />
          ))}
          {createChartBrush(chartData)}
        </BarChart>
      );
    }

    /********
     * LINE *
     ********/
    
    if (config.chartType === 'line') {
      return (
        <LineChart
          key={`${chartKey}-${chartTypeKey}`}
          data={chartData}
          margin={getMargins()}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            key={`xaxis-${chartKey}-${chartTypeKey}`}
            dataKey={config.xAxisColumn}
            angle={isNumericXAxis ? 0 : -45} 
            textAnchor={isNumericXAxis ? 'middle' : 'end'}
            type={isNumericXAxis ? 'number' : 'category'}
            height={100} 
            interval={isNumericXAxis ? 'preserveStartEnd' : 0}
            tick={{ fontSize: 12 }}
            name={denormalizeColumnName(config.xAxisColumn)}
          />
          <YAxis 
            key={`yaxis-${chartKey}-${chartTypeKey}`}        
            label={{ 
              value: getYAxisLabel(), 
              angle: -90, 
              position: 'left',
              offset: 20,
              style: { textAnchor: 'middle' }
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          {config.selectedColumns.map((column, index) => (
            <Line 
              key={column} 
              type="monotone" 
              dataKey={column} 
              name={denormalizeColumnName(column)} 
              stroke={getColumnColor(column, index)} 
              activeDot={{ r: 8 }}
            />
          ))}
          {createChartBrush(chartData)}
        </LineChart>
      );
    }

    /********
     * AREA *
     ********/
    
    if (config.chartType === 'area') {
      return (
        <AreaChart
          key={`${chartKey}-${chartTypeKey}`}
          data={chartData}
          margin={getMargins()}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            key={`xaxis-${chartKey}-${chartTypeKey}`}
            dataKey={config.xAxisColumn}
            angle={isNumericXAxis ? 0 : -45} 
            textAnchor={isNumericXAxis ? 'middle' : 'end'}
            type={isNumericXAxis ? 'number' : 'category'}
            height={100} 
            interval={isNumericXAxis ? 'preserveStartEnd' : 0}
            tick={{ fontSize: 12 }}
            name={denormalizeColumnName(config.xAxisColumn)}
          />
          <YAxis 
            key={`yaxis-${chartKey}-${chartTypeKey}`}
            label={{ 
              value: getYAxisLabel(), 
              angle: -90, 
              position: 'left',
              offset: 20,
              style: { textAnchor: 'middle' }
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          {config.selectedColumns.map((column, index) => (
            <Area 
              key={column} 
              type="monotone" 
              dataKey={column} 
              name={denormalizeColumnName(column)} 
              fill={getColumnColor(column, index)} 
              stroke={getColumnColor(column, index)}
              fillOpacity={0.6}
            />
          ))}
          {createChartBrush(chartData)}
        </AreaChart>
      );
    }
    
    console.log("Chart type:", config.chartType);
    console.log("Secondary axis:", config.secondaryAxis);
    
    /***********
     * SCATTER *
     ***********/

    if (config.chartType === 'scatter') {
      // Find the best 2 numeric columns  
      const numericColumns = config.selectedColumns.filter(col => {
        const hasNumericData = chartData.some(row => {
          const val = (row as any)[col];
          return typeof val === 'number' && !isNaN(val);
        });
        return hasNumericData;
      });

      console.log("🎯 SCATTER DEBUG:");
      console.log("config.selectedColumns:", config.selectedColumns);
      console.log("numericColumns found:", numericColumns);
      console.log("sample chartData[0]:", chartData[0]);
      
      // Check each selected column
      config.selectedColumns.forEach(col => {
        const sampleVal = chartData[0] ? (chartData[0] as any)[col] : 'no data';
        console.log(`Column '${col}': sample value = ${sampleVal} (type: ${typeof sampleVal})`);
      });
      
      if (numericColumns.length < 2) {
        return (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
            <div style={{ textAlign: 'center' }}>
              <h3>📊 Scatter Plot Needs 2 Numeric Columns</h3>
              <p>Found: {numericColumns.length} numeric columns</p>
              <p>Please select 2+ numeric columns like Revenue, Units Sold, etc.</p>
            </div>
          </div>
        );
      } 
      
      // Use first 2 numeric columns
      const xAxisColumn = numericColumns[0];
      const yAxisColumn = config.secondaryAxis && numericColumns.includes(config.secondaryAxis) 
        ? config.secondaryAxis 
        : numericColumns[1];

      const isUsingAssumedColumns = !config.secondaryAxis || 
        config.selectedColumns.length > 2;
      
      if (isUsingAssumedColumns) {
        // Show guidance message above the chart
        <GuidanceMessage type="scatter" details="Setup required. X and Y axes should be assigned numeric columns." />
      }

      // Prepare scatter data exactly like your other charts prepare data
      const scatterData = chartData.map((row, index) => {
        const originalRow = row as any;
        const xVal = originalRow[xAxisColumn];
        const yVal = originalRow[yAxisColumn];
        
        // Only include valid numeric points
        if (typeof xVal === 'number' && typeof yVal === 'number' && !isNaN(xVal) && !isNaN(yVal)) {
          return {
            ...originalRow,
            // Keep original column names for consistency
            [xAxisColumn]: xVal,
            [yAxisColumn]: yVal
          };
        }
        return null;
      }).filter(row => row !== null);

      if (scatterData.length === 0) {
        return (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
            <div style={{ textAlign: 'center' }}>
              <h3>❌ No Valid Data Points</h3>
              <p>No numeric data found for correlation analysis.</p>
            </div>
          </div>
        );
      }

      // Use your existing color system
      const yAxisColumnIndex = config.selectedColumns.indexOf(yAxisColumn);
      const dotColor = getColumnColor(yAxisColumn, yAxisColumnIndex);

      // Simple tooltip using your existing CustomTooltip pattern
      const ScatterTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
          const data = payload[0].payload;
          
          return (
            <div style={{ 
              backgroundColor: '#fff', 
              padding: '10px', 
              border: '1px solid #ccc',
              borderRadius: '4px',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
            }}>
              <p style={{ margin: 0, fontWeight: 'bold' }}>
                📊 Data Point
              </p>
              <p style={{ margin: 0 }}>
                <strong>{denormalizeColumnName(xAxisColumn)}:</strong> {
                  typeof data[xAxisColumn] === 'number' 
                    ? data[xAxisColumn].toLocaleString() 
                    : data[xAxisColumn]
                }
              </p>
              <p style={{ margin: 0 }}>
                <strong>{denormalizeColumnName(yAxisColumn)}:</strong> {
                  typeof data[yAxisColumn] === 'number' 
                    ? data[yAxisColumn].toLocaleString() 
                    : data[yAxisColumn]
                }
              </p>
            </div>
          );
        }
        return null;
      };

      console.log('🎯 Scatter rendering with data:', scatterData.length, 'points');
      console.log('🎯 X-axis:', xAxisColumn, 'Y-axis:', yAxisColumn);
      console.log('🎯 Dot color:', dotColor);

      // Use the EXACT same pattern as your BarChart
      return (
        <ScatterChart
          key={`${chartKey}-${chartTypeKey}`}
          data={scatterData}
          margin={getMargins()}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            key={`xaxis-${chartKey}-${chartTypeKey}`}
            type="number" 
            dataKey={xAxisColumn}
            name={denormalizeColumnName(xAxisColumn)} 
            label={{ 
              value: denormalizeColumnName(xAxisColumn), 
              position: 'insideBottom', 
              offset: -10,
              style: { textAnchor: 'middle' }
            }}
            tick={{ fontSize: 12 }}
          />
          <YAxis 
            key={`yaxis-${chartKey}-${chartTypeKey}`}
            type="number" 
            dataKey={yAxisColumn} 
            name={denormalizeColumnName(yAxisColumn)} 
            label={{ 
              value: denormalizeColumnName(yAxisColumn), 
              angle: -90, 
              position: 'left',
              offset: 20,
              style: { textAnchor: 'middle' }
            }}
            tick={{ fontSize: 12 }}
          />
          <Tooltip content={<ScatterTooltip />} />
          <Scatter 
            key={`${chartKey}-${chartTypeKey}-scatter-points`}
            name={`${denormalizeColumnName(xAxisColumn)} vs ${denormalizeColumnName(yAxisColumn)}`} 
            data={scatterData}
            fill={dotColor}
          />
        </ScatterChart>
      );
    }
      
    /************
     * COMPOSED *
     ************/

    if (config.chartType === 'composed' && config.secondaryAxis) {
      // Helper function to find actual data key
      const findDataKey = (normalizedKey: string, sampleData: any): string => {
        // First try exact match
        if (sampleData[normalizedKey] !== undefined) {
          return normalizedKey;
        }
        
        // Try case-insensitive search
        const dataKeys = Object.keys(sampleData);
        const matchingKey = dataKeys.find(key => 
          key.toLowerCase() === normalizedKey.toLowerCase()
        );
        
        if (matchingKey) {
          console.log(`🔧 Found data key '${matchingKey}' for normalized key '${normalizedKey}'`);
          return matchingKey;
        }
        
        // Try looking in calculated columns
        const calculatedKeys = Object.keys(calculatedColumns);
        const matchingCalcKey = calculatedKeys.find(calcKey => 
          normalizeColumnName(calcKey) === normalizedKey
        );
        
        if (matchingCalcKey) {
          console.log(`🔧 Found calculated key '${matchingCalcKey}' for normalized key '${normalizedKey}'`);
          return matchingCalcKey;
        }
        
        console.warn(`⚠️ Could not find data key for '${normalizedKey}'`);
        return normalizedKey; // fallback
      };

      const actualSecondaryKey = findDataKey(config.secondaryAxis, chartData[0]);
      
      console.log(`🔧 Composed Chart Debug:`, {
        secondaryAxis: config.secondaryAxis,
        actualSecondaryKey: actualSecondaryKey,
        sampleValue: (chartData[0] as any)?.[actualSecondaryKey],
        availableKeys: Object.keys(chartData[0] || {})
      });

      return (
        <ComposedChart
          key={`${chartKey}-${chartTypeKey}`}
          data={chartData}
          margin={getMargins()} 
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            key={`xaxis-${chartKey}-${chartTypeKey}`}
            dataKey={config.xAxisColumn}
            angle={isNumericXAxis ? 0 : -45} 
            textAnchor={isNumericXAxis ? 'middle' : 'end'}
            type={isNumericXAxis ? 'number' : 'category'}
            height={100} 
            interval={isNumericXAxis ? 'preserveStartEnd' : 0}
            tick={{ fontSize: 12 }}
            name={denormalizeColumnName(config.xAxisColumn)}
          />
          <YAxis 
            key={`yaxis-left-${chartKey}-${chartTypeKey}`}
            yAxisId="left" 
            label={{ 
              value: config.secondaryAxis ? denormalizeColumnName(config.secondaryAxis) : 'Bars',
              angle: -90, 
              position: 'left',
              offset: 20,
              style: { textAnchor: 'middle' }
            }}
          />
          <YAxis 
            key={`yaxis-right-${chartKey}-${chartTypeKey}`}
            yAxisId="right" 
            orientation="right"
            label={{ 
              value: config.selectedColumns
                .filter(col => col !== config.secondaryAxis)
                .map(col => denormalizeColumnName(col))
                .slice(0, 4)  // Show first 2 line column names
                .join(' + ') || 'Lines',
              angle: 90, 
              position: 'right',
              offset: 20,
              style: { textAnchor: 'middle' }
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          {config.selectedColumns.map((column, index) => {
            const actualDataKey = findDataKey(column, chartData[0]);
            
            // Primary column as bars
            if (column === config.secondaryAxis) {
              // Secondary axis column becomes BAR (left axis)
              return (
                <Bar 
                  key={column} 
                  dataKey={actualDataKey} 
                  name={denormalizeColumnName(column)} 
                  fill={getColumnColor(column, index)} 
                  yAxisId="left"
                />
              );
            } else {
              // ALL OTHER columns become LINES (right axis)  
              return (
                <Line 
                  key={column}
                  type="monotone"
                  dataKey={actualDataKey}
                  name={denormalizeColumnName(column)} 
                  stroke={getColumnColor(column, index)} 
                  yAxisId="right"
                />
              );
            }
          })}
          {createChartBrush(chartData)}
        </ComposedChart>
      );
    }

    /************
     * FALLBACK *
     ************/
    
    return (
      <BarChart
        key={`${chartKey}-${chartTypeKey}`}
        data={chartData}
        margin={getMargins()}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis 
          key={`xaxis-${chartKey}-${chartTypeKey}`}
          dataKey={config.xAxisColumn}
          angle={-45} 
          textAnchor="end" 
          height={100} 
          interval={0}
          tick={{ fontSize: 12 }}
          label={{ 
            value: denormalizeColumnName(config.xAxisColumn), 
            position: 'insideBottom', 
            offset: -10,
            style: { textAnchor: 'middle' }
          }}          
        />
        <YAxis 
          key={`yaxis-${chartKey}-${chartTypeKey}`}
          label={{ 
            value: config.groupByColumn ? getYAxisLabelForGrouped() : getYAxisLabel(), 
            angle: -90, 
            position: 'left',
            offset: 20,
            style: { textAnchor: 'middle' }
          }}          
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        {config.selectedColumns.map((column, index) => (
          <Bar 
            key={column} 
            dataKey={column} 
            name={denormalizeColumnName(column)} 
            stackId="a" 
            fill={getColumnColor(column, index)} 
          />
        ))}
        {createChartBrush(chartData)}
      </BarChart>
    );
  };

  // Get chart data - ALWAYS call this to ensure data preparation
  console.log("🎯 About to call prepareChartData()");
  const mainChartData = prepareChartData();
  console.log("🎯 prepareChartData() returned:", mainChartData.length, "rows");
  
  console.log("🚀 COMPONENT RENDER - Every time component renders, this shows");
  console.log("🚀 Current state: loading=" + loading + ", data.length=" + data.length + ", availableColumns.length=" + availableColumns.length);
  
  // Add a key diagnostic
  useEffect(() => {
    console.log("🔄 useEffect triggered - loading changed to:", loading);
  }, [loading]);
  
  useEffect(() => {
    if (rawData.length > 0 && Object.keys(calculatedColumns).length > 0) {
      processData(rawData);
    }
  }, [calculatedColumns]); // Reprocess when calculated columns change

  useEffect(() => {
    console.log("🔄 useEffect triggered - data changed, length:", data.length);
  }, [data]);
  
  // Render loading state
  if (loading) {
    console.log("🔄 LOADING STATE - showing spinner");
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
        <div>
          <div style={{ textAlign: 'center', marginBottom: '10px' }}>Loading data...</div>
          <div style={{ 
            width: '50px', 
            height: '50px', 
            border: '5px solid #f3f3f3', 
            borderTop: '5px solid #3498db', 
            borderRadius: '50%',
            margin: '0 auto',
            animation: 'spin 2s linear infinite'
          }} />
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
  }
  
  // Render error state
  if (error && data.length === 0) {
    console.log("❌ ERROR STATE - showing error:", error);
    return (
      <div style={{ 
        padding: '20px', 
        border: '1px solid #f5c6cb', 
        backgroundColor: '#f8d7da', 
        color: '#721c24',
        borderRadius: '4px',
        maxWidth: '800px',
        margin: '0 auto'
      }}>
        <h3 style={{ margin: '0 0 10px 0' }}>Error Loading Data</h3>
        <p>{error}</p>
      </div>
    );
  }
  
  // Get chart data
  const chartData = prepareChartData();
  
  console.log("🎯 MAIN RENDER START");
  console.log("📊 loading:", loading);
  console.log("❌ error:", error);
  console.log("📋 data.length:", data.length);
  console.log("📑 availableColumns:", availableColumns);
  console.log("✅ config.selectedColumns:", config.selectedColumns);
  console.log("📈 chartData.length:", chartData.length);
  console.log("🎯 MAIN RENDER - about to render component");
  
  return (
    <div 
      key={`chart-${availableColumns.join('-')}-${config.selectedColumns.join('-')}`} 
      style={{ fontFamily: 'Arial, sans-serif', maxWidth: '1200px', margin: '0 auto' }}
    >
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '12px', 
        marginBottom: '20px',
        padding: '10px 0'
      }}>
        <img 
          src="/inventica_icon.svg" 
          alt="Inventica Logo" 
          style={{ 
            height: '60px', 
            width: 'auto',
            objectFit: 'contain'
          }} 
        />
        <h2 style={{ margin: 0, fontSize: '24px' }}>{title}</h2>
      </div>

      {/* File Upload Area */}
      {enableFileUpload && (
        <div 
          style={{ 
            margin: '20px 0',
            padding: '20px',
            border: `2px dashed ${dragActive ? '#2196F3' : '#ccc'}`,
            borderRadius: '5px',
            backgroundColor: dragActive ? '#e3f2fd' : '#f9f9f9',
            textAlign: 'center',
            transition: 'all 0.3s ease',
            cursor: 'pointer'
          }}
          onClick={() => fileInputRef.current?.click()}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileInput}
            style={{ display: 'none' }}
          />
          
          {uploadedFileName ? (
            <div>
              <div style={{ marginBottom: '10px', fontWeight: 'bold' }}>
                Currently visualizing: {uploadedFileName}
              </div>
              <div>
                Drag & drop a new CSV file here, or click to browse
              </div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: '24px', marginBottom: '10px' }}>📊</div>
              <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
                Drag & drop a CSV file, or click to browse
              </div>
              <div style={{ color: '#666', fontSize: '0.9em' }}>
                Current data source: {csvPath || 'Loaded from props'}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Chart Controls Panel */}
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '15px', 
        margin: '20px 0', 
        padding: '15px', 
        border: '1px solid #ddd', 
        borderRadius: '5px',
        backgroundColor: '#f9f9f9'
      }}>
        <h3 style={{ margin: '0 0 10px 0' }}>Chart Controls</h3>
        
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>

          {/* CHART TYPE SELECTION */}
          <div>
            <label htmlFor="chartType" style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Chart Type:</label>
            <select 
              id="chartType" 
              value={config.chartType} 
              onChange={e => updateConfig({ chartType: e.target.value })}
              style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid #ccc', minWidth: '150px' }}
            >
              {availableChartTypes.map(type => (
                <option key={type} value={type}>{chartTypeLabels[type] || type}</option>
              ))}
            </select>
          </div>

          {/****************** 
            ORIENTATION TOGGLE 
            ******************/}

          {(config.chartType === 'stackedBar' || config.chartType === 'stackedBar100' || config.chartType === 'groupedBar') && (

            <div>
              <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Orientation:</label>
              <button
                onClick={() => updateConfig({ isHorizontal: !config.isHorizontal })}
                style={{
                  padding: '6px 12px',
                  borderRadius: '4px',
                  border: '1px solid #ccc',
                  backgroundColor: config.isHorizontal ? '#e3f2fd' : '#f5f5f5',
                  color: config.isHorizontal ? '#1976d2' : '#333',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  transition: 'all 0.2s ease'
                }}
              >
                {config.isHorizontal ? '↔ Horizontal' : '↕ Vertical'}
              </button>
            </div>
          )}
          
          {/* X-Axis Selection */}
          <div>
            <label htmlFor="xAxisColumn" style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>X-Axis:</label>
            <select 
              id="xAxisColumn" 
              value={config.xAxisColumn} 
              onChange={e => updateConfig({ xAxisColumn: e.target.value })}
              style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid #ccc', minWidth: '150px' }}
            >
              {availableColumns.map(column => {
                const normalizedCol = normalizeColumnName(column);
                return (
                  <option key={`x-${normalizedCol}`} value={normalizedCol}>{column}</option>
                );
              })}
            </select>
          </div>
          
          {/* Secondary Axis for Scatter/Composed */}
          {(config.chartType === 'scatter' || config.chartType === 'composed') && (
            <div>
              <label htmlFor="secondaryAxis" style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>
                {config.chartType === 'composed' ? 'Left Y-Axis Column (Bars):' : 'Y-Axis Column:'}
              </label>
              <select 
                id="secondaryAxis" 
                value={config.secondaryAxis || ''} 
                onChange={e => updateConfig({ secondaryAxis: e.target.value || null })}
                style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid #ccc', minWidth: '150px' }}
              >
                <option value="">
                  {config.chartType === 'composed' ? 'Select column for bars...' : 'Select column...'}
                </option>
                {config.selectedColumns.map(column => (
                  <option key={column} value={column}>{denormalizeColumnName(column)}</option>
                ))}
              </select>
              
              {/* Helper text */}
              <div style={{ fontSize: '0.8em', color: '#666', marginTop: '5px' }}>
                {config.chartType === 'composed' 
                  ? 'Selected column becomes bars (left axis). Other columns become lines (right axis).'
                  : 'Select the column to plot on the Y-axis.'
                }
              </div>
            </div>
          )}

          {/* Display Count */}
          <div>
            <label htmlFor="displayCount" style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Show Top:</label>
            <select 
              id="displayCount" 
              value={config.displayCount} 
              onChange={e => updateConfig({ displayCount: parseInt(e.target.value) })}
              style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid #ccc', minWidth: '100px' }}
            >
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="200">200</option>
              <option value="500">500</option            >
              <option value="1000">1000</option>
            </select>
          </div>
        </div>
        
        {/* Column Selection */}
        <div>
          <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>Select Columns to Display:</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {availableColumns.map(column => {
              const normalizedCol = normalizeColumnName(column);
              return (
                <label 
                  key={normalizedCol} 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center',
                    padding: '4px 8px',
                    backgroundColor: config.selectedColumns.includes(normalizedCol) ? '#e6f3ff' : 'transparent',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={config.selectedColumns.includes(normalizedCol)}
                    onChange={() => {
                      if (config.selectedColumns.includes(normalizedCol)) {
                        updateConfig({ 
                          selectedColumns: config.selectedColumns.filter(c => c !== normalizedCol) 
                        });
                      } else {
                        updateConfig({ 
                          selectedColumns: [...config.selectedColumns, normalizedCol] 
                        });
                      }
                    }}
                    style={{ marginRight: '5px' }}
                  />
                  <span>{column}</span>
                </label>
              );
            })}
          </div>
        </div>
        
        <QuickFormulas />

        {/* Sort & Group Options */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
          {/* Group By */}
          <div>
            <label htmlFor="groupBy" style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Group By:</label>
            <select 
              id="groupBy" 
              value={config.groupByColumn || ''} 
              onChange={e => updateConfig({ groupByColumn: e.target.value || null })}
              style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid #ccc', minWidth: '150px' }}
            >
              <option value="">No Grouping</option>
              {availableColumns.map(column => {
                const normalizedCol = normalizeColumnName(column);
                return (
                  <option key={normalizedCol} value={normalizedCol}>{column}</option>
                );
              })}
            </select>
          </div>
          
          {/* Sort By */}
          <div>
            <label htmlFor="sortBy" style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Sort By:</label>
            <select 
              id="sortBy" 
              value={config.sortBy} 
              onChange={e => updateConfig({ sortBy: e.target.value })}
              style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid #ccc', minWidth: '150px' }}
            >
              {config.groupByColumn && (
                <option value="count">Count (High to Low)</option>
              )}
              {config.selectedColumns.map(column => (
                <option key={column} value={column}>{denormalizeColumnName(column)} (High to Low)</option>
              ))}
              <option value={config.xAxisColumn}>{denormalizeColumnName(config.xAxisColumn)} (Low to High)</option>
            </select>
          </div>
        </div>
        
        {/* Enhanced Filters */}
        {renderFilters()}
        
        {/* Save/Load Configuration */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
          <input 
            type="text" 
            value={configName} 
            onChange={e => setConfigName(e.target.value)}
            placeholder="Configuration name"
            style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid #ccc', flex: 1 }}
          />
          <button 
            onClick={saveCurrentConfig} 
            disabled={!configName.trim()}
            style={{ 
              padding: '6px 12px', 
              backgroundColor: !configName.trim() ? '#ccc' : '#4CAF50', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px',
              cursor: configName.trim() ? 'pointer' : 'not-allowed'
            }}
          >
            Save Config
          </button>
          <select 
            onChange={e => loadConfig(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid #ccc' }}
          >
            <option value="">Load configuration...</option>
            {Object.keys(savedConfigs).map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <button 
            onClick={() => exportToCSV(mainChartData)}
            style={{ 
              padding: '6px 12px', 
              backgroundColor: '#2196F3', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Export Data
          </button>
          <button 
            onClick={exportToSVG}
            style={{ 
              padding: '6px 12px', 
              backgroundColor: '#FF9800', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            🎨 Export SVG
          </button>
        </div>
      </div>
      
      {/* Chart Display with Filter Summary */}
      <div 
        ref={chartRef}
        style={{ display: 'flex', gap: '15px', marginTop: '20px' }}>
        
        {/* Main Chart */}
        <div 
          style={{ 
            flex: 1,
            height: typeof height === 'number' ? `${height}px` : height,
            border: '1px solid #ddd', 
            borderRadius: '5px',
            padding: '10px',
            display: 'flex',
            flexDirection: 'column'
          }}
        >

          {/***************** 
            LEGEND AT THE TOP
          *******************/}
          <CustomLegend />
          
          {/* Chart takes remaining space */}
          {/*<div style={{ flex: 1 }}>
            <ResponsiveContainer>
              {renderChart()}
            </ResponsiveContainer>
          </div>*/}

          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ flex: 1 }}>
              <ResponsiveContainer>
                {renderChart()}
              </ResponsiveContainer>
            </div>

            {/***********
              AXIS LABELS
              ***********/}

            <div style={{ textAlign: 'center', padding: '8px', fontSize: '16px', color: '#666' }}>
              {config.chartType === 'scatter' ? (
                (() => {
                  const numericColumns = config.selectedColumns.filter(col => {
                    const hasNumericData = data.some(row => {
                      const val = row[col];
                      return typeof val === 'number' && !isNaN(val);
                    });
                    return hasNumericData;
                  });
                  
                  if (numericColumns.length >= 2) {
                    const xCol = numericColumns[0];
                    return `X-Axis: ${denormalizeColumnName(xCol)}`;
                  }
                  return 'X-Axis: Scatter Plot';
                })()
              ) : (
                // Dynamic label based on actual axis roles
                (() => {
                  const isHorizontalChart = config.isHorizontal && 
                    (config.chartType === 'stackedBar' || 
                     config.chartType === 'stackedBar100' || 
                     config.chartType === 'groupedBar');
                  
                  if (isHorizontalChart) {
                    // In horizontal charts:
                    // - X-axis (horizontal) = Values
                    // - Y-axis (vertical) = Categories (original xAxisColumn)
                    return `Y-Axis: ${denormalizeColumnName(config.xAxisColumn)} • X-Axis: Values`;
                  } else {
                    // In vertical charts:
                    // - X-axis = Categories
                    // - Y-axis = Values  
                    return `X-Axis: ${denormalizeColumnName(config.xAxisColumn)}`;
                  }
                })()
              )}
            </div>                       

          </div>

        </div>
        
        {/* Filter Summary Sidebar */}
        {(getFilterSummary().length > 0 || attribution) && (
          <div style={{
            width: '200px',
            padding: '10px',
            border: '1px solid #ddd',
            borderRadius: '5px',
            backgroundColor: '#f9f9f9',
            fontSize: '11px',
            alignSelf: 'flex-start'
          }}>
            {getFilterSummary().length > 0 && (
              <>
                <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '12px' }}>
                  Active Filters
                </div>
                {getFilterSummary().map((summary, index) => (
                  <div key={index} style={{ 
                    marginBottom: '4px', 
                    padding: '2px 4px',
                    backgroundColor: '#e6f3ff',
                    borderRadius: '2px',
                    wordBreak: 'break-word'
                  }}>
                    {summary}
                  </div>
                ))}
                <div style={{ 
                  marginTop: '8px', 
                  paddingTop: '6px', 
                  borderTop: '1px solid #ddd',
                  color: '#666'
                }}>
                  Showing {mainChartData.length} of {data.length} records
                </div>
              </>
            )}
            
            {/* Attribution in sidebar */}
            {attribution && (
              <div style={{
                marginTop: getFilterSummary().length > 0 ? '12px' : '0',
                paddingTop: getFilterSummary().length > 0 ? '8px' : '0',
                borderTop: getFilterSummary().length > 0 ? '1px solid #ddd' : 'none',
                fontSize: '10px',
                color: '#888',
                fontStyle: 'italic',
                textAlign: 'center'
              }}>
                {attributionUrl ? (
                  <a 
                    href={attributionUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{ 
                      color: '#888', 
                      textDecoration: 'none'
                    }}
                    onMouseEnter={(e) => (e.target as HTMLElement).style.textDecoration = 'underline'}
                    onMouseLeave={(e) => (e.target as HTMLElement).style.textDecoration = 'none'}
                  >
                    {attribution}
                  </a>
                ) : (
                  attribution
                )}
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Data Summary */}
      <div style={{ 
        marginTop: '20px', 
        padding: '15px',
        border: '1px solid #ddd',
        borderRadius: '5px'
      }}>
        <h3 style={{ margin: '0 0 10px 0' }}>Data Summary</h3>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div>Total records: <strong>{data.length}</strong></div>
          <div>Records displayed: <strong>{mainChartData.length}</strong></div>
          <div>
            {config.groupByColumn ? 
              `Grouped by: ${denormalizeColumnName(config.groupByColumn)}` : 
              'No grouping applied'}
          </div>
        </div>
        
        <div style={{ marginTop: '15px' }}>
          <h4 style={{ margin: '0 0 10px 0' }}>Column Statistics</h4>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', 
            gap: '15px',
            maxHeight: '200px',
            overflowY: 'auto',
            padding: '5px'
          }}>
            {Object.entries(dataStats).map(([column, stats]) => (
              <div 
                key={`stats-${column}`} 
                style={{ 
                  padding: '10px', 
                  border: '1px solid #eee', 
                  borderRadius: '4px',
                  backgroundColor: config.selectedColumns.includes(normalizeColumnName(column)) ? 
                    '#f0f8ff' : '#f9f9f9'
                }}
              >
                <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>{column}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
                  <div>Min: <strong>{stats.min.toFixed(2)}</strong></div>
                  <div>Max: <strong>{stats.max.toFixed(2)}</strong></div>
                  <div>Avg: <strong>{stats.avg.toFixed(2)}</strong></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Documentation */}
      <div style={{ marginTop: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '5px' }}>
        <h3 style={{ margin: '0 0 10px 0' }}>Dashboard Features</h3>
        <ul style={{ paddingLeft: '20px' }}>
          <li><strong>Multiple chart types</strong>: Switch between stacked bar, grouped bar, line, area, scatter, and composed charts</li>
          <li><strong>Customizable axes</strong>: Select any column for X-axis and Y-axis (for scatter plots)</li>
          <li><strong>Dynamic column selection</strong>: Choose which data columns to include in the visualization</li>
          <li><strong>Advanced filtering</strong>: Filter numeric data with sliders and categorical data with checkboxes</li>
          <li><strong>Grouping functionality</strong>: Group data by any column for aggregated analysis</li>
          <li><strong>Flexible sorting</strong>: Sort data by any column or by grouped counts</li>
          <li><strong>Interactive brushing</strong>: Zoom and focus on specific sections of the chart</li>
          <li><strong>Save/load configurations</strong>: Save your favorite visualization setups and reload them later</li>
          <li><strong>Data export</strong>: Export filtered data to CSV for further analysis</li>
          <li><strong>Statistics summary</strong>: View key statistics for each column in your dataset</li>
          <li><strong>File upload support</strong>: Drag and drop CSV files for instant visualization</li>
        </ul>
        <h3 style={{ margin: '0 0 10px 0' }}>Usage Notes</h3>
        <ul style={{ paddingLeft: '20px' }}>
          <li><strong>Scatter Plots</strong>: Can be tricky to use. Remember they always compare two metrics to show the correlation between them</li>
          <li><strong>Composed Charts</strong>: Only the column you select is assigned to left y-axis. If you don't select one, the chart defaults to stacked bar. The remaining selected columns get assinged the right y-axis</li>
          <li><strong>Recommended Workflow</strong>: Though I added functions to the tool to try them out, the ideal workflow is <i>data prep in Excel, visualization in DataViz</i></li>
        </ul>
      </div>
    </div>
  );
};