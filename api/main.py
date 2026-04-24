import asyncio
import copy
import csv
import hashlib
import io
import json
import os
import urllib.error
import urllib.request
import zipfile
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from api.agent import analyze_with_agent

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_MODEL = "openai/gpt-5.2"
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MODEL_INSIGHT_CACHE = {}
MAX_CHUNK_CHARS = 1800

CONTROL_RULES = {
    "AC-2": {
        "name": "Account Management",
        "keywords": [
            "account", "access review", "inactive", "disable", "deactivate",
            "temporary account", "provision", "deprovision", "user access",
        ],
    },
    "AU-6": {
        "name": "Audit Review, Analysis, and Reporting",
        "keywords": [
            "audit", "log review", "siem", "weekly", "reviewed", "alert",
            "event", "security log", "designated individual",
        ],
    },
    "CM-6": {
        "name": "Configuration Settings",
        "keywords": [
            "configuration", "baseline", "stig", "scap", "drift", "deviation",
            "approved", "hardening", "benchmark",
        ],
    },
}


def load_local_env():
    env_path = os.path.join(PROJECT_ROOT, ".env.local")
    if not os.path.exists(env_path):
        return

    with open(env_path, "r") as env_file:
        for raw_line in env_file:
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue

            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


load_local_env()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ControlData(BaseModel):
    id: str
    name: str
    status: str
    confidence: float
    artifact: str
    reasoning: List[str]
    reviewer_question: str
    suggestion: str
    provenance: str
    risk_summary: Optional[str] = None
    insight_source: Optional[str] = "golden_dataset"
    evidence_found: Optional[List[dict]] = None
    gaps: Optional[List[str]] = None
    agent_plan: Optional[List[str]] = None
    tool_trace: Optional[List[dict]] = None
    evidence_claims: Optional[List[dict]] = None
    confidence_rationale: Optional[str] = None


class ModelInsight(BaseModel):
    reviewer_question: str
    suggestion: str
    risk_summary: str


def model_insights_enabled():
    return os.getenv("USE_MODEL_INSIGHTS", "false").lower() in {"1", "true", "yes", "on"}


def build_model_prompt(control):
    return (
        "Generate concise ATO reviewer-prep guidance for this NIST 800-53 control. "
        "Use only the provided control facts, agent plan, tool trace, evidence "
        "claims, gaps, excerpts, and provenance. "
        "Do not invent evidence, filenames, dates, approvals, or technical settings. "
        "If evidence is missing, frame the output around what the assessor should ask "
        "for next. Return strict JSON with reviewer_question, suggestion, and "
        "risk_summary only.\n\n"
        f"{json.dumps(control, indent=2)}"
    )


def generate_model_insight(control):
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise RuntimeError("OPENROUTER_API_KEY is not configured")

    payload = {
        "model": os.getenv("OPENROUTER_MODEL", DEFAULT_MODEL),
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are an ATO evidence reviewer. Produce realistic, concise "
                    "review-prep guidance for federal security authorization teams."
                ),
            },
            {"role": "user", "content": build_model_prompt(control)},
        ],
        "temperature": 0.2,
        "max_tokens": 500,
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "ato_control_insight",
                "strict": True,
                "schema": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "reviewer_question": {"type": "string"},
                        "suggestion": {"type": "string"},
                        "risk_summary": {"type": "string"},
                    },
                    "required": ["reviewer_question", "suggestion", "risk_summary"],
                },
            },
        },
    }

    request = urllib.request.Request(
        OPENROUTER_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": os.getenv("OPENROUTER_SITE_URL", "http://localhost:3000"),
            "X-OpenRouter-Title": "ATO-Copilot",
        },
        method="POST",
    )

    with urllib.request.urlopen(request, timeout=20) as response:
        body = json.loads(response.read().decode("utf-8"))

    content = body["choices"][0]["message"]["content"]
    return ModelInsight(**json.loads(content))


def cache_key_for_control(control):
    payload = {
        "model": os.getenv("OPENROUTER_MODEL", DEFAULT_MODEL),
        "control": control,
    }
    serialized = json.dumps(payload, sort_keys=True)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def enrich_control_with_model(control):
    enriched_control = dict(control)
    cache_key = cache_key_for_control(enriched_control)
    cached = MODEL_INSIGHT_CACHE.get(cache_key)

    if cached:
        enriched_control.update(copy.deepcopy(cached))
        return enriched_control

    try:
        insight = generate_model_insight(enriched_control)
        model_fields = {
            "reviewer_question": insight.reviewer_question,
            "suggestion": insight.suggestion,
            "risk_summary": insight.risk_summary,
            "insight_source": "openrouter_model",
        }
        MODEL_INSIGHT_CACHE[cache_key] = copy.deepcopy(model_fields)
        enriched_control.update(model_fields)
    except (KeyError, ValueError, RuntimeError, urllib.error.URLError, TimeoutError) as error:
        print(f"Model insight failed for {control.get('id', 'unknown')}: {error}")
        enriched_control["insight_source"] = "golden_dataset_fallback"

    return enriched_control


