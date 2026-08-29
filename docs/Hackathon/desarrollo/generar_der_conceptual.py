"""Genera el DER conceptual entregable de Ruta Emocional.

El PDF usa una vista maestra y vistas de relaciones sin exponer tipos SQL,
llaves foráneas, índices ni nombres de tablas. El catálogo completo permanece
en modelo-entidad-relacion-conceptual.md.
"""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Iterable, Sequence

from reportlab.lib import colors
from reportlab.lib.pagesizes import A3, landscape
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


PAGE_SIZE = landscape(A3)
PAGE_WIDTH, PAGE_HEIGHT = PAGE_SIZE

NAVY = colors.HexColor("#142B5F")
BLUE = colors.HexColor("#EAF0FF")
BLUE_LINE = colors.HexColor("#4868B2")
MAGENTA = colors.HexColor("#C93678")
MAGENTA_SOFT = colors.HexColor("#FCE8F2")
YELLOW = colors.HexColor("#FFF4B8")
INK = colors.HexColor("#16213A")
MUTED = colors.HexColor("#526078")
LINE = colors.HexColor("#B9C3D6")
SURFACE = colors.HexColor("#F7F9FC")
WHITE = colors.white


def register_document_fonts() -> tuple[str, str, str]:
    """Registra fuentes TrueType con mapa Unicode para un PDF buscable."""

    candidates = (
        (
            Path("C:/Windows/Fonts/arial.ttf"),
            Path("C:/Windows/Fonts/arialbd.ttf"),
            Path("C:/Windows/Fonts/consolab.ttf"),
        ),
        (
            Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
            Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
            Path("/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"),
        ),
    )

    for regular_path, bold_path, mono_path in candidates:
        if all(path.is_file() for path in (regular_path, bold_path, mono_path)):
            pdfmetrics.registerFont(TTFont("RutaSans", str(regular_path)))
            pdfmetrics.registerFont(TTFont("RutaSans-Bold", str(bold_path)))
            pdfmetrics.registerFont(TTFont("RutaMono-Bold", str(mono_path)))
            return "RutaSans", "RutaSans-Bold", "RutaMono-Bold"

    return "Helvetica", "Helvetica-Bold", "Courier-Bold"


FONT_REGULAR, FONT_BOLD, FONT_MONO_BOLD = register_document_fonts()


ENTITY_GROUPS: Sequence[tuple[str, Sequence[str]]] = (
    ("Identidad y acceso", ("Usuario", "Rol", "Sesión", "Paciente", "Psicólogo")),
    (
        "Directorio profesional",
        (
            "Licencia profesional",
            "Especialidad",
            "Configuración de modalidad",
            "Solicitud de verificación",
            "Decisión de verificación",
            "Regla de disponibilidad",
            "Excepción de disponibilidad",
        ),
    ),
    (
        "Atención, agenda y pagos",
        (
            "Solicitud de atención",
            "Oferta",
            "Relación asistencial",
            "Cita",
            "Evento de cita",
            "Reseña",
            "Pago",
            "Evento de pago",
        ),
    ),
    ("Mensajería", ("Conversación", "Participación", "Mensaje")),
    (
        "Historia clínica",
        (
            "Expediente clínico",
            "Encuentro clínico",
            "Nota clínica",
            "Versión de nota",
            "Evento de nota",
            "Concepto diagnóstico",
            "Diagnóstico clínico",
            "Plan de tratamiento",
            "Objetivo terapéutico",
        ),
    ),
    (
        "Consentimiento y orientación",
        ("Documento de consentimiento", "Decisión de consentimiento", "Evaluación de triaje"),
    ),
    ("Plataforma", ("Evento de auditoría", "Evento de salida", "Registro de idempotencia")),
)


