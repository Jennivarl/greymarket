# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

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
    yes_bets: TreeMap[str, u256]   # key: "{market_id}:{address}" → amt bet YES
    no_bets: TreeMap[str, u256]    # key: "{market_id}:{address}" → amt bet NO

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

        # Record individual bet for on-chain ledger
        bet_key = f"{int(mid)}:{str(bettor)}"
        if position == "YES":
            prev = int(self.yes_bets[bet_key]) if bet_key in self.yes_bets else 0
            self.yes_bets[bet_key] = u256(prev + amount)
        else:
            prev = int(self.no_bets[bet_key]) if bet_key in self.no_bets else 0
            self.no_bets[bet_key] = u256(prev + amount)

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

        # Encode query for URL
        q_encoded = question.replace(" ", "+").replace("?", "%3F").replace('"', '').replace("'", "")

        def nondet() -> str:
            # Fetch web evidence inside non-deterministic block
            evidence = ""
            try:
                search_response = gl.nondet.web.get(
                    f"https://html.duckduckgo.com/html/?q={q_encoded}"
                )
                evidence = search_response.body.decode("utf-8")[:4000]
            except Exception:
                evidence = "Web search unavailable — reasoning from training knowledge only."

            # Fetch additional context URL if provided
            extra_context = ""
            if context_url and context_url.startswith("http"):
                try:
                    page_response = gl.nondet.web.get(context_url)
                    extra_context = f"\n\nADDITIONAL SOURCE:\n{page_response.body.decode('utf-8')[:2000]}"
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

            raw = gl.nondet.exec_prompt(prompt).replace("```json", "").replace("```", "")
            return json.dumps(json.loads(raw), sort_keys=True)

        result = json.loads(gl.eq_principle.strict_eq(nondet))

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

    @gl.public.view
    def get_user_yes_bet(self, market_id_int: int, addr: str) -> int:
        """Return how much GUSDC this address has bet YES on the given market."""
        key = f"{market_id_int}:{addr}"
        if key not in self.yes_bets:
            return 0
        return int(self.yes_bets[key])

    @gl.public.view
    def get_user_no_bet(self, market_id_int: int, addr: str) -> int:
        """Return how much GUSDC this address has bet NO on the given market."""
        key = f"{market_id_int}:{addr}"
        if key not in self.no_bets:
            return 0
        return int(self.no_bets[key])
