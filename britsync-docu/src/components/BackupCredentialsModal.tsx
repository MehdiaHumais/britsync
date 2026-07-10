import React, { useState } from 'react';
import { RefreshCw, AlertCircle, Mail, Lock, X, User } from 'lucide-react';
import { apiCall } from '../utils/api';

interface Props {
    open: boolean;
    onClose: () => void;
    onComplete: () => void;
}

export const BackupCredentialsModal: React.FC<Props> = ({ open, onClose, onComplete }) => {
    const [email, setEmail] = useState('');
    const [fullName, setFullName] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    if (!open) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) {
            setError('Email and password are required');
            return;
        }
        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }
        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }
        setLoading(true);
        setError('');
        try {
            const data = await apiCall('auth/fingerprint/set-password', {
                method: 'POST',
                body: { email, password, full_name: fullName }
            });
            if (data.token) {
                localStorage.setItem('docu_token', data.token);
            }
            onComplete();
        } catch (err: any) {
            setError(err.message || 'Failed to save credentials');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, padding: '1rem'
        }}>
            <div style={{
                background: 'white', borderRadius: '16px', padding: '2rem',
                maxWidth: '440px', width: '100%', position: 'relative',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
            }}>
                <button onClick={onClose} style={{
                    position: 'absolute', top: '1rem', right: '1rem',
                    border: 'none', background: 'none', cursor: 'pointer',
                    color: '#94a3b8', padding: '0.25rem'
                }}><X size={20} /></button>

                <div style={{ marginBottom: '1.5rem' }}>
                    <h3 style={{ fontSize: '1.3rem', fontWeight: 900, color: '#0f172a', marginBottom: '0.35rem' }}>
                        Set Backup Credentials
                    </h3>
                    <p style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: 1.5 }}>
                        Add an email and password so you can log in from any device. You can skip this and do it later from Settings.
                    </p>
                </div>

                {error && (
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '0.6rem',
                        background: '#fef2f2', border: '1px solid #fee2e2',
                        borderRadius: '8px', padding: '0.75rem',
                        color: '#ef4444', fontSize: '0.8rem', marginBottom: '1rem'
                    }}>
                        <AlertCircle size={14} style={{ flexShrink: 0 }} />
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                        <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.3rem', display: 'block' }}>Full Name</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type="text" placeholder="Your full name" value={fullName}
                                onChange={e => setFullName(e.target.value)}
                                style={{
                                    width: '100%', padding: '0.6rem 0.75rem 0.6rem 2.2rem',
                                    border: '1px solid #cbd5e1', borderRadius: '8px',
                                    fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box'
                                }}
                            />
                            <User size={15} style={{ position: 'absolute', left: '0.7rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        </div>
                    </div>
                    <div>
                        <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.3rem', display: 'block' }}>Email *</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type="email" placeholder="you@example.com" value={email} required
                                onChange={e => setEmail(e.target.value)}
                                style={{
                                    width: '100%', padding: '0.6rem 0.75rem 0.6rem 2.2rem',
                                    border: '1px solid #cbd5e1', borderRadius: '8px',
                                    fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box'
                                }}
                            />
                            <Mail size={15} style={{ position: 'absolute', left: '0.7rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        </div>
                    </div>
                    <div>
                        <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.3rem', display: 'block' }}>Password *</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type="password" placeholder="At least 6 characters" value={password} required
                                onChange={e => setPassword(e.target.value)}
                                style={{
                                    width: '100%', padding: '0.6rem 0.75rem 0.6rem 2.2rem',
                                    border: '1px solid #cbd5e1', borderRadius: '8px',
                                    fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box'
                                }}
                            />
                            <Lock size={15} style={{ position: 'absolute', left: '0.7rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        </div>
                    </div>
                    <div>
                        <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.3rem', display: 'block' }}>Confirm Password *</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type="password" placeholder="Repeat password" value={confirmPassword} required
                                onChange={e => setConfirmPassword(e.target.value)}
                                style={{
                                    width: '100%', padding: '0.6rem 0.75rem 0.6rem 2.2rem',
                                    border: '1px solid #cbd5e1', borderRadius: '8px',
                                    fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box'
                                }}
                            />
                            <Lock size={15} style={{ position: 'absolute', left: '0.7rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                        <button type="button" onClick={onClose} style={{
                            flex: 1, padding: '0.7rem', borderRadius: '8px',
                            border: '1px solid #e2e8f0', background: 'white',
                            color: '#475569', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer'
                        }}>Later</button>
                        <button type="submit" disabled={loading} style={{
                            flex: 1, padding: '0.7rem', borderRadius: '8px',
                            border: 'none', background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                            color: 'white', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
                        }}>
                            {loading ? <><RefreshCw size={14} className="spinner" /> Saving...</> : 'Save Credentials'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default BackupCredentialsModal;
