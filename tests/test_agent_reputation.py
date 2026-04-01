"""
Tests for AgentReputation Intelligent Contract.

Requires GenLayer Studio running locally (docker or CLI).
Run with: pytest tests/ -v
"""

import pytest
from tools.request import (
    create_new_account,
    deploy_intelligent_contract,
    send_transaction,
    call_contract_method,
    payload,
    post_request_localhost,
)
from tools.response import assert_dict_struct, has_success_status

CONTRACT_FILE = "contracts/agent_reputation.py"
NUM_VALIDATORS = 5


@pytest.fixture(scope="module")
def setup():
    """Spin up validators, deploy contract, yield context, then clean up."""
    # Create test accounts
    owner   = create_new_account()
    user_a  = create_new_account()
    third   = create_new_account()

    # Create validators
    post_request_localhost(
        payload("sim_createRandomValidators", NUM_VALIDATORS, 8, 12, ["openai"], ["gpt-4o"])
    ).json()

    # Deploy contract
    contract_code = open(CONTRACT_FILE, "r").read()
    contract_address, deploy_response = deploy_intelligent_contract(
        owner, contract_code, "{}"
    )
    assert has_success_status(deploy_response), f"Deploy failed: {deploy_response}"

    yield {
        "owner":            owner,
        "user_a":           user_a,
        "third":            third,
        "contract_address": contract_address,
    }

    # Clean up validators
    post_request_localhost(payload("sim_deleteAllValidators")).json()


# ---------------------------------------------------------------------------
# Registration tests
# ---------------------------------------------------------------------------

class TestRegistration:
    def test_register_agent_success(self, setup):
        addr    = setup["contract_address"]
        account = setup["owner"]

        resp = send_transaction(
            account, addr, "register_agent",
            ["TestBot", "An AI agent that writes code"]
        )
        assert has_success_status(resp), f"register_agent failed: {resp}"

    def test_agent_is_registered(self, setup):
        addr    = setup["contract_address"]
        account = setup["owner"]

        result = call_contract_method(
            addr, account, "is_registered", [str(account["address"])]
        )
        assert has_success_status(result)
        assert result["result"]["output"] is True

    def test_duplicate_registration_raises(self, setup):
        addr    = setup["contract_address"]
        account = setup["owner"]

        resp = send_transaction(
            account, addr, "register_agent",
            ["TestBot Again", "Should fail"]
        )
        # Expect an error status since already registered
        assert not has_success_status(resp), "Duplicate registration should fail"

    def test_empty_name_raises(self, setup):
        addr    = setup["contract_address"]
        account = setup["user_a"]

        resp = send_transaction(
            account, addr, "register_agent",
            ["", "No name agent"]
        )
        assert not has_success_status(resp), "Empty name should be rejected"

    def test_unregistered_agent_returns_false(self, setup):
        addr    = setup["contract_address"]
        account = setup["owner"]
        unknown = create_new_account()

        result = call_contract_method(
            addr, account, "is_registered", [str(unknown["address"])]
        )
        assert has_success_status(result)
        assert result["result"]["output"] is False


# ---------------------------------------------------------------------------
# Interaction submission tests
# ---------------------------------------------------------------------------

