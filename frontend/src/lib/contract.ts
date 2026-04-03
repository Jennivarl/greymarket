import { createClient } from 'genlayer-js'

// genlayer-js uses a branded Address type: `0x${string} & { length: 42 }`
type GL_Address = `0x${string}` & { length: 42 }

function toAddress(s: string): GL_Address {
    return s as unknown as GL_Address
}

// ----------------------------------------------------------------
// Update CONTRACT_ADDRESS after deploying via GenLayer Studio or CLI
// ----------------------------------------------------------------
export const CONTRACT_ADDRESS: GL_Address = toAddress(
    (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0x7f81b37E0cCADE1401fA80691153127BF8674DF9').trim()
)

const studionet = {
    id: 61999,
    name: 'GenLayer Studionet',
    rpcUrls: { default: { http: ['https://studio.genlayer.com/api'] } },
    nativeCurrency: { name: 'GEN Token', symbol: 'GEN', decimals: 18 },
    blockExplorers: {
        default: { name: 'GenLayer Explorer', url: 'https://explorer-studio.genlayer.com' },
    },
    testnet: true,
}

export const client = createClient({
    chain: studionet,
    endpoint: 'https://studio.genlayer.com/api',
})

export type AgentProfile = {
    name: string
    description: string
    owner: string
    reputation_score: number
    total_interactions: number
    total_score_sum: number
}

export type Interaction = {
    task_description: string
    outcome_description: string
    ai_score: number
    completeness: number
    quality: number
    faithfulness: number
    reasoning: string
    submitter: string
}

// ----------------------------------------------------------------
// Read helpers
// ----------------------------------------------------------------

export async function getAgentProfile(address: string): Promise<AgentProfile | null> {
    try {
        const result = await client.readContract({
            address: CONTRACT_ADDRESS,
            functionName: 'get_agent_profile',
            args: [address],
        })
        return result as AgentProfile
    } catch {
        return null
    }
}

export async function getInteractions(address: string): Promise<Interaction[]> {
    try {
        const result = await client.readContract({
            address: CONTRACT_ADDRESS,
            functionName: 'get_interactions',
            args: [address],
        })
        return (result as Interaction[]) ?? []
    } catch {
        return []
    }
}

export async function getReputation(address: string): Promise<number> {
    try {
        const result = await client.readContract({
            address: CONTRACT_ADDRESS,
            functionName: 'get_reputation',
            args: [address],
        })
        return result as number
    } catch {
        return 0
    }
}

// ----------------------------------------------------------------
// Write helpers
// ----------------------------------------------------------------

export async function registerAgent(
    senderAddress: string,
    name: string,
    description: string
): Promise<string> {
    // Use a non-"local" account so genlayer-js routes via eth_sendTransaction
    // (MetaMask/wallet signs — no private key ever touches this app)
    const account = { address: toAddress(senderAddress), type: 'json-rpc' as const }
    const hash = await client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: 'register_agent',
        args: [name, description],
        account,
        value: 0n,
    })
    return hash as string
}

export async function submitInteraction(
    senderAddress: string,
    agentAddress: string,
    taskDescription: string,
    outcomeDescription: string
): Promise<string> {
    const account = { address: toAddress(senderAddress), type: 'json-rpc' as const }
    const hash = await client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: 'submit_interaction',
        args: [agentAddress, taskDescription, outcomeDescription],
        account,
        value: 0n,
    })
    return hash as string
}
