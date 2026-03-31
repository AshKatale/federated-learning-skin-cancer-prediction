/**
 * FLDashboard — Federated Learning Desktop Control Page
 *
 * Only meaningful when running inside the Electron desktop app.
 * Shows training controls, prediction, and real-time logs
 * all backed by window.electronAPI (IPC).
 */

import React from 'react';
import AppShell from '../components/AppShell';
import FLControlPanel from '../components/FLControlPanel';

export default function FLDashboard() {
  return (
    <AppShell>
      <div className="page">
        {/* Header */}
        <div className="page-header">
          <div>
            <div className="page-title">Federated Learning</div>
            <div className="page-subtitle">
              Local training · Privacy-preserving inference · On-device ML
            </div>
          </div>
          <span className="badge" style={{
            background: 'rgba(34,197,94,0.15)', color: '#22c55e',
            padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700,
          }}>
            🔒 All data stays on device
          </span>
        </div>

        {/* Info banner */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(168,85,247,0.1))',
          border: '1px solid rgba(99,102,241,0.3)',
          borderRadius: 12, padding: '14px 20px', fontSize: 13,
          color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 4,
        }}>
          <strong style={{ color: 'var(--text-1)' }}>How it works:</strong>
          {' '}Your images are processed locally by PyTorch. Only model weight updates
          (never raw images) are sent to the federated server for aggregation.
          Run training on your HAM10000 dataset slice and contribute to the global model
          without sacrificing patient privacy.
        </div>

        {/* Main control panel */}
        <FLControlPanel />
      </div>
    </AppShell>
  );
}
