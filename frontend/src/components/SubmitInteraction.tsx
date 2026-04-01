'use client'

import { useState } from 'react'
import { submitInteraction } from '@/lib/contract'
import { useWallet } from '@/lib/useWallet'

type Props = { onSuccess?: () => void }

export default function SubmitInteraction({ onSuccess }: Props) {
    const { address, isConnected, isConnecting, error: walletError, connect } = useWallet()
    const [agentAddr, setAgentAddr] = useState('')
    const [task, setTask] = useState('')
    const [outcome, setOutcome] = useState('')
    const [status, setStatus] = useState<'idle' | 'pending' | 'done' | 'error'>('idle')
    const [txHash, setTxHash] = useState('')
    const [errorMsg, setErrorMsg] = useState('')

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!address) return
        setStatus('pending')
        setErrorMsg('')
        try {
            const hash = await submitInteraction(
                address,
                agentAddr.trim(),
                task.trim(),
                outcome.trim()
            )
            setTxHash(hash)
            setStatus('done')
            onSuccess?.()
        } catch (err) {
            setErrorMsg(String(err))
            setStatus('error')
        }
    }

    const step1Done = isConnected && !!address
    const step2Done = step1Done && agentAddr.trim().length > 0
    const step3Done = step2Done && task.trim().length > 0 && outcome.trim().length > 0

    const steps = [
        { label: 'Connect', done: step1Done, active: !step1Done },
        { label: 'Agent', done: step2Done, active: step1Done && !step2Done },
        { label: 'Interaction', done: step3Done, active: step2Done && !step3Done },
    ]

    return (
        <div className="max-w-lg">
            <h2 className="text-xl font-bold mb-1">Submit an Interaction</h2>
            <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
                Describe what the agent was asked to do and what it delivered. AI validators
                will independently score the outcome — no human rating required.
            </p>

            {/* Step indicators */}
            <div className="flex items-center mb-8">
                {steps.map((step, i) => (
                    <div key={i} className="flex items-center" style={{ flex: i < steps.length - 1 ? '1' : 'none' }}>
                        <div className="flex items-center gap-2 shrink-0">
                            <div
                                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                                style={{
                                    background: step.done ? 'var(--accent)' : 'transparent',
                                    border: `1.5px solid ${step.done ? 'var(--accent)' : step.active ? 'var(--accent-light)' : 'var(--border)'}`,
                                    color: step.done ? '#fff' : step.active ? 'var(--accent-light)' : 'var(--muted)',
                                }}
                            >
                                {step.done ? '✓' : i + 1}
                            </div>
                            <span
                                className="text-xs font-medium hidden sm:inline"
                                style={{ color: step.done ? 'var(--foreground)' : step.active ? 'var(--accent-light)' : 'var(--muted)' }}
                            >
                                {step.label}
                            </span>
                        </div>
                        {i < steps.length - 1 && (
                            <div
                                className="flex-1 h-px mx-3"
                                style={{ background: step.done ? 'var(--accent)' : 'var(--border)' }}
                            />
                        )}
                    </div>
                ))}
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-5">

                {/* Step 1: Wallet */}
                {step1Done ? (
                    <div
                        className="flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm"
                        style={{ borderColor: 'var(--accent)', color: 'var(--accent-light)' }}
                    >
                        <span style={{ color: 'var(--success)' }}>●</span>
                        <span className="addr">{address!.slice(0, 10)}…{address!.slice(-6)}</span>
                        <span className="ml-auto text-xs" style={{ color: 'var(--muted)' }}>connected</span>
                    </div>
                ) : (
                    <div className="flex flex-col gap-1.5">
                        <button
                            type="button"
                            onClick={connect}
                            disabled={isConnecting}
                            className="rounded-lg px-4 py-2.5 font-semibold text-sm transition-opacity disabled:opacity-50"
                            style={{ background: 'var(--accent)', color: '#fff' }}
                        >
                            {isConnecting ? 'Connecting…' : (
                                <span className="inline-flex items-center gap-2">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="2" y="5" width="20" height="16" rx="2" />
                                        <path d="M16 12h2" />
                                        <path d="M2 10h20" />
                                    </svg>
                                    Connect Wallet to Continue
                                </span>
                            )}
                        </button>
                        {walletError && (
                            <span className="text-xs" style={{ color: 'var(--error)' }}>{walletError}</span>
                        )}
                    </div>
                )}

                {/* Step 2: Agent address */}
                <div className="flex flex-col gap-1.5" style={{ opacity: step1Done ? 1 : 0.4 }}>
                    <label className="text-sm font-semibold">Agent Address</label>
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>
                        The on-chain address of the agent being evaluated.
                    </span>
                    <input
                        type="text"
                        value={agentAddr}
                        onChange={e => setAgentAddr(e.target.value)}
                        placeholder="0x..."
                        required
                        disabled={!step1Done}
                        className="cc-input addr"
                    />
                </div>

                {/* Step 3: Task + Outcome */}
                <div className="flex flex-col gap-4" style={{ opacity: step2Done ? 1 : 0.4 }}>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-semibold">Task Description</label>
                        <span className="text-xs" style={{ color: 'var(--muted)' }}>
                            Plain English: what was the agent asked to do?
                        </span>
                        <textarea
                            value={task}
                            onChange={e => setTask(e.target.value)}
                            placeholder="e.g. Summarise this 10-page research paper into 3 bullet points."
                            required
                            rows={3}
                            disabled={!step2Done}
                            className="cc-input"
                        />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-semibold">Outcome Description</label>
                        <span className="text-xs" style={{ color: 'var(--muted)' }}>
                            Plain English: what did the agent actually deliver?
                        </span>
                        <textarea
                            value={outcome}
                            onChange={e => setOutcome(e.target.value)}
                            placeholder="e.g. The agent provided 3 bullet points covering the main findings, methodology, and limitations."
                            required
                            rows={4}
                            disabled={!step2Done}
                            className="cc-input"
                        />
                    </div>
                </div>

                {/* Scoring info */}
                <div
                    className="px-3 py-2.5 rounded-lg border text-xs"
                    style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
                >
                    AI validators independently score{' '}
                    <span style={{ color: 'var(--foreground)' }}>completeness (30%)</span>,{' '}
                    <span style={{ color: 'var(--foreground)' }}>quality (40%)</span>, and{' '}
                    <span style={{ color: 'var(--foreground)' }}>faithfulness (30%)</span>.
                    Consensus required — no single validator controls the result.
                </div>

                <button
                    type="submit"
                    disabled={status === 'pending' || !step3Done}
                    className="rounded-lg px-6 py-2.5 font-semibold text-sm transition-opacity disabled:opacity-40 flex items-center justify-center gap-2"
                    style={{ background: 'var(--accent)', color: '#fff' }}
                >
                    {status === 'pending' ? (
                        <>
                            Waiting for AI validators
                            <Dots />
                        </>
                    ) : 'Submit for AI Evaluation →'}
                </button>

                {status === 'done' && (
                    <div
                        className="p-3 rounded-lg text-sm"
                        style={{ background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success)' }}
                    >
                        ✓ Submitted! AI validators are scoring it.{' '}
                        <code className="break-all text-xs addr">{txHash}</code>
                    </div>
                )}
                {status === 'error' && (
                    <div
                        className="p-3 rounded-lg text-sm"
                        style={{ background: 'var(--error-bg)', color: 'var(--error)', border: '1px solid var(--error)' }}
                    >
                        {errorMsg}
                    </div>
                )}
            </form>
        </div>
    )
}

function Dots() {
    return (
        <span className="inline-flex gap-px">
            {[0, 300, 600].map(d => (
                <span key={d} className="cc-dot" style={{ animationDelay: `${d}ms` }}>.</span>
            ))}
        </span>
    )
}
