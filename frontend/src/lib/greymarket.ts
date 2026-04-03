// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { createClient, chains } from 'genlayer-js'

type GL_Address = `0x${string}` & { length: 42 }

function toAddress(s: string): GL_Address {
    return s as unknown as GL_Address
}

export const CONTRACT_ADDRESS: GL_Address = toAddress(
    process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ||
    '0x0000000000000000000000000000000000000000'
)

// Single client: genlayer-js 0.23.1 uses gen_call for reads (always HTTP)
// and eth_sendTransaction to the consensus contract for writes (MetaMask signs).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const client = createClient({ chain: (chains as any).studionet })

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
        // get_all_markets fails on Studionet (DynArray<TreeMap> serialization bug).
        // Instead: read count first, then fetch each market individually.
        const count = await client.readContract({
            address: CONTRACT_ADDRESS,
            functionName: 'get_market_count',
            args: [],
        }) as number
        if (!count || count === 0) return []
        const results = await Promise.all(
            Array.from({ length: count }, (_, i) =>
                client.readContract({
                    address: CONTRACT_ADDRESS,
                    functionName: 'get_market',
                    args: [i],
                }).catch(() => null)
            )
        )
        return results.filter(Boolean) as Market[]
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

// Bradbury often takes >30s; writeContract may throw a timeout even after MetaMask
// has successfully broadcast the tx. Detect those so we can fall back gracefully.
function isConsensusTimeout(err: unknown): boolean {
    const msg = String(err).toLowerCase()
    return msg.includes('not processed by consensus') || msg.includes('consensus')
        || msg.includes('waitfortransactionreceipt') || msg.includes('could not be confirmed')
}

// Wrap window.ethereum.request temporarily to sniff the Ethereum tx hash that
// MetaMask returns for eth_sendTransaction — BEFORE genlayer-js calls
// waitForTransactionReceipt (which can timeout).  This gives us the hash
// reliably regardless of what error shape viem throws later.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function writeContractCaptured(args: Record<string, unknown>): Promise<string> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ethereum = (typeof window !== 'undefined' ? (window as any).ethereum : null)
    let capturedEvmHash: string | null = null

    if (ethereum) {
        const originalRequest = ethereum.request.bind(ethereum)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ethereum.request = async (req: any) => {
            const result = await originalRequest(req)
            if (req?.method === 'eth_sendTransaction' && typeof result === 'string') {
                capturedEvmHash = result
            }
            return result
        }
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const txId = await (client as any).writeContract(args)
            return String(txId)
        } catch (err) {
            if (isConsensusTimeout(err)) {
                console.error('[genlayer] writeContract timeout. capturedEvmHash:', capturedEvmHash, 'err:', err)
                return capturedEvmHash ? `eth:${capturedEvmHash}` : 'pending'
            }
            throw err
        } finally {
            ethereum.request = originalRequest
        }
    }

    // No window.ethereum (SSR / non-MetaMask path) — fall back
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const txId = await (client as any).writeContract(args)
        return String(txId)
    } catch (err) {
        if (isConsensusTimeout(err)) return 'pending'
        throw err
    }
}

export async function createMarket(
    senderAddress: string,
    question: string,
    context: string,
    deadline: number
): Promise<string> {
    const account = { address: toAddress(senderAddress), type: 'json-rpc' as const }
    return writeContractCaptured({
        address: CONTRACT_ADDRESS,
        functionName: 'create_market',
        args: [question, context, deadline],
        account,
        value: 0n,
    })
}

export async function placeBet(
    senderAddress: string,
    marketId: number,
    position: 'YES' | 'NO',
    amount: number
): Promise<string> {
    const account = { address: toAddress(senderAddress), type: 'json-rpc' as const }
    return writeContractCaptured({
        address: CONTRACT_ADDRESS,
        functionName: 'place_bet',
        args: [marketId, position, amount],
        account,
        value: 0n,
    })
}

export async function resolveMarket(
    senderAddress: string,
    marketId: number
): Promise<string> {
    const account = { address: toAddress(senderAddress), type: 'json-rpc' as const }
    return writeContractCaptured({
        address: CONTRACT_ADDRESS,
        functionName: 'resolve_market',
        args: [marketId],
        account,
        value: 0n,
    })
}
