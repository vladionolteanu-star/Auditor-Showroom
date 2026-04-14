"""Deterministic scoring engine — ported from services/scoringEngine.ts."""

from backend.models.schemas import CalculatedScore, WorkspaceInventory


def calculate_score(inventory: WorkspaceInventory) -> CalculatedScore:
    score = 100
    penalties: list[str] = []

    # Dezordine generala: -8 puncte per nivel (0-10)
    if inventory.disorder_score > 0:
        p = round(inventory.disorder_score * 8)
        score -= p
        penalties.append(f"-{p}p: Dezordine nivel {inventory.disorder_score}/10")

    # Obiecte personale pe spatiul de lucru
    if inventory.has_personal_items:
        score -= 15
        penalties.append("-15p: Obiecte personale vizibile")

    # Documente risipite
    if inventory.has_document_clutter:
        score -= 10
        penalties.append("-10p: Documente dezordonate")

    # Suprafata de lucru blocata
    if not inventory.has_clear_workspace:
        score -= 5
        penalties.append("-5p: Suprafata de lucru aglomerata")

    score = max(0, round(score))

    grade = "Excelent"
    color = "text-green-400"

    if score < 95:
        grade = "Bun"
        color = "text-green-400"
    if score < 75:
        grade = "Necesita Atentie"
        color = "text-yellow-400"
    if score < 50:
        grade = "Critic"
        color = "text-red-500"

    return CalculatedScore(
        finalScore=score,
        grade=grade,
        penalties=penalties,
        color=color,
    )
