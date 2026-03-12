#!/usr/bin/env python3
"""Generate endorsement buckets for the November 2025 Town Meeting roster.

This script matches the member roster in Votes/November 2025 Votes.xlsx
against the Spring 2025 Town Meeting endorsement slates published by:

- Brookline By Design
- Brookline for Everyone

Only Town Meeting endorsements are included. Endorsements for other offices
on those pages, such as Select Board, are intentionally excluded.
"""

from __future__ import annotations

import csv
import re
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Sequence
from xml.etree import ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
VOTES_DIR = ROOT / "Votes"
ROSTER_PATH = VOTES_DIR / "November 2025 Votes.xlsx"
ALIASES_PATH = VOTES_DIR / "members_aliases.xlsx"
OUTPUT_PATH = VOTES_DIR / "November 2025 Member Endorsements.csv"

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
VALID_PRECINCTS = {str(number) for number in range(1, 18)} | {"AL"}


# Mirrors the defaults in tm-shared.js.
DEFAULT_MEMBER_IDENTITY_ALIASES = {
    "ingraham, katherine a": "ingraham, katherine",
    "warren, paul s": "warren, paul",
}


# These are obvious same-person variants that are not yet in members_aliases.xlsx.
MANUAL_MEMBER_IDENTITY_ALIASES = {
    "raitt, jennifer": "raitt, jennifer maris",
    "redburn, jeremy": "redburn, jeremy a",
    "mackenzie, kevin": "mackenzie, kevin thomas",
    "chaky, christopher": "chaky, christopher joseph",
    "dubin, ben": "dubin, benjamin",
}


# Source: https://www.brooklinebydesign.com/endorsedcandidates
BROOKLINE_BY_DESIGN_ENDORSEMENTS = {
    "1": [
        "Ana Albuquerque",
        "Susan Helms Daley",
        "Sean M. Lynn-Jones",
        "Lawrence R. Sulak, II",
    ],
    "2": [
        "Brenda Hochberg",
        "Pamela L. Roberts",
        "Barbara C. Scotto",
        "Maura Toomey",
        "Kate Poverman",
    ],
    "3": [
        "Harry K. Bohrs",
        "Dennis L. Doughty",
    ],
    "4": [
        "Vena Priestly",
        "Kiran Bhatia",
    ],
    "5": [],
    "6": [
        "Daniel G. Saltzman",
        "Kim Smith",
        "Virginia A. Smith",
    ],
    "7": [
        "Susan Cohen",
        "Susan Granoff",
        "Aylit Schultz",
    ],
    "8": [
        "Tracie Burns",
        "Anita L. Johnson",
        "Michael W. Toffel",
        "Mary Sievers",
        "Amitai Handler",
    ],
    "9": [
        "Robert J. Weintraub",
        "Christopher Mutty",
    ],
    "10": [],
    "11": [
        "David M. Pollak",
        "Andrew Riely",
    ],
    "12": [
        "Petra Gospodnetic Bignami",
        "Emily Dolbear",
        "Amy Hummel",
        "Mark Lowenstein",
    ],
    "13": [
        "John Doggett",
        "Mark Nathan Gerber",
        "Francis Charlton Hoy",
    ],
    "14": [
        "Carla Wyman Benka",
        "Richard Dick Benka",
        "Jesse Hefter",
        "Lynda E Roseman",
    ],
    "15": [
        "Eileen Connell Berger",
        "Janice S. Kahn",
        "Richard Nangle",
        "Wadner Oge",
        "Hugh Joseph",
        "Rory Hallowell",
    ],
    "16": [
        "Laura Kathryn Baines-Walsh",
        "Joslin Murphy",
        "Carolyn R. Thall",
    ],
    "17": [
        "Jacqueline Baum",
        "Jonathan H. Davis",
        "Bruce Levin",
        "Susan Kay Park",
        "Linda Olson Pehlke",
        "Benjamin Dubin",
    ],
}


