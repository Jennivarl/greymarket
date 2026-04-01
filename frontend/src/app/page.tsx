'use client'

import { useState, useEffect, useCallback } from 'react'
import { getAllMarkets, getBalance, type Market } from '@/lib/greymarket'
import GreyMarketLogo from '@/components/GreyMarketLogo'
import WalletButton from '@/components/WalletButton'
import MarketCard from '@/components/MarketCard'
import MarketDetail from '@/components/MarketDetail'
import CreateMarket from '@/components/CreateMarket'
import { useWallet } from '@/lib/useWallet'

type View = 'markets' | 'create'

export default function Home() {
    const [markets, setMarkets] = useState<Market[]>([])
    const [loading, setLoading] = useState(false)
    const [selected, setSelected] = useState<Market | null>(null)
    const [view, setView] = useState<View>('markets')
    const [dark, setDark] = useState(false)
    const { address } = useWallet()
    const [balance, setBalance] = useState(1000)

    const load = useCallback((currentSelected?: Market | null) => {
        // Fire background refresh — gen_call on Bradbury takes 1-3 min so we
        // never block the UI. Markets created are shown optimistically immediately.
        getAllMarkets().then(ms => {
            const reversed = [...ms].reverse()
            setMarkets(prev => {
                const chainIds = new Set(ms.map(m => m.id))
                const optimistic = prev.filter(m => !chainIds.has(m.id))
                return [...reversed, ...optimistic]
            })
            if (currentSelected) {
                const updated = ms.find(m => m.id === currentSelected.id)
                if (updated) setSelected(updated)
            }
        }).catch(() => { })
        // Show content immediately
        setLoading(false)
    }, [])

    useEffect(() => { load() }, [load])

    useEffect(() => {
        if (address) getBalance(address).then(setBalance)
    }, [address])

    useEffect(() => {
        document.documentElement.classList.toggle('dark', dark)
    }, [dark])

    const openMarkets = markets.filter(m => !m.resolved)
    const resolvedMarkets = markets.filter(m => m.resolved)

    return (
        <div className="min-h-screen" style={{ background: 'var(--background)' }}>

            {/* Header */}
            <header
                className="sticky top-0 z-20 border-b px-6 py-3 flex items-center justify-between"
                style={{ borderColor: 'var(--border)', background: 'var(--card)', backdropFilter: 'blur(12px)' }}
            >
                <GreyMarketLogo size={38} />
                <div className="flex items-center gap-3">
                    {address && (
                        <span
                            className="hidden sm:inline text-xs px-3 py-1 rounded-full"
                            style={{ background: 'rgba(74,222,128,0.1)', color: 'var(--success)' }}
                        >
                            {balance} GUSDC
                        </span>
                    )}
                    <button
                        onClick={() => setDark(d => !d)}
                        className="text-base px-2 py-1 rounded-lg border transition-opacity hover:opacity-70"
                        style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
                        title="Toggle light / dark"
                    >
                        {dark ? '' : ''}
                    </button>
                    <WalletButton />
                </div>
            </header>

            {/* Hero strip */}
            <div className="cc-hero">
                {/* Photo background */}
                <img
                    src="/amber-hero.png"
                    alt=""
                    className="cc-hero-bg"
                    style={{ objectFit: 'cover', objectPosition: 'center' }}
                />
                {/* Dark overlay so text stays readable */}
                <div className="cc-hero-bg" style={{ background: 'linear-gradient(to right, rgba(10,10,20,0.72) 0%, rgba(10,10,20,0.45) 60%, rgba(10,10,20,0.55) 100%)' }} />
                <div className="cc-hero-content">
                    <p className="cc-hero-eyebrow">Powered by GenLayer · AI validators settle all disputes</p>
                    <h2 className="cc-hero-heading">
                        Prediction Markets for Grey Areas.{' '}
                        <span className="cc-hero-accent">Resolved by AI.</span>
                    </h2>
                    <p className="cc-hero-sub">
                        The only prediction market for questions that require wisdom — not just facts.
                        GenLayer AI reads live web evidence and reaches validator consensus.
                        No oracle. No disputes. No corruption.
                    </p>
                </div>
            </div>

            {/* Pitch tagline */}
            <div className="flex items-center justify-center px-6 py-4 text-center" style={{ borderBottom: '1px solid var(--border)', background: 'var(--card)' }}>
                <p className="text-sm font-semibold tracking-wide" style={{ color: 'var(--accent)' }}>
                    Any question where reasonable people disagree
                </p>
            </div>

            {/* Two-column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] min-h-[calc(100vh-300px)]">

                {/* Left */}
                <div className="border-b lg:border-b-0 lg:border-r p-6 lg:p-8" style={{ borderColor: 'var(--border)' }}>
                    <div
                        className="inline-flex rounded-xl p-1 mb-6"
                        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
                    >
                        {(['markets', 'create'] as View[]).map(v => (
                            <button
                                key={v}
                                onClick={() => setView(v)}
                                className="cc-tab px-5 py-2 rounded-lg transition-all"
                                style={view === v ? { background: 'var(--accent)', color: '#ffffff' } : { color: 'var(--muted)' }}
                            >
                                {v === 'markets' ? ' Browse Markets' : '+ Create Market'}
                            </button>
                        ))}
                    </div>

                    {view === 'create' ? (
                        <CreateMarket onSuccess={(newMarket) => {
                            // Add optimistic market immediately; background refresh will sync later
                            setMarkets(prev => [newMarket, ...prev])
                            setSelected(newMarket)
                            setView('markets')
                            load()
                        }} />
                    ) : loading ? (
                        <div className="flex items-center gap-3 py-12" style={{ color: 'var(--muted)' }}>
                            <span className="cc-dot"></span>
                            <span className="cc-dot" style={{ animationDelay: '0.3s' }}></span>
                            <span className="cc-dot" style={{ animationDelay: '0.6s' }}></span>
                            <span className="text-sm">Loading markets</span>
                        </div>
                    ) : markets.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                            <div
                                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                                style={{ background: 'rgba(180,83,9,0.1)', border: '1px solid rgba(180,83,9,0.25)' }}
                            >
                                <svg width="26" height="26" viewBox="0 0 40 40" fill="none">
                                    {/* Dice icon */}
                                    <rect x="6" y="6" width="28" height="28" rx="5" fill="rgba(180,83,9,0.2)" stroke="rgba(180,83,9,0.7)" strokeWidth="1.8" />
                                    <circle cx="14" cy="14" r="2.5" fill="rgba(180,83,9,0.9)" />
                                    <circle cx="26" cy="14" r="2.5" fill="rgba(180,83,9,0.9)" />
                                    <circle cx="20" cy="20" r="2.5" fill="rgba(180,83,9,0.9)" />
                                    <circle cx="14" cy="26" r="2.5" fill="rgba(180,83,9,0.9)" />
                                    <circle cx="26" cy="26" r="2.5" fill="rgba(180,83,9,0.9)" />
                                </svg>
                            </div>
                            <div>
                                <p className="font-semibold mb-1" style={{ color: 'var(--foreground)' }}>No markets yet</p>
                                <p className="text-sm" style={{ color: 'var(--muted)' }}>Be the first to create a qualitative prediction market.</p>
                            </div>
                            <button
                                onClick={() => setView('create')}
                                className="rounded-lg px-5 py-2.5 text-sm font-semibold"
                                style={{ background: 'var(--accent)', color: '#fff' }}
                            >
                                Create First Market
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-6">
                            {openMarkets.length > 0 && (
                                <section className="flex flex-col gap-3">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
                                            Open Markets
                                        </h3>
                                        <span
                                            className="text-xs px-2 py-0.5 rounded-full"
                                            style={{ background: 'rgba(74,222,128,0.1)', color: 'var(--success)' }}
                                        >
                                            {openMarkets.length} live
                                        </span>
                                    </div>
                                    {openMarkets.map(m => (
                                        <MarketCard
                                            key={m.id}
                                            market={m}
                                            selected={selected?.id === m.id}
                                            onClick={() => setSelected(m)}
                                        />
                                    ))}
                                </section>
                            )}
                            {resolvedMarkets.length > 0 && (
                                <section className="flex flex-col gap-3">
                                    <h3 className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
                                        Resolved
                                    </h3>
                                    {resolvedMarkets.map(m => (
                                        <MarketCard
                                            key={m.id}
                                            market={m}
                                            selected={selected?.id === m.id}
                                            onClick={() => setSelected(m)}
                                        />
                                    ))}
                                </section>
                            )}
                            <button
                                onClick={() => load(selected)}
                                className="self-start text-xs px-3 py-1.5 rounded-lg border transition-opacity hover:opacity-70"
                                style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
                            >
                                Refresh
                            </button>
                        </div>
                    )}
                </div>

                {/* Right */}
                <div
                    className="p-6 lg:p-8 lg:sticky lg:top-16 lg:self-start lg:overflow-y-auto"
                    style={{ maxHeight: 'calc(100vh - 64px)' }}
                >
                    {selected ? (
                        <MarketDetail
                            market={selected}
                            userBalance={balance}
                            onUpdate={async () => {
                                await load(selected)
                                if (address) getBalance(address).then(setBalance)
                            }}
                        />
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full min-h-[320px] gap-4 text-center">
                            <div
                                className="w-16 h-16 rounded-2xl flex items-center justify-center"
                                style={{ background: 'rgba(180,83,9,0.08)', border: '1px dashed rgba(180,83,9,0.3)' }}
                            >
                                <svg width="30" height="30" viewBox="0 0 40 40" fill="none">
                                    {/* Dice icon */}
                                    <rect x="6" y="6" width="28" height="28" rx="5" fill="rgba(180,83,9,0.15)" stroke="rgba(180,83,9,0.5)" strokeWidth="1.8" />
                                    <circle cx="14" cy="14" r="2.2" fill="rgba(180,83,9,0.7)" />
                                    <circle cx="26" cy="14" r="2.2" fill="rgba(180,83,9,0.7)" />
                                    <circle cx="20" cy="20" r="2.2" fill="rgba(180,83,9,0.7)" />
                                    <circle cx="14" cy="26" r="2.2" fill="rgba(180,83,9,0.7)" />
                                    <circle cx="26" cy="26" r="2.2" fill="rgba(180,83,9,0.7)" />
                                </svg>
                            </div>
                            <div>
                                <p className="font-semibold mb-1" style={{ color: 'var(--foreground)' }}>Select a market</p>
                                <p className="text-sm max-w-xs" style={{ color: 'var(--muted)' }}>
                                    Click any market on the left to bet or request an AI verdict.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

