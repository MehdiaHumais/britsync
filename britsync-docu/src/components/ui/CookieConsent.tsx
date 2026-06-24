import React, { useState, useEffect } from 'react';
import { Shield, Cookie } from 'lucide-react';
import { apiCall } from '../../utils/api';

export const CookieConsent: React.FC = () => {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const consent = localStorage.getItem('docu_cookie_consent');
        if (!consent) {
            // Show banner after a tiny delay for smooth animation
            const timer = setTimeout(() => setVisible(true), 1500);
            return () => clearTimeout(timer);
        }
    }, []);

    const handleConsent = async (choice: 'all' | 'essential') => {
        try {
            // Store preference locally
            localStorage.setItem('docu_cookie_consent', choice);
            
            // Try to get current user email if logged in to link log record
            let email = 'Anonymous';
            const token = localStorage.getItem('docu_token');
            if (token) {
                try {
                    const meRes = await apiCall('auth/me');
                    if (meRes && meRes.user) {
                        email = meRes.user.email;
                    }
                } catch {
                    // Ignore, fall back to anonymous
                }
            }

            // Post consent decision to server log file
            await apiCall('public/cookie-consent', {
                method: 'POST',
                body: { consent: choice, email }
            });
        } catch (err) {
            console.error('Failed to report cookie consent decision:', err);
        } finally {
            setVisible(false);
        }
    };

    if (!visible) return null;

    return (
        <div style={{
            position: 'fixed',
            bottom: '24px',
            left: '24px',
            right: '24px',
            maxWidth: '460px',
            background: 'rgba(15, 23, 42, 0.95)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            padding: '1.5rem',
            color: 'white',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            fontFamily: '"Inter", sans-serif',
            animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
            marginLeft: 'auto' // will float right on wide screens
        }}>
            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes slideUp {
                    from { transform: translateY(30px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                .cookie-btn-primary {
                    background: #2563eb;
                    color: white;
                    border: none;
                    font-weight: 700;
                    padding: 0.6rem 1.25rem;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 0.85rem;
                    transition: all 0.2s ease;
                }
                .cookie-btn-primary:hover {
                    background: #1d4ed8;
                    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
                }
                .cookie-btn-secondary {
                    background: rgba(255, 255, 255, 0.1);
                    color: #e2e8f0;
                    border: 1px solid rgba(255, 255, 255, 0.15);
                    font-weight: 600;
                    padding: 0.6rem 1.25rem;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 0.85rem;
                    transition: all 0.2s ease;
                }
                .cookie-btn-secondary:hover {
                    background: rgba(255, 255, 255, 0.2);
                    color: white;
                }
            ` }} />

            {/* Header info */}
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <div style={{
                    background: 'rgba(37, 99, 235, 0.2)',
                    color: '#60a5fa',
                    padding: '0.5rem',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                }}>
                    <Cookie size={20} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <div style={{ fontSize: '0.95rem', fontWeight: 800, letterSpacing: '-0.25px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        Cookie Preferences <Shield size={13} style={{ color: '#34d399' }} />
                    </div>
                    <p style={{ fontSize: '0.75rem', color: '#94a3b8', lineHeight: 1.45, margin: '4px 0 0 0', textAlign: 'left' }}>
                        We use standard cookies to optimize workspace performance, analyze secure signature timelines, and remember your session configuration.
                    </p>
                </div>
            </div>

            {/* Button Layout */}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button 
                    onClick={() => handleConsent('essential')} 
                    className="cookie-btn-secondary"
                >
                    Essential Only
                </button>
                <button 
                    onClick={() => handleConsent('all')} 
                    className="cookie-btn-primary"
                >
                    Accept All
                </button>
            </div>
        </div>
    );
};

export default CookieConsent;
