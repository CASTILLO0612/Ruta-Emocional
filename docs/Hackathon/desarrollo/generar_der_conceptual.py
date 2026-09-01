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


def register_document_fonts() -> tuple[str, str]:
    """Registra fuentes TrueType con mapa Unicode para un PDF buscable."""

    candidates = (
        (
            Path("C:/Windows/Fonts/arial.ttf"),
            Path("C:/Windows/Fonts/arialbd.ttf"),
        ),
        (
            Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
            Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
        ),
    )

    for regular_path, bold_path in candidates:
        if all(path.is_file() for path in (regular_path, bold_path)):
            pdfmetrics.registerFont(TTFont("RutaSans", str(regular_path)))
            pdfmetrics.registerFont(TTFont("RutaSans-Bold", str(bold_path)))
            return "RutaSans", "RutaSans-Bold"

    return "Helvetica", "Helvetica-Bold"


FONT_REGULAR, FONT_BOLD = register_document_fonts()


ENTITY_GROUPS: Sequence[tuple[str, Sequence[str]]] = (
    ("Identidad y acceso", ("Usuario", "Rol", "Sesión", "Paciente", "Psicólogo")),
    (
        "Directorio profesional",
        (
            "Licencia profesional",
            "Especialidad",
            "Modalidad de atención",
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
    ("Mensajería", ("Conversación", "Mensaje")),
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
        "Consentimiento, orientación y privacidad",
        (
            "Documento de consentimiento",
            "Decisión de consentimiento",
            "Evaluación de triaje",
            "Regla de triaje",
            "Solicitud de eliminación",
        ),
    ),
    ("Plataforma", ("Evento de auditoría", "Evento de salida", "Registro de idempotencia")),
)


ATTRIBUTES: dict[str, tuple[str, str]] = {
    "Usuario": ("Identificador", "correo, nombre visible, teléfono, estado, creación"),
    "Rol": ("Código", "nombre, descripción"),
    "Sesión": ("Identificador", "dispositivo, expiración, revocación, creación"),
    "Paciente": ("Identificador", "fecha de nacimiento, creación, actualización"),
    "Psicólogo": (
        "Identificador",
        "estado de verificación, presentación, ubicación pública aproximada, creación, actualización",
    ),
    "Licencia profesional": (
        "Autoridad + número",
        "estado, evidencia referenciada, verificada en, creación",
    ),
    "Especialidad": ("Código", "nombre, estado de catálogo, creación, actualización"),
    "Modalidad de atención": ("Código", "nombre, estado de catálogo"),
    "Solicitud de verificación": ("Identificador", "evidencia privada, fecha de envío"),
    "Decisión de verificación": (
        "Identificador",
        "resultado, motivo público, motivo interno, decidida en",
    ),
    "Regla de disponibilidad": (
        "Identificador",
        "día, hora inicial, hora final, zona horaria IANA, vigente desde, vigente hasta, estado",
    ),
    "Excepción de disponibilidad": ("Identificador", "inicio, fin, tipo, motivo"),
    "Solicitud de atención": (
        "Identificador",
        "necesidad, presupuesto, moneda, estado, programada para, vence en, ubicación temporal, ubicación vence en",
    ),
    "Oferta": ("Identificador", "importe, mensaje, estado, creación, actualización"),
    "Relación asistencial": ("Identificador", "estado, iniciada en, finalizada en"),
    "Cita": (
        "Identificador",
        "inicio, fin, zona horaria IANA, estado, motivo de cancelación, creación",
    ),
    "Evento de cita": (
        "Identificador",
        "tipo, estado anterior, estado nuevo, inicio anterior, fin anterior, motivo, ocurrencia, origen",
    ),
    "Reseña": ("Identificador", "puntuación, comentario, creación"),
    "Pago": ("Identificador", "importe, moneda, método, referencia de transacción, estado, creación"),
    "Evento de pago": (
        "Identificador",
        "estado anterior, estado nuevo, referencia externa, ocurrencia, origen",
    ),
    "Conversación": ("Identificador", "fecha de creación"),
    "Mensaje": (
        "Identificador",
        "identificador de cliente, tipo, contenido, enviado en, editado en, origen",
    ),
    "Expediente clínico": ("Identificador", "estado, abierto en, cerrado en"),
    "Encuentro clínico": ("Identificador", "inicio, fin, motivo, creación"),
    "Nota clínica": ("Identificador", "estado, firmada en, creación, actualización"),
    "Versión de nota": ("Nota + número", "contenido, motivo de enmienda, creación"),
    "Evento de nota": ("Identificador", "tipo, estado anterior, estado nuevo, ocurrencia"),
    "Concepto diagnóstico": ("Sistema + código", "nombre"),
    "Diagnóstico clínico": ("Identificador", "estado, observaciones, diagnosticado en"),
    "Plan de tratamiento": (
        "Identificador",
        "estado, resumen, inicio, fin, creación, actualización",
    ),
    "Objetivo terapéutico": ("Identificador", "descripción, fecha meta, estado"),
    "Documento de consentimiento": (
        "Código + versión",
        "título, huella del contenido, alcance, publicación",
    ),
    "Decisión de consentimiento": ("Identificador", "decisión, ocurrencia, dirección de red"),
    "Evaluación de triaje": (
        "Identificador",
        "proveedor, modelo, versión del evaluador, necesidad, orientación, resultado del proveedor, país, riesgo, revisada en, creación",
    ),
    "Regla de triaje": (
        "Código + versión",
        "nombre, nivel de riesgo, vigente desde, vigente hasta, estado",
    ),
    "Solicitud de eliminación": (
        "Identificador",
        "estado, versión de política, solicitada en, vence en, resuelta en, resultado",
    ),
    "Evento de auditoría": (
        "Identificador",
        "acción, recurso, resultado, correlación, dirección de red, metadatos, ocurrencia, origen",
    ),
    "Evento de salida": (
        "Identificador",
        "agregado, tipo, ocurrencia, disponible en, publicada en, intentos, último error",
    ),
    "Registro de idempotencia": (
        "Usuario + operación + clave",
        "huella de petición, recurso resultante, creación, expiración",
    ),
}


# (área, entidad A, relación, entidad B, B por cada A, A por cada B)
RELATIONSHIPS: Sequence[tuple[str, str, str, str, str, str]] = (
    ("Identidad", "Usuario", "tiene asignado", "Rol", "1..N", "0..N"),
    ("Identidad", "Usuario", "mantiene", "Sesión", "0..N", "1"),
    ("Directorio", "Psicólogo", "acredita", "Licencia profesional", "0..N", "1"),
    ("Directorio", "Psicólogo", "ejerce en", "Especialidad", "0..N", "0..N"),
    ("Directorio", "Psicólogo", "ofrece", "Modalidad de atención", "0..N", "0..N"),
    ("Verificación", "Licencia profesional", "recibe", "Solicitud de verificación", "0..N", "1"),
    ("Verificación", "Solicitud de verificación", "se resuelve mediante", "Decisión de verificación", "0..1", "1"),
    ("Verificación", "Usuario", "revisa", "Decisión de verificación", "0..N", "1"),
    ("Disponibilidad", "Psicólogo", "define", "Regla de disponibilidad", "0..N", "1"),
    ("Disponibilidad", "Psicólogo", "registra", "Excepción de disponibilidad", "0..N", "1"),
    ("Atención", "Paciente", "crea", "Solicitud de atención", "0..N", "1"),
    ("Atención", "Solicitud de atención", "requiere", "Modalidad de atención", "1", "0..N"),
    ("Atención", "Solicitud de atención", "recibe", "Oferta", "0..N", "1"),
    ("Atención", "Psicólogo", "presenta", "Oferta", "0..N", "1"),
    ("Atención", "Oferta", "origina", "Relación asistencial", "0..1", "1"),
    ("Atención", "Paciente", "participa en", "Relación asistencial", "0..N", "1"),
    ("Atención", "Psicólogo", "participa en", "Relación asistencial", "0..N", "1"),
    ("Agenda", "Paciente", "agenda", "Cita", "0..N", "1"),
    ("Agenda", "Psicólogo", "atiende", "Cita", "0..N", "1"),
    ("Agenda", "Relación asistencial", "agenda", "Cita", "0..N", "1"),
    ("Agenda", "Cita", "usa", "Modalidad de atención", "1", "0..N"),
    ("Agenda", "Cita", "registra", "Evento de cita", "1..N", "1"),
    ("Agenda", "Usuario", "ejecuta", "Evento de cita", "0..N", "0..1"),
    ("Reputación", "Cita", "recibe", "Reseña", "0..1", "1"),
    ("Reputación", "Paciente", "escribe", "Reseña", "0..N", "1"),
    ("Pagos", "Cita", "genera", "Pago", "0..N", "1"),
    ("Pagos", "Pago", "registra", "Evento de pago", "1..N", "1"),
    ("Mensajería", "Relación asistencial", "mantiene", "Conversación", "1", "1"),
    ("Mensajería", "Usuario", "participa en", "Conversación", "0..N", "2"),
    ("Mensajería", "Conversación", "contiene", "Mensaje", "0..N", "1"),
    ("Mensajería", "Usuario", "envía", "Mensaje", "0..N", "0..1"),
    ("Clínica I", "Paciente", "posee", "Expediente clínico", "0..1", "1"),
    ("Clínica I", "Expediente clínico", "agrupa", "Encuentro clínico", "0..N", "1"),
    ("Clínica I", "Psicólogo", "realiza", "Encuentro clínico", "0..N", "1"),
    ("Clínica I", "Relación asistencial", "autoriza", "Encuentro clínico", "0..N", "1"),
    ("Clínica I", "Cita", "se materializa como", "Encuentro clínico", "0..1", "0..1"),
    ("Clínica I", "Encuentro clínico", "contiene", "Nota clínica", "1..N", "1"),
    ("Clínica I", "Nota clínica", "conserva", "Versión de nota", "1..N", "1"),
    ("Clínica I", "Psicólogo", "redacta", "Versión de nota", "0..N", "1"),
    ("Clínica I", "Nota clínica", "registra", "Evento de nota", "1..N", "1"),
    ("Clínica I", "Psicólogo", "ejecuta", "Evento de nota", "0..N", "1"),
    ("Clínica I", "Versión de nota", "es afectada por", "Evento de nota", "1..N", "1"),
    ("Clínica II", "Expediente clínico", "contiene", "Diagnóstico clínico", "0..N", "1"),
    ("Clínica II", "Concepto diagnóstico", "clasifica", "Diagnóstico clínico", "0..N", "1"),
    ("Clínica II", "Psicólogo", "formula", "Diagnóstico clínico", "0..N", "1"),
    ("Clínica II", "Encuentro clínico", "sustenta", "Diagnóstico clínico", "0..N", "0..1"),
    ("Clínica II", "Relación asistencial", "contextualiza", "Diagnóstico clínico", "0..N", "1"),
    ("Clínica II", "Expediente clínico", "organiza", "Plan de tratamiento", "0..N", "1"),
    ("Clínica II", "Psicólogo", "dirige", "Plan de tratamiento", "0..N", "1"),
    ("Clínica II", "Relación asistencial", "contextualiza", "Plan de tratamiento", "0..N", "1"),
    ("Clínica II", "Plan de tratamiento", "aborda", "Diagnóstico clínico", "0..N", "0..N"),
    ("Clínica II", "Plan de tratamiento", "define", "Objetivo terapéutico", "1..N", "1"),
    ("Consentimiento", "Paciente", "expresa", "Decisión de consentimiento", "0..N", "1"),
    ("Consentimiento", "Documento de consentimiento", "fundamenta", "Decisión de consentimiento", "0..N", "1"),
    ("Consentimiento", "Relación asistencial", "contextualiza", "Decisión de consentimiento", "0..N", "0..1"),
    ("Consentimiento", "Decisión de consentimiento", "autoriza", "Evaluación de triaje", "0..N", "1"),
    ("Orientación", "Paciente", "recibe", "Evaluación de triaje", "0..N", "1"),
    ("Orientación", "Psicólogo", "revisa", "Evaluación de triaje", "0..N", "0..1"),
    ("Orientación", "Evaluación de triaje", "informa", "Solicitud de atención", "0..1", "0..N"),
    ("Orientación", "Relación asistencial", "conserva como origen", "Evaluación de triaje", "0..1", "0..1"),
    ("Orientación", "Evaluación de triaje", "recomienda", "Modalidad de atención", "0..N", "0..N"),
    ("Orientación", "Evaluación de triaje", "aplica", "Regla de triaje", "1..N", "0..N"),
    ("Privacidad", "Decisión de consentimiento", "retira autorización de", "Evaluación de triaje", "0..1", "0..1"),
    ("Privacidad", "Paciente", "solicita", "Solicitud de eliminación", "0..N", "1"),
    ("Privacidad", "Evaluación de triaje", "es objeto de", "Solicitud de eliminación", "0..1", "1"),
    ("Privacidad", "Usuario", "resuelve", "Solicitud de eliminación", "0..N", "0..1"),
    ("Plataforma", "Usuario", "origina", "Evento de auditoría", "0..N", "0..1"),
    ("Plataforma", "Usuario", "delimita", "Registro de idempotencia", "0..N", "1"),
)


# Una jerarquía EER, no dos relaciones 1:1 ordinarias.
SPECIALIZATION = {
    "supertype": "Usuario",
    "subtypes": ("Paciente", "Psicólogo"),
    "completeness": "parcial",
    "disjointness": "superpuesta",
}


RELATIONSHIP_ATTRIBUTES: dict[tuple[str, str, str], tuple[str, ...]] = {
    ("Usuario", "tiene asignado", "Rol"): (
        "asignada en",
        "finalizada en",
        "estado",
    ),
    ("Psicólogo", "ejerce en", "Especialidad"): ("es principal",),
    ("Psicólogo", "ofrece", "Modalidad de atención"): (
        "precio por hora",
        "moneda",
        "habilitación",
    ),
    ("Usuario", "participa en", "Conversación"): ("ingreso", "salida"),
    ("Evaluación de triaje", "aplica", "Regla de triaje"): (
        "resultado",
        "evidencia minimizada",
    ),
    ("Evaluación de triaje", "recomienda", "Modalidad de atención"): (
        "prioridad",
    ),
}


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


def cardinality_is_many(cardinality: str) -> bool:
    """Indica si el máximo conceptual permite más de una instancia."""

    maximum = cardinality.rsplit("..", maxsplit=1)[-1]
    return maximum == "N" or (maximum.isdigit() and int(maximum) > 1)


def many_to_many_relationships() -> tuple[tuple[str, str, str, str, str, str], ...]:
    return tuple(
        relationship
        for relationship in RELATIONSHIPS
        if cardinality_is_many(relationship[4])
        and cardinality_is_many(relationship[5])
    )


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
    pdf.drawRightString(PAGE_WIDTH - 32, 15, "Nivel conceptual · transformación lógica documentada por separado")


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
    classification: str | None = None,
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
    label_center_y = center_y - 3 if classification else center_y
    draw_centered_lines(pdf, lines[:3], center_x, label_center_y, FONT_BOLD, 6.8, 7.6, MAGENTA)
    if classification:
        pdf.setFillColor(NAVY)
        pdf.setFont(FONT_BOLD, 5.8)
        pdf.drawCentredString(center_x, center_y + 15, classification)


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

    a_is_many = cardinality_is_many(a_per_b)
    b_is_many = cardinality_is_many(b_per_a)
    classification = "N:N" if a_is_many and b_is_many else "1:N" if a_is_many or b_is_many else "1:1"

    draw_entity(pdf, left_x, entity_y, entity_width, entity_height, entity_a)
    draw_relationship_diamond(
        pdf,
        center_x,
        center_y,
        diamond_width,
        diamond_height,
        verb,
        classification,
    )
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

    relationship_attributes = RELATIONSHIP_ATTRIBUTES.get((entity_a, verb, entity_b), ())
    if relationship_attributes:
        attribute_width = 70
        attribute_height = 15
        gap = 5
        total_width = len(relationship_attributes) * attribute_width + (len(relationship_attributes) - 1) * gap
        start_x = center_x - total_width / 2
        attribute_y = center_y + diamond_height / 2 + 6
        for index, attribute in enumerate(relationship_attributes):
            attribute_x = start_x + index * (attribute_width + gap)
            pdf.setStrokeColor(MAGENTA)
            pdf.setLineWidth(0.6)
            pdf.line(center_x, center_y + diamond_height / 2, attribute_x + attribute_width / 2, attribute_y)
            pdf.setFillColor(WHITE)
            pdf.ellipse(
                attribute_x,
                attribute_y,
                attribute_x + attribute_width,
                attribute_y + attribute_height,
                fill=1,
                stroke=1,
            )
            draw_centered_lines(
                pdf,
                wrap_lines(attribute, attribute_width - 8, FONT_REGULAR, 5.2)[:2],
                attribute_x + attribute_width / 2,
                attribute_y + attribute_height / 2,
                FONT_REGULAR,
                5.2,
                5.6,
                INK,
            )


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

    entity_count = sum(len(entities) for _, entities in ENTITY_GROUPS)
    summary = (
        (str(entity_count), "entidades conceptuales"),
        (str(len(RELATIONSHIPS)), "asociaciones semánticas"),
        (str(len(many_to_many_relationships())), "relaciones N:N explícitas"),
        ("0", "tablas lógicas en el DER"),
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
        "Cada atributo aparece en un óvalo propio; el identificador conceptual se subraya.",
        "Paciente y Psicólogo forman una especialización ISA parcial y superpuesta de Usuario.",
        "Las relaciones N:N permanecen sin resolver hasta la transformación al modelo lógico.",
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


def draw_specialization_panel(pdf: canvas.Canvas, x: float, y: float, width: float, height: float) -> None:
    """Dibuja la jerarquía ISA de Usuario como una sola especialización EER."""

    pdf.setFillColor(SURFACE)
    pdf.setStrokeColor(LINE)
    pdf.roundRect(x, y, width, height, 8, fill=1, stroke=1)
    pdf.setFillColor(NAVY)
    pdf.setFont(FONT_BOLD, 10.5)
    pdf.drawString(x + 14, y + height - 24, "Especialización de Usuario")

    entity_width = 142
    entity_height = 35
    center_x = x + width / 2
    user_y = y + height - 78
    draw_entity(
        pdf,
        center_x - entity_width / 2,
        user_y,
        entity_width,
        entity_height,
        SPECIALIZATION["supertype"],
    )

    triangle_center_y = y + height / 2 - 4
    triangle_half_width = 24
    triangle_height = 34
    path = pdf.beginPath()
    path.moveTo(center_x, triangle_center_y + triangle_height / 2)
    path.lineTo(center_x + triangle_half_width, triangle_center_y - triangle_height / 2)
    path.lineTo(center_x - triangle_half_width, triangle_center_y - triangle_height / 2)
    path.close()
    pdf.setFillColor(MAGENTA_SOFT)
    pdf.setStrokeColor(MAGENTA)
    pdf.setLineWidth(1.1)
    pdf.drawPath(path, fill=1, stroke=1)
    pdf.setFillColor(MAGENTA)
    pdf.setFont(FONT_BOLD, 7.5)
    pdf.drawCentredString(center_x, triangle_center_y - 4, "ISA")
    pdf.setStrokeColor(LINE)
    pdf.line(center_x, user_y, center_x, triangle_center_y + triangle_height / 2)

    subtype_gap = 30
    subtypes_width = entity_width * 2 + subtype_gap
    subtype_start_x = center_x - subtypes_width / 2
    subtype_y = y + 36
    for index, subtype in enumerate(SPECIALIZATION["subtypes"]):
        subtype_x = subtype_start_x + index * (entity_width + subtype_gap)
        draw_entity(pdf, subtype_x, subtype_y, entity_width, entity_height, subtype)
        pdf.setStrokeColor(LINE)
        pdf.line(
            center_x,
            triangle_center_y - triangle_height / 2,
            subtype_x + entity_width / 2,
            subtype_y + entity_height,
        )

    qualifier = f"{SPECIALIZATION['completeness']} · {SPECIALIZATION['disjointness']}"
    pdf.setFillColor(MUTED)
    pdf.setFont(FONT_BOLD, 7.5)
    pdf.drawCentredString(center_x, y + 18, qualifier)


def draw_relation_pages(pdf: canvas.Canvas, start_page: int) -> int:
    page_definitions = (
        (
            "Relaciones: identidad y directorio",
            {"Identidad", "Directorio", "Verificación", "Disponibilidad"},
        ),
        ("Relaciones: solicitudes y ofertas", {"Atención"}),
        ("Relaciones: agenda, reputación y pagos", {"Agenda", "Reputación", "Pagos"}),
        ("Relaciones: mensajería e historia clínica I", {"Mensajería", "Clínica I"}),
        ("Relaciones: historia clínica II", {"Clínica II"}),
        (
            "Relaciones: consentimiento, orientación y privacidad",
            {"Consentimiento", "Orientación", "Privacidad"},
        ),
        ("Relaciones: plataforma", {"Plataforma"}),
    )
    page_number = start_page
    for title, areas in page_definitions:
        relationships = tuple(
            relationship for relationship in RELATIONSHIPS if relationship[0] in areas
        )
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
        if "Identidad" in areas:
            draw_specialization_panel(
                pdf,
                32 + column_width + 24,
                155,
                column_width,
                355,
            )
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
    items_per_page = 8
    chunks = tuple(
        items[index:index + items_per_page]
        for index in range(0, len(items), items_per_page)
    )
    for chunk_index, chunk in enumerate(chunks):
        draw_header(
            pdf,
            f"Entidades y atributos {chunk_index + 1}/{len(chunks)}",
            "Cada atributo se declara en un óvalo independiente; el identificador conceptual aparece subrayado",
            page_number,
        )
        left = 32.0
        top = PAGE_HEIGHT - 92
        row_height = 84
        entity_x = left + 10
        entity_width = 190
        entity_height = 35
        attribute_area_x = entity_x + entity_width + 38
        attribute_area_width = PAGE_WIDTH - left - attribute_area_x
        attribute_columns = 3
        attribute_gap = 10
        attribute_width = (
            attribute_area_width - attribute_gap * (attribute_columns - 1)
        ) / attribute_columns
        attribute_height = 23

        for index, (entity, (identifier, attributes)) in enumerate(chunk):
            row_top = top - index * row_height
            center_y = row_top - row_height / 2

            if index % 2 == 1:
                pdf.setFillColor(SURFACE)
                pdf.setStrokeColor(SURFACE)
                pdf.rect(left, row_top - row_height, PAGE_WIDTH - 2 * left, row_height, fill=1, stroke=0)

            draw_entity(
                pdf,
                entity_x,
                center_y - entity_height / 2,
                entity_width,
                entity_height,
                entity,
            )

            declared_attributes = (identifier,) + tuple(
                value.strip() for value in attributes.split(",") if value.strip()
            )
            attribute_rows = (
                len(declared_attributes) + attribute_columns - 1
            ) // attribute_columns
            row_offset = (attribute_rows - 1) * 11
            for attribute_index, attribute in enumerate(declared_attributes):
                column = attribute_index % attribute_columns
                row = attribute_index // attribute_columns
                attribute_x = attribute_area_x + column * (attribute_width + attribute_gap)
                attribute_center_y = center_y + row_offset - row * 22

                pdf.setStrokeColor(LINE)
                pdf.setLineWidth(0.7)
                pdf.line(
                    entity_x + entity_width,
                    center_y,
                    attribute_x,
                    attribute_center_y,
                )
                is_identifier = attribute_index == 0
                pdf.setFillColor(YELLOW if is_identifier else WHITE)
                pdf.setStrokeColor(colors.HexColor("#C9A70B") if is_identifier else LINE)
                pdf.ellipse(
                    attribute_x,
                    attribute_center_y - attribute_height / 2,
                    attribute_x + attribute_width,
                    attribute_center_y + attribute_height / 2,
                    fill=1,
                    stroke=1,
                )
                font = FONT_BOLD if is_identifier else FONT_REGULAR
                font_size = 7.1
                lines = wrap_lines(attribute, attribute_width - 18, font, font_size)[:2]
                draw_centered_lines(
                    pdf,
                    lines,
                    attribute_x + attribute_width / 2,
                    attribute_center_y,
                    font,
                    font_size,
                    7.8,
                )
                if is_identifier:
                    underline_width = min(
                        stringWidth(lines[-1], font, font_size),
                        attribute_width - 26,
                    )
                    underline_y = attribute_center_y - (7.0 if len(lines) > 1 else 5.0)
                    pdf.setStrokeColor(INK)
                    pdf.setLineWidth(0.55)
                    pdf.line(
                        attribute_x + (attribute_width - underline_width) / 2,
                        underline_y,
                        attribute_x + (attribute_width + underline_width) / 2,
                        underline_y,
                    )
        draw_footer(pdf)
        pdf.showPage()
        page_number += 1
    return page_number


def validate_model() -> None:
    entities = {entity for _, group in ENTITY_GROUPS for entity in group}
    if len(entities) != 39:
        raise ValueError(f"Se esperaban 39 entidades conceptuales y se obtuvieron {len(entities)}")
    if set(ATTRIBUTES) != entities:
        missing = sorted(entities - set(ATTRIBUTES))
        extra = sorted(set(ATTRIBUTES) - entities)
        raise ValueError(f"Catálogo inconsistente. Faltan={missing}; sobran={extra}")
    if len(RELATIONSHIPS) != 68:
        raise ValueError(f"Se esperaban 68 relaciones y se obtuvieron {len(RELATIONSHIPS)}")
    referenced = {item for relationship in RELATIONSHIPS for item in (relationship[1], relationship[3])}
    if not referenced.issubset(entities):
        raise ValueError(f"Relaciones con entidades desconocidas: {sorted(referenced - entities)}")
    many_to_many = many_to_many_relationships()
    if len(many_to_many) != 7:
        raise ValueError(f"Se esperaban 7 relaciones N:N y se obtuvieron {len(many_to_many)}")
    specialization_entities = {
        SPECIALIZATION["supertype"],
        *SPECIALIZATION["subtypes"],
    }
    if not specialization_entities.issubset(entities):
        raise ValueError("La jerarquía ISA contiene entidades desconocidas")
    for entity_a, verb, entity_b in RELATIONSHIP_ATTRIBUTES:
        if not any(
            relationship[1:4] == (entity_a, verb, entity_b)
            for relationship in RELATIONSHIPS
        ):
            raise ValueError(f"Atributos declarados para una relación inexistente: {entity_a} {verb} {entity_b}")


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
    draw_attribute_catalog(pdf, page_number)
    pdf.save()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("output", type=Path)
    arguments = parser.parse_args()
    generate(arguments.output.resolve())


if __name__ == "__main__":
    main()
