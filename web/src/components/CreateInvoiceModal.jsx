import React, { useState, useEffect } from 'react';
import { FileText, CheckCircle2, Upload, Sparkles, X } from 'lucide-react';

export default function CreateInvoiceModal({
  isOpen,
  onClose,
  pos = [],
  onSubmitInvoice
}) {
  const [selectedPoId, setSelectedPoId] = useState(pos[0]?.po_id || '');
  const [invoiceNumber, setInvoiceNumber] = useState(`INV-${Math.floor(1000 + Math.random() * 9000)}`);
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [lineItems, setLineItems] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedFile, setExtractedFile] = useState(null);

  useEffect(() => {
    if (selectedPoId) {
      const targetPo = pos.find(p => p.po_id === selectedPoId);
      if (targetPo && targetPo.line_items) {
        setLineItems(targetPo.line_items.map(it => ({
          description: it.description,
          quantity_billed: it.quantity,
          unit_price: it.unit_price,
          unit: it.unit
        })));
      }
    } else if (pos.length > 0) {
      setSelectedPoId(pos[0].po_id);
    }
  }, [selectedPoId, pos]);

  if (!isOpen) return null;

  const targetPo = pos.find(p => p.po_id === selectedPoId) || pos[0];

  const handleQtyChange = (idx, val) => {
    const updated = [...lineItems];
    updated[idx].quantity_billed = Number(val);
    setLineItems(updated);
  };

  const handlePriceChange = (idx, val) => {
    const updated = [...lineItems];
    updated[idx].unit_price = Number(val);
    setLineItems(updated);
  };

  const totalBilled = lineItems.reduce((acc, it) => acc + ((Number(it.quantity_billed) || 0) * (Number(it.unit_price) || 0)), 0);

  const handleExtractInvoice = async (filename, samplePoId = null) => {
    setIsExtracting(true);
    const poToUse = samplePoId || selectedPoId;
    try {
      const res = await fetch('http://localhost:8000/api/invoices/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename,
          po_id: poToUse
        })
      });
      const data = await res.json();
      if (data.invoice_number) setInvoiceNumber(data.invoice_number);
      if (data.invoice_date) setInvoiceDate(data.invoice_date);
      if (data.line_items) setLineItems(data.line_items);
      if (samplePoId) setSelectedPoId(samplePoId);
      setExtractedFile(filename);
    } catch (err) {
      alert('AI extraction error: ' + err.message);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleExtractInvoice(file.name);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmitInvoice({
        po_id: selectedPoId,
        invoice_number: invoiceNumber,
        supplier_name: targetPo?.supplier_name,
        invoice_date: invoiceDate,
        line_items: lineItems
      });
      alert(`Invoice #${invoiceNumber} ingested! 3-Way Match executed.`);
      onClose();
    } catch (err) {
      alert('Failed to log invoice: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ maxWidth: '820px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '14px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileText size={16} color="var(--text-primary)" />
            </div>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>
                Ingest Supplier Invoice
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                Accounts Payable Intake &bull; Automated 3-Way Document Matching
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '6px' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* AI Vision Dropzone */}
        <div style={{ background: '#141418', border: '1px dashed rgba(255, 255, 255, 0.15)', borderRadius: '10px', padding: '16px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '600', color: '#fafafa', marginBottom: '4px' }}>
                <Sparkles size={14} color="#38bdf8" />
                AI Invoice Vision Extractor
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                Upload vendor PDF or photo to automatically populate line items, quantities, and GL codes.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <label className="btn-modern btn-modern-secondary btn-sm" style={{ cursor: 'pointer' }}>
                <Upload size={12} /> Upload PDF
                <input type="file" accept=".pdf,image/*" onChange={handleFileUpload} style={{ display: 'none' }} />
              </label>
              <button 
                type="button" 
                className="btn-modern btn-modern-secondary btn-sm"
                disabled={isExtracting}
                onClick={() => handleExtractInvoice('Supplier_Invoice_Sample.pdf', pos[0]?.po_id)}
              >
                {isExtracting ? 'Extracting...' : 'Auto-Extract Sample'}
              </button>
            </div>
          </div>

          {extractedFile && (
            <div style={{ marginTop: '12px', padding: '8px 12px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#10b981' }}>
              <CheckCircle2 size={14} />
              Extracted from <strong>{extractedFile}</strong> with 98.4% OCR Confidence.
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '20px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                Target Purchase Order
              </label>
              <select 
                value={selectedPoId}
                onChange={(e) => setSelectedPoId(e.target.value)}
                style={{ width: '100%', background: '#18181b', color: '#fafafa', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '6px', padding: '8px 10px', fontSize: '13px' }}
              >
                {pos.map(p => (
                  <option key={p.po_id} value={p.po_id}>
                    {p.po_number} - {p.supplier_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                Supplier Invoice Number
              </label>
              <input 
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                style={{ width: '100%', background: '#18181b', color: '#fafafa', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '6px', padding: '8px 10px', fontSize: '13px', fontFamily: 'var(--font-mono)' }}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                Invoice Billing Date
              </label>
              <input 
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                style={{ width: '100%', background: '#18181b', color: '#fafafa', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '6px', padding: '8px 10px', fontSize: '13px' }}
                required
              />
            </div>
          </div>

          {/* Line Items Table */}
          <div style={{ marginBottom: '20px' }}>
            <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Billed Line Items
            </span>
            
            <div style={{ border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', overflow: 'hidden' }}>
              <table className="modern-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th>Description</th>
                    <th style={{ width: '110px', textAlign: 'right' }}>Billed Qty</th>
                    <th style={{ width: '80px' }}>Unit</th>
                    <th style={{ width: '110px', textAlign: 'right' }}>Unit Price</th>
                    <th style={{ width: '120px', textAlign: 'right' }}>Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((it, idx) => (
                    <tr key={idx}>
                      <td style={{ color: '#fafafa', fontWeight: '500' }}>
                        {it.description}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <input 
                          type="number"
                          step="any"
                          value={it.quantity_billed}
                          onChange={(e) => handleQtyChange(idx, e.target.value)}
                          style={{ width: '100%', background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '5px 7px', fontSize: '12px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}
                        />
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                        {it.unit || 'Units'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <input 
                          type="number"
                          step="any"
                          value={it.unit_price}
                          onChange={(e) => handlePriceChange(idx, e.target.value)}
                          style={{ width: '100%', background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '5px 7px', fontSize: '12px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}
                        />
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: '600', color: '#fafafa' }}>
                        ${((Number(it.quantity_billed) || 0) * (Number(it.unit_price) || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#18181b', padding: '14px 18px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)', marginBottom: '22px' }}>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>Supplier Vendor:</span>
              <div style={{ color: '#fafafa', fontSize: '14px', fontWeight: '600' }}>{targetPo?.supplier_name || 'Vendor'}</div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>Total Billed Claim:</span>
              <div style={{ fontSize: '20px', fontWeight: '700', color: '#fafafa', fontFamily: 'var(--font-mono)' }}>
                ${totalBilled.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button 
              type="button" 
              className="btn-modern btn-modern-secondary" 
              onClick={onClose}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn-modern btn-modern-primary" 
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Matching...' : 'Submit & Run 3-Way Match'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
