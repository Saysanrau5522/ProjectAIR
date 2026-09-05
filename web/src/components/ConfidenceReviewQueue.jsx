import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, Eye, X, FileText, Check } from 'lucide-react';

export default function ConfidenceReviewQueue({
  reconciliations = [],
  onConfirmLowConfidence
}) {
  const needsReviewRecs = reconciliations.filter(r => r.match_status === 'NEEDS_REVIEW');
  const [selectedDo, setSelectedDo] = useState(null);
  const [adjustedQty, setAdjustedQty] = useState(0);

  const handleOpenInspect = (rec) => {
    const firstItem = rec.items?.[0] || {};
    const qty = firstItem.delivered_qty || firstItem.po_qty || 100;
    setAdjustedQty(qty);
    setSelectedDo({
      do_id: rec.do_number || `DO-REV-${rec.reconciliation_id.slice(-4)}`,
      po_number: rec.po_number,
      supplier: rec.supplier_name,
      project_name: rec.project_name,
      imageUrl: '/crumpled_dirty_do.png',
      description: firstItem.description || 'Raw Construction Materials',
      quantity: qty,
      unit: firstItem.unit || 'Units',
      confidence: (rec.confidence_score ? (rec.confidence_score * 100).toFixed(0) : '72') + '%'
    });
  };

  return (
    <div className="modern-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertCircle size={18} color="#f59e0b" />
          </div>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>
              AI Confidence Review Queue
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
              Human-in-the-Loop OCR Triage &bull; Sub-85% Confidence Document Inspection
            </p>
          </div>
        </div>

        <div>
          <span className="modern-badge modern-badge-amber">
            {needsReviewRecs.length} Flagged {needsReviewRecs.length === 1 ? 'Ticket' : 'Tickets'}
          </span>
        </div>
      </div>

      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.5', marginBottom: '20px' }}>
        Physical Delivery Orders captured on construction sites with crumpled paper, dirty grease marks, or handwritten scribbles that score below the 85% AI Confidence Threshold are routed here for human operator validation before entering the financial payment ledger.
      </p>

      {needsReviewRecs.length === 0 ? (
        <div style={{ background: '#141418', borderRadius: '8px', padding: '32px', textAlign: 'center', border: '1px solid rgba(255, 255, 255, 0.08)', color: 'var(--text-muted)' }}>
          <CheckCircle2 size={32} color="#10b981" style={{ margin: '0 auto 10px', opacity: 0.8 }} />
          <div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)', marginBottom: '4px' }}>
            Queue Clean
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
            All active site delivery tickets exceed the &ge;85% AI vision confidence threshold.
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
                <th style={{ textAlign: 'center' }}>AI Confidence</th>
                <th>Triage Reason</th>
                <th style={{ textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {needsReviewRecs.map(rec => {
                const confScore = rec.confidence_score ? (rec.confidence_score * 100).toFixed(1) : '72.0';
                return (
                  <tr key={rec.reconciliation_id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: '600', color: '#fafafa' }}>
                      {rec.po_number}
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{rec.project_name}</td>
                    <td style={{ color: '#fafafa', fontWeight: '500' }}>{rec.supplier_name}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="modern-badge modern-badge-amber">
                        {confScore}% (&lt; 85% Threshold)
                      </span>
                    </td>
                    <td style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                      {rec.resolution_notes || 'Handwritten / degraded field detected in site scan'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button 
                        type="button"
                        className="btn-modern btn-modern-secondary btn-sm"
                        onClick={() => handleOpenInspect(rec)}
                      >
                        <Eye size={13} /> Inspect Scan
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Side-by-Side Human Verification Modal */}
      {selectedDo && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: '880px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', paddingBottom: '12px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>
                  OCR Document Verification &bull; {selectedDo.do_id}
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                  PO Reference: {selectedDo.po_number} &bull; Supplier: {selectedDo.supplier}
                </p>
              </div>
              <button 
                type="button"
                onClick={() => setSelectedDo(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '22px' }}>
              {/* Original Document Photo */}
              <div style={{ background: '#09090b', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '10px', padding: '14px' }}>
                <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileText size={14} color="#38bdf8" />
                  Site Photograph (Encrypted Storage)
                </div>
                <div style={{ maxHeight: '360px', overflow: 'hidden', display: 'flex', justifyContent: 'center', background: '#141418', borderRadius: '6px', padding: '10px' }}>
                  <img 
                    src={selectedDo.imageUrl} 
                    alt="Physical DO captured on site" 
                    style={{ width: '100%', maxHeight: '340px', objectFit: 'contain', borderRadius: '4px' }} 
                  />
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
                  Captured on job site &bull; Encrypted SHA-256 Digest
                </div>
              </div>

              {/* AI Extraction & Human Correction Fields */}
              <div style={{ background: '#141418', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '10px', padding: '18px' }}>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#f59e0b', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertCircle size={15} />
                  AI Extraction (Requires Confirmation)
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Supplier Name (82% Confidence)
                  </label>
                  <input 
                    type="text" 
                    defaultValue={selectedDo.supplier} 
                    style={{ width: '100%', background: '#18181b', color: '#fff', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '6px', padding: '7px 10px', fontSize: '13px' }}
                  />
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    PO Reference Number (91% Confidence)
                  </label>
                  <input 
                    type="text" 
                    defaultValue={selectedDo.po_number} 
                    style={{ width: '100%', background: '#18181b', color: '#fff', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '6px', padding: '7px 10px', fontSize: '13px', fontFamily: 'var(--font-mono)' }}
                  />
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Material Description (76% Confidence)
                  </label>
                  <input 
                    type="text" 
                    defaultValue={selectedDo.description} 
                    style={{ width: '100%', background: '#18181b', color: '#fff', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '6px', padding: '7px 10px', fontSize: '13px' }}
                  />
                </div>

                <div style={{ marginBottom: '18px' }}>
                  <label style={{ fontSize: '12px', color: '#f59e0b', fontWeight: '600', display: 'block', marginBottom: '4px' }}>
                    Verified Delivered Quantity ({selectedDo.unit}):
                  </label>
                  <input 
                    type="number" 
                    value={adjustedQty} 
                    onChange={(e) => setAdjustedQty(Number(e.target.value))}
                    style={{ width: '100%', background: '#18181b', color: '#fafafa', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '6px', padding: '8px 10px', fontSize: '16px', fontWeight: '600', fontFamily: 'var(--font-mono)' }}
                  />
                </div>

                <button 
                  type="button"
                  className="btn-modern btn-modern-primary"
                  style={{ width: '100%' }}
                  onClick={() => {
                    onConfirmLowConfidence(selectedDo.do_id);
                    setSelectedDo(null);
                  }}
                >
                  <Check size={14} /> Confirm &amp; Release to 3-Way Match
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                type="button" 
                className="btn-modern btn-modern-secondary" 
                onClick={() => setSelectedDo(null)}
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
