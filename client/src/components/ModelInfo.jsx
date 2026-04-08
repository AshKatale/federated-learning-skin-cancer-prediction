/**
 * Model Information Component
 * Displays information about the model and its capabilities
 * Healthcare-focused presentation
 */

import React from 'react'

export default function ModelInfo({ modelInfo }) {
  if (!modelInfo) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Loading model information...</p>
      </div>
    )
  }

  return (
    <div className="model-info">
      {/* Model Architecture */}
      <div className="info-section">
        <h2>🤖 Model Architecture</h2>
        <div className="info-grid">
          <div className="info-item">
            <label>Model Name</label>
            <value>{modelInfo.model_name}</value>
          </div>
          <div className="info-item">
            <label>Pretrained</label>
            <value>{modelInfo.pretrained ? 'Yes' : 'No'}</value>
          </div>
          <div className="info-item">
            <label>Processing Device</label>
            <value>{modelInfo.device}</value>
          </div>
          <div className="info-item">
            <label>Input Dimensions</label>
            <value>{modelInfo.input_size[0]} × {modelInfo.input_size[1]} px</value>
          </div>
          <div className="info-item">
            <label>Classification Classes</label>
            <value>{modelInfo.classes}</value>
          </div>
        </div>
      </div>

      {/* Classification Classes */}
      <div className="info-section">
        <h2>🏷️ Skin Cancer &amp; Lesion Classification Categories</h2>
        <div className="classes-grid">
          {modelInfo.class_labels?.map((className, index) => (
            <div key={index} className="class-item">
              <span className="class-index">{index}</span>
              <span className="class-name">{className}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Class Mapping */}
      <div className="info-section">
        <h2>📊 Class Label Mapping</h2>
        <div className="class-mapping">
          {Object.entries(modelInfo.label_mapping || {}).map(([key, value]) => (
            <div key={key} className="mapping-item">
              <code className="mapping-key">{key}</code>
              <span className="mapping-arrow">→</span>
              <code className="mapping-value">{value}</code>
            </div>
          ))}
        </div>
      </div>

      {/* About This Tool */}
      <div className="info-section">
        <h2>ℹ️ About This Skin Cancer Detection Tool</h2>
        <div className="about-text">
          <p>
            This is a deep learning-based skin cancer and lesion detection tool built using 
            <strong> EfficientNet-B0</strong>, a state-of-the-art convolutional neural network architecture.
            The model has been trained on the <strong> HAM10000</strong> dataset, which contains 
            10,015 high-quality dermatoscopic images of various skin conditions and cancers.
          </p>
          
          <p>
            <strong>The model classifies skin lesions into 7 categories, including common skin cancers:</strong>
          </p>
          
          <ul>
            <li>
              <strong>Actinic Keratosis (ak)</strong> - Precancerous growths caused by sun exposure. 
              Early detection and treatment are important.
            </li>
            <li>
              <strong>Basal Cell Carcinoma (bcc)</strong> - The most common type of skin cancer. 
              Usually treatable if detected early.
            </li>
            <li>
              <strong>Benign Keratosis (bkl)</strong> - Non-cancerous growths that are common in older skin. 
              Generally harmless but may be removed for cosmetic reasons.
            </li>
            <li>
              <strong>Dermatofibroma (df)</strong> - A benign fibrous growth that is typically harmless. 
              Often doesn't require treatment.
            </li>
            <li>
              <strong>Melanoma (mel)</strong> - The most serious form of skin cancer, with high mortality if not detected early. 
              Requires immediate professional evaluation.
            </li>
            <li>
              <strong>Nevus (nv)</strong> - Common moles that are typically benign. 
              Most nevi do not require treatment.
            </li>
            <li>
              <strong>Vascular Lesion (vasc)</strong> - Lesions related to blood vessels in the skin. 
              Generally benign but may be treated for cosmetic reasons.
            </li>
          </ul>

          <p style={{ marginTop: '20px' }}>
            <strong>🏥 Medical Disclaimer:</strong> This tool is intended for educational and research purposes only. 
            It is <strong>NOT</strong> a substitute for professional medical diagnosis or treatment. 
            The classifications provided by this AI model should not be used as a final diagnosis. 
            Always consult with a qualified dermatologist who can perform a proper clinical examination, 
            take medical history, and recommend appropriate treatment options. 
            Skin cancer is a serious condition that requires professional medical evaluation and treatment.
          </p>
        </div>
      </div>
    </div>
  )
}
