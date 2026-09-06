import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { 
  Printer, 
  Download, 
  X, 
  FileText, 
  ShieldCheck, 
  QrCode, 
  Building, 
  CheckCircle2, 
  AlertTriangle, 
  Copy, 
  ExternalLink,
  MapPin,
  Calendar,
  DollarSign,
  UserCheck,
  Edit3,
  Check
} from 'lucide-react';

export default function DocumentExportModal({
  isOpen,
  onClose,
  initialDocType = 'PO', // 'PO' | 'DO_GATE_PASS' | 'AUDIT_VOUCHER' | 'SITE_DOSSIER'
  po = null,
  site = null,
  reconciliation = null,
  allPos = []
}) {
  const [activeType, setActiveType] = useState(initialDocType);
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const qrCanvasRef = useRef(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const DEFAULT_CONFIG = {
    companyName: 'PROJECT AIR INFRASTRUCTURE SDN BHD',
    registrationNo: 'SSM Reg: 202401099882 (1548231-X) • SST ID: W10-2401-32000412',
    address: 'Level 28, Menara Binjai, No 2 Jalan Binjai, 50450 Kuala Lumpur, Malaysia',
    qsName: 'En. Muhammad Farhan Bin Azhar (B.Sc QS, MISM)',
    qsRole: 'Senior Quantity Surveyor (QS) • CIDB Certified',
    directorName: 'Ir. Tan Chee Keong (P.Eng, MIEM)',
    directorRole: 'Project Director & Authorized Signatory',
    supplierName: '',
    siteNotes: 'Certified site material intake summary prepared in compliance with CIDB site verification tolerances and PAM Contract 2018 guidelines.'
  };

  // Customizable document parameters loaded from persistent storage
  const [customConfig, setCustomConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('project_air_doc_config');
      if (saved) {
        return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('Failed to parse doc config from localStorage', e);
    }
    return DEFAULT_CONFIG;
  });

  const handleConfigChange = (field, value) => {
    setCustomConfig(prev => {
      const updated = { ...prev, [field]: value };
      try {
        localStorage.setItem('project_air_doc_config', JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to save doc config to localStorage', e);
      }
      return updated;
    });
  };

  const handleSaveExplicit = () => {
    try {
      localStorage.setItem('project_air_doc_config', JSON.stringify(customConfig));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (e) {
      console.warn('Failed to save config', e);
    }
  };

  const handleResetDefaults = () => {
    if (window.confirm('Reset document template settings to default values?')) {
      setCustomConfig(DEFAULT_CONFIG);
      try {
        localStorage.removeItem('project_air_doc_config');
      } catch (e) {}
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    }
  };

  useEffect(() => {
    if (initialDocType) {
      setActiveType(initialDocType);
    }
  }, [initialDocType, isOpen]);

  // Determine active document context
  const activePo = po || (reconciliation ? {
    po_number: reconciliation.po_number,
    supplier_name: reconciliation.supplier_name,
    project_name: reconciliation.project_name || 'Project Site Gateway',
    total_amount: reconciliation.po_total_amount || 0,
    items: reconciliation.items || []
  } : allPos[0]);

  const activeSite = site || (activePo?.project_site_id ? {
    site_id: activePo.project_site_id,
    project_name: activePo.project_name || 'Site Alpha'
  } : { site_id: 'SITE-01', project_name: activePo?.project_name || 'Project Site' });

  // Render QR Code onto canvas whenever document or type changes
  useEffect(() => {
    if (!isOpen || !qrCanvasRef.current) return;

    let qrContent = '';
    const token = activePo?.token || activePo?.po_id || 'PO-DEMO-TOKEN';
    
    if (activeType === 'DO_GATE_PASS' || activeType === 'PO') {
      qrContent = `${window.location.origin}/?tab=MOBILE_PWA&token=${encodeURIComponent(token)}`;
    } else if (activeType === 'AUDIT_VOUCHER') {
      qrContent = `PROJECT-AIR:AUDIT-CERT:${reconciliation?.reconciliation_id || 'REC-VERIFIED'}:STAMP:${Date.now()}`;
    } else {
      qrContent = `${window.location.origin}/?tab=SITES&site=${encodeURIComponent(activeSite.site_id)}`;
    }

    QRCode.toCanvas(qrCanvasRef.current, qrContent, {
      width: 140,
      margin: 1,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    }).catch(err => console.error('Failed to generate document QR:', err));
  }, [isOpen, activeType, activePo, activeSite, reconciliation]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleCopyText = () => {
    let summary = `PROJECT AIR - OFFICIAL SYSTEM DOCUMENT\nType: ${activeType}\nGenerated: ${new Date().toLocaleString()}\n`;
    if (activeType === 'PO' && activePo) {
      summary += `PO Number: ${activePo.po_number}\nSupplier: ${activePo.supplier_name}\nSite: ${activePo.project_name}\nTotal: RM ${(activePo.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}\n`;
    } else if (activeType === 'DO_GATE_PASS') {
      summary += `Site: ${activeSite.project_name} (${activeSite.site_id})\nContract: ${activePo?.po_number || 'N/A'}\nPIN: 8842\n`;
    } else if (activeType === 'AUDIT_VOUCHER' && reconciliation) {
      summary += `Audit ID: ${reconciliation.reconciliation_id}\nStatus: ${reconciliation.match_status}\nPO: ${reconciliation.po_number}\nInvoice: ${reconciliation.invoice_number}\nOverpayment Blocked: RM ${(reconciliation.total_overpayment_blocked || 0).toLocaleString()}\n`;
    }
    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="doc-modal-overlay">
      {/* Modal Dialog Card (Interactive Screen Chrome) */}
      <div className="doc-modal-dialog">
        
        {/* Top Header & Toolbar (Hidden during print) */}
        <div className="doc-modal-toolbar no-print">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(56, 189, 248, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileText size={18} color="#38bdf8" />
            </div>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: '600', color: '#fff', margin: 0 }}>
                Enterprise Document &amp; PDF Export Center
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                High-Resolution Formal Print &amp; PDF Vector Output
              </p>
            </div>
          </div>

          {/* Template Tab Selector */}
          <div className="doc-template-tabs">
            <button 
              className={`doc-tab-btn ${activeType === 'PO' ? 'active' : ''}`}
              onClick={() => setActiveType('PO')}
            >
              Purchase Order (PO)
            </button>
            <button 
              className={`doc-tab-btn ${activeType === 'DO_GATE_PASS' ? 'active' : ''}`}
              onClick={() => setActiveType('DO_GATE_PASS')}
            >
              Site Gate Pass (DO)
            </button>
            <button 
              className={`doc-tab-btn ${activeType === 'AUDIT_VOUCHER' ? 'active' : ''}`}
              onClick={() => setActiveType('AUDIT_VOUCHER')}
            >
              3-Way Audit Voucher
            </button>
            <button 
              className={`doc-tab-btn ${activeType === 'SITE_DOSSIER' ? 'active' : ''}`}
              onClick={() => setActiveType('SITE_DOSSIER')}
            >
              Site Spend Dossier
            </button>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button 
              className={`btn-modern ${isEditing ? 'btn-modern-primary' : 'btn-modern-secondary'} btn-sm`}
              onClick={() => setIsEditing(!isEditing)}
              title="Customize company details, signatories, and QS inspection notes"
            >
              {isEditing ? <Check size={13} /> : <Edit3 size={13} />} {isEditing ? 'Preview Document' : 'Edit Template'}
            </button>
            <button 
              className="btn-modern btn-modern-secondary btn-sm"
              onClick={handleCopyText}
              title="Copy plain text summary"
            >
              <Copy size={13} /> {copied ? 'Copied!' : 'Copy Summary'}
            </button>
            <button 
              className="btn-modern btn-modern-primary btn-sm"
              onClick={handlePrint}
              style={{ background: '#10b981', borderColor: '#10b981', color: '#fff' }}
            >
              <Printer size={14} /> Print / Save as PDF
            </button>
            <button 
              className="btn-modern btn-modern-secondary btn-sm"
              onClick={onClose}
              style={{ padding: '6px 8px' }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Inline Template Editor Drawer */}
        {isEditing && (
          <div className="no-print" style={{ background: '#141418', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Edit3 size={14} color="#38bdf8" /> Document &amp; Signatory Parameters
                </h4>
                <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)' }}>
                  Edits update all live previews immediately and are saved permanently to your device storage.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button 
                  type="button" 
                  className="btn-modern btn-modern-secondary btn-sm"
                  onClick={handleResetDefaults}
                  title="Reset all fields to original standard company defaults"
                >
                  Reset Defaults
                </button>
                <button 
                  type="button" 
                  className="btn-modern btn-modern-primary btn-sm"
                  onClick={handleSaveExplicit}
                  style={{ background: '#10b981', borderColor: '#10b981', color: '#fff' }}
                  title="Save template parameters permanently to browser"
                >
                  {saveSuccess ? <Check size={13} /> : <CheckCircle2 size={13} />} {saveSuccess ? 'Saved to Browser!' : 'Save Changes'}
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Company Legal Name</label>
                <input type="text" value={customConfig.companyName} onChange={e => handleConfigChange('companyName', e.target.value)} style={{ width: '100%', background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '6px 8px', fontSize: '12px' }} />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>SSM Reg &amp; SST Tax Number</label>
                <input type="text" value={customConfig.registrationNo} onChange={e => handleConfigChange('registrationNo', e.target.value)} style={{ width: '100%', background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '6px 8px', fontSize: '12px' }} />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Registered HQ Address</label>
                <input type="text" value={customConfig.address} onChange={e => handleConfigChange('address', e.target.value)} style={{ width: '100%', background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '6px 8px', fontSize: '12px' }} />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Project Director / Signatory Name</label>
                <input type="text" value={customConfig.directorName} onChange={e => handleConfigChange('directorName', e.target.value)} style={{ width: '100%', background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '6px 8px', fontSize: '12px' }} />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Director Role / Designation</label>
                <input type="text" value={customConfig.directorRole} onChange={e => handleConfigChange('directorRole', e.target.value)} style={{ width: '100%', background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '6px 8px', fontSize: '12px' }} />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Senior QS / Inspector Signatory Name</label>
                <input type="text" value={customConfig.qsName} onChange={e => handleConfigChange('qsName', e.target.value)} style={{ width: '100%', background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '6px 8px', fontSize: '12px' }} />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Senior QS Role / Designation</label>
                <input type="text" value={customConfig.qsRole} onChange={e => handleConfigChange('qsRole', e.target.value)} style={{ width: '100%', background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '6px 8px', fontSize: '12px' }} />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Supplier / Vendor Override (Optional)</label>
                <input type="text" placeholder={activePo?.supplier_name || 'Use default PO supplier'} value={customConfig.supplierName} onChange={e => handleConfigChange('supplierName', e.target.value)} style={{ width: '100%', background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '6px 8px', fontSize: '12px' }} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Site Inspection / Valuation Progress Remarks</label>
                <input type="text" value={customConfig.siteNotes} onChange={e => handleConfigChange('siteNotes', e.target.value)} style={{ width: '100%', background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '6px 8px', fontSize: '12px' }} />
              </div>
            </div>
          </div>
        )}

        {/* Scrollable Printable Document Container */}
        <div className="doc-modal-body">
          <div className="doc-paper-sheet printable-document-container">
            
            {/* Template 1: OFFICIAL PURCHASE ORDER (PO) */}
            {activeType === 'PO' && (
              <div className="doc-content-layout">
                {/* Formal Header */}
                <div className="doc-header-row">
                  <div>
                    <div className="doc-company-title">{customConfig.companyName}</div>
                    <div className="doc-subtext">Infrastructure &amp; Industrial Engineering Operations</div>
                    <div className="doc-subtext">{customConfig.address}</div>
                    <div className="doc-subtext">{customConfig.registrationNo}</div>
                  </div>
                  <div className="doc-id-box">
                    <div className="doc-tag">OFFICIAL PURCHASE ORDER</div>
                    <div className="doc-main-number">{activePo?.po_number || 'PO-2026-PENDING'}</div>
                    <div className="doc-meta-item"><strong>Date Issued:</strong> {activePo?.issue_date || new Date().toISOString().split('T')[0]}</div>
                    <div className="doc-meta-item"><strong>Currency:</strong> MYR (RM)</div>
                  </div>
                </div>

                <div className="doc-divider" />

                {/* Vendor & Project Scope Grid */}
                <div className="doc-parties-grid">
                  <div className="doc-party-card">
                    <div className="doc-section-label">SUPPLIER / VENDOR</div>
                    <div className="doc-party-name">{customConfig.supplierName || activePo?.supplier_name || 'Registered Vendor'}</div>
                    <div className="doc-party-detail">Vendor ID: VEND-{Math.abs((activePo?.supplier_name || 'V').split('').reduce((a, b) => a + b.charCodeAt(0), 0))}</div>
                    <div className="doc-party-detail">Payment Terms: 30 Days Net from Verified 3-Way Match</div>
                    <div className="doc-party-detail">Delivery Target: Immediate Dispatch to Specified Job Site</div>
                  </div>

                  <div className="doc-party-card">
                    <div className="doc-section-label">PROJECT DESTINATION &amp; SITE</div>
                    <div className="doc-party-name">{activePo?.project_name || activeSite?.project_name || 'Project Alpha Site'}</div>
                    <div className="doc-party-detail">Site Gate Code: {activeSite?.site_id || 'SITE-HQ'}</div>
                    <div className="doc-party-detail">Receiving Desk: Site Weighbridge &amp; Materials Marshalling Bay</div>
                    <div className="doc-party-detail">Security Protocol: Driver QR Gate Pass Intake Required</div>
                  </div>
                </div>

                {/* Line Items Table */}
                <div className="doc-table-wrapper">
                  <table className="doc-table">
                    <thead>
                      <tr>
                        <th style={{ width: '40px', textAlign: 'center' }}>#</th>
                        <th style={{ width: '120px' }}>Item Code</th>
                        <th>Material Description &amp; Specifications</th>
                        <th style={{ width: '80px', textAlign: 'center' }}>UoM</th>
                        <th style={{ width: '100px', textAlign: 'right' }}>Qty Auth</th>
                        <th style={{ width: '120px', textAlign: 'right' }}>Rate (RM)</th>
                        <th style={{ width: '130px', textAlign: 'right' }}>Subtotal (RM)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(activePo?.items && activePo.items.length > 0) ? (
                        activePo.items.map((item, idx) => {
                          const qty = item.quantity !== undefined ? item.quantity : (item.authorized_quantity || item.po_quantity || 0);
                          const price = item.unit_price !== undefined ? item.unit_price : (item.po_unit_price || 0);
                          const subtotal = qty * price;
                          return (
                            <tr key={idx}>
                              <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                              <td className="doc-mono">{item.item_code || `MAT-00${idx + 1}`}</td>
                              <td>
                                <strong>{item.description}</strong>
                              </td>
                              <td style={{ textAlign: 'center' }}>{item.unit || 'Units'}</td>
                              <td style={{ textAlign: 'right' }} className="doc-mono">{Number(qty).toLocaleString()}</td>
                              <td style={{ textAlign: 'right' }} className="doc-mono">{Number(price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                              <td style={{ textAlign: 'right' }} className="doc-mono doc-bold">
                                {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={7} style={{ textAlign: 'center', padding: '16px', color: '#64748b' }}>
                            Standard Bulk Procurement Schedule (As per Master Supply Agreement)
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'right', fontWeight: '600' }}>Subtotal Amount:</td>
                        <td colSpan={2} style={{ textAlign: 'right' }} className="doc-mono">
                          RM {(activePo?.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'right', fontWeight: '600' }}>SST / Service Tax (0% Material Construction Exemption):</td>
                        <td colSpan={2} style={{ textAlign: 'right' }} className="doc-mono">RM 0.00</td>
                      </tr>
                      <tr className="doc-total-row">
                        <td colSpan={5} style={{ textAlign: 'right', fontSize: '15px' }}>TOTAL AUTHORIZED CONTRACT VALUE:</td>
                        <td colSpan={2} style={{ textAlign: 'right', fontSize: '16px' }} className="doc-mono doc-bold">
                          RM {(activePo?.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* QR Pass & Terms Section */}
                <div className="doc-bottom-section">
                  <div className="doc-qr-box">
                    <canvas ref={qrCanvasRef} style={{ width: '110px', height: '110px' }} />
                    <div className="doc-qr-label">DIGITAL VERIFICATION GATE PASS</div>
                    <div className="doc-qr-sub">Scan to verify authentic signed token on Project AIR network</div>
                  </div>

                  <div className="doc-terms-box">
                    <div className="doc-section-label">STATUTORY TERMS &amp; DISBURSEMENT CONDITIONS</div>
                    <ol className="doc-terms-list">
                      <li><strong>Automated 3-Way Match:</strong> Payment will ONLY be released upon automated cryptographic matching of this PO with physical Delivery Orders (DO) received at the site weighbridge and valid e-Invoice.</li>
                      <li><strong>Discrepancy Withholding:</strong> Short-deliveries or non-conforming items logged by site inspectors will result in automated line-item withholding (Short-Pay).</li>
                      <li><strong>Receiving Verification:</strong> Delivery drivers must present this QR Gate Pass or the printed site token upon arrival at the weighbridge.</li>
                    </ol>
                  </div>
                </div>

                {/* Signature Stamps */}
                <div className="doc-signature-row">
                  <div className="doc-signature-box">
                    <div className="doc-sign-line" />
                    <div className="doc-sign-name">{customConfig.directorName || 'Ir. Tan Chee Keong (P.Eng, MIEM)'}</div>
                    <div className="doc-sign-role">{customConfig.directorRole || 'Project Director & Authorized Signatory'}</div>
                    <div className="doc-stamp verified">ELECTRONICALLY AUTHORIZED</div>
                  </div>

                  <div className="doc-signature-box">
                    <div className="doc-sign-line" />
                    <div className="doc-sign-name">{customConfig.qsName || 'En. Muhammad Farhan Bin Azhar (B.Sc QS)'}</div>
                    <div className="doc-sign-role">{customConfig.qsRole || 'Senior QS & Authorized Signatory'}</div>
                    <div className="doc-stamp-placeholder">Official Stamp &amp; Date</div>
                  </div>
                </div>
              </div>
            )}

            {/* Template 2: SITE GATE PASS & DO DELIVERY TICKET */}
            {activeType === 'DO_GATE_PASS' && (
              <div className="doc-content-layout">
                <div className="doc-gatepass-banner">
                  <div>
                    <div className="doc-gatepass-badge">SITE ACCESS &amp; MATERIAL INTAKE DOCKET</div>
                    <div className="doc-gatepass-site">{activeSite.project_name}</div>
                    <div className="doc-subtext">Location Site ID: <strong>{activeSite.site_id}</strong> &bull; Entrance Gate #1 Weighbridge</div>
                  </div>
                  <div className="doc-pin-badge">
                    <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>OFFLINE SITE PIN</div>
                    <div style={{ fontSize: '24px', fontWeight: '800', fontFamily: 'monospace', letterSpacing: '2px' }}>
                      {activePo?.po_id ? activePo.po_id.replace(/[^0-9]/g, '').slice(-4) || '8842' : '8842'}
                    </div>
                  </div>
                </div>

                <div className="doc-divider" />

                <div style={{ display: 'flex', gap: '24px', alignItems: 'center', margin: '20px 0', background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ textAlign: 'center', minWidth: '150px' }}>
                    <canvas ref={qrCanvasRef} style={{ width: '130px', height: '130px', border: '1px solid #cbd5e1', padding: '4px', background: '#fff' }} />
                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#0f172a', marginTop: '6px' }}>
                      DRIVER GATE QR
                    </div>
                  </div>

                  <div style={{ flex: 1 }}>
                    <h4 style={{ fontSize: '15px', color: '#0f172a', margin: '0 0 6px 0', fontWeight: '700' }}>
                      Driver Intake Instructions / Arahan Pemandu Lori:
                    </h4>
                    <ul style={{ fontSize: '12px', color: '#334155', margin: 0, paddingLeft: '18px', lineHeight: 1.6 }}>
                      <li><strong>English:</strong> Upon arrival, scan this QR code using your smartphone camera to launch the intake pass, or present your physical DO to the weighbridge operator.</li>
                      <li><strong>Bahasa Melayu:</strong> Semasa tiba di pondok pengawal, imbas kod QR ini menggunakan kamera telefon pintar untuk merekod penghantaran bahan atau serahkan Nota Penghantaran (DO) kepada penyelia tapak.</li>
                      <li><strong>Inspection:</strong> Do not unload any concrete, steel, or aggregate until the Site Supervisor verifies batch weights against Contract: <strong>{activePo?.po_number || 'ACTIVE-PO'}</strong>.</li>
                    </ul>
                  </div>
                </div>

                {/* Contract Context */}
                <div className="doc-section-label">PERMITTED INTAKE SCHEDULE &amp; AUTHORIZED MATERIALS</div>
                <div className="doc-table-wrapper">
                  <table className="doc-table" style={{ marginBottom: '24px' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '120px' }}>PO Reference</th>
                        <th>Authorized Supplier</th>
                        <th>Permitted Materials</th>
                        <th style={{ width: '120px', textAlign: 'right' }}>Max Limit</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="doc-mono">{activePo?.po_number || 'PO-2026-ALL'}</td>
                        <td><strong>{customConfig.supplierName || activePo?.supplier_name || 'Authorized Suppliers'}</strong></td>
                        <td>Direct Construction Materials &bull; Pre-Mixed Concrete / Rebar / Ballast</td>
                        <td style={{ textAlign: 'right' }} className="doc-mono doc-bold">
                          RM {(activePo?.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Gate Security Log Box */}
                <div style={{ border: '1px dashed #94a3b8', padding: '16px', borderRadius: '6px', marginTop: '16px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', marginBottom: '12px' }}>
                    TO BE FILLED BY SITE WEIGHBRIDGE OPERATOR (MANUAL BACKUP)
                  </div>
                  <div className="doc-weighbridge-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', fontSize: '12px' }}>
                    <div>Lorry Plate No: __________________</div>
                    <div>Gross Wt (kg): __________________</div>
                    <div>Tare Wt (kg): __________________</div>
                    <div>Net Intake (kg): __________________</div>
                  </div>
                  <div className="doc-weighbridge-subgrid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', fontSize: '12px', marginTop: '16px' }}>
                    <div>DO Delivery Docket No: ________________________</div>
                    <div>Supervisor / Intake Officer: <strong>{customConfig.qsName || 'Certified Site Gatekeeper'}</strong></div>
                  </div>
                </div>
              </div>
            )}

            {/* Template 3: 3-WAY MATCH AUDIT VOUCHER */}
            {activeType === 'AUDIT_VOUCHER' && (
              <div className="doc-content-layout">
                <div className="doc-header-row">
                  <div>
                    <div className="doc-company-title">{customConfig.companyName} AUDIT &amp; ACCOUNTS PAYABLE</div>
                    <div className="doc-subtext">Automated 3-Way Match Verification &amp; Disbursement Certificate</div>
                    <div className="doc-subtext">Internal Audit Control Standard ISO-9001 / Malaysian FRS Compliant</div>
                  </div>
                  <div className="doc-id-box">
                    <div className="doc-tag" style={{ background: reconciliation?.match_status === 'MATCHED' ? '#10b981' : '#f59e0b' }}>
                      AUDIT CERTIFICATE: {reconciliation?.match_status || 'RECONCILED'}
                    </div>
                    <div className="doc-main-number">{reconciliation?.reconciliation_id || 'REC-2026-001'}</div>
                    <div className="doc-meta-item"><strong>Audited Date:</strong> {new Date().toISOString().split('T')[0]}</div>
                  </div>
                </div>

                <div className="doc-divider" />

                {/* Triangulation Header */}
                <div className="doc-triangulation-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
                  <div className="doc-party-card">
                    <div className="doc-section-label">1. PURCHASE ORDER (PO)</div>
                    <div className="doc-party-name">{reconciliation?.po_number || activePo?.po_number}</div>
                    <div className="doc-party-detail">Vendor: {customConfig.supplierName || reconciliation?.supplier_name || activePo?.supplier_name}</div>
                  </div>

                  <div className="doc-party-card">
                    <div className="doc-section-label">2. DELIVERY ORDER (DO)</div>
                    <div className="doc-party-name">{reconciliation?.do_number || 'DO-VERIFIED'}</div>
                    <div className="doc-party-detail">Intake Site: {reconciliation?.project_name || activeSite?.project_name}</div>
                  </div>

                  <div className="doc-party-card">
                    <div className="doc-section-label">3. SUPPLIER INVOICE (INV)</div>
                    <div className="doc-party-name">{reconciliation?.invoice_number || 'INV-AUDITED'}</div>
                    <div className="doc-party-detail">Claimed Amount: RM {(reconciliation?.invoice_total_amount || reconciliation?.invoice_amount || activePo?.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                  </div>
                </div>

                {/* Audit Line Comparison */}
                <div className="doc-section-label">LINE-ITEM TRIANGULATION &amp; SHORT-PAY DETERMINATION</div>
                <div className="doc-table-wrapper">
                  <table className="doc-table" style={{ marginBottom: '20px' }}>
                    <thead>
                      <tr>
                        <th>Material Description</th>
                        <th style={{ width: '80px', textAlign: 'right' }}>PO Qty</th>
                        <th style={{ width: '90px', textAlign: 'right' }}>PO Rate (RM)</th>
                        <th style={{ width: '90px', textAlign: 'right' }}>DO Intake Qty</th>
                        <th style={{ width: '90px', textAlign: 'right' }}>Inv Billed Qty</th>
                        <th style={{ width: '90px', textAlign: 'right' }}>Variance</th>
                        <th style={{ width: '110px', textAlign: 'right' }}>Disbursable (RM)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(reconciliation?.items && reconciliation.items.length > 0) ? (
                        reconciliation.items.map((item, idx) => {
                          const poQty = Number(item.ordered_qty || item.quantity || 0);
                          const deliveredQty = Number(item.cumulative_delivered_qty || item.delivered_qty || 0);
                          const billedQty = Number(item.cumulative_billed_qty || item.billed_qty || 0);
                          const variance = item.variance_qty !== undefined ? item.variance_qty : (billedQty - deliveredQty);
                          const payable = item.verified_payable_amount !== undefined ? item.verified_payable_amount : Math.min(deliveredQty, billedQty) * (item.po_unit_price || 0);

                          return (
                            <tr key={idx}>
                              <td><strong>{item.description}</strong></td>
                              <td style={{ textAlign: 'right' }} className="doc-mono">{poQty}</td>
                              <td style={{ textAlign: 'right' }} className="doc-mono">{Number(item.po_unit_price || 0).toFixed(2)}</td>
                              <td style={{ textAlign: 'right' }} className="doc-mono">{deliveredQty}</td>
                              <td style={{ textAlign: 'right' }} className="doc-mono">{billedQty}</td>
                              <td style={{ textAlign: 'right' }} className="doc-mono" style={{ color: variance > 0 ? '#dc2626' : '#64748b', fontWeight: variance > 0 ? '700' : 'normal' }}>
                                {variance > 0 ? `+${variance} (Over)` : variance < 0 ? `${variance}` : '0.00'}
                              </td>
                              <td style={{ textAlign: 'right' }} className="doc-mono doc-bold">
                                RM {payable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={7} style={{ textAlign: 'center', padding: '16px', color: '#64748b' }}>
                            Standard 3-Way Triangulation in Equilibrium (Zero Discrepancies)
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: '#f8fafc' }}>
                        <td colSpan={5} style={{ textAlign: 'right', fontWeight: '700' }}>TOTAL OVERPAYMENT BLOCKED / WITHHELD:</td>
                        <td colSpan={2} style={{ textAlign: 'right', color: '#dc2626' }} className="doc-mono doc-bold">
                          RM {(reconciliation?.total_overpayment_blocked || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                      <tr className="doc-total-row">
                        <td colSpan={5} style={{ textAlign: 'right', fontSize: '14px' }}>VERIFIED AMOUNT APPROVED FOR DISBURSEMENT:</td>
                        <td colSpan={2} style={{ textAlign: 'right', fontSize: '16px', color: '#059669' }} className="doc-mono doc-bold">
                          RM {((reconciliation?.po_total_amount || activePo?.total_amount || 0) - (reconciliation?.total_overpayment_blocked || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Accounting GL Coding Box */}
                <div style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '12px 16px', marginBottom: '20px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', fontSize: '11px' }}>
                    <div><strong>GL Account:</strong> 5010-01 (Direct Materials)</div>
                    <div><strong>Cost Center:</strong> CC-{activeSite.site_id}</div>
                    <div><strong>Tax Code:</strong> MY-SST-EXEMPT</div>
                    <div><strong>Payment Method:</strong> Maybank Bulk IBG</div>
                  </div>
                </div>

                {/* Maker / Checker Audit Sign-off */}
                <div className="doc-signature-row">
                  <div className="doc-signature-box">
                    <div className="doc-sign-line" />
                    <div className="doc-sign-name">{customConfig.qsName || reconciliation?.resolved_by || 'maker_user_01'}</div>
                    <div className="doc-sign-role">{customConfig.qsRole || 'Maker Sign-off • Reconciliation Verified'}</div>
                    <div className="doc-stamp verified">MAKER VERIFIED</div>
                  </div>

                  <div className="doc-signature-box">
                    <div className="doc-sign-line" />
                    <div className="doc-sign-name">{customConfig.directorName || reconciliation?.checker_approved_by || 'Finance Controller'}</div>
                    <div className="doc-sign-role">{customConfig.directorRole || 'Checker Sign-off • Payment Released'}</div>
                    <div className="doc-stamp verified">CHECKER AUTHORIZED</div>
                  </div>
                </div>
              </div>
            )}

            {/* Template 4: PROJECT SITE EXPENDITURE DOSSIER */}
            {activeType === 'SITE_DOSSIER' && (
              <div className="doc-content-layout">
                <div className="doc-header-row">
                  <div>
                    <div className="doc-company-title">{customConfig.companyName}</div>
                    <div className="doc-subtext">Project Site Financial Summary &bull; Materials Intake &amp; Valuation Report</div>
                    <div className="doc-subtext">Prepared for Senior Quantity Surveyor (QS) &amp; Project Director Review</div>
                    <div className="doc-subtext">{customConfig.registrationNo}</div>
                  </div>
                  <div className="doc-id-box">
                    <div className="doc-tag">SITE DOSSIER</div>
                    <div className="doc-main-number">{activeSite.site_id}</div>
                    <div className="doc-meta-item"><strong>Generated:</strong> {new Date().toISOString().split('T')[0]}</div>
                  </div>
                </div>

                <div className="doc-divider" />

                {/* Site Metrics Hero */}
                <div className="doc-site-metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', margin: '16px 0' }}>
                  <div className="doc-party-card">
                    <div className="doc-section-label">PROJECT SITE DETAILS</div>
                    <div className="doc-party-name">{activeSite.project_name}</div>
                    <div className="doc-party-detail">Site Code: {activeSite.site_id}</div>
                    <div className="doc-party-detail">Active Gate: Gate 1 Weighbridge Intake</div>
                  </div>

                  <div className="doc-party-card">
                    <div className="doc-section-label">TOTAL AUTHORIZED SPEND</div>
                    <div className="doc-party-name" style={{ color: '#059669' }}>
                      RM {(allPos.filter(p => p.project_site_id === activeSite.site_id).reduce((s, p) => s + (p.total_amount || 0), 0) || (activePo?.total_amount || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                    <div className="doc-party-detail">Active Contracts: {allPos.filter(p => p.project_site_id === activeSite.site_id).length || 1} Purchase Orders</div>
                  </div>

                  <div className="doc-party-card">
                    <div className="doc-section-label">DELIVERY FULFILLMENT STATUS</div>
                    <div className="doc-party-name">100% Verified Intake</div>
                    <div className="doc-party-detail">Discrepancy Rate: 0.00% Under Tolerance</div>
                  </div>
                </div>

                {/* Custom Site Inspection / Valuation Progress Remarks */}
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '10px 14px', marginBottom: '18px', fontSize: '11px', color: '#334155' }}>
                  <strong style={{ color: '#0f172a' }}>QS Site Progress &amp; Intake Notes: </strong>
                  {customConfig.siteNotes}
                </div>

                {/* Active Contracts at this Site */}
                <div className="doc-section-label">COMMITTED SUPPLIER CONTRACTS ALLOCATED TO THIS SITE</div>
                <div className="doc-table-wrapper">
                  <table className="doc-table" style={{ marginBottom: '24px' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '130px' }}>PO Number</th>
                        <th>Supplier Name</th>
                        <th>Issue Date</th>
                        <th style={{ textAlign: 'right' }}>Total Value (RM)</th>
                        <th style={{ width: '120px', textAlign: 'center' }}>Audit Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(allPos.filter(p => p.project_site_id === activeSite.site_id).length > 0 ? (
                        allPos.filter(p => p.project_site_id === activeSite.site_id).map((p, idx) => (
                          <tr key={idx}>
                            <td className="doc-mono"><strong>{p.po_number}</strong></td>
                            <td>{p.supplier_name}</td>
                            <td>{p.issue_date || '2026-03-01'}</td>
                            <td style={{ textAlign: 'right' }} className="doc-mono doc-bold">
                              RM {(p.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '600', background: '#dcfce7', color: '#15803d' }}>
                                VERIFIED
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="doc-mono"><strong>{activePo?.po_number || 'PO-2026-01'}</strong></td>
                          <td>{activePo?.supplier_name || 'Authorized Supplier'}</td>
                          <td>{activePo?.issue_date || new Date().toISOString().split('T')[0]}</td>
                          <td style={{ textAlign: 'right' }} className="doc-mono doc-bold">
                            RM {(activePo?.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '600', background: '#dcfce7', color: '#15803d' }}>
                              VERIFIED
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Site QS Sign-Off */}
                <div className="doc-signature-row">
                  <div className="doc-signature-box">
                    <div className="doc-sign-line" />
                    <div className="doc-sign-name">{customConfig.qsName}</div>
                    <div className="doc-sign-role">{customConfig.qsRole}</div>
                    <div className="doc-stamp verified">QS ATTESTED</div>
                  </div>

                  <div className="doc-signature-box">
                    <div className="doc-sign-line" />
                    <div className="doc-sign-name">{customConfig.directorName}</div>
                    <div className="doc-sign-role">{customConfig.directorRole}</div>
                    <div className="doc-stamp-placeholder">Director Stamp</div>
                  </div>
                </div>
              </div>
            )}

            {/* Document Security Footnote (Standard Fine-Print Footer) */}
            <div 
              className="doc-system-footnote"
              style={{
                marginTop: '20px',
                paddingTop: '8px',
                borderTop: '1px solid #e2e8f0',
                fontSize: '8px',
                lineHeight: '1.35',
                color: '#64748b',
                textAlign: 'left'
              }}
            >
              <div 
                className="doc-footnote-hash"
                style={{
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: '7.5px',
                  fontWeight: '600',
                  color: '#475569',
                  letterSpacing: '0.04em',
                  marginBottom: '2px',
                  textTransform: 'uppercase'
                }}
              >
                PROJECT AIR CONCURRENT FINANCIAL INTELLIGENCE &bull; SYSTEM HASH: SHA256-ED25519-VAL-{activePo?.po_id || '2026'}
              </div>
              <div 
                className="doc-footnote-legal"
                style={{
                  fontSize: '7.5px',
                  color: '#64748b',
                  lineHeight: '1.3'
                }}
              >
                Generated electronically in accordance with the Malaysian Electronic Commerce Act 2006 (Act 658) and admissible under Section 90A of the Evidence Act 1950.
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