# Source: https://brooklineforeveryone.com/vote/b4e-endorsements/
BROOKLINE_FOR_EVERYONE_ENDORSEMENTS = {
    "1": [
        "Cathleen Cavell",
        "Bradford Kimball",
        "Taylor Mayberry",
        "David Sipos",
    ],
    "2": [
        "Brenda Hochberg",
        "Elise Couture-Stone",
        "Esther Gruesz",
        "Megan Hinman",
        "Lauren Shebairo",
        "Colleen Newsome",
    ],
    "3": [
        "Kathryn Becker",
        "Frank Steinfield",
        "Leigh Heyman",
        "Sean Leckey",
        "Margaret Robotham",
        "Peter Frumkin",
    ],
    "4": [
        "Massiel Gonzalez",
        "Jennifer Raitt",
        "Arslan Aziz",
    ],
    "5": [
        "William Reyelt",
        "Jessica Milhem",
    ],
    "6": [
        "Kim Smith",
        "Daniel Fishman",
        "Michael McGraw-Herdeg",
        "Maxim Sheinin",
    ],
    "7": [
        "Colin Stokes",
        "Chi Chi Wu",
        "Amanda Zimmerman",
        "Aylit Schultz",
        "Isaac Silberberg",
    ],
    "8": [
        "Tracie Burns",
        "Michael Toffel",
        "Yukiko Ueno Egozy",
        "Mary Sievers",
    ],
    "9": [
        "Harold Simansky",
        "Anthony Buono",
        "Christopher Mutty",
        "Matti Klock",
    ],
    "10": [
        "John Bowman",
        "Naomi Sweitzer",
        "Elizabeth Erdman",
        "Elizabeth Kernan",
    ],
    "11": [
        "Shira Fischer",
        "Shanna Giora-Gorfajn",
        "David Pollak",
        "Lisa Shatz",
        "Rebecca Mautner",
    ],
    "12": [
        "Mark Lowenstein",
        "Faye Miller",
        "Yitzhak Kornbluth",
        "Jonathan Phillips",
        "Jeremy Redburn",
        "Margaret Molloy",
    ],
    "13": [
        "Andrew Fischer",
        "David Brewster",
        "Anne Finkenbinder",
        "Kevin MacKenzie",
        "Jennifer Segel",
    ],
    "14": [
        "Kathleen O'Connell",
    ],
    "15": [],
    "16": [
        "Carlos Tamayo",
    ],
    "17": [
        "Susan Park",
        "Christopher Chaky",
        "Annie Hudson",
        "Thai Johnson",
        "Michael Vaughan",
        "Ben Dubin",
        "Rhea Paul",
        "Joseph Valencia",
    ],
}


@dataclass(frozen=True)
class Member:
    precinct: str
    name: str
    member_key: str
    canonical_name: str


def read_xlsx_rows(path: Path) -> List[Dict[str, str]]:
    with zipfile.ZipFile(path) as workbook_zip:
        shared_strings: List[str] = []
        if "xl/sharedStrings.xml" in workbook_zip.namelist():
            shared_root = ET.fromstring(workbook_zip.read("xl/sharedStrings.xml"))
            for shared_item in shared_root.findall(f"{NS}si"):
                shared_strings.append(
                    "".join(text_node.text or "" for text_node in shared_item.iter(f"{NS}t"))
                )

        sheet_root = ET.fromstring(workbook_zip.read("xl/worksheets/sheet1.xml"))
        rows: List[Dict[str, str]] = []
        for row in sheet_root.findall(f".//{NS}sheetData/{NS}row"):
            values: Dict[str, str] = {}
            for cell in row.findall(f"{NS}c"):
                column = re.match(r"([A-Z]+)", cell.attrib["r"]).group(1)
                value_node = cell.find(f"{NS}v")
                inline_node = cell.find(f"{NS}is")
                cell_type = cell.attrib.get("t")
                if cell_type == "s" and value_node is not None:
                    value = shared_strings[int(value_node.text)]
                elif cell_type == "inlineStr" and inline_node is not None:
                    value = "".join(text_node.text or "" for text_node in inline_node.iter(f"{NS}t"))
                elif value_node is not None:
                    value = value_node.text or ""
                else:
                    value = ""
                values[column] = value
            rows.append(values)
        return rows


