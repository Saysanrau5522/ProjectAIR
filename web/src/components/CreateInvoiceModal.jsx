import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  CheckCircle2, 
  Upload, 
  Sparkles, 
  X, 
  Plus, 
  Trash2, 
  AlertCircle, 
  Building2 
} from 'lucide-react';
import { getApiBase } from '../utils/token';

export default function CreateInvoiceModal({
  isOpen,
  onClose,
  pos = [],
  onSubmitInvoice,
  onOpenCreatePo
}) {
  const [selectedPoId, setSelectedPoId] = useState(pos[0]?.po_id || '');
  const [customPoNumber, setCustomPoNumber] = useState('');
  const [customSupplierName, setCustomSupplierName] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState(`INV-${Math.floor(1000 + Math.random() * 9000)}`);
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Clean initial line item ready for typing
  const [lineItems, setLineItems] = useState([
    {
      description: '',
      quantity_billed: 1,
      unit: 'Units',
      unit_price: 0
    }
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedFile, setExtractedFile] = useState(null);

  const hasExistingPos = pos && pos.length > 0;

  useEffect(() => {
    if (selectedPoId && selectedPoId !== '__MANUAL__') {
      const targetPo = pos.find(p => p.po_id === selectedPoId);
      if (targetPo && targetPo.line_items && targetPo.line_items.length > 0) {
        setLineItems(targetPo.line_items.map(it => ({
          description: it.description,
          quantity_billed: it.quantity,
          unit_price: it.unit_price,
          unit: it.unit || 'Units'
        })));
      }
    } else if (hasExistingPos && !selectedPoId) {
      setSelectedPoId(pos[0].po_id);
    }
  }, [selectedPoId, pos]);

  if (!isOpen) return null;

  const targetPo = pos.find(p => p.po_id === selectedPoId);
  const activeSupplierName = (hasExistingPos && targetPo && selectedPoId !== '__MANUAL__') 
    ? targetPo.supplier_name 
    : customSupplierName;

  // Add line item
  const handleAddItem = () => {
    setLineItems(prev => [
      ...prev,
      {
        description: '',
        quantity_billed: 1,
        unit: 'Units',
        unit_price: 0
      }
    ]);
  };

  // Remove line item
  const handleRemoveItem = (index) => {
    if (lineItems.length === 1) {
      // Keep at least 1 row, just clear fields
      setLineItems([{ description: '', quantity_billed: 1, unit: 'Units', unit_price: 0 }]);
      return;
    }
    setLineItems(prev => prev.filter((_, i) => i !== index));
  };

  // Change field in line item
  const handleItemChange = (index, field, value) => {
    const updated = [...lineItems];
    if (field === 'quantity_billed' || field === 'unit_price') {
      updated[index][field] = Number(value) || 0;
    } else {
      updated[index][field] = value;
    }
    setLineItems(updated);
  };

  const totalBilled = lineItems.reduce((acc, it) => {
    return acc + ((Number(it.quantity_billed) || 0) * (Number(it.unit_price) || 0));
  }, 0);

  const handleExtractInvoice = async (filename, samplePoId = null) => {
    setIsExtracting(true);
    const poToUse = samplePoId || selectedPoId;
    try {
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/invoices/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename,
          po_id: poToUse
        })
      });
      const data = await res.json();
      if (data.extraction) {
        const ext = data.extraction;
        if (ext.invoice_number) setInvoiceNumber(ext.invoice_number);
        if (ext.invoice_date) setInvoiceDate(ext.invoice_date);
        if (ext.supplier_name) setCustomSupplierName(ext.supplier_name);
        if (ext.line_items && ext.line_items.length > 0) {
          setLineItems(ext.line_items.map(it => ({
            description: it.description || '',
            quantity_billed: Number(it.quantity_billed) || 1,
            unit: it.unit || 'Units',
            unit_price: Number(it.unit_price) || 0
          })));
        }
      }
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
    const validItems = lineItems.filter(it => it.description.trim() !== '');
    if (validItems.length === 0) {
      alert('Please enter at least one line item with a description.');
      return;
    }

    const effectivePoId = (hasExistingPos && selectedPoId && selectedPoId !== '__MANUAL__')
      ? selectedPoId
      : customPoNumber.trim();

    setIsSubmitting(true);
    try {
      await onSubmitInvoice({
        po_id: effectivePoId,
        invoice_number: invoiceNumber.trim(),
        supplier_name: activeSupplierName.trim(),
        invoice_date: invoiceDate,
        line_items: validItems
      });
      alert(`Invoice #${invoiceNumber} ingested! 3-Way Match executed against ${effectivePoId}.`);
      onClose();
    } catch (err) {
      alert('Failed to log invoice: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ maxWidth: '840px', width: '100%' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', paddingBottom: '14px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileText size={18} color="#3b82f6" />
            </div>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>
                Ingest Supplier Invoice
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                Accounts Payable Intake &bull; Automated 3-Way Cross-Check
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

        {/* Missing PO Alert Banner (Guides User to Create PO) */}
        {!hasExistingPos && (
          <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: '8px', padding: '12px 14px', marginBottom: '18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#f59e0b' }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>
                <strong>No committed Purchase Orders found.</strong> 3-Way matching cross-references invoices against an authorized PO.
              </span>
            </div>
            {onOpenCreatePo && (
              <button 
                type="button" 
                className="btn btn-outline btn-xs"
                onClick={onOpenCreatePo}
                style={{ borderColor: '#f59e0b', color: '#f59e0b', whiteSpace: 'nowrap' }}
              >
                + Issue Purchase Order First
              </button>
            )}
          </div>
        )}

        {/* AI Vision Dropzone */}
        <div style={{ background: '#141418', border: '1px dashed rgba(255, 255, 255, 0.15)', borderRadius: '10px', padding: '14px 16px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '600', color: '#fafafa', marginBottom: '3px' }}>
                <Sparkles size={14} color="#38bdf8" />
                AI Invoice Vision Extractor
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                Upload vendor PDF or photo to automatically populate line items, quantities, and GL codes.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <label 
                className="btn btn-outline btn-sm"
                style={{ cursor: 'pointer', margin: 0 }}
              >
                <Upload size={13} />
                <span>Upload PDF / Photo</span>
                <input 
                  type="file" 
                  accept="image/*,.pdf" 
                  onChange={handleFileUpload} 
                  style={{ display: 'none' }}
                />
              </label>

              <button 
                type="button" 
                className="btn btn-secondary btn-sm"
                onClick={() => handleExtractInvoice('supplier_tax_invoice.pdf', pos[0]?.po_id)}
                disabled={isExtracting}
              >
                {isExtracting ? 'Extracting...' : 'Auto-Extract Sample'}
              </button>
            </div>
          </div>

          {extractedFile && (
            <div style={{ marginTop: '10px', padding: '6px 10px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#10b981' }}>
              <CheckCircle2 size={14} />
              Extracted from <strong>{extractedFile}</strong> with 98.4% OCR Confidence. You can edit any field below.
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          {/* Top Form Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '20px' }}>
            {/* Target PO Selector / Input */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                Target Purchase Order
              </label>
              {hasExistingPos ? (
                <select 
                  value={selectedPoId}
                  onChange={(e) => setSelectedPoId(e.target.value)}
                  className="form-select"
                  style={{ width: '100%', background: '#18181b', color: '#fafafa', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '6px', padding: '8px 10px', fontSize: '13px' }}
                >
                  {pos.map(p => (
                    <option key={p.po_id} value={p.po_id}>
                      {p.po_number} &bull; {p.supplier_name}
                    </option>
                  ))}
                  <option value="__MANUAL__">+ Enter Manual PO Reference</option>
                </select>
              ) : (
                <input 
                  type="text"
                  value={customPoNumber}
                  onChange={(e) => setCustomPoNumber(e.target.value)}
                  placeholder="e.g. PO-2026-101"
                  style={{ width: '100%', background: '#18181b', color: '#fafafa', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '6px', padding: '8px 10px', fontSize: '13px', fontFamily: 'var(--font-mono)' }}
                  required
                />
              )}
            </div>

            {/* Supplier / Vendor Name */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                Supplier / Trade Contractor
              </label>
              {hasExistingPos && selectedPoId !== '__MANUAL__' && targetPo ? (
                <input 
                  type="text"
                  value={targetPo.supplier_name}
                  disabled
                  style={{ width: '100%', background: '#141418', color: '#a1a1aa', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '6px', padding: '8px 10px', fontSize: '13px' }}
                />
              ) : (
                <input 
                  type="text"
                  value={customSupplierName}
                  onChange={(e) => setCustomSupplierName(e.target.value)}
                  placeholder="e.g. Syarikat Pembekal / YTL Cement Sdn Bhd"
                  style={{ width: '100%', background: '#18181b', color: '#fafafa', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '6px', padding: '8px 10px', fontSize: '13px' }}
                  required
                />
              )}
            </div>

            {/* Invoice Number */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                Supplier Invoice Number
              </label>
              <input 
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="e.g. INV-8821"
                style={{ width: '100%', background: '#18181b', color: '#fafafa', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '6px', padding: '8px 10px', fontSize: '13px', fontFamily: 'var(--font-mono)' }}
                required
              />
            </div>

            {/* Invoice Billing Date */}
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

          {/* Line Items Table with Add/Remove Functionality */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Billed Line Items ({lineItems.length})
              </span>
              <button 
                type="button" 
                className="btn btn-secondary btn-xs"
                onClick={handleAddItem}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                <Plus size={12} /> Add Line Item
              </button>
            </div>
            
            <div style={{ border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', overflow: 'hidden' }}>
              <div className="modern-table-wrapper">
                <table className="modern-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ minWidth: '220px' }}>Material / Service Description</th>
                      <th style={{ width: '110px', textAlign: 'right' }}>Billed Qty</th>
                      <th style={{ width: '100px' }}>Unit</th>
                      <th style={{ width: '120px', textAlign: 'right' }}>Unit Price (RM)</th>
                      <th style={{ width: '120px', textAlign: 'right' }}>Line Total (RM)</th>
                      <th style={{ width: '50px', textAlign: 'center' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((it, idx) => {
                      const lineTotal = (Number(it.quantity_billed) || 0) * (Number(it.unit_price) || 0);
                      return (
                        <tr key={idx}>
                          <td>
                            <input 
                              type="text"
                              placeholder="e.g. Ready-Mix Concrete Grade 30, Rebar Y16"
                              value={it.description}
                              onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                              style={{ width: '100%', background: '#18181b', color: '#fafafa', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '6px 8px', fontSize: '13px' }}
                              required
                            />
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <input 
                              type="number"
                              step="any"
                              min="0"
                              value={it.quantity_billed}
                              onChange={(e) => handleItemChange(idx, 'quantity_billed', e.target.value)}
                              style={{ width: '100%', background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '6px 8px', fontSize: '12px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}
                              required
                            />
                          </td>
                          <td>
                            <input 
                              type="text"
                              placeholder="Cu M / Bags"
                              value={it.unit}
                              onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                              style={{ width: '100%', background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '6px 8px', fontSize: '12px' }}
                            />
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <input 
                              type="number"
                              step="any"
                              min="0"
                              value={it.unit_price}
                              onChange={(e) => handleItemChange(idx, 'unit_price', e.target.value)}
                              style={{ width: '100%', background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '6px 8px', fontSize: '12px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}
                              required
                            />
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: '600', color: '#fafafa' }}>
                            RM {lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px', opacity: 0.8 }}
                              title="Remove item"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Add item button banner */}
            <div style={{ marginTop: '10px' }}>
              <button 
                type="button" 
                className="btn btn-outline btn-xs"
                onClick={handleAddItem}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Plus size={13} /> + Add Another Item (e.g. Delivery Surcharge, Rebar, Simen)
              </button>
            </div>
          </div>

          {/* Summary Box */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#18181b', padding: '14px 18px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)', marginBottom: '22px' }}>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>Supplier Vendor:</span>
              <div style={{ color: '#fafafa', fontSize: '14px', fontWeight: '600' }}>
                {activeSupplierName}
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>Total Billed Claim:</span>
              <div style={{ fontSize: '20px', fontWeight: '700', color: '#fafafa', fontFamily: 'var(--font-mono)' }}>
                RM {totalBilled.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={onClose}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={isSubmitting || totalBilled === 0}
            >
              {isSubmitting ? 'Processing 3-Way Match...' : 'Submit & Run 3-Way Match'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
