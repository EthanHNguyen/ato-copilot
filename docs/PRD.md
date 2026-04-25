# PRD: ATO-Copilot (Mission Terminal)
**Tagline:** High-density security evidence intelligence for IL6 and FedRAMP workloads.
**Product Metaphor:** Palantir for Compliance.
**Design Ethos:** Data-dense, keyboard-centric, institutional authority.

## 1. Executive Summary
ATO-copilot is a "Mission Terminal" that automates the most painful part of the ATO (Authority to Operate) lifecycle: **Evidence Readiness**. It ingests unstructured artifacts (logs, CSVs, PDFs), maps them to NIST 800-53 controls, and predicts reviewer scrutiny.

## 2. Problem Statement
Compliance analysts waste 60% of their time manually verifying if evidence is "review-ready." Existing GRC tools are slow, mouse-heavy web forms that don't help prepare for the "Interrogatory Phase" (when a reviewer asks a difficult technical question).

## 3. Product Thesis
If you provide an analyst with a **High-Density Reasoning Trace**, you move from "Documentation Generation" to "Decision Support."

## 4. MVP Core Features
### A. The Mission Terminal UI
*   **Solid Dark Aesthetic:** Background `#0B0E14`, 1px Slate-800 borders, 0px border-radius (sharp corners).
*   **Command Palette (Cmd+K):** A global search bar for "Security Context" to signal pro-user velocity.
*   **Split-Pane Analysis:** Left side shows the control list; right side shows the **Deep Dive Terminal**.

### B. Heuristic Intelligence Engine
*   **Evidence Mapping:** Automatic correlation of artifacts to NIST IDs (e.g., `AC-2`, `AU-6`).
*   **Reviewer Scrutiny Prediction:** LLM-generated questions based on identified gaps (e.g., *"Does the system automatically disable inactive accounts after 30 days?"*).
*   **Recommended Action:** High-utility instructions (e.g., *"Include system-generated logs showing automatic account disabling"*).

### C. The Trust Layer
*   **Reasoning Trace:** A chronological log of how the AI reached its conclusion (e.g., `[EXTRACT] SIEM-Log-Report.pdf`, `[VALIDATE] Periodic Review Found`, `[GAP] Missing Inactivity Logic`).
*   **Data Provenance:** Direct citations to specific lines or pages in the source artifact.

## 5. User Workflow (The Demo "Happy Path")
1.  **Auth:** User enters the Mission Terminal.
2.  **Ingest:** User clicks `[INITIATE PACKAGE SCAN]` and "uploads" a mocked artifact bundle.
3.  **The Magic Moment:** Terminal-style logs scroll (`Scanning... Mapping... Analyzing Scrutiny...`) for 2-3 seconds to build perceived value.
4.  **Triage:** User sees three controls:
    *   `[✓] READY: AU-6`
    *   `[✓] READY: CM-6`
    *   `[!] NEEDS PREP: AC-2`
5.  **Deep Dive:** User clicks `AC-2`. The right pane populates with the **Predicted Question** and **Reasoning Trace**.

## 6. Technical Stack (Hackathon MVP)
*   **Frontend:** Next.js 14+ (App Router), Tailwind CSS, Lucide Icons.
*   **Backend:** FastAPI (Python), Pydantic for schema enforcement.
*   **Heuristics:** Deterministic JSON mapping for the demo; OpenAI/Gemini API for the "Reviewer Question" generation.
*   **Styling:** Monospaced fonts (`JetBrains Mono` or `Inter`) for data fields.

## 7. Success Metrics for Demo
*   **Time to Signal:** < 15 seconds to understand the value proposition.
*   **Technical Credibility:** Does it look like a tool a Palantir or Anduril engineer would use?
*   **The "Why" Test:** Can the user explain *why* a control is flagged without clicking more than once?

## 8. Anti-Goals
*   **No Chatbots:** Do not use a chat bubble. This is a terminal, not a tutor.
*   **No Fluff:** No "Welcome!" or "Hello!" messages. Direct to data.
*   **No Compliance Guarantee:** The UI must always state: `[PREP REVIEW ONLY - NOT AN OFFICIAL ASSESSMENT]`.
