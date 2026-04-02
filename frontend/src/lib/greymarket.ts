// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { createClient, chains } from 'genlayer-js'

type GL_Address = `0x${string}` & { length: 42 }

function toAddress(s: string): GL_Address {
    return s as unknown as GL_Address
}

export const CONTRACT_ADDRESS: GL_Address = toAddress(
    process.env.NEXT_PUBLIC_GM_CONTRACT_ADDRESS ||
    '0x0000000000000000000000000000000000000000'
)

// Single client: genlayer-js 0.23.1 uses gen_call for reads (always HTTP)
// and eth_sendTransaction to the consensus contract for writes (MetaMask signs).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const client = createClient({ chain: (chains as any).testnetBradbury })

export type Market = {
    id: number
    question: string
    context: string
    deadline: number
    creator: string
    total_yes: number
    total_no: number
    resolved: boolean
    outcome: 'YES' | 'NO' | 'PENDING'
    reasoning: string
    confidence: number
    pot: number
}

// ── Read helpers ──────────────────────────────────────────

export async function getAllMarkets(): Promise<Market[]> {
    try {
        const result = await client.readContract({
            address: CONTRACT_ADDRESS,
            functionName: 'get_all_markets',
            args: [],
        })
        return (result as Market[]) ?? []
    } catch {
        return []
    }
}

export async function getBalance(address: string): Promise<number> {
    try {
        const result = await client.readContract({
            address: CONTRACT_ADDRESS,
            functionName: 'get_balance',
            args: [address],
        })
        return result as number
    } catch {
        return 1000
    }
}

// ── Write helpers ─────────────────────────────────────────

// Bradbury often takes >30s to reach consensus; writeContract may throw
// "Transaction not processed by consensus" even after MetaMask has signed and
// the tx has been broadcast.  Treat that as a successful submission.
function isConsensusTimeout(err: unknown): boolean {
    const msg = String(err).toLowerCase()
    return msg.includes('not processed by consensus') || msg.includes('consensus')
}

export async function createMarket(
    senderAddress: string,
    question: string,
    context: string,
    deadline: number
): Promise<string> {
    const account = { address: toAddress(senderAddress), type: 'json-rpc' as const }
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const txId = await (client as any).writeContract({
            address: CONTRACT_ADDRESS,
            functionName: 'create_market',
            args: [question, context, deadline],
            account,
            value: 0n,
        })
        return String(txId)
    } catch (err) {
        if (isConsensusTimeout(err)) return 'pending'
        throw err
    }
}

export async function placeBet(
    senderAddress: string,
    marketId: number,
    position: 'YES' | 'NO',
    amount: number
): Promise<string> {
    const account = { address: toAddress(senderAddress), type: 'json-rpc' as const }
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const txId = await (client as any).writeContract({
            address: CONTRACT_ADDRESS,
            functionName: 'place_bet',
            args: [marketId, position, amount],
            account,
            value: 0n,
        })
        return String(txId)
    } catch (err) {
        if (isConsensusTimeout(err)) return 'pending'
        throw err
    }
}

export async function resolveMarket(
    senderAddress: string,
    marketId: number
): Promise<string> {
    const account = { address: toAddress(senderAddress), type: 'json-rpc' as const }
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const txId = await (client as any).writeContract({
            address: CONTRACT_ADDRESS,
            functionName: 'resolve_market',
            args: [marketId],
            account,
            value: 0n,
        })
        return String(txId)
    } catch (err) {
        if (isConsensusTimeout(err)) return 'pending'
        throw err
    }
}
