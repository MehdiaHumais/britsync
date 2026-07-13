import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { apiCall } from '../utils/api';
import SignatureCanvas from 'react-signature-canvas';
import { 
    PenTool, X, FileCheck, Download, AlertCircle, ArrowDownCircle, 
    Sparkles, Upload
} from 'lucide-react';

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
    signature_data?: string;
    options_json?: string;
    date_format?: string;
    help_text?: string;
}

export const PublicSigning: React.FC = () => {
    const { secureToken } = useParams();

    const [loading, setLoading] = useState(true);
    const [pdfLoading, setPdfLoading] = useState(true);
    const [state, setState] = useState<'signing' | 'completed' | 'expired' | 'declined' | 'not_your_turn' | 'auth_required' | 'error'>('signing');
    const [errorMsg, setErrorMsg] = useState('');

    // Signer Authentication Verification States
    const [authMethod, setAuthMethod] = useState<'passcode' | 'otp' | 'none'>('none');
    const [enteredPasscode, setEnteredPasscode] = useState('');
    const [enteredOtp, setEnteredOtp] = useState('');
    const [verifyingAuth, setVerifyingAuth] = useState(false);
    const [authError, setAuthError] = useState('');
    const [otpSent, setOtpSent] = useState(false);
    const [otpCooldown, setOtpCooldown] = useState(0);

    const [doc, setDoc] = useState<any>(null);
    const [recipient, setRecipient] = useState<any>(null);
    const [myFieldIds, setMyFieldIds] = useState<string[]>([]);
    const [fields, setFields] = useState<PlacedField[]>([]);

    const isFieldMine = (f: PlacedField) => myFieldIds.includes(f._id);
    
    const [pdfDoc, setPdfDoc] = useState<any>(null);
    const [numPages, setNumPages] = useState(0);

    // Signature Modal states
    const [showSigModal, setShowSigModal] = useState(false);
    const [activeSigFieldId, setActiveSigFieldId] = useState<string | null>(null);
    const [sigModalTab, setSigModalTab] = useState<'draw' | 'type'>('draw');
    const [typedName, setTypedName] = useState('');
    const [selectedFont, setSelectedFont] = useState('Great Vibes');
    const sigPadRef = useRef<any>(null);

    // Form tracking
    const [validationErrors, setValidationErrors] = useState<string[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [declineReason, setDeclineReason] = useState('');
    const [showDeclineModal, setShowDeclineModal] = useState(false);

    // Load handwriting fonts
    useEffect(() => {
        const link = document.createElement('link');
        link.href = 'https://fonts.googleapis.com/css2?family=Caveat:wght@400;700&family=Great+Vibes&family=Pacifico&display=swap';
        link.rel = 'stylesheet';
        document.head.appendChild(link);
        return () => {
            document.head.removeChild(link);
        };
    }, []);

    useEffect(() => {
        if (otpCooldown > 0) {
            const timer = setTimeout(() => setOtpCooldown(prev => prev - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [otpCooldown]);

    const handleVerifyPasscode = async () => {
        if (!enteredPasscode.trim()) return;
        setVerifyingAuth(true);
        setAuthError('');
        try {
            const res = await apiCall(`public/sign/${secureToken}/verify-passcode`, {
                method: 'POST',
                body: { passcode: enteredPasscode }
            });
            if (res.verified) {
                // Trigger reload to fetch the full signing payload
                window.location.reload();
            }
        } catch (err: any) {
            setAuthError(err.message || 'Invalid passcode code.');
        } finally {
            setVerifyingAuth(false);
        }
    };

    const handleSendOtp = async () => {
        setVerifyingAuth(true);
        setAuthError('');
        try {
            await apiCall(`public/sign/${secureToken}/send-otp`, { method: 'POST' });
            setOtpSent(true);
            setOtpCooldown(60);
        } catch (err: any) {
            setAuthError(err.message || 'Failed to send verification code.');
        } finally {
            setVerifyingAuth(false);
        }
    };

    const handleVerifyOtp = async () => {
        if (!enteredOtp.trim()) return;
        setVerifyingAuth(true);
        setAuthError('');
        try {
            const res = await apiCall(`public/sign/${secureToken}/verify-otp`, {
                method: 'POST',
                body: { otp: enteredOtp }
            });
            if (res.verified) {
                window.location.reload();
            }
        } catch (err: any) {
            setAuthError(err.message || 'Invalid OTP code.');
        } finally {
            setVerifyingAuth(false);
        }
    };

    useEffect(() => {
        const fetchSignDetails = async () => {
            setLoading(true);
            try {
                const data = await apiCall(`public/sign/${secureToken}`);
                
                if (data.state === 'auth_required') {
                    setAuthMethod(data.auth_method);
                    setRecipient(data.recipient);
                    setState('auth_required');
                    setLoading(false);
                    return;
                }

                if (data.state === 'expired') {
                    setState('expired');
                    setLoading(false);
                    return;
                }

                if (data.state === 'not_your_turn') {
                    setDoc(data.doc);
                    setRecipient(data.recipient);
                    const computedIds = data.myFieldIds && data.myFieldIds.length > 0
                        ? data.myFieldIds
                        : ((data.doc?.fields || []).filter((f: any) =>
                            f.assigned_recipient_id === data.recipient?._id ||
                            f.assigned_recipient_id === data.recipient?.email ||
                            f.assigned_recipient_id === data.recipient?.name ||
                            f.assigned_recipient_id === 'all'
                        ).map((f: any) => f._id));
                    setMyFieldIds(computedIds);
                    setState('not_your_turn');
                    setLoading(false);
                    return;
                }

                if (data.state === 'declined') {
                    setState('declined');
                    setLoading(false);
                    return;
                }
                
                if (data.state === 'completed') {
                    setDoc(data.doc);
                    setRecipient(data.recipient);
                    setMyFieldIds(data.myFieldIds || []);
                    setState('completed');
                    setLoading(false);
                    return;
                }

                setDoc(data.doc);
                setRecipient(data.recipient);
                // Compute myFieldIds from server response, fallback to local matching
                const computedIds = data.myFieldIds && data.myFieldIds.length > 0
                    ? data.myFieldIds
                    : ((data.doc?.fields || []).filter((f: any) =>
                        f.assigned_recipient_id === data.recipient?._id ||
                        f.assigned_recipient_id === data.recipient?.email ||
                        f.assigned_recipient_id === data.recipient?.name ||
                        f.assigned_recipient_id === 'all'
                    ).map((f: any) => f._id));
                setMyFieldIds(computedIds);
                setFields(data.doc.fields || []);
                setState('signing');
                
                if (data.recipient) {
                    setTypedName(data.recipient.name || '');
                }

                // Load PDF
                const pdfjs = await loadPdfJs();
                let pdfBuffer: Uint8Array;
                if (data.pdfBase64) {
                    pdfBuffer = Uint8Array.from(atob(data.pdfBase64), c => c.charCodeAt(0));
                } else {
                    const pdfUrl = data.doc.original_file_url.replace(/^https?:\/\/[^\/]+/, '');
                    console.log('PublicSigning fetching PDF from:', pdfUrl);
                    const pdfResponse = await fetch(pdfUrl);
                    console.log('PDF response:', pdfResponse.status, pdfResponse.statusText);
                    if (!pdfResponse.ok) throw new Error(`HTTP ${pdfResponse.status}: ${pdfResponse.statusText}`);
                    const contentType = pdfResponse.headers.get('content-type') || '';
                    if (contentType.includes('application/json')) {
                        const json = await pdfResponse.json();
                        if (!json.success || !json.data) throw new Error('PDF data missing in API response');
                        pdfBuffer = Uint8Array.from(atob(json.data), c => c.charCodeAt(0));
                    } else {
                        const buf = await pdfResponse.arrayBuffer();
                        pdfBuffer = new Uint8Array(buf);
                    }
                }
                console.log('PDF buffer size:', pdfBuffer.length);
                if (!pdfBuffer || pdfBuffer.length === 0) throw new Error('PDF response is empty (0 bytes)');
                const loadedPdf = await pdfjs.getDocument({ data: pdfBuffer }).promise;
                setPdfDoc(loadedPdf);
                setNumPages(loadedPdf.numPages);
                setPdfLoading(false);
            } catch (err: any) {
                console.error(err);
                setState('error');
                setErrorMsg(err.message || 'Signature request invalid or not found');
            } finally {
                setLoading(false);
            }
        };

        if (secureToken) fetchSignDetails();
    }, [secureToken]);

    const handleUpdateFieldValue = (id: string, val: string) => {
        setFields(prev => prev.map(f => f._id === id ? { ...f, value: val } : f));
        setValidationErrors(prev => prev.filter(errId => errId !== id));
    };

    const handleFileUploadBase64 = (id: string, file: File) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            setFields(prev => prev.map(f => f._id === id ? { ...f, value: file.name, signature_data: reader.result as string } : f));
            setValidationErrors(prev => prev.filter(errId => errId !== id));
        };
        reader.readAsDataURL(file);
    };

    // Serialize typed name into base64 image via canvas drawing
    const getTypedSignatureImage = (text: string, fontName: string): string => {
        const canvas = document.createElement('canvas');
        canvas.width = 440;
        canvas.height = 180;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.fillStyle = 'rgba(255,255,255,0)'; // transparent bg
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#0f172a'; // dark dark color
            ctx.font = `italic 38px "${fontName}", cursive`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, canvas.width / 2, canvas.height / 2);
            return canvas.toDataURL('image/png');
        }
        return '';
    };

    const handleSaveSignature = () => {
        let signatureData = '';

        if (sigModalTab === 'draw') {
            if (sigPadRef.current.isEmpty()) {
                alert('Please draw your signature first.');
                return;
            }
            signatureData = sigPadRef.current.getCanvas().toDataURL('image/png');
        } else {
            if (!typedName.trim()) {
                alert('Please type your name.');
                return;
            }
            signatureData = getTypedSignatureImage(typedName, selectedFont);
        }

        setFields(prev => prev.map(f => f._id === activeSigFieldId ? { ...f, signature_data: signatureData, value: 'Signed' } : f));
        setValidationErrors(prev => prev.filter(errId => errId !== activeSigFieldId));
        setShowSigModal(false);
        setActiveSigFieldId(null);
    };

    const handleClearSignature = () => {
        if (sigModalTab === 'draw' && sigPadRef.current) {
            sigPadRef.current.clear();
        } else {
            setTypedName('');
        }
    };

    // Required fields helper
    const getRemainingRequiredFields = () => {
        return fields.filter(f => {
            if (!isFieldMine(f) || !f.required) return false;
            
            if (['user_signature', 'initials', 'stamp'].includes(f.field_type)) {
                return !f.signature_data;
            }
            if (f.field_type === 'checkbox') {
                return f.value !== 'true' && f.value !== 'checked';
            }
            return !f.value || !f.value.trim();
        });
    };

    const remainingRequired = getRemainingRequiredFields();

    const getFormatValidationErrors = (): PlacedField[] => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const phoneRegex = /^\+?[0-9\s\-()]{7,20}$/;

        return fields.filter(f => {
            if (!isFieldMine(f)) return false;

            const val = (f.value || '').trim();
            if (!val) return false;

            if (f.field_type === 'email') {
                return !emailRegex.test(val);
            }
            if (f.field_type === 'phone') {
                return !phoneRegex.test(val);
            }
            if (f.field_type === 'number') {
                return isNaN(Number(val));
            }
            return false;
        });
    };

    const handleGoToNextRequired = () => {
        if (remainingRequired.length > 0) {
            const nextFieldId = remainingRequired[0]._id;
            const el = document.getElementById(`field-wrapper-${nextFieldId}`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // Flash red/blue border briefly
                el.style.outline = '3px solid #f59e0b';
                setTimeout(() => {
                    el.style.outline = 'none';
                }, 1500);
            }
        } else {
            alert('All required fields completed! Click "Complete Document" at the top right.');
        }
    };

    const handleComplete = async () => {
        if (remainingRequired.length > 0) {
            setValidationErrors(remainingRequired.map(f => f._id));
            alert(`Please complete all required fields (${remainingRequired.length} remaining).`);
            handleGoToNextRequired();
            return;
        }

        const formatErrors = getFormatValidationErrors();
        if (formatErrors.length > 0) {
            setValidationErrors(formatErrors.map(f => f._id));
            const errorLabels = formatErrors.map(f => {
                const typeLabel = f.field_type === 'email' ? 'email address' : f.field_type === 'phone' ? 'phone number' : 'number';
                return `"${f.label || f.placeholder || f.field_type}" (must be a valid ${typeLabel})`;
            }).join(', ');
            alert(`Please enter the correct format for: ${errorLabels}`);

            const firstErrFieldId = formatErrors[0]._id;
            const el = document.getElementById(`field-wrapper-${firstErrFieldId}`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.style.outline = '3px solid #ef4444';
                setTimeout(() => {
                    el.style.outline = 'none';
                }, 1500);
            }
            return;
        }

        setSubmitting(true);
        try {
            const completedDoc = await apiCall(`public/sign/${secureToken}/complete`, {
                method: 'POST',
                body: { fields }
            });
            setDoc(completedDoc);
            setState('completed');
        } catch (err: any) {
            console.error(err);
            alert(err.message || 'Error completing document.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeclineDocument = async () => {
        if (!declineReason.trim()) {
            alert('Please provide a reason for declining.');
            return;
        }
        setSubmitting(true);
        try {
            await apiCall(`public/sign/${secureToken}/decline`, {
                method: 'POST',
                body: { message: declineReason }
            });
            setState('declined');
            setShowDeclineModal(false);
        } catch (err: any) {
            console.error(err);
            alert(err.message || 'Failed to decline document.');
        } finally {
            setSubmitting(false);
        }
    };

    // Workspace branding attributes
    const brandColor = doc?.workspace_id?.brand_color || '#2563eb';
    const logoUrl = doc?.workspace_id?.logo_url;
    const companyName = doc?.workspace_id?.name || 'BritSync';

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' }}>
                <div className="spinner"></div>
            </div>
        );
    }

    if (state === 'error') {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', padding: '2rem' }}>
                <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '3rem 2rem', maxWidth: '480px', width: '100%', textAlign: 'center', boxShadow: 'var(--shadow-lg)' }}>
                    <div style={{ background: '#fee2e2', color: '#ef4444', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
                        <AlertCircle size={32} />
                    </div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.75rem' }}>Error Occurred</h1>
                    <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: '2rem' }}>
                        {errorMsg || 'An unexpected error occurred. Please contact the sender or try again.'}
                    </p>
                </div>
            </div>
        );
    }

    if (state === 'expired') {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', padding: '2rem' }}>
                <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '3rem 2rem', maxWidth: '480px', width: '100%', textAlign: 'center', boxShadow: 'var(--shadow-lg)' }}>
                    <div style={{ background: '#fee2e2', color: '#ef4444', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
                        <AlertCircle size={32} />
                    </div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.75rem' }}>Link Expired</h1>
                    <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: '2rem' }}>
                        This secure signing token has expired. Please contact the sender to extend the expiration date or request a new signature link.
                    </p>
                </div>
            </div>
        );
    }


    if (state === 'not_your_turn' && doc) {
        // Find who is currently active
        const sortedRecipients = [...(doc.recipients || [])]
            .filter((r: any) => r.role === 'signer')
            .sort((a: any, b: any) => a.signing_order - b.signing_order);
        const activeSigner = sortedRecipients.find((r: any) => r.status === 'sent' || r.status === 'viewed');
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', padding: '2rem' }}>
                <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '3rem 2.5rem', maxWidth: '500px', width: '100%', textAlign: 'center', boxShadow: 'var(--shadow-lg)' }}>
                    <div style={{ background: '#fffbeb', color: '#d97706', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto', fontSize: '2rem' }}>
                        ⏳
                    </div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.75rem' }}>Not Your Turn Yet</h1>
                    <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                        This document uses <strong>Sequential Signing</strong>. It's not your turn to sign yet.
                        {activeSigner && <> <strong>{activeSigner.name}</strong> must sign first.</>}
                        {' '}You'll receive an email notification as soon as it's your turn.
                    </p>
                    {sortedRecipients.length > 0 && (
                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1.25rem', textAlign: 'left' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Signing Order</div>
                            {sortedRecipients.map((r: any, idx: number) => (
                                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0', borderBottom: idx < sortedRecipients.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                                    <div style={{
                                        width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800,
                                        background: r.status === 'completed' ? '#dcfce7' : r.status === 'sent' || r.status === 'viewed' ? '#eff6ff' : '#f1f5f9',
                                        color: r.status === 'completed' ? '#16a34a' : r.status === 'sent' || r.status === 'viewed' ? '#2563eb' : '#94a3b8'
                                    }}>{idx + 1}</div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>{r.name}</div>
                                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{r.email}</div>
                                    </div>
                                    <div style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '99px',
                                        background: r.status === 'completed' ? '#dcfce7' : r.status === 'sent' || r.status === 'viewed' ? '#dbeafe' : '#f1f5f9',
                                        color: r.status === 'completed' ? '#16a34a' : r.status === 'sent' || r.status === 'viewed' ? '#2563eb' : '#94a3b8'
                                    }}>
                                        {r.status === 'completed' ? '✓ Signed' : r.status === 'sent' || r.status === 'viewed' ? '● Active' : '○ Waiting'}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    if (state === 'declined') {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', padding: '2rem' }}>
                <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '3rem 2rem', maxWidth: '480px', width: '100%', textAlign: 'center', boxShadow: 'var(--shadow-lg)' }}>
                    <div style={{ background: '#fef2f2', color: '#dc2626', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
                        <X size={32} />
                    </div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.75rem' }}>Document Declined</h1>
                    <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: '2rem' }}>
                        You have declined to sign this document. The document status has been updated and the sender has been notified.
                    </p>
                </div>
            </div>
        );
    }

    if (state === 'auth_required') {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
                fontFamily: '"Inter", sans-serif',
                padding: '1.5rem'
            }}>
                <div style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '16px',
                    padding: '2.5rem',
                    maxWidth: '460px',
                    width: '100%',
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)',
                    textAlign: 'center'
                }}>
                    <div style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '50%',
                        background: '#eff6ff',
                        color: '#3b82f6',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 1.5rem auto'
                    }}>
                        <AlertCircle size={28} />
                    </div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e3a8a', marginBottom: '0.75rem' }}>Identity Verification</h3>
                    <p style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: 1.5, marginBottom: '2rem' }}>
                        The sender has requested authentication to verify your identity before accessing this document.
                    </p>

                    {authError && (
                        <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '8px', padding: '0.75rem', fontSize: '0.8rem', color: '#ef4444', marginBottom: '1.25rem' }}>
                            {authError}
                        </div>
                    )}

                    {authMethod === 'passcode' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}>
                            <div className="form-group">
                                <label className="form-label" style={{ fontSize: '0.82rem' }}>Enter Document Passcode</label>
                                <input
                                    type="password"
                                    className="form-input"
                                    placeholder="••••••••"
                                    value={enteredPasscode}
                                    onChange={(e) => setEnteredPasscode(e.target.value)}
                                    style={{
                                        background: '#ffffff',
                                        border: '1px solid #cbd5e1',
                                        color: '#0f172a',
                                        borderRadius: '8px',
                                        padding: '10px 14px',
                                        width: '100%',
                                        fontSize: '0.9rem',
                                        boxSizing: 'border-box'
                                    }}
                                />
                            </div>
                            <button
                                onClick={handleVerifyPasscode}
                                className="btn btn-primary"
                                style={{ width: '100%', justifyContent: 'center' }}
                                disabled={verifyingAuth}
                            >
                                {verifyingAuth ? 'Verifying...' : 'Unlock Document'}
                            </button>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'left' }}>
                            {!otpSent ? (
                                <div>
                                    <p style={{ fontSize: '0.85rem', color: '#334155', marginBottom: '1.25rem', lineHeight: 1.5 }}>
                                        A 6-digit One-Time Password will be dispatched to your email address: <strong>{recipient?.email}</strong>.
                                    </p>
                                    <button
                                        onClick={handleSendOtp}
                                        className="btn btn-primary"
                                        style={{ width: '100%', justifyContent: 'center' }}
                                        disabled={verifyingAuth}
                                    >
                                        {verifyingAuth ? 'Sending...' : 'Send Verification OTP'}
                                    </button>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div className="form-group">
                                        <label className="form-label" style={{ fontSize: '0.82rem' }}>Enter One-Time Password</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            placeholder="123456"
                                            maxLength={6}
                                            value={enteredOtp}
                                            onChange={(e) => setEnteredOtp(e.target.value)}
                                            style={{
                                                background: '#ffffff',
                                                border: '1px solid #cbd5e1',
                                                color: '#0f172a',
                                                borderRadius: '8px',
                                                padding: '10px 14px',
                                                width: '100%',
                                                boxSizing: 'border-box',
                                                textAlign: 'center', 
                                                fontSize: '1.25rem', 
                                                letterSpacing: '4px', 
                                                fontWeight: 800 
                                            }}
                                        />
                                    </div>
                                    <button
                                        onClick={handleVerifyOtp}
                                        className="btn btn-primary"
                                        style={{ width: '100%', justifyContent: 'center' }}
                                        disabled={verifyingAuth}
                                    >
                                        {verifyingAuth ? 'Verifying...' : 'Confirm OTP Code'}
                                    </button>
                                    <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
                                        <button
                                            type="button"
                                            onClick={handleSendOtp}
                                            disabled={otpCooldown > 0 || verifyingAuth}
                                            style={{ background: 'transparent', border: 'none', color: '#3b82f6', fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline' }}
                                        >
                                            {otpCooldown > 0 ? `Resend Code in ${otpCooldown}s` : 'Resend Code'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    if (state === 'completed' && doc) {
        const downloadUrl = doc.final_file_url || `${window.location.origin}/api/docu/public/sign/${secureToken}/download`;
        const apiBase = import.meta.env.DEV ? 'http://localhost:5003' : '';
        const auditDownloadUrl = `${apiBase}/api/docu/public/sign/${secureToken}/download-audit`;

        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', padding: '2rem' }}>
                <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '3rem 2.5rem', maxWidth: '540px', width: '100%', textAlign: 'center', boxShadow: 'var(--shadow-lg)' }}>
                    <div style={{ background: '#ecfdf5', color: '#10b981', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
                        <FileCheck size={32} />
                    </div>
                    <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.75rem' }}>Signing Complete</h1>
                    <p style={{ color: '#64748b', fontSize: '0.95rem', lineHeight: 1.5, marginBottom: '2rem' }}>
                        Thank you! You have successfully reviewed and signed <strong>"{doc.document_name}"</strong>. A flattened copy is ready for immediate download.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <a href={downloadUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ padding: '0.8rem 2rem', fontSize: '1rem', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', backgroundColor: brandColor }}>
                            <Download size={18} /> Download Completed PDF
                        </a>
                        {doc.audit_report_url && (
                            <a href={auditDownloadUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ padding: '0.8rem 2rem', fontSize: '1rem', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                <FileCheck size={18} /> Download Audit Certificate
                            </a>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="public-signing-root" style={{ backgroundColor: '#f1f5f9' }}>
            {/* Header */}
            <div className="public-signing-header" style={{
                background: 'white',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 1.5rem',
                position: 'sticky',
                top: 0,
                zIndex: 100
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {logoUrl ? (
                        <img src={logoUrl} alt="Logo" style={{ height: '28px', maxWidth: '120px', objectFit: 'contain' }} />
                    ) : (
                        <img 
                            src={`${import.meta.env.BASE_URL}logo.png`} 
                            alt="Logo" 
                            style={{ 
                                height: '28px', 
                                width: '28px', 
                                borderRadius: '6px', 
                                objectFit: 'cover',
                                boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                            }} 
                        />
                    )}
                    <span style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
                        {companyName} <span style={{ color: brandColor }}>Docu</span>
                    </span>
                    <span style={{ color: '#cbd5e1' }}>|</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>{doc?.document_name}</span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-secondary" onClick={() => setShowDeclineModal(true)} style={{ color: '#ef4444' }}>
                        Decline to Sign
                    </button>
                    <button className="btn btn-primary" onClick={handleComplete} disabled={submitting} style={{ backgroundColor: brandColor }}>
                        {submitting ? 'Processing...' : 'Complete Document'}
                    </button>
                </div>
            </div>

            {/* Guide & Progress floating tracker panel */}
            <div style={{
                background: 'white',
                borderBottom: '1px solid #e2e8f0',
                padding: '0.5rem 1.5rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem',
                boxShadow: 'var(--shadow-sm)'
            }}>
                <div style={{ fontSize: '0.8rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Sparkles size={14} style={{ color: brandColor }} />
                    <span>Awaiting your signature as <strong>{recipient?.name} ({recipient?.email})</strong></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: remainingRequired.length > 0 ? '#ef4444' : '#10b981' }}>
                        {remainingRequired.length > 0 ? `${remainingRequired.length} required fields remaining` : 'All required fields completed!'}
                    </span>
                    {remainingRequired.length > 0 && (
                        <button 
                            className="btn btn-primary" 
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', backgroundColor: '#f59e0b', border: '1px solid #d97706' }}
                            onClick={handleGoToNextRequired}
                        >
                            Next Required <ArrowDownCircle size={12} />
                        </button>
                    )}
                </div>
            </div>

            {/* Document Signing Workspace */}
            <div className="public-signing-body" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem', padding: '2rem 1rem', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
                {pdfLoading ? (
                    <div style={{ display: 'flex', minHeight: '40vh', alignItems: 'center', justifyContent: 'center' }}>
                        <div className="spinner"></div>
                    </div>
                ) : (
                    Array.from({ length: numPages }).map((_, idx) => (
                        <div key={idx} style={{ position: 'relative', width: '100%', maxWidth: '1000px' }}>
                            <div style={{ marginBottom: '0.25rem', fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Page {idx + 1}</div>
                            <SigningPageContainer
                                pageNum={idx + 1}
                                pdfDoc={pdfDoc}
                                fields={fields}
                                recipient={recipient}
                                onUpdateFieldValue={handleUpdateFieldValue}
                                onOpenSignatureModal={(id) => {
                                    setActiveSigFieldId(id);
                                    setShowSigModal(true);
                                }}
                                onFileUploadBase64={handleFileUploadBase64}
                                validationErrors={validationErrors}
                                brandColor={brandColor}
                                myFieldIds={myFieldIds}
                            />
                        </div>
                    ))
                )}
            </div>

            {/* Signature Pad & Type Dialog */}
            {showSigModal && (
                <div className="modal-overlay" style={{ zIndex: 10000 }}>
                    <div className="modal-container" style={{ maxWidth: '500px' }}>
                        <div style={{ padding: '1.5rem 1.5rem 0.5rem 1.5rem', borderBottom: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <h2>Choose Signature Method</h2>
                            <button className="close-btn" onClick={() => {
                                setShowSigModal(false);
                                setActiveSigFieldId(null);
                            }}>
                                <X size={20} />
                            </button>
                        </div>
                        
                        {/* Tab Selector */}
                        <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', margin: '0 1.5rem 1rem 1.5rem', gap: '1rem' }}>
                            <button
                                style={{
                                    padding: '0.5rem',
                                    border: 'none',
                                    background: 'transparent',
                                    fontSize: '0.85rem',
                                    fontWeight: 700,
                                    color: sigModalTab === 'draw' ? brandColor : '#64748b',
                                    borderBottom: sigModalTab === 'draw' ? `2px solid ${brandColor}` : 'none',
                                    cursor: 'pointer'
                                }}
                                onClick={() => setSigModalTab('draw')}
                            >
                                Draw Signature
                            </button>
                            <button
                                style={{
                                    padding: '0.5rem',
                                    border: 'none',
                                    background: 'transparent',
                                    fontSize: '0.85rem',
                                    fontWeight: 700,
                                    color: sigModalTab === 'type' ? brandColor : '#64748b',
                                    borderBottom: sigModalTab === 'type' ? `2px solid ${brandColor}` : 'none',
                                    cursor: 'pointer'
                                }}
                                onClick={() => setSigModalTab('type')}
                            >
                                Type Cursive
                            </button>
                        </div>

                        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 0 }}>
                            {sigModalTab === 'draw' ? (
                                <>
                                    <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1rem', width: '100%' }}>Use your mouse, trackpad, or touch screen to draw your signature below.</p>
                                    <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', background: '#f8fafc', padding: '4px' }}>
                                        <SignatureCanvas
                                            ref={sigPadRef}
                                            penColor="black"
                                            canvasProps={{
                                                width: 440,
                                                height: 180,
                                                className: 'sig-canvas'
                                            }}
                                        />
                                    </div>
                                </>
                            ) : (
                                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div className="form-group">
                                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Type Your Full Name</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={typedName}
                                            onChange={e => setTypedName(e.target.value)}
                                            placeholder="John Doe"
                                        />
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Choose Cursive Handwriting Font</label>
                                        {['Great Vibes', 'Caveat', 'Pacifico'].map(font => (
                                            <div 
                                                key={font}
                                                onClick={() => setSelectedFont(font)}
                                                style={{
                                                    padding: '0.6rem 1rem',
                                                    border: selectedFont === font ? `2px solid ${brandColor}` : '1px solid #cbd5e1',
                                                    borderRadius: '8px',
                                                    fontSize: '1.4rem',
                                                    fontFamily: `"${font}", cursive`,
                                                    cursor: 'pointer',
                                                    background: selectedFont === font ? '#eff6ff' : 'white',
                                                    textAlign: 'center',
                                                    userSelect: 'none',
                                                    color: '#0f172a'
                                                }}
                                            >
                                                {typedName || 'Handwritten Signature'}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={handleClearSignature}>Clear</button>
                            <button className="btn btn-primary" onClick={handleSaveSignature} style={{ backgroundColor: brandColor }}>Save Signature</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Decline Modal */}
            {showDeclineModal && (
                <div className="modal-overlay" style={{ zIndex: 10000 }}>
                    <div className="modal-container" style={{ maxWidth: '450px' }}>
                        <div className="modal-header">
                            <h2>Decline to Sign Document</h2>
                            <button className="close-btn" onClick={() => setShowDeclineModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1rem' }}>
                                By declining, this document will be cancelled and marked as declined. Please enter your reason below.
                            </p>
                            <textarea
                                className="form-input"
                                rows={4}
                                placeholder="Explain why you are declining to sign this document..."
                                value={declineReason}
                                onChange={e => setDeclineReason(e.target.value)}
                            />
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowDeclineModal(false)}>Cancel</button>
                            <button className="btn btn-danger" onClick={handleDeclineDocument} disabled={!declineReason.trim() || submitting}>
                                Decline Document
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Subcomponent: Individual signing canvas overlay controller
interface SigningPageProps {
    pageNum: number;
    pdfDoc: any;
    fields: PlacedField[];
    recipient: any;
    onUpdateFieldValue: (id: string, val: string) => void;
    onOpenSignatureModal: (id: string) => void;
    onFileUploadBase64: (id: string, file: File) => void;
    validationErrors: string[];
    brandColor: string;
    myFieldIds: string[];
}

const SigningPageContainer: React.FC<SigningPageProps> = ({
    pageNum,
    pdfDoc,
    fields,
    recipient: _recipient,
    onUpdateFieldValue,
    onOpenSignatureModal,
    onFileUploadBase64,
    validationErrors,
    brandColor,
    myFieldIds: _myFieldIds
}) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);

    useEffect(() => {
        if (!pdfDoc) return;
        const loadDimensions = async () => {
            const page = await pdfDoc.getPage(pageNum);
            const viewport = page.getViewport({ scale: 1.3 });
            setDimensions({ width: viewport.width, height: viewport.height });
        };
        loadDimensions();
    }, [pdfDoc, pageNum]);

    useEffect(() => {
        if (!pdfDoc || !dimensions || !canvasRef.current) return;
        let renderTask: any = null;
        const renderPage = async () => {
            try {
                const page = await pdfDoc.getPage(pageNum);
                const viewport = page.getViewport({ scale: 1.3 });
                const canvas = canvasRef.current!;
                const context = canvas.getContext('2d')!;

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
    }, [pdfDoc, dimensions, pageNum]);

    const pageFields = fields.filter(f => f.page_number === pageNum);

    if (!dimensions) {
        return (
            <div style={{ width: '800px', height: '500px', background: 'white', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="spinner"></div>
            </div>
        );
    }

    return (
        <div style={{
            width: '100%',
            maxWidth: dimensions.width + 'px',
            aspectRatio: `${dimensions.width} / ${dimensions.height}`,
            position: 'relative',
            border: '1px solid #cbd5e1',
            borderRadius: '4px',
            background: 'white',
            boxShadow: 'var(--shadow-md)',
            overflow: 'hidden'
        }}>
            <canvas ref={canvasRef} width={dimensions.width} height={dimensions.height} style={{ display: 'block', width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }} />
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
                {pageFields.map(field => {
                    const isMyField = _myFieldIds.includes(field._id);
                    const isAdmin = _recipient?.role === 'admin';
                    const shouldShowField = isMyField || isAdmin || !!field.value || !!field.signature_data;
                    
                    if (!shouldShowField) return null;

                    const isError = validationErrors.includes(field._id);
                    

                    const borderStyle = isMyField
                        ? (isError ? '2px solid #ef4444' : `1.5px solid ${brandColor}`)
                        : '1px dashed #cbd5e1';
                    const bgStyle = isMyField
                        ? (isError ? 'rgba(239, 68, 68, 0.08)' : 'rgba(37, 99, 235, 0.04)')
                        : 'rgba(241, 245, 249, 0.4)';

                    return (
                        <div
                            key={field._id}
                            id={`field-wrapper-${field._id}`}
                            style={{
                                position: 'absolute',
                                left: `${field.x_percent}%`,
                                top: `${field.y_percent}%`,
                                width: `${field.width_percent}%`,
                                height: `${field.height_percent}%`,
                                border: borderStyle,
                                background: bgStyle,
                                borderRadius: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                padding: '0.2rem',
                                boxSizing: 'border-box'
                            }}
                            title={field.help_text || field.label}
                        >
                            {/* TEXT / EMAIL / PHONE / NUMBER / TEXTAREA / FULLNAME / COMPANY / ADDRESS / JOB TITLE */}
                            {['text', 'email', 'phone', 'number', 'fullName', 'company', 'address', 'jobTitle'].includes(field.field_type) && (
                                <input
                                    type={field.field_type === 'number' ? 'number' : field.field_type === 'email' ? 'email' : 'text'}
                                    value={field.value || ''}
                                    onChange={(e) => onUpdateFieldValue(field._id, e.target.value)}
                                    placeholder={field.placeholder || (field.required ? `${field.label} *` : field.label)}
                                    disabled={!isMyField}
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        border: 'none',
                                        background: 'transparent',
                                        outline: 'none',
                                        fontSize: '0.75rem',
                                        color: isMyField ? '#0f172a' : '#64748b',
                                        cursor: isMyField ? 'text' : 'not-allowed'
                                    }}
                                />
                            )}

                            {field.field_type === 'textarea' && (
                                <textarea
                                    value={field.value || ''}
                                    onChange={(e) => onUpdateFieldValue(field._id, e.target.value)}
                                    placeholder={field.placeholder || (field.required ? `${field.label} *` : field.label)}
                                    disabled={!isMyField}
                                    rows={2}
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        border: 'none',
                                        background: 'transparent',
                                        outline: 'none',
                                        fontSize: '0.75rem',
                                        color: isMyField ? '#0f172a' : '#64748b',
                                        cursor: isMyField ? 'text' : 'not-allowed',
                                        resize: 'none'
                                    }}
                                />
                            )}

                            {/* DROPDOWN SELECT */}
                            {field.field_type === 'dropdown' && (
                                <select
                                    value={field.value || ''}
                                    onChange={(e) => onUpdateFieldValue(field._id, e.target.value)}
                                    disabled={!isMyField}
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        border: 'none',
                                        background: 'transparent',
                                        outline: 'none',
                                        fontSize: '0.75rem',
                                        color: isMyField ? '#0f172a' : '#64748b',
                                        cursor: isMyField ? 'pointer' : 'not-allowed'
                                    }}
                                >
                                    <option value="">{field.placeholder || 'Select...'}</option>
                                    {(() => {
                                        const optStr = field.options_json || '';
                                        let parsedList: string[] = [];
                                        try {
                                            const p = JSON.parse(optStr);
                                            if (Array.isArray(p)) parsedList = p.map(String);
                                        } catch (err) {
                                            parsedList = optStr.split(',').map(s => s.trim()).filter(Boolean);
                                        }
                                        return parsedList.map((opt, oIdx) => (
                                            <option key={oIdx} value={opt}>{opt}</option>
                                        ));
                                    })()}
                                </select>
                            )}

                            {/* CHECKBOX */}
                            {field.field_type === 'checkbox' && (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
                                    <input
                                        type="checkbox"
                                        checked={field.value === 'true' || field.value === 'checked'}
                                        onChange={(e) => onUpdateFieldValue(field._id, e.target.checked ? 'true' : 'false')}
                                        disabled={!isMyField}
                                        style={{
                                            cursor: isMyField ? 'pointer' : 'not-allowed',
                                            transform: 'scale(1.15)'
                                        }}
                                    />
                                </div>
                            )}

                            {/* RADIO GROUP */}
                            {field.field_type === 'radio' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', width: '100%', justifyContent: 'center', overflow: 'hidden' }}>
                                    {(() => {
                                        const optStr = field.options_json || '';
                                        let parsedList: string[] = [];
                                        try {
                                            const p = JSON.parse(optStr);
                                            if (Array.isArray(p)) parsedList = p.map(String);
                                        } catch (err) {
                                            parsedList = optStr.split(',').map(s => s.trim()).filter(Boolean);
                                        }
                                        return parsedList.slice(0, 2).map((opt, rIdx) => (
                                            <label key={rIdx} style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.6rem', fontWeight: 600, color: '#334155', cursor: isMyField ? 'pointer' : 'not-allowed' }}>
                                                <input 
                                                    type="radio" 
                                                    name={`radio-group-${field._id}`} 
                                                    value={opt} 
                                                    checked={field.value === opt}
                                                    onChange={() => onUpdateFieldValue(field._id, opt)}
                                                    disabled={!isMyField}
                                                    style={{ transform: 'scale(0.85)' }}
                                                />
                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opt}</span>
                                            </label>
                                        ));
                                    })()}
                                </div>
                            )}

                            {/* DATE PICKER */}
                            {field.field_type === 'date' && (
                                <input
                                    type="date"
                                    value={field.value || ''}
                                    onChange={(e) => onUpdateFieldValue(field._id, e.target.value)}
                                    disabled={!isMyField}
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        border: 'none',
                                        background: 'transparent',
                                        outline: 'none',
                                        fontSize: '0.75rem',
                                        color: isMyField ? '#0f172a' : '#64748b',
                                        cursor: isMyField ? 'pointer' : 'not-allowed'
                                    }}
                                />
                            )}

                            {/* SIGNATURE / INITIALS / STAMP */}
                            {['user_signature', 'initials', 'stamp'].includes(field.field_type) && (
                                <div
                                    onClick={() => isMyField && onOpenSignatureModal(field._id)}
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: isMyField ? 'pointer' : 'not-allowed',
                                        fontSize: '0.7rem',
                                        color: isMyField ? '#7c3aed' : '#94a3b8',
                                        fontWeight: 700
                                    }}
                                >
                                    {field.signature_data ? (
                                        <img src={field.signature_data} alt={field.label} style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
                                    ) : (
                                        <>
                                            <PenTool size={13} style={{ marginRight: '0.25rem' }} />
                                            <span>{field.label} {field.required && '*'}</span>
                                        </>
                                    )}
                                </div>
                            )}

                            {/* FILE ATTACHMENT UPLOAD */}
                            {field.field_type === 'fileUpload' && (
                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', gap: '0.25rem', overflow: 'hidden' }}>
                                    {field.value ? (
                                        <div style={{ fontSize: '0.65rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            <FileCheck size={12} /> {field.value}
                                        </div>
                                    ) : (
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '3px', background: brandColor, color: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: '0.6rem', fontWeight: 800, cursor: isMyField ? 'pointer' : 'not-allowed', width: '100%', height: '100%', justifyContent: 'center' }}>
                                            <Upload size={10} /> Attach File
                                            <input 
                                                type="file" 
                                                style={{ display: 'none' }}
                                                disabled={!isMyField}
                                                onChange={e => {
                                                    const f = e.target.files?.[0];
                                                    if (f) onFileUploadBase64(field._id, f);
                                                }}
                                            />
                                        </label>
                                    )}
                                </div>
                            )}

                            {/* READ-ONLY NOTE */}
                            {field.field_type === 'readonlyNote' && (
                                <div style={{
                                    width: '100%',
                                    height: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    fontSize: '0.7rem',
                                    color: '#475569',
                                    fontStyle: 'italic'
                                }}>
                                    <span>{field.label}</span>
                                </div>
                            )}

                            {/* APPROVAL / DECLINE BUTTONS */}
                            {field.field_type === 'approval' && (
                                <button
                                    onClick={() => isMyField && onUpdateFieldValue(field._id, 'Approved')}
                                    disabled={!isMyField || field.value === 'Approved'}
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        background: field.value === 'Approved' ? '#ecfdf5' : '#10b981',
                                        color: field.value === 'Approved' ? '#059669' : 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        fontSize: '0.65rem',
                                        fontWeight: 800,
                                        cursor: isMyField ? 'pointer' : 'not-allowed',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '2px'
                                    }}
                                >
                                    <FileCheck size={11} /> {field.value === 'Approved' ? 'Approved' : 'Approve'}
                                </button>
                            )}

                            {field.field_type === 'decline' && (
                                <button
                                    onClick={() => isMyField && onUpdateFieldValue(field._id, 'Declined')}
                                    disabled={!isMyField || field.value === 'Declined'}
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        background: field.value === 'Declined' ? '#fef2f2' : '#ef4444',
                                        color: field.value === 'Declined' ? '#dc2626' : 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        fontSize: '0.65rem',
                                        fontWeight: 800,
                                        cursor: isMyField ? 'pointer' : 'not-allowed',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '2px'
                                    }}
                                >
                                    <X size={11} /> {field.value === 'Declined' ? 'Declined' : 'Decline'}
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default PublicSigning;
