"""Tests for the generic import report."""

from __future__ import annotations

from dataclasses import replace

from custom_components.hearth_crm.import_report import ImportReport, build_import_report
from custom_components.hearth_crm.models import CRMData, Household
from tests.conftest import T0, T1, sample_data


def test_report_sections_and_summary():
    data = sample_data()
    data.people[3] = replace(data.people[3], name="Drew")  # first name only
    data.people.append(replace(data.people[1], id="p5", name="  ", household_id="h2"))
    data.people.append(replace(data.people[1], id="p6", name="Eden Other", household_id="h2"))
    data.households.append(Household(id="h2", created_at=T0, updated_at=T1))  # two, no adults
    data.households.append(Household(id="h3", created_at=T0, updated_at=T1))  # nobody

    report = build_import_report(data)

    assert report.counts == {
        "people": 6, "households": 3, "groups": 1, "relationships": 3, "interactions": 2,
        "reminders": 3,
    }
    assert report.needs_name == [("h2", "Eden Other")]
    assert [i for i, _ in report.not_a_household] == ["h3"]
    assert report.first_name_only == [("p4", "Drew")]
    assert report.no_name == ["p5"]
    assert report.summary() == (
        "Imported 6 people, 3 households, 1 group, 3 relationships, 2 interactions,"
        " 3 reminders"
        " · 4 items to review"
    )
    markdown = report.to_markdown()
    assert markdown.startswith("# Hearth import report\n")
    for heading in ("Counts", "Households needing a name", "Not a household",
                    "First name only", "People with no name"):
        assert f"\n## {heading}\n" in markdown


def test_clean_data_has_only_the_counts_section():
    report = build_import_report(sample_data())
    assert "items to review" not in report.summary()
    assert report.to_markdown().count("\n## ") == 1


def test_empty_report_renders():
    assert ImportReport().summary() == "Imported nothing"
    assert build_import_report(CRMData()).counts["people"] == 0


def test_reminders_are_counted_only_when_there_are_some():
    data = sample_data()
    data.reminders = []
    report = build_import_report(data)
    assert "reminders" not in report.counts
    assert "reminder" not in report.summary()
