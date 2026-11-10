"""Review report for a bundle import: what arrived and what needs a look."""

from __future__ import annotations

from dataclasses import dataclass, field

from .models import CRMData
from .naming import household_name


_SINGULAR = {
    "people": "person", "households": "household", "groups": "group",
    "relationships": "relationship", "interactions": "interaction",
}


def _count_label(table: str, count: int) -> str:
    return f"{count} {_SINGULAR.get(table, table) if count == 1 else table}"


@dataclass
class ImportReport:
    counts: dict[str, int] = field(default_factory=dict)
    # (household id, its members' names) for households needing a name / not really households.
    needs_name: list[tuple[str, str]] = field(default_factory=list)
    not_a_household: list[tuple[str, str]] = field(default_factory=list)
    # (person id, name) for people with a single-word name; ids of people with no name.
    first_name_only: list[tuple[str, str]] = field(default_factory=list)
    no_name: list[str] = field(default_factory=list)

    def summary(self) -> str:
        parts = [_count_label(table, count) for table, count in self.counts.items()]
        text = "Imported " + (", ".join(parts) if parts else "nothing")
        flagged = (
            len(self.needs_name) + len(self.not_a_household)
            + len(self.first_name_only) + len(self.no_name)
        )
        if flagged:
            text += f" · {flagged} item{'' if flagged == 1 else 's'} to review"
        return text

    def to_markdown(self) -> str:
        lines = ["# Hearth import report", "", self.summary()]

        def section(title: str, rows: list[str]) -> None:
            if rows:
                lines.extend(["", f"## {title}", "", *rows])

        section("Counts", [f"- {table}: {count}" for table, count in self.counts.items()])
        section("Households needing a name", [f"- {names} ({i})" for i, names in self.needs_name])
        section("Not a household", [f"- {names} ({i})" for i, names in self.not_a_household])
        section("First name only", [f"- {name!r} ({i})" for i, name in self.first_name_only])
        section("People with no name", [f"- {i}" for i in self.no_name])
        return "\n".join(lines) + "\n"


def build_import_report(data: CRMData) -> ImportReport:
    report = ImportReport(
        counts={
            "people": len(data.people),
            "households": len(data.households),
            "groups": len(data.groups),
            "relationships": len(data.relationships),
            "interactions": len(data.interactions),
        }
    )
    for household in data.households:
        members = [p for p in data.people if p.household_id == household.id]
        status = household_name(members, data.relationships, household.name_override).status
        label = ", ".join(n for m in members if (n := " ".join(m.name.split())))
        if status == "needs_name":
            report.needs_name.append((household.id, label))
        elif status == "not_a_household":
            report.not_a_household.append((household.id, label))
    for person in data.people:
        words = len(person.name.split())
        if words == 0:
            report.no_name.append(person.id)
        elif words == 1:
            report.first_name_only.append((person.id, person.name))
    return report
