"""Brute-force permutation catalogue helpers for the College Bus Route project.

The browser UI uses the same principle: unrank one permutation at a time so that
large factorial route spaces can be paginated without storing every route.
"""
from __future__ import annotations
from itertools import permutations
from math import factorial
from typing import Iterable, Sequence


def route_count(pickup_count: int) -> int:
    if pickup_count < 0:
        raise ValueError("pickup_count cannot be negative")
    return factorial(pickup_count)


def iter_route_catalog(names: Sequence[str], matrix: Sequence[Sequence[float]]) -> Iterable[dict]:
    """Yield every depot-closed route and its distance in permutation order."""
    if not names:
        raise ValueError("names must include a depot")
    size = len(names)
    if len(matrix) != size or any(len(row) != size for row in matrix):
        raise ValueError("distance matrix must be square and match names")
    depot, pickups = names[0], names[1:]
    for number, order in enumerate(permutations(pickups), start=1):
        route = (depot, *order, depot)
        legs = []
        distance = 0.0
        for a, b in zip(route, route[1:]):
            d = float(matrix[names.index(a)][names.index(b)])
            distance += d
            legs.append({"from": a, "to": b, "distance_km": d})
        yield {"route_number": number, "route": list(route), "distance_km": distance, "legs": legs}


def route_page(names: Sequence[str], matrix: Sequence[Sequence[float]], page: int = 0, page_size: int = 20) -> dict:
    """Return one page from the full route catalogue (zero-based page index)."""
    if page < 0 or page_size < 1:
        raise ValueError("page must be >= 0 and page_size must be >= 1")
    total = route_count(len(names) - 1)
    start, stop = page * page_size, min(total, (page + 1) * page_size)
    if start >= total and total:
        raise ValueError("page is outside the route catalogue")
    rows = []
    for i, row in enumerate(iter_route_catalog(names, matrix)):
        if i >= stop:
            break
        if i >= start:
            rows.append(row)
    return {"total_routes": total, "page": page, "page_size": page_size, "routes": rows}
