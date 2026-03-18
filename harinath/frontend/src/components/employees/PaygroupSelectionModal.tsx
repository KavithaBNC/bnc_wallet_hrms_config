import React, { useEffect, useState, useMemo } from 'react';
import Modal from '../common/Modal';
import paygroupService, { Paygroup } from '../../services/paygroup.service';

interface PaygroupSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: string;
  onSubmit: (paygroupId: string, paygroupName: string) => void;
}

const PaygroupSelectionModal: React.FC<PaygroupSelectionModalProps> = ({
  isOpen,
  onClose,
  organizationId,
  onSubmit,
}) => {
  const [paygroups, setPaygroups] = useState<Paygroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string>('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [error, setError] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPaygroupName, setNewPaygroupName] = useState('');
  const [addingPaygroup, setAddingPaygroup] = useState(false);

  const fetchPaygroups = async () => {
    setLoading(true);
    setError('');
    try {
      const list = await paygroupService.getAll({ organizationId });
      console.log('✅ Loaded paygroups:', list.length, 'for org:', organizationId, list);
      setPaygroups(list);
      // Don't auto-open dropdown - user must click to open
    } catch (err: any) {
      console.error('❌ Failed to load paygroups:', err);
      const errorMsg = err.response?.data?.message || err.message || 'Failed to load paygroups';
      setError(errorMsg);
      setPaygroups([]);
      // Don't auto-open dropdown on error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    if (!organizationId) {
      setError('Organization ID is missing. Please refresh the page.');
      setDropdownOpen(false); // Don't auto-open dropdown
      return;
    }
    setSelectedId('');
    setSearch('');
    setDropdownOpen(false); // Don't auto-open dropdown - user must click to open
    fetchPaygroups();
  }, [isOpen, organizationId]);

  const filtered = useMemo(() => {
    if (!search.trim()) return paygroups; // Show all when search is empty
    const q = search.trim().toLowerCase();
    return paygroups.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.code && p.code.toLowerCase().includes(q))
    );
  }, [paygroups, search]);

  const selectedPaygroup = paygroups.find((p) => p.id === selectedId);
  // Show create option when: user has typed something AND no matches found AND not loading/creating
  const showCreateOption = search.trim().length > 0 && filtered.length === 0 && !loading && !creating;

  const handleCreateNew = async () => {
    if (!search.trim()) return;
    const newName = search.trim();
    
    // Check if name already exists (case-insensitive)
    const exists = paygroups.some(p => p.name.toLowerCase() === newName.toLowerCase());
    if (exists) {
      setError('Paygroup with this name already exists');
      return;
    }

    setCreating(true);
    setError('');
    try {
      const newPaygroup = await paygroupService.create({
        organizationId,
        name: newName,
      });
      // Refresh list and select the new paygroup
      await fetchPaygroups();
      setSelectedId(newPaygroup.id);
      setSearch(newPaygroup.name); // Show the created paygroup name
      setDropdownOpen(false);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create paygroup');
    } finally {
      setCreating(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) {
      setError('Please select a paygroup');
      return;
    }
    const pg = paygroups.find((p) => p.id === selectedId);
    if (pg) {
      onSubmit(selectedId, pg.name);
      onClose();
    }
  };

  const handleAddPaygroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPaygroupName.trim()) {
      setError('Paygroup name is required');
      return;
    }

    // Check if name already exists (case-insensitive)
    const exists = paygroups.some(p => p.name.toLowerCase() === newPaygroupName.trim().toLowerCase());
    if (exists) {
      setError('Paygroup with this name already exists');
      return;
    }

    setAddingPaygroup(true);
    setError('');
    try {
      const newPaygroup = await paygroupService.create({
        organizationId,
        name: newPaygroupName.trim(),
      });
      // Refresh list and select the new paygroup
      await fetchPaygroups();
      setSelectedId(newPaygroup.id);
      setSearch(newPaygroup.name);
      setDropdownOpen(false);
      setShowAddModal(false);
      setNewPaygroupName('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create paygroup');
    } finally {
      setAddingPaygroup(false);
    }
  };

  // Close dropdown when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const paygroupInput = document.getElementById('paygroup');
      const dropdown = paygroupInput?.parentElement?.querySelector('ul');
      const addButton = paygroupInput?.parentElement?.parentElement?.querySelector('button');
      
      // Close dropdown if clicking outside the input, dropdown, and add button
      if (dropdownOpen && paygroupInput && dropdown) {
        if (
          !paygroupInput.contains(target) && 
          !dropdown.contains(target) &&
          !addButton?.contains(target)
        ) {
          setDropdownOpen(false);
        }
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && dropdownOpen) {
        setDropdownOpen(false);
      }
    };

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [dropdownOpen]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Associate" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Debug info (remove in production) */}
        {import.meta.env.DEV && (
          <div className="text-xs text-gray-400 mb-2">
            Org ID: {organizationId ? organizationId.substring(0, 8) + '...' : 'MISSING'} | 
            Paygroups: {paygroups.length} | 
            Loading: {loading ? 'Yes' : 'No'} | 
            Dropdown: {dropdownOpen ? 'Open' : 'Closed'}
          </div>
        )}
        <div>
          <label htmlFor="paygroup" className="block text-sm font-medium text-gray-700">
            Paygroup <span className="text-red-500">*</span>
          </label>
          <div className="mt-1 flex gap-2">
            <div className="relative z-50 flex-1">
            <input
              type="text"
              id="paygroup"
              value={dropdownOpen ? search : selectedPaygroup?.name ?? ''}
              onChange={(e) => {
                const value = e.target.value;
                setSearch(value);
                setDropdownOpen(true); // Keep dropdown open when typing
                if (!value) {
                  setSelectedId('');
                  // Show all paygroups when search is cleared
                }
              }}
              onClick={(e) => {
                e.stopPropagation();
                // Always open dropdown when clicking input
                setDropdownOpen(true);
              }}
              onFocus={(e) => {
                e.stopPropagation();
                // Always open dropdown when focusing
                setDropdownOpen(true);
              }}
              onBlur={(e) => {
                // Close dropdown when input loses focus (unless clicking on dropdown item)
                setTimeout(() => {
                  const activeEl = document.activeElement;
                  const dropdownEl = e.currentTarget.parentElement?.querySelector('ul');
                  // Close if focus didn't move to dropdown item
                  if (!dropdownEl?.contains(activeEl)) {
                    setDropdownOpen(false);
                  }
                }, 200);
              }}
              placeholder="Search or select paygroup"
              className="block w-full rounded-md border border-gray-300 bg-white py-2 pl-3 pr-10 text-sm text-black shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-400">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            {dropdownOpen && (
              <ul 
                className="absolute z-[9999] mt-1 w-full max-h-48 overflow-auto rounded-md border-2 border-blue-400 bg-white shadow-2xl"
                style={{ 
                  zIndex: 9999,
                  backgroundColor: 'white',
                  minHeight: '40px'
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  // Keep dropdown open when clicking inside it
                }}
              >
                {loading ? (
                  <li className="px-3 py-2 text-sm text-gray-500">Loading paygroups...</li>
                ) : (
                  <>
                    {/* Show existing paygroups */}
                    {filtered.length > 0 && filtered.map((p) => (
                      <li
                        key={p.id}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setSelectedId(p.id);
                          setSearch('');
                          setDropdownOpen(false);
                        }}
                        className={`px-3 py-2 text-sm cursor-pointer ${
                          selectedId === p.id
                            ? 'bg-orange-500 text-white'
                            : 'text-black hover:bg-gray-100'
                        }`}
                      >
                        {p.name}
                      </li>
                    ))}
                    {/* Show "Create New" option when typing and no matches */}
                    {showCreateOption && (
                      <li
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleCreateNew();
                        }}
                        className={`px-3 py-2 text-sm cursor-pointer bg-blue-50 hover:bg-blue-100 text-black font-medium ${
                          filtered.length > 0 ? 'border-t border-gray-200' : ''
                        }`}
                      >
                        <span className="flex items-center">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          Create New: "{search.trim()}"
                        </span>
                      </li>
                    )}
                    {/* Show message when no paygroups exist and search is empty */}
                    {paygroups.length === 0 && !search.trim() && !loading && (
                      <li className="px-3 py-2 text-sm text-gray-500">
                        <div className="flex items-center">
                          <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          No paygroups found. Start typing to create a new one.
                        </div>
                      </li>
                    )}
                    {/* Show message when search has no matches and create option not shown */}
                    {filtered.length === 0 && !showCreateOption && search.trim() && !loading && (
                      <li className="px-3 py-2 text-sm text-gray-500">
                        No matching paygroups found.
                      </li>
                    )}
                    {/* Always show create option hint when typing */}
                    {search.trim() && !showCreateOption && filtered.length > 0 && (
                      <li className="px-3 py-2 text-sm text-gray-400 border-t border-gray-200 italic">
                        Tip: Type a new name to create a paygroup
                      </li>
                    )}
                  </>
                )}
              </ul>
            )}
            </div>
            <button
              type="button"
              onClick={() => {
                setShowAddModal(true);
                setNewPaygroupName('');
              }}
              className="mt-1 px-3 h-10 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center justify-center"
              title="Add New Paygroup"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
          {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center px-4 py-2 border border-red-300 rounded-md shadow-sm text-sm font-medium text-red-700 bg-white hover:bg-red-50"
          >
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Close
          </button>
          <button
            type="submit"
            disabled={creating || !selectedId}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Creating...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Submit
              </>
            )}
          </button>
        </div>
      </form>

      {/* Add Paygroup Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setNewPaygroupName('');
          setError('');
        }}
        title="Add New Paygroup"
        size="md"
      >
        <form onSubmit={handleAddPaygroup} className="space-y-4">
          <div>
            <label htmlFor="newPaygroupName" className="block text-sm font-medium text-gray-700">
              Paygroup Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="newPaygroupName"
              value={newPaygroupName}
              onChange={(e) => {
                setNewPaygroupName(e.target.value);
                setError('');
              }}
              placeholder="Enter paygroup name"
              className="mt-1 block w-full h-10 bg-white text-black rounded-md border border-gray-300 shadow-sm sm:text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
            {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
            <button
              type="button"
              onClick={() => {
                setShowAddModal(false);
                setNewPaygroupName('');
                setError('');
              }}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={addingPaygroup || !newPaygroupName.trim()}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {addingPaygroup ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Adding...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Paygroup
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>
    </Modal>
  );
};

export default PaygroupSelectionModal;
