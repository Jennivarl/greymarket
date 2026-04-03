export type UserBet = {
    marketId: number
    question: string
    position: 'YES' | 'NO'
    amount: number
    timestamp: number
}

function storageKey(address: string): string {
    return `gm_bets_${address.toLowerCase()}`
}

export function loadBets(address: string): UserBet[] {
    try {
        return JSON.parse(localStorage.getItem(storageKey(address)) || '[]')
    } catch {
        return []
    }
}

export function saveBet(address: string, bet: UserBet): void {
    const bets = loadBets(address)
    bets.push(bet)
    localStorage.setItem(storageKey(address), JSON.stringify(bets))
}
