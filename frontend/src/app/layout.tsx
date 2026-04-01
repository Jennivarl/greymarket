import type { Metadata } from 'next'
import { Orbitron, Space_Grotesk, Rajdhani, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'
import DevErrorSuppressor from '@/components/DevErrorSuppressor'

const orbitron = Orbitron({
    subsets: ['latin'],
    variable: '--font-orbitron',
    weight: ['400', '600', '700', '900'],
})

const spaceGrotesk = Space_Grotesk({
    subsets: ['latin'],
    variable: '--font-space',
    weight: ['300', '400', '500', '600', '700'],
})

const rajdhani = Rajdhani({
    subsets: ['latin'],
    variable: '--font-rajdhani',
    weight: ['400', '500', '600', '700'],
})

const ibmPlexMono = IBM_Plex_Mono({
    subsets: ['latin'],
    variable: '--font-mono',
    weight: ['400', '500'],
})

export const metadata: Metadata = {
    title: 'GreyMarket — AI-Resolved Prediction Markets',
    description:
        'The first prediction market for qualitative judgments. GenLayer AI reads live evidence and settles verdicts on-chain — no oracle, no disputes.',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en" className={`${orbitron.variable} ${spaceGrotesk.variable} ${rajdhani.variable} ${ibmPlexMono.variable}`}>
            <body>
                <DevErrorSuppressor />
                {children}
            </body>
        </html>
    )
}