async def apply_model_insights(data):
    if not model_insights_enabled():
        return data

    return await asyncio.gather(
        *(asyncio.to_thread(enrich_control_with_model, control) for control in data)
    )


def decode_text(content):
    for encoding in ("utf-8-sig", "utf-8", "latin-1"):
        try:
            return content.decode(encoding)
        except UnicodeDecodeError:
            continue
    return content.decode("utf-8", errors="replace")


def chunk_plain_text(artifact, text):
    lines = text.splitlines()
    chunks = []
    current_lines = []
    current_start = 1
    current_size = 0

    for idx, line in enumerate(lines, start=1):
        line_size = len(line) + 1
        if current_lines and current_size + line_size > MAX_CHUNK_CHARS:
            chunk_text = "\n".join(current_lines).strip()
            if chunk_text:
                chunks.append({
                    "artifact": artifact,
                    "location": f"lines {current_start}-{idx - 1}",
                    "text": chunk_text,
                    "hash": hashlib.sha256(chunk_text.encode("utf-8")).hexdigest()[:12],
                })
            current_lines = []
            current_start = idx
            current_size = 0

        current_lines.append(line)
        current_size += line_size

    chunk_text = "\n".join(current_lines).strip()
    if chunk_text:
        chunks.append({
            "artifact": artifact,
            "location": f"lines {current_start}-{max(current_start, len(lines))}",
            "text": chunk_text,
            "hash": hashlib.sha256(chunk_text.encode("utf-8")).hexdigest()[:12],
        })

    return chunks


def chunk_csv(artifact, text):
    reader = csv.reader(io.StringIO(text))
    rows = list(reader)
    if not rows:
        return []

    header = rows[0]
    chunks = []
    for idx, row in enumerate(rows[1:], start=2):
        values = []
        for col_idx, value in enumerate(row):
            label = header[col_idx] if col_idx < len(header) and header[col_idx] else f"column_{col_idx + 1}"
            values.append(f"{label}: {value}")
        chunk_text = "\n".join(values).strip()
        if chunk_text:
            chunks.append({
                "artifact": artifact,
                "location": f"row {idx}",
                "text": chunk_text,
                "hash": hashlib.sha256(chunk_text.encode("utf-8")).hexdigest()[:12],
            })

    return chunks or chunk_plain_text(artifact, text)


def parse_artifact(artifact, content):
    lower_name = artifact.lower()
    if lower_name.endswith(".zip"):
        return extract_zip_artifacts(artifact, content)

    text = decode_text(content)
    if lower_name.endswith(".json"):
        try:
            parsed = json.loads(text)
            text = json.dumps(parsed, indent=2)
        except json.JSONDecodeError:
            pass

    if lower_name.endswith(".csv"):
        return chunk_csv(artifact, text)

    return chunk_plain_text(artifact, text)


def extract_zip_artifacts(archive_name, content):
    chunks = []
    with zipfile.ZipFile(io.BytesIO(content)) as archive:
        for member in archive.infolist():
            if member.is_dir() or member.file_size == 0:
                continue
            member_name = f"{archive_name}::{member.filename}"
            with archive.open(member) as member_file:
                chunks.extend(parse_artifact(member_name, member_file.read()))
    return chunks


async def extract_evidence_chunks(file):
    content = await file.read()
    if not content:
        return []
    return parse_artifact(file.filename or "uploaded-evidence", content)


def keyword_score(text, keywords):
    lowered = text.lower()
    return sum(1 for keyword in keywords if keyword in lowered)


def top_chunks_for_control(chunks, rule):
    scored = []
    for chunk in chunks:
        score = keyword_score(chunk["text"], rule["keywords"])
        if score > 0:
            scored.append((score, chunk))
    scored.sort(key=lambda item: item[0], reverse=True)
    return [chunk for _, chunk in scored[:4]]


def has_any(chunks, terms):
    return any(term in chunk["text"].lower() for chunk in chunks for term in terms)


