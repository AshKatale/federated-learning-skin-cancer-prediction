import React, { useRef, useState } from 'react';
import { predictionService } from '../services/api';

const UploadSvg = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
    <path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/>
  </svg>
);

const CameraSvg = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
    <circle cx="12" cy="13" r="4"/>
  </svg>
);

export default function ImageUploader({ onSuccess }) {
  const [preview, setPreview] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);

  const processFile = (file) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result);
      reader.readAsDataURL(file);
      setSelectedFile(file);
      setError('');
    } else {
      setError('Please select a valid image file (PNG, JPG, WebP)');
    }
  };

  const handleFileChange = (e) => processFile(e.target.files?.[0]);
  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e) => { e.preventDefault(); setIsDragging(false); processFile(e.dataTransfer?.files?.[0]); };

  const handleSubmit = async () => {
    if (!selectedFile) return;
    setLoading(true);
    setError('');
    try {
      const response = await predictionService.submitPrediction(selectedFile);
      onSuccess(response.data.prediction);
      setPreview(null);
      setSelectedFile(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Prediction failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      {/* Header */}
      <div className="card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--primary-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CameraSvg />
          </div>
          <span className="card-title">Upload Image</span>
        </div>
      </div>

      {error && (
        <div className="alert alert-error mb-3">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {error}
        </div>
      )}

      {/* Drop Zone */}
      <div
        className={`upload-zone ${isDragging ? 'drag-active' : ''} ${loading ? 'opacity-50' : ''}`}
        style={{ cursor: loading ? 'not-allowed' : 'pointer' }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !loading && fileInputRef.current?.click()}
      >
        {preview ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <img src={preview} alt="Preview" style={{ maxHeight: 200, maxWidth: '100%', borderRadius: 8, objectFit: 'contain' }} />
            <span style={{ fontSize: 12.5, color: 'var(--text-3)' }}>{selectedFile?.name} · {(selectedFile?.size / 1024).toFixed(1)} KB</span>
            <button
              onClick={e => { e.stopPropagation(); setPreview(null); setSelectedFile(null); }}
              disabled={loading}
              className="btn btn-secondary btn-sm"
            >
              Change Image
            </button>
          </div>
        ) : (
          <>
            <div className="upload-zone-icon">
              <UploadSvg />
            </div>
            <h3>Drop image here</h3>
            <p>or click to browse — PNG, JPG, WebP · up to 50 MB</p>
          </>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: 'none' }}
        disabled={loading}
      />

      {preview && (
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="btn btn-primary btn-wide btn-lg"
          style={{ marginTop: 14 }}
        >
          {loading ? (
            <><span className="spinner" style={{width:16,height:16,borderWidth:2}} /> Analysing...</>
          ) : (
            <>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              Analyse Image
            </>
          )}
        </button>
      )}
    </div>
  );
}
