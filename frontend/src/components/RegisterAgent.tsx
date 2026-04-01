'use client'

import { useState } from 'react'
import { registerAgent } from '@/lib/contract'
import { useWallet } from '@/lib/useWallet'

type Props = { onSuccess?: () => void }

export default function RegisterAgent({ onSuccess }: Props) {
    const { address, isConnected, isConnecting, error: walletError, connect } = useWallet()
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [status, setStatus] = useState<'idle' | 'pending' | 'done' | 'error'>('idle')
    const [txHash, setTxHash] = useState('')
    const [errorMsg, setErrorMsg] = useState('')

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!address) return
        setStatus('pending')
        setErrorMsg('')
        try {
            const hash = await registerAgent(address, name.trim(), description.trim())
            setTxHash(hash)
            setStatus('done')
            onSuccess?.()
        } catch (err) {
            setErrorMsg(String(err))
            setStatus('error')
        }
    }

    const step1Done = isConnected && !!address
    const step2Done = step1Done && name.trim().length > 0
    const step3Done = step2Done && description.trim().length > 0

    const steps = [
        { label: 'Connect', done: step1Done, active: !step1Done },
        { label: 'Name', done: step2Done, active: step1Done && !step2Done },
        { label: 'Describe', done: step3Done, active: step2Done && !step3Done },
    ]

    return (
        <div className="max-w-lg">
            <h2 className="text-xl font-bold mb-1">Register Your Agent</h2>
            <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
                Register an AI agent's address on-chain. Once registered, anyone can
                submit interactions for AI-powered quality evaluation.
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

                {/* Step 2: Name */}
                <div className="flex flex-col gap-1.5" style={{ opacity: step1Done ? 1 : 0.4 }}>
                    <label className="text-sm font-semibold">Agent Name</label>
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>
                        A short recognisable name for your agent.
                    </span>
                    <input
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="e.g. CodeReviewBot"
                        required
                        disabled={!step1Done}
                        className="cc-input"
                    />
                </div>

                {/* Step 3: Description */}
                <div className="flex flex-col gap-1.5" style={{ opacity: step2Done ? 1 : 0.4 }}>
                    <label className="text-sm font-semibold">Agent Description</label>
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>
                        What does your agent do? Be specific — this helps AI validators evaluate correctly.
                    </span>
                    <textarea
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        placeholder="e.g. An AI agent that reviews pull requests, identifies bugs, and suggests improvements."
                        required
                        rows={3}
                        disabled={!step2Done}
                        className="cc-input"
                    />
                </div>

                <button
                    type="submit"
                    disabled={status === 'pending' || !step3Done}
                    className="rounded-lg px-6 py-2.5 font-semibold text-sm transition-opacity disabled:opacity-40 flex items-center justify-center gap-2"
                    style={{ background: 'var(--accent)', color: '#fff' }}
                >
                    {status === 'pending' ? (
                        <>
                            Registering
                            <Dots />
                        </>
                    ) : 'Register Agent →'}
                </button>

                {status === 'done' && (
                    <div
                        className="p-3 rounded-lg text-sm"
                        style={{ background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success)' }}
                    >
                        ✓ Agent registered!{' '}
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