ATTRIBUTES: dict[str, tuple[str, str]] = {
    "Usuario": ("Identificador", "correo, nombre, teléfono, estado, fechas"),
    "Rol": ("Código", "nombre, descripción"),
    "Sesión": ("Identificador", "dispositivo, expiración, revocación, creación"),
    "Paciente": ("Identificador", "fecha de nacimiento, fechas"),
    "Psicólogo": ("Identificador", "verificación, presentación, ubicación, fechas"),
    "Licencia profesional": ("Autoridad + número", "estado, evidencia, verificación, creación"),
    "Especialidad": ("Código", "nombre, vigencia"),
    "Configuración de modalidad": ("Psicólogo + modalidad", "precio, moneda, habilitación"),
    "Solicitud de verificación": ("Identificador", "evidencia privada, fecha de envío"),
    "Decisión de verificación": ("Identificador", "resultado, motivos, fecha"),
    "Regla de disponibilidad": ("Identificador", "día, intervalo, zona, vigencia, estado"),
    "Excepción de disponibilidad": ("Identificador", "intervalo, tipo, motivo"),
    "Solicitud de atención": ("Identificador", "necesidad, modalidad, presupuesto, estado, vigencia"),
    "Oferta": ("Identificador", "importe, mensaje, estado, fechas"),
    "Relación asistencial": ("Identificador", "estado, inicio, finalización"),
    "Cita": ("Identificador", "modalidad, intervalo, zona, estado, motivo"),
    "Evento de cita": ("Identificador", "tipo, transición, intervalo anterior, motivo, fecha"),
    "Reseña": ("Identificador", "puntuación, comentario, fecha"),
    "Pago": ("Identificador", "importe, moneda, método, transacción, estado"),
    "Evento de pago": ("Identificador", "transición, referencia externa, fecha"),
    "Conversación": ("Identificador", "fecha de creación"),
    "Participación": ("Identificador", "ingreso, salida"),
    "Mensaje": ("Identificador", "identificador cliente, tipo, contenido, fechas"),
    "Expediente clínico": ("Identificador", "estado, apertura, cierre"),
    "Encuentro clínico": ("Identificador", "inicio, fin, motivo, creación"),
    "Nota clínica": ("Identificador", "estado, firma, fechas"),
    "Versión de nota": ("Nota + número", "contenido, motivo de enmienda, creación"),
    "Evento de nota": ("Identificador", "tipo, transición, versión, fecha"),
    "Concepto diagnóstico": ("Sistema + código", "nombre"),
    "Diagnóstico clínico": ("Identificador", "estado, observaciones, fecha"),
    "Plan de tratamiento": ("Identificador", "estado, resumen, intervalo, fechas"),
    "Objetivo terapéutico": ("Identificador", "descripción, fecha meta, estado"),
    "Documento de consentimiento": ("Código + versión", "título, huella, publicación"),
    "Decisión de consentimiento": ("Identificador", "decisión, fecha, dirección de red"),
    "Evaluación de triaje": ("Identificador", "reglas, necesidad, recomendación, riesgo, revisión"),
    "Evento de auditoría": ("Identificador", "acción, recurso, petición, metadatos, fecha"),
    "Evento de salida": ("Identificador", "agregado, tipo, disponibilidad, publicación, intentos"),
    "Registro de idempotencia": ("Actor + operación + clave", "huella, resultado, creación, expiración"),
}