class TestInteractions:
    @pytest.fixture(autouse=True)
    def ensure_user_a_registered(self, setup):
        """Register user_a as an agent before interaction tests."""
        addr    = setup["contract_address"]
        account = setup["user_a"]
        # Register (ignore error if already registered from a prior test run)
        send_transaction(account, addr, "register_agent", ["CodeAgent", "Writes and reviews code"])

    def test_submit_good_interaction(self, setup):
        addr    = setup["contract_address"]
        agent   = setup["user_a"]
        submitter = setup["third"]

        resp = send_transaction(
            submitter, addr, "submit_interaction",
            [
                str(agent["address"]),
                "Write a Python function that reverses a string.",
                "def reverse_string(s: str) -> str:\n    return s[::-1]\n\n# Example: reverse_string('hello') == 'olleh'",
            ]
        )
        assert has_success_status(resp), f"submit_interaction failed: {resp}"

    def test_reputation_updated_after_interaction(self, setup):
        addr    = setup["contract_address"]
        account = setup["owner"]
        agent   = setup["user_a"]

        result = call_contract_method(
            addr, account, "get_reputation", [str(agent["address"])]
        )
        assert has_success_status(result)
        score = result["result"]["output"]
        assert isinstance(score, int), f"Expected int score, got {type(score)}"
        assert 0 <= score <= 100, f"Score {score} out of 0-100 range"

    def test_interaction_count_increments(self, setup):
        addr    = setup["contract_address"]
        account = setup["owner"]
        agent   = setup["user_a"]

        result = call_contract_method(
            addr, account, "get_interaction_count", [str(agent["address"])]
        )
        assert has_success_status(result)
        count = result["result"]["output"]
        assert count >= 1, "Interaction count should be at least 1 after submission"

    def test_get_interactions_returns_list(self, setup):
        addr    = setup["contract_address"]
        account = setup["owner"]
        agent   = setup["user_a"]

        result = call_contract_method(
            addr, account, "get_interactions", [str(agent["address"])]
        )
        assert has_success_status(result)
        interactions = result["result"]["output"]
        assert isinstance(interactions, list)
        assert len(interactions) >= 1

        first = interactions[0]
        assert_dict_struct(first, {
            "ai_score":       int,
            "completeness":   int,
            "quality":        int,
            "faithfulness":   int,
            "reasoning":      str,
        })

    def test_submit_poor_interaction_scores_lower(self, setup):
        """A completely irrelevant outcome should score lower than a good one."""
        addr      = setup["contract_address"]
        agent     = setup["user_a"]
        submitter = setup["third"]

        send_transaction(
            submitter, addr, "submit_interaction",
            [
                str(agent["address"]),
                "Translate the sentence 'Hello world' into French.",
                "I decided to make a sandwich instead.",  # completely wrong
            ]
        )

        result = call_contract_method(
            addr, submitter, "get_interactions", [str(agent["address"])]
        )
        assert has_success_status(result)
        interactions = result["result"]["output"]
        last = interactions[-1]
        # The bad interaction should score below 50
        assert last["ai_score"] < 50, (
            f"Expected low score for irrelevant outcome, got {last['ai_score']}"
        )

    def test_unregistered_agent_submit_raises(self, setup):
        addr    = setup["contract_address"]
        unknown = create_new_account()
        submitter = setup["third"]

        resp = send_transaction(
            submitter, addr, "submit_interaction",
            [
                str(unknown["address"]),
                "Some task",
                "Some outcome",
            ]
        )
        assert not has_success_status(resp), "Submitting for unknown agent should fail"

    def test_empty_task_raises(self, setup):
        addr    = setup["contract_address"]
        agent   = setup["user_a"]
        submitter = setup["third"]

        resp = send_transaction(
            submitter, addr, "submit_interaction",
            [str(agent["address"]), "", "Some outcome"]
        )
        assert not has_success_status(resp)

    def test_empty_outcome_raises(self, setup):
        addr    = setup["contract_address"]
        agent   = setup["user_a"]
        submitter = setup["third"]

        resp = send_transaction(
            submitter, addr, "submit_interaction",
            [str(agent["address"]), "Some task", ""]
        )
        assert not has_success_status(resp)


# ---------------------------------------------------------------------------
# Leaderboard tests
# ---------------------------------------------------------------------------

class TestLeaderboard:
    def test_leaderboard_returns_registered_agents(self, setup):
        addr    = setup["contract_address"]
        account = setup["owner"]

        result = call_contract_method(addr, account, "get_leaderboard", [])
        assert has_success_status(result)
        agents = result["result"]["output"]
        assert isinstance(agents, list)
        assert len(agents) >= 1

    def test_leaderboard_entries_have_required_fields(self, setup):
        addr    = setup["contract_address"]
        account = setup["owner"]

        result = call_contract_method(addr, account, "get_leaderboard", [])
        assert has_success_status(result)
        for agent in result["result"]["output"]:
            assert_dict_struct(agent, {
                "name":               str,
                "description":        str,
                "reputation_score":   int,
                "total_interactions": int,
            })

    def test_get_agent_profile_structure(self, setup):
        addr    = setup["contract_address"]
        account = setup["owner"]

        result = call_contract_method(
            addr, account, "get_agent_profile", [str(account["address"])]
        )
        assert has_success_status(result)
        profile = result["result"]["output"]
        assert_dict_struct(profile, {
            "name":               str,
            "description":        str,
            "reputation_score":   int,
            "total_interactions": int,
            "total_score_sum":    int,
        })

    def test_get_profile_unknown_raises(self, setup):
        addr    = setup["contract_address"]
        account = setup["owner"]
        unknown = create_new_account()

        result = call_contract_method(
            addr, account, "get_agent_profile", [str(unknown["address"])]
        )
        assert not has_success_status(result), "Unknown agent profile should raise"
