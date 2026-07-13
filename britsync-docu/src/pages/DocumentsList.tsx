import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiCall } from '../utils/api';
import DashboardLayout from '../components/layout/DashboardLayout';
import { 
    Eye, Download, History, Lock, Trash2, Search, Plus, Copy, Send, 
    Check, FileText, FileCheck, Grid, List, X, Archive, Clock,
    Calendar, User, Layers, ShieldAlert, BadgeAlert, FolderOpen
} from 'lucide-react';
import { Select } from '../components/ui/Select';

export const DocumentsList: React.FC = () => {
    const navigate = useNavigate();
    const [allDocs, setAllDocs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeFolder, setActiveFolder] = useState<string>('all'); // all, draft, waiting, completed, expired, declined, archived
    const [sortBy, setSortBy] = useState<string>('newest'); // newest, oldest, name
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
    
    // Bulk Selection
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    
    // Audit logs states
    const [selectedDoc, setSelectedDoc] = useState<any>(null);
    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [showLogsModal, setShowLogsModal] = useState(false);

    // Signing Timeline modal
    const [timelineDoc, setTimelineDoc] = useState<any>(null);
    const [showTimelineModal, setShowTimelineModal] = useState(false);

    // Toast message state
    const [toast, setToast] = useState('');
    const [userRole, setUserRole] = useState(localStorage.getItem('docu_user_role') || 'member');
    const [currentUser, setCurrentUser] = useState<any>(null);

    const fetchDocuments = async () => {
        setLoading(true);
        try {
            const [activeData, archivedData] = await Promise.all([
                apiCall('documents'),
                apiCall('documents?status=archived')
            ]);
            setAllDocs([...activeData, ...archivedData]);
        } catch (err) {
            console.error('Failed to load documents:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDocuments();
        const role = localStorage.getItem('docu_user_role') || 'member';
        setUserRole(role);
        
        apiCall('auth/me')
            .then(data => setCurrentUser(data.user))
            .catch(err => console.error(err));
    }, []);

    const showToastMsg = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(''), 3000);
    };

    const handleCopyLink = (token: string) => {
        const link = `${window.location.origin}/docu/public/sign/${token}`;
        navigator.clipboard.writeText(link)
            .then(() => showToastMsg('Signature link copied to clipboard!'))
            .catch(err => console.error('Copy failed:', err));
    };

    const handleResend = async (id: string) => {
        try {
            await apiCall(`documents/${id}/resend`, { method: 'POST' });
            showToastMsg('Reminder notification email dispatched!');
        } catch (err: any) {
            alert(err.message || 'Failed to dispatch reminder');
        }
    };

    const handleArchive = async (id: string) => {
        try {
            await apiCall(`documents/${id}/archive`, { method: 'POST' });
            showToastMsg('Document moved to archives');
            fetchDocuments();
        } catch (err) {
            console.error(err);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Are you sure you want to permanently delete this document and all related audit files?')) return;
        try {
            await apiCall(`documents/${id}`, { method: 'DELETE' });
            showToastMsg('Document deleted successfully');
            fetchDocuments();
        } catch (err) {
            console.error(err);
        }
    };

    const handleDuplicate = async (id: string) => {
        try {
            const res = await apiCall(`documents/${id}/duplicate`, { method: 'POST' });
            showToastMsg('Document configuration duplicated!');
            navigate(`/documents/${res._id}/editor`);
        } catch (err) {
            console.error(err);
        }
    };

    const viewAuditLogs = async (doc: any) => {
        setSelectedDoc(doc);
        try {
            const logs = await apiCall(`documents/${doc._id}/audit-logs`);
            setAuditLogs(logs);
            setShowLogsModal(true);
        } catch (err) {
            console.error(err);
        }
    };

    // Bulk actions
    const handleToggleSelect = (id: string) => {
        if (selectedIds.includes(id)) {
            setSelectedIds(prev => prev.filter(x => x !== id));
        } else {
            setSelectedIds(prev => [...prev, id]);
        }
    };

    const handleSelectAll = (filteredList: any[]) => {
        if (selectedIds.length === filteredList.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredList.map(d => d._id));
        }
    };

    const handleBulkArchive = async () => {
        if (!window.confirm(`Archive ${selectedIds.length} selected documents?`)) return;
        setLoading(true);
        try {
            await Promise.all(selectedIds.map(id => apiCall(`documents/${id}/archive`, { method: 'POST' })));
            showToastMsg(`Successfully archived ${selectedIds.length} documents.`);
            setSelectedIds([]);
            fetchDocuments();
        } catch (err) {
            console.error('Bulk archive failed:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleBulkRemind = async () => {
        setLoading(true);
        try {
            let count = 0;
            await Promise.all(selectedIds.map(async id => {
                const doc = allDocs.find(d => d._id === id);
                const activeSigner = doc?.recipients?.find((r: any) => ['sent', 'viewed'].includes(r.status) && r.role === 'signer');
                if (activeSigner) {
                    await apiCall(`documents/${id}/resend`, { method: 'POST' });
                    count++;
                }
            }));
            showToastMsg(`Reminders sent for ${count} documents.`);
            setSelectedIds([]);
        } catch (err) {
            console.error('Bulk reminders failed:', err);
        } finally {
            setLoading(false);
        }
    };
    const handleResetRecipient = async (recipient: any) => {
        const newEmail = window.prompt(`Update email address to resend signature link to ${recipient.name}:`, recipient.email);
        if (newEmail === null) return;

        try {
            await apiCall(`documents/${timelineDoc._id}/recipients/${recipient._id}/reset`, {
                method: 'POST',
                body: { email: newEmail }
            });
            alert('Recipient reset successfully! Email sent to the new address.');
            const updatedDoc = await apiCall(`documents/${timelineDoc._id}`);
            setTimelineDoc(updatedDoc);
            fetchDocuments();
        } catch (err: any) {
            console.error(err);
            alert(err.message || 'Failed to reset recipient.');
        }
    };

    // Filters and sorting
    const folderFiltered = allDocs.filter(doc => {
        if (activeFolder === 'all') return doc.status !== 'archived';
        if (activeFolder === 'waiting') return ['sent', 'viewed'].includes(doc.status);
        if (activeFolder === 'approvals') {
            return doc.status !== 'archived' && doc.recipients?.some((r: any) => 
                r.email.toLowerCase() === currentUser?.email?.toLowerCase() && 
                ['sent', 'viewed'].includes(r.status)
            );
        }
        return doc.status === activeFolder;
    });

    const searchedDocs = folderFiltered.filter(doc => {
        const query = searchTerm.toLowerCase();
        return doc.document_name.toLowerCase().includes(query) ||
            doc.recipients?.some((r: any) => r.email.toLowerCase().includes(query) || r.name.toLowerCase().includes(query));
    });

    const sortedDocs = [...searchedDocs].sort((a, b) => {
        if (sortBy === 'newest') {
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        if (sortBy === 'oldest') {
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }
        if (sortBy === 'name') {
            return a.document_name.localeCompare(b.document_name);
        }
        return 0;
    });

    const folders = [
        { id: 'all', label: 'All Documents', count: allDocs.filter(d => d.status !== 'archived').length, icon: <FolderOpen size={15} /> },
        { 
            id: 'approvals', 
            label: 'Action Required', 
            count: allDocs.filter(d => 
                d.status !== 'archived' && 
                d.recipients?.some((r: any) => 
                    r.email.toLowerCase() === currentUser?.email?.toLowerCase() && 
                    ['sent', 'viewed'].includes(r.status)
                )
            ).length, 
            icon: <BadgeAlert size={15} style={{ color: '#ef4444' }} /> 
        },
        { id: 'draft', label: 'Drafts', count: allDocs.filter(d => d.status === 'draft').length, icon: <FileText size={15} /> },
        { id: 'waiting', label: 'Waiting for Others', count: allDocs.filter(d => ['sent', 'viewed'].includes(d.status)).length, icon: <Clock size={15} /> },
        { id: 'completed', label: 'Completed', count: allDocs.filter(d => d.status === 'completed').length, icon: <FileCheck size={15} /> },
        { id: 'expired', label: 'Expired', count: allDocs.filter(d => d.status === 'expired').length, icon: <ShieldAlert size={15} /> },
        { id: 'declined', label: 'Declined', count: allDocs.filter(d => d.status === 'declined').length, icon: <BadgeAlert size={15} /> },
        { id: 'archived', label: 'Archived', count: allDocs.filter(d => d.status === 'archived').length, icon: <Archive size={15} /> }
    ];

    return (
        <DashboardLayout title="Documents">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.5px' }}>Document Manager</h2>
                    <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.2rem' }}>Track, audit, and organize signature contracts in your workspaces.</p>
                </div>
                {userRole !== 'viewer' && (
                    <button className="btn btn-primary" style={{ height: '40px', background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', borderRadius: '8px', fontWeight: 800, boxShadow: '0 4px 12px rgba(37,99,235,0.25)' }} onClick={() => navigate('/documents/new')}>
                        <Plus size={16} /> Upload & Prepare PDF
                    </button>
                )}
            </div>

            <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                {/* Folders Sidebar */}
                <div style={{ width: '220px', display: 'flex', flexDirection: 'column', gap: '0.25rem', flexShrink: 0 }}>
                    {folders.map(f => (
                        <button
                            key={f.id}
                            onClick={() => {
                                setActiveFolder(f.id);
                                setSelectedIds([]);
                            }}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                width: '100%',
                                padding: '0.7rem 0.85rem',
                                border: 'none',
                                background: activeFolder === f.id ? '#eff6ff' : 'transparent',
                                color: activeFolder === f.id ? '#2563eb' : '#475569',
                                fontWeight: activeFolder === f.id ? 800 : 600,
                                fontSize: '0.85rem',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={e => {
                                if (activeFolder !== f.id) e.currentTarget.style.backgroundColor = '#f1f5f9';
                            }}
                            onMouseLeave={e => {
                                if (activeFolder !== f.id) e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                        >
                            <span style={{ display: 'flex', alignItems: 'center', opacity: activeFolder === f.id ? 1 : 0.7 }}>
                                {f.icon}
                            </span>
                            <span style={{ flex: 1, textAlign: 'left' }}>{f.label}</span>
                            <span style={{
                                fontSize: '0.65rem',
                                background: activeFolder === f.id ? '#3b82f6' : '#e2e8f0',
                                color: activeFolder === f.id ? 'white' : '#64748b',
                                padding: '2px 7px',
                                borderRadius: '999px',
                                fontWeight: 800
                            }}>{f.count}</span>
                        </button>
                    ))}
                </div>

                {/* Main Documents Workspace */}
                <div style={{ flex: 1, minWidth: '320px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* Controls Bar */}
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
                            <input 
                                type="text" 
                                placeholder="Search by document name or email..." 
                                className="form-input"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{ paddingLeft: '2.5rem', height: '38px', fontSize: '0.8rem', borderRadius: '8px', borderColor: '#cbd5e1' }}
                            />
                            <Search size={15} style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        </div>

                        {/* Sort Dropdown */}
                        <div style={{ width: '160px' }}>
                            <Select
                                value={sortBy}
                                onChange={(val) => setSortBy(val)}
                                options={[
                                    { value: 'newest', label: 'Newest First' },
                                    { value: 'oldest', label: 'Oldest First' },
                                    { value: 'name', label: 'Name A-Z' }
                                ]}
                            />
                        </div>

                        {/* Layout Toggle */}
                        <div style={{ display: 'flex', border: '1px solid #cbd5e1', borderRadius: '8px', background: 'white', padding: '3px', height: '38px', alignItems: 'center' }}>
                            <button
                                onClick={() => setViewMode('list')}
                                style={{ padding: '6px 10px', border: 'none', background: viewMode === 'list' ? '#eff6ff' : 'transparent', color: viewMode === 'list' ? '#2563eb' : '#64748b', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                            >
                                <List size={15} />
                            </button>
                            <button
                                onClick={() => setViewMode('grid')}
                                style={{ padding: '6px 10px', border: 'none', background: viewMode === 'grid' ? '#eff6ff' : 'transparent', color: viewMode === 'grid' ? '#2563eb' : '#64748b', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                            >
                                <Grid size={15} />
                            </button>
                        </div>
                    </div>

                    {/* Bulk Action Bar */}
                    {userRole !== 'viewer' && selectedIds.length > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '0.85rem 1.25rem', fontSize: '0.8rem', color: '#1e40af', fontWeight: 800 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Check size={16} strokeWidth={3} />
                                <span>{selectedIds.length} items selected</span>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button className="btn btn-secondary" style={{ padding: '0.45rem 1rem', fontSize: '0.75rem', color: '#1e40af', borderColor: '#bfdbfe', borderRadius: '6px', background: 'white' }} onClick={handleBulkRemind}>
                                    <Send size={12} /> Send Reminders
                                </button>
                                {activeFolder !== 'archived' && (
                                    <button className="btn btn-secondary" style={{ padding: '0.45rem 1rem', fontSize: '0.75rem', color: '#1e40af', borderColor: '#bfdbfe', borderRadius: '6px', background: 'white' }} onClick={handleBulkArchive}>
                                        <Lock size={12} /> Archive Selected
                                    </button>
                                )}
                                <button className="btn btn-danger" style={{ padding: '0.45rem 1rem', fontSize: '0.75rem', borderRadius: '6px' }} onClick={() => setSelectedIds([])}>
                                    Clear Selection
                                </button>
                            </div>
                        </div>
                    )}

                    {/* List Mode / Grid Mode */}
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '4rem 2rem', color: '#64748b', background: 'white', border: '1px solid #e2e8f0', borderRadius: '14px', boxShadow: 'var(--shadow-sm)' }}>
                            <div className="spinner" style={{ margin: '0 auto 1rem auto' }}></div>
                            <p style={{ fontSize: '0.85rem', fontWeight: 600 }}>Loading documents workspace...</p>
                        </div>
                    ) : sortedDocs.length === 0 ? (
                        <div className="empty-state" style={{ background: 'white', border: '1px solid #e2e8f0', padding: '5rem 2rem', borderRadius: '14px', boxShadow: 'var(--shadow-sm)' }}>
                            <FileText className="empty-state-icon" size={48} style={{ color: '#cbd5e1' }} />
                            <h3 style={{ fontWeight: 800 }}>No documents in this folder</h3>
                            <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Try searching another keyword or upload a new PDF contract draft.</p>
                            <button className="btn btn-primary" style={{ fontSize: '0.8rem', borderRadius: '6px', marginTop: '0.5rem' }} onClick={() => navigate('/documents/new')}>
                                Upload Document
                            </button>
                        </div>
                    ) : viewMode === 'list' ? (
                        /* LIST TABLE VIEW */
                        <div className="card-table-wrapper" style={{ margin: 0, border: '1px solid #e2e8f0', borderRadius: '14px' }}>
                            <table className="docu-table" style={{ fontSize: '0.8rem' }}>
                                <thead>
                                    <tr>
                                        {userRole !== 'viewer' && (
                                            <th style={{ width: '45px', padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                                                <input 
                                                    type="checkbox" 
                                                    checked={selectedIds.length === sortedDocs.length && sortedDocs.length > 0} 
                                                    onChange={() => handleSelectAll(sortedDocs)}
                                                    style={{ cursor: 'pointer', width: '15px', height: '15px' }}
                                                />
                                            </th>
                                        )}
                                        <th>Document Name</th>
                                        <th>Signers</th>
                                        <th>Status</th>
                                        <th>Sent Date</th>
                                        <th style={{ textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedDocs.map((doc) => {
                                        const activeSigner = doc.recipients?.find((r: any) => ['sent', 'viewed'].includes(r.status) && ['signer', 'admin'].includes(r.role));
                                        const myRecipient = doc.recipients?.find((r: any) => 
                                            r.email.toLowerCase() === currentUser?.email?.toLowerCase() && 
                                            ['sent', 'viewed'].includes(r.status)
                                        );
                                        const isSelected = selectedIds.includes(doc._id);
                                        return (
                                            <tr key={doc._id} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: isSelected ? '#f8fafc' : 'white' }}>
                                                {userRole !== 'viewer' && (
                                                    <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                                                        <input 
                                                            type="checkbox" 
                                                            checked={isSelected} 
                                                            onChange={() => handleToggleSelect(doc._id)}
                                                            style={{ cursor: 'pointer', width: '15px', height: '15px' }}
                                                        />
                                                    </td>
                                                )}
                                                <td style={{ fontWeight: 800, color: '#0f172a' }}>{doc.document_name}</td>
                                                <td>
                                                     <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                         {doc.recipients?.filter((r: any) => ['signer', 'admin'].includes(r.role)).map((r: any, idx: number) => {
                                                             const isSigned = r.status === 'completed';
                                                             const isDeclined = r.status === 'declined';
                                                             const isActive = ['sent', 'viewed'].includes(r.status);
                                                             const statusColor = isSigned ? '#10b981' : isDeclined ? '#ef4444' : isActive ? '#3b82f6' : '#94a3b8';
                                                             return (
                                                                 <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', flexWrap: 'wrap' }}>
                                                                     <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: statusColor, flexShrink: 0 }} />
                                                                     <span style={{ color: isSigned ? '#10b981' : isDeclined ? '#ef4444' : '#475569', fontWeight: isSigned ? 700 : 500 }}>
                                                                         {r.name}
                                                                     </span>
                                                                     {isSigned && r.completed_at && (
                                                                         <span style={{ fontSize: '0.65rem', color: '#10b981', background: '#ecfdf5', padding: '1px 5px', borderRadius: '4px', fontWeight: 800, whiteSpace: 'nowrap' }}>
                                                                             {new Date(r.completed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} {new Date(r.completed_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                                                         </span>
                                                                     )}
                                                                 </div>
                                                             );
                                                         }) || <span style={{ fontStyle: 'italic', color: '#94a3b8' }}>None</span>}
                                                     </div>
                                                </td>
                                                <td>
                                                    <span className={`badge badge-${doc.status}`} style={{ fontSize: '0.65rem', textTransform: 'uppercase' }}>{doc.status}</span>
                                                </td>
                                                <td style={{ color: '#64748b', fontWeight: 500 }}>
                                                    {doc.sent_at ? new Date(doc.sent_at).toLocaleDateString('en-GB') : 'Draft'}
                                                </td>
                                                <td style={{ textAlign: 'right' }}>
                                                    <div style={{ display: 'inline-flex', gap: '0.25rem' }}>
                                                        {doc.status === 'completed' && doc.final_file_url && (
                                                            <>
                                                                <a href={doc.final_file_url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ padding: '0.4rem', borderRadius: '6px' }} title="Download Signed PDF">
                                                                    <Download size={13} />
                                                                </a>
                                                                {doc.audit_report_url && (
                                                                    <a href={doc.audit_report_url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ padding: '0.4rem', borderRadius: '6px', color: '#10b981' }} title="Download Audit Certificate">
                                                                        <FileCheck size={13} />
                                                                    </a>
                                                                )}
                                                            </>
                                                        )}
                                                        
                                                        {myRecipient && (
                                                            <a href={`${window.location.origin}/public/sign/${myRecipient.secure_token}`} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.72rem', background: '#10b981', color: 'white', borderRadius: '6px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', fontWeight: 800 }} title="Sign/Approve Document">
                                                                Sign / Approve
                                                            </a>
                                                        )}

                                                        {userRole !== 'viewer' && doc.status !== 'completed' && (
                                                            <button className="btn btn-secondary" style={{ padding: '0.4rem', borderRadius: '6px' }} onClick={() => navigate(`/documents/${doc._id}/editor`)} title="Open Editor">
                                                                <Eye size={13} />
                                                            </button>
                                                        )}
                                                        
                                                        {userRole !== 'viewer' && activeSigner && (
                                                            <button className="btn btn-secondary" style={{ padding: '0.4rem', borderRadius: '6px', color: '#2563eb' }} onClick={() => handleCopyLink(activeSigner.secure_token)} title="Copy Link">
                                                                <Copy size={13} />
                                                            </button>
                                                        )}
                                                        
                                                        {userRole !== 'viewer' && doc.status !== 'completed' && doc.status !== 'draft' && (
                                                            <button className="btn btn-secondary" style={{ padding: '0.4rem', borderRadius: '6px', color: '#f59e0b' }} onClick={() => handleResend(doc._id)} title="Send Reminder">
                                                                <Send size={13} />
                                                            </button>
                                                        )}

                                                        {userRole !== 'viewer' && (
                                                            <button className="btn btn-secondary" style={{ padding: '0.4rem', borderRadius: '6px' }} onClick={() => handleDuplicate(doc._id)} title="Duplicate">
                                                                <Layers size={13} />
                                                            </button>
                                                        )}

                                                        {userRole !== 'viewer' && (
                                                            <button className="btn btn-secondary" style={{ padding: '0.4rem', borderRadius: '6px' }} onClick={() => viewAuditLogs(doc)} title="History logs">
                                                                <History size={13} />
                                                            </button>
                                                        )}

                                                        {doc.recipients?.length > 0 && (
                                                            <button className="btn btn-secondary" style={{ padding: '0.4rem', borderRadius: '6px', color: '#7c3aed' }} onClick={() => { setTimelineDoc(doc); setShowTimelineModal(true); }} title="Signing Timeline">
                                                                <Calendar size={13} />
                                                            </button>
                                                        )}

                                                        {userRole !== 'viewer' && doc.status !== 'archived' && (
                                                            <button className="btn btn-secondary" style={{ padding: '0.4rem', borderRadius: '6px' }} onClick={() => handleArchive(doc._id)} title="Archive">
                                                                <Lock size={13} />
                                                            </button>
                                                        )}

                                                        {userRole !== 'viewer' && (
                                                            <button className="btn btn-danger" style={{ padding: '0.4rem', borderRadius: '6px' }} onClick={() => handleDelete(doc._id)} title="Delete">
                                                                <Trash2 size={13} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        /* GRID LAYOUT VIEW */
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem', textAlign: 'left' }}>
                            {sortedDocs.map((doc) => {
                                const activeSigner = doc.recipients?.find((r: any) => ['sent', 'viewed'].includes(r.status) && ['signer', 'admin'].includes(r.role));
                                const isSelected = selectedIds.includes(doc._id);
                                return (
                                    <div 
                                        key={doc._id}
                                        style={{
                                            background: 'white',
                                            border: isSelected ? '2px solid #2563eb' : '1px solid #e2e8f0',
                                            borderRadius: '14px',
                                            padding: '1.25rem',
                                            boxShadow: 'var(--shadow-sm)',
                                            position: 'relative',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            justifyContent: 'space-between',
                                            minHeight: '190px',
                                            transition: 'all 0.15s ease'
                                        }}
                                    >
                                        {userRole !== 'viewer' && (
                                            <input 
                                                type="checkbox" 
                                                checked={isSelected}
                                                onChange={() => handleToggleSelect(doc._id)}
                                                style={{ position: 'absolute', top: '16px', left: '16px', cursor: 'pointer', width: '16px', height: '16px', zIndex: 5 }}
                                            />
                                        )}

                                        <div style={{ paddingLeft: userRole !== 'viewer' ? '1.75rem' : '0rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                                                <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a', margin: 0, wordBreak: 'break-all', lineHeight: 1.3 }}>{doc.document_name}</h4>
                                                <span className={`badge badge-${doc.status}`} style={{ fontSize: '0.55rem', textTransform: 'uppercase', flexShrink: 0 }}>{doc.status}</span>
                                            </div>
                                            
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '0.25rem' }}>
                                                <div style={{ fontSize: '0.75rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <User size={12} style={{ opacity: 0.5 }} />
                                                    <span>{doc.recipients?.[0] ? `${doc.recipients[0].name}` : 'No signers'}</span>
                                                </div>
                                                <div style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <Calendar size={12} style={{ opacity: 0.5 }} />
                                                    <span>Sent: {doc.sent_at ? new Date(doc.sent_at).toLocaleDateString('en-GB') : 'Draft'}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', gap: '0.25rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem', marginTop: '1rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                            {doc.status === 'completed' && doc.final_file_url && (
                                                <>
                                                    <a href={doc.final_file_url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ padding: '0.4rem', borderRadius: '6px' }} title="Download Signed PDF">
                                                        <Download size={13} />
                                                    </a>
                                                    {doc.audit_report_url && (
                                                        <a href={doc.audit_report_url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ padding: '0.4rem', borderRadius: '6px', color: '#10b981' }} title="Download Audit Certificate">
                                                            <FileCheck size={13} />
                                                        </a>
                                                    )}
                                                </>
                                            )}
                                            
                                            {userRole !== 'viewer' && doc.status !== 'completed' && (
                                                <button className="btn btn-secondary" style={{ padding: '0.4rem', borderRadius: '6px' }} onClick={() => navigate(`/documents/${doc._id}/editor`)} title="Open Editor">
                                                    <Eye size={13} />
                                                </button>
                                            )}

                                            {userRole !== 'viewer' && activeSigner && (
                                                <button className="btn btn-secondary" style={{ padding: '0.4rem', borderRadius: '6px', color: '#2563eb' }} onClick={() => handleCopyLink(activeSigner.secure_token)} title="Copy Link">
                                                    <Copy size={13} />
                                                </button>
                                            )}

                                            {userRole !== 'viewer' && doc.status !== 'completed' && doc.status !== 'draft' && (
                                                <button className="btn btn-secondary" style={{ padding: '0.4rem', borderRadius: '6px', color: '#f59e0b' }} onClick={() => handleResend(doc._id)} title="Send Reminder">
                                                    <Send size={13} />
                                                </button>
                                            )}

                                            {userRole !== 'viewer' && (
                                                <button className="btn btn-secondary" style={{ padding: '0.4rem', borderRadius: '6px' }} onClick={() => viewAuditLogs(doc)} title="History">
                                                    <History size={13} />
                                                </button>
                                            )}

                                            {doc.recipients?.length > 0 && (
                                                <button className="btn btn-secondary" style={{ padding: '0.4rem', borderRadius: '6px', color: '#7c3aed' }} onClick={() => { setTimelineDoc(doc); setShowTimelineModal(true); }} title="Signing Timeline">
                                                    <Calendar size={13} />
                                                </button>
                                            )}
                                            
                                            {userRole !== 'viewer' && (
                                                <button className="btn btn-danger" style={{ padding: '0.4rem', borderRadius: '6px' }} onClick={() => handleDelete(doc._id)} title="Delete">
                                                    <Trash2 size={13} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Audit Logs Modal */}
            {showLogsModal && selectedDoc && (
                <div className="modal-overlay">
                    <div className="modal-container" style={{ maxWidth: '600px', borderRadius: '16px' }}>
                        <div className="modal-header">
                            <div>
                                <h2 style={{ fontSize: '1.1rem', fontWeight: 900 }}>Audit Trail logs</h2>
                                <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block', marginTop: '4px' }}>{selectedDoc.document_name}</span>
                            </div>
                            <button className="close-btn" onClick={() => setShowLogsModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                            {auditLogs.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '2.5rem', color: '#94a3b8', background: '#f8fafc', borderRadius: '10px' }}>No logs registered for this document.</div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {auditLogs.map((log) => (
                                        <div key={log._id} style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem', fontSize: '0.75rem', textAlign: 'left' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', marginBottom: '0.35rem' }}>
                                                <span>{new Date(log.createdAt).toLocaleString('en-GB')}</span>
                                                {log.ip_address && <span style={{ fontWeight: 700 }}>IP: {log.ip_address}</span>}
                                            </div>
                                            <div style={{ fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <div style={{ width: '5px', height: '5px', background: '#2563eb', borderRadius: '50%' }} />
                                                {log.event_type.replace(/_/g, ' ')}
                                            </div>
                                            {log.user_id?.full_name && <div style={{ color: '#475569', marginTop: '2px' }}>Executed by: <strong>{log.user_id.full_name}</strong></div>}
                                            {log.recipient_email && <div style={{ color: '#475569', marginTop: '2px' }}>Recipient: <strong>{log.recipient_email}</strong></div>}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="modal-footer" style={{ background: '#f8fafc' }}>
                            <button className="btn btn-secondary" style={{ borderRadius: '6px' }} onClick={() => setShowLogsModal(false)}>Close</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Signing Timeline Modal */}
            {showTimelineModal && timelineDoc && (
                <div className="modal-overlay">
                    <div className="modal-container" style={{ maxWidth: '580px', borderRadius: '16px' }}>
                        <div className="modal-header">
                            <div>
                                <h2 style={{ fontSize: '1.1rem', fontWeight: 900 }}>Signing Timeline</h2>
                                <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block', marginTop: '4px' }}>{timelineDoc.document_name}</span>
                            </div>
                            <button className="close-btn" onClick={() => setShowTimelineModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body" style={{ padding: '1.5rem' }}>
                            {/* Document metadata */}
                            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                                <div style={{ flex: 1, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem 1rem' }}>
                                    <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>Sent On</div>
                                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a' }}>{timelineDoc.sent_at ? new Date(timelineDoc.sent_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</div>
                                </div>
                                <div style={{ flex: 1, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem 1rem' }}>
                                    <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>Signing Mode</div>
                                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a' }}>{timelineDoc.signing_order_enabled ? '🔢 Sequential' : '🔀 Parallel'}</div>
                                </div>
                                <div style={{ flex: 1, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem 1rem' }}>
                                    <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>Expires</div>
                                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: timelineDoc.expires_at && new Date(timelineDoc.expires_at) < new Date() ? '#ef4444' : '#0f172a' }}>
                                        {timelineDoc.expires_at ? new Date(timelineDoc.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                                    </div>
                                </div>
                            </div>

                            {/* Signing Progress Bar */}
                            {(() => {
                                const signers = timelineDoc.recipients?.filter((r: any) => ['signer', 'admin'].includes(r.role)) || [];
                                const completed = signers.filter((r: any) => r.status === 'completed').length;
                                const pct = signers.length > 0 ? Math.round((completed / signers.length) * 100) : 0;
                                return (
                                    <div style={{ marginBottom: '1.5rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>Signing Progress</span>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#2563eb' }}>{completed} / {signers.length} signed</span>
                                        </div>
                                        <div style={{ height: '6px', background: '#f1f5f9', borderRadius: '99px', overflow: 'hidden' }}>
                                            <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? '#10b981' : '#2563eb', borderRadius: '99px', transition: 'width 0.3s ease' }} />
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Recipient Timeline */}
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>Recipients</div>
                            <div style={{ position: 'relative' }}>
                                {[...(timelineDoc.recipients || [])]
                                    .sort((a: any, b: any) => a.signing_order - b.signing_order)
                                    .map((r: any, idx: number, arr: any[]) => {
                                        const statusColor = r.status === 'completed' ? '#10b981' : r.status === 'sent' || r.status === 'viewed' ? '#2563eb' : r.status === 'declined' ? '#ef4444' : '#94a3b8';
                                        const statusBg = r.status === 'completed' ? '#dcfce7' : r.status === 'sent' || r.status === 'viewed' ? '#dbeafe' : r.status === 'declined' ? '#fee2e2' : '#f1f5f9';
                                        const statusLabel = r.status === 'completed' ? '✓ Signed' : r.status === 'viewed' ? '👁 Viewing' : r.status === 'sent' ? '📧 Email Sent' : r.status === 'declined' ? '✗ Declined' : '⏳ Waiting';
                                        return (
                                            <div key={idx} style={{ display: 'flex', gap: '1rem', paddingBottom: idx < arr.length - 1 ? '1.5rem' : 0, position: 'relative' }}>
                                                {/* Timeline line */}
                                                {idx < arr.length - 1 && (
                                                    <div style={{ position: 'absolute', left: '15px', top: '32px', width: '2px', height: 'calc(100% - 8px)', background: r.status === 'completed' ? '#d1fae5' : '#e2e8f0' }} />
                                                )}
                                                {/* Circle */}
                                                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: statusBg, border: `2px solid ${statusColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '0.7rem', fontWeight: 800, color: statusColor, zIndex: 1 }}>
                                                    {r.role === 'cc' ? 'CC' : r.signing_order}
                                                </div>
                                                {/* Content */}
                                                <div style={{ flex: 1, paddingTop: '4px' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                                                        <div>
                                                            <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.85rem' }}>{r.name}</div>
                                                            <div style={{ color: '#94a3b8', fontSize: '0.72rem' }}>{r.email}</div>
                                                        </div>
                                                        <span style={{ fontSize: '0.65rem', fontWeight: 800, background: statusBg, color: statusColor, padding: '2px 8px', borderRadius: '99px', whiteSpace: 'nowrap' }}>
                                                            {statusLabel}
                                                        </span>
                                                    </div>
                                                    {/* Timestamps */}
                                                    <div style={{ marginTop: '6px', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                                        {r.viewed_at && (
                                                            <span style={{ fontSize: '0.7rem', color: '#64748b' }}>👁 Viewed: <strong>{new Date(r.viewed_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</strong></span>
                                                        )}
                                                    {r.completed_at && (
                                                            <span style={{ fontSize: '0.7rem', color: '#10b981' }}>✓ Signed: <strong>{new Date(r.completed_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</strong></span>
                                                        )}
                                                        {!r.viewed_at && !r.completed_at && r.status === 'sent' && (
                                                            <span style={{ fontSize: '0.7rem', color: '#64748b' }}>📧 Awaiting action...</span>
                                                        )}
                                                        {r.status === 'pending' && (
                                                            <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Will be notified after previous signer</span>
                                                        )}
                                                    </div>
                                                    {r.status === 'declined' && (
                                                        <>
                                                            <div style={{ marginTop: '0.35rem', padding: '0.4rem 0.6rem', background: '#fee2e2', borderLeft: '3px solid #ef4444', borderRadius: '4px', color: '#991b1b', fontSize: '0.72rem', lineHeight: 1.4 }}>
                                                                <strong>Decline Reason:</strong> {r.decline_reason || 'No reason provided'}
                                                            </div>
                                                            {userRole !== 'viewer' && (
                                                                <button 
                                                                    onClick={() => handleResetRecipient(r)}
                                                                    style={{ marginTop: '0.5rem', background: '#2563eb', border: 'none', color: 'white', borderRadius: '4px', padding: '0.3rem 0.6rem', fontSize: '0.7rem', fontWeight: 'bold', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                                                                >
                                                                    ✏️ Edit Email & Resend
                                                                </button>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>
                        <div className="modal-footer" style={{ background: '#f8fafc' }}>
                            <button className="btn btn-secondary" style={{ borderRadius: '6px' }} onClick={() => setShowTimelineModal(false)}>Close</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast overlay feedback */}
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

export default DocumentsList;
