"""
JSON extraction utility — Robust extraction of JSON from LLM responses.
Handles markdown-wrapped JSON, nested objects, and parse failures gracefully.
"""

from __future__ import annotations

import json
import re
from typing import Any


def extract_json(raw: str) -> dict[str, Any] | None:
    """
    Extract a JSON object from an LLM response string. Tries multiple strategies
    in order of reliability, avoiding the greedy regex problem.

    Strategy order:
    1. Direct JSON parse (response is pure JSON)
    2. Strip markdown code fences (```json ... ```)
    3. JSONDecoder.raw_decode (find first valid JSON object)
    4. Return None if all fail

    Returns:
        Parsed dict, or None if extraction fails.
    """
    text = raw.strip()

    # Strategy 1: Direct parse
    try:
        result = json.loads(text)
        if isinstance(result, dict):
            return result
    except json.JSONDecodeError:
        pass

    # Strategy 2: Strip markdown code fences
    fenced = re.search(r"```(?:json)?\s*\n?(.*?)\n?\s*```", text, re.DOTALL)
    if fenced:
        try:
            result = json.loads(fenced.group(1).strip())
            if isinstance(result, dict):
                return result
        except json.JSONDecodeError:
            pass

    # Strategy 3: raw_decode — finds the first valid JSON object
    decoder = json.JSONDecoder()
    # Find the first '{' and try to decode from there
    for i, char in enumerate(text):
        if char == "{":
            try:
                result, end = decoder.raw_decode(text, i)
                if isinstance(result, dict):
                    return result
            except json.JSONDecodeError:
                continue

    return None
