# { "Depends": "py-genlayer:15qfivjvy80800rh998pcxmd2m8va1wq2qzqhz850n8ggcr4i9q0" }

from genlayer import *
from dataclasses import dataclass
import json
import typing


@allow_storage
@dataclass
class AgentProfile:
    name: str
    description: str
    owner: Address
    reputation_score: u256      # 0-100, rolling weighted average
    total_interactions: u256
    total_score_sum: u256       # sum of all overall scores (for average calc)


@allow_storage
@dataclass
class Interaction:
    task_description: str
    outcome_description: str
    ai_score: u256              # 0-100 overall
    completeness: u256          # 0-100
    quality: u256               # 0-100
    faithfulness: u256          # 0-100
    reasoning: str
    submitter: Address


class AgentReputation(gl.Contract):
    """
    CredCourt — The first qualitative on-chain reputation protocol for AI agents.

    Unlike existing systems (ERC-8004, ACHIVX, etc.) that only record THAT
    agents acted, CredCourt uses GenLayer's AI validators to judge HOW WELL
    they acted — entirely without human-submitted ratings.

    Any party can register an agent and submit interactions for AI evaluation.
    The AI scores completeness, quality, and faithfulness independently, then
    aggregates them into a tamper-proof on-chain reputation score.
    """

    agents: TreeMap[Address, AgentProfile]
    agent_interactions: TreeMap[Address, DynArray[Interaction]]

    def __init__(self) -> None:
        pass

    @gl.public.write
    def register_agent(self, name: str, description: str) -> None:
        """Register the calling address as an agent with a name and description."""
        if not name or not name.strip():
            raise gl.UserError("Agent name cannot be empty")
        if not description or not description.strip():
            raise gl.UserError("Agent description cannot be empty")

        addr = gl.message.sender_address
        if addr in self.agents:
            raise gl.UserError("Agent already registered from this address")

        profile = AgentProfile(
            name=name.strip(),
            description=description.strip(),
            owner=addr,
            reputation_score=u256(0),
            total_interactions=u256(0),
            total_score_sum=u256(0),
        )
        self.agents[addr] = profile
        self.agent_interactions[agent_addr].append(interaction)

    @gl.public.write
    def submit_interaction(
        self,
        agent_address: str,
        task_description: str,
        outcome_description: str,
    ) -> None:
        """
        Submit a completed task for AI-powered quality evaluation.

        Anyone can submit an interaction for any registered agent. The AI
        validators independently score the outcome against the task description
        across three dimensions, then update the agent's on-chain reputation.

        Args:
            agent_address:       The address of the agent being evaluated.
            task_description:    Plain-English description of what the agent was asked to do.
            outcome_description: Plain-English description of what the agent actually delivered.
        """
        agent_addr = Address(agent_address)
        if agent_addr not in self.agents:
            raise gl.UserError("Agent not registered")
        if not task_description or not task_description.strip():
            raise gl.UserError("Task description cannot be empty")
        if not outcome_description or not outcome_description.strip():
            raise gl.UserError("Outcome description cannot be empty")

        submitter = gl.message.sender_address
        task = task_description.strip()
        outcome = outcome_description.strip()

        def score_interaction():
            prompt = f"""You are an objective, strict quality evaluator for AI agent interactions.

TASK given to the agent:
\"\"\"
{task}
\"\"\"

OUTCOME delivered by the agent:
\"\"\"
{outcome}
\"\"\"

Evaluate the outcome across three dimensions. Return ONLY a JSON object with these exact keys:
- "completeness": integer 0-100 — Did the agent address everything that was asked? 100 = fully complete, 0 = nothing relevant delivered.
- "quality":      integer 0-100 — How well was the task executed? Consider accuracy, depth, and correctness. 100 = exceptional, 0 = completely wrong or useless.
- "faithfulness": integer 0-100 — Does the output match the intent of the task? 100 = perfectly aligned, 0 = completely off-track.
- "overall":      integer 0-100 — Weighted average (completeness 30%, quality 40%, faithfulness 30%).
- "reasoning":    string — One concise sentence explaining the scores.

Scoring guide:
90-100: Outstanding — exceeds expectations
70-89:  Good — meets all requirements with minor gaps
50-69:  Partial — significant aspects missing or incorrect
20-49:  Poor — mostly failed to deliver
0-19:   Failed — irrelevant or completely wrong

Be strict, fair, and consistent."""
            response = gl.nondet.exec_prompt(prompt)
            return json.loads(response)

        def validate_score(leader_result) -> bool:
            if not isinstance(leader_result, gl.vm.Return):
                return False
            leader_data = leader_result.calldata
            if not isinstance(leader_data, dict):
                return False
            # Re-run the scoring LLM independently to verify the leader's result
            try:
                validator_data = score_interaction()
            except Exception:
                return False
            if not isinstance(validator_data, dict):
                return False
            try:
                leader_overall = max(0, min(100, int(round(float(str(leader_data.get("overall", 0)).strip())))))
                validator_overall = max(0, min(100, int(round(float(str(validator_data.get("overall", 0)).strip())))))
            except (ValueError, TypeError):
                return False
            # Gate: if either node deems it a complete failure, both must agree
            if leader_overall == 0 or validator_overall == 0:
                return leader_overall == validator_overall
            # Allow ±15 tolerance — two LLMs scoring the same content will differ
            return abs(leader_overall - validator_overall) <= 15

        result = gl.vm.run_nondet_unsafe(score_interaction, validate_score)

        def _safe_int(val) -> int:
            try:
                return max(0, min(100, int(round(float(str(val).strip())))))
            except (ValueError, TypeError):
                return 0

        completeness_v = _safe_int(result.get("completeness", 0))
        quality_v      = _safe_int(result.get("quality", 0))
        faithfulness_v = _safe_int(result.get("faithfulness", 0))
        overall_v      = _safe_int(result.get("overall", 0))
        reasoning_v    = str(result.get("reasoning", "")).strip()[:500]

        interaction = Interaction(
            task_description=task,
            outcome_description=outcome,
            ai_score=u256(overall_v),
            completeness=u256(completeness_v),
            quality=u256(quality_v),
            faithfulness=u256(faithfulness_v),
            reasoning=reasoning_v,
            submitter=submitter,
        )

        # Update rolling reputation score
        profile = self.agents[agent_addr]
        new_total = int(profile.total_interactions) + 1
        new_sum   = int(profile.total_score_sum) + overall_v
        new_rep   = new_sum // new_total

        profile.total_interactions = u256(new_total)
        profile.total_score_sum    = u256(new_sum)
        profile.reputation_score   = u256(new_rep)
        self.agents[agent_addr]    = profile

        self.agent_interactions[agent_addr].append(interaction)

    @gl.public.view
    def get_agent_profile(self, agent_address: str) -> TreeMap[str, typing.Any]:
        """Return the full profile of a registered agent."""
        addr = Address(agent_address)
        if addr not in self.agents:
            raise gl.UserError("Agent not registered")
        return self.agents[addr]

    @gl.public.view
    def get_reputation(self, agent_address: str) -> int:
        """Return the current reputation score (0-100) for an agent."""
        addr = Address(agent_address)
        if addr not in self.agents:
            return u256(0)
        return self.agents[addr].reputation_score

    @gl.public.view
    def get_interaction_count(self, agent_address: str) -> int:
        """Return the total number of evaluated interactions for an agent."""
        addr = Address(agent_address)
        if addr not in self.agents:
            return u256(0)
        return self.agents[addr].total_interactions

    @gl.public.view
    def get_interactions(self, agent_address: str) -> DynArray[TreeMap[str, typing.Any]]:
        """Return all evaluated interactions for an agent."""
        addr = Address(agent_address)
        if addr not in self.agent_interactions:
            return DynArray[TreeMap[str, typing.Any]]()
        return self.agent_interactions[addr]

    @gl.public.view
    def is_registered(self, agent_address: str) -> bool:
        """Check whether an address is a registered agent."""
        return Address(agent_address) in self.agents
