# GreyMarket — Prediction Markets for Grey Areas. Resolved by AI.

> **GenLayer Bradbury Hackathon submission**

---

## What is GreyMarket?

Polymarket handles facts. **GreyMarket handles grey areas.**

It's the first prediction market built for questions that have no obvious answer — qualitative, interpretive, judgment-based questions where reasonable people genuinely disagree. GenLayer's AI validators read live web evidence and reach on-chain consensus to settle every market. No oracle. No disputes. No corruption.

---

## Why This Couldn't Exist Before GenLayer

Traditional blockchains can only verify deterministic facts ("did event X happen on date Y?"). They can't settle questions like:

- *"Did OpenAI's for-profit shift compromise its safety mission?"*
- *"Has Ethereum's rollup roadmap strengthened or weakened its position vs Solana?"*
- *"Did this hackathon favour technical complexity over real-world impact?"*

GenLayer's AI validators can **browse the web, reason over evidence, and reach Byzantine-fault-tolerant consensus** on these questions — entirely on-chain. That primitive unlocks GreyMarket.

---

## Key Features

- **Qualitative markets** — any question where judgment matters, not just binary facts
- **AI-resolved** — GenLayer validators fetch live web evidence and return a YES/NO verdict with reasoning and confidence score
- **Consensus-based** — multiple independent validators must agree; no single point of failure or corruption
- **No dispute window** — verdict is final when consensus is reached
- **Instant UX** — markets appear immediately after MetaMask signs (optimistic UI); chain state syncs in the background

---

## Contract

Deployed on **GenLayer Bradbury Testnet**:
`0x41fca6c3b500AA903D4714f83C213B6B4A243370`

| Method | Type | Description |
|--------|------|-------------|
| `create_market(question, context, deadline)` | write | Create a new prediction market |
| `place_bet(market_id, position, amount)` | write | Bet YES or NO on a market (min 100 GUSDC) |
| `resolve_market(market_id)` | write | Trigger AI resolution (post-deadline) |
| `get_all_markets()` | read | Return all markets with state |
| `get_market(market_id)` | read | Get a single market |
| `get_balance(address)` | read | Get caller's GUSDC balance |

---

## Project Structure

```
genlayer-hackathon/
├── contracts/
│   └── grey_market.py            # GenLayer Intelligent Contract (Python)
├── tests/
│   └── test_agent_reputation.py
└── frontend/                     # Next.js 16 + Tailwind + genlayer-js 0.23.1
    ├── src/
    │   ├── app/                   # App router (page.tsx, layout.tsx, globals.css)
    │   ├── components/            # UI components
    │   │   ├── GreyMarketLogo.tsx
    │   │   ├── CreateMarket.tsx
    │   │   ├── MarketCard.tsx
    │   │   ├── MarketDetail.tsx
    │   │   └── WalletButton.tsx
    │   └── lib/
    │       └── greymarket.ts      # genlayer-js contract helpers
    └── package.json
```

---

## Quick Start

### 1. Install GenLayer CLI & Start Studio

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), connect MetaMask on GenLayer Bradbury (Chain ID 4221), and start betting.

---

## How It Compares to Polymarket

| | Polymarket | GreyMarket |
|---|---|---|
| Question type | Verifiable facts | Qualitative judgments |
| Resolution | Centralized oracle / UMA dispute | GenLayer AI validator consensus |
| Dispute window | Yes (days) | No — verdict is final |
| Example question | "Will BTC hit $100k by Dec 31?" | "Did Ethereum's roadmap hurt it vs Solana?" |

---

Built with GenLayer · Bradbury Testnet · April 2026