# (área, entidad A, relación, entidad B, B por cada A, A por cada B)
RELATIONSHIPS: Sequence[tuple[str, str, str, str, str, str]] = (
    ("Identidad", "Usuario", "tiene asignado", "Rol", "1..N", "0..N"),
    ("Identidad", "Usuario", "mantiene", "Sesión", "0..N", "1"),
    ("Identidad", "Usuario", "se especializa como", "Paciente", "0..1", "1"),
    ("Identidad", "Usuario", "se especializa como", "Psicólogo", "0..1", "1"),
    ("Directorio", "Psicólogo", "acredita", "Licencia profesional", "1..N", "1"),
    ("Directorio", "Psicólogo", "ejerce en", "Especialidad", "0..N", "0..N"),
    ("Directorio", "Psicólogo", "configura", "Configuración de modalidad", "0..N", "1"),
    ("Verificación", "Licencia profesional", "recibe", "Solicitud de verificación", "0..N", "1"),
    ("Verificación", "Solicitud de verificación", "se resuelve mediante", "Decisión de verificación", "0..1", "1"),
    ("Verificación", "Usuario", "revisa", "Decisión de verificación", "0..N", "1"),
    ("Disponibilidad", "Psicólogo", "define", "Regla de disponibilidad", "0..N", "1"),
    ("Disponibilidad", "Psicólogo", "registra", "Excepción de disponibilidad", "0..N", "1"),
    ("Atención", "Paciente", "crea", "Solicitud de atención", "0..N", "1"),
    ("Atención", "Solicitud de atención", "recibe", "Oferta", "0..N", "1"),
    ("Atención", "Psicólogo", "presenta", "Oferta", "0..N", "1"),
    ("Atención", "Paciente", "participa en", "Relación asistencial", "0..N", "1"),
    ("Atención", "Psicólogo", "participa en", "Relación asistencial", "0..N", "1"),
    ("Atención", "Solicitud de atención", "origina", "Relación asistencial", "0..1", "0..1"),
    ("Agenda", "Paciente", "agenda", "Cita", "0..N", "1"),
    ("Agenda", "Psicólogo", "atiende", "Cita", "0..N", "1"),
    ("Agenda", "Solicitud de atención", "origina", "Cita", "0..1", "0..1"),
    ("Agenda", "Relación asistencial", "contextualiza", "Cita", "0..N", "0..1"),
    ("Agenda", "Cita", "registra", "Evento de cita", "1..N", "1"),
    ("Agenda", "Usuario", "ejecuta", "Evento de cita", "0..N", "1"),
    ("Reputación", "Cita", "recibe", "Reseña", "0..1", "1"),
    ("Pagos", "Oferta", "genera", "Pago", "0..1", "1"),
    ("Pagos", "Pago", "registra", "Evento de pago", "0..N", "1"),
    ("Mensajería", "Solicitud de atención", "abre", "Conversación", "0..1", "0..1"),
    ("Mensajería", "Cita", "dispone de", "Conversación", "0..1", "0..1"),
    ("Mensajería", "Conversación", "incluye", "Participación", "2..N", "1"),
    ("Mensajería", "Usuario", "asume", "Participación", "0..N", "1"),
    ("Mensajería", "Participación", "envía", "Mensaje", "0..N", "1"),
    ("Clínica", "Paciente", "posee", "Expediente clínico", "0..1", "1"),
    ("Clínica", "Expediente clínico", "agrupa", "Encuentro clínico", "0..N", "1"),
    ("Clínica", "Psicólogo", "realiza", "Encuentro clínico", "0..N", "1"),
    ("Clínica", "Relación asistencial", "autoriza", "Encuentro clínico", "0..N", "1"),
    ("Clínica", "Cita", "se materializa como", "Encuentro clínico", "0..1", "0..1"),
    ("Clínica", "Encuentro clínico", "contiene", "Nota clínica", "1..N", "1"),
    ("Clínica", "Nota clínica", "conserva", "Versión de nota", "1..N", "1"),
    ("Clínica", "Usuario", "redacta", "Versión de nota", "0..N", "1"),
    ("Clínica", "Nota clínica", "registra", "Evento de nota", "1..N", "1"),
    ("Clínica", "Usuario", "ejecuta", "Evento de nota", "0..N", "1"),
    ("Clínica", "Expediente clínico", "contiene", "Diagnóstico clínico", "0..N", "1"),
    ("Clínica", "Concepto diagnóstico", "clasifica", "Diagnóstico clínico", "0..N", "1"),
    ("Clínica", "Psicólogo", "formula", "Diagnóstico clínico", "0..N", "1"),
    ("Clínica", "Encuentro clínico", "sustenta", "Diagnóstico clínico", "0..N", "0..1"),
    ("Clínica", "Expediente clínico", "organiza", "Plan de tratamiento", "0..N", "1"),
    ("Clínica", "Psicólogo", "dirige", "Plan de tratamiento", "0..N", "1"),
    ("Clínica", "Plan de tratamiento", "define", "Objetivo terapéutico", "1..N", "1"),
    ("Consentimiento", "Paciente", "expresa", "Decisión de consentimiento", "0..N", "1"),
    ("Consentimiento", "Documento de consentimiento", "fundamenta", "Decisión de consentimiento", "0..N", "1"),
    ("Orientación", "Paciente", "recibe", "Evaluación de triaje", "0..N", "1"),
    ("Orientación", "Psicólogo", "revisa", "Evaluación de triaje", "0..N", "0..1"),
    ("Orientación", "Evaluación de triaje", "informa", "Solicitud de atención", "0..1", "0..N"),
    ("Plataforma", "Usuario", "origina", "Evento de auditoría", "0..N", "0..1"),
    ("Plataforma", "Usuario", "delimita", "Registro de idempotencia", "0..N", "1"),
)


