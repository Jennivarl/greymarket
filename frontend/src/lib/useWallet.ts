'use client'

import { useState, useEffect, useCallback } from 'react'

declare global {
    interface Window {
        ethereum?: {
            request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
            on: (event: string, handler: (...args: unknown[]) => void) => void
            removeListener: (event: string, handler: (...args: unknown[]) => void) => void
        }
    }
}

const STUDIONET = {
    chainId: '0xF22F', // 61999
    chainName: 'GenLayer Studionet',
    nativeCurrency: { name: 'GEN', symbol: 'GEN', decimals: 18 },
    rpcUrls: ['https://studio.genlayer.com/api'],
    blockExplorerUrls: ['https://explorer-studio.genlayer.com'],
}

export function useWallet() {
    const [address, setAddress] = useState<string | null>(null)
    const [isConnecting, setIsConnecting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const connect = useCallback(async () => {
        if (typeof window === 'undefined' || !window.ethereum) {
            setError('No wallet detected. Please install MetaMask.')
            return
        }
        setIsConnecting(true)
        setError(null)
        try {
            const accounts = await window.ethereum.request({
                method: 'eth_requestAccounts',
            }) as string[]

            // Switch to or add Studionet network
            try {
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: STUDIONET.chainId }],
                })
            } catch (switchErr: unknown) {
                const e = switchErr as { code?: number }
                if (e.code === 4902) {
                    await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [STUDIONET],
                    })
                } else {
                    throw switchErr
                }
            }

            setAddress(accounts[0])
        } catch (err: unknown) {
            const e = err as { message?: string }
            setError(e.message || 'Connection failed')
        } finally {
            setIsConnecting(false)
        }
    }, [])

    const disconnect = useCallback(() => setAddress(null), [])

    // Reflect wallet account changes
    useEffect(() => {
        if (typeof window === 'undefined' || !window.ethereum) return

        // Auto-connect if already authorised
        window.ethereum
            .request({ method: 'eth_accounts' })
            .then(accs => {
                const accounts = accs as string[]
                if (accounts.length) setAddress(accounts[0])
            })
            .catch(() => { })

        const handleAccountsChanged = (accs: unknown) => {
            const accounts = accs as string[]
            setAddress(accounts.length ? accounts[0] : null)
        }
        window.ethereum.on('accountsChanged', handleAccountsChanged)
        return () => window.ethereum?.removeListener('accountsChanged', handleAccountsChanged)
    }, [])

    return { address, isConnected: !!address, isConnecting, error, connect, disconnect }
}
