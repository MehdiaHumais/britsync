import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiCall } from '../utils/api';
import DashboardLayout from '../components/layout/DashboardLayout';
import { 
    Upload, 
    ArrowLeft, 
    RefreshCw, 
    FileText, 
    AlertCircle, 
    PenTool, 
    Sparkles, 
    BookOpen, 
    Bold, 
    Italic, 
    Underline, 
    List, 
    ListOrdered, 
    Heading1, 
    Heading2, 
    TableProperties 
} from 'lucide-react';

const PRESETS = [
    {
        key: 'nda',
        name: 'Mutual Non-Disclosure Agreement (NDA)',
        defaultTitle: 'Mutual NDA Agreement',
        content: `MUTUAL NON-DISCLOSURE AGREEMENT

This Mutual Non-Disclosure Agreement ("Agreement") is entered into by and between the parties hereto for the purpose of preventing the unauthorized disclosure of Confidential Information.

1. DEFINITION OF CONFIDENTIAL INFORMATION
"Confidential Information" refers to any proprietary information, technical data, trade secrets, or know-how, including but not limited to research, product plans, source code, software, algorithms, databases, customer lists, and financial forecasts disclosed by one party to another.

2. EXCLUSIONS FROM CONFIDENTIALITY
Confidential Information does not include information that:
- Is or becomes publicly known through no breach of this Agreement.
- Was already in the possession of the receiving party prior to disclosure.
- Is independently developed by the receiving party without reference to the disclosing party's information.

3. OBLIGATIONS OF RECEIVING PARTY
The receiving party agrees to hold all Confidential Information in strict confidence and shall not disclose such information to any third party without the prior written consent of the disclosing party.

4. TERM OF AGREEMENT
This Agreement and the confidentiality obligations hereunder shall survive for a period of three (3) years from the date of disclosure.

Signed by:
[Signer 1 Name & Signature]

[Signer 2 Name & Signature]`
    },
    {
        key: 'consulting',
        name: 'Consulting Services Contract',
        defaultTitle: 'Consulting Services Contract',
        content: `CONSULTING SERVICES AGREEMENT

This Consulting Services Agreement ("Agreement") is made effective as of the date of signing, by and between the Client and the Consultant.

1. SCOPE OF SERVICES
The Consultant agrees to perform consulting services as specified by the Client, including full-stack software development, architectural design, and digital deployment consulting.

2. PAYMENT AND COMPENSATION
The Client agrees to compensate the Consultant at the agreed rate of $150 per hour. Payments shall be disbursed bi-weekly upon receipt and approval of detailed consulting timesheets.

3. INDEPENDENT CONTRACTOR STATUS
The Consultant is an independent contractor. Nothing in this Agreement shall create any partnership, joint venture, agency, or employee relationship between the parties.

4. INTELLECTUAL PROPERTY RIGHTS
All deliverables, code, designs, and materials developed by the Consultant during the performance of services under this Agreement shall belong exclusively to the Client upon full payment of fees.

Executed on:
[Signer 1 Signature]
[Signer 2 Signature]`
    },
    {
        key: 'offer',
        name: 'Employment Offer Letter',
        defaultTitle: 'Employment Offer Letter',
        content: `EMPLOYMENT OFFER LETTER

Dear Candidate,

We are thrilled to offer you the position of Senior Full-Stack Engineer at BritSync. We were incredibly impressed by your background and believe you will play a pivotal role in our growth.

1. POSITION AND START DATE
Your employment will commence on the first day of next month. You will report directly to the Chief Technology Officer.

2. SALARY AND COMPENSATION
Your starting base salary will be $120,000 per annum, paid in semi-monthly installments. You will also be eligible for our annual performance bonus scheme.

3. BENEFITS PACKAGE
You will receive full medical and dental insurance, 20 days of paid annual leave, and participation in the company retirement matching program.

Please execute this letter to indicate your acceptance of our offer.

Signed:
[Candidate Signature]`
    },
    {
        key: 'lease',
        name: 'Residential Lease Agreement',
        defaultTitle: 'Residential Lease Agreement',
        content: `RESIDENTIAL LEASE AGREEMENT

This Residential Lease Agreement is entered into between the Landlord and the Tenant for the lease of the premises.

1. LEASE TERM
The lease shall commence on the 1st of next month and continue on a fixed term of twelve (12) months.

2. RENT AND SECURITY DEPOSIT
The Tenant agrees to pay monthly rent of $1,800 due on the first day of each month. A security deposit of $1,800 is required upon signing.

3. MAINTENANCE AND REPAIRS
The Tenant shall maintain the premises in a clean and sanitary condition. The Landlord shall handle major structural repairs and utility upkeep.

Signed:
[Landlord Signature]
[Tenant Signature]`
    },
    {
        key: 'billofsale',
        name: 'Bill of Sale',
        defaultTitle: 'Bill of Sale Contract',
        content: `BILL OF SALE

For and in consideration of payment in the sum of $12,500, receipt of which is hereby acknowledged, the Seller hereby sells and transfers ownership of the personal property to the Buyer.

1. DESCRIPTION OF PROPERTY
Item: 2021 Model Tech Workstation Node
Serial Number: SN-BRITSYNC-88902A

2. AS-IS CONDITION
The property is sold in "AS-IS" condition, with no warranties, express or implied, regarding its performance, utility, or fitness for a particular purpose.

Signed:
[Seller Signature]
[Buyer Signature]`
    },
    {
        key: 'blank',
        name: 'Blank Custom Draft',
        defaultTitle: 'Custom Contract Draft',
        content: `CUSTOM CONTRACT AGREEMENT

This Agreement is made on this ______ day of ____________, 2026, by and between the parties hereto.

1. COVENANT TERMS
[Enter document terms here...]

2. EXECUTIONS
[Signatures...]`
    }
];