BRIDGES: Sequence[tuple[str, str]] = (
    ("UserRole", "Usuario tiene asignado Rol"),
    ("PsychologistSpecialty", "Psicólogo ejerce en Especialidad"),
    ("CareRelationshipSource", "Solicitud origina Relación asistencial"),
    ("AppointmentRequest", "Solicitud origina Cita"),
    ("AppointmentCareRelationship", "Relación asistencial contextualiza Cita"),
    ("ClinicalEncounterAppointment", "Cita se materializa como Encuentro"),
    ("ClinicalDiagnosisSource", "Encuentro sustenta Diagnóstico"),
    ("RequestConversation", "Solicitud abre Conversación"),
    ("AppointmentConversation", "Cita dispone de Conversación"),
    ("RequestTriageAssessment", "Evaluación de triaje informa Solicitud"),
)


def wrap_lines(text: str, width: float, font: str, size: float) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if not current or stringWidth(candidate, font, size) <= width:
            current = candidate
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def draw_centered_lines(
    pdf: canvas.Canvas,
    lines: Iterable[str],
    center_x: float,
    center_y: float,
    font: str,
    size: float,
    leading: float,
    color: colors.Color = INK,
) -> None:
    values = list(lines)
    baseline = center_y + ((len(values) - 1) * leading / 2) - size * 0.35
    pdf.setFillColor(color)
    pdf.setFont(font, size)
    for index, value in enumerate(values):
        pdf.drawCentredString(center_x, baseline - index * leading, value)


def draw_header(pdf: canvas.Canvas, title: str, subtitle: str, page_number: int) -> None:
    pdf.setFillColor(NAVY)
    pdf.rect(0, PAGE_HEIGHT - 70, PAGE_WIDTH, 70, fill=1, stroke=0)
    pdf.setFillColor(WHITE)
    pdf.setFont(FONT_BOLD, 20)
    pdf.drawString(32, PAGE_HEIGHT - 32, title)
    pdf.setFont(FONT_REGULAR, 9)
    pdf.drawString(32, PAGE_HEIGHT - 50, subtitle)
    pdf.setFont(FONT_BOLD, 9)
    pdf.drawRightString(PAGE_WIDTH - 32, PAGE_HEIGHT - 42, f"Ruta Emocional · {page_number}")


def draw_footer(pdf: canvas.Canvas) -> None:
    pdf.setStrokeColor(LINE)
    pdf.line(32, 27, PAGE_WIDTH - 32, 27)
    pdf.setFont(FONT_REGULAR, 7.5)
    pdf.setFillColor(MUTED)
    pdf.drawString(32, 15, "DER conceptual: sin tipos SQL, llaves foráneas, índices ni detalles del motor.")
    pdf.drawRightString(PAGE_WIDTH - 32, 15, "Fuente canónica: schema.prisma · 48 modelos · 18 migraciones")


def draw_entity(pdf: canvas.Canvas, x: float, y: float, width: float, height: float, name: str) -> None:
    pdf.setFillColor(BLUE)
    pdf.setStrokeColor(BLUE_LINE)
    pdf.setLineWidth(1.2)
    pdf.rect(x, y, width, height, fill=1, stroke=1)
    lines = wrap_lines(name.upper(), width - 12, FONT_BOLD, 8.5)
    draw_centered_lines(pdf, lines[:3], x + width / 2, y + height / 2, FONT_BOLD, 8.5, 10)


def draw_relationship_diamond(
    pdf: canvas.Canvas,
    center_x: float,
    center_y: float,
    width: float,
    height: float,
    label: str,
) -> None:
    points = (
        center_x,
        center_y + height / 2,
        center_x + width / 2,
        center_y,
        center_x,
        center_y - height / 2,
        center_x - width / 2,
        center_y,
    )
    path = pdf.beginPath()
    path.moveTo(points[0], points[1])
    path.lineTo(points[2], points[3])
    path.lineTo(points[4], points[5])
    path.lineTo(points[6], points[7])
    path.close()
    pdf.setFillColor(MAGENTA_SOFT)
    pdf.setStrokeColor(MAGENTA)
    pdf.setLineWidth(1.1)
    pdf.drawPath(path, fill=1, stroke=1)
    lines = wrap_lines(label, width * 0.58, FONT_BOLD, 6.8)
    draw_centered_lines(pdf, lines[:3], center_x, center_y, FONT_BOLD, 6.8, 7.6, MAGENTA)


def draw_attribute_legend(pdf: canvas.Canvas, x: float, y: float) -> None:
    pdf.setFillColor(YELLOW)
    pdf.setStrokeColor(colors.HexColor("#C9A70B"))
    pdf.ellipse(x, y, x + 130, y + 34, fill=1, stroke=1)
    pdf.setFillColor(INK)
    pdf.setFont(FONT_BOLD, 8)
    pdf.drawCentredString(x + 65, y + 19, "Identificador")
    pdf.setLineWidth(0.7)
    pdf.line(x + 37, y + 15, x + 93, y + 15)


