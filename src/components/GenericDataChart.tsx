// Copyright, Puneet Singh Lamba 
// pslamba@gmail.com
// inventica.com

// Copyright, Puneet Singh Lamba pslamba@gmail.com

import React, { useState, useEffect, useRef, DragEvent } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, Brush, LineChart, Line, AreaChart, Area,
  ScatterChart, Scatter, ZAxis, ComposedChart
} from 'recharts';
import Papa from 'papaparse';
import packageJson from '../../package.json';

const version = packageJson.version;

// Utility functions 
const normalizeColumnName = (column: string): string => {
  return column.replace(/[\s-]/g, '').toLowerCase();
};

const generateChartKey = (): string => {
  return `chart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

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

// Component props
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
  // State variables

  const [chartKey, setChartKey] = useState<string>(generateChartKey());

  // Raw data from CSV
  const [rawData, setRawData] = useState<any[]>([]);
  
  // File upload
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    
    // Update config with determined defaults AND filter configs
    console.log("processData - setting new config:");
    console.log("- effectiveXAxis:", effectiveXAxis);
    console.log("- effectiveYColumns:", effectiveYColumns);
    console.log("- filterConfigs:", filterConfigs);
    
    setConfig(prev => ({
      ...prev,
      selectedColumns: effectiveYColumns,
      xAxisColumn: effectiveXAxis,
      sortBy: effectiveYColumns.length > 0 ? effectiveYColumns[0] : effectiveXAxis,
      filterConfigs: filterConfigs // This is critical - we need to set the filter configs
    }));
    
    setData(processedData);
    console.log("🔧 processData - setting loading to FALSE");
    setLoading(false);
    
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
      return prepareGroupedData(filteredData);
    }
    
    // Sort data
    if (config.sortBy === config.xAxisColumn) {
      // If sorting by the same column used for X-axis, sort in ascending order
      filteredData.sort((a, b) => {
        const valA = a[config.sortBy];
        const valB = b[config.sortBy];
        
        if (typeof valA === 'string' && typeof valB === 'string') {
          return valA.localeCompare(valB);
        } else {
          return (valA || 0) - (valB || 0);
        }
      });
    } else {
      filteredData.sort((a, b) => {
        const valA = a[config.sortBy] || 0;
        const valB = b[config.sortBy] || 0;
        return valB - valA; // Descending order
      });
    }
    
    // Return the limited number of rows
    const result = filteredData.slice(0, config.displayCount);
    console.log("🔥 prepareChartData - final result:", result.length, "rows");
    console.log("🔥 prepareChartData - displayCount setting:", config.displayCount);
    console.log("🔥 prepareChartData - sample result:", result[0]);
    return result;
  };
  
  // Prepare grouped data
  const prepareGroupedData = (filteredData: Record<string, any>[]) => {
    if (!config.groupByColumn) return filteredData;
    
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
      }
      
      // Add values from this row to the group
      config.selectedColumns.forEach(col => {
        groups[groupKey][col] += (row[col] || 0);
      });
      
      groups[groupKey].count += 1;
    });
    
    // Convert groups object to array
    const groupedData = Object.values(groups);
    
    console.log("prepareGroupedData - groups created:", groupedData.length);
    
    // Sort grouped data
    if (config.sortBy === 'count') {
      groupedData.sort((a, b) => b.count - a.count);
    } else if (config.selectedColumns.includes(config.sortBy)) {
      groupedData.sort((a, b) => b[config.sortBy] - a[config.sortBy]);
    } else {
      groupedData.sort((a, b) => String(a[config.xAxisColumn]).localeCompare(String(b[config.xAxisColumn])));
    }
    
    // Apply display limit to grouped data
    const limitedGroupedData = groupedData.slice(0, config.displayCount);
    console.log("prepareGroupedData - after limit:", limitedGroupedData.length, "groups (limit:", config.displayCount, ")");
    
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
  
  // Custom tooltip
  const CustomTooltip: React.FC<any> = ({ active, payload, label }) => {
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
            {config.xAxisColumn}: {typeof data[config.xAxisColumn] === 'number' 
              ? data[config.xAxisColumn].toFixed(2) 
              : data[config.xAxisColumn]}
          </p>
          {config.selectedColumns.map(column => (
            <p key={column} style={{ margin: 0 }}>
              {denormalizeColumnName(column)}: {typeof data[column] === 'number' ? data[column].toFixed(2) : data[column]}
            </p>
          ))}
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
    setConfig(prev => ({ ...prev, ...changes }));
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
    console.log("Chart rendering - X-axis values:", chartData.slice(0, 3).map(row => row[config.xAxisColumn]));
    
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
    
    const isNumericXAxis = typeof chartData[0]?.[config.xAxisColumn] === 'number';
    
    if (config.chartType === 'stackedBar100') {
      // Calculate percentage data for 100% stacked bars
      const percentageData = chartData.map(row => {
        const total = config.selectedColumns.reduce((sum, col) => sum + (row[col] || 0), 0);
        const percentageRow = { ...row };
        config.selectedColumns.forEach(col => {
          percentageRow[col] = total > 0 ? ((row[col] || 0) / total) * 100 : 0;
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
    
    // This is the default chart the app loads with
    if (config.chartType === 'stackedBar') {
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
            label={{ 
              value: config.groupByColumn ? getYAxisLabelForGrouped() : getYAxisLabel(), 
              angle: -90, 
              position: 'left',
              offset: 20,
              style: { textAnchor: 'middle' }
            }}          
          />
          <Tooltip content={<CustomTooltip />} />
          {/* Custom Legend instead of Recharts Legend */}
          {config.selectedColumns.map((column, index) => (
            <Bar 
              key={column} 
              dataKey={column} 
              name={denormalizeColumnName(column)} 
              stackId="a" 
              fill={getColumnColor(column, index)} 
            />
          ))}
          {/* Brush temporarily disabled due to label persistence issues */}
        </BarChart>
      );
    } 
    
    if (config.chartType === 'groupedBar') {
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
    
    if (config.chartType === 'scatter') {
      
      console.log("Rendering scatter chart - X:", config.xAxisColumn, "Y:", config.secondaryAxis);
      console.log("Scatter data sample:", chartData.slice(0, 2));
      
      // Auto-select secondary axis if not already set
      const effectiveSecondaryAxis = config.secondaryAxis || 
      (config.selectedColumns.length > 0 ? config.selectedColumns[0] : null);

      if (!effectiveSecondaryAxis) {
        return (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
            <div style={{ textAlign: 'center' }}>
              <h3>Scatter Plot Setup Required</h3>
              <p>Please select a Y-Axis column for the scatter plot</p>
              <p>Available numeric columns: {config.selectedColumns.map(col => denormalizeColumnName(col)).join(', ')}</p>
            </div>
          </div>
        );
      }

      return (
        <ScatterChart
          key={`${chartKey}-${chartTypeKey}`}
          width={800}
          height={400}
          data={chartData}
          margin={getMargins()}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            key={`${chartKey}-${chartTypeKey}`}
            type="number" 
            dataKey={config.xAxisColumn}
            name={denormalizeColumnName(config.xAxisColumn)} 
            domain={['dataMin', 'dataMax']}
          />
          <YAxis 
            key={`yaxis-${chartKey}-${chartTypeKey}`}
            type="number" 
            dataKey={effectiveSecondaryAxis} 
            name={denormalizeColumnName(effectiveSecondaryAxis)} 
            domain={['dataMin', 'dataMax']}
            label={{ 
              value: denormalizeColumnName(effectiveSecondaryAxis), 
              angle: -90, 
              position: 'left',
              offset: 20,
              style: { textAnchor: 'middle' }
            }}          
          />
          <ZAxis dataKey="id" range={[50, 50]} />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<CustomTooltip />} />
          {/* Legend removed - using custom legend below chart */}
          <Scatter 
            key={`${chartKey}-${chartTypeKey}-scatter-points`}
            name={`${denormalizeColumnName(config.xAxisColumn)} vs ${denormalizeColumnName(effectiveSecondaryAxis)}`} 
            data={chartData}
            fill="#8884d8"
          />
        </ScatterChart>
      );
    }
    
    if (config.chartType === 'composed' && config.secondaryAxis) {
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
              key={`yaxis-${chartKey}-${chartTypeKey}`}
              yAxisId="left" 
              label={{ 
                value: denormalizeColumnName(config.selectedColumns[0]), 
                angle: -90, 
                position: 'left', // if left is too extreme, use insideLeft with offset: 20 as a separate attribute
                offset: 20,
                style: { textAnchor: 'middle' }
              }}
          />
          <YAxis 
              key={`yaxis-${chartKey}-${chartTypeKey}`}
              yAxisId="right" orientation="right"
              label={{ 
                value: denormalizeColumnName(config.secondaryAxis), 
                angle: 90, 
                position: 'right',
                //offset: -20,
                style: { textAnchor: 'middle' }
              }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          {config.selectedColumns.map((column, index) => {
            // Primary column as bars
            if (column === config.selectedColumns[0]) {
              return (
                <Bar 
                  key={column} 
                  dataKey={column} 
                  name={denormalizeColumnName(column)} 
                  fill={getColumnColor(column, index)} 
                  yAxisId="left"
                />
              );
            } else if (column === config.secondaryAxis) {
              // Secondary axis as line
              return (
                <Line 
                  key={column}
                  type="monotone"
                  dataKey={column} 
                  name={denormalizeColumnName(column)} 
                  stroke={getColumnColor(column, index)} 
                  yAxisId="right"
                />
              );
            } else {
              return null;
            }
          })}
          {createChartBrush(chartData)}
        </ComposedChart>
      );
    }
    
    // Default fallback
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
      <h2>{title}</h2>
      
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
          {/* Chart Type Selection */}
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
              <label htmlFor="secondaryAxis" style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Y-Axis Column:</label>
              <select 
                id="secondaryAxis" 
                value={config.secondaryAxis || ''} 
                onChange={e => updateConfig({ secondaryAxis: e.target.value || null })}
                style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid #ccc', minWidth: '150px' }}
              >
                <option value="">Select column...</option>
                {config.selectedColumns.map(column => (
                  <option key={column} value={column}>{denormalizeColumnName(column)}</option>
                ))}
              </select>
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
        </div>
      </div>
      
      {/* Chart Display with Filter Summary */}
      <div style={{ display: 'flex', gap: '15px', marginTop: '20px' }}>
        {/* Main Chart */}
        <div style={{ 
          flex: 1,
          height: typeof height === 'number' ? `${height}px` : height,
          border: '1px solid #ddd', 
          borderRadius: '5px',
          padding: '10px',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Legend at Top */}
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
            <div style={{ textAlign: 'center', padding: '8px', fontSize: '16px', color: '#666' }}>
              X-Axis: {denormalizeColumnName(config.xAxisColumn)}
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
          <li><strong>Scatter Plots</strong>: Can be tricky to use. Remember they always compare two metrics to show the correlation between them</li>
        </ul>
      </div>
    </div>
  );
};