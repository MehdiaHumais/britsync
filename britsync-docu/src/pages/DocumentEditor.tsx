import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiCall } from '../utils/api';
import { 
    ArrowLeft, Save, ArrowRight, Trash2, HelpCircle, Type, PenTool, 
    CheckSquare, Calendar, ChevronDown, Award, Undo2, Redo2, 
    ZoomIn, ZoomOut, Copy, FileUp, Info
} from 'lucide-react';
import { Select } from '../components/ui/Select';

// CDN loader for PDFJS (consistent with existing app)
const loadPdfJs = (): Promise<any> => {
    return new Promise((resolve, reject) => {
        if ((window as any).pdfjsLib) {
            resolve((window as any).pdfjsLib);
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js';
        script.onload = () => {
            (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
            resolve((window as any).pdfjsLib);
        };
        script.onerror = reject;
        document.body.appendChild(script);
    });
};

interface PlacedField {
    _id: string;
    page_number: number;
    field_type: string;
    label: string;
    placeholder: string;
    required: boolean;
    x_percent: number;
    y_percent: number;
    width_percent: number;
    height_percent: number;
    assigned_recipient_id: string;
    value?: string;
    options_json?: string;
    validation_type?: string;
    font_size?: number;
    alignment?: string;
    date_format?: string;
    help_text?: string;
}

export const DocumentEditor: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    useEffect(() => {
        const role = localStorage.getItem('docu_user_role') || 'member';
        if (role === 'viewer') {
            alert('Permission denied. Viewers cannot edit documents.');
            navigate('/dashboard');
        }
    }, [navigate]);

    // Editor state
    const [doc, setDoc] = useState<any>(null);
    const [fields, setFields] = useState<PlacedField[]>([]);
    const [recipients, setRecipients] = useState<any[]>([]);
    const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
    
    // Config states
    const [activeTool, setActiveTool] = useState<string>('text');
    const [pdfDoc, setPdfDoc] = useState<any>(null);
    const [numPages, setNumPages] = useState<number>(0);
    const [zoom, setZoom] = useState<number>(1.2);
    const [saving, setSaving] = useState(false);
    const [loadingPdf, setLoadingPdf] = useState(true);
    
    // Quick Add Signer states
    const [newSignerName, setNewSignerName] = useState('');
    const [newSignerEmail, setNewSignerEmail] = useState('');
    const [addingSigner, setAddingSigner] = useState(false);

    // History stack for Undo / Redo
    const [history, setHistory] = useState<PlacedField[][]>([]);
    const [historyIdx, setHistoryIdx] = useState<number>(-1);

    // Save Auto-save status indicator
    const [autosaveStatus, setAutosaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');

    useEffect(() => {
        const fetchDocDetails = async () => {
            try {
                const docData = await apiCall(`documents/${id}`);
                setDoc(docData);
                const loadedFields = docData.fields || [];
                setFields(loadedFields);
                setRecipients(docData.recipients || []);
                
                // Initialize history
                setHistory([loadedFields]);
                setHistoryIdx(0);

                // Load PDF in background
                const pdfjs = await loadPdfJs();
                const loadedPdf = await pdfjs.getDocument(docData.original_file_url).promise;
                setPdfDoc(loadedPdf);
                setNumPages(loadedPdf.numPages);
            } catch (err) {
                console.error('Failed to load document details:', err);
                alert('Error loading document details.');
                navigate('/dashboard');
            } finally {
                setLoadingPdf(false);
            }
        };

        if (id) fetchDocDetails();
    }, [id, navigate]);

    // Handle updates with history tracking
    const updateFieldsWithHistory = (newFields: PlacedField[]) => {
        setFields(newFields);
        const cleanHistory = history.slice(0, historyIdx + 1);
        cleanHistory.push(newFields);
        setHistory(cleanHistory);
        setHistoryIdx(cleanHistory.length - 1);
        setAutosaveStatus('unsaved');
    };

    const handleUndo = () => {
        if (historyIdx > 0) {
            const prevIdx = historyIdx - 1;
            setFields(history[prevIdx]);
            setHistoryIdx(prevIdx);
            setSelectedFieldId(null);
            setAutosaveStatus('unsaved');
        }
    };

    const handleRedo = () => {
        if (historyIdx < history.length - 1) {
            const nextIdx = historyIdx + 1;
            setFields(history[nextIdx]);
            setHistoryIdx(nextIdx);
            setSelectedFieldId(null);
            setAutosaveStatus('unsaved');
        }
    };

    // Auto-save logic every 10 seconds if unsaved
    useEffect(() => {
        if (autosaveStatus !== 'unsaved') return;
        const timer = setTimeout(async () => {
            setAutosaveStatus('saving');
            try {
                await apiCall(`documents/${id}`, {
                    method: 'PATCH',
                    body: {
                        fields: fields.map(f => {
                            const { _id, ...rest } = f;
                            return _id.startsWith('temp-') ? rest : f;
                        })
                    }
                });
                setAutosaveStatus('saved');
            } catch (err) {
                console.error('Auto-save failed:', err);
                setAutosaveStatus('unsaved');
            }
        }, 8000);

        return () => clearTimeout(timer);
    }, [fields, autosaveStatus, id]);

    const handleSaveDraft = async () => {
        setSaving(true);
        setAutosaveStatus('saving');
        try {
            await apiCall(`documents/${id}`, {
                method: 'PATCH',
                body: {
                    fields: fields.map(f => {
                        const { _id, ...rest } = f;
                        return _id.startsWith('temp-') ? rest : f;
                    })
                }
            });
            setAutosaveStatus('saved');
            alert('Draft configuration saved successfully!');
        } catch (err) {
            console.error('Save failed:', err);
            alert('Failed to save document config.');
            setAutosaveStatus('unsaved');
        } finally {
            setSaving(false);
        }
    };

    const handleContinue = async () => {
        // Validate at least one user signature field
        const hasSig = fields.some(f => f.field_type === 'user_signature');
        if (!hasSig) {
            alert('Please place at least one User Signature field before sending.');
            return;
        }

        setSaving(true);
        try {
            const cleanFields = fields.map(f => {
                const { _id, ...rest } = f;
                return _id.startsWith('temp-') ? rest : f;
            });

            await apiCall(`documents/${id}`, {
                method: 'PATCH',
                body: { fields: cleanFields }
            });
            navigate(`/documents/${id}/send`);
        } catch (err) {
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    const handleQuickAddSigner = async () => {
        if (!newSignerName || !newSignerEmail) {
            alert('Please fill out both Name and Email.');
            return;
        }

        setAddingSigner(true);
        try {
            const newRec = {
                name: newSignerName,
                email: newSignerEmail,
                role: 'signer' as const,
                signing_order: recipients.length + 1,
                secure_token: ''
            };

            const updatedDoc = await apiCall(`documents/${id}`, {
                method: 'PATCH',
                body: {
                    recipients: [...recipients, newRec]
                }
            });

            setRecipients(updatedDoc.recipients || []);
            setNewSignerName('');
            setNewSignerEmail('');
        } catch (err: any) {
            console.error(err);
            alert(err.message || 'Failed to add signer.');
        } finally {
            setAddingSigner(false);
        }
    };

    const handleRemoveRecipient = async (idx: number) => {
        const removed = recipients[idx];
        const updatedRecs = recipients.filter((_, i) => i !== idx);

        if (!window.confirm(`Are you sure you want to remove signer "${removed.name}"? This will clear all fields assigned to them.`)) {
            return;
        }

        try {
            const updatedDoc = await apiCall(`documents/${id}`, {
                method: 'PATCH',
                body: {
                    recipients: updatedRecs,
                    fields: fields.map(f => f.assigned_recipient_id === removed._id ? { ...f, assigned_recipient_id: '' } : f)
                }
            });
            setRecipients(updatedDoc.recipients || []);
            setFields(updatedDoc.fields || []);
            if (selectedFieldId && fields.find(f => f._id === selectedFieldId)?.assigned_recipient_id === removed._id) {
                setSelectedFieldId(null);
            }
        } catch (err: any) {
            console.error(err);
            alert(err.message || 'Failed to remove signer.');
        }
    };

    const handleAddField = (field: PlacedField) => {
        const updated = [...fields, field];
        updateFieldsWithHistory(updated);
        setSelectedFieldId(field._id);
    };

    const handleUpdateField = (fieldId: string, updates: Partial<PlacedField>) => {
        const updated = fields.map(f => f._id === fieldId ? { ...f, ...updates } : f);
        setFields(updated);
        setAutosaveStatus('unsaved');
    };

    const handleDeleteField = (fieldId: string) => {
        const updated = fields.filter(f => f._id !== fieldId);
        updateFieldsWithHistory(updated);
        if (selectedFieldId === fieldId) setSelectedFieldId(null);
    };

    const handleDuplicateField = (field: PlacedField) => {
        const duplicated: PlacedField = {
            ...field,
            _id: 'temp-' + Math.random().toString(36).substring(2, 9),
            x_percent: Math.min(85, field.x_percent + 3),
            y_percent: Math.min(85, field.y_percent + 3),
            label: `${field.label} (Copy)`
        };
        handleAddField(duplicated);
    };

    const selectedField = fields.find(f => f._id === selectedFieldId);

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const activeEl = document.activeElement;
            if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.getAttribute('contenteditable') === 'true')) {
                return;
            }

            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (selectedFieldId) {
                    handleDeleteField(selectedFieldId);
                }
            }

            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
                if (selectedField) {
                    localStorage.setItem('copied_doc_field', JSON.stringify(selectedField));
                }
            }

            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
                const copiedStr = localStorage.getItem('copied_doc_field');
                if (copiedStr) {
                    try {
                        const copied = JSON.parse(copiedStr);
                        const pasted: PlacedField = {
                            ...copied,
                            _id: 'temp-' + Math.random().toString(36).substring(2, 9),
                            x_percent: Math.min(85, copied.x_percent + 2),
                            y_percent: Math.min(85, copied.y_percent + 2)
                        };
                        handleAddField(pasted);
                    } catch (err) {}
                }
            }

            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                handleUndo();
            }

            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
                e.preventDefault();
                handleRedo();
            }

            if (e.key === 'Escape') {
                setSelectedFieldId(null);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedFieldId, selectedField, fields, historyIdx, history]);

    // Categorized tools
    const tools = [
        { id: 'text', name: 'Text Input', icon: <Type size={14} />, category: 'Basic' },
        { id: 'textarea', name: 'Textarea', icon: <Type size={14} />, category: 'Basic' },
        { id: 'user_signature', name: 'Signature', icon: <PenTool size={14} />, category: 'Basic' },
        { id: 'initials', name: 'Initials', icon: <Award size={14} />, category: 'Basic' },
        { id: 'date', name: 'Date Signed', icon: <Calendar size={14} />, category: 'Basic' },
        { id: 'checkbox', name: 'Checkbox', icon: <CheckSquare size={14} />, category: 'Basic' },
        { id: 'dropdown', name: 'Dropdown', icon: <ChevronDown size={14} />, category: 'Basic' },
        { id: 'radio', name: 'Radio Group', icon: <ChevronDown size={14} />, category: 'Basic' },
        { id: 'number', name: 'Number', icon: <Type size={14} />, category: 'Basic' },

        { id: 'fullName', name: 'Full Name', icon: <Type size={14} />, category: 'Recipient Info' },
        { id: 'email', name: 'Email', icon: <Type size={14} />, category: 'Recipient Info' },
        { id: 'phone', name: 'Phone', icon: <Type size={14} />, category: 'Recipient Info' },
        { id: 'address', name: 'Address', icon: <Type size={14} />, category: 'Recipient Info' },
        { id: 'company', name: 'Company', icon: <Type size={14} />, category: 'Recipient Info' },
        { id: 'jobTitle', name: 'Job Title', icon: <Type size={14} />, category: 'Recipient Info' },

        { id: 'fileUpload', name: 'Attachment', icon: <FileUp size={14} />, category: 'Advanced' },
        { id: 'stamp', name: 'Stamp', icon: <PenTool size={14} />, category: 'Advanced' },
        { id: 'approval', name: 'Approval Button', icon: <CheckSquare size={14} />, category: 'Advanced' },
        { id: 'decline', name: 'Decline Reason', icon: <Trash2 size={14} />, category: 'Advanced' },
        { id: 'readonlyNote', name: 'Read-only Note', icon: <Info size={14} />, category: 'Advanced' }
    ];

    const getOptions = (optionsJson: string | undefined): string[] => {
        if (!optionsJson) return [];
        try {
            const parsed = JSON.parse(optionsJson);
            if (Array.isArray(parsed)) return parsed.map(String);
        } catch (e) {}
        return optionsJson.split(',').map(s => s.trim()).filter(Boolean);
    };

    const saveOptions = (opts: string[]) => {
        handleUpdateField(selectedFieldId!, { options_json: JSON.stringify(opts) });
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#f8fafc' }}>
            {/* Editor Top Bar */}
            <div style={{
                height: '64px',
                background: 'white',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 1.5rem',
                position: 'sticky',
                top: 0,
                zIndex: 100,
                boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                    <button className="btn btn-secondary" style={{ padding: '0.45rem 0.9rem' }} onClick={() => navigate('/documents')}>
                        <ArrowLeft size={16} /> Back
                    </button>
                    <span style={{ fontWeight: 800, fontSize: '1rem', color: '#0f172a' }}>{doc?.document_name}</span>
                    <span style={{
                        fontSize: '0.7rem',
                        padding: '2px 8px',
                        background: autosaveStatus === 'saved' ? '#ecfdf5' : autosaveStatus === 'saving' ? '#eff6ff' : '#fffbeb',
                        color: autosaveStatus === 'saved' ? '#10b981' : autosaveStatus === 'saving' ? '#3b82f6' : '#f59e0b',
                        fontWeight: 700,
                        borderRadius: '4px'
                    }}>
                        {autosaveStatus === 'saved' ? 'Saved' : autosaveStatus === 'saving' ? 'Saving...' : 'Unsaved Changes'}
                    </span>
                </div>

                {/* Undo / Redo & Zoom Controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <button 
                        className="btn btn-secondary" 
                        style={{ padding: '0.4rem', minWidth: 'auto' }} 
                        onClick={handleUndo} 
                        disabled={historyIdx <= 0} 
                        title="Undo (Ctrl+Z)"
                    >
                        <Undo2 size={15} />
                    </button>
                    <button 
                        className="btn btn-secondary" 
                        style={{ padding: '0.4rem', minWidth: 'auto' }} 
                        onClick={handleRedo} 
                        disabled={historyIdx >= history.length - 1} 
                        title="Redo (Ctrl+Y)"
                    >
                        <Redo2 size={15} />
                    </button>
                    <div style={{ width: '1px', height: '24px', background: '#e2e8f0', margin: '0 0.5rem' }} />
                    
                    <button className="btn btn-secondary" style={{ padding: '0.4rem', minWidth: 'auto' }} onClick={() => setZoom(z => Math.max(0.6, z - 0.1))} title="Zoom Out">
                        <ZoomOut size={15} />
                    </button>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, width: '48px', textAlign: 'center', color: '#475569' }}>
                        {Math.round(zoom * 100)}%
                    </span>
                    <button className="btn btn-secondary" style={{ padding: '0.4rem', minWidth: 'auto' }} onClick={() => setZoom(z => Math.min(2.0, z + 0.1))} title="Zoom In">
                        <ZoomIn size={15} />
                    </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <button className="btn btn-secondary" onClick={handleSaveDraft} disabled={saving}>
                        <Save size={16} /> Save Draft
                    </button>
                    <button className="btn btn-primary" onClick={handleContinue} disabled={saving}>
                        Continue <ArrowRight size={16} />
                    </button>
                </div>
            </div>

            {/* Editor Workspace */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                {/* Left Toolbelt */}
                <div style={{
                    width: '240px',
                    background: 'white',
                    borderRight: '1px solid #e2e8f0',
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '1.25rem 0.75rem',
                    overflowY: 'auto'
                }}>
                    {['Basic', 'Recipient Info', 'Advanced'].map(cat => (
                        <div key={cat} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '1.25rem' }}>
                            <h3 style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.75px', paddingLeft: '0.4rem', marginBottom: '0.25rem' }}>
                                {cat}
                            </h3>
                            {tools.filter(t => t.category === cat).map(tool => (
                                <button
                                    key={tool.id}
                                    className="btn"
                                    onClick={() => setActiveTool(tool.id)}
                                    style={{
                                        justifyContent: 'flex-start',
                                        backgroundColor: activeTool === tool.id ? '#eff6ff' : 'transparent',
                                        color: activeTool === tool.id ? '#2563eb' : '#475569',
                                        border: activeTool === tool.id ? '1px solid #bfdbfe' : '1px solid transparent',
                                        padding: '0.5rem 0.6rem',
                                        height: 'auto',
                                        borderRadius: '6px'
                                    }}
                                    onMouseEnter={e => {
                                        if (activeTool !== tool.id) e.currentTarget.style.backgroundColor = '#f8fafc';
                                    }}
                                    onMouseLeave={e => {
                                        if (activeTool !== tool.id) e.currentTarget.style.backgroundColor = 'transparent';
                                    }}
                                >
                                    {tool.icon}
                                    <span style={{ marginLeft: '0.4rem', fontSize: '0.8rem', fontWeight: activeTool === tool.id ? 700 : 500 }}>
                                        {tool.name}
                                    </span>
                                </button>
                            ))}
                        </div>
                    ))}
                    
                    <div style={{ marginTop: 'auto', background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.75rem', color: '#64748b', lineHeight: 1.5 }}>
                        💡 <strong>Guide</strong>: Select a tool, then click anywhere on the document canvas to drop a boundary box. Drag edge corners to resize.
                    </div>
                </div>

                {/* Main Scrollable Canvas */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem', backgroundColor: '#f1f5f9' }}>
                    {loadingPdf ? (
                        <div style={{ display: 'flex', minHeight: '50vh', alignItems: 'center', justifyContent: 'center' }}>
                            <div className="spinner"></div>
                        </div>
                    ) : (
                        Array.from({ length: numPages }).map((_, idx) => (
                            <div key={idx} style={{ position: 'relative' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '0.35rem', fontSize: '0.8rem', color: '#64748b', fontWeight: 700 }}>
                                    <span>Page {idx + 1} of {numPages}</span>
                                </div>
                                <EditorPageContainer
                                    pageNum={idx + 1}
                                    pdfDoc={pdfDoc}
                                    activeTool={activeTool}
                                    fields={fields}
                                    recipients={recipients}
                                    onAddField={handleAddField}
                                    onUpdateField={handleUpdateField}
                                    onDeleteField={handleDeleteField}
                                    selectedFieldId={selectedFieldId}
                                    onSelectField={setSelectedFieldId}
                                    zoom={zoom}
                                />
                            </div>
                        ))
                    )}
                </div>

                {/* Right Config Panel */}
                <div style={{
                    width: '300px',
                    background: 'white',
                    borderLeft: '1px solid #e2e8f0',
                    padding: '1.5rem 1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1.25rem',
                    overflowY: 'auto'
                }}>
                    <h3 style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.75px', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
                        Properties
                    </h3>
                    
                    {selectedField ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1.5rem' }}>
                            <div className="form-group">
                                <label className="form-label">Field Label / Tag</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={selectedField.label}
                                    onChange={(e) => handleUpdateField(selectedField._id, { label: e.target.value })}
                                />
                            </div>

                            {['text', 'textarea', 'email', 'phone', 'number', 'fullName', 'company', 'address', 'jobTitle'].includes(selectedField.field_type) && (
                                <div className="form-group">
                                    <label className="form-label">Placeholder Text</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={selectedField.placeholder || ''}
                                        onChange={(e) => handleUpdateField(selectedField._id, { placeholder: e.target.value })}
                                    />
                                </div>
                            )}

                            {/* Options List Editor for Dropdowns & Radios */}
                            {['dropdown', 'radio'].includes(selectedField.field_type) && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>Configured Options</span>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                        {getOptions(selectedField.options_json).map((opt, oIdx, arr) => (
                                            <div key={oIdx} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                <input
                                                    type="text"
                                                    className="form-input"
                                                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', flex: 1 }}
                                                    value={opt}
                                                    onChange={(e) => {
                                                        const copy = [...arr];
                                                        copy[oIdx] = e.target.value;
                                                        saveOptions(copy);
                                                    }}
                                                />
                                                <button
                                                    type="button"
                                                    disabled={oIdx === 0}
                                                    onClick={() => {
                                                        const copy = [...arr];
                                                        const temp = copy[oIdx];
                                                        copy[oIdx] = copy[oIdx - 1];
                                                        copy[oIdx - 1] = temp;
                                                        saveOptions(copy);
                                                    }}
                                                    style={{ padding: '0.2rem', background: 'transparent', border: 'none', cursor: oIdx === 0 ? 'not-allowed' : 'pointer', opacity: oIdx === 0 ? 0.3 : 1 }}
                                                    title="Move Up"
                                                >
                                                    ▲
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={oIdx === arr.length - 1}
                                                    onClick={() => {
                                                        const copy = [...arr];
                                                        const temp = copy[oIdx];
                                                        copy[oIdx] = copy[oIdx + 1];
                                                        copy[oIdx + 1] = temp;
                                                        saveOptions(copy);
                                                    }}
                                                    style={{ padding: '0.2rem', background: 'transparent', border: 'none', cursor: oIdx === arr.length - 1 ? 'not-allowed' : 'pointer', opacity: oIdx === arr.length - 1 ? 0.3 : 1 }}
                                                    title="Move Down"
                                                >
                                                    ▼
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const copy = arr.filter((_, idx) => idx !== oIdx);
                                                        saveOptions(copy);
                                                    }}
                                                    style={{ padding: '0.2rem', color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer' }}
                                                    title="Delete Option"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                                        <input
                                            id="new-opt-input"
                                            type="text"
                                            placeholder="Add Choice..."
                                            className="form-input"
                                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', flex: 1 }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    const val = e.currentTarget.value.trim();
                                                    if (val) {
                                                        const currentOpts = getOptions(selectedField.options_json);
                                                        saveOptions([...currentOpts, val]);
                                                        e.currentTarget.value = '';
                                                    }
                                                }
                                            }}
                                        />
                                        <button
                                            type="button"
                                            className="btn btn-secondary"
                                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                                            onClick={() => {
                                                const el = document.getElementById('new-opt-input') as HTMLInputElement;
                                                const val = el?.value?.trim();
                                                if (val) {
                                                    const currentOpts = getOptions(selectedField.options_json);
                                                    saveOptions([...currentOpts, val]);
                                                    el.value = '';
                                                }
                                            }}
                                        >
                                            Add
                                        </button>
                                    </div>
                                    
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <Select
                                            label="Default Selected"
                                            value={selectedField.value || ''}
                                            onChange={(val) => handleUpdateField(selectedField._id, { value: val })}
                                            options={[
                                                { value: '', label: 'No Default (Placeholder only)' },
                                                ...getOptions(selectedField.options_json).map(opt => ({ value: opt, label: opt }))
                                            ]}
                                        />
                                    </div>
                                </div>
                            )}

                            {selectedField.field_type === 'checkbox' && (
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: '#475569', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={selectedField.value === 'true' || selectedField.value === 'checked'}
                                        onChange={(e) => handleUpdateField(selectedField._id, { value: e.target.checked ? 'true' : 'false' })}
                                    />
                                    Default Checked
                                </label>
                            )}

                            <div className="form-group">
                                <Select
                                    label="Assign Signer Role"
                                    value={selectedField.assigned_recipient_id}
                                    onChange={(val) => handleUpdateField(selectedField._id, { assigned_recipient_id: val })}
                                    placeholder="Choose Signer..."
                                    options={recipients.map((rec) => ({
                                        value: rec._id || rec.email,
                                        label: `${rec.name} (${rec.email})`
                                    }))}
                                />
                            </div>

                            {['text', 'textarea', 'email', 'phone', 'number'].includes(selectedField.field_type) && (
                                <>
                                    <div className="form-group">
                                        <Select
                                            label="Validation Type"
                                            value={selectedField.validation_type || 'none'}
                                            onChange={(val) => handleUpdateField(selectedField._id, { validation_type: val })}
                                            options={[
                                                { value: 'none', label: 'None' },
                                                { value: 'email', label: 'Email Format' },
                                                { value: 'phone', label: 'Phone Number' },
                                                { value: 'number', label: 'Numeric Only' },
                                                { value: 'url', label: 'Web URL' }
                                            ]}
                                        />
                                    </div>

                                    <div className="form-group">
                                        <Select
                                            label="Font Size"
                                            value={String(selectedField.font_size || 12)}
                                            onChange={(val) => handleUpdateField(selectedField._id, { font_size: Number(val) })}
                                            options={[
                                                { value: '8', label: '8 px' },
                                                { value: '10', label: '10 px' },
                                                { value: '12', label: '12 px' },
                                                { value: '14', label: '14 px' },
                                                { value: '16', label: '16 px' },
                                                { value: '18', label: '18 px' }
                                            ]}
                                        />
                                    </div>

                                    <div className="form-group">
                                        <Select
                                            label="Text Alignment"
                                            value={selectedField.alignment || 'left'}
                                            onChange={(val) => handleUpdateField(selectedField._id, { alignment: val })}
                                            options={[
                                                { value: 'left', label: 'Left' },
                                                { value: 'center', label: 'Center' },
                                                { value: 'right', label: 'Right' }
                                            ]}
                                        />
                                    </div>
                                </>
                            )}

                            {selectedField.field_type === 'date' && (
                                <div className="form-group">
                                    <Select
                                        label="Date Format"
                                        value={selectedField.date_format || 'DD/MM/YYYY'}
                                        onChange={(val) => handleUpdateField(selectedField._id, { date_format: val })}
                                        options={[
                                            { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (e.g. 21/06/2026)' },
                                            { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (e.g. 06/21/2026)' },
                                            { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (e.g. 2026-06-21)' }
                                        ]}
                                    />
                                </div>
                            )}

                            {/* Help Guidance Message input */}
                            <div className="form-group">
                                <label className="form-label">Signer Help text</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={selectedField.help_text || ''}
                                    onChange={(e) => handleUpdateField(selectedField._id, { help_text: e.target.value })}
                                    placeholder="Enter instructional guidance..."
                                />
                            </div>

                            {!['stamp', 'readonlyNote', 'approval', 'decline'].includes(selectedField.field_type) && (
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: '#475569', cursor: 'pointer', marginTop: '0.5rem' }}>
                                    <input
                                        type="checkbox"
                                        checked={selectedField.required}
                                        onChange={(e) => handleUpdateField(selectedField._id, { required: e.target.checked })}
                                    />
                                    Mark as Required
                                </label>
                            )}

                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                <button className="btn btn-secondary" style={{ flex: 1, padding: '0.5rem' }} onClick={() => handleDuplicateField(selectedField)}>
                                    <Copy size={14} /> Duplicate
                                </button>
                                <button className="btn btn-danger" style={{ flex: 1, padding: '0.5rem' }} onClick={() => handleDeleteField(selectedField._id)}>
                                    <Trash2 size={14} /> Delete
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center', padding: '1.5rem 0', color: '#94a3b8', fontSize: '0.85rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1.5rem' }}>
                            <HelpCircle size={20} style={{ margin: '0 auto 0.5rem auto', opacity: 0.5 }} />
                            Select a placed element boundary to configure properties.
                        </div>
                    )}

                    {/* Manage Signers Section */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <h3 style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.75px' }}>Document Signers</h3>
                        {recipients.length === 0 ? (
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic', background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                No signers configured yet. Add one below to assign signing fields.
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '160px', overflowY: 'auto', paddingRight: '4px' }}>
                                {recipients.map((rec, rIdx) => (
                                    <div key={rec._id || rIdx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.75rem' }}>
                                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '170px' }}>
                                            <strong>{rec.name}</strong>
                                            <div style={{ color: '#64748b', fontSize: '0.7rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>{rec.email}</div>
                                        </div>
                                        <button 
                                            onClick={() => handleRemoveRecipient(rIdx)}
                                            style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700, padding: '2px 6px' }}
                                            title="Remove Signer"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Add Signer Quick Form */}
                        <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>Quick Add Signer</div>
                            <input 
                                type="text" 
                                placeholder="Signer Name" 
                                className="form-input" 
                                style={{ padding: '0.4rem 0.6rem', fontSize: '0.75rem' }} 
                                value={newSignerName}
                                onChange={e => setNewSignerName(e.target.value)}
                                disabled={addingSigner}
                            />
                            <input 
                                type="email" 
                                placeholder="Signer Email" 
                                className="form-input" 
                                style={{ padding: '0.4rem 0.6rem', fontSize: '0.75rem' }} 
                                value={newSignerEmail}
                                onChange={e => setNewSignerEmail(e.target.value)}
                                disabled={addingSigner}
                            />
                            <button 
                                className="btn btn-secondary" 
                                style={{ padding: '0.4rem', fontSize: '0.75rem', justifyContent: 'center' }}
                                onClick={handleQuickAddSigner}
                                disabled={addingSigner}
                            >
                                {addingSigner ? 'Adding...' : '+ Add Signer'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Subcomponent: Individual page overlay controller
interface PageContainerProps {
    pageNum: number;
    pdfDoc: any;
    activeTool: string;
    fields: PlacedField[];
    recipients: any[];
    onAddField: (field: PlacedField) => void;
    onUpdateField: (id: string, updates: Partial<PlacedField>) => void;
    onDeleteField: (id: string) => void;
    selectedFieldId: string | null;
    onSelectField: (id: string | null) => void;
    zoom: number;
}

const getRecipientColors = (recipientId: string, recipientsList: any[]) => {
    const idx = recipientsList.findIndex(r => r._id === recipientId || r.email === recipientId);
    const colors = [
        { border: '#3b82f6', bg: 'rgba(59, 130, 246, 0.05)', label: '#1e3a8a', badgeBg: '#dbeafe', badgeText: '#1e40af' }, // Blue
        { border: '#10b981', bg: 'rgba(16, 185, 129, 0.05)', label: '#064e3b', badgeBg: '#d1fae5', badgeText: '#065f46' }, // Green
        { border: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.05)', label: '#3b0764', badgeBg: '#f3e8ff', badgeText: '#5b21b6' }, // Purple
        { border: '#f59e0b', bg: 'rgba(245, 158, 11, 0.05)', label: '#78350f', badgeBg: '#fef3c7', badgeText: '#92400e' }, // Amber
        { border: '#ec4899', bg: 'rgba(236, 72, 153, 0.05)', label: '#701a75', badgeBg: '#fce7f3', badgeText: '#9d174d' }  // Pink
    ];
    return colors[idx % colors.length] || colors[0];
};

const EditorPageContainer: React.FC<PageContainerProps> = ({
    pageNum,
    pdfDoc,
    activeTool,
    fields,
    recipients,
    onAddField,
    onUpdateField,
    onDeleteField,
    selectedFieldId,
    onSelectField,
    zoom
}) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const overlayRef = useRef<HTMLDivElement | null>(null);
    const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);

    // Box drawing states
    const [isDrawing, setIsDrawing] = useState(false);
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });
    const [drawBox, setDrawBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

    // Draggable / Resizable details
    const [_activeDragId, setActiveDragId] = useState<string | null>(null);
    const [_dragMode, setDragMode] = useState<'move' | 'resize' | null>(null);
    const [dragField, setDragField] = useState<{ _id: string; x_percent: number; y_percent: number; width_percent: number; height_percent: number } | null>(null);

    const activeDragIdRef = useRef<string | null>(null);
    const dragModeRef = useRef<'move' | 'resize' | null>(null);
    const dragStartOffsetRef = useRef({ x: 0, y: 0 });
    const dragFieldRef = useRef<any>(null);
    const fieldsRef = useRef(fields);

    useEffect(() => {
        fieldsRef.current = fields;
    }, [fields]);

    // Load PDF Page dimensions based on zoom
    useEffect(() => {
        if (!pdfDoc) return;
        const loadDimensions = async () => {
            try {
                const page = await pdfDoc.getPage(pageNum);
                const viewport = page.getViewport({ scale: zoom });
                setDimensions({ width: viewport.width, height: viewport.height });
            } catch (err) {
                console.error(err);
            }
        };
        loadDimensions();
    }, [pdfDoc, pageNum, zoom]);

    // Render Canvas
    useEffect(() => {
        if (!pdfDoc || !dimensions || !canvasRef.current) return;
        let renderTask: any = null;
        const renderPage = async () => {
            try {
                const page = await pdfDoc.getPage(pageNum);
                const viewport = page.getViewport({ scale: zoom });
                const canvas = canvasRef.current!;
                const context = canvas.getContext('2d')!;

                canvas.width = viewport.width;
                canvas.height = viewport.height;

                renderTask = page.render({ canvasContext: context, viewport });
                await renderTask.promise;
            } catch (err: any) {
                if (err.name !== 'RenderingCancelledException' && err.message?.indexOf('cancel') === -1) {
                    console.error(err);
                }
            }
        };
        renderPage();
        return () => {
            if (renderTask) {
                renderTask.cancel();
            }
        };
    }, [pdfDoc, dimensions, pageNum, zoom]);

    // Handle drag movement and resizing globally on window
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            const activeId = activeDragIdRef.current;
            const mode = dragModeRef.current;
            if (!activeId || !mode || !overlayRef.current) return;

            const activeField = fieldsRef.current.find(f => f._id === activeId);
            if (!activeField) return;

            const rect = overlayRef.current.getBoundingClientRect();
            const currentX = e.clientX - rect.left;
            const currentY = e.clientY - rect.top;
            const startOffset = dragStartOffsetRef.current;

            if (mode === 'move') {
                const newX = currentX - startOffset.x;
                const newY = currentY - startOffset.y;
                const x_percent = Math.max(0, Math.min(100 - activeField.width_percent, (newX / rect.width) * 100));
                const y_percent = Math.max(0, Math.min(100 - activeField.height_percent, (newY / rect.height) * 100));
                
                const updated = { ...dragFieldRef.current, x_percent, y_percent };
                dragFieldRef.current = updated;
                setDragField(updated);
            } else if (mode === 'resize') {
                const startX = (activeField.x_percent / 100) * rect.width;
                const startY = (activeField.y_percent / 100) * rect.height;
                const newW = currentX - startX;
                const newH = currentY - startY;
                
                const width_percent = Math.max(5, Math.min(100 - activeField.x_percent, (newW / rect.width) * 100));
                const height_percent = Math.max(3, Math.min(100 - activeField.y_percent, (newH / rect.height) * 100));
                
                const updated = { ...dragFieldRef.current, width_percent, height_percent };
                dragFieldRef.current = updated;
                setDragField(updated);
            }
        };

        const handleMouseUp = () => {
            const activeId = activeDragIdRef.current;
            if (activeId && dragFieldRef.current) {
                onUpdateField(activeId, {
                    x_percent: dragFieldRef.current.x_percent,
                    y_percent: dragFieldRef.current.y_percent,
                    width_percent: dragFieldRef.current.width_percent,
                    height_percent: dragFieldRef.current.height_percent
                });
            }

            activeDragIdRef.current = null;
            dragModeRef.current = null;
            dragFieldRef.current = null;
            setActiveDragId(null);
            setDragMode(null);
            setDragField(null);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [onUpdateField]);

    // Handle mouse down inside canvas overlay (Start drawing)
    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.target !== overlayRef.current) return;
        if (e.button !== 0) return; // Left click only

        const rect = overlayRef.current.getBoundingClientRect();
        const startX = e.clientX - rect.left;
        const startY = e.clientY - rect.top;

        setIsDrawing(true);
        setStartPos({ x: startX, y: startY });
        setDrawBox({ x: startX, y: startY, w: 0, h: 0 });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDrawing || !drawBox || !overlayRef.current) return;
        const rect = overlayRef.current.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;

        setDrawBox({
            x: startPos.x,
            y: startPos.y,
            w: currentX - startPos.x,
            h: currentY - startPos.y
        });
    };

    const handleMouseUp = (e: React.MouseEvent) => {
        if (!isDrawing || !drawBox || !overlayRef.current) return;
        setIsDrawing(false);

        const rect = overlayRef.current.getBoundingClientRect();
        const w_pixels = Math.abs(drawBox.w);
        const h_pixels = Math.abs(drawBox.h);

        let x_percent = 0;
        let y_percent = 0;
        let width_percent = 0;
        let height_percent = 0;

        if (w_pixels < 10 && h_pixels < 10) {
            // Click-to-Place Shortcut
            width_percent = 16;
            height_percent = 4.5;
            const clickX = e.clientX - rect.left;
            const clickY = e.clientY - rect.top;
            x_percent = Math.max(0, Math.min(100 - width_percent, (clickX / rect.width) * 100 - (width_percent / 2)));
            y_percent = Math.max(0, Math.min(100 - height_percent, (clickY / rect.height) * 100 - (height_percent / 2)));
        } else {
            // Drag-select placement
            const x_pixels = Math.min(drawBox.x, drawBox.x + drawBox.w);
            const y_pixels = Math.min(drawBox.y, drawBox.y + drawBox.h);
            x_percent = (x_pixels / rect.width) * 100;
            y_percent = (y_pixels / rect.height) * 100;
            width_percent = (w_pixels / rect.width) * 100;
            height_percent = (h_pixels / rect.height) * 100;
        }

        if (width_percent > 1.5 && height_percent > 1.2) {
            onAddField({
                _id: 'temp-' + Math.random().toString(36).substring(2, 9),
                page_number: pageNum,
                field_type: activeTool,
                label: activeTool.charAt(0).toUpperCase() + activeTool.slice(1).replace('_', ' '),
                placeholder: '',
                required: !['stamp', 'readonlyNote', 'approval', 'decline'].includes(activeTool),
                x_percent,
                y_percent,
                width_percent,
                height_percent,
                assigned_recipient_id: recipients[0]?._id || recipients[0]?.email || '',
                validation_type: 'none',
                font_size: 12,
                alignment: 'left',
                date_format: 'DD/MM/YYYY',
                help_text: ''
            });
        }
        setDrawBox(null);
    };

    const handleFieldMouseDown = (e: React.MouseEvent, field: PlacedField) => {
        e.stopPropagation();
        onSelectField(field._id);

        if (!overlayRef.current) return;
        const rect = overlayRef.current.getBoundingClientRect();
        const fieldRectX = (field.x_percent / 100) * rect.width;
        const fieldRectY = (field.y_percent / 100) * rect.height;

        const cursorX = e.clientX - rect.left;
        const cursorY = e.clientY - rect.top;

        activeDragIdRef.current = field._id;
        dragModeRef.current = 'move';
        dragStartOffsetRef.current = {
            x: cursorX - fieldRectX,
            y: cursorY - fieldRectY
        };

        const initialDrag = {
            _id: field._id,
            x_percent: field.x_percent,
            y_percent: field.y_percent,
            width_percent: field.width_percent,
            height_percent: field.height_percent
        };
        dragFieldRef.current = initialDrag;
        setDragField(initialDrag);

        setActiveDragId(field._id);
        setDragMode('move');
    };

    const handleResizeMouseDown = (e: React.MouseEvent, field: PlacedField) => {
        e.stopPropagation();
        e.preventDefault();
        if (!overlayRef.current) return;

        const rect = overlayRef.current.getBoundingClientRect();
        activeDragIdRef.current = field._id;
        dragModeRef.current = 'resize';
        dragStartOffsetRef.current = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };

        const initialDrag = {
            _id: field._id,
            x_percent: field.x_percent,
            y_percent: field.y_percent,
            width_percent: field.width_percent,
            height_percent: field.height_percent
        };
        dragFieldRef.current = initialDrag;
        setDragField(initialDrag);

        setActiveDragId(field._id);
        setDragMode('resize');
    };

    const pageFields = fields.filter(f => f.page_number === pageNum);

    if (!dimensions) {
        return (
            <div style={{ width: `${600 * zoom}px`, height: `${800 * zoom}px`, background: 'white', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="spinner"></div>
            </div>
        );
    }

    return (
        <div style={{
            position: 'relative',
            width: dimensions.width,
            height: dimensions.height,
            border: '1px solid #cbd5e1',
            borderRadius: '4px',
            background: 'white',
            boxShadow: 'var(--shadow-md)',
            userSelect: 'none'
        }}>
            <canvas ref={canvasRef} width={dimensions.width} height={dimensions.height} style={{ display: 'block', width: '100%', height: '100%' }} />
            <div
                ref={overlayRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    cursor: activeTool ? 'crosshair' : 'default'
                }}
            >
                {/* Draw box outline */}
                {drawBox && (
                    <div style={{
                        position: 'absolute',
                        border: '2px dashed #2563eb',
                        background: 'rgba(37, 99, 235, 0.08)',
                        left: Math.min(drawBox.x, drawBox.x + drawBox.w),
                        top: Math.min(drawBox.y, drawBox.y + drawBox.h),
                        width: Math.abs(drawBox.w),
                        height: Math.abs(drawBox.h),
                        pointerEvents: 'none'
                    }} />
                )}

                {/* Render fields */}
                {pageFields.map((field) => {
                    const isDragging = dragField && dragField._id === field._id;
                    const displayField = isDragging ? { ...field, ...dragField } : field;
                    const isSelected = selectedFieldId === field._id;
                    
                    const rec = recipients.find(r => r._id === displayField.assigned_recipient_id || r.email === displayField.assigned_recipient_id);
                    const signerText = rec ? rec.name : 'Unassigned';
                    const col = getRecipientColors(displayField.assigned_recipient_id, recipients);

                    return (
                        <div
                            key={field._id}
                            onMouseDown={(e) => handleFieldMouseDown(e, field)}
                            style={{
                                position: 'absolute',
                                left: `${displayField.x_percent}%`,
                                top: `${displayField.y_percent}%`,
                                width: `${displayField.width_percent}%`,
                                height: `${displayField.height_percent}%`,
                                border: isSelected ? '2px solid #2563eb' : `1.5px solid ${col.border}`,
                                background: isSelected ? 'rgba(37, 99, 235, 0.14)' : col.bg,
                                padding: '0.35rem 0.5rem',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                cursor: 'move',
                                borderRadius: '6px',
                                overflow: 'hidden',
                                boxShadow: isSelected ? '0 0 0 3px rgba(37, 99, 235, 0.25), 0 4px 6px -1px rgba(0,0,0,0.1)' : 'var(--shadow-sm)',
                                transition: 'background 0.15s ease, box-shadow 0.15s ease'
                            }}
                        >
                            <span style={{ fontSize: '0.65rem', fontWeight: 800, color: col.label, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', paddingRight: '12px' }}>
                                {displayField.label} {displayField.required && '*'}
                            </span>
                            <span style={{ fontSize: '0.55rem', color: col.label, fontWeight: 700, opacity: 0.8 }}>
                                {signerText}
                            </span>
                            <span style={{
                                position: 'absolute',
                                bottom: '2px',
                                right: '4px',
                                fontSize: '0.45rem',
                                textTransform: 'uppercase',
                                fontWeight: 800,
                                background: col.badgeBg,
                                color: col.badgeText,
                                padding: '1px 4px',
                                borderRadius: '3px'
                            }}>{displayField.field_type.replace('_', ' ')}</span>

                            {/* Delete field x button */}
                            <button
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteField(field._id);
                                }}
                                style={{
                                    position: 'absolute',
                                    top: '2px',
                                    right: '2px',
                                    background: '#ef4444',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '50%',
                                    width: '14px',
                                    height: '14px',
                                    fontSize: '8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    fontWeight: 800
                                }}
                            >
                                ✕
                            </button>

                            {/* Resize Handle */}
                            <div
                                onMouseDown={(e) => handleResizeMouseDown(e, field)}
                                style={{
                                    position: 'absolute',
                                    right: 0,
                                    bottom: 0,
                                    width: '10px',
                                    height: '10px',
                                    background: col.border,
                                    cursor: 'se-resize',
                                    clipPath: 'polygon(100% 0, 0 100%, 100% 100%)'
                                }}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default DocumentEditor;