def draw_relation_row(
    pdf: canvas.Canvas,
    x: float,
    y: float,
    width: float,
    relationship: tuple[str, str, str, str, str, str],
) -> None:
    area, entity_a, verb, entity_b, b_per_a, a_per_b = relationship
    entity_width = 130
    entity_height = 42
    diamond_width = 102
    diamond_height = 54
    entity_y = y + 7
    left_x = x
    right_x = x + width - entity_width
    center_x = x + width / 2
    center_y = entity_y + entity_height / 2

    draw_entity(pdf, left_x, entity_y, entity_width, entity_height, entity_a)
    draw_relationship_diamond(pdf, center_x, center_y, diamond_width, diamond_height, verb)
    draw_entity(pdf, right_x, entity_y, entity_width, entity_height, entity_b)

    pdf.setStrokeColor(LINE)
    pdf.setLineWidth(1)
    pdf.line(left_x + entity_width, center_y, center_x - diamond_width / 2, center_y)
    pdf.line(center_x + diamond_width / 2, center_y, right_x, center_y)

    pdf.setFillColor(NAVY)
    pdf.setFont(FONT_BOLD, 7.5)
    pdf.drawString(left_x + entity_width + 6, center_y + 5, a_per_b)
    pdf.drawRightString(right_x - 6, center_y + 5, b_per_a)
    pdf.setFillColor(MUTED)
    pdf.setFont(FONT_REGULAR, 6.5)
    pdf.drawCentredString(center_x, y - 6, area)


def draw_cover(pdf: canvas.Canvas, page_number: int) -> None:
    draw_header(
        pdf,
        "Modelo entidad-relación conceptual",
        "Entidades, relaciones, atributos, participación y cardinalidad del dominio",
        page_number,
    )
    pdf.setFillColor(INK)
    pdf.setFont(FONT_BOLD, 30)
    pdf.drawString(50, PAGE_HEIGHT - 145, "Ruta Emocional")
    pdf.setFont(FONT_REGULAR, 14)
    pdf.setFillColor(MUTED)
    pdf.drawString(50, PAGE_HEIGHT - 172, "Entregable Aficionado · Desarrollo · Hackathon Nicaragua 2026")

    summary = (
        ("38", "entidades conceptuales"),
        ("56", "relaciones semánticas"),
        ("10", "tablas puente reinterpretadas"),
        ("48", "modelos Prisma trazados"),
    )
    card_width = 250
    gap = 22
    start_x = 50
    top_y = PAGE_HEIGHT - 285
    for index, (value, label) in enumerate(summary):
        x = start_x + index * (card_width + gap)
        pdf.setFillColor(SURFACE)
        pdf.setStrokeColor(LINE)
        pdf.roundRect(x, top_y, card_width, 88, 8, fill=1, stroke=1)
        pdf.setFillColor(NAVY)
        pdf.setFont(FONT_BOLD, 25)
        pdf.drawString(x + 18, top_y + 47, value)
        pdf.setFillColor(MUTED)
        pdf.setFont(FONT_REGULAR, 9)
        pdf.drawString(x + 18, top_y + 24, label)

    pdf.setFillColor(INK)
    pdf.setFont(FONT_BOLD, 15)
    pdf.drawString(50, PAGE_HEIGHT - 360, "Convención")
    draw_entity(pdf, 55, PAGE_HEIGHT - 450, 155, 50, "Entidad")
    draw_relationship_diamond(pdf, 345, PAGE_HEIGHT - 425, 135, 68, "relación")
    draw_attribute_legend(pdf, 465, PAGE_HEIGHT - 442)
    pdf.setStrokeColor(LINE)
    pdf.line(210, PAGE_HEIGHT - 425, 277, PAGE_HEIGHT - 425)
    pdf.line(413, PAGE_HEIGHT - 425, 465, PAGE_HEIGHT - 425)
    pdf.setFillColor(NAVY)
    pdf.setFont(FONT_BOLD, 8)
    pdf.drawString(220, PAGE_HEIGHT - 416, "(0..N)")
    pdf.drawString(420, PAGE_HEIGHT - 416, "(1)")

    notes = (
        "La cardinalidad situada junto a una entidad expresa cuántas instancias de esa entidad pueden asociarse con una instancia del extremo opuesto.",
        "La participación mínima cero es opcional; mínima uno es obligatoria.",
        "El identificador conceptual no equivale a exponer una PK física.",
        "Los atributos completos y la evidencia de 3FN acompañan este PDF en la documentación técnica.",
    )
    y = PAGE_HEIGHT - 505
    for note in notes:
        pdf.setFillColor(MAGENTA)
        pdf.circle(59, y + 3, 2.3, fill=1, stroke=0)
        pdf.setFillColor(INK)
        pdf.setFont(FONT_REGULAR, 9.5)
        for line in wrap_lines(note, PAGE_WIDTH - 125, FONT_REGULAR, 9.5):
            pdf.drawString(70, y, line)
            y -= 13
        y -= 8

    pdf.setFillColor(SURFACE)
    pdf.setStrokeColor(LINE)
    pdf.roundRect(50, 75, PAGE_WIDTH - 100, 110, 8, fill=1, stroke=1)
    pdf.setFillColor(NAVY)
    pdf.setFont(FONT_BOLD, 11)
    pdf.drawString(68, 157, "Exclusiones deliberadas")
    exclusion = (
        "No aparecen tipos SQL, tamaños, columnas foráneas, índices, triggers, nombres de tablas, acciones ON DELETE ni detalles de PostgreSQL/Prisma. "
        "Esos elementos pertenecen al modelo relacional o físico, no al DER conceptual."
    )
    pdf.setFillColor(INK)
    pdf.setFont(FONT_REGULAR, 9.5)
    yy = 137
    for line in wrap_lines(exclusion, PAGE_WIDTH - 140, FONT_REGULAR, 9.5):
        pdf.drawString(68, yy, line)
        yy -= 14
    draw_footer(pdf)


