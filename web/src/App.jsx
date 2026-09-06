import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import TopNav from './components/TopNav';
import ExecutiveDashboard from './components/ExecutiveDashboard';
import MatchMatrix from './components/MatchMatrix';
import ApprovalQueue from './components/ApprovalQueue';
import DiscrepancyQueue from './components/DiscrepancyQueue';
import ConfidenceReviewQueue from './components/ConfidenceReviewQueue';
import MobileCapturePWA from './components/MobileCapturePWA';
import QrTokenGenerator from './components/QrTokenGenerator';
import AuditLogViewer from './components/AuditLogViewer';
import ProjectSitesManager from './components/ProjectSitesManager';
import CreatePoModal from './components/CreatePoModal';
import CreateInvoiceModal from './components/CreateInvoiceModal';
import InventoryManager from './components/InventoryManager';
import VendorRiskScorecard from './components/VendorRiskScorecard';
import DocumentExportModal from './components/DocumentExportModal';
import './styles/modern-theme.css';
import { getApiBase } from './utils/token';
import { apiRequest } from './utils/apiClient';

const API_BASE = getApiBase();

export default function App() {
  const [hudData, setHudData] = useState({});
  const [pos, setPos] = useState([]);
  const [sites, setSites] = useState([]);
  const [reconciliations, setReconciliations] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('OVERVIEW');
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  
  const [isCreatePoOpen, setIsCreatePoOpen] = useState(false);
  const [isCreateInvoiceOpen, setIsCreateInvoiceOpen] = useState(false);
  const [selectedSiteForPo, setSelectedSiteForPo] = useState(null);

  // Document PDF / Print Export Modal State
  const [activeDocModal, setActiveDocModal] = useState(null);

  const handleOpenDocModal = (config = {}) => {
    setActiveDocModal(config);
  };

  const handleOpenCreatePo = (siteId = null) => {
    setSelectedSiteForPo(siteId);
    setIsCreatePoOpen(true);
  };

  // Maker-Checker Identity State
  const [currentRole, setCurrentRole] = useState('FINANCE_CONTROLLER');
  const [actorId, setActorId] = useState('FINANCE_CONTROLLER_BOB');
  
  const [mobileToken, setMobileToken] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      const [hud, p, s, recs, logs] = await Promise.all([
        apiRequest('/hud'),
        apiRequest('/pos'),
        apiRequest('/sites'),
        apiRequest('/reconciliations'),
        apiRequest('/audit-logs')
      ]);

      setHudData(hud || {});
      setPos(Array.isArray(p) ? p : []);
      setSites(Array.isArray(s) ? s : []);
      setReconciliations(Array.isArray(recs) ? recs : []);
      setAuditLogs(Array.isArray(logs) ? logs : []);
    } catch (err) {
      console.error('Failed to load ledger data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
    try {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      const tokenParam = params.get('token');
      if (tokenParam) {
        setMobileToken(tokenParam);
        setActiveTab('MOBILE_PWA');
      } else if (tabParam) {
        if (tabParam === 'MOBILE' || tabParam === 'MOBILE_PWA') {
          setActiveTab('MOBILE_PWA');
        } else {
          setActiveTab(tabParam.toUpperCase());
        }
      }
    } catch (e) {
      console.warn('Could not parse URL query parameters:', e);
    }
  }, []);

  // Action: Create PO & Connect to Site
  const handleCreatePo = async (poData) => {
    const data = await apiRequest('/pos/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Actor-Id': actorId,
        'X-Actor-Role': currentRole
      },
      body: JSON.stringify(poData)
    });
    if (data && data.error) {
      throw new Error(data.error || 'Failed to create PO');
    }
    await fetchAllData();
    return data;
  };

  // Action: Log Supplier Invoice & Run 3-Way Match
  const handleCreateInvoice = async (invoiceData) => {
    const data = await apiRequest('/invoices/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Actor-Id': actorId,
        'X-Actor-Role': currentRole
      },
      body: JSON.stringify(invoiceData)
    });
    if (data && data.error) {
      throw new Error(data.error || 'Failed to log invoice');
    }
    await fetchAllData();
    setActiveTab('MATRIX');
    return data;
  };

  // Action: Maker Resolves Discrepancy
  const handleResolve = async (reconciliationId, notes) => {
    try {
      const data = await apiRequest('/reconciliations/resolve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Actor-Id': actorId,
          'X-Actor-Role': currentRole
        },
        body: JSON.stringify({
          reconciliation_id: reconciliationId,
          notes,
          actor_id: actorId,
          actor_role: currentRole
        })
      });
      alert('Discrepancy resolved and routed to Checker Approval Queue!');
      fetchAllData();
    } catch (e) {
      alert(`Network error: ${e.message}`);
    }
  };

  // Action: Checker Approves Payment (Maker-Checker Enforced)
  const handleApprove = async (reconciliationId) => {
    try {
      const data = await apiRequest('/reconciliations/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Actor-Id': actorId,
          'X-Actor-Role': currentRole
        },
        body: JSON.stringify({
          reconciliation_id: reconciliationId,
          actor_id: actorId,
          actor_role: currentRole
        })
      });
      alert('Payment officially approved and record permanently locked!');
      fetchAllData();
    } catch (e) {
      alert(`Network error: ${e.message}`);
    }
  };

  // Action: File Dispute
  const handleDispute = async (reconciliationId, reason) => {
    try {
      await apiRequest('/reconciliations/dispute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Actor-Id': actorId,
          'X-Actor-Role': currentRole
        },
        body: JSON.stringify({
          reconciliation_id: reconciliationId,
          reason
        })
      });
      alert('Formal dispute logged and vendor notified.');
      fetchAllData();
    } catch (e) {
      alert(`Error: ${e.message}`);
    }
  };

  // Action: Short-Pay / Partial Payment Approval (Authorizes verified funds to keep site running)
  const handleApprovePartial = async (reconciliationId, notes) => {
    try {
      await apiRequest('/reconciliations/approve-partial', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Actor-Id': actorId,
          'X-Actor-Role': currentRole
        },
        body: JSON.stringify({
          reconciliation_id: reconciliationId,
          actor_id: actorId,
          actor_role: currentRole,
          notes: notes || 'Short-pay approved for verified physical site deliveries.'
        })
      });
      alert('Short-Pay Voucher authorized! Verified funds released for bank disbursement while disputed balance is withheld under debit note.');
      fetchAllData();
    } catch (e) {
      alert(`Network error: ${e.message}`);
    }
  };

  // Action: Dispatch Dispute Notice via Email to Vendor AR
  const handleDispatchDispute = async (reconciliationId, recipientEmail) => {
    try {
      await apiRequest('/reconciliations/dispatch-dispute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Actor-Id': actorId,
          'X-Actor-Role': currentRole
        },
        body: JSON.stringify({
          reconciliation_id: reconciliationId,
          recipient_email: recipientEmail
        })
      });
      alert(`Formal dispute letter & annotated DO proof dispatched to: ${recipientEmail}`);
      fetchAllData();
    } catch (e) {
      alert(`Error: ${e.message}`);
    }
  };

  // Action: Export Approved Disbursement Batch to ERP / Accounting (CSV)
  const handleExportErp = () => {
    window.open(`${API_BASE}/reconciliations/export-erp`, '_blank');
  };

  // Action: Mobile DO Upload
  const handleIngestDo = async (payload) => {
    const data = await apiRequest('/ingest/do', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    fetchAllData();
    return data;
  };

  // Action: Confirm Low-Confidence DO
  const handleConfirmLowConfidence = async (doId) => {
    const data = await apiRequest('/reconciliations/confirm-low-confidence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ do_id: doId, actor_id: actorId })
    });
    fetchAllData();
    return data;
  };

  // Action: Generate Scoped QR Token
  const handleGenerateToken = async (poId, siteId, expiresDays) => {
    const data = await apiRequest('/qr/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Actor-Id': actorId,
        'X-Actor-Role': currentRole
      },
      body: JSON.stringify({ po_id: poId, site_id: siteId, expires_days: expiresDays })
    });
    return data;
  };

  const handleSelectTokenForMobile = (tokenStr) => {
    setMobileToken(tokenStr);
    setActiveTab('MOBILE_PWA');
  };

  return (
    <div className="app-shell">
      {/* Mobile Drawer Overlay Backdrop */}
      <div 
        className={`sidebar-backdrop ${isMobileNavOpen ? 'visible' : ''}`}
        onClick={() => setIsMobileNavOpen(false)}
        aria-hidden="true"
      />

      {/* Sleek shadcn-style Collapsible Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        hudData={hudData}
        sitesCount={sites.length}
        currentRole={currentRole}
        actorId={actorId}
        isOpen={isMobileNavOpen}
        onClose={() => setIsMobileNavOpen(false)}
      />

      <div className="app-main">
        {/* Modern Top Navigation Bar */}
        <TopNav
          currentRole={currentRole}
          setCurrentRole={setCurrentRole}
          actorId={actorId}
          setActorId={setActorId}
          onRefresh={fetchAllData}
          onOpenCreatePo={() => handleOpenCreatePo(null)}
          onOpenCreateInvoice={() => setIsCreateInvoiceOpen(true)}
          onOpenDocModal={handleOpenDocModal}
          onToggleMobileNav={() => setIsMobileNavOpen(!isMobileNavOpen)}
          loading={loading}
        />

        {/* Dynamic Content Views */}
        <main className="content-container">
          {activeTab === 'OVERVIEW' && (
            <ExecutiveDashboard
              hudData={hudData}
              reconciliations={reconciliations}
              pos={pos}
              onNavigateToTab={setActiveTab}
            />
          )}

          {activeTab === 'MATRIX' && (
            <MatchMatrix
              reconciliations={reconciliations}
              currentRole={currentRole}
              actorId={actorId}
              onResolve={handleResolve}
              onApprove={handleApprove}
              onApprovePartial={handleApprovePartial}
              onDispute={handleDispute}
              onDispatchDispute={handleDispatchDispute}
              onExportErp={handleExportErp}
              onOpenDocModal={handleOpenDocModal}
            />
          )}

          {activeTab === 'INVENTORY' && (
            <InventoryManager onRefreshLedger={fetchAllData} />
          )}

          {activeTab === 'VENDOR_RISK' && (
            <VendorRiskScorecard />
          )}

          {activeTab === 'SITES' && (
            <ProjectSitesManager
              sites={sites}
              pos={pos}
              onOpenCreatePo={handleOpenCreatePo}
              onOpenCreateInvoice={() => setIsCreateInvoiceOpen(true)}
              onSelectTokenForMobile={handleSelectTokenForMobile}
              onOpenDocModal={handleOpenDocModal}
            />
          )}

          {activeTab === 'APPROVALS' && (
            <ApprovalQueue
              reconciliations={reconciliations}
              currentRole={currentRole}
              actorId={actorId}
              onApprove={handleApprove}
            />
          )}

          {activeTab === 'DISCREPANCIES' && (
            <DiscrepancyQueue
              reconciliations={reconciliations}
              currentRole={currentRole}
              actorId={actorId}
              onResolve={handleResolve}
              onDispute={handleDispute}
            />
          )}

          {activeTab === 'OCR_REVIEW' && (
            <ConfidenceReviewQueue
              reconciliations={reconciliations}
              onConfirmLowConfidence={handleConfirmLowConfidence}
            />
          )}

          {activeTab === 'MOBILE_PWA' && (
            <MobileCapturePWA
              initialToken={mobileToken}
              pos={pos}
              onIngestDo={handleIngestDo}
            />
          )}

          {activeTab === 'QR_TOKENS' && (
            <QrTokenGenerator
              pos={pos}
              onGenerateToken={handleGenerateToken}
              onSelectTokenForMobile={handleSelectTokenForMobile}
            />
          )}

          {activeTab === 'AUDIT_LOGS' && (
            <AuditLogViewer
              auditLogs={auditLogs}
            />
          )}
        </main>
      </div>

      {/* Create Purchase Order Modal */}
      <CreatePoModal
        isOpen={isCreatePoOpen}
        onClose={() => {
          setIsCreatePoOpen(false);
          setSelectedSiteForPo(null);
        }}
        sites={sites}
        initialSiteId={selectedSiteForPo}
        onSubmitPo={handleCreatePo}
        onSelectTokenForMobile={handleSelectTokenForMobile}
        onOpenDocModal={handleOpenDocModal}
      />

      {/* Log Supplier Invoice Modal */}
      <CreateInvoiceModal
        isOpen={isCreateInvoiceOpen}
        onClose={() => setIsCreateInvoiceOpen(false)}
        pos={pos}
        onSubmitInvoice={handleCreateInvoice}
        onOpenCreatePo={() => {
          setIsCreateInvoiceOpen(false);
          setIsCreatePoOpen(true);
        }}
      />

      {/* Universal Document Export & Print Engine Modal */}
      {activeDocModal && (
        <DocumentExportModal
          isOpen={!!activeDocModal}
          onClose={() => setActiveDocModal(null)}
          initialDocType={activeDocModal.initialDocType || 'PO'}
          po={activeDocModal.po || null}
          site={activeDocModal.site || null}
          reconciliation={activeDocModal.reconciliation || null}
          allPos={pos}
        />
      )}
    </div>
  );
}