const convertTextToHtml = (text: string): string => {
    const lines = text.split(/\r?\n/);
    let htmlResult = '';
    let inList = false;

    for (let line of lines) {
        line = line.trim();
        if (!line) {
            if (inList) {
                htmlResult += '</ul>';
                inList = false;
            }
            continue;
        }

        const isHeading = line.startsWith('###') || (line.toUpperCase() === line && line.length < 60 && !line.startsWith('-') && !line.startsWith('*'));
        const isListItem = line.startsWith('-') || line.startsWith('*') || /^\d+\.\s/.test(line);

        if (isListItem) {
            if (!inList) {
                htmlResult += '<ul style="margin-left: 20px; list-style-type: disc;">';
                inList = true;
            }
            const cleanItem = line.replace(/^[-*]\s*/, '').replace(/^\d+\.\s*/, '');
            htmlResult += `<li>${cleanItem}</li>`;
        } else {
            if (inList) {
                htmlResult += '</ul>';
                inList = false;
            }
            if (isHeading) {
                const cleanHeading = line.replace(/^###\s*/, '');
                htmlResult += `<h2>${cleanHeading}</h2>`;
            } else {
                htmlResult += `<p>${line}</p>`;
            }
        }
    }
    if (inList) {
        htmlResult += '</ul>';
    }
    return htmlResult;
};

export const DocumentsNew: React.FC = () => {
    const navigate = useNavigate();

    useEffect(() => {
        const role = localStorage.getItem('docu_user_role') || 'member';
        if (role === 'viewer') {
            alert('Permission denied. Viewers cannot create documents.');
            navigate('/dashboard');
        }
    }, [navigate]);

    const [mode, setMode] = useState<'upload' | 'create'>('upload');
    const [name, setName] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const [parsing, setParsing] = useState(false);

    const editorRef = useRef<HTMLDivElement>(null);

    // Load initial template into editor on first switch to 'create' mode
    useEffect(() => {
        if (mode === 'create' && editorRef.current && !editorRef.current.innerHTML) {
            editorRef.current.innerHTML = convertTextToHtml(PRESETS[0].content);
            if (!name) setName(PRESETS[0].defaultTitle);
        }
    }, [mode]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = e.target.files?.[0];
        if (selected) {
            if (selected.type !== 'application/pdf') {
                setError('Only PDF files are allowed.');
                setFile(null);
                return;
            }
            setError('');
            setFile(selected);
            if (!name) {
                setName(selected.name.replace('.pdf', ''));
            }
        }
    };

    const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = e.target.files?.[0];
        if (!selected) return;

        const ext = selected.name.split('.').pop()?.toLowerCase();
        if (ext !== 'pdf' && ext !== 'docx') {
            setError('Only PDF and DOCX (Word) documents are supported for text import.');
            return;
        }

        setParsing(true);
        setError('');

        try {
            const formData = new FormData();
            formData.append('file', selected);

            const token = localStorage.getItem('docu_token');
            const apiBase = import.meta.env.DEV ? 'http://localhost:5003' : '';
            const url = `${apiBase}/api/docu/documents/parse`;

            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    ...(token && { 'Authorization': `Bearer ${token}` })
                },
                body: formData
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({ message: 'Extraction failed' }));
                throw new Error(errData.message || 'File parsing failed');
            }

            const parseResult = await res.json();
            
            if (parseResult.html) {
                if (editorRef.current) {
                    editorRef.current.innerHTML = parseResult.html;
                }
                setName(parseResult.name || selected.name.replace(/\.[^/.]+$/, ""));
            } else {
                throw new Error("No text content could be extracted from this file.");
            }
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Error parsing document.');
        } finally {
            setParsing(false);
        }
    };

    const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const key = e.target.value;
        const preset = PRESETS.find(p => p.key === key);
        if (preset && editorRef.current) {
            editorRef.current.innerHTML = convertTextToHtml(preset.content);
            setName(preset.defaultTitle);
        }
    };

    // Format Commands
    const runCommand = (command: string, value: string = '') => {
        document.execCommand(command, false, value);
        if (editorRef.current) {
            editorRef.current.focus();
        }
    };

    // TOC Generator
    const handleGenerateTOC = () => {
        if (!editorRef.current) return;
        const editorEl = editorRef.current;
        const headings = Array.from(editorEl.querySelectorAll('h1, h2'));
        if (headings.length === 0) {
            setError('No H1 or H2 headings found to generate a Table of Contents.');
            return;
        }

        setError('');
        let tocEl = editorEl.querySelector('.toc-container') as HTMLElement;
        if (!tocEl) {
            tocEl = document.createElement('div');
            tocEl.className = 'toc-container';
            tocEl.setAttribute('contenteditable', 'false');
            editorEl.insertBefore(tocEl, editorEl.firstChild);
        }

        tocEl.style.background = '#f8fafc';
        tocEl.style.border = '1px solid #e2e8f0';
        tocEl.style.borderRadius = '8px';
        tocEl.style.padding = '1.25rem';
        tocEl.style.marginBottom = '2rem';
        tocEl.style.fontFamily = '"Inter", sans-serif';

        let tocHtml = `
            <h4 style="margin: 0 0 0.75rem 0; font-size: 0.85rem; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #cbd5e1; padding-bottom: 0.5rem; display: flex; align-items: center; justify-content: space-between;">
                <span>Table of Contents</span>
                <span style="font-size: 0.7rem; font-weight: 400; text-transform: none; color: #94a3b8;">(Auto-generated)</span>
            </h4>
            <ul style="list-style: none; padding: 0; margin: 0; font-size: 0.85rem; line-height: 1.8;">
        `;

        headings.forEach((heading, idx) => {
            const text = heading.textContent || '';
            const isH1 = heading.tagName.toLowerCase() === 'h1';
            
            if (!heading.id) {
                heading.id = `heading-${idx}`;
            }

            const marginStyle = isH1 ? 'margin-left: 0;' : 'margin-left: 15px; color: #64748b;';
            const fontWeight = isH1 ? '600' : '400';
            const bulletChar = isH1 ? '▪ ' : '◦ ';

            tocHtml += `
                <li style="${marginStyle} font-weight: ${fontWeight};">
                    <a href="#${heading.id}" style="color: #2563eb; text-decoration: none; display: inline-flex; align-items: center;">
                        <span style="color: #94a3b8; margin-right: 6px;">${bulletChar}</span>
                        <span>${text}</span>
                    </a>
                </li>
            `;
        });

        tocHtml += '</ul>';
        tocEl.innerHTML = tocHtml;
    };

    // DOM Parser to Block array
    const parseEditorBlocks = () => {
        if (!editorRef.current) return [];
        const editorEl = editorRef.current;
        const blocks: Array<{ type: string; text: string }> = [];
        const children = Array.from(editorEl.childNodes);

        children.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
                const el = node as HTMLElement;
                const tagName = el.tagName.toUpperCase();

                if (el.classList.contains('toc-container')) {
                    return; // skip auto-generated TOC
                }

                if (tagName === 'H1') {
                    blocks.push({ type: 'h1', text: el.innerText });
                } else if (tagName === 'H2' || tagName === 'H3') {
                    blocks.push({ type: 'h2', text: el.innerText });
                } else if (tagName === 'UL' || tagName === 'OL') {
                    const lis = el.getElementsByTagName('li');
                    Array.from(lis).forEach((li) => {
                        blocks.push({ type: 'bullet', text: li.innerText });
                    });
                } else {
                    const text = el.innerText.trim();
                    if (text) {
                        blocks.push({ type: 'p', text: text });
                    }
                }
            } else if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent?.trim();
                if (text) {
                    blocks.push({ type: 'p', text: text });
                }
            }
        });

        return blocks;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setUploading(true);
        setError('');

        try {
            if (mode === 'upload') {
                if (!file || !name) return;
                const formData = new FormData();
                formData.append('file', file);

                const token = localStorage.getItem('docu_token');
                const apiBase = import.meta.env.DEV ? 'http://localhost:5003' : '';
                const url = `${apiBase}/api/docu/documents/upload`;

                const res = await fetch(url, {
                    method: 'POST',
                    headers: {
                        ...(token && { 'Authorization': `Bearer ${token}` })
                    },
                    body: formData
                });

                if (!res.ok) {
                    const errData = await res.json().catch(() => ({ message: 'Upload failed' }));
                    throw new Error(errData.message || 'File upload failed');
                }

                const uploadResult = await res.json();
                
                const newDoc = await apiCall('documents', {
                    method: 'POST',
                    body: {
                        document_name: name,
                        original_file_url: uploadResult.url,
                        original_hash: uploadResult.original_hash
                    }
                });

                navigate(`/documents/${newDoc._id}/editor`);
            } else {
                if (!name) return;
                const blocks = parseEditorBlocks();
                if (blocks.length === 0) {
                    throw new Error("Editor content cannot be empty.");
                }
                
                const newDoc = await apiCall('documents/create-from-text', {
                    method: 'POST',
                    body: {
                        document_name: name,
                        blocks: blocks
                    }
                });

                navigate(`/documents/${newDoc._id}/editor`);
            }
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Error processing document.');
        } finally {
            setUploading(false);
        }
    };

    return (
        <DashboardLayout title="Create Agreement">
            {/* Custom A4 Editor styling overrides */}
            <style dangerouslySetInnerHTML={{ __html: `
                .a4-container {
                    background: #f1f5f9;
                    border: 1px solid #cbd5e1;
                    border-radius: 12px;
                    padding: 2rem 1.5rem;
                    box-shadow: inset 0 2px 8px rgba(0,0,0,0.05);
                    display: flex;
                    justify-content: center;
                    overflow-x: auto;
                    margin-top: 1rem;
                }
                .a4-editor {
                    width: 100%;
                    max-width: 800px;
                    min-height: 1000px;
                    background: white;
                    color: #0f172a;
                    padding: 3.5rem 3rem;
                    box-shadow: 0 10px 25px rgba(0,0,0,0.08);
                    border: 1px solid #e2e8f0;
                    border-radius: 4px;
                    outline: none;
                    font-size: 0.95rem;
                    line-height: 1.6;
                    font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                    box-sizing: border-box;
                }
                .a4-editor:focus {
                    border-color: #3b82f6;
                    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15), 0 10px 25px rgba(0,0,0,0.08);
                }
                .a4-editor h1 {
                    font-size: 1.65rem;
                    font-weight: 800;
                    color: #0f172a;
                    margin-top: 1.5rem;
                    margin-bottom: 0.75rem;
                    line-height: 1.3;
                }
                .a4-editor h2 {
                    font-size: 1.3rem;
                    font-weight: 700;
                    color: #1e293b;
                    margin-top: 1.25rem;
                    margin-bottom: 0.5rem;
                    line-height: 1.3;
                }
                .a4-editor p {
                    margin-bottom: 0.85rem;
                    color: #334155;
                }
                .a4-editor ul, .a4-editor ol {
                    margin-left: 1.5rem;
                    margin-bottom: 1rem;
                }
                .a4-editor li {
                    margin-bottom: 0.35rem;
                    color: #334155;
                }
                .toolbar-btn {
                    background: transparent;
                    border: 1px solid #e2e8f0;
                    border-radius: 6px;
                    color: #475569;
                    padding: 0.4rem;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.15s ease;
                }
                .toolbar-btn:hover {
                    background: #f1f5f9;
                    color: #0f172a;
                    border-color: #cbd5e1;
                }
                .toolbar-divider {
                    width: 1px;
                    height: 24px;
                    background: #e2e8f0;
                    margin: 0 0.25rem;
                }
            ` }} />

            <button className="btn btn-secondary" style={{ marginBottom: '2rem' }} onClick={() => navigate('/documents')}>
                <ArrowLeft size={16} /> Back
            </button>

            {/* Toggle Modes */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem' }}>
                <button
                    onClick={() => { setMode('upload'); setError(''); }}
                    style={{
                        padding: '0.6rem 1.25rem',
                        fontSize: '0.85rem',
                        fontWeight: 800,
                        border: 'none',
                        background: mode === 'upload' ? '#2563eb' : 'transparent',
                        color: mode === 'upload' ? 'white' : '#64748b',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.15s ease'
                    }}
                >
                    <Upload size={16} /> Upload Existing PDF
                </button>
                <button
                    onClick={() => { setMode('create'); setError(''); }}
                    style={{
                        padding: '0.6rem 1.25rem',
                        fontSize: '0.85rem',
                        fontWeight: 800,
                        border: 'none',
                        background: mode === 'create' ? '#2563eb' : 'transparent',
                        color: mode === 'create' ? 'white' : '#64748b',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.15s ease'
                    }}
                >
                    <PenTool size={16} /> Draft & Edit Contract
                </button>
            </div>

            {error && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '6px', padding: '0.75rem', color: '#ef4444', fontSize: '0.85rem', marginBottom: '1.5rem', maxWidth: '850px', textAlign: 'left' }}>
                    <AlertCircle size={16} />
                    <span>{error}</span>
                </div>
            )}

            <div style={{ maxWidth: '850px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '2.5rem', boxShadow: 'var(--shadow-sm)', textAlign: 'left' }}>
                {mode === 'upload' ? (
                    <div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.5rem', color: '#0f172a' }}>Upload PDF Document</h3>
                        <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '2rem' }}>Import any PDF layout file to outline sign constraints and roles.</p>

                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label className="form-label">Document Name *</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Employment Agreement"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    required
                                    disabled={uploading}
                                />
                            </div>

                            <div className="form-group" style={{ marginBottom: '2rem' }}>
                                <label className="form-label">Select PDF Document *</label>
                                <label style={{
                                    border: '2px dashed #cbd5e1',
                                    borderRadius: '8px',
                                    padding: '2.5rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    cursor: 'pointer',
                                    background: '#f8fafc',
                                    transition: 'border-color 0.2s ease'
                                }}>
                                    <Upload size={32} style={{ color: '#94a3b8', marginBottom: '1rem' }} />
                                    {file ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#0f172a', fontWeight: 600, fontSize: '0.9rem' }}>
                                            <FileText size={16} style={{ color: '#2563eb' }} />
                                            <span>{file.name}</span>
                                        </div>
                                    ) : (
                                        <>
                                            <span style={{ fontSize: '0.9rem', color: '#475569', fontWeight: 600 }}>Click to browse file</span>
                                            <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>Only PDF format, max 15MB</span>
                                        </>
                                    )}
                                    <input type="file" className="file-input" accept=".pdf" onChange={handleFileChange} style={{ display: 'none' }} required={mode === 'upload'} />
                                </label>
                            </div>

                            <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={uploading || !file || !name}>
                                {uploading ? (
                                    <>
                                        <RefreshCw className="spinner" size={16} style={{ marginRight: '0.5rem' }} /> Processing PDF...
                                    </>
                                ) : (
                                    'Upload & Continue'
                                )}
                            </button>
                        </form>
                    </div>
                ) : (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
                            <div>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Sparkles size={18} style={{ color: '#2563eb' }} /> Responsive Document Creator
                                </h3>
                                <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '4px' }}>Draft, import PDF/Word, format text, and generate a dynamic table of contents.</p>
                            </div>
                            
                            {/* Preset Selector */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <BookOpen size={16} style={{ color: '#64748b' }} />
                                <select 
                                    className="form-input" 
                                    style={{ width: '220px', fontSize: '0.8rem', height: '34px', padding: '0.2rem 0.5rem' }} 
                                    onChange={handleTemplateChange}
                                >
                                    {PRESETS.map(preset => (
                                        <option key={preset.key} value={preset.key}>{preset.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Import Document Text Panel */}
                        <div style={{
                            border: '1px dashed #3b82f6',
                            background: '#eff6ff',
                            borderRadius: '8px',
                            padding: '1rem 1.25rem',
                            marginBottom: '1.5rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '1rem',
                            flexWrap: 'wrap'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ background: '#3b82f6', color: 'white', padding: '8px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Upload size={18} />
                                </div>
                                <div>
                                    <span style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#1e3a8a' }}>
                                        Import & Edit PDF / Word (.docx)
                                    </span>
                                    <span style={{ display: 'block', fontSize: '0.75rem', color: '#1d4ed8' }}>
                                        Upload your file to edit its paragraphs, headings, lists, and structure.
                                    </span>
                                </div>
                            </div>
                            <div>
                                <label className="btn btn-secondary" style={{
                                    margin: 0,
                                    fontSize: '0.8rem',
                                    padding: '0.4rem 0.8rem',
                                    borderColor: '#3b82f6',
                                    color: '#2563eb',
                                    background: 'white',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}>
                                    {parsing ? (
                                        <>
                                            <RefreshCw className="spinner" size={14} /> Extracting...
                                        </>
                                    ) : (
                                        'Choose File'
                                    )}
                                    <input
                                        type="file"
                                        accept=".pdf,.docx"
                                        style={{ display: 'none' }}
                                        onChange={handleImportFile}
                                        disabled={parsing}
                                    />
                                </label>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label className="form-label">Agreement Title *</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Enter agreement title..."
                                    required
                                    disabled={uploading}
                                />
                            </div>

                            {/* Toolbar */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                background: '#f8fafc',
                                border: '1px solid #cbd5e1',
                                borderBottom: 'none',
                                borderTopLeftRadius: '8px',
                                borderTopRightRadius: '8px',
                                padding: '0.5rem 0.75rem',
                                flexWrap: 'wrap'
                            }}>
                                <button type="button" className="toolbar-btn" onClick={() => runCommand('formatBlock', '<h1>')} title="Heading 1">
                                    <Heading1 size={16} />
                                </button>
                                <button type="button" className="toolbar-btn" onClick={() => runCommand('formatBlock', '<h2>')} title="Heading 2">
                                    <Heading2 size={16} />
                                </button>
                                <button type="button" className="toolbar-btn" onClick={() => runCommand('formatBlock', '<p>')} title="Paragraph Text" style={{ fontSize: '0.8rem', fontWeight: 800, padding: '0.4rem 0.6rem' }}>
                                    P
                                </button>

                                <div className="toolbar-divider" />

                                <button type="button" className="toolbar-btn" onClick={() => runCommand('bold')} title="Bold">
                                    <Bold size={16} />
                                </button>
                                <button type="button" className="toolbar-btn" onClick={() => runCommand('italic')} title="Italic">
                                    <Italic size={16} />
                                </button>
                                <button type="button" className="toolbar-btn" onClick={() => runCommand('underline')} title="Underline">
                                    <Underline size={16} />
                                </button>

                                <div className="toolbar-divider" />

                                <button type="button" className="toolbar-btn" onClick={() => runCommand('insertUnorderedList')} title="Bullet List">
                                    <List size={16} />
                                </button>
                                <button type="button" className="toolbar-btn" onClick={() => runCommand('insertOrderedList')} title="Numbered List">
                                    <ListOrdered size={16} />
                                </button>

                                <div className="toolbar-divider" />

                                <button type="button" className="toolbar-btn" onClick={handleGenerateTOC} title="Generate Table of Contents" style={{ gap: '4px', fontSize: '0.75rem', fontWeight: 700, padding: '0.4rem 0.65rem', color: '#2563eb', borderColor: '#bfdbfe', background: '#eff6ff' }}>
                                    <TableProperties size={14} />
                                    <span>TOC</span>
                                </button>
                            </div>

                            {/* A4 Workspace Sheet */}
                            <div className="a4-container" style={{ borderBottomLeftRadius: '8px', borderBottomRightRadius: '8px' }}>
                                <div 
                                    className="a4-editor"
                                    ref={editorRef}
                                    contentEditable={!uploading}
                                    suppressContentEditableWarning={true}
                                />
                            </div>

                            <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '2rem' }} disabled={uploading || !name}>
                                {uploading ? (
                                    <>
                                        <RefreshCw className="spinner" size={16} style={{ marginRight: '0.5rem' }} /> Compiling Document into PDF...
                                    </>
                                ) : (
                                    'Compile Document & Continue'
                                )}
                            </button>
                        </form>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
};

export default DocumentsNew;
