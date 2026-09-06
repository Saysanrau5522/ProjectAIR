import React from 'react';
import { 
  Search, 
  Plus, 
  RefreshCw, 
  UserCheck, 
  FileText,
  Menu
} from 'lucide-react';

export default function TopNav({
  onRefresh,
  onOpenCreatePo,
  onOpenCreateInvoice,
  onOpenDocModal,
  onToggleMobileNav,
  loading = false
}) {
  return (
    <header className="top-navbar">
      <div className="nav-left">
        {/* Mobile Hamburger Drawer Toggle */}
        <button 
          className="mobile-nav-toggle"
          onClick={onToggleMobileNav}
          aria-label="Toggle menu"
          title="Open navigation menu"
        >
          <Menu size={18} />
        </button>

        {/* Quick Search */}
        <div className="global-search-box">
          <Search size={14} color="var(--text-muted)" />
          <input 
            type="text" 
            className="global-search-input" 
            placeholder="Search POs, vendors, sites..." 
          />
          <span className="kbd-shortcut">⌘K</span>
        </div>
      </div>

      <div className="nav-right">
        {/* Quick Action: Documents & PDF Templates */}
        {onOpenDocModal && (
          <button 
            className="btn btn-secondary btn-sm nav-action-btn"
            onClick={() => onOpenDocModal({ initialDocType: 'PO' })}
            title="Open Document Export Center & Print Templates"
          >
            <FileText size={14} color="#38bdf8" />
            <span className="nav-btn-text">PDF Center</span>
          </button>
        )}

        {/* Quick Action: Issue PO */}
        <button 
          className="btn btn-outline btn-sm nav-action-btn"
          onClick={onOpenCreatePo}
          title="Create a new Purchase Order linked to a project site"
        >
          <Plus size={14} />
          <span className="nav-btn-text">Issue PO</span>
        </button>

        {/* Quick Action: Log Invoice */}
        <button 
          className="btn btn-primary btn-sm nav-action-btn"
          onClick={onOpenCreateInvoice}
          title="Log supplier invoice and run 3-way match"
        >
          <FileText size={14} />
          <span className="nav-btn-text">Log Invoice</span>
        </button>

        {/* Sync Button */}
        <button 
          className="btn btn-secondary btn-sm nav-sync-btn"
          onClick={onRefresh}
          disabled={loading}
          title="Sync ledger with backend"
        >
          <RefreshCw size={13} className={loading ? 'spin-anim' : ''} />
        </button>
      </div>
    </header>
  );
}
