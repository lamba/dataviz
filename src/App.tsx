import React from 'react';
import { GenericDataChart } from './components/GenericDataChart';
import packageJson from "../package.json";

const App: React.FC = () => {
  return (
    <div style={{ padding: '20px', backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
      <header style={{ marginBottom: '20px' }}>
        <h1 style={{ color: '#333', margin: '0 0 10px 0' }}>Interactive Data Visualization Tool (Inventica.com)</h1>
        <p style={{ color: '#666' }}>
          Explore any CSV dataset with powerful interactive controls
        </p>
      </header>
      
      <GenericDataChart 
        csvPath="./data/sample.csv"
        // Remove defaultXAxis to let it auto-select, or use an actual column name
        // defaultYColumns={["Currently Have", "Use Daily"]} // Use actual column names
        defaultChartType="stackedBar"
        title="DataViz"
        height={600}
        enableFileUpload={true} 
        onFileChange={(file) => console.log('File loaded:', file.name)}        
        attribution="By PS Lamba via Inventica.com"
        attributionUrl="http://inventica.com" // Optional - makes it clickable
      />
      
      <footer style={{ marginTop: '40px', padding: '20px 0', borderTop: '1px solid #ddd', color: '#888', textAlign: 'center' }}>
        <p>Data visualization powered by Recharts. CSV parsing by PapaParse. ©Puneet Singh Lamba, <a href="http://inventica.com" target="blank">Inventica Consulting</a>. Version: {packageJson.version}</p>
      </footer>
    </div>
  );
};

export default App;