def normalize_member_name(name: str) -> str:
    return " ".join(str(name or "").strip().lower().split())


def normalize_member_alias_token(name: str) -> str:
    return (
        normalize_member_name(name)
        .replace(".", "")
        .replace("’", "'")
        .replace("‘", "'")
        .replace("`", "'")
        .replace("–", "-")
        .replace("—", "-")
        .replace(",", ", ")
        .replace("  ", " ")
        .strip()
    )


def reorder_name_if_likely_first_last(normalized_name: str) -> str:
    if not normalized_name or "," in normalized_name:
        return ""

    tokens = normalized_name.split()
    if len(tokens) < 2:
        return ""

    suffix = ""
    if len(tokens) > 2 and re.fullmatch(r"(jr|sr|ii|iii|iv|v|vi)", tokens[-1], re.IGNORECASE):
        suffix = tokens.pop()

    last = tokens.pop()
    if not last or not tokens:
        return ""

    given_tokens = tokens + ([suffix] if suffix else [])
    return re.sub(r"\s+", " ", f"{last}, {' '.join(given_tokens)}").strip()


def strip_likely_middle_initials(normalized_name: str) -> str:
    if not normalized_name:
        return ""

    if "," in normalized_name:
        last, given = normalized_name.split(",", 1)
        tokens = given.replace(".", "").split()
        if len(tokens) > 1 and re.fullmatch(r"[a-z]", tokens[-1]):
            tokens.pop()
        return f"{last.strip()}, {' '.join(tokens)}".strip().strip(",")

    tokens = normalized_name.replace(".", "").split()
    if len(tokens) > 1 and re.fullmatch(r"[a-z]", tokens[-1]):
        tokens.pop()
    elif len(tokens) == 3 and re.fullmatch(r"[a-z]", tokens[1]):
        tokens.pop(1)
    return " ".join(tokens)


def canonical_member_identity_name(name: str, alias_map: Dict[str, str]) -> str:
    normalized = normalize_member_alias_token(name)
    if not normalized:
        return ""

    candidates: List[str] = []

    def push(value: str) -> None:
        token = normalize_member_alias_token(value)
        if token and token not in candidates:
            candidates.append(token)

    push(normalized)
    push(strip_likely_middle_initials(normalized))

    reordered = reorder_name_if_likely_first_last(normalized)
    if reordered:
        push(reordered)
        push(strip_likely_middle_initials(reordered))

    for candidate in candidates:
        mapped = alias_map.get(candidate)
        if mapped:
            return mapped
    return candidates[1] if len(candidates) > 1 else candidates[0]


def load_alias_map() -> Dict[str, str]:
    alias_map = dict(DEFAULT_MEMBER_IDENTITY_ALIASES)
    rows = read_xlsx_rows(ALIASES_PATH)
    for row in rows:
        canonical_raw = str(row.get("A") or "").strip()
        aliases_raw = str(row.get("B") or "").strip()
        if not canonical_raw:
            continue

        canonical = normalize_member_alias_token(canonical_raw)
        if not canonical:
            continue

        alias_map[canonical] = canonical
        if aliases_raw:
            for alias in aliases_raw.split("::"):
                alias_token = normalize_member_alias_token(alias)
                if alias_token:
                    alias_map[alias_token] = canonical

    alias_map.update(MANUAL_MEMBER_IDENTITY_ALIASES)
    return alias_map


