/**
 * Batch Predictor Component
 * Handles multiple image predictions at once
 * Healthcare-focused batch analysis
 */

import React, { useRef, useState } from 'react'

export default function BatchPredictor({ onResults }) {
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState([])
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef(null)

  const handleFileChange = (e) => {
    const newFiles = Array.from(e.target.files || []).filter(f =>
      f.type.startsWith('image/')
    )
    setFiles(prev => [...prev, ...newFiles])
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    const newFiles = Array.from(e.dataTransfer.files).filter(f =>
      f.type.startsWith('image/')
    )
    setFiles(prev => [...prev, ...newFiles])
  }

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handlePredictBatch = async () => {
    if (files.length === 0) {
      alert('Please select at least one image')
      return
    }

    setLoading(true)
    setResults([])

    try {
      const formData = new FormData()
      files.forEach(file => {
        formData.append('images', file)
      })

      const response = await fetch('/api/predict-batch', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error('Batch prediction failed')
      }

      const data = await response.json()
      setResults(data.predictions || [])
      onResults(data.predictions)
    } catch (error) {
      alert('Error during batch prediction: ' + error.message)
      console.error('Batch prediction error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleClear = () => {
    setFiles([])
    setResults([])
  }

  const getConfidenceColor = (confidence) => {
    if (confidence > 0.8) return '#22c55e'
    if (confidence > 0.6) return '#f59e0b'
    return '#ef4444'
  }

  return (
    <div className="batch-predictor">
      <div
        className={`batch-upload-area ${isDragging ? 'active' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="upload-prompt">
          <div className="upload-icon">🖼️</div>
          <p>Select multiple skin cancer images for batch analysis</p>
          <button
            className="select-files-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
          >
            Select Files
          </button>
          <p className="file-hint">or drag and drop images here</p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileChange}
          style={{ display: 'none' }}
          disabled={loading}
        />
      </div>

      {files.length > 0 && (
        <div className="selected-files">
          <h3>📋 Selected Images ({files.length})</h3>
          <div className="files-list">
            {files.map((file, index) => (
              <div key={index} className="file-item">
                <span className="file-name">{file.name}</span>
                <span className="file-size">({(file.size / 1024).toFixed(1)} KB)</span>
                <button
                  className="remove-btn"
                  onClick={() => removeFile(index)}
                  disabled={loading}
                  title="Remove this file"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div className="batch-actions">
            <button
              className="predict-batch-btn"
              onClick={handlePredictBatch}
              disabled={loading || files.length === 0}
            >
              {loading ? `Processing (${results.length}/${files.length})...` : `Analyze ${files.length} Image${files.length !== 1 ? 's' : ''}`}
            </button>
            <button
              className="clear-btn"
              onClick={handleClear}
              disabled={loading}
            >
              Clear All
            </button>
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div className="batch-results">
          <h3>📊 Analysis Results ({results.length} of {files.length})</h3>
          <div className="results-grid">
            {results.map((result, index) => (
              <div key={index} className="result-card">
                <div className="result-filename" title={result.filename}>
                  {result.filename}
                </div>
                {result.prediction ? (
                  <>
                    <div className="result-class">{result.prediction.class_name}</div>
                    <div 
                      className="result-confidence"
                      style={{
                        color: getConfidenceColor(result.prediction.confidence),
                        fontWeight: 600
                      }}
                    >
                      {(result.prediction.confidence * 100).toFixed(1)}% confidence
                    </div>
                  </>
                ) : (
                  <div className="result-error">❌ {result.error || 'Analysis Failed'}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
