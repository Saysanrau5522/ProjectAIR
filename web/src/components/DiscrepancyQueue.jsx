import React, { useState } from 'react';
import { AlertTriangle, FileText, CheckSquare, X, Copy, Check } from 'lucide-react';

export default function DiscrepancyQueue({
  reconciliations = [],
  currentRole,
  actorId,
  onResolve,
  onDispute
}) {
  const discrepancyList = reconciliations.filter(r => r.match_status === 'DISCREPANCY_FLAGGED');
  const [activeResolveId, setActiveResolveId] = useState(null);
  const [resolveNotes, setResolveNotes] = useState('');
  const [activeDisputeNotice, setActiveDisputeNotice] = useState(null);
  const [copied, setCopied] = useState(false);

  return (
    <div className="modern-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertTriangle size={18} color="#ef4444" />
          </div>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>
              Flagged Discrepancies
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
              Quantity &amp; Pricing Variances &bull; Payments Automatically Halted
            </p>
          </div>
        </div>

        <div>
          <span className="modern-badge modern-badge-rose">
            {discrepancyList.length} Active {discrepancyList.length === 1 ? 'Variance' : 'Variances'}
          </span>
        </div>
      </div>

      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.5', marginBottom: '20px' }}>
        Invoices below contain quantities or unit prices that exceed signed Delivery Orders or authorized contract purchase orders. Disbursement is blocked to prevent overpayment leakage until officially resolved or disputed.
      </p>

      {discrepancyList.length === 0 ? (
        <div style={{ background: '#141418', borderRadius: '8px', padding: '32px', textAlign: 'center', border: '1px solid rgba(255, 255, 255, 0.08)', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)', marginBottom: '4px' }}>
            Zero Discrepancies
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
            All active invoices reconcile cleanly against verified delivery slips.
          </p>
        </div>
      ) : (
        <div style={{ border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', overflow: 'hidden' }}>
          <table className="modern-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>PO Reference</th>
                <th>Supplier</th>
                <th>Invoice #</th>
                <th style={{ textAlign: 'right' }}>Billed Amount</th>
                <th style={{ textAlign: 'right' }}>Overpayment Blocked</th>
                <th>Mismatch Type</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {discrepancyList.map((rec) => {
                const primaryIssue = rec.items?.find(it => it.discrepancy_type && it.discrepancy_type !== 'NONE');
                return (
                  <tr key={rec.reconciliation_id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: '600', color: '#fafafa' }}>
                      {rec.po_number}
                    </td>
                    <td style={{ color: '#fafafa', fontWeight: '500' }}>{rec.supplier_name}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>#{rec.invoice_number}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: '#fafafa' }}>
                      ${(rec.invoice_amount || rec.total_billed_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: '700', color: '#ef4444' }}>
                      ${Number(rec.total_overpayment_blocked || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td>
                      <span className="modern-badge modern-badge-rose">
                        {primaryIssue?.discrepancy_type || 'QUANTITY_VARIANCE'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <button
                          type="button"
                          className="btn-modern btn-modern-secondary btn-sm"
                          onClick={() => {
                            setActiveDisputeNotice(rec.dispute_notice);
                            setCopied(false);
                          }}
                        >
                          <FileText size={12} /> Dispute Notice
                        </button>
                        <button
                          type="button"
                          className="btn-modern btn-modern-primary btn-sm"
                          onClick={() => {
                            setActiveResolveId(rec.reconciliation_id);
                            setResolveNotes('');
                          }}
                        >
                          <CheckSquare size={12} /> Resolve
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Resolution Modal */}
      {activeResolveId && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: '600px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>
                Resolve Overbilling Discrepancy
              </h3>
              <button 
                type="button"
                onClick={() => setActiveResolveId(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '14px' }}>
              Document the agreed vendor credit note reference or contractor adjustment for the audit trail.
            </p>

            <textarea
              style={{ width: '100%', height: '100px', background: '#18181b', color: '#fff', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '6px', padding: '10px', fontSize: '13px', marginBottom: '18px', resize: 'vertical' }}
              placeholder="e.g. Vendor issued Credit Note CN-8821 for 200 missing bags. Short-pay release authorized."
              value={resolveNotes}
              onChange={(e) => setResolveNotes(e.target.value)}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button 
                type="button" 
                className="btn-modern btn-modern-secondary" 
                onClick={() => setActiveResolveId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-modern btn-modern-primary"
                onClick={() => {
                  if (!resolveNotes.trim()) {
                    alert('Please enter resolution explanation.');
                    return;
                  }
                  onResolve(activeResolveId, resolveNotes);
                  setActiveResolveId(null);
                }}
              >
                Submit Resolution
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dispute Notice Modal */}
      {activeDisputeNotice && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: '640px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>
                Formal Vendor Payment Dispute Notice
              </h3>
              <button 
                type="button"
                onClick={() => setActiveDisputeNotice(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ background: '#09090b', padding: '14px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)', marginBottom: '18px' }}>
              <pre style={{ whiteSpace: 'pre-wrap', color: '#fafafa', fontSize: '12px', margin: 0, fontFamily: 'var(--font-mono)', lineHeight: 1.5 }}>
                {activeDisputeNotice}
              </pre>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn-modern btn-modern-secondary"
                onClick={() => {
                  navigator.clipboard.writeText(activeDisputeNotice);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Copied' : 'Copy Notice'}
              </button>
              <button 
                type="button" 
                className="btn-modern btn-modern-primary" 
                onClick={() => setActiveDisputeNotice(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