def load_roster(alias_map: Dict[str, str]) -> List[Member]:
    rows = read_xlsx_rows(ROSTER_PATH)
    members: List[Member] = []
    for row in rows[5:]:
        precinct = str(row.get("A") or "").strip()
        name = str(row.get("B") or "").strip()
        if precinct not in VALID_PRECINCTS:
            continue
        members.append(
            Member(
                precinct=precinct,
                name=name,
                member_key=f"{name} (Precinct {precinct})",
                canonical_name=canonical_member_identity_name(name, alias_map),
            )
        )
    return members


def build_endorsement_lookup(
    endorsements_by_precinct: Dict[str, Sequence[str]],
    alias_map: Dict[str, str],
) -> Dict[str, str]:
    lookup: Dict[str, str] = {}
    for names in endorsements_by_precinct.values():
        for page_name in names:
            canonical_name = canonical_member_identity_name(page_name, alias_map)
            if canonical_name and canonical_name not in lookup:
                lookup[canonical_name] = page_name
    return lookup


def endorsement_bucket(is_bbd: bool, is_b4e: bool) -> str:
    if is_bbd and is_b4e:
        return "both"
    if is_bbd:
        return "brookline_by_design"
    if is_b4e:
        return "brookline_for_everyone"
    return "neither"


def precinct_sort_value(precinct: str) -> int:
    try:
        return int(precinct)
    except ValueError:
        return 999 if precinct.upper() == "AL" else 998


def write_output(
    members: Sequence[Member],
    bbd_lookup: Dict[str, str],
    b4e_lookup: Dict[str, str],
) -> Dict[str, int]:
    counts = {
        "both": 0,
        "brookline_by_design": 0,
        "brookline_for_everyone": 0,
        "neither": 0,
    }

    sorted_members = sorted(
        members,
        key=lambda member: (precinct_sort_value(member.precinct), member.name),
    )

    with OUTPUT_PATH.open("w", newline="", encoding="utf-8") as csv_file:
        writer = csv.DictWriter(
            csv_file,
            fieldnames=[
                "precinct",
                "name",
                "member_key",
                "brookline_by_design",
                "brookline_by_design_source_name",
                "brookline_for_everyone",
                "brookline_for_everyone_source_name",
                "endorsement_bucket",
            ],
        )
        writer.writeheader()

        for member in sorted_members:
            bbd_source_name = bbd_lookup.get(member.canonical_name, "")
            b4e_source_name = b4e_lookup.get(member.canonical_name, "")
            bucket = endorsement_bucket(bool(bbd_source_name), bool(b4e_source_name))
            counts[bucket] += 1

            writer.writerow(
                {
                    "precinct": member.precinct,
                    "name": member.name,
                    "member_key": member.member_key,
                    "brookline_by_design": "yes" if bbd_source_name else "no",
                    "brookline_by_design_source_name": bbd_source_name,
                    "brookline_for_everyone": "yes" if b4e_source_name else "no",
                    "brookline_for_everyone_source_name": b4e_source_name,
                    "endorsement_bucket": bucket,
                }
            )

    return counts


def format_counts(counts: Dict[str, int]) -> str:
    ordered_keys = [
        "both",
        "brookline_by_design",
        "brookline_for_everyone",
        "neither",
    ]
    return ", ".join(f"{key}={counts[key]}" for key in ordered_keys)


def main() -> None:
    alias_map = load_alias_map()
    members = load_roster(alias_map)
    bbd_lookup = build_endorsement_lookup(BROOKLINE_BY_DESIGN_ENDORSEMENTS, alias_map)
    b4e_lookup = build_endorsement_lookup(BROOKLINE_FOR_EVERYONE_ENDORSEMENTS, alias_map)
    counts = write_output(members, bbd_lookup, b4e_lookup)
    print(f"Wrote {len(members)} rows to {OUTPUT_PATH}")
    print(format_counts(counts))


if __name__ == "__main__":
    main()
