// src/App.tsx
import React from 'react';
import { GenericDataChart } from './components/GenericDataChart';

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
        csvPath="/data/sentiment_analysis_results-non-zeros.csv"
        defaultXAxis="name"  // Use the normalized name of your id/name column
        defaultYColumns={["challenges", "sentimentx"]}
        defaultChartType="stackedBar"
        calculateTotal={(row) => (row.Challenges || 0) + Math.abs(row['Sentiment-x'] || 0)}
        colorMap={{
          challenges: '#8884d8',
          sentimentx: '#82ca9d'
        }}
        title="Data Analysis Dashboard"
        height={600}
        enableFileUpload={true} 
        onFileChange={(file) => console.log('File loaded:', file.name)}        
      />
      
      <footer style={{ marginTop: '40px', padding: '20px 0', borderTop: '1px solid #ddd', color: '#888', textAlign: 'center' }}>
        <p>Data visualization powered by Recharts. CSV parsing by PapaParse.</p>
      </footer>
    </div>
  );
};

export default App;