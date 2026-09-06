import React from 'react';
import { Shield, AlertTriangle, CheckCircle, RefreshCw, Smartphone, DollarSign, Database, UserCheck } from 'lucide-react';

export default function HeaderHUD({
  hudData,
  currentRole,
  setCurrentRole,
  actorId,
  setActorId,
  onRefresh,
  onOpenCreatePo,
  onOpenCreateInvoice,
  activeTab,
  setActiveTab
}) {
  return (
    <header className="hud-header">
      {/* 16-Bit Pixel Art Sunset Skyline Banner */}
      <div 
        className="hud-skyline-banner" 
        style={{ backgroundImage: "url('/sunset_banner.jpg')" }}
      >
        <div className="hud-skyline-overlay">
          <div className="hud-title-box">
            <h1 className="font-pixel">PROJECT AIR // 3-WAY RECONCILIATION ENGINE</h1>
            <p className="hud-subtitle">
              AUTONOMOUS DOCUMENT RECONCILIATION &bull; ZERO MANUAL DATA ENTRY &bull; OVERPAYMENT PREVENTION
            </p>
          </div>
          
          <div className="hud-controls" style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {/* Quick Action: Issue PO */}
            <button 
              className="btn-pixel btn-orange btn-sm" 
              onClick={onOpenCreatePo}
              title="Issue a new Purchase Order and connect to a project site"
            >
              + ISSUE PO
            </button>

            {/* Quick Action: Log Invoice */}
            <button 
              className="btn-pixel btn-yellow btn-sm" 
              onClick={onOpenCreateInvoice}
              title="Log a supplier invoice and trigger 3-way matching"
            >
              + LOG INVOICE
            </button>

            <button 
              className="btn-pixel btn-sm"
              style={{ background: '#352B4E', color: '#FFF' }}
              onClick={onRefresh}
              title="Refresh ledger and metrics"
            >
              <RefreshCw size={12} /> SYNC
            </button>
          </div>
        </div>
      </div>

      {/* Retro Arcade Metrics HUD Bar */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-label font-pixel">
            <Database size={13} color="var(--cyber-cyan)" /> TOTAL PO VALUE
          </div>
          <div className="metric-val font-tabular">
            ${(hudData.total_po_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Active Purchase Orders: <span className="font-tabular" style={{ color: '#FFF' }}>{hudData.total_pos || 0}</span>
          </div>
        </div>

        <div className="metric-card warning-card">
          <div className="metric-label font-pixel">
            <DollarSign size={13} color="var(--pixel-yellow)" /> OVERPAYMENT BLOCKED
          </div>
          <div className="metric-val font-tabular">
            ${(hudData.total_overpayment_blocked || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--pixel-yellow)' }}>
            Total Leakage Prevented
          </div>
        </div>

        <div className="metric-card success-card">
          <div className="metric-label font-pixel">
            <CheckCircle size={13} color="var(--matrix-green)" /> READY FOR APPROVAL
          </div>
          <div className="metric-val font-tabular">
            {hudData.ready_for_approval || 0}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--matrix-green)' }}>
            100% 3-Way Matched
          </div>
        </div>

        <div className="metric-card warning-card">
          <div className="metric-label font-pixel">
            <AlertTriangle size={13} color="var(--pixel-yellow)" /> DISCREPANCIES
          </div>
          <div className="metric-val font-tabular">
            {hudData.discrepancies_flagged || 0}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--pixel-yellow)' }}>
            Variance Flagged for Review
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label font-pixel">
            <Shield size={13} color="var(--accent-magenta-light)" /> LOW CONFIDENCE OCR
          </div>
          <div className="metric-val font-tabular" style={{ color: hudData.needs_review > 0 ? '#FBBF24' : '#FFF' }}>
            {hudData.needs_review || 0}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Requires Human Check (&lt;85%)
          </div>
        </div>
      </div>
    </header>
  );
}
