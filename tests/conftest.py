"""Shared test fixtures and builders (invented people only)."""

from __future__ import annotations

from datetime import UTC, date, datetime

import pytest
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType

from custom_components.hearth_crm.const import CONF_OWNER_USER_ID, DOMAIN
from custom_components.hearth_crm.enums import ConnectionType, InteractionType
from custom_components.hearth_crm.models import (
    ContactGroup,
    CRMData,
    Household,
    Interaction,
    Person,
    Place,
    Relationship,
)

T0 = datetime(2026, 1, 5, 12, 30, tzinfo=UTC)
T1 = datetime(2026, 2, 6, 8, 15, 30, tzinfo=UTC)


def sample_data() -> CRMData:
    """A small, fully-populated dataset: a household of four, a group, links, interactions."""
    home = Place(
        formatted="12 Elm St, Springfield, ZZ 00001",
        street="12 Elm St",
        city="Springfield",
        state="ZZ",
        postal_code="00001",
        country="Exampleland",
        lat=12.5,
        lon=-34.25,
    )
    school = Place(formatted="Elm Elementary")

    def person(pid: str, name: str, **kw) -> Person:
        return Person(id=pid, name=name, created_at=T0, updated_at=T1, **kw)

    people = [
        person(
            "p1",
            "Alex Example",
            phone="555-0101",
            email="alex@example.com",
            birthday=date(1980, 3, 4),
            favorite=True,
            address=home,
            relationship_summary="Close friend",
            summary_updated=date(2026, 1, 1),
            photo_hash="abc123",
            household_id="h1",
            google_contact_id="g-1",
            google_synced_at=T1,
        ),
        person("p2", "Blair Example", household_id="h1", birth_year_unknown=True,
               birthday=date(1982, 7, 9)),
        person("p3", "Casey Example", household_id="h1", school=school, close_friend=True),
        person("p4", "Drew Example", household_id="h1", notes="Kid"),
    ]
    households = [
        Household(
            id="h1",
            created_at=T0,
            updated_at=T1,
            name_override="The Examples",
            address=home,
            notes="Next door",
            photo_hash="def456",
        )
    ]
    groups = [
        ContactGroup(
            id="g1", name="Book Club", created_at=T0, updated_at=T1,
            description="Monthly", photo_hash=None,
        )
    ]
    relationships = [
        Relationship(id="r1", person_a_id="p1", person_b_id="p2",
                     type=ConnectionType.SPOUSE, created_at=T0, updated_at=T1),
        Relationship(id="r2", person_a_id="p1", person_b_id="p3",
                     type=ConnectionType.CHILD, created_at=T0, updated_at=T1, notes="Eldest"),
        Relationship(id="r3", person_a_id="p1", person_b_id="p4",
                     type=ConnectionType.CHILD, created_at=T0, updated_at=T1),
    ]
    interactions = [
        Interaction(id="i1", summary="Coffee", date=date(2026, 1, 20),
                    type=InteractionType.CATCH_UP, created_at=T0, updated_at=T1,
                    notes="Talked travel", person_ids=["p2", "p1"]),
        Interaction(id="i2", summary="Hike", date=date(2026, 2, 1),
                    type=InteractionType.TRIP, created_at=T0, updated_at=T1,
                    person_ids=["p3"]),
    ]
    return CRMData(
        people=people,
        households=households,
        groups=groups,
        group_members=[("g1", "p1"), ("g1", "p2")],
        relationships=relationships,
        interactions=interactions,
    )


@pytest.fixture
def sample() -> CRMData:
    return sample_data()


@pytest.fixture
def hass_config_dir(hass_tmp_config_dir: str) -> str:
    """Give every Home Assistant test its own config directory."""
    return hass_tmp_config_dir


@pytest.fixture
async def add_crm(hass: HomeAssistant, enable_custom_integrations):
    """Return a coroutine function that adds one user's CRM through the config flow."""

    async def add(user) -> ConfigEntry:
        result = await hass.config_entries.flow.async_init(
            DOMAIN, context={"source": "user"}
        )
        result = await hass.config_entries.flow.async_configure(
            result["flow_id"], {CONF_OWNER_USER_ID: user.id}
        )
        await hass.async_block_till_done()
        assert result["type"] is FlowResultType.CREATE_ENTRY
        return result["result"]

    return add
