import React, { useEffect, useState, useRef } from 'react';
import { FileText, Shield, Check, Calendar } from 'lucide-react';

// Real cursive "Sarah Connor" signature as a smooth SVG path
// Built using cubic bezier curves on a 240x70 viewBox to resemble actual handwriting
const SIGNATURE_PATH = `
  M 20,48
  C 16,35 22,14 28,14
  C 34,14 22,18 22,28
  C 22,38 30,44 36,44
  C 40,44 30,48 26,48
  C 22,48 34,44 42,44
  C 38,44 36,50 41,50
  C 45,50 46,44 44,42
  C 44,44 45,48 45,50
  C 46,48 48,43 49,41
  C 50,41 51,41 51,41
  C 51,45 52,49 53,50
  C 50,50 49,44 53,44
  C 57,44 57,43 56,42
  C 56,44 57,48 57,50
  C 59,45 62,22 64,15
  C 65,12 62,35 62,50
  C 62,45 62,43 63,42
  C 65,40 67,46 68,50
  C 70,52 72,48 75,46
  C 80,44 83,54 88,54
  C 93,54 96,32 98,20
  C 100,10 88,12 86,22
  C 84,32 88,48 98,48
  C 102,48 108,46 110,44
  C 106,44 106,50 110,50
  C 113,50 113,44 112,44
  C 111,44 115,42 118,44
  C 119,46 120,48 121,50
  C 122,46 124,44 126,50
  C 127,46 129,44 131,50
  C 132,46 134,44 136,50
  C 138,46 137,44 139,44
  C 142,44 143,50 140,50
  C 138,50 142,44 145,44
  C 146,43 147,42 148,41
  C 149,41 150,41 150,41
  C 151,45 151,49 152,50
  C 156,51 162,52 168,53
  C 174,54 178,57 172,58
  C 150,60 80,61 35,60
  C 25,59 20,57 28,57
  C 60,57 140,55 220,54
`;

