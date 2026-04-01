'use client'

import { useState } from 'react'
import { createMarket, type Market } from '@/lib/greymarket'
import { useWallet } from '@/hooks/useWallet'

interface Props {
    onSuccess: (newMarket: Market) => void
}

const DEMO_MARKETS = [
    {
        question: 'Did the GenLayer hackathon judging criteria favor technical complexity over real-world impact?',
        context: 'https://dorahacks.io/hackathon/genlayer',
    },
    {
        question: 'Did OpenAI\'s shift to a for-profit structure in 2025 meaningfully compromise its original safety-first mission?',
        context: '',
    },
    {
        question: 'Has Ethereum\'s rollup-centric roadmap strengthened or weakened its competitive position against Solana over the past 12 months?',
        context: '',
    },
]

const NICHES = ['AI & ML', 'Crypto / DeFi', 'Governance', 'Tech', 'Finance', 'Sports', 'Other']

export default function CreateMarket({ onSuccess }: Props) {
    const { address, connect, isConnecting } = useWallet()
    const [question, setQuestion] = useState('')
    const [niche, setNiche] = useState('Crypto / DeFi')
    const [context, setContext] = useState('')
    const [deadlineStr, setDeadlineStr] = useState('')
    const [isPast, setIsPast] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [txHash, setTxHash] = useState('')
    const [error, setError] = useState('')

    function fillDemo(idx: number) {
        setQuestion(DEMO_MARKETS[idx].question)
        setContext(DEMO_MARKETS[idx].context)
        // Set deadline to now - 1 hour (past, so immediately resolvable)
        const past = new Date(Date.now() - 3600 * 1000)
        setDeadlineStr(past.toISOString().slice(0, 16))
        setIsPast(true)
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!address) return
        setSubmitting(true)
        setError('')
        setTxHash('')
        try {
            const deadline = deadlineStr
                ? Math.floor(new Date(deadlineStr).getTime() / 1000)
                : Math.floor(Date.now() / 1000) + 86400 * 7  // default 7 days
            const contextWithNiche = `[${niche}] ${context}`.trim()
            const hash = await createMarket(address, question, contextWithNiche, deadline)
            setTxHash(hash)
            // Build optimistic market object so UI updates instantly
            const optimisticMarket: Market = {
                id: Date.now(), // temp local id
                question: question.trim(),
                context: contextWithNiche,
                deadline,
                creator: address,
                total_yes: 0,
                total_no: 0,
                resolved: false,
                outcome: 'PENDING',
                reasoning: '',
                confidence: 0,
                pot: 0,
            }
            setQuestion('')
            setNiche('Crypto / DeFi')
            setContext('')
            setDeadlineStr('')
            setIsPast(false)
            onSuccess(optimisticMarket)
        } catch (err) {
            setError(String(err))
        } finally {
            setSubmitting(false)
        }
    }

    if (!address) {
        return (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
                <p className="text-sm" style={{ color: 'var(--muted)' }}>
                    Connect your wallet to create a market
                </p>
                <button
                    onClick={connect}
                    disabled={isConnecting}
                    className="rounded-lg px-5 py-2.5 font-semibold text-sm transition-opacity disabled:opacity-50 inline-flex items-center gap-2"
                    style={{ background: 'var(--accent)', color: '#fff' }}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="5" width="20" height="16" rx="2" /><path d="M16 12h2" /><path d="M2 10h20" />
                    </svg>
                    {isConnecting ? 'Connecting…' : 'Connect Wallet'}
                </button>
            </div>
        )
    }

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">

            {/* Demo shortcuts */}
            <div className="flex flex-col gap-2">
                <p className="cc-label" style={{ color: 'var(--muted)' }}>Qualitative bet picks</p>
                <div className="flex flex-col gap-1.5">
                    {DEMO_MARKETS.map((d, i) => (
                        <button
                            key={i}
                            type="button"
                            onClick={() => fillDemo(i)}
                            className="text-left text-xs px-3 py-2 rounded-lg border transition-colors hover:border-indigo-500"
                            style={{
                                borderColor: 'var(--border)',
                                color: 'var(--muted)',
                                background: 'transparent',
                            }}
                        >
                            {d.question.slice(0, 80)}…
                        </button>
                    ))}
                </div>
            </div>

            <hr style={{ borderColor: 'var(--border)' }} />

            {/* Niche */}
            <div className="flex flex-col gap-1.5">
                <label className="cc-label" style={{ color: 'var(--muted)' }}>Category</label>
                <select
                    className="cc-input"
                    value={niche}
                    onChange={e => setNiche(e.target.value)}
                >
                    {NICHES.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
            </div>

            {/* Question */}
            <div className="flex flex-col gap-1.5">
                <label className="cc-label" style={{ color: 'var(--muted)' }}>
                    Prediction Question *
                </label>
                <textarea
                    className="cc-input"
                    rows={3}
                    value={question}
                    onChange={e => setQuestion(e.target.value)}
                    placeholder="Ask something"
                    required
                    minLength={10}
                />
            </div>

            {/* Deadline */}
            <div className="flex flex-col gap-1.5">
                <label className="cc-label" style={{ color: 'var(--muted)' }}>
                    Resolution Deadline *
                    {isPast && (
                        <span className="ml-2 px-1.5 py-0.5 rounded text-xs"
                            style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>
                            Past → resolve immediately for demo
                        </span>
                    )}
                </label>
                <input
                    type="datetime-local"
                    className="cc-input"
                    value={deadlineStr}
                    onChange={e => {
                        setDeadlineStr(e.target.value)
                        setIsPast(new Date(e.target.value) < new Date())
                    }}
                    required
                />
            </div>

            {error && (
                <p className="text-sm px-3 py-2 rounded-lg" style={{ background: 'var(--error-bg)', color: 'var(--error)' }}>
                    {error}
                </p>
            )}

            {txHash && (
                <p className="text-sm px-3 py-2 rounded-lg" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>
                    Market created! Tx: <span className="addr">{txHash.slice(0, 20)}…</span>
                </p>
            )}

            <button
                type="submit"
                disabled={submitting || !question.trim() || !deadlineStr}
                className="rounded-lg px-5 py-3 font-semibold text-sm transition-opacity disabled:opacity-40"
                style={{ background: 'var(--accent)', color: '#fff' }}
            >
                {submitting ? 'Waiting for validator consensus…' : 'Create Market'}
            </button>
        </form>
    )
}