def evaluate_gaps(control_id, chunks):
    gaps = []
    if control_id == "AC-2":
        if not has_any(chunks, ["inactive"]):
            gaps.append("No uploaded evidence explicitly references inactive account handling.")
        if not has_any(chunks, ["disable", "deactivate", "disabled", "deactivated"]):
            gaps.append("No uploaded evidence shows account disablement or deactivation.")
        if not has_any(chunks, ["temporary account", "temporary user", "temp account"]):
            gaps.append("No uploaded evidence addresses temporary account lifecycle management.")
    elif control_id == "AU-6":
        if not has_any(chunks, ["weekly", "daily", "monthly"]):
            gaps.append("No uploaded evidence shows the audit review cadence.")
        if not has_any(chunks, ["reviewer", "analyst", "designated individual", "signed", "approved"]):
            gaps.append("No uploaded evidence identifies who performs or approves audit review.")
    elif control_id == "CM-6":
        if not has_any(chunks, ["baseline", "stig", "scap", "benchmark"]):
            gaps.append("No uploaded evidence ties configuration settings to a baseline or benchmark.")
        if not has_any(chunks, ["deviation", "exception", "approved", "approval"]):
            gaps.append("No uploaded evidence shows approval of configuration deviations or exceptions.")
    return gaps


def reviewer_question_for(control_id, gaps):
    if gaps:
        return f"What evidence can you provide to close this {control_id} gap: {gaps[0]}"
    questions = {
        "AC-2": "Does the uploaded evidence prove account reviews, inactive-account disabling, and temporary account lifecycle controls?",
        "AU-6": "Does the uploaded evidence prove audit logs are reviewed on a defined cadence by an accountable reviewer?",
        "CM-6": "Does the uploaded evidence prove baseline configuration settings and approved deviations are managed consistently?",
    }
    return questions[control_id]


def suggestion_for(control_id, gaps):
    if gaps:
        return "Add or upload evidence that directly addresses: " + " ".join(gaps)
    suggestions = {
        "AC-2": "Keep the uploaded account management evidence with row or line references for access reviews, inactivity handling, and temporary account lifecycle records.",
        "AU-6": "Keep the uploaded audit review evidence with reviewer identity, review cadence, and SIEM or log provenance visible.",
        "CM-6": "Keep the uploaded configuration evidence with baseline source, scan results, drift monitoring, and deviation approvals linked.",
    }
    return suggestions[control_id]


def build_real_control(control_id, rule, chunks):
    matched_chunks = top_chunks_for_control(chunks, rule)
    gaps = evaluate_gaps(control_id, matched_chunks)
    evidence_found = [
        {
            "claim": chunk["text"][:220],
            "artifact": chunk["artifact"],
            "location": chunk["location"],
            "hash": chunk["hash"],
        }
        for chunk in matched_chunks[:3]
    ]

    status = "Evidence Found" if matched_chunks and not gaps else "Needs Prep Review"
    confidence = min(0.95, 0.45 + (len(matched_chunks) * 0.12) + (0.18 if not gaps else 0))
    if not matched_chunks:
        confidence = 0.25

    artifacts = sorted({chunk["artifact"] for chunk in matched_chunks}) or ["No matching uploaded artifact"]
    provenance = "; ".join(
        f"{chunk['artifact']} ({chunk['location']}, hash {chunk['hash']})"
        for chunk in matched_chunks[:3]
    ) or "No matching uploaded evidence found"

    reasoning = []
    if matched_chunks:
        reasoning.extend(
            f"Uploaded evidence matched in {chunk['artifact']} at {chunk['location']}."
            for chunk in matched_chunks[:3]
        )
    else:
        reasoning.append(f"No uploaded evidence matched {control_id} keywords.")
    reasoning.extend(gaps or [f"Uploaded evidence covers the expected {control_id} review signals."])

    return {
        "id": control_id,
        "name": rule["name"],
        "status": status,
        "confidence": round(confidence, 2),
        "artifact": ", ".join(artifacts),
        "reasoning": reasoning,
        "reviewer_question": reviewer_question_for(control_id, gaps),
        "suggestion": suggestion_for(control_id, gaps),
        "provenance": provenance,
        "risk_summary": "Generated from uploaded evidence and deterministic control matching.",
        "insight_source": "uploaded_evidence",
        "evidence_found": evidence_found,
        "gaps": gaps,
    }


def analyze_uploaded_evidence(chunks):
    requirements_path = os.path.join(PROJECT_ROOT, "docs", "control_requirements.json")
    with open(requirements_path, "r") as f:
        requirements = json.load(f)
    return analyze_with_agent(requirements, chunks)

@app.post("/analyze", response_model=List[ControlData])
async def analyze(file: Optional[UploadFile] = File(None)):
    if file and file.filename:
        chunks = await extract_evidence_chunks(file)
        return await apply_model_insights(analyze_uploaded_evidence(chunks))

    file_path = os.path.join(PROJECT_ROOT, "docs", "golden_dataset.json")
    with open(file_path, "r") as f:
        data = json.load(f)
    return await apply_model_insights(data)

@app.post("/analyze-evidence")
async def analyze_evidence(file: Optional[UploadFile] = File(None)):
    # Redirect or reuse analyze for backward compatibility if needed, 
    # but the PRD specifies /analyze
    return await analyze(file)
