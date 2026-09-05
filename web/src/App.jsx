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
import './styles/modern-theme.css';

const API_BASE = 'http://localhost:8000/api';

export default function App() {
  const [hudData, setHudData] = useState({});
  const [pos, setPos] = useState([]);
  const [sites, setSites] = useState([]);
  const [reconciliations, setReconciliations] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('OVERVIEW');
  
  // Modals for PO & Invoice Creation
  const [isCreatePoOpen, setIsCreatePoOpen] = useState(false);
  const [isCreateInvoiceOpen, setIsCreateInvoiceOpen] = useState(false);
  const [selectedSiteForPo, setSelectedSiteForPo] = useState(null);

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
      const [hudRes, posRes, sitesRes, recRes, auditRes] = await Promise.all([
        fetch(`${API_BASE}/hud`),
        fetch(`${API_BASE}/pos`),
        fetch(`${API_BASE}/sites`),
        fetch(`${API_BASE}/reconciliations`),
        fetch(`${API_BASE}/audit-logs`)
      ]);

      const [hud, p, s, recs, logs] = await Promise.all([
        hudRes.json(),
        posRes.json(),
        sitesRes.json(),
        recRes.json(),
        auditRes.json()
      ]);

      setHudData(hud);
      setPos(p);
      setSites(s);
      setReconciliations(recs);
      setAuditLogs(logs);
    } catch (err) {
      console.error('Failed to load ledger data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Action: Create PO & Connect to Site
  const handleCreatePo = async (poData) => {
    const res = await fetch(`${API_BASE}/pos/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Actor-Id': actorId,
        'X-Actor-Role': currentRole
      },
      body: JSON.stringify(poData)
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to create PO');
    }
    await fetchAllData();
    return data;
  };

  // Action: Log Supplier Invoice & Run 3-Way Match
  const handleCreateInvoice = async (invoiceData) => {
    const res = await fetch(`${API_BASE}/invoices/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Actor-Id': actorId,
        'X-Actor-Role': currentRole
      },
      body: JSON.stringify(invoiceData)
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to log invoice');
    }
    await fetchAllData();
    setActiveTab('MATRIX');
    return data;
  };

  // Action: Maker Resolves Discrepancy
  const handleResolve = async (reconciliationId, notes) => {
    try {
      const res = await fetch(`${API_BASE}/reconciliations/resolve`, {
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
      const data = await res.json();
      if (res.ok) {
        alert('Discrepancy resolved and routed to Checker Approval Queue!');
        fetchAllData();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (e) {
      alert(`Network error: ${e.message}`);
    }
  };

  // Action: Checker Approves Payment (Maker-Checker Enforced)
  const handleApprove = async (reconciliationId) => {
    try {
      const res = await fetch(`${API_BASE}/reconciliations/approve`, {
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
      const data = await res.json();
      if (res.ok) {
        alert('Payment officially approved and record permanently locked!');
        fetchAllData();
      } else {
        alert(`Security Blocked: ${data.error}`);
      }
    } catch (e) {
      alert(`Network error: ${e.message}`);
    }
  };

  // Action: File Dispute
  const handleDispute = async (reconciliationId, reason) => {
    try {
      const res = await fetch(`${API_BASE}/reconciliations/dispute`, {
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
      if (res.ok) {
        alert('Formal dispute logged and vendor notified.');
        fetchAllData();
      }
    } catch (e) {
      alert(`Error: ${e.message}`);
    }
  };

  // Action: Short-Pay / Partial Payment Approval (Authorizes verified funds to keep site running)
  const handleApprovePartial = async (reconciliationId, notes) => {
    try {
      const res = await fetch(`${API_BASE}/reconciliations/approve-partial`, {
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
      const data = await res.json();
      if (res.ok) {
        alert('Short-Pay Voucher authorized! Verified funds released for bank disbursement while disputed balance is withheld under debit note.');
        fetchAllData();
      } else {
        alert(`Security Blocked: ${data.error}`);
      }
    } catch (e) {
      alert(`Network error: ${e.message}`);
    }
  };

  // Action: Dispatch Dispute Notice via Email to Vendor AR
  const handleDispatchDispute = async (reconciliationId, recipientEmail) => {
    try {
      const res = await fetch(`${API_BASE}/reconciliations/dispatch-dispute`, {
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
      const data = await res.json();
      if (res.ok) {
        alert(`Formal dispute letter & annotated DO proof dispatched to: ${recipientEmail}`);
        fetchAllData();
      }
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
    const res = await fetch(`${API_BASE}/ingest/do`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Ingest failed');
    }
    fetchAllData();
    return data;
  };

  // Action: Confirm Low-Confidence DO
  const handleConfirmLowConfidence = async (doId) => {
    const res = await fetch(`${API_BASE}/reconciliations/confirm-low-confidence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ do_id: doId, actor_id: actorId })
    });
    const data = await res.json();
    fetchAllData();
    return data;
  };

  // Action: Generate Scoped QR Token
  const handleGenerateToken = async (poId, siteId, expiresDays) => {
    const res = await fetch(`${API_BASE}/qr/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Actor-Id': actorId,
        'X-Actor-Role': currentRole
      },
      body: JSON.stringify({ po_id: poId, site_id: siteId, expires_days: expiresDays })
    });
    return await res.json();
  };

  const handleSelectTokenForMobile = (tokenStr) => {
    setMobileToken(tokenStr);
    setActiveTab('MOBILE_PWA');
  };

  return (
    <div className="app-shell">
      {/* Sleek shadcn-style Collapsible Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        hudData={hudData}
        sitesCount={sites.length}
        currentRole={currentRole}
        actorId={actorId}
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
      />

      {/* Log Supplier Invoice Modal */}
      <CreateInvoiceModal
        isOpen={isCreateInvoiceOpen}
        onClose={() => setIsCreateInvoiceOpen(false)}
        pos={pos}
        onSubmitInvoice={handleCreateInvoice}
      />
    </div>
  );
}
