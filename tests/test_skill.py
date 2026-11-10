"""The Claude skill shipped in ``skills/hearth-crm`` and the API prompt agree with the real tools.

The skill is a public, generic file: it must not carry Notion wording or record ids, and every
tool it names must exist (and every tool must be named), so it cannot drift from the API.
"""

from __future__ import annotations

import re
from pathlib import Path

from custom_components.hearth_crm import llm_api
from custom_components.hearth_crm.const import TOOL_PREFIX

SKILL = Path(__file__).resolve().parent.parent / "skills" / "hearth-crm" / "SKILL.md"
TOOL_NAME = re.compile(rf"{TOOL_PREFIX}[a-z_]+")
UUID = re.compile(r"\b[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}\b", re.I)
HEX_ID = re.compile(r"\b[0-9a-f]{32}\b", re.I)
URL = re.compile(r"https?://[^\s)`>]+")
# The only URL the skill may give is the connector address, with a placeholder host.
CONNECTOR_URL = "https://<your Home Assistant address>/api/mcp/hearth_crm"


def _real_tool_names() -> set[str]:
    return {cls.name for cls in llm_api.TOOL_CLASSES}


def _frontmatter(text: str) -> dict[str, str]:
    assert text.startswith("---\n"), "SKILL.md must open with YAML frontmatter"
    block = text.split("---\n", 2)[1]
    fields = {}
    for line in block.splitlines():
        key, sep, value = line.partition(":")
        if sep:
            fields[key.strip()] = value.strip()
    return fields


def test_skill_has_frontmatter_name_and_description():
    fields = _frontmatter(SKILL.read_text())
    assert fields.get("name") == "hearth-crm"
    description = fields.get("description", "")
    for phrase in ("log an interaction", "add or look up a person", "relationship",
                   "household", "group", "relationship summary", "reach out"):
        assert phrase in description.lower(), phrase


def test_skill_never_mentions_notion_or_record_ids():
    text = SKILL.read_text()
    assert "notion" not in text.lower()
    assert not UUID.search(text), UUID.search(text)
    assert not HEX_ID.search(text), HEX_ID.search(text)
    assert set(URL.findall(text.replace(CONNECTOR_URL, ""))) == set()


def test_skill_explains_how_to_connect():
    text = SKILL.read_text()
    assert CONNECTOR_URL in text
    assert "Model Context Protocol Server" in text
    assert "admin" in text


def test_every_tool_the_skill_names_exists_and_every_tool_is_named():
    named = set(TOOL_NAME.findall(SKILL.read_text()))
    assert named == _real_tool_names()


def test_api_prompt_names_only_real_tools_and_stays_short():
    prompt = llm_api.API_PROMPT
    named = set(TOOL_NAME.findall(prompt))
    assert named, "the prompt's workflow lines name the tools they use"
    assert named <= _real_tool_names(), named - _real_tool_names()
    for tool in ("log_interaction", "set_relationship_summary", "search_people",
                 "create_person", "add_relationship", "get_person"):
        assert f"{TOOL_PREFIX}{tool}" in named, tool
    assert len(prompt) <= 2500, len(prompt)


def test_version_is_0_6_0():
    manifest = (Path(llm_api.__file__).parent / "manifest.json").read_text()
    assert '"version": "0.6.0"' in manifest
