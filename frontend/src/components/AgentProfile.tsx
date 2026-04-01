'use client'

import { useState } from 'react'
import { getAgentProfile, getInteractions, type AgentProfile as TProfile, type Interaction } from '@/lib/contract'
import ArcGauge from './ArcGauge'

export default function AgentProfile() {
    const [address, setAddress] = useState('')
    const [profile, setProfile] = useState<TProfile | null>(null)
    const [interactions, setInteractions] = useState<Interaction[]>([])
    const [loading, setLoading] = useState(false)
    const [errorMsg, setErrorMsg] = useState('')

    async function handleLookup(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        setErrorMsg('')
        setProfile(null)
        setInteractions([])
        try {
            const [prof, ints] = await Promise.all([
                getAgentProfile(address.trim()),
                getInteractions(address.trim()),
            ])
            if (!prof) {
                setErrorMsg('No agent found at this address.')
            } else {
                setProfile(prof)
                setInteractions(ints)
            }
        } catch (err) {
            setErrorMsg(String(err))
        } finally {
            setLoading(false)
        }
    }

    return (
        <div>
            <h2 className="text-xl font-bold mb-2">Agent Profile</h2>
            <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
                Look up any agent's full reputation history.
            </p>

            <form onSubmit={handleLookup} className="flex gap-2 max-w-lg mb-8">
                <input
                    type="text"
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    placeholder="Agent address (0x...)"
                    required
                    className="cc-input addr flex-1"
                />
                <button
                    type="submit"
                    disabled={loading}
                    className="rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50 shrink-0"
                    style={{ background: 'var(--accent)', color: '#fff' }}
                >
                    {loading ? '…' : 'Lookup'}
                </button>
            </form>

            {errorMsg && (
                <div
                    className="p-3 rounded-xl text-sm mb-4"
                    style={{ background: 'var(--error-bg)', color: 'var(--error)', border: '1px solid var(--error)' }}
                >
                    {errorMsg}
                </div>
            )}

            {profile && (
                <>
                    {/* Profile card */}
                    <div
                        className="cc-card p-5 mb-6"
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h3 className="text-lg font-bold">{profile.name}</h3>
                                <p className="text-sm" style={{ color: 'var(--muted)' }}>
                                    {profile.description}
                                </p>
                                <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>
                                    {profile.total_interactions} evaluated interactions
                                </p>
                            </div>
                            <ArcGauge
                                score={profile.reputation_score}
                                size={88}
                            />
                        </div>

                        {/* Score bar */}
                        <div className="mt-4">
                            <div className="flex justify-between text-xs mb-1.5" style={{ color: 'var(--muted)' }}>
                                <span>Reputation</span>
                                <span style={{ color: 'var(--foreground)' }}>{profile.reputation_score} / 100</span>
                            </div>
                            <div className="h-1.5 rounded-full" style={{ background: 'var(--border)' }}>
                                <div
                                    className="h-1.5 rounded-full transition-all"
                                    style={{
                                        width: `${profile.reputation_score}%`,
                                        background: reputationGradient(profile.reputation_score),
                                        boxShadow: `0 0 8px ${reputationGradient(profile.reputation_score)}88`,
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Interaction history */}
                    <h3 className="font-semibold mb-3">
                        Interaction History ({interactions.length})
                    </h3>
                    {interactions.length === 0 ? (
                        <p className="text-sm" style={{ color: 'var(--muted)' }}>
                            No interactions submitted yet.
                        </p>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {[...interactions].reverse().map((ix, i) => (
                                <div key={i} className="cc-card p-4">
                                    <div className="flex items-start justify-between gap-4 mb-3">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-semibold mb-1 tracking-wider" style={{ color: 'var(--muted)' }}>TASK</p>
                                            <p className="text-sm">{ix.task_description}</p>
                                        </div>
                                        <div className="shrink-0">
                                            <ArcGauge score={ix.ai_score} size={60} />
                                        </div>
                                    </div>

                                    <div className="mb-3">
                                        <p className="text-xs font-semibold mb-1 tracking-wider" style={{ color: 'var(--muted)' }}>OUTCOME</p>
                                        <p className="text-sm">{ix.outcome_description}</p>
                                    </div>

                                    <div className="flex gap-2 flex-wrap">
                                        <DimBadge label="Completeness" score={ix.completeness} />
                                        <DimBadge label="Quality" score={ix.quality} />
                                        <DimBadge label="Faithfulness" score={ix.faithfulness} />
                                    </div>

                                    {ix.reasoning && (
                                        <p className="text-xs mt-3 italic" style={{ color: 'var(--muted)' }}>
                                            "{ix.reasoning}"
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    )
}

function DimBadge({ label, score }: { label: string; score: number }) {
    return (
        <div
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs"
            style={{ background: 'var(--border)' }}
        >
            <span style={{ color: 'var(--muted)' }}>{label}</span>
            <span className="font-bold">{score}</span>
        </div>
    )
}

function reputationGradient(score: number): string {
    if (score >= 80) return '#4ade80'
    if (score >= 60) return '#a3e635'
    if (score >= 40) return '#fb923c'
    return '#f87171'
}
