import React, { useState, useRef } from 'react';
import { parseVCF } from './utils/vcfParser';

function App() {
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setResults(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const parsedResults = parseVCF(text);
        setResults(parsedResults);
      } catch (err) {
        console.error(err);
        setError("Failed to parse the VCF file. Ensure it's a valid text format.");
      } finally {
        setLoading(false);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1>Hereditary Hemochromatosis Genotype Analyzer</h1>
        <p>Upload your DNA raw data (VCF) to analyze your risk for hemochromatosis based on known genetic markers.</p>
      </header>

      <main className="main-content">
        <section className="upload-section">
          <div 
            className="upload-dropzone"
            onClick={() => fileInputRef.current.click()}
          >
            <div className="upload-icon">📁</div>
            <h2>Select your VCF file</h2>
            <p>Click here to browse your files. Your data is analyzed entirely locally on your device.</p>
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleFileUpload} 
              accept=".vcf,.txt" 
              style={{ display: 'none' }} 
            />
          </div>
          {loading && <p className="loading-text">Analyzing your genetic data...</p>}
          {error && <p className="error-text">{error}</p>}
        </section>

        {results && (
          <section className="results-section">
            <h2>Your Genotype Results</h2>
            <div className="results-grid">
              {results.map((result, index) => (
                <div key={index} className="result-card">
                  <div className="card-header">
                    <h3>{result.gene}</h3>
                    <span className="badge">{result.type}</span>
                  </div>
                  <div className="card-body">
                    <p><strong>Variant:</strong> {result.variantName} {result.rsID ? `(${result.rsID})` : ''}</p>
                    <p><strong>Reference Allele:</strong> {result.referenceAllele}</p>
                    <p><strong>Your Genotype:</strong> <span className={`genotype ${result.isPathogenic ? 'pathogenic' : 'wildtype'}`}>{result.userGenotype}</span></p>
                    <p className="description">{result.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