def draw_master_map(pdf: canvas.Canvas, page_number: int) -> None:
    draw_header(
        pdf,
        "Vista maestra de entidades",
        "Cobertura completa organizada por áreas del dominio; las relaciones se detallan en las páginas siguientes",
        page_number,
    )
    columns = 4
    gap_x = 18
    gap_y = 18
    margin_x = 32
    top = PAGE_HEIGHT - 88
    available_width = PAGE_WIDTH - margin_x * 2
    group_width = (available_width - gap_x * (columns - 1)) / columns
    positions = (
        (0, 0), (1, 0), (2, 0), (3, 0),
        (0, 1), (1, 1), (2, 1),
    )
    row_tops = (top, top - 360)
    for index, (title, entities) in enumerate(ENTITY_GROUPS):
        column, row = positions[index]
        x = margin_x + column * (group_width + gap_x)
        y_top = row_tops[row]
        height = 46 + len(entities) * 31
        y = y_top - height
        pdf.setFillColor(SURFACE)
        pdf.setStrokeColor(LINE)
        pdf.roundRect(x, y, group_width, height, 8, fill=1, stroke=1)
        pdf.setFillColor(NAVY)
        pdf.setFont(FONT_BOLD, 10.5)
        pdf.drawString(x + 12, y_top - 20, title)
        entity_y = y_top - 55
        for entity in entities:
            draw_entity(pdf, x + 12, entity_y, group_width - 24, 26, entity)
            entity_y -= 31
    draw_footer(pdf)


