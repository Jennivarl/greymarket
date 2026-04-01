'use client'

import { useEffect } from 'react'

// Patches console.error in the browser so the Next.js dev overlay doesn't
// pop up for genlayer-js internal gen_call retry noise.
export default function DevErrorSuppressor() {
    useEffect(() => {
        if (process.env.NODE_ENV !== 'development') return
        const orig = console.error.bind(console)
        console.error = (...args: unknown[]) => {
            const msg = typeof args[0] === 'string' ? args[0] : ''
            if (msg.includes('gen_call') || msg.includes('GenLayer RPC')) return
            orig(...args)
        }
        return () => { console.error = orig }
    }, [])
    return null
}
