type Props = {
    score: number
    size?: number
}

function polar(cx: number, cy: number, r: number, angleDeg: number) {
    const rad = ((angleDeg - 90) * Math.PI) / 180
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
    const s = polar(cx, cy, r, startDeg)
    const e = polar(cx, cy, r, endDeg)
    const large = endDeg - startDeg > 180 ? 1 : 0
    return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`
}

function gaugeColor(score: number): string {
    if (score >= 90) return '#4ade80'
    if (score >= 70) return '#86efac'
    if (score >= 50) return '#a3e635'
    if (score >= 30) return '#fb923c'
    return '#f87171'
}

// Arc: 240° sweep, clockwise from bottom-left to bottom-right over the top.
// Center (40,46), radius 30, viewBox 80×76.
const CX = 40, CY = 46, R = 30
const START = -120   // degrees from 12-o'clock, clockwise
const RANGE = 240

export default function ArcGauge({ score, size = 80 }: Props) {
    const clamped = Math.max(0, Math.min(100, score))
    const fgEnd = START + RANGE * (clamped / 100)
    const bgPath = arcPath(CX, CY, R, START, START + RANGE)
    const fgPath = clamped > 0 ? arcPath(CX, CY, R, START, fgEnd) : ''
    const color = gaugeColor(score)

    return (
        <svg
            width={size}
            height={Math.round(size * 76 / 80)}
            viewBox="0 0 80 76"
            fill="none"
            aria-label={`Score: ${score}`}
        >
            {/* Background track */}
            <path
                d={bgPath}
                stroke="var(--border)"
                strokeWidth="6"
                strokeLinecap="round"
            />
            {/* Filled arc */}
            {fgPath && (
                <path
                    d={fgPath}
                    stroke={color}
                    strokeWidth="6"
                    strokeLinecap="round"
                    style={{ filter: `drop-shadow(0 0 5px ${color}88)` }}
                />
            )}
            {/* Score number */}
            <text
                x={CX}
                y={CY - 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="20"
                fontWeight="700"
                fill={color}
                style={{ fontFamily: 'var(--font-space), sans-serif' }}
            >
                {score}
            </text>
            {/* Label */}
            <text
                x={CX}
                y={CY + 14}
                textAnchor="middle"
                fontSize="7.5"
                fill="var(--muted)"
                style={{ fontFamily: 'var(--font-space), sans-serif', letterSpacing: '0.1em' }}
            >
                SCORE
            </text>
        </svg>
    )
}