export const AnimatedSignatureHero: React.FC = () => {
    const [step, setStep] = useState<'waiting' | 'signing' | 'completed'>('waiting');
    const [penPos, setPenPos] = useState({ x: 20, y: 48 });
    const [penVisible, setPenVisible] = useState(false);
    const [drawProgress, setDrawProgress] = useState(0);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const svgPathRef = useRef<SVGPathElement | null>(null);
    const animFrameRef = useRef<number | null>(null);

    // Get total path length for stroke-dasharray animation
    const [pathLength, setPathLength] = useState(0);
    useEffect(() => {
        const measure = () => {
            if (svgPathRef.current) {
                const len = svgPathRef.current.getTotalLength();
                if (len > 0) {
                    setPathLength(len);
                    return true;
                }
            }
            return false;
        };

        if (!measure()) {
            let count = 0;
            const interval = setInterval(() => {
                count++;
                if (measure() || count > 20) {
                    clearInterval(interval);
                }
            }, 100);
            return () => clearInterval(interval);
        }
    }, []);

    // Get position along SVG path at a given progress (0-1)
    const getPosAtProgress = (pct: number) => {
        if (!svgPathRef.current) return { x: 20, y: 48 };
        const total = svgPathRef.current.getTotalLength();
        if (total === 0) return { x: 20, y: 48 };
        const len = total * pct;
        const pt = svgPathRef.current.getPointAtLength(len);
        return { x: pt.x, y: pt.y };
    };

    // Main animation loop
    useEffect(() => {
        let cancelled = false;

        const runLoop = async () => {
            while (!cancelled) {
                // --- WAITING ---
                setStep('waiting');
                setPenVisible(false);
                setDrawProgress(0);
                setPenPos({ x: 20, y: 48 });
                await delay(1800);
                if (cancelled) break;

                // --- SIGNING ---
                setStep('signing');
                setPenVisible(true);
                const startTime = Date.now();
                const duration = 3800; // slightly longer duration for more letters + flourish

                await new Promise<void>((resolve) => {
                    const tick = () => {
                        if (cancelled) { resolve(); return; }
                        const elapsed = Date.now() - startTime;
                        const pct = Math.min(elapsed / duration, 1);
                        // ease-in-out for natural pen feel
                        const eased = pct < 0.5
                            ? 2 * pct * pct
                            : 1 - Math.pow(-2 * pct + 2, 2) / 2;

                        setDrawProgress(eased);
                        const pos = getPosAtProgress(eased);
                        setPenPos(pos);

                        if (pct < 1) {
                            animFrameRef.current = requestAnimationFrame(tick);
                        } else {
                            resolve();
                        }
                    };
                    animFrameRef.current = requestAnimationFrame(tick);
                });

                if (cancelled) break;

                // small pause at end of stroke
                await delay(400);
                if (cancelled) break;

                // --- COMPLETED ---
                setStep('completed');
                setPenVisible(false);
                await delay(3800);
            }
        };

        runLoop();
        return () => {
            cancelled = true;
            if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        };
    }, [pathLength]);

    // Ink sparkle particles at pen tip
    useEffect(() => {
        if (step !== 'signing' || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const scaleX = canvas.width / 240;
        const scaleY = canvas.height / 70;

        let particles: Array<{ x: number; y: number; vx: number; vy: number; alpha: number; size: number; color: string }> = [];
        let rafId: number;

        const colors = ['#3b82f6', '#60a5fa', '#93c5fd', '#2563eb', '#bfdbfe'];

        const render = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            if (Math.random() < 0.5) {
                particles.push({
                    x: penPos.x * scaleX,
                    y: penPos.y * scaleY,
                    vx: (Math.random() - 0.5) * 2,
                    vy: (Math.random() - 0.5) * 2 - 0.8,
                    alpha: 0.9,
                    size: Math.random() * 2.5 + 0.8,
                    color: colors[Math.floor(Math.random() * colors.length)]
                });
            }

            particles = particles.filter(p => p.alpha > 0);
            particles.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;
                p.alpha -= 0.025;
                ctx.save();
                ctx.globalAlpha = p.alpha;
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            });

            rafId = requestAnimationFrame(render);
        };

        render();
        return () => { cancelAnimationFrame(rafId); ctx.clearRect(0, 0, canvas.width, canvas.height); };
    }, [step, penPos]);

    const dashOffset = pathLength > 0 ? pathLength * (1 - drawProgress) : 1000;

    return (
        <div className="animated-signature-root" style={{
            position: 'relative',
            width: '100%',
            maxWidth: '460px',
            height: '420px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
        }}>
            {/* Background glow */}
            <div style={{
                position: 'absolute',
                width: '320px', height: '320px',
                background: 'radial-gradient(circle, rgba(37, 99, 235, 0.13) 0%, transparent 70%)',
                filter: 'blur(30px)',
                zIndex: 0, top: '50px', left: '70px', pointerEvents: 'none'
            }} />

            {/* Document card */}
            <div className="animated-signature-card" style={{
                background: 'rgba(255,255,255,0.8)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(226,232,240,0.8)',
                borderRadius: '24px',
                width: '380px', height: '320px',
                boxShadow: step === 'completed'
                    ? 'var(--shadow-lg), 0 20px 40px -10px rgba(16,185,129,0.18)'
                    : 'var(--shadow-lg), 0 20px 40px -10px rgba(37,99,235,0.1)',
                padding: '1.75rem',
                position: 'relative',
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                transition: 'box-shadow 0.6s ease',
                zIndex: 2
            }}>
                {/* Header */}
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem', marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <div style={{ width: '32px', height: '32px', background: '#eff6ff', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <FileText size={16} style={{ color: '#2563eb' }} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0f172a' }}>Employment_Contract.pdf</span>
                                <span style={{ fontSize: '0.6rem', color: '#64748b' }}>244 KB • PDF Document</span>
                            </div>
                        </div>
                        {/* Status badge */}
                        <div style={{
                            fontSize: '0.65rem', fontWeight: 800, padding: '4px 10px', borderRadius: '9999px',
                            display: 'flex', alignItems: 'center', gap: '4px', transition: 'all 0.4s ease',
                            background: step === 'completed' ? '#d1fae5' : step === 'signing' ? '#eff6ff' : '#fee2e2',
                            color: step === 'completed' ? '#065f46' : step === 'signing' ? '#1e40af' : '#991b1b',
                            boxShadow: 'var(--shadow-sm)'
                        }}>
                            {step === 'completed' ? (
                                <><Check size={11} strokeWidth={3} /> Completed</>
                            ) : step === 'signing' ? (
                                <><span style={{ width: '6px', height: '6px', background: '#2563eb', borderRadius: '50%', display: 'inline-block', animation: 'pulse 1.2s infinite' }} /> Signing...</>
                            ) : (
                                <><span style={{ width: '6px', height: '6px', background: '#ef4444', borderRadius: '50%', display: 'inline-block' }} /> Awaiting</>
                            )}
                        </div>
                    </div>

                    {/* Dummy doc lines */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', opacity: 0.7 }}>
                        <div style={{ height: '7px', background: '#e2e8f0', width: '100%', borderRadius: '4px' }} />
                        <div style={{ height: '7px', background: '#e2e8f0', width: '88%', borderRadius: '4px' }} />
                        <div style={{ height: '7px', background: '#e2e8f0', width: '96%', borderRadius: '4px' }} />
                        <div style={{ height: '7px', background: '#e2e8f0', width: '60%', borderRadius: '4px' }} />
                    </div>
                </div>

                {/* Signature area */}
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', marginTop: '1.5rem', position: 'relative' }}>
                    {/* Date box */}
                    <div style={{
                        flex: 1, border: '1px dashed #cbd5e1', padding: '0.5rem', borderRadius: '8px',
                        background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '2px',
                        minHeight: '68px', justifyContent: 'center'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', color: '#94a3b8' }}>
                            <Calendar size={10} />
                            <span style={{ fontSize: '0.55rem', textTransform: 'uppercase', fontWeight: 800 }}>Date Signed</span>
                        </div>
                        <span style={{ fontWeight: 800, color: '#334155', fontSize: '0.75rem', marginTop: '2px' }}>
                            {step === 'completed' ? new Date().toLocaleDateString('en-GB') : '—'}
                        </span>
                    </div>

                    {/* Signature canvas box */}
                    <div style={{
                        flex: 1.8,
                        border: step === 'completed' ? '1.5px solid #10b981' : '1.5px dashed #2563eb',
                        padding: '0.5rem', borderRadius: '8px',
                        background: step === 'completed' ? '#f0fdf4' : 'rgba(37,99,235,0.02)',
                        position: 'relative', height: '68px',
                        display: 'flex', alignItems: 'center',
                        transition: 'all 0.5s ease', overflow: 'visible'
                    }}>
                        <span style={{
                            position: 'absolute', top: '4px', left: '6px',
                            color: step === 'completed' ? '#059669' : '#2563eb',
                            fontSize: '0.55rem', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.2px'
                        }}>Sarah Connor *</span>

                        {/* Signature baseline */}
                        <div style={{
                            position: 'absolute', bottom: '12px', left: '10px', right: '10px',
                            height: '1px',
                            background: step === 'completed' ? '#a7f3d0' : '#bfdbfe',
                            transition: 'background 0.5s ease'
                        }} />

                        {/* Sparkle particle canvas */}
                        <canvas ref={canvasRef} width={240} height={70} style={{
                            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                            pointerEvents: 'none', zIndex: 10
                        }} />

                        {/* SVG signature path — smooth cursive bezier curves */}
                        <svg
                            viewBox="0 0 240 70"
                            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 5 }}
                        >
                            {/* Hidden reference path used to measure length & get point positions */}
                            <path
                                ref={svgPathRef}
                                d={SIGNATURE_PATH}
                                fill="none"
                                stroke="none"
                            />
                            {/* Visible animated path using stroke-dasharray */}
                            {(step === 'signing' || step === 'completed') && (
                                <path
                                    d={SIGNATURE_PATH}
                                    fill="none"
                                    stroke={step === 'completed' ? '#1e3a8a' : '#1d4ed8'}
                                    strokeWidth={step === 'completed' ? '2.8' : '2.4'}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeDasharray={pathLength || 1000}
                                    strokeDashoffset={dashOffset}
                                    style={{
                                        transition: step === 'completed' ? 'stroke 0.4s ease' : 'none',
                                        filter: step === 'completed'
                                            ? 'drop-shadow(0px 1px 3px rgba(30,58,138,0.4))'
                                            : 'drop-shadow(0px 0px 1px rgba(37,99,235,0.5))'
                                    }}
                                />
                            )}
                        </svg>

                        {/* Floating pen */}
                        {penVisible && (
                            <div style={{
                                position: 'absolute',
                                left: `${(penPos.x / 240) * 100}%`,
                                top: `${(penPos.y / 70) * 100}%`,
                                pointerEvents: 'none',
                                transform: 'translate(-10px, -56px) perspective(400px) rotateX(-35deg) rotateY(15deg) rotateZ(35deg)',
                                transformOrigin: '10px 56px',
                                transformStyle: 'preserve-3d',
                                filter: 'drop-shadow(12px 20px 8px rgba(15, 23, 42, 0.28))',
                                zIndex: 12,
                                willChange: 'left, top, transform'
                            }}>
                                <svg width="20" height="58" viewBox="0 0 20 58">
                                    <defs>
                                        <linearGradient id="penBody" x1="0%" y1="0%" x2="100%" y2="0%">
                                            <stop offset="0%" stopColor="#1e293b" />
                                            <stop offset="40%" stopColor="#334155" />
                                            <stop offset="70%" stopColor="#64748b" />
                                            <stop offset="100%" stopColor="#0f172a" />
                                        </linearGradient>
                                        <linearGradient id="penTip" x1="0%" y1="0%" x2="100%" y2="0%">
                                            <stop offset="0%" stopColor="#94a3b8" />
                                            <stop offset="50%" stopColor="#f1f5f9" />
                                            <stop offset="100%" stopColor="#64748b" />
                                        </linearGradient>
                                        <linearGradient id="inkRing" x1="0%" y1="0%" x2="100%" y2="0%">
                                            <stop offset="0%" stopColor="#2563eb" />
                                            <stop offset="50%" stopColor="#60a5fa" />
                                            <stop offset="100%" stopColor="#1d4ed8" />
                                        </linearGradient>
                                    </defs>
                                    {/* Main body */}
                                    <rect x="6" y="0" width="8" height="40" fill="url(#penBody)" rx="2" />
                                    {/* Blue accent band */}
                                    <rect x="5.5" y="9" width="9" height="3.5" fill="url(#inkRing)" rx="1" />
                                    {/* Silver grip band */}
                                    <rect x="6" y="40" width="8" height="3" fill="url(#penTip)" rx="0.5" />
                                    {/* Cone tip */}
                                    <path d="M 6,43 L 10,56 L 14,43 Z" fill="url(#penTip)" />
                                    {/* Ink contact dot */}
                                    <circle cx="10" cy="56" r="1.2" fill="#0f172a" />
                                    {/* Shine on body */}
                                    <rect x="8" y="2" width="2" height="30" fill="rgba(255,255,255,0.08)" rx="1" />
                                </svg>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* SHA-256 badge */}
            <div style={{
                position: 'absolute', bottom: '-20px', right: '40px',
                background: 'rgba(15,23,42,0.92)', backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px',
                padding: '0.5rem 0.85rem', display: 'flex', alignItems: 'center', gap: '8px',
                color: 'white', fontSize: '0.65rem', fontWeight: 700,
                boxShadow: 'var(--shadow-lg)',
                transform: step === 'completed' ? 'scale(1.06)' : 'scale(1)',
                opacity: step === 'completed' ? 1 : 0.75,
                transition: 'all 0.5s ease', zIndex: 3
            }}>
                <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Shield size={10} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ color: '#ecfdf5' }}>SHA-256 SECURED</span>
                    <span style={{ color: '#94a3b8', fontSize: '0.55rem', fontFamily: 'monospace' }}>
                        {step === 'completed' ? '8f2b7a9c...1d5e' : 'CRYPTOGRAPHIC LOCK'}
                    </span>
                </div>
            </div>

            {/* Signer avatar badge */}
            <div style={{
                position: 'absolute', top: '-25px', left: '-40px',
                background: 'rgba(255,255,255,0.92)', border: '1px solid rgba(226,232,240,0.8)',
                borderRadius: '16px', padding: '0.65rem 0.85rem',
                display: 'flex', alignItems: 'center', gap: '10px',
                boxShadow: 'var(--shadow-md)',
                transform: step === 'completed' ? 'translateY(-4px)' : 'translateY(0)',
                opacity: step === 'waiting' ? 0.25 : 1,
                transition: 'all 0.5s ease', zIndex: 3
            }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#f0fdf4', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.75rem' }}>
                    SC
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#1e293b' }}>Sarah Connor</span>
                    <span style={{ fontSize: '0.6rem', color: '#64748b' }}>
                        {step === 'signing' ? 'Signing now...' : step === 'completed' ? 'Signature verified ✓' : 'Awaiting action'}
                    </span>
                </div>
            </div>
        </div>
    );
};

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

export default AnimatedSignatureHero;
