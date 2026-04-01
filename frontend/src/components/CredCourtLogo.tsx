export default function CredCourtLogo({ size = 48 }: { size?: number }) {
    const h = Math.round(size * (44 / 48))
    return (
        <div className="flex items-center gap-3">
            <svg
                width={size}
                height={h}
                viewBox="0 0 48 44"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-label="CredCourt scales logo"
            >
                <defs>
                    <filter id="cc-glow" x="-40%" y="-40%" width="180%" height="180%">
                        <feGaussianBlur stdDeviation="1.2" result="blur" />
                        <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>

                {/* Base foot */}
                <line x1="17" y1="41" x2="31" y2="41" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" />

                {/* Center pole */}
                <line x1="24" y1="41" x2="24" y2="17" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" filter="url(#cc-glow)" />

                {/* Pivot dot */}
                <circle cx="24" cy="17" r="2.2" fill="#818cf8" filter="url(#cc-glow)" />

                {/* Beam — left side lower (AI side heavier), ~9° tilt */}
                <line x1="5" y1="20.5" x2="43" y2="13.5" stroke="#818cf8" strokeWidth="1.5" strokeLinecap="round" filter="url(#cc-glow)" />

                {/* Left chain (dashed) */}
                <line x1="5" y1="20.5" x2="5" y2="31" stroke="#6366f1" strokeWidth="0.9" strokeDasharray="2 1.8" strokeLinecap="round" />

                {/* Right chain (dashed) */}
                <line x1="43" y1="13.5" x2="43" y2="24" stroke="#6366f1" strokeWidth="0.9" strokeDasharray="2 1.8" strokeLinecap="round" />

                {/* Left pan arc */}
                <path d="M1 31 Q5 35.5 9 31" stroke="#818cf8" strokeWidth="1.5" fill="none" strokeLinecap="round" />

                {/* Right pan arc */}
                <path d="M39 24 Q43 28.5 47 24" stroke="#818cf8" strokeWidth="1.5" fill="none" strokeLinecap="round" />

                {/* Left pan content: neural net (3 nodes + edges) — AI symbol */}
                <circle cx="3.2" cy="29.8" r="1.3" fill="#818cf8" />
                <circle cx="6.5" cy="28" r="1.3" fill="#818cf8" />
                <circle cx="9.8" cy="29.8" r="1.3" fill="#818cf8" />
                <line x1="3.2" y1="29.8" x2="6.5" y2="28" stroke="#818cf8" strokeWidth="0.7" opacity="0.55" />
                <line x1="6.5" y1="28" x2="9.8" y2="29.8" stroke="#818cf8" strokeWidth="0.7" opacity="0.55" />
                <line x1="3.2" y1="29.8" x2="9.8" y2="29.8" stroke="#818cf8" strokeWidth="0.7" opacity="0.3" />

                {/* Right pan content: blockchain block (stacked squares) */}
                <rect x="40" y="21.5" width="6" height="5.5" rx="0.8" stroke="#6366f1" strokeWidth="1.1" fill="none" />
                <line x1="40" y1="23.6" x2="46" y2="23.6" stroke="#6366f1" strokeWidth="0.6" opacity="0.55" />
                <line x1="43" y1="21.5" x2="43" y2="27" stroke="#6366f1" strokeWidth="0.6" opacity="0.35" />
            </svg>

            <div className="leading-none">
                <div
                    className="text-2xl font-bold tracking-widest uppercase"
                    style={{ fontFamily: 'var(--font-orbitron)' }}
                >
                    <span style={{ color: 'var(--foreground)' }}>Cred</span>
                    <span style={{ color: 'var(--accent-light)' }}>Court</span>
                </div>
                <div className="text-xs mt-0.5 tracking-wider" style={{ color: 'var(--muted)', fontFamily: 'var(--font-space)' }}>
                    On-chain verdicts for AI agents
                </div>
            </div>
        </div>
    )
}
