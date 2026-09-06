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
  currentRole,
  setCurrentRole,
  actorId,
  setActorId,
  onRefresh,
  onOpenCreatePo,
  onOpenCreateInvoice,
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

        {/* Maker-Checker Role Selector */}
        <div className="role-select-box">
          <UserCheck size={14} color="var(--accent-blue)" />
          <select 
            className="role-select"
            value={currentRole} 
            onChange={(e) => {
              const role = e.target.value;
              setCurrentRole(role);
              if (role === 'FINANCE_CONTROLLER') setActorId('FINANCE_CONTROLLER_BOB');
              else if (role === 'AP_SPECIALIST') setActorId('AP_SPECIALIST_ALICE');
              else setActorId('SUPERVISOR_DAVE');
            }}
          >
            <option value="FINANCE_CONTROLLER">CONTROLLER</option>
            <option value="AP_SPECIALIST">AP MAKER</option>
            <option value="SITE_SUPERVISOR">SITE SUPERVISOR</option>
          </select>
        </div>

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
