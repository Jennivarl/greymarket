'use client'

import { type Market } from '@/lib/greymarket'

interface Props {
    market: Market
    selected: boolean
    onClick: () => void
}

function timeLeft(deadline: number): string {
    const now = Math.floor(Date.now() / 1000)
    const diff = deadline - now
    if (diff <= 0) return 'Ended'
    const d = Math.floor(diff / 86400)
    const h = Math.floor((diff % 86400) / 3600)
    if (d > 0) return `${d}d ${h}h left`
    const m = Math.floor((diff % 3600) / 60)
    if (h > 0) return `${h}h ${m}m left`
    return `${m}m left`
}

export default function MarketCard({ market, selected, onClick }: Props) {
    const total = market.total_yes + market.total_no
    const yesPct = total > 0 ? Math.round((market.total_yes / total) * 100) : 50
    const noPct = 100 - yesPct
    const ended = Math.floor(Date.now() / 1000) > market.deadline

    return (
        <button
            onClick={onClick}
            className="cc-card w-full text-left p-4 flex flex-col gap-3 transition-all"
            style={{
                border: selected
                    ? '1px solid var(--accent)'
                    : '1px solid var(--border)',
                boxShadow: selected ? '0 0 20px rgba(180,83,9,0.2)' : undefined,
                borderRadius: 12,
            }}
        >
            {/* Status badge + timer */}
            <div className="flex items-center justify-between gap-2">
                <span
                    className="cc-label px-2 py-0.5 rounded-full"
                    style={{
                        background: market.resolved
                            ? market.outcome === 'YES'
                                ? 'var(--success-bg)'
                                : 'var(--error-bg)'
                            : ended
                                ? 'rgba(180,83,9,0.1)'
                                : 'rgba(74,222,128,0.08)',
                        color: market.resolved
                            ? market.outcome === 'YES'
                                ? 'var(--success)'
                                : 'var(--error)'
                            : ended
                                ? 'var(--accent-light)'
                                : 'var(--success)',
                    }}
                >
                    {market.resolved ? `✓ ${market.outcome}` : ended ? 'Awaiting Verdict' : '● Live'}
                </span>
                <span className="cc-label" style={{ color: 'var(--muted)' }}>
                    {market.resolved ? `${market.confidence}% confidence` : timeLeft(market.deadline)}
                </span>
            </div>

            {/* Question */}
            <p
                className="text-sm font-medium leading-snug"
                style={{
                    color: 'var(--foreground)',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                }}
            >
                {market.question}
            </p>

            {/* YES/NO bar */}
            <div className="flex flex-col gap-1.5">
                <div className="flex rounded-full overflow-hidden" style={{ height: 6 }}>
                    <div
                        style={{
                            width: `${yesPct}%`,
                            background: 'var(--success)',
                            transition: 'width 0.4s ease',
                        }}
                    />
                    <div
                        style={{
                            width: `${noPct}%`,
                            background: 'var(--error)',
                        }}
                    />
                </div>
                <div className="flex justify-between">
                    <span className="cc-label" style={{ color: 'var(--success)' }}>
                        YES {yesPct}% · {market.total_yes} GUSDC
                    </span>
                    <span className="cc-label" style={{ color: 'var(--error)' }}>
                        {market.total_no} GUSDC · {noPct}% NO
                    </span>
                </div>
            </div>

            {/* Pot */}
            <div className="flex items-center justify-between">
                <span className="cc-label" style={{ color: 'var(--muted)' }}>
                    Pot: <span style={{ color: 'var(--foreground)', fontFamily: 'var(--font-mono)' }}>{market.pot} GUSDC</span>
                </span>
            </div>
        </button>
    )
}
