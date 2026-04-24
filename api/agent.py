import hashlib


def chunk_id(chunk):
    source = f"{chunk.get('artifact', '')}:{chunk.get('location', '')}:{chunk.get('hash', '')}"
    return hashlib.sha256(source.encode("utf-8")).hexdigest()[:10]


def normalized(text):
    return (text or "").lower()


def score_terms(text, terms):
    lowered = normalized(text)
    return sum(1 for term in terms if normalized(term) in lowered)


def list_artifacts(chunks):
    return sorted({chunk["artifact"] for chunk in chunks})


def search_evidence(chunks, terms, limit=3):
    scored = []
    for chunk in chunks:
        score = score_terms(chunk["text"], terms)
        if score:
            scored.append((score, chunk))

    scored.sort(key=lambda item: item[0], reverse=True)
    return [chunk for _, chunk in scored[:limit]]


def cite_chunk(chunk):
    return {
        "chunk_id": chunk_id(chunk),
        "artifact": chunk["artifact"],
        "location": chunk["location"],
        "hash": chunk["hash"],
        "excerpt": chunk["text"][:260],
    }


def evaluate_required_elements(control, chunks):
    element_results = []
    for element in control["required_evidence_elements"]:
        matches = search_evidence(chunks, element["search_terms"], limit=2)
        element_results.append({
            "element_id": element["id"],
            "label": element["label"],
            "description": element["description"],
            "satisfied": bool(matches),
            "gap": None if matches else element["reviewer_gap"],
            "citations": [cite_chunk(chunk) for chunk in matches],
        })
    return element_results


def build_reviewer_question(control, gaps):
    if gaps:
        return f"For {control['id']}, what evidence closes this reviewer gap: {gaps[0]}"
    return control["common_reviewer_questions"][0]


def build_suggestion(control, gaps):
    if gaps:
        return "Upload or attach evidence for: " + " ".join(gaps)

    labels = ", ".join(
        element["label"].lower()
        for element in control["required_evidence_elements"]
    )
    return f"Keep the cited {control['id']} evidence package together; it currently supports {labels}."


def confidence_for(element_results):
    if not element_results:
        return 0.25

    satisfied = sum(1 for element in element_results if element["satisfied"])
    coverage = satisfied / len(element_results)
    if coverage == 0:
        return 0.25
    return round(min(0.95, 0.35 + (coverage * 0.55)), 2)


def status_for(element_results):
    return "Evidence Found" if all(element["satisfied"] for element in element_results) else "Needs Prep Review"


def build_agent_control(control, chunks):
    agent_plan = [
        f"Load {control['id']} control requirements.",
        "Inventory uploaded artifacts.",
        "Search evidence chunks for each required evidence element.",
        "Validate that each readiness claim has at least one citation.",
        "Produce reviewer question, action, confidence, and trace.",
    ]

    artifacts = list_artifacts(chunks)
    tool_trace = [
        {
            "tool": "list_artifacts",
            "input": "uploaded evidence package",
            "result": f"{len(artifacts)} artifact(s): {', '.join(artifacts) if artifacts else 'none'}",
        }
    ]

    element_results = evaluate_required_elements(control, chunks)
    for element in element_results:
        tool_trace.append({
            "tool": "search_evidence",
            "input": element["label"],
            "result": (
                f"{len(element['citations'])} cited chunk(s)"
                if element["citations"]
                else "no supporting citation"
            ),
        })

    gaps = [element["gap"] for element in element_results if element["gap"]]
    evidence_claims = [
        {
            "claim": f"{element['label']} supported by uploaded evidence.",
            "element_id": element["element_id"],
            "citations": element["citations"],
        }
        for element in element_results
        if element["satisfied"]
    ]

    all_citations = [
        citation
        for element in element_results
        for citation in element["citations"]
    ]
    unique_citations = {
        citation["chunk_id"]: citation
        for citation in all_citations
    }
    provenance = "; ".join(
        f"{citation['artifact']} ({citation['location']}, hash {citation['hash']})"
        for citation in unique_citations.values()
    ) or "No matching uploaded evidence found"

    confidence = confidence_for(element_results)
    status = status_for(element_results)
    satisfied_count = len([element for element in element_results if element["satisfied"]])
    confidence_rationale = (
        f"{satisfied_count}/{len(element_results)} required evidence elements cited; "
        "confidence is capped when any required element lacks provenance."
    )

    reasoning = [
        f"Agent loaded {control['id']} requirements: {control['mission']}",
        f"Agent inspected {len(chunks)} evidence chunk(s) across {len(artifacts)} artifact(s).",
    ]
    reasoning.extend(
        (
            f"{element['label']} has cited support."
            if element["satisfied"]
            else element["gap"]
        )
        for element in element_results
    )

    return {
        "id": control["id"],
        "name": control["name"],
        "status": status,
        "confidence": confidence,
        "artifact": ", ".join(artifacts) if artifacts else "No uploaded artifacts",
        "reasoning": reasoning,
        "reviewer_question": build_reviewer_question(control, gaps),
        "suggestion": build_suggestion(control, gaps),
        "provenance": provenance,
        "risk_summary": (
            "Agent validated every readiness claim against cited evidence."
            if not gaps
            else "Agent found unsupported required evidence elements that may slow reviewer acceptance."
        ),
        "insight_source": "agentic_evidence_review",
        "evidence_found": [
            {
                "claim": claim["claim"],
                "artifact": claim["citations"][0]["artifact"],
                "location": claim["citations"][0]["location"],
                "hash": claim["citations"][0]["hash"],
            }
            for claim in evidence_claims
            if claim["citations"]
        ],
        "gaps": gaps,
        "agent_plan": agent_plan,
        "tool_trace": tool_trace,
        "evidence_claims": evidence_claims,
        "confidence_rationale": confidence_rationale,
    }


def analyze_with_agent(requirements, chunks):
    return [build_agent_control(control, chunks) for control in requirements]
