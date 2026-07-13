import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiCall } from '../utils/api';
import { ArrowLeft, Send, Plus, Trash2, Mail, Users, RefreshCw, Search, X } from 'lucide-react';
import { Select } from '../components/ui/Select';

interface Recipient {
    _id?: string;
    name: string;
    email: string;
    role: 'signer' | 'admin' | 'viewer' | 'cc';
    signing_order: number;
}

export const SendFlow: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    useEffect(() => {
        const role = localStorage.getItem('docu_user_role') || 'member';
        if (role === 'viewer') {
            alert('Permission denied. Viewers cannot send documents.');
            navigate('/dashboard');
        }
    }, [navigate]);

    const [_doc, setDoc] = useState<any>(null);
    const [recipients, setRecipients] = useState<Recipient[]>([]);
    const [message, setMessage] = useState('');
    const [expirationDays, setExpirationDays] = useState('30');
    
    // Form fields for adding new signers
    const [newName, setNewName] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [newRole, setNewRole] = useState<'signer' | 'admin' | 'viewer' | 'cc'>('signer');
    const [signingOrderEnabled, setSigningOrderEnabled] = useState(false);
    
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);

    // Contacts Picker states
    const [contacts, setContacts] = useState<any[]>([]);
    const [showContactsModal, setShowContactsModal] = useState(false);
    const [contactsSearch, setContactsSearch] = useState('');
    const [selectedContacts, setSelectedContacts] = useState<any[]>([]);
    const [saveToContacts, setSaveToContacts] = useState(false);

    useEffect(() => {
        const fetchDocData = async () => {
            try {
                const docData = await apiCall(`documents/${id}`);
                setDoc(docData);
                setRecipients(docData.recipients || []);
                setSigningOrderEnabled(docData.signing_order_enabled || false);
                setLoading(false);
            } catch (err) {
                console.error(err);
                navigate('/dashboard');
            }
        };
        if (id) fetchDocData();
    }, [id, navigate]);

    const handleOpenContactsModal = async () => {
        try {
            const list = await apiCall('contacts');
            setContacts(list);
            setSelectedContacts([]);
            setContactsSearch('');
            setShowContactsModal(true);
        } catch (err) {
            console.error('Failed to load contacts:', err);
        }
    };

    const handleToggleContactSelect = (c: any) => {
        if (selectedContacts.some(sc => sc._id === c._id)) {
            setSelectedContacts(prev => prev.filter(sc => sc._id !== c._id));
        } else {
            setSelectedContacts(prev => [...prev, c]);
        }
    };

    const handleImportContacts = () => {
        const newRecs = selectedContacts.map((c, index) => ({
            name: c.name,
            email: c.email,
            role: 'signer' as const,
            signing_order: recipients.length + index + 1
        }));
        setRecipients(prev => [...prev, ...newRecs]);
        setShowContactsModal(false);
    };

    const handleAddRecipient = async () => {
        if (!newName || !newEmail) {
            alert('Please fill out Name and Email');
            return;
        }

        const nextOrder = recipients.length + 1;
        const newRec: Recipient = {
            name: newName,
            email: newEmail,
            role: newRole,
            signing_order: nextOrder
        };

        setRecipients(prev => [...prev, newRec]);

        // Auto save to contacts list if checkbox is toggled
        if (saveToContacts) {
            try {
                await apiCall('contacts', {
                    method: 'POST',
                    body: {
                        name: newName,
                        email: newEmail
                    }
                });
            } catch (err) {
                console.error('Failed to auto-save manual recipient to contacts:', err);
            }
        }

        setNewName('');
        setNewEmail('');
        setNewRole('signer');
        setSaveToContacts(false);
    };

    const handleRemoveRecipient = (idx: number) => {
        setRecipients(prev => prev.filter((_, i) => i !== idx).map((r, i) => ({ ...r, signing_order: i + 1 })));
    };

    const handleSend = async () => {
        if (recipients.length === 0) {
            alert('Please configure at least one recipient.');
            return;
        }

        setSending(true);
        try {
            // First save recipients in document metadata
            await apiCall(`documents/${id}`, {
                method: 'PATCH',
                body: { recipients, signing_order_enabled: signingOrderEnabled }
            });

            // Dispatch emails
            await apiCall(`documents/${id}/send`, {
                method: 'POST',
                body: {
                    message,
                    expirationDays: parseInt(expirationDays)
                }
            });

            alert('Signature request dispatched successfully!');
            navigate('/documents');
        } catch (err: any) {
            console.error(err);
            alert(err.message || 'Failed to dispatch document.');
        } finally {
            setSending(false);
        }
    };

    // Filter contacts in the search modal
    const filteredContacts = contacts.filter(c => 
        c.name.toLowerCase().includes(contactsSearch.toLowerCase()) ||
        c.email.toLowerCase().includes(contactsSearch.toLowerCase()) ||
        (c.company && c.company.toLowerCase().includes(contactsSearch.toLowerCase()))
    );

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' }}>
                <div className="spinner"></div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', padding: '3rem 2rem' }}>
            <div style={{ maxWidth: '850px', margin: '0 auto' }}>
                {/* Back Link */}
                <button className="btn btn-secondary" style={{ marginBottom: '2rem' }} onClick={() => navigate(`/documents/${id}/editor`)}>
                    <ArrowLeft size={16} /> Back to Editor
                </button>

                <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>Send Signature Request</h1>
                <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '2.5rem' }}>Configure recipient roles, customize the notification body, and dispatch secure links.</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    {/* Add Signers Card */}
                    <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '2rem', boxShadow: 'var(--shadow-sm)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Users size={18} style={{ color: '#2563eb' }} /> Add Recipients
                            </h2>
                            <button 
                                type="button" 
                                className="btn btn-secondary" 
                                style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem' }} 
                                onClick={handleOpenContactsModal}
                            >
                                Add from Contacts
                            </button>
                        </div>

                        {/* Recipients List */}
                        {recipients.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '2rem' }}>
                                {recipients.map((rec, idx) => (
                                    <div key={idx} style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        background: '#f8fafc',
                                        padding: '0.75rem 1.25rem',
                                        borderRadius: '8px',
                                        border: '1px solid #e2e8f0'
                                    }}>
                                        <div>
                                            <span style={{ fontWeight: 800, fontSize: '0.85rem', color: '#0f172a' }}>{idx + 1}. {rec.name}</span>
                                            <span style={{ fontSize: '0.8rem', color: '#64748b', marginLeft: '0.5rem' }}>({rec.email})</span>
                                            <span style={{
                                                background: rec.role === 'signer' ? '#eff6ff' : rec.role === 'admin' ? '#f3e8ff' : rec.role === 'viewer' ? '#f0fdf4' : '#fff7ed',
                                                color: rec.role === 'signer' ? '#2563eb' : rec.role === 'admin' ? '#7c3aed' : rec.role === 'viewer' ? '#16a34a' : '#ea580c',
                                                padding: '0.2rem 0.6rem',
                                                borderRadius: '12px',
                                                fontSize: '0.75rem',
                                                fontWeight: 700,
                                                textTransform: 'uppercase'
                                            }}>{rec.role === 'signer' ? 'signer' : rec.role === 'admin' ? 'admin' : rec.role === 'viewer' ? 'viewer' : 'cc'}</span>
                                        </div>
                                        <button className="btn btn-danger" style={{ padding: '0.3rem 0.5rem' }} onClick={() => handleRemoveRecipient(idx)}>
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Add Form */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderTop: '1px solid #f1f5f9', paddingTop: '1.5rem' }}>
                            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                                <div className="form-group" style={{ flex: 2, marginBottom: 0 }}>
                                    <label className="form-label">Full Name</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="Sarah Connor"
                                        value={newName}
                                        onChange={(e) => setNewName(e.target.value)}
                                    />
                                </div>
                                <div className="form-group" style={{ flex: 2, marginBottom: 0 }}>
                                    <label className="form-label">Email Address</label>
                                    <input
                                        type="email"
                                        className="form-input"
                                        placeholder="sarah@company.com"
                                        value={newEmail}
                                        onChange={(e) => setNewEmail(e.target.value)}
                                    />
                                </div>
                                <div className="form-group" style={{ flex: 1.5, marginBottom: 0 }}>
                                    <Select
                                        label="Role"
                                        value={newRole}
                                        onChange={(val: any) => setNewRole(val)}
                                        options={[
                                            { value: 'signer', label: 'Signer' },
                                            { value: 'admin', label: 'Admin (Reviewer)' },
                                            { value: 'viewer', label: 'Viewer' },
                                            { value: 'cc', label: 'CC Copy' }
                                        ]}
                                    />
                                </div>
                                <button className="btn btn-secondary" style={{ height: '40px' }} onClick={handleAddRecipient}>
                                    <Plus size={16} /> Add Recipient
                                </button>
                            </div>

                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', fontWeight: 600, color: '#64748b', cursor: 'pointer', userSelect: 'none', width: 'fit-content' }}>
                                <input
                                    type="checkbox"
                                    checked={saveToContacts}
                                    onChange={(e) => setSaveToContacts(e.target.checked)}
                                />
                                Save manually entered recipient as contact
                            </label>
                        </div>
                    </div>

                    {/* Email Message & Parameters Card */}
                    <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '2rem', boxShadow: 'var(--shadow-sm)' }}>
                        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Mail size={18} style={{ color: '#2563eb' }} /> Email Dispatch details
                        </h2>

                        <div className="form-group">
                            <label className="form-label">Custom Message for Recipients</label>
                            <textarea
                                className="form-input"
                                rows={4}
                                placeholder="Write a short message explaining the content of the document..."
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                style={{ resize: 'vertical' }}
                            />
                        </div>

                        <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                            <Select
                                label="Signing Order"
                                value={signingOrderEnabled ? 'sequential' : 'parallel'}
                                onChange={(val) => setSigningOrderEnabled(val === 'sequential')}
                                options={[
                                    { value: 'parallel', label: 'Parallel Signing (Sign in any order)' },
                                    { value: 'sequential', label: 'Sequential Signing (Sign in defined order 1, 2, 3...)' }
                                ]}
                            />
                        </div>

                        <div className="form-group">
                            <Select
                                label="Link Expiration Period"
                                value={expirationDays}
                                onChange={(val) => setExpirationDays(val)}
                                options={[
                                    { value: '7', label: '7 Days' },
                                    { value: '15', label: '15 Days' },
                                    { value: '30', label: '30 Days' },
                                    { value: '90', label: '90 Days' }
                                ]}
                            />
                        </div>
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                        <button className="btn btn-secondary" style={{ padding: '0.75rem 2rem' }} onClick={() => navigate('/documents')}>
                            Cancel
                        </button>
                        <button className="btn btn-primary" style={{ padding: '0.75rem 2.5rem' }} onClick={handleSend} disabled={sending}>
                            {sending ? (
                                <>
                                    <RefreshCw className="spinner" size={16} style={{ marginRight: '0.5rem' }} /> Sending...
                                </>
                            ) : (
                                <>
                                    Send Document <Send size={16} />
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Contacts Modal Dialog */}
            {showContactsModal && (
                <div className="modal-overlay">
                    <div className="modal-container" style={{ maxWidth: '600px' }}>
                        <div className="modal-header">
                            <h2>Select from Contacts</h2>
                            <button type="button" className="close-btn" onClick={() => setShowContactsModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type="text"
                                    placeholder="Search contacts..."
                                    className="form-input"
                                    value={contactsSearch}
                                    onChange={(e) => setContactsSearch(e.target.value)}
                                    style={{ paddingLeft: '2.25rem' }}
                                />
                                <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                            </div>

                            <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                                {filteredContacts.length === 0 ? (
                                    <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                                        No matching contacts found.
                                    </div>
                                ) : (
                                    filteredContacts.map(c => {
                                        const isSelected = selectedContacts.some(sc => sc._id === c._id);
                                        return (
                                            <div 
                                                key={c._id}
                                                onClick={() => handleToggleContactSelect(c)}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.75rem',
                                                    padding: '0.6rem 1rem',
                                                    borderBottom: '1px solid #f1f5f9',
                                                    cursor: 'pointer',
                                                    backgroundColor: isSelected ? '#f1f5f9' : 'transparent',
                                                    transition: 'all 0.15s ease'
                                                }}
                                            >
                                                <input 
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => {}} // handled by row click
                                                    style={{ cursor: 'pointer' }}
                                                />
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>{c.name}</div>
                                                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                                        {c.email} {c.company && `• ${c.company}`}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-secondary" onClick={() => setShowContactsModal(false)}>
                                Cancel
                            </button>
                            <button 
                                type="button" 
                                className="btn btn-primary" 
                                onClick={handleImportContacts}
                                disabled={selectedContacts.length === 0}
                            >
                                Import Selected ({selectedContacts.length})
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SendFlow;
