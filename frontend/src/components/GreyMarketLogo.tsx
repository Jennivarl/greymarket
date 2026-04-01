export default function GreyMarketLogo({ size = 40 }: { size?: number }) {
    const h = size

    return (
        <div className="flex items-center gap-3" style={{ height: h }}>
            {/* Icon: dice inside a hexagon */}
            <svg width={h} height={h} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Hex background */}
                <polygon
                    points="20,2 35,11 35,29 20,38 5,29 5,11"
                    fill="rgba(180,83,9,0.12)"
                    stroke="rgba(180,83,9,0.5)"
                    strokeWidth="1.2"
                />
                {/* Dice face */}
                <rect x="11" y="11" width="18" height="18" rx="3.5" fill="rgba(180,83,9,0.15)" stroke="rgba(180,83,9,0.75)" strokeWidth="1.4" />
                {/* Five-pip dice pattern */}
                <circle cx="16" cy="16" r="1.8" fill="rgba(180,83,9,0.95)" />
                <circle cx="24" cy="16" r="1.8" fill="rgba(180,83,9,0.95)" />
                <circle cx="20" cy="20" r="1.8" fill="rgba(180,83,9,0.95)" />
                <circle cx="16" cy="24" r="1.8" fill="rgba(180,83,9,0.95)" />
                <circle cx="24" cy="24" r="1.8" fill="rgba(180,83,9,0.95)" />
            </svg>

            {/* Wordmark */}
            <div style={{ lineHeight: 1 }}>
                <div
                    style={{
                        fontFamily: 'var(--font-orbitron), sans-serif',
                        fontWeight: 700,
                        fontSize: h * 0.42,
                        letterSpacing: '0.12em',
                        textTransform: 'uppercase',
                    }}
                >
                    <span style={{ color: 'var(--foreground)' }}>Grey</span>
                    <span style={{ color: 'var(--accent-light)' }}>Market</span>
                </div>
                <div
                    style={{
                        fontFamily: 'var(--font-rajdhani), sans-serif',
                        fontWeight: 600,
                        fontSize: h * 0.22,
                        letterSpacing: '0.18em',
                        textTransform: 'uppercase',
                        color: 'var(--muted)',
                        marginTop: 2,
                    }}
                >
                    Bet on Grey Areas
                </div>
            </div>
        </div>
    )
}
