const { createClient, chains } = await import('c:/Users/USER/genlayer-hackathon/frontend/node_modules/genlayer-js/dist/index.js').catch(() => null) || await import('./frontend/node_modules/genlayer-js/dist/index.js');
const client = createClient({ chain: chains.studionet });

const contracts = {
    'A (first)': '0xA56B7ff55c16fBf3E7DfCd3cDc2f025775D53B87',
    'B (second)': '0x802e4a8774a2dC09ea0CC2A822aF5Ab5362f7A98',
    'C (current)': '0xAfa388201CE193ec56Bdc2A430D406eFB95Cc8a5',
};

for (const [label, addr] of Object.entries(contracts)) {
    try {
        const count = await client.readContract({ address: addr, functionName: 'get_market_count', args: [] });
        console.log(`${label} → market_count: ${count}`);
        if (count > 0) {
            const m0 = await client.readContract({ address: addr, functionName: 'get_market', args: [0] });
            console.log(`  market #0: "${m0.question}" | yes=${m0.total_yes} no=${m0.total_no} resolved=${m0.resolved}`);
        }
    } catch (e) {
        console.log(`${label} → ERR: ${e.message}`);
    }
}


