import React, { useState } from 'react';
import { 
  AlertTriangle, 
  CheckCircle2, 
  ShieldAlert, 
  FileText, 
  Send, 
  CheckSquare, 
  Eye, 
  Lock, 
  Download, 
  Mail, 
  DollarSign, 
  Split,
  ChevronRight,
  ExternalLink,
  Layers,
  Building,
  Printer
} from 'lucide-react';

export default function MatchMatrix({
  reconciliations = [],
  currentRole,
  actorId,
  onResolve,
  onApprove,
  onApprovePartial,
  onDispute,
  onDispatchDispute,
  onExportErp,
  onViewDoc,
  onOpenDocModal
}) {
  const [selectedRecId, setSelectedRecId] = useState(reconciliations[0]?.reconciliation_id || null);
  const [disputeModalOpen, setDisputeModalOpen] = useState(false);
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [shortPayModalOpen, setShortPayModalOpen] = useState(false);
  const [vendorEmail, setVendorEmail] = useState('');
  const [resolveNotes, setResolveNotes] = useState('');
  const [disputeReason, setDisputeReason] = useState('');

  const activeRec = reconciliations.find(r => r.reconciliation_id === selectedRecId) || reconciliations[0];

  if (!activeRec) {
    return (
      <div className="modern-card" style={{ textAlign: 'center', padding: '64px 24px' }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <Layers size={24} color="#3b82f6" />
        </div>
        <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#FFF', marginBottom: '8px' }}>
          No Active Reconciliations
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', maxWidth: '460px', margin: '0 auto 20px', lineHeight: 1.5 }}>
          The 3-way reconciliation ledger is clean and ready. Add a Purchase Order from HQ, capture a signed Delivery Order via the Site PWA, or upload a Vendor Invoice to trigger automated real-time matching.
        </p>
      </div>
    );
  }

  const isResolvedByCurrentActor = activeRec.resolved_by && activeRec.resolved_by === actorId;

  // Calculate short-pay verified total vs withheld variance
  const verifiedTotal = (activeRec.items || []).reduce((acc, it) => {
    return acc + (it.verified_payable_amount !== undefined ? it.verified_payable_amount : Math.min(it.cumulative_delivered_qty, it.cumulative_billed_qty) * it.po_unit_price);
  }, 0);
  const blockedTotal = activeRec.total_overpayment_blocked || 0;

  return (
    <div>
      {/* Top Header Card */}
      <div className="modern-card">
        <div className="modern-card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: '280px' }}>
            <Layers size={18} color="var(--accent-blue)" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>
                Active Reconciliation Audit
              </div>
              <select 
                className="form-select"
                style={{ marginTop: '4px', maxWidth: '440px', fontWeight: '500' }}
                value={activeRec.reconciliation_id}
                onChange={(e) => setSelectedRecId(e.target.value)}
              >
                {reconciliations.map(r => (
                  <option key={r.reconciliation_id} value={r.reconciliation_id}>
                    [{r.match_status}] {r.po_number} // {r.supplier_name} (Inv #{r.invoice_number})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Action Tools & Status Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {onOpenDocModal && (
              <button 
                className="btn btn-primary btn-sm" 
                onClick={() => onOpenDocModal({ initialDocType: 'AUDIT_VOUCHER', reconciliation: activeRec })}
                title="Export official audited 3-way match payment voucher PDF"
                style={{ background: '#059669', borderColor: '#059669', color: '#fff' }}
              >
                <Printer size={13} /> Export Audit Voucher (PDF)
              </button>
            )}

            {onExportErp && (
              <button className="btn btn-outline btn-sm" onClick={onExportErp} title="Download standard CSV disbursement batch for accounting">
                <Download size={13} /> Export to ERP (CSV)
              </button>
            )}

            {activeRec.match_status === 'DISCREPANCY_FLAGGED' && (
              <span className="status-pill pill-rose">
                <AlertTriangle size={12} /> Discrepancy (${blockedTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} Blocked)
              </span>
            )}
            {activeRec.match_status === 'PARTIALLY_APPROVED' && (
              <span className="status-pill pill-green">
                <Split size={12} /> Short-Pay Approved (${verifiedTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} Released)
              </span>
            )}
            {activeRec.match_status === 'READY_FOR_APPROVAL' && (
              <span className="status-pill pill-green">
                <CheckCircle2 size={12} /> 100% 3-Way Matched
              </span>
            )}
            {activeRec.match_status === 'APPROVED' && (
              <span className="status-pill pill-green">
                <Lock size={12} /> Approved &amp; Locked
              </span>
            )}
            {activeRec.match_status === 'DISPUTED' && (
              <span className="status-pill pill-rose">
                <ShieldAlert size={12} /> Dispute Filed
              </span>
            )}
            {activeRec.match_status === 'NEEDS_REVIEW' && (
              <span className="status-pill pill-yellow">
                <Eye size={12} /> Awaiting OCR Check (&lt;85%)
              </span>
            )}
          </div>
        </div>

        {/* Metadata Summary Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', padding: '18px 24px', backgroundColor: 'rgba(0,0,0,0.15)' }}>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Job Site</div>
            <div style={{ fontWeight: '600', color: '#FFF', fontSize: '14px', marginTop: '2px' }}>
              {activeRec.project_name}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--accent-blue)', fontFamily: 'JetBrains Mono' }}>
              {activeRec.project_site_id}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Supplier Vendor</div>
            <div style={{ fontWeight: '600', color: '#FFF', fontSize: '14px', marginTop: '2px' }}>
              {activeRec.supplier_name}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Verified Trade Contractor</div>
          </div>

          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>PO Contract Value</div>
            <div className="tabular-nums" style={{ fontWeight: '600', color: 'var(--accent-blue)', fontSize: '15px', marginTop: '2px' }}>
              ${(activeRec.total_po_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Ref: {activeRec.po_number}</div>
          </div>

          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Invoice Billed Claim</div>
            <div className="tabular-nums" style={{ fontWeight: '600', color: activeRec.has_discrepancy ? 'var(--accent-amber)' : '#FFF', fontSize: '15px', marginTop: '2px' }}>
              ${(activeRec.invoice_amount || activeRec.total_billed_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Invoice #{activeRec.invoice_number}</div>
          </div>
        </div>

        {/* 3-Way Match Line-Item Inspector Table */}
        <div className="modern-table-wrapper">
          <table className="modern-table">
            <thead>
              <tr>
                <th>Item Description &amp; GL Code</th>
                <th style={{ textAlign: 'right' }}>PO Ordered</th>
                <th style={{ textAlign: 'right' }}>PO Price</th>
                <th style={{ textAlign: 'right' }}>Site Delivered (DOs)</th>
                <th style={{ textAlign: 'right' }}>Billed (INV)</th>
                <th style={{ textAlign: 'right' }}>Billed Price</th>
                <th style={{ textAlign: 'right' }}>Variance</th>
                <th style={{ textAlign: 'right' }}>Overpayment Blocked</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(activeRec.items || []).map((item, idx) => {
                const isDiscrepant = item.discrepancy_type && item.discrepancy_type !== 'NONE';
                return (
                  <tr key={idx} className={isDiscrepant ? 'row-flagged' : ''}>
                    <td>
                      <div style={{ fontWeight: '600', color: '#FFF' }}>
                        {item.description}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                        {item.gl_code && (
                          <span className="gl-code-badge" title={item.gl_category}>
                            GL: {item.gl_code}
                          </span>
                        )}
                        {item.gl_category && (
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {item.gl_category}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="tabular-nums" style={{ textAlign: 'right' }}>
                      {item.ordered_qty} {item.unit || ''}
                    </td>

                    <td className="tabular-nums" style={{ textAlign: 'right' }}>
                      ${Number(item.po_unit_price).toFixed(2)}
                    </td>

                    <td className="tabular-nums" style={{ textAlign: 'right', color: isDiscrepant ? 'var(--accent-amber)' : 'var(--accent-emerald)', fontWeight: '600' }}>
                      {item.cumulative_delivered_qty} {item.unit || ''}
                    </td>

                    <td className="tabular-nums" style={{ textAlign: 'right', fontWeight: '600', color: isDiscrepant ? 'var(--accent-amber)' : '#FFF' }}>
                      {item.cumulative_billed_qty} {item.unit || ''}
                    </td>

                    <td className="tabular-nums" style={{ textAlign: 'right' }}>
                      ${Number(item.billed_unit_price).toFixed(2)}
                    </td>

                    <td className="tabular-nums" style={{ textAlign: 'right', color: item.variance_qty > 0 ? 'var(--accent-amber)' : 'var(--text-muted)' }}>
                      {item.variance_qty > 0 ? `+${item.variance_qty}` : item.variance_qty}
                    </td>

                    <td className="tabular-nums" style={{ textAlign: 'right', fontWeight: '600', color: item.overpayment_amount > 0 ? 'var(--accent-amber)' : 'var(--text-muted)' }}>
                      {item.overpayment_amount > 0 ? `$${Number(item.overpayment_amount).toFixed(2)}` : '$0.00'}
                    </td>

                    <td>
                      {item.discrepancy_type === 'QUANTITY_OVERBILLING' && (
                        <span className="status-pill pill-rose">Overbilling</span>
                      )}
                      {item.discrepancy_type === 'PRICE_MARKUP' && (
                        <span className="status-pill pill-rose">Price Markup</span>
                      )}
                      {item.discrepancy_type === 'UNRECEIVED_MATERIAL' && (
                        <span className="status-pill pill-rose">Unreceived</span>
                      )}
                      {(!item.discrepancy_type || item.discrepancy_type === 'NONE') && (
                        <span className="status-pill pill-green">Matched</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Action Controls Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', borderTop: '1px solid var(--border-subtle)', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {activeRec.dispute_notice && (
              <button 
                className="btn btn-outline btn-sm"
                onClick={() => {
                  setDisputeReason(activeRec.dispute_notice);
                  setDisputeModalOpen(true);
                }}
              >
                <FileText size={14} /> Dispute Notice &amp; Email
              </button>
            )}

            {activeRec.match_status === 'DISCREPANCY_FLAGGED' && (
              <>
                <button 
                  className="btn btn-emerald btn-sm"
                  onClick={() => setShortPayModalOpen(true)}
                >
                  <Split size={14} /> Approve Verified (${verifiedTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}) &amp; Dispute Variance
                </button>

                <button 
                  className="btn btn-outline btn-sm"
                  onClick={() => setResolveModalOpen(true)}
                  title="Resolve discrepancy by registering vendor credit note adjustment"
                >
                  Resolve Discrepancy (Credit Note)
                </button>
              </>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {activeRec.match_status === 'READY_FOR_APPROVAL' && (
              <button 
                className="btn btn-primary btn-sm"
                onClick={() => onApprove(activeRec.reconciliation_id)}
                title="Approve invoice for immediate bank disbursement"
              >
                <CheckCircle2 size={14} /> Approve Payout (${(activeRec.invoice_amount || activeRec.total_billed_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })})
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Short-Pay Modal */}
      {shortPayModalOpen && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Split size={18} color="var(--accent-emerald)" />
                <h3>Partial Payment Authorization (Short-Pay Voucher)</h3>
              </div>
              <button className="modal-close-btn" onClick={() => setShortPayModalOpen(false)}>&times;</button>
            </div>

            <div className="modal-body">
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '0 0 16px 0' }}>
                Release verified deliveries immediately to protect job-site supplier credit, while withholding unverified variance under an automated debit note.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid var(--accent-emerald-border)', padding: '14px', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Verified Deliveries Authorized</div>
                  <div className="tabular-nums" style={{ fontSize: '20px', fontWeight: '700', color: 'var(--accent-emerald)', marginTop: '4px' }}>
                    ${verifiedTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                </div>

                <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid var(--accent-rose-border)', padding: '14px', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Withheld Disputed Variance</div>
                  <div className="tabular-nums" style={{ fontSize: '20px', fontWeight: '700', color: 'var(--accent-rose)', marginTop: '4px' }}>
                    ${blockedTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              <div style={{ background: 'var(--bg-surface-elevated)', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', fontSize: '12px', color: 'var(--text-muted)' }}>
                Debit note reference will be registered in the immutable audit trail and exported to the ERP batch.
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShortPayModalOpen(false)}>Cancel</button>
              <button 
                className="btn btn-emerald"
                onClick={() => {
                  onApprovePartial(activeRec.reconciliation_id);
                  setShortPayModalOpen(false);
                }}
              >
                Confirm Short-Pay Authorization
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dispute Notice Modal */}
      {disputeModalOpen && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={18} color="var(--accent-amber)" />
                <h3>Formal Payment Dispute Notice</h3>
              </div>
              <button className="modal-close-btn" onClick={() => setDisputeModalOpen(false)}>&times;</button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Vendor AR Contact Email</label>
                <input 
                  type="email" 
                  className="form-input" 
                  placeholder="e.g. ar-disputes@vendor.com"
                  value={vendorEmail}
                  onChange={(e) => setVendorEmail(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Audit Dispute Notice Content</label>
                <textarea 
                  className="form-textarea" 
                  rows={6}
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDisputeModalOpen(false)}>Close</button>
              <button 
                className="btn btn-primary"
                onClick={() => {
                  if (onDispatchDispute) onDispatchDispute(activeRec.reconciliation_id, vendorEmail);
                  setDisputeModalOpen(false);
                }}
              >
                <Mail size={14} /> Send Email Notice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resolve Discrepancy Modal */}
      {resolveModalOpen && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3>Resolve Reconciliation Discrepancy</h3>
              <button className="modal-close-btn" onClick={() => setResolveModalOpen(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Resolution Notes / Supplier Agreement Reference</label>
                <textarea 
                  className="form-textarea"
                  placeholder="e.g. Supplier issued Credit Note CN-2026-088 for 200 bags shortage..."
                  value={resolveNotes}
                  onChange={(e) => setResolveNotes(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setResolveModalOpen(false)}>Cancel</button>
              <button 
                className="btn btn-primary"
                onClick={() => {
                  onResolve(activeRec.reconciliation_id, resolveNotes);
                  setResolveModalOpen(false);
                }}
              >
                Save Resolution
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
