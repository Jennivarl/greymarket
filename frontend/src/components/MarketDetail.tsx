'use client'

import { useState } from 'react'
import { type Market, placeBet, resolveMarket } from '@/lib/greymarket'
import { useWallet } from '@/hooks/useWallet'

interface Props {
    market: Market
    userBalance: number
    onUpdate: () => void
}

function formatDeadline(deadline: number): string {
    return new Date(deadline * 1000).toLocaleString()
}

export default function MarketDetail({ market, userBalance, onUpdate }: Props) {
    const { address, connect, isConnecting } = useWallet()
    const [betting, setBetting] = useState(false)
    const [resolving, setResolving] = useState(false)
    const [error, setError] = useState('')
    const [txHash, setTxHash] = useState('')
    const [betAmount, setBetAmount] = useState(100)
    const [pendingRefresh, setPendingRefresh] = useState(false)

    const now = Math.floor(Date.now() / 1000)
    const isExpired = now > market.deadline
    const total = market.total_yes + market.total_no
    const yesPct = total > 0 ? Math.round((market.total_yes / total) * 100) : 50
    const noPct = 100 - yesPct

    async function handleBet(position: 'YES' | 'NO') {
        if (!address) return
        if (betAmount < 100) { setError('Minimum bet is 100 GUSDC'); return }
        if (betAmount > userBalance) { setError(`Insufficient balance — you only have ${userBalance} GUSDC`); return }
        setBetting(true)
        setError('')
        setTxHash('')
        try {
            const hash = await placeBet(address, market.id, position, betAmount)
            setTxHash(hash)
            setPendingRefresh(true)
            await onUpdate()
        } catch (err) {
            setError(String(err))
        } finally {
            setBetting(false)
        }
    }

    async function handleResolve() {
        if (!address) return
        setResolving(true)
        setError('')
        setTxHash('')
        try {
            const hash = await resolveMarket(address, market.id)
            setTxHash(hash)
            onUpdate()
        } catch (err) {
            setError(String(err))
        } finally {
            setResolving(false)
        }
    }

    return (
        <div className="flex flex-col gap-5">

            {/* Header */}
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                    <span
                        className="cc-label px-2 py-0.5 rounded-full"
                        style={{
                            background: market.resolved
                                ? market.outcome === 'YES' ? 'var(--success-bg)' : 'var(--error-bg)'
                                : isExpired ? 'rgba(180,83,9,0.1)' : 'rgba(74,222,128,0.08)',
                            color: market.resolved
                                ? market.outcome === 'YES' ? 'var(--success)' : 'var(--error)'
                                : isExpired ? 'var(--accent-light)' : 'var(--success)',
                        }}
                    >
                        {market.resolved
                            ? `Verdict: ${market.outcome}`
                            : isExpired
                                ? 'Awaiting Verdict'
                                : '● Betting Open'}
                    </span>
                    <span className="cc-label" style={{ color: 'var(--muted)' }}>
                        Market #{market.id}
                    </span>
                </div>
                <h3 className="text-base font-semibold leading-snug" style={{ color: 'var(--foreground)' }}>
                    {market.question}
                </h3>
                <p className="text-xs addr" style={{ color: 'var(--muted)' }}>
                    Deadline: {formatDeadline(market.deadline)}
                </p>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3">
                {[
                    { label: 'Total Volume', value: `${total} GUSDC` },
                    { label: 'Pot', value: `${market.pot} GUSDC` },
                    { label: market.resolved ? 'Confidence' : 'Your Balance', value: market.resolved ? `${market.confidence}%` : `${userBalance} GUSDC` },
                ].map(s => (
                    <div key={s.label} className="cc-card p-3 flex flex-col gap-0.5">
                        <span className="cc-label" style={{ color: 'var(--muted)' }}>{s.label}</span>
                        <span className="text-sm font-semibold addr" style={{ color: 'var(--foreground)' }}>{s.value}</span>
                    </div>
                ))}
            </div>

            {/* YES/NO bar */}
            <div className="flex flex-col gap-2">
                <div className="flex rounded-full overflow-hidden" style={{ height: 10 }}>
                    <div style={{ width: `${yesPct}%`, background: 'var(--success)', transition: 'width 0.4s ease' }} />
                    <div style={{ width: `${noPct}%`, background: 'var(--error)' }} />
                </div>
                <div className="flex justify-between">
                    <span className="text-sm font-semibold" style={{ color: 'var(--success)' }}>
                        YES — {yesPct}% · {market.total_yes} GUSDC
                    </span>
                    <span className="text-sm font-semibold" style={{ color: 'var(--error)' }}>
                        {market.total_no} GUSDC · {noPct}% — NO
                    </span>
                </div>
            </div>

            {/* Verdict display */}
            {market.resolved && (
                <div
                    className="rounded-xl p-4 flex flex-col gap-2"
                    style={{
                        background: market.outcome === 'YES' ? 'var(--success-bg)' : 'var(--error-bg)',
                        border: `1px solid ${market.outcome === 'YES' ? 'rgba(74,222,128,0.3)' : 'rgba(252,165,165,0.3)'}`,
                    }}
                >
                    <div className="flex items-center gap-2">
                        <span
                            className="text-2xl font-black"
                            style={{
                                fontFamily: 'var(--font-orbitron)',
                                color: market.outcome === 'YES' ? 'var(--success)' : 'var(--error)',
                            }}
                        >
                            {market.outcome}
                        </span>
                        <span className="cc-label" style={{ color: 'var(--muted)' }}>
                            AI Verdict · {market.confidence}% confidence
                        </span>
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--foreground)' }}>
                        {market.reasoning}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>
                        Resolved by GenLayer AI validators · Immutable on-chain
                    </p>
                </div>
            )}

            {/* Actions */}
            {!address ? (
                <button
                    onClick={connect}
                    disabled={isConnecting}
                    className="rounded-lg px-5 py-3 font-semibold text-sm transition-opacity disabled:opacity-50 inline-flex items-center justify-center gap-2"
                    style={{ background: 'var(--accent)', color: '#fff' }}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="5" width="20" height="16" rx="2" /><path d="M16 12h2" /><path d="M2 10h20" />
                    </svg>
                    {isConnecting ? 'Connecting…' : 'Connect Wallet to Bet'}
                </button>
            ) : !market.resolved && !isExpired ? (
                <div className="flex flex-col gap-3">
                    <p className="cc-label" style={{ color: 'var(--muted)' }}>
                        Place your bet · Balance: {userBalance} GUSDC
                    </p>
                    {/* Amount input */}
                    <div className="flex items-center gap-2">
                        <label className="cc-label whitespace-nowrap" style={{ color: 'var(--muted)' }}>Amount (GUSDC)</label>
                        <input
                            type="number"
                            min={100}
                            max={userBalance}
                            step={100}
                            value={betAmount}
                            onChange={e => setBetAmount(Math.max(100, Math.min(userBalance, Number(e.target.value) || 100)))}
                            disabled={betting}
                            className="flex-1 rounded-lg px-3 py-2 text-sm font-semibold text-right border outline-none"
                            style={{
                                background: 'var(--card)',
                                border: '1px solid var(--border)',
                                color: 'var(--foreground)',
                            }}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => handleBet('YES')}
                            disabled={betting || userBalance < 100}
                            className="rounded-lg px-4 py-3 text-sm font-bold transition-all disabled:opacity-40 hover:opacity-90"
                            style={{ background: 'var(--success)', color: '#0a0a0f' }}
                        >
                            {betting ? '…' : `▲ YES · ${betAmount} GUSDC`}
                        </button>
                        <button
                            onClick={() => handleBet('NO')}
                            disabled={betting || userBalance < 100}
                            className="rounded-lg px-4 py-3 text-sm font-bold transition-all disabled:opacity-40 hover:opacity-90"
                            style={{ background: 'var(--error)', color: '#0a0a0f' }}
                        >
                            {betting ? '…' : `▼ NO · ${betAmount} GUSDC`}
                        </button>
                    </div>
                </div>
            ) : !market.resolved && isExpired ? (
                <div className="flex flex-col gap-3">
                    <div
                        className="rounded-lg px-4 py-3 text-sm"
                        style={{ background: 'rgba(180,83,9,0.1)', color: 'var(--accent-light)', border: '1px solid rgba(180,83,9,0.3)' }}
                    >
                        Deadline passed. AI is ready to render a verdict.
                    </div>
                    <button
                        onClick={handleResolve}
                        disabled={resolving}
                        className="rounded-lg px-5 py-3 font-bold text-sm transition-opacity disabled:opacity-50"
                        style={{ background: 'var(--accent)', color: '#fff' }}
                    >
                        {resolving
                            ? <span className="inline-flex items-center gap-2">
                                <span className="cc-dot">●</span><span className="cc-dot" style={{ animationDelay: '0.3s' }}>●</span><span className="cc-dot" style={{ animationDelay: '0.6s' }}>●</span>
                                &nbsp;AI Fetching Evidence…
                            </span>
                            : '🎲 Request AI Verdict'}
                    </button>
                </div>
            ) : null}

            {error && (
                <p className="text-sm px-3 py-2 rounded-lg" style={{ background: 'var(--error-bg)', color: 'var(--error)' }}>
                    {error}
                </p>
            )}
            {txHash && !market.resolved && (
                <div
                    className="flex flex-col gap-3 px-4 py-3 rounded-xl text-sm"
                    style={{ background: 'rgba(180,83,9,0.08)', border: '1px solid rgba(180,83,9,0.25)', color: 'var(--foreground)' }}
                >
                    <div className="flex items-center gap-2">
                        <span className="text-base">⏳</span>
                        <span className="font-semibold" style={{ color: 'var(--accent-light)' }}>
                            Bet submitted — waiting for validators
                        </span>
                    </div>
                    <p style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
                        <strong style={{ color: 'var(--foreground)' }}>Why does this take so long?</strong><br />
                        GenLayer runs multiple AI validators that must independently reach consensus before a transaction is confirmed on-chain. On the Bradbury testnet this typically takes <strong style={{ color: 'var(--foreground)' }}>1–5 minutes</strong>, but can take longer under load.
                    </p>
                    <p style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
                        Your MetaMask already signed and broadcast the transaction — <strong style={{ color: 'var(--foreground)' }}>your bet is queued</strong>. This page will not update automatically. Once you think enough time has passed, click the button below to pull the latest state from the chain.
                    </p>
                    {txHash !== 'pending' && (
                        <p className="text-xs addr" style={{ color: 'var(--muted)' }}>
                            Tx: {txHash.slice(0, 30)}…
                        </p>
                    )}
                    {pendingRefresh && (
                        <button
                            onClick={async () => { setPendingRefresh(false); await onUpdate() }}
                            className="self-start text-xs px-4 py-2 rounded-lg font-semibold transition-opacity hover:opacity-80"
                            style={{ background: 'var(--accent)', color: '#fff' }}
                        >
                            ↻ Check if my bet landed
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}