def draw_relation_pages(pdf: canvas.Canvas, start_page: int) -> int:
    chunks = (
        ("Relaciones: identidad y directorio", RELATIONSHIPS[0:12]),
        ("Relaciones: atención, agenda y pagos", RELATIONSHIPS[12:27]),
        ("Relaciones: mensajería e historia clínica I", RELATIONSHIPS[27:42]),
        ("Relaciones: historia clínica II, consentimiento y orientación", RELATIONSHIPS[42:54]),
        ("Relaciones: plataforma", RELATIONSHIPS[54:]),
    )
    page_number = start_page
    for title, relationships in chunks:
        draw_header(
            pdf,
            title,
            "Rectángulo = entidad · rombo = relación · cardinalidad junto a cada extremo",
            page_number,
        )
        rows_per_column = 8
        column_width = (PAGE_WIDTH - 88) / 2
        row_height = 85
        top_y = PAGE_HEIGHT - 155
        for index, relationship in enumerate(relationships):
            column = index // rows_per_column
            row = index % rows_per_column
            x = 32 + column * (column_width + 24)
            y = top_y - row * row_height
            draw_relation_row(pdf, x, y, column_width, relationship)
        if len(relationships) <= 2:
            pdf.setFillColor(SURFACE)
            pdf.setStrokeColor(LINE)
            pdf.roundRect(32, 150, PAGE_WIDTH - 64, 360, 8, fill=1, stroke=1)
            pdf.setFillColor(NAVY)
            pdf.setFont(FONT_BOLD, 13)
            pdf.drawString(52, 475, "Evento de salida")
            pdf.setFillColor(INK)
            pdf.setFont(FONT_REGULAR, 10)
            text = (
                "Se mantiene como entidad técnica independiente. Su referencia a agregado es polimórfica y no crea una relación de dominio única. "
                "Dibujar enlaces a todas las entidades sería inventar asociaciones que no existen."
            )
            yy = 446
            for line in wrap_lines(text, PAGE_WIDTH - 110, FONT_REGULAR, 10):
                pdf.drawString(52, yy, line)
                yy -= 15
        draw_footer(pdf)
        pdf.showPage()
        page_number += 1
    return page_number


def draw_attribute_catalog(pdf: canvas.Canvas, page_number: int) -> int:
    items = list(ATTRIBUTES.items())
    chunks = (items[:19], items[19:])
    for chunk_index, chunk in enumerate(chunks):
        draw_header(
            pdf,
            f"Atributos conceptuales por entidad {chunk_index + 1}/2",
            "Rectángulo = entidad · óvalo amarillo subrayado = identificador · óvalo gris = atributos significativos",
            page_number,
        )
        left = 32.0
        top = PAGE_HEIGHT - 102
        row_height = 34
        identifier_width = 210
        entity_width = 205
        gap = 24
        identifier_x = left
        entity_x = identifier_x + identifier_width + gap
        attributes_x = entity_x + entity_width + gap
        attributes_width = PAGE_WIDTH - left - attributes_x

        for index, (entity, (identifier, attributes)) in enumerate(chunk):
            row_top = top - index * row_height
            center_y = row_top - row_height / 2
            shape_height = 25

            if index % 2 == 1:
                pdf.setFillColor(SURFACE)
                pdf.setStrokeColor(SURFACE)
                pdf.rect(left, row_top - row_height, PAGE_WIDTH - 2 * left, row_height, fill=1, stroke=0)

            pdf.setStrokeColor(LINE)
            pdf.setLineWidth(0.9)
            pdf.line(identifier_x + identifier_width, center_y, entity_x, center_y)
            pdf.line(entity_x + entity_width, center_y, attributes_x, center_y)

            pdf.setFillColor(YELLOW)
            pdf.setStrokeColor(colors.HexColor("#C9A70B"))
            pdf.ellipse(
                identifier_x,
                center_y - shape_height / 2,
                identifier_x + identifier_width,
                center_y + shape_height / 2,
                fill=1,
                stroke=1,
            )
            identifier_lines = wrap_lines(identifier, identifier_width - 22, FONT_BOLD, 7.4)[:2]
            draw_centered_lines(
                pdf,
                identifier_lines,
                identifier_x + identifier_width / 2,
                center_y,
                FONT_BOLD,
                7.4,
                8.2,
            )
            underline_width = min(stringWidth(identifier_lines[-1], FONT_BOLD, 7.4), identifier_width - 28)
            pdf.setStrokeColor(INK)
            pdf.setLineWidth(0.55)
            pdf.line(
                identifier_x + (identifier_width - underline_width) / 2,
                center_y - 5.2,
                identifier_x + (identifier_width + underline_width) / 2,
                center_y - 5.2,
            )

            draw_entity(
                pdf,
                entity_x,
                center_y - shape_height / 2,
                entity_width,
                shape_height,
                entity,
            )

            pdf.setFillColor(WHITE)
            pdf.setStrokeColor(LINE)
            pdf.ellipse(
                attributes_x,
                center_y - shape_height / 2,
                attributes_x + attributes_width,
                center_y + shape_height / 2,
                fill=1,
                stroke=1,
            )
            attribute_lines = wrap_lines(attributes, attributes_width - 24, FONT_REGULAR, 7.4)[:2]
            draw_centered_lines(
                pdf,
                attribute_lines,
                attributes_x + attributes_width / 2,
                center_y,
                FONT_REGULAR,
                7.4,
                8.2,
            )
        draw_footer(pdf)
        pdf.showPage()
        page_number += 1
    return page_number


