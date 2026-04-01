'use client'

import { useWallet } from '@/lib/useWallet'

export default function WalletButton() {
    const { address, isConnected, isConnecting, error, connect, disconnect } = useWallet()

    if (isConnected && address) {
        return (
            <div className="flex items-center gap-2">
                <span
                    className="text-xs px-3 py-1.5 rounded-lg addr"
                    style={{
                        background: 'var(--card)',
                        color: 'var(--accent-light)',
                        border: '1px solid var(--accent)',
                    }}
                >
                    <span style={{ color: 'var(--success)', marginRight: 5 }}>●</span>
                    {address.slice(0, 6)}…{address.slice(-4)}
                </span>
                <button
                    onClick={disconnect}
                    className="text-xs px-3 py-1.5 rounded-lg border transition-opacity hover:opacity-70"
                    style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
                >
                    Disconnect
                </button>
            </div>
        )
    }

    return (
        <div className="flex flex-col items-end gap-1">
            <button
                onClick={connect}
                disabled={isConnecting}
                className="text-xs px-4 py-2 rounded-lg font-semibold transition-opacity disabled:opacity-50"
                style={{ background: 'var(--accent)', color: '#fff' }}
            >
                {isConnecting ? 'Connecting…' : 'Connect Wallet'}
            </button>
            {error && (
                <span className="text-xs" style={{ color: 'var(--error)' }}>{error}</span>
            )}
        </div>
    )
}
