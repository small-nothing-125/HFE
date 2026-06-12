import React, { useState, useRef } from 'react';
import { getFileType, parseTextFile, parseExcelFile } from './utils/vcfParser';

function App() {
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setResults(null);
    setFileName(file.name);

    const fileType = getFileType(file.name);

    if (fileType === 'unknown') {
      setError(`Unsupported file type: "${file.name.split('.').pop()}". Please upload a VCF, CSV, TSV, TXT, or Excel (.xlsx/.xls) file.`);
      setLoading(false);
      return;
    }

    if (fileType === 'excel') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parsedResults = parseExcelFile(e.target.result);
          setResults(parsedResults);
        } catch (err) {
          console.error(err);
          setError(err.message || 'Failed to parse the Excel file.');
        } finally {
          setLoading(false);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target.result;
          const parsedResults = parseTextFile(text, fileType);
          setResults(parsedResults);
        } catch (err) {
          console.error(err);
          setError(err.message || 'Failed to parse the file.');
        } finally {
          setLoading(false);
        }
      };
      reader.readAsText(file);
    }
  };

  const supportedFormats = ['VCF', 'CSV', 'TSV', 'TXT', 'XLSX', 'XLS'];

  return (
    <div className="app-container">
      <header className="header">
        <h1>Hereditary Hemochromatosis Genotype Analyzer</h1>
        <p>Upload your DNA raw data to analyze your risk for hemochromatosis based on known genetic markers.</p>
      </header>

      <main className="main-content">
        <section className="upload-section">
          <div 
            className="upload-dropzone"
            onClick={() => fileInputRef.current.click()}
          >
            <div className="upload-icon">🧬</div>
            <h2>Select your genetic data file</h2>
            <p>Click here to browse your files. Your data is analyzed entirely locally on your device.</p>
            <div className="format-badges">
              {supportedFormats.map(f => (
                <span key={f} className="format-badge">{f}</span>
              ))}
            </div>
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleFileUpload} 
              accept=".vcf,.csv,.tsv,.txt,.xlsx,.xls" 
              style={{ display: 'none' }} 
            />
          </div>
          {loading && <p className="loading-text">Analyzing your genetic data...</p>}
          {error && <p className="error-text">{error}</p>}
          {fileName && results && <p className="file-name-text">Loaded: {fileName}</p>}
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
