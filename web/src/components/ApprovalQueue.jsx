import React from 'react';
import { CheckCircle2, Lock, ShieldCheck, AlertCircle } from 'lucide-react';

export default function ApprovalQueue({
  reconciliations = [],
  currentRole,
  actorId,
  onApprove
}) {
  const readyList = reconciliations.filter(r => r.match_status === 'READY_FOR_APPROVAL');
  const approvedList = reconciliations.filter(r => r.match_status === 'APPROVED' || r.match_status === 'PARTIALLY_APPROVED');

  return (
    <div className="modern-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={18} color="#10b981" />
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>
                Payment Approval Queue
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                100% 3-Way Reconciled &bull; Ready for Financial Controller Sign-Off
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="modern-badge modern-badge-emerald">
            {readyList.length} {readyList.length === 1 ? 'Invoice' : 'Invoices'} Ready
          </span>
        </div>
      </div>

      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.5', marginBottom: '20px' }}>
        These disbursements have been verified against active site Delivery Orders and authorized Purchase Orders. Final payment approval requires independent Checker review and locks the records in the immutable ledger.
      </p>

      {readyList.length === 0 ? (
        <div style={{ background: '#141418', borderRadius: '8px', padding: '32px', textAlign: 'center', border: '1px solid rgba(255, 255, 255, 0.08)', color: 'var(--text-muted)' }}>
          <ShieldCheck size={32} color="#10b981" style={{ margin: '0 auto 10px', opacity: 0.8 }} />
          <div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)', marginBottom: '4px' }}>
            All Invoices Processed
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
            There are currently no matched invoices awaiting release sign-off.
          </p>
        </div>
      ) : (
        <div style={{ border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', overflow: 'hidden' }}>
          <table className="modern-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>PO Reference</th>
                <th>Project Site</th>
                <th>Supplier</th>
                <th>Invoice #</th>
                <th style={{ textAlign: 'right' }}>Total Amount</th>
                <th>Reconciliation Notes</th>
                <th style={{ textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {readyList.map((rec) => {
                const isResolvedByCurrentActor = rec.resolved_by && rec.resolved_by === actorId;
                return (
                  <tr key={rec.reconciliation_id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: '600', color: '#fafafa' }}>
                      {rec.po_number}
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{rec.project_name}</td>
                    <td style={{ color: '#fafafa', fontWeight: '500' }}>{rec.supplier_name}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>#{rec.invoice_number}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: '700', color: '#10b981', fontSize: '14px' }}>
                      ${(rec.invoice_amount || rec.total_billed_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ fontSize: '13px', color: rec.resolution_notes ? '#f59e0b' : 'var(--text-muted)' }}>
                      {rec.resolution_notes ? `Resolved by ${rec.resolved_by}: ${rec.resolution_notes}` : 'Automated 100% Match'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {isResolvedByCurrentActor ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)', padding: '4px 8px', borderRadius: '4px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                          <AlertCircle size={12} /> Maker-Checker Segregated
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="btn-modern btn-modern-primary btn-sm"
                          onClick={() => onApprove(rec.reconciliation_id)}
                        >
                          <Lock size={12} /> Approve &amp; Lock
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Approved / Locked Archives */}
      {approvedList.length > 0 && (
        <div style={{ marginTop: '36px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <Lock size={15} color="var(--text-muted)" />
            <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Approved &amp; Locked Records Archive
            </h3>
          </div>
          <div style={{ border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', overflow: 'hidden' }}>
            <table className="modern-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th>PO Reference</th>
                  <th>Supplier</th>
                  <th>Invoice #</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th>Approved By</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {approvedList.map(rec => (
                  <tr key={rec.reconciliation_id}>
                    <td style={{ fontFamily: 'var(--font-mono)', color: '#fafafa' }}>{rec.po_number}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{rec.supplier_name}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>#{rec.invoice_number}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: '600', color: '#10b981' }}>
                      ${(rec.invoice_amount || rec.total_billed_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{rec.approved_by}</td>
                    <td>
                      {rec.match_status === 'PARTIALLY_APPROVED' ? (
                        <span className="modern-badge modern-badge-emerald">Short-Pay Voucher</span>
                      ) : (
                        <span className="modern-badge modern-badge-emerald">Approved &amp; Locked</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
