import React from 'react';
import { 
  LayoutDashboard, 
  Layers, 
  CheckCircle2, 
  AlertTriangle, 
  Eye, 
  ShieldCheck, 
  Package, 
  Building2, 
  Smartphone, 
  QrCode, 
  Award, 
  UserCheck, 
  Boxes,
  FileSpreadsheet
} from 'lucide-react';

export default function Sidebar({
  activeTab,
  setActiveTab,
  hudData = {},
  sitesCount = 0,
  currentRole,
  actorId,
  inventoryCriticalCount = 0
}) {
  return (
    <aside className="app-sidebar">
      {/* Workspace Brand Header */}
      <div className="sidebar-header">
        <div className="workspace-badge">
          <div className="workspace-icon">
            <Boxes size={18} />
          </div>
          <div className="workspace-info">
            <span className="workspace-name">Project AIR</span>
            <span className="workspace-tag">Enterprise Cloud</span>
          </div>
        </div>
      </div>

      {/* Navigation Sections */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Dashboards Section */}
        <div className="sidebar-nav-section">
          <div className="sidebar-section-title">Dashboards</div>
          
          <button 
            className={`sidebar-link ${activeTab === 'OVERVIEW' ? 'active' : ''}`}
            onClick={() => setActiveTab('OVERVIEW')}
          >
            <div className="sidebar-link-content">
              <LayoutDashboard size={16} />
              <span>Executive Overview</span>
            </div>
          </button>

          <button 
            className={`sidebar-link ${activeTab === 'MATRIX' ? 'active' : ''}`}
            onClick={() => setActiveTab('MATRIX')}
          >
            <div className="sidebar-link-content">
              <Layers size={16} />
              <span>3-Way Match Matrix</span>
            </div>
            {hudData.total_pos > 0 && (
              <span className="sidebar-link-badge badge-count">
                {hudData.total_pos}
              </span>
            )}
          </button>
        </div>

        {/* Reconciliation & Audit Section */}
        <div className="sidebar-nav-section">
          <div className="sidebar-section-title">Audit &amp; Reconciliation</div>

          <button 
            className={`sidebar-link ${activeTab === 'APPROVALS' ? 'active' : ''}`}
            onClick={() => setActiveTab('APPROVALS')}
          >
            <div className="sidebar-link-content">
              <CheckCircle2 size={16} color="var(--accent-emerald)" />
              <span>Ready for Approval</span>
            </div>
            {hudData.ready_for_approval > 0 && (
              <span className="sidebar-link-badge badge-count-green">
                {hudData.ready_for_approval}
              </span>
            )}
          </button>

          <button 
            className={`sidebar-link ${activeTab === 'DISCREPANCIES' ? 'active' : ''}`}
            onClick={() => setActiveTab('DISCREPANCIES')}
          >
            <div className="sidebar-link-content">
              <AlertTriangle size={16} color="var(--accent-amber)" />
              <span>Discrepancies</span>
            </div>
            {hudData.discrepancies_flagged > 0 && (
              <span className="sidebar-link-badge badge-count-yellow">
                {hudData.discrepancies_flagged}
              </span>
            )}
          </button>

          <button 
            className={`sidebar-link ${activeTab === 'OCR_REVIEW' ? 'active' : ''}`}
            onClick={() => setActiveTab('OCR_REVIEW')}
          >
            <div className="sidebar-link-content">
              <Eye size={16} color="var(--accent-cyan)" />
              <span>OCR Review Queue</span>
            </div>
            {hudData.needs_review > 0 && (
              <span className="sidebar-link-badge badge-count">
                {hudData.needs_review}
              </span>
            )}
          </button>

          <button 
            className={`sidebar-link ${activeTab === 'AUDIT_LOGS' ? 'active' : ''}`}
            onClick={() => setActiveTab('AUDIT_LOGS')}
          >
            <div className="sidebar-link-content">
              <ShieldCheck size={16} />
              <span>Immutable Audit Trail</span>
            </div>
          </button>
        </div>

        {/* Site Operations Section */}
        <div className="sidebar-nav-section">
          <div className="sidebar-section-title">Operations &amp; Field</div>

          <button 
            className={`sidebar-link ${activeTab === 'INVENTORY' ? 'active' : ''}`}
            onClick={() => setActiveTab('INVENTORY')}
          >
            <div className="sidebar-link-content">
              <Package size={16} />
              <span>Site Inventory Ledger</span>
            </div>
            {inventoryCriticalCount > 0 && (
              <span className="sidebar-link-badge badge-count-yellow">
                {inventoryCriticalCount} Low
              </span>
            )}
          </button>

          <button 
            className={`sidebar-link ${activeTab === 'SITES' ? 'active' : ''}`}
            onClick={() => setActiveTab('SITES')}
          >
            <div className="sidebar-link-content">
              <Building2 size={16} />
              <span>Sites &amp; Contracts</span>
            </div>
            {sitesCount > 0 && (
              <span className="sidebar-link-badge badge-count">
                {sitesCount}
              </span>
            )}
          </button>

          <button 
            className={`sidebar-link ${activeTab === 'MOBILE_PWA' ? 'active' : ''}`}
            onClick={() => setActiveTab('MOBILE_PWA')}
          >
            <div className="sidebar-link-content">
              <Smartphone size={16} />
              <span>Mobile DO Scanner</span>
            </div>
          </button>

          <button 
            className={`sidebar-link ${activeTab === 'QR_TOKENS' ? 'active' : ''}`}
            onClick={() => setActiveTab('QR_TOKENS')}
          >
            <div className="sidebar-link-content">
              <QrCode size={16} />
              <span>Issue Scoped QR Passes</span>
            </div>
          </button>
        </div>

        {/* Strategic Analytics Section */}
        <div className="sidebar-nav-section">
          <div className="sidebar-section-title">Strategic Analytics</div>

          <button 
            className={`sidebar-link ${activeTab === 'VENDOR_RISK' ? 'active' : ''}`}
            onClick={() => setActiveTab('VENDOR_RISK')}
          >
            <div className="sidebar-link-content">
              <Award size={16} color="var(--accent-purple)" />
              <span>Vendor Risk Scorecards</span>
            </div>
          </button>
        </div>
      </div>

      {/* Footer / Active Actor Profile */}
      <div className="sidebar-footer">
        <div className="actor-profile-card">
          <div className="actor-avatar">
            {currentRole === 'FINANCE_CONTROLLER' ? 'FC' : currentRole === 'AP_SPECIALIST' ? 'AP' : 'SS'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span style={{ fontSize: '12px', fontWeight: '600', color: '#FFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {actorId}
            </span>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
              {currentRole === 'FINANCE_CONTROLLER' ? 'Checker (Approver)' : currentRole === 'AP_SPECIALIST' ? 'Maker (Specialist)' : 'Site Supervisor'}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
