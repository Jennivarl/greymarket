'use client'

import { useState, useEffect, useRef } from 'react'
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
    const [txStatus, setTxStatus] = useState('')
    const [refreshing, setRefreshing] = useState(false)
    const pollingRef = useRef(false)

    function dismissTx() {
        pollingRef.current = false
        setTxHash('')
        setTxStatus('')
    }

    async function manualRefresh() {
        setRefreshing(true)
        await onUpdate()
        setRefreshing(false)
    }

    // Auto-poll tx status after a bet is placed.
    // Two phases:
    //   Phase 1 (only when txHash starts with 'eth:'): The SDK timed out before
    //     extracting the GenLayer txId, but it saved the Ethereum tx hash for us.
    //     Poll eth_getTransactionReceipt directly via RPC (no SDK timeout), then
    //     parse the NewTransaction event log to get the real GenLayer txId.
    //   Phase 2: Poll the GenLayer consensus data contract for the txId status.
    useEffect(() => {
        if (!txHash) return

        if (txHash === 'pending') {
            setTxStatus('BROADCAST')
            return
        }

        pollingRef.current = true

            ; (async () => {
                // ── Phase 1: Ethereum receipt → extract GenLayer txId ────────────
                // Studionet consensus contract (emits NewTransaction event)
                const CONSENSUS_CONTRACT = '0x0112Bf6e83497965A5fdD6Dad1E447a6E004271D'
                const GENLAYER_RPC = 'https://studio.genlayer.com/api'

                let genLayerTxId = txHash

                if (txHash.startsWith('eth:')) {
                    setTxStatus('MINING')
                    const evmHash = txHash.slice(4)
                    let found = false

                    for (let i = 0; i < 120 && pollingRef.current; i++) {
                        await new Promise(r => setTimeout(r, 5000))
                        if (!pollingRef.current) return
                        try {
                            const res = await fetch(GENLAYER_RPC, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getTransactionReceipt', params: [evmHash] }),
                            })
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const j: any = await res.json()
                            const receipt = j?.result
                            if (!receipt) continue // not mined yet

                            if (receipt.status === '0x0') {
                                setTxStatus('REJECTED')
                                pollingRef.current = false
                                return
                            }
                            // Find the NewTransaction log from the consensus contract
                            // topics[1] is the indexed bytes32 txId (first indexed field)
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const log = receipt.logs?.find((l: any) =>
                                l.address?.toLowerCase() === CONSENSUS_CONTRACT.toLowerCase() &&
                                Array.isArray(l.topics) && l.topics.length >= 2
                            )
                            if (log?.topics?.[1]) {
                                genLayerTxId = log.topics[1]  // real GenLayer txId
                                found = true
                                break
                            }
                            // Receipt mined but no NewTransaction event → submission was rejected by consensus contract
                            setTxStatus('BROADCAST')
                            pollingRef.current = false
                            return
                        } catch { /* keep polling */ }
                    }

                    if (!found) {
                        if (pollingRef.current) { pollingRef.current = false; setTxStatus('TIMEOUT') }
                        return
                    }
                }

                // ── Phase 2: poll gen_getTransactionStatus ───────────────────────
                // Native GenLayer RPC — works on Studionet without ZKSync-OS VM.
                // Status codes: 1=PENDING, 2=CANCELED, 3=UNDETERMINED, 4=ACCEPTED, 5=FINALIZED
                setTxStatus('PENDING')

                for (let i = 0; i < 120 && pollingRef.current; i++) {
                    await new Promise(r => setTimeout(r, 5000))
                    if (!pollingRef.current) break
                    try {
                        const res = await fetch(GENLAYER_RPC, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                jsonrpc: '2.0', id: 1,
                                method: 'gen_getTransactionStatus',
                                params: [genLayerTxId]
                            })
                        })
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const j: any = await res.json()
                        const status: number = j?.result
                        console.log('[genlayer] gen_getTransactionStatus poll', i, 'status:', status)
                        if (status === 4 || status === 5) {
                            // ACCEPTED or FINALIZED
                            pollingRef.current = false
                            setTxStatus('ACCEPTED')
                            await onUpdate()
                            break
                        } else if (status === 2 || status === 3) {
                            // CANCELED or UNDETERMINED
                            pollingRef.current = false
                            setTxStatus('REJECTED')
                            break
                        }
                        // status === 1 (PENDING) → keep polling
                    } catch (e) {
                        console.warn('[genlayer] gen_getTransactionStatus poll', i, e)
                    }
                }
                if (pollingRef.current) { pollingRef.current = false; setTxStatus('TIMEOUT') }
            })()

        return () => { pollingRef.current = false }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [txHash])

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
        setTxStatus('')
        pollingRef.current = false
        try {
            const hash = await placeBet(address, market.id, position, betAmount)
            setTxHash(hash)  // triggers the polling useEffect
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
                    {txStatus === 'ACCEPTED' || txStatus === 'FINALIZED' ? (
                        <div className="flex items-center gap-2">
                            <span style={{ color: 'var(--success)' }}>✔</span>
                            <span className="font-semibold" style={{ color: 'var(--success)' }}>Bet confirmed! Market stats updated.</span>
                        </div>
                    ) : txStatus === 'REJECTED' || txStatus === 'CANCELLED' ? (
                        <>
                            <div className="flex items-center gap-2">
                                <span style={{ color: 'var(--error)' }}>✘</span>
                                <span className="font-semibold" style={{ color: 'var(--error)' }}>Bet rejected by validators. Your GUSDC was not deducted.</span>
                            </div>
                            <button onClick={dismissTx} className="self-start text-xs px-3 py-1.5 rounded-lg border" style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>Dismiss</button>
                        </>
                    ) : txStatus === 'BROADCAST' ? (
                        <>
                            <p className="font-semibold" style={{ color: 'var(--accent-light)' }}>⚠️ Transaction sent — ID not returned</p>
                            <p style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
                                MetaMask signed and broadcast your transaction, but the GenLayer txId wasn’t returned (Bradbury consensus timeout on submission). Your bet <strong style={{ color: 'var(--foreground)' }}>may or may not</strong> have landed — click below to check the market.
                            </p>
                            <div className="flex gap-2">
                                <button onClick={manualRefresh} disabled={refreshing} className="text-xs px-3 py-1.5 rounded-lg font-semibold disabled:opacity-50" style={{ background: 'var(--accent)', color: '#fff' }}>
                                    {refreshing ? 'Checking…' : '↻ Check market'}
                                </button>
                                <button onClick={dismissTx} className="text-xs px-3 py-1.5 rounded-lg border" style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>Dismiss</button>
                            </div>
                        </>
                    ) : txStatus === 'MINING' ? (
                        <>
                            <div className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-1">
                                    <span className="cc-dot">●</span>
                                    <span className="cc-dot" style={{ animationDelay: '0.3s' }}>●</span>
                                    <span className="cc-dot" style={{ animationDelay: '0.6s' }}>●</span>
                                </span>
                                <span className="font-semibold" style={{ color: 'var(--accent-light)' }}>Waiting for block confirmation…</span>
                            </div>
                            <p style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
                                Signed by MetaMask — waiting for the Ethereum tx to be mined on Studionet. Will hand off to GenLayer validators automatically once confirmed.
                            </p>
                        </>
                    ) : txStatus === 'INFRA_ERROR' ? (
                        <>
                            <p className="font-semibold" style={{ color: 'var(--accent-light)' }}>⚠️ Validator infrastructure issue</p>
                            <p style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
                                Bradbury&apos;s ZKSync-OS VM returned errors while processing your transaction.
                                Market data has been refreshed — <strong style={{ color: 'var(--foreground)' }}>check if your bet appears in the totals above.</strong>
                                If it does, your bet landed. If not, it likely did not go through.
                            </p>
                            <div className="flex gap-2">
                                <button onClick={manualRefresh} disabled={refreshing} className="text-xs px-3 py-1.5 rounded-lg font-semibold disabled:opacity-50" style={{ background: 'var(--accent)', color: '#fff' }}>
                                    {refreshing ? 'Checking…' : '↻ Refresh again'}
                                </button>
                                <button onClick={dismissTx} className="text-xs px-3 py-1.5 rounded-lg border" style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>Dismiss</button>
                            </div>
                        </>
                    ) : txStatus === 'TIMEOUT' ? (
                        <>
                            <p className="font-semibold" style={{ color: 'var(--accent-light)' }}>⏰ Still unconfirmed after 10 min</p>
                            <p style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
                                Bradbury validators are taking unusually long. Your bet is likely queued — check the market to see if it landed.
                            </p>
                            <div className="flex gap-2">
                                <button onClick={manualRefresh} disabled={refreshing} className="text-xs px-3 py-1.5 rounded-lg font-semibold disabled:opacity-50" style={{ background: 'var(--accent)', color: '#fff' }}>
                                    {refreshing ? 'Checking…' : '↻ Check market'}
                                </button>
                                <button onClick={dismissTx} className="text-xs px-3 py-1.5 rounded-lg border" style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>Dismiss</button>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-1">
                                    <span className="cc-dot">●</span>
                                    <span className="cc-dot" style={{ animationDelay: '0.3s' }}>●</span>
                                    <span className="cc-dot" style={{ animationDelay: '0.6s' }}>●</span>
                                </span>
                                <span className="font-semibold" style={{ color: 'var(--accent-light)' }}>
                                    Validators processing…
                                    {txStatus && <span className="cc-label ml-2" style={{ color: 'var(--muted)' }}>{txStatus}</span>}
                                </span>
                            </div>
                            <p style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
                                GenLayer validators must independently reach consensus before confirming.
                                On Studionet this usually takes <strong style={{ color: 'var(--foreground)' }}>under a minute</strong>.
                                This page updates automatically — no need to refresh.
                            </p>
                            {txHash !== 'pending' && (
                                <p className="text-xs addr" style={{ color: 'var(--muted)' }}>Tx: {txHash.slice(0, 30)}…</p>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    )
}
