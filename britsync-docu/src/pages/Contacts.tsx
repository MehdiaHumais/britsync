import React, { useEffect, useState } from 'react';
import { apiCall } from '../utils/api';
import DashboardLayout from '../components/layout/DashboardLayout';
import { 
    Plus, Search, Trash2, Edit2, Contact, X, Save, 
    Download, Upload, Mail, Phone, Briefcase, Check
} from 'lucide-react';
import { Select } from '../components/ui/Select';

export const Contacts: React.FC = () => {
    const [contacts, setContacts] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeGroupFilter, setActiveGroupFilter] = useState('all');
    const [loading, setLoading] = useState(true);
    
    // Modals & Drawers controls
    const [showModal, setShowModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [drawerContact, setDrawerContact] = useState<any | null>(null);

    // CSV Raw input
    const [csvInput, setCsvInput] = useState('');

    // Form inputs
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [company, setCompany] = useState('');
    const [address, setAddress] = useState('');
    const [notes, setNotes] = useState('');
    const [groupTag, setGroupTag] = useState('Clients'); // Clients, Employees, Vendors, Partners, Legal, Finance, Custom

    const [toast, setToast] = useState('');

    const showToastMsg = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(''), 3000);
    };

    const fetchContacts = async () => {
        try {
            const list = await apiCall('contacts');
            setContacts(list || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchContacts();
    }, []);

    const handleOpenAdd = () => {
        setEditId(null);
        setName('');
        setEmail('');
        setPhone('');
        setCompany('');
        setAddress('');
        setNotes('');
        setGroupTag('Clients');
        setShowModal(true);
    };

    const handleOpenEdit = (c: any) => {
        const groups = c.tags_json ? JSON.parse(c.tags_json) : [];
        setEditId(c._id);
        setName(c.name);
        setEmail(c.email);
        setPhone(c.phone || '');
        setCompany(c.company || '');
        setAddress(c.address || '');
        setNotes(c.notes || '');
        setGroupTag(groups[0] || 'Clients');
        setShowModal(true);
        setDrawerContact(null); // close drawer to edit in modal
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !email) return;

        const payload = { 
            name, 
            email, 
            phone, 
            company, 
            address, 
            notes, 
            tags: [groupTag] 
        };

        try {
            if (editId) {
                await apiCall(`contacts/${editId}`, {
                    method: 'PATCH',
                    body: payload
                });
                showToastMsg('Contact details updated successfully!');
            } else {
                await apiCall('contacts', {
                    method: 'POST',
                    body: payload
                });
                showToastMsg('Contact added to your directory!');
            }
            setShowModal(false);
            fetchContacts();
        } catch (err) {
            console.error(err);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this contact?')) return;
        try {
            await apiCall(`contacts/${id}`, { method: 'DELETE' });
            showToastMsg('Contact deleted from workspace.');
            setDrawerContact(null);
            fetchContacts();
        } catch (err) {
            console.error(err);
        }
    };

    // CSV Import / Export Logic
    const handleCsvImport = async () => {
        if (!csvInput.trim()) return;
        const lines = csvInput.split('\n').filter(Boolean);
        const importedList: any[] = [];
        
        // Check if header exists
        const startIdx = lines[0].toLowerCase().includes('email') ? 1 : 0;
        
        for (let i = startIdx; i < lines.length; i++) {
            const parts = lines[i].split(',').map(s => s.trim());
            if (parts.length < 2) continue;
            
            const [cName, cEmail, cPhone, cCompany, cAddress, cNotes, cGroup] = parts;
            if (!cName || !cEmail) continue;
            
            importedList.push({
                name: cName,
                email: cEmail,
                phone: cPhone || '',
                company: cCompany || '',
                address: cAddress || '',
                notes: cNotes || '',
                tags: cGroup ? [cGroup] : ['Clients']
            });
        }

        if (importedList.length === 0) {
            alert('No valid contacts found. Please format as: Name,Email,Phone,Company,Address,Notes,Group');
            return;
        }

        try {
            await apiCall('contacts/bulk', {
                method: 'POST',
                body: { contacts: importedList }
            });
            showToastMsg(`Bulk imported ${importedList.length} contacts!`);
            setCsvInput('');
            setShowImportModal(false);
            fetchContacts();
        } catch (err) {
            console.error(err);
            alert('CSV Bulk Import failed. Check fields headers.');
        }
    };

    const handleExportCsv = () => {
        if (contacts.length === 0) {
            alert('No contacts to export.');
            return;
        }
        
        let csvContent = 'Name,Email,Phone,Company,Address,Notes,Group\n';
        contacts.forEach(c => {
            const groups = c.tags_json ? JSON.parse(c.tags_json) : [];
            const row = [
                c.name,
                c.email,
                c.phone || '',
                c.company || '',
                c.address || '',
                c.notes || '',
                groups[0] || 'Clients'
            ].map(val => `"${val.replace(/"/g, '""')}"`).join(',');
            csvContent += row + '\n';
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `britsync_contacts_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToastMsg('Contacts list exported successfully!');
    };

    // Filter contacts
    const filtered = contacts.filter(c => {
        const matchesQuery = c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (c.company && c.company.toLowerCase().includes(searchTerm.toLowerCase()));
        
        if (activeGroupFilter === 'all') return matchesQuery;
        
        const groups = c.tags_json ? JSON.parse(c.tags_json) : [];
        const firstGroup = groups[0] || 'Untagged';
        return matchesQuery && firstGroup === activeGroupFilter;
    });

    const groupsList = ['Clients', 'Employees', 'Vendors', 'Partners', 'Legal', 'Finance', 'Custom'];

    return (
        <DashboardLayout title="Contacts">
            <div className="contacts-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>Contacts Directory</h2>
                    <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.15rem' }}>Organize signers, clients, and partners to quickly populate document dispatches.</p>
                </div>
                <div className="contacts-actions" style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-secondary" onClick={() => setShowImportModal(true)}>
                        <Upload size={16} /> Import CSV
                    </button>
                    <button className="btn btn-secondary" onClick={handleExportCsv}>
                        <Download size={16} /> Export CSV
                    </button>
                    <button className="btn btn-primary" onClick={handleOpenAdd}>
                        <Plus size={16} /> Add Contact
                    </button>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                {/* Groups Filter Sidebar */}
                <div style={{ width: '200px', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <button 
                        onClick={() => setActiveGroupFilter('all')}
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            width: '100%',
                            padding: '0.5rem 0.75rem',
                            border: 'none',
                            background: activeGroupFilter === 'all' ? '#eff6ff' : 'transparent',
                            color: activeGroupFilter === 'all' ? '#2563eb' : '#475569',
                            fontWeight: activeGroupFilter === 'all' ? 700 : 500,
                            borderRadius: '6px',
                            fontSize: '0.85rem',
                            cursor: 'pointer'
                        }}
                    >
                        <span>All Contacts</span>
                        <span style={{ fontSize: '0.7rem', padding: '2px 6px', background: activeGroupFilter === 'all' ? '#2563eb' : '#e2e8f0', color: activeGroupFilter === 'all' ? 'white' : '#64748b', borderRadius: '10px' }}>
                            {contacts.length}
                        </span>
                    </button>
                    
                    {groupsList.map(g => {
                        const count = contacts.filter(c => {
                            const groups = c.tags_json ? JSON.parse(c.tags_json) : [];
                            return (groups[0] || 'Clients') === g;
                        }).length;

                        return (
                            <button
                                key={g}
                                onClick={() => setActiveGroupFilter(g)}
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    width: '100%',
                                    padding: '0.5rem 0.75rem',
                                    border: 'none',
                                    background: activeGroupFilter === g ? '#eff6ff' : 'transparent',
                                    color: activeGroupFilter === g ? '#2563eb' : '#475569',
                                    fontWeight: activeGroupFilter === g ? 700 : 500,
                                    borderRadius: '6px',
                                    fontSize: '0.85rem',
                                    cursor: 'pointer'
                                }}
                            >
                                <span>{g}</span>
                                <span style={{ fontSize: '0.7rem', padding: '2px 6px', background: activeGroupFilter === g ? '#2563eb' : '#e2e8f0', color: activeGroupFilter === g ? 'white' : '#64748b', borderRadius: '10px' }}>
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Contacts Main Workspace */}
                <div style={{ flex: 1, minWidth: '320px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ position: 'relative' }}>
                        <input
                            type="text"
                            placeholder="Search contacts by name, email, or company..."
                            className="form-input"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ paddingLeft: '2.5rem', height: '38px', fontSize: '0.85rem' }}
                        />
                        <Search size={16} style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    </div>

                    <div className="card-table-wrapper" style={{ margin: 0 }}>
                        {loading ? (
                            <div style={{ display: 'flex', padding: '4rem', justifyContent: 'center' }}>
                                <div className="spinner"></div>
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="empty-state">
                                <Contact className="empty-state-icon" size={48} />
                                <h3>No contacts found</h3>
                                <p>Keep a list of signers to quickly select them when preparing signature documents.</p>
                            </div>
                        ) : (
                            <table className="docu-table" style={{ fontSize: '0.85rem' }}>
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Email</th>
                                        <th>Company</th>
                                        <th>Group</th>
                                        <th style={{ textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map((c) => {
                                        const groups = c.tags_json ? JSON.parse(c.tags_json) : [];
                                        const groupLabel = groups[0] || 'Clients';
                                        return (
                                            <tr key={c._id} style={{ cursor: 'pointer' }} onClick={() => setDrawerContact(c)}>
                                                <td style={{ fontWeight: 700, color: '#0f172a' }}>{c.name}</td>
                                                <td>{c.email}</td>
                                                <td>{c.company || '—'}</td>
                                                <td>
                                                    <span style={{
                                                        fontSize: '0.65rem',
                                                        fontWeight: 700,
                                                        background: '#f1f5f9',
                                                        color: '#475569',
                                                        padding: '3px 8px',
                                                        borderRadius: '6px'
                                                    }}>{groupLabel}</span>
                                                </td>
                                                <td style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                                                    <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                                                        <button className="btn btn-secondary" style={{ padding: '0.4rem', borderRadius: '6px' }} onClick={() => handleOpenEdit(c)} title="Edit Contact">
                                                            <Edit2 size={13} />
                                                        </button>
                                                        <button className="btn btn-danger" style={{ padding: '0.4rem', borderRadius: '6px' }} onClick={() => handleDelete(c._id)} title="Delete Contact">
                                                            <Trash2 size={13} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>

            {/* Profile Drawer Panel */}
            {drawerContact && (
                <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, left: 0, background: 'rgba(15, 23, 42, 0.15)', zIndex: 1000, display: 'flex', justifyContent: 'flex-end' }} onClick={() => setDrawerContact(null)}>
                    <div style={{ width: '380px', height: '100%', background: 'white', borderLeft: '1px solid #e2e8f0', boxShadow: 'var(--shadow-lg)', padding: '2rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'slideIn 0.25s ease-out' }} onClick={e => e.stopPropagation()}>
                        <style>{`
                            @keyframes slideIn {
                                from { transform: translateX(100%); }
                                to { transform: translateX(0); }
                            }
                        `}</style>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>Contact Profile</h3>
                            <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }} onClick={() => setDrawerContact(null)}>
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <div>
                                <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 800 }}>Full Name</span>
                                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                                    <Contact size={18} style={{ color: '#2563eb' }} /> {drawerContact.name}
                                </div>
                            </div>
                            
                            <div>
                                <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 800 }}>Email Address</span>
                                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                                    <Mail size={15} style={{ color: '#64748b' }} /> {drawerContact.email}
                                </div>
                            </div>

                            {drawerContact.phone && (
                                <div>
                                    <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 800 }}>Phone Number</span>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                                        <Phone size={15} style={{ color: '#64748b' }} /> {drawerContact.phone}
                                    </div>
                                </div>
                            )}

                            {drawerContact.company && (
                                <div>
                                    <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 800 }}>Company</span>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                                        <Briefcase size={15} style={{ color: '#64748b' }} /> {drawerContact.company}
                                    </div>
                                </div>
                            )}

                            {drawerContact.address && (
                                <div>
                                    <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 800 }}>Address</span>
                                    <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '0.2rem' }}>{drawerContact.address}</div>
                                </div>
                            )}

                            {drawerContact.notes && (
                                <div>
                                    <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 800 }}>Internal Notes</span>
                                    <div style={{ fontSize: '0.8rem', color: '#475569', background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginTop: '0.2rem', lineHeight: 1.4 }}>{drawerContact.notes}</div>
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto', borderTop: '1px solid #f1f5f9', paddingTop: '1.25rem' }}>
                            <button className="btn btn-secondary" style={{ flex: 1, padding: '0.55rem', justifyContent: 'center' }} onClick={() => handleOpenEdit(drawerContact)}>
                                <Edit2 size={14} /> Edit Contact
                            </button>
                            <button className="btn btn-danger" style={{ flex: 1, padding: '0.55rem', justifyContent: 'center' }} onClick={() => handleDelete(drawerContact._id)}>
                                <Trash2 size={14} /> Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add / Edit Contact Modal */}
            {showModal && (
                <div className="modal-overlay">
                    <form onSubmit={handleSave} className="modal-container" style={{ maxWidth: '500px' }}>
                        <div className="modal-header">
                            <h2>{editId ? 'Edit Contact' : 'Add New Contact'}</h2>
                            <button type="button" className="close-btn" onClick={() => setShowModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">Full Name *</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    required
                                    placeholder="Sarah Connor"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Email Address *</label>
                                <input
                                    type="email"
                                    className="form-input"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    placeholder="sarah@company.com"
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label className="form-label">Phone Number</label>
                                    <input
                                        type="tel"
                                        className="form-input"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        placeholder="+44 7700 900077"
                                    />
                                </div>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label className="form-label">Company</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={company}
                                        onChange={(e) => setCompany(e.target.value)}
                                        placeholder="Cyberdyne Systems"
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Address</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={address}
                                    onChange={(e) => setAddress(e.target.value)}
                                    placeholder="123 Science Way, London"
                                />
                            </div>
                            <div className="form-group">
                                <Select
                                    label="Contact Group / Tag"
                                    value={groupTag}
                                    onChange={(val) => setGroupTag(val)}
                                    options={groupsList.map(g => ({ value: g, label: g }))}
                                />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Notes</label>
                                <textarea
                                    className="form-input"
                                    rows={3}
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Internal memo..."
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                            <button type="submit" className="btn btn-primary">
                                <Save size={16} /> Save Contact
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* CSV Import Modal */}
            {showImportModal && (
                <div className="modal-overlay">
                    <div className="modal-container" style={{ maxWidth: '550px' }}>
                        <div className="modal-header">
                            <h2>Bulk Import Contacts</h2>
                            <button type="button" className="close-btn" onClick={() => setShowImportModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <p style={{ fontSize: '0.8rem', color: '#64748b', lineHeight: 1.4 }}>
                                Paste your raw CSV data below. Make sure the headers match the pattern exactly.
                            </p>
                            <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.75rem', color: '#475569', fontFamily: 'monospace' }}>
                                Name,Email,Phone,Company,Address,Notes,Group<br />
                                Sarah Connor,sarah@cyber.com,+44700099,Cyberdyne,,Notes,Clients
                            </div>
                            <textarea
                                className="form-input"
                                rows={6}
                                value={csvInput}
                                onChange={e => setCsvInput(e.target.value)}
                                placeholder="Paste CSV rows here..."
                                style={{ fontFamily: 'monospace', fontSize: '0.75rem', resize: 'vertical' }}
                            />
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-secondary" onClick={() => setShowImportModal(false)}>Cancel</button>
                            <button type="button" className="btn btn-primary" onClick={handleCsvImport} disabled={!csvInput.trim()}>
                                <Upload size={16} /> Import Contacts
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast feedback */}
            {toast && (
                <div style={{
                    position: 'fixed',
                    bottom: '24px',
                    right: '24px',
                    background: '#1e293b',
                    color: 'white',
                    padding: '0.75rem 1.25rem',
                    borderRadius: '8px',
                    boxShadow: 'var(--shadow-lg)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '0.85rem',
                    zIndex: 2000
                }}>
                    <Check size={16} style={{ color: '#10b981' }} />
                    <span>{toast}</span>
                </div>
            )}
        </DashboardLayout>
    );
};

export default Contacts;