def draw_bridge_traceability(pdf: canvas.Canvas, page_number: int) -> None:
    draw_header(
        pdf,
        "Trazabilidad sin confundir modelos",
        "Diez tablas relacionales se representan como relaciones conceptuales, no como entidades artificiales",
        page_number,
    )
    left = 55
    top = PAGE_HEIGHT - 115
    table_width = PAGE_WIDTH - 110
    row_height = 48
    first_width = 330
    second_width = table_width - first_width
    pdf.setFillColor(NAVY)
    pdf.rect(left, top - 34, table_width, 34, fill=1, stroke=0)
    pdf.setFillColor(WHITE)
    pdf.setFont(FONT_BOLD, 10)
    pdf.drawString(left + 12, top - 22, "Implementación relacional")
    pdf.drawString(left + first_width + 12, top - 22, "Significado en el DER conceptual")
    y = top - 34
    for index, (model, meaning) in enumerate(BRIDGES):
        y -= row_height
        pdf.setFillColor(WHITE if index % 2 == 0 else SURFACE)
        pdf.setStrokeColor(LINE)
        pdf.rect(left, y, table_width, row_height, fill=1, stroke=1)
        pdf.setFillColor(INK)
        pdf.setFont(FONT_MONO_BOLD, 9)
        pdf.drawString(left + 12, y + 18, model)
        pdf.setFont(FONT_REGULAR, 9)
        pdf.drawString(left + first_width + 12, y + 18, meaning)

    pdf.setFillColor(YELLOW)
    pdf.setStrokeColor(colors.HexColor("#C9A70B"))
    pdf.roundRect(left, 88, table_width, 76, 8, fill=1, stroke=1)
    pdf.setFillColor(INK)
    pdf.setFont(FONT_BOLD, 10)
    pdf.drawString(left + 15, 137, "Conclusión")
    conclusion = (
        "La normalización 3FN se demuestra en el modelo relacional. El DER conserva la semántica: una tabla puente sin identidad propia vuelve a ser un rombo de relación."
    )
    pdf.setFont(FONT_REGULAR, 9)
    yy = 118
    for line in wrap_lines(conclusion, table_width - 30, FONT_REGULAR, 9):
        pdf.drawString(left + 15, yy, line)
        yy -= 13
    draw_footer(pdf)


def validate_model() -> None:
    entities = {entity for _, group in ENTITY_GROUPS for entity in group}
    if len(entities) != 38:
        raise ValueError(f"Se esperaban 38 entidades conceptuales y se obtuvieron {len(entities)}")
    if set(ATTRIBUTES) != entities:
        missing = sorted(entities - set(ATTRIBUTES))
        extra = sorted(set(ATTRIBUTES) - entities)
        raise ValueError(f"Catálogo inconsistente. Faltan={missing}; sobran={extra}")
    if len(RELATIONSHIPS) != 56:
        raise ValueError(f"Se esperaban 56 relaciones y se obtuvieron {len(RELATIONSHIPS)}")
    referenced = {item for relationship in RELATIONSHIPS for item in (relationship[1], relationship[3])}
    if not referenced.issubset(entities):
        raise ValueError(f"Relaciones con entidades desconocidas: {sorted(referenced - entities)}")
    if len(BRIDGES) != 10:
        raise ValueError("La trazabilidad debe contener las 10 tablas de asociación")


def generate(output: Path) -> None:
    validate_model()
    output.parent.mkdir(parents=True, exist_ok=True)
    pdf = canvas.Canvas(str(output), pagesize=PAGE_SIZE, pageCompression=1)
    pdf.setTitle("Modelo entidad-relación conceptual - Ruta Emocional")
    pdf.setAuthor("Equipo Ruta Emocional")
    pdf.setSubject("Hackathon Nicaragua 2026 - Aficionado/Desarrollo")

    page_number = 1
    draw_cover(pdf, page_number)
    pdf.showPage()
    page_number += 1
    draw_master_map(pdf, page_number)
    pdf.showPage()
    page_number += 1
    page_number = draw_relation_pages(pdf, page_number)
    page_number = draw_attribute_catalog(pdf, page_number)
    draw_bridge_traceability(pdf, page_number)
    pdf.save()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("output", type=Path)
    arguments = parser.parse_args()
    generate(arguments.output.resolve())


if __name__ == "__main__":
    main()
