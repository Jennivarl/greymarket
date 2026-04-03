# { "Depends": "py-genlayer:15qfivjvy80800rh998pcxmd2m8va1wq2qzqhz850n8ggcr4i9q0" }

from genlayer import *
from dataclasses import dataclass
import json
import typing


@allow_storage
@dataclass
class Market:
    id: u256
    question: str
    context: str            # optional URL or hint for resolution
    deadline: u256          # Unix timestamp (seconds)
    creator: Address
    total_yes: u256
    total_no: u256
    resolved: bool
    outcome: str            # "YES", "NO", or "PENDING"
    reasoning: str
    confidence: u256
    pot: u256               # total fake USDC in the pot


class GreyMarket(gl.Contract):
    """
    GreyMarket — Qualitative prediction markets resolved by AI consensus.

    Unlike traditional prediction markets that can only resolve binary facts
    with a single verifiable source, GreyMarket resolves complex judgment-based
    questions by fetching live web evidence and reaching AI consensus.

    No human resolver. No disputes. No bribery. Verdicts are final.
    """

    markets: TreeMap[u256, Market]
    market_count: u256
    balances: TreeMap[Address, u256]

    def __init__(self) -> None:
        self.market_count = u256(0)

    def _init_balance(self, addr: Address) -> None:
        """Give new users 1000 GUSDC on first interaction."""
        if addr not in self.balances:
            self.balances[addr] = u256(1000)

    @gl.public.write
    def create_market(self, question: str, context: str, deadline: u256) -> None:
        """
        Create a new prediction market.

        Args:
            question:  The qualitative question to resolve (e.g. "Did X deliver on Y?")
            context:   Optional URL or context to help AI resolution (can be empty string)
            deadline:  Unix timestamp after which the market can be resolved
        """
        if not question or not question.strip():
            raise gl.UserError("Question cannot be empty")
        if len(question.strip()) < 10:
            raise gl.UserError("Question too short — be specific")

        creator = gl.message.sender_address
        self._init_balance(creator)

        mid = self.market_count
        self.market_count = u256(int(self.market_count) + 1)

        self.markets[mid] = Market(
            id=mid,
            question=question.strip(),
            context=context.strip() if context else "",
            deadline=deadline,
            creator=creator,
            total_yes=u256(0),
            total_no=u256(0),
            resolved=False,
            outcome="PENDING",
            reasoning="",
            confidence=u256(0),
            pot=u256(0),
        )

    @gl.public.write
    def place_bet(self, market_id_int: int, position: str, amount: int) -> None:
        """
        Place a YES or NO bet on an open market.
        Minimum bet is 100 GUSDC. New wallets start with 1000 GUSDC.

        Args:
            market_id_int: The numeric ID of the market
            position:      "YES" or "NO"
            amount:        Amount of GUSDC to bet (minimum 100)
        """
        mid = u256(market_id_int)
        if mid not in self.markets:
            raise gl.UserError("Market not found")

        market = self.markets[mid]
        if market.resolved:
            raise gl.UserError("Market already resolved — betting closed")
        if position not in ("YES", "NO"):
            raise gl.UserError("Position must be YES or NO")
        if amount < 100:
            raise gl.UserError("Minimum bet is 100 GUSDC")

        bettor = gl.message.sender_address
        self._init_balance(bettor)

        if int(self.balances[bettor]) < amount:
            raise gl.UserError(f"Insufficient balance — you need {amount} GUSDC to bet")

        # Lock the bet amount
        self.balances[bettor] = u256(int(self.balances[bettor]) - amount)

        # Update market volume totals
        if position == "YES":
            market.total_yes = u256(int(market.total_yes) + amount)
        else:
            market.total_no = u256(int(market.total_no) + amount)
        market.pot = u256(int(market.pot) + amount)
        self.markets[mid] = market

    @gl.public.write
    def resolve_market(self, market_id_int: int) -> None:
        """
        Resolve a market using AI consensus + live web evidence.

        The AI fetches evidence from web search results and any provided
        context URL, then independently reaches a YES/NO verdict with reasoning.
        All validators must agree — no single point of failure.

        Args:
            market_id_int: The numeric ID of the market to resolve
        """
        mid = u256(market_id_int)
        if mid not in self.markets:
            raise gl.UserError("Market not found")

        market = self.markets[mid]
        if market.resolved:
            raise gl.UserError("Market already resolved")

        question = market.question
        context_url = market.context

        def fetch_and_judge():
            # Encode query for URL
            q_encoded = question.replace(" ", "+").replace("?", "%3F").replace('"', '').replace("'", "")

            # Fetch web evidence from DuckDuckGo search
            evidence = ""
            try:
                search_result = gl.get_webpage(
                    f"https://html.duckduckgo.com/html/?q={q_encoded}",
                    mode="text"
                )
                evidence = search_result[:4000]
            except Exception:
                evidence = "Web search unavailable — reasoning from training knowledge only."

            # Fetch additional context URL if provided
            extra_context = ""
            if context_url and context_url.startswith("http"):
                try:
                    page = gl.get_webpage(context_url, mode="text")
                    extra_context = f"\n\nADDITIONAL SOURCE:\n{page[:2000]}"
                except Exception:
                    pass

            prompt = f"""You are a neutral, impartial AI judge resolving a prediction market question.
Your verdict is final and will be written permanently on-chain.

PREDICTION MARKET QUESTION:
\"\"\"{question}\"\"\"

EVIDENCE FROM WEB RESEARCH:
{evidence}{extra_context}

INSTRUCTIONS:
- Give a definitive YES or NO verdict. Abstaining is not allowed.
- For factual questions: did the event happen or not?
- For qualitative judgment questions: does the weight of evidence lean YES or NO?
- Be strict, evidence-based, and impartial.
- Cite specific evidence in your reasoning.

Return ONLY valid JSON with these exact keys:
{{
  "verdict": "YES" or "NO",
  "confidence": <integer 50-100>,
  "reasoning": "<2-3 sentences explaining your verdict with specific evidence>"
}}"""

            response = gl.nondet.exec_prompt(prompt)
            return json.loads(response)

        def validate(leader_result) -> bool:
            if not isinstance(leader_result, gl.vm.Return):
                return False
            ld = leader_result.calldata
            if not isinstance(ld, dict):
                return False
            if ld.get("verdict") not in ("YES", "NO"):
                return False
            try:
                vd = fetch_and_judge()
            except Exception:
                return False
            # Validators must agree on verdict direction
            return ld.get("verdict") == vd.get("verdict")

        result = gl.vm.run_nondet_unsafe(fetch_and_judge, validate)

        verdict = result.get("verdict", "NO")
        reasoning = str(result.get("reasoning", "")).strip()[:500]
        confidence = max(50, min(100, int(result.get("confidence", 70))))

        market.resolved = True
        market.outcome = verdict
        market.reasoning = reasoning
        market.confidence = u256(confidence)
        self.markets[mid] = market

    # ── Read-only views ───────────────────────────────────────

    @gl.public.view
    def get_market(self, market_id_int: int) -> TreeMap[str, typing.Any]:
        """Return a single market by ID."""
        mid = u256(market_id_int)
        if mid not in self.markets:
            raise gl.UserError("Market not found")
        return self.markets[mid]

    @gl.public.view
    def get_all_markets(self) -> DynArray[TreeMap[str, typing.Any]]:
        """Return all markets ordered by creation time."""
        result = DynArray[TreeMap[str, typing.Any]]()
        count = int(self.market_count)
        for i in range(count):
            mid = u256(i)
            if mid in self.markets:
                result.append(self.markets[mid])
        return result

    @gl.public.view
    def get_balance(self, addr: str) -> int:
        """Return the GUSDC balance for a wallet address."""
        address = Address(addr)
        if address not in self.balances:
            return 1000
        return int(self.balances[address])

    @gl.public.view
    def get_market_count(self) -> int:
        """Return the total number of markets created."""
        return int(self.market_count)
