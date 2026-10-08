import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const rootDirectory = path.resolve(scriptDirectory, "..");
const schemaPath = path.join(rootDirectory, "backend", "prisma", "schema.prisma");
const outputPath = path.join(
  rootDirectory,
  "docs",
  "Hackathon",
  "desarrollo",
  "Entregable",
  "diagrama-relacional-ruta-emocional.drawio",
);

const domainDefinitions = [
  {
    id: "identity",
    name: "Identidad y acceso",
    fill: "#EEF2FF",
    stroke: "#6366F1",
    models: [
      "User",
      "ExternalIdentity",
      "Role",
      "UserRole",
      "AuthSession",
      "PasswordResetToken",
      "PatientProfile",
      "PsychologistProfile",
    ],
  },
  {
    id: "delivery",
    name: "Medios y notificaciones",
    fill: "#ECFEFF",
    stroke: "#0891B2",
    models: ["MediaObject", "PushDevice", "PushDelivery"],
  },
  {
    id: "directory",
    name: "Directorio y disponibilidad",
    fill: "#F0FDF4",
    stroke: "#16A34A",
    models: [
      "ProfessionalLicense",
      "Specialty",
      "PsychologistSpecialty",
      "PsychologistModality",
      "CareModality",
      "ProfessionalVerificationSubmission",
      "ProfessionalVerificationDecision",
      "AvailabilityRule",
      "AvailabilityException",
    ],
  },
  {
    id: "care",
    name: "Atención, agenda y pagos",
    fill: "#FFF7ED",
    stroke: "#EA580C",
    models: [
      "ServiceRequest",
      "Offer",
      "CareRelationship",
      "CareRelationshipSource",
      "Appointment",
      "AppointmentEvent",
      "Review",
      "Payment",
      "PaymentEvent",
    ],
  },
  {
    id: "communication",
    name: "Mensajería, llamadas y MENTA",
    fill: "#FAF5FF",
    stroke: "#9333EA",
    models: [
      "Conversation",
      "CallSession",
      "ConversationParticipant",
      "Message",
      "MentaConversation",
      "MentaTurn",
      "MentaToolInvocation",
    ],
  },
  {
    id: "clinical",
    name: "Historia clínica",
    fill: "#FFF1F2",
    stroke: "#E11D48",
    models: [
      "ClinicalRecord",
      "ClinicalEncounter",
      "ClinicalEncounterAppointment",
      "ClinicalNote",
      "ClinicalNoteVersion",
      "ClinicalNoteEvent",
      "DiagnosisCatalog",
      "ClinicalDiagnosis",
      "ClinicalDiagnosisSource",
      "TreatmentPlan",
      "TreatmentGoal",
    ],
  },
  {
    id: "triage",
    name: "Consentimiento y triaje",
    fill: "#F0FDFA",
    stroke: "#0F766E",
    models: [
      "ConsentDocument",
      "PatientConsent",
      "TriageNeed",
      "TriageNeedModality",
      "TriageQuestion",
      "TriageAnswerOption",
      "TriageRule",
      "TriageAssessment",
      "TriageConsentWithdrawal",
      "TriageErasureRequest",
      "TriageAssessmentModality",
      "TriageAssessmentRuleResult",
      "RequestTriageAssessment",
    ],
  },
  {
    id: "platform",
    name: "Plataforma y operación",
    fill: "#F8FAFC",
    stroke: "#475569",
    models: ["AuditEvent", "OutboxEvent", "IdempotencyRecord"],
  },
];

const scalarTypes = new Set([
  "String",
  "Boolean",
  "Int",
  "BigInt",
  "Float",
  "Decimal",
  "DateTime",
  "Json",
  "Bytes",
]);

const escapeXml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const schema = fs.readFileSync(schemaPath, "utf8");
const enumNames = new Set(
  [...schema.matchAll(/^enum\s+(\w+)\s*\{/gm)].map((match) => match[1]),
);

const rawModels = [...schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)].map(
  ([, name, body]) => ({ name, body }),
);
const modelNames = new Set(rawModels.map(({ name }) => name));

const parseList = (body, directive) => {
  const lists = [];
  const expression = new RegExp(`@@${directive}\\(\\[([^\\]]+)\\]`, "g");
  for (const match of body.matchAll(expression)) {
    lists.push(match[1].split(",").map((entry) => entry.trim()));
  }
  return lists;
};

const models = rawModels.map(({ name, body }) => {
  const tableName = body.match(/@@map\("([^"]+)"\)/)?.[1] ?? name;
  const compositeIds = parseList(body, "id");
  const compositeUniques = parseList(body, "unique");
  const indexes = parseList(body, "index");
  const lines = body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("//") && !line.startsWith("@@"));

  const fields = lines
    .map((line) => {
      const match = line.match(/^(\w+)\s+([^\s]+)\s*(.*)$/);
      if (!match) return null;
      const [, fieldName, type, attributes] = match;
      const baseType = type.replace(/[?\[\]]/g, "");
      const columnName = attributes.match(/@map\("([^"]+)"\)/)?.[1] ?? fieldName;
      const databaseType = attributes.match(/@db\.([^\s]+)/)?.[1] ?? null;
      return {
        name: fieldName,
        type,
        baseType,
        attributes,
        columnName,
        databaseType,
        isRelation: modelNames.has(baseType),
        isEnum: enumNames.has(baseType),
        isScalar: scalarTypes.has(baseType) || enumNames.has(baseType),
        isPrimary: attributes.includes("@id"),
        isUnique: attributes.includes("@unique"),
        isOptional: type.endsWith("?"),
      };
    })
    .filter(Boolean);

  const relations = fields
    .filter((field) => field.isRelation && field.attributes.includes("@relation"))
    .map((field) => {
      const relationArguments = field.attributes.match(/@relation\((.*)\)/)?.[1] ?? "";
      const foreignKeys = relationArguments
        .match(/fields:\s*\[([^\]]+)\]/)?.[1]
        ?.split(",")
        .map((entry) => entry.trim());
      const references = relationArguments
        .match(/references:\s*\[([^\]]+)\]/)?.[1]
        ?.split(",")
        .map((entry) => entry.trim());
      const relationName = relationArguments.match(/^\s*"([^"]+)"/)?.[1] ?? field.name;
      if (!foreignKeys || !references) return null;
      return {
        ownerModel: name,
        targetModel: field.baseType,
        relationName,
        foreignKeys,
        references,
        optional: field.isOptional,
      };
    })
    .filter(Boolean);

  const foreignKeyNames = new Set(relations.flatMap((relation) => relation.foreignKeys));
  for (const field of fields) {
    field.isForeignKey = foreignKeyNames.has(field.name);
    field.isPrimary ||= compositeIds.some((key) => key.includes(field.name));
    field.isUnique ||=
      compositeUniques.some((key) => key.length === 1 && key[0] === field.name) ||
      compositeIds.some((key) => key.length === 1 && key[0] === field.name);
    field.indexLabels = indexes
      .map((indexFields, index) => (indexFields.includes(field.name) ? `I${index + 1}` : null))
      .filter(Boolean);
    field.uniqueLabels = compositeUniques
      .map((uniqueFields, index) =>
        uniqueFields.includes(field.name) && uniqueFields.length > 1 ? `UQ${index + 1}` : null,
      )
      .filter(Boolean);
  }

  return {
    name,
    tableName,
    fields,
    scalarFields: fields.filter((field) => !field.isRelation),
    relations,
    compositeIds,
    compositeUniques,
    indexes,
  };
});

const modelByName = new Map(models.map((model) => [model.name, model]));
const allRelations = models.flatMap((model) => model.relations);
const domainByModel = new Map();
for (const domain of domainDefinitions) {
  for (const modelName of domain.models) {
    if (domainByModel.has(modelName)) {
      throw new Error(`El modelo ${modelName} está asignado a más de un dominio.`);
    }
    domainByModel.set(modelName, domain);
  }
}

const unclassifiedModels = models.filter((model) => !domainByModel.has(model.name));
if (unclassifiedModels.length > 0) {
  throw new Error(
    `Modelos sin dominio: ${unclassifiedModels.map((model) => model.name).join(", ")}`,
  );
}

const missingModels = [...domainByModel.keys()].filter((name) => !modelByName.has(name));
if (missingModels.length > 0) {
  throw new Error(`Modelos configurados que no existen: ${missingModels.join(", ")}`);
}

class DiagramBuilder {
  constructor(name, id, width = 1800, height = 1200) {
    this.name = name;
    this.id = id;
    this.width = width;
    this.height = height;
    this.nextId = 2;
    this.cells = ['<mxCell id="0"/>', '<mxCell id="1" parent="0"/>'];
  }

  createId(prefix = "c") {
    return `${prefix}-${this.id}-${this.nextId++}`;
  }

  vertex({ value, style, x, y, width, height, id = this.createId("v"), parent = "1" }) {
    this.cells.push(
      `<mxCell id="${escapeXml(id)}" value="${escapeXml(value)}" style="${escapeXml(style)}" vertex="1" parent="${escapeXml(parent)}"><mxGeometry x="${x}" y="${y}" width="${width}" height="${height}" as="geometry"/></mxCell>`,
    );
    return id;
  }

  edge({ source, target, value, style, id = this.createId("e") }) {
    this.cells.push(
      `<mxCell id="${escapeXml(id)}" value="${escapeXml(value)}" style="${escapeXml(style)}" edge="1" parent="1" source="${escapeXml(source)}" target="${escapeXml(target)}"><mxGeometry relative="1" as="geometry"/></mxCell>`,
    );
    return id;
  }

  toXml() {
    return `<diagram id="${escapeXml(this.id)}" name="${escapeXml(this.name)}"><mxGraphModel dx="1422" dy="794" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="${this.width}" pageHeight="${this.height}" math="0" shadow="0"><root>${this.cells.join("")}</root></mxGraphModel></diagram>`;
  }
}

const titleStyle =
  "text;html=1;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;whiteSpace=wrap;rounded=0;fontSize=24;fontStyle=1;fontColor=#0F172A;";
const subtitleStyle =
  "text;html=1;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;whiteSpace=wrap;rounded=0;fontSize=12;fontColor=#475569;";
const entityStyle = (_domain, external = false) =>
  [
    "rounded=0",
    "whiteSpace=wrap",
    "html=1",
    "align=left",
    "verticalAlign=top",
    "spacing=0",
    "fontSize=11",
    "fontColor=#0F172A",
    "fillColor=#FFFFFF",
    `strokeColor=${external ? "#94A3B8" : "#64748B"}`,
    `dashed=${external ? 1 : 0}`,
    "overflow=fill",
  ].join(";");

const edgeStyle = (oneToOne, crossDomain = false) =>
  [
    "edgeStyle=orthogonalEdgeStyle",
    "rounded=0",
    "orthogonalLoop=1",
    "jettySize=auto",
    "html=1",
    "fontSize=10",
    "fontColor=#334155",
    "strokeColor=#111827",
    `dashed=${crossDomain ? 1 : 0}`,
    "startArrow=none",
    "startFill=0",
    "endArrow=block",
    "endFill=1",
    `labelBackgroundColor=${oneToOne ? "#F8FAFC" : "#FFFFFF"}`,
  ].join(";");

const relationIsOneToOne = (relation) => {
  const owner = modelByName.get(relation.ownerModel);
  if (relation.foreignKeys.length === 1) {
    const field = owner.fields.find((candidate) => candidate.name === relation.foreignKeys[0]);
    if (field?.isUnique || field?.isPrimary) return true;
  }
  return [...owner.compositeIds, ...owner.compositeUniques].some(
    (key) =>
      key.length === relation.foreignKeys.length &&
      key.every((fieldName) => relation.foreignKeys.includes(fieldName)),
  );
};

const relationLabel = (relation) => {
  const owner = modelByName.get(relation.ownerModel);
  const ownerColumns = relation.foreignKeys.map(
    (fieldName) => owner.fields.find((field) => field.name === fieldName)?.columnName ?? fieldName,
  );
  const target = modelByName.get(relation.targetModel);
  const targetColumns = relation.references.map(
    (fieldName) => target.fields.find((field) => field.name === fieldName)?.columnName ?? fieldName,
  );
  const cardinality = relationIsOneToOne(relation)
    ? relation.optional
      ? "0..1 : 1"
      : "1 : 1"
    : "N : 1";
  return `<b>${cardinality}</b><br><font color="#475569">${ownerColumns.join(" + ")} → ${targetColumns.join(" + ")}</font>`;
};

const modelLabel = (model, detailed = true, external = false) => {
  const header = `<div style="background-color:#D1D5DB;border-bottom:1px solid #64748B;padding:7px 8px;text-align:center"><b>${escapeHtml(model.tableName)}</b></div>`;
  if (external) {
    return `${header}<table style="width:100%;border-collapse:collapse"><tr><td style="padding:6px 8px;color:#64748B">Referencia externa · ${escapeHtml(model.name)}</td></tr></table>`;
  }
  const visibleFields = detailed
    ? model.scalarFields
    : model.scalarFields.filter(
        (field) => field.isPrimary || field.isForeignKey || field.isUnique,
      );
  const rows = visibleFields.map((field) => {
    const flags = [
      field.isPrimary ? "PK" : null,
      field.isForeignKey
        ? `FK${
            model.relations.findIndex((relation) => relation.foreignKeys.includes(field.name)) + 1
          }`
        : null,
      !field.isPrimary && field.isUnique ? "UQ" : null,
      ...field.uniqueLabels,
      ...field.indexLabels,
    ].filter(Boolean);
    const type = field.databaseType ?? field.type;
    const nullable = field.isOptional ? "?" : "";
    const fieldName = field.isPrimary
      ? `<u>${escapeHtml(field.columnName)}</u>`
      : escapeHtml(field.columnName);
    return `<tr><td style="width:24%;border-right:1px solid #CBD5E1;border-bottom:1px solid #E2E8F0;padding:4px 6px;vertical-align:top"><b>${flags.join(",")}</b></td><td style="border-bottom:1px solid #E2E8F0;padding:4px 7px;vertical-align:top">${fieldName} <font color="#64748B">${escapeHtml(type)}${nullable}</font></td></tr>`;
  });
  return `${header}<table style="width:100%;border-collapse:collapse;table-layout:fixed">${rows.join("")}</table>`;
};

const addPageHeader = (builder, title, subtitle) => {
  builder.vertex({ value: title, style: titleStyle, x: 32, y: 24, width: 1100, height: 34 });
  builder.vertex({ value: subtitle, style: subtitleStyle, x: 32, y: 60, width: 1450, height: 38 });
};

const overview = new DiagramBuilder("00 - Panorama relacional", "overview", 4300, 2600);
addPageHeader(
  overview,
  "Ruta Emocional · modelo relacional completo",
  `${models.length} tablas Prisma/PostgreSQL · ${allRelations.length} claves foráneas · fuente: backend/prisma/schema.prisma y documentación 3FN`,
);

const overviewNodeIds = new Map();
domainDefinitions.forEach((domain, domainIndex) => {
  const x = 32 + domainIndex * 525;
  let domainY = 190;
  overview.vertex({
    value: `<b>${escapeHtml(domain.name)}</b><br><font color="#475569">${domain.models.length} tablas</font>`,
    style: `rounded=1;whiteSpace=wrap;html=1;align=left;verticalAlign=middle;spacing=10;fontSize=13;fontColor=#0F172A;fillColor=${domain.fill};strokeColor=${domain.stroke};arcSize=8;`,
    x,
    y: 115,
    width: 460,
    height: 52,
  });
  domain.models.forEach((modelName) => {
    const model = modelByName.get(modelName);
    const compactFieldCount = model.scalarFields.filter(
      (field) => field.isPrimary || field.isForeignKey || field.isUnique,
    ).length;
    const tableHeight = Math.max(72, 36 + compactFieldCount * 26);
    const nodeId = overview.vertex({
      value: modelLabel(model, false),
      style: entityStyle(domain),
      x,
      y: domainY,
      width: 460,
      height: tableHeight,
      id: `overview-${modelName}`,
    });
    overviewNodeIds.set(modelName, nodeId);
    domainY += tableHeight + 42;
  });
});

for (const relation of allRelations) {
  const ownerDomain = domainByModel.get(relation.ownerModel);
  const targetDomain = domainByModel.get(relation.targetModel);
  overview.edge({
    source: overviewNodeIds.get(relation.ownerModel),
    target: overviewNodeIds.get(relation.targetModel),
    value: "",
    style: edgeStyle(relationIsOneToOne(relation), ownerDomain.id !== targetDomain.id),
    id: `overview-relation-${relation.ownerModel}-${relation.relationName}`,
  });
}

const diagrams = [overview.toXml()];

for (const [domainIndex, domain] of domainDefinitions.entries()) {
  const selected = new Set(domain.models);
  const relevantRelations = allRelations.filter(
    (relation) => selected.has(relation.ownerModel) || selected.has(relation.targetModel),
  );
  const externalNames = [
    ...new Set(
      relevantRelations
        .flatMap((relation) => [relation.ownerModel, relation.targetModel])
        .filter((name) => !selected.has(name)),
    ),
  ].sort();

  const domainModels = domain.models.map((name) => modelByName.get(name));
  const builder = new DiagramBuilder(
    `${String(domainIndex + 1).padStart(2, "0")} - ${domain.name}`,
    `domain-${domain.id}`,
    2100,
    2200,
  );
  addPageHeader(
    builder,
    domain.name,
    `Tablas físicas, claves PK/FK/UQ y cardinalidades. Las cajas discontinuas pertenecen a otros dominios.`,
  );

  builder.vertex({
    value: "<b>Convención</b> · PK = clave primaria · FK = clave foránea · UQ = unicidad · I# = índice · flecha: FK → tabla referenciada · línea discontinua = otro dominio",
    style: subtitleStyle,
    x: 32,
    y: 96,
    width: 1700,
    height: 28,
  });

  const positions = [140, 140, 140];
  const nodeIds = new Map();
  domainModels.forEach((model, index) => {
    const column = positions.indexOf(Math.min(...positions));
    const x = 32 + column * 510;
    const y = positions[column];
    const height = Math.max(96, 36 + model.scalarFields.length * 26);
    const nodeId = builder.vertex({
      value: modelLabel(model, true),
      style: entityStyle(domain),
      x,
      y,
      width: 460,
      height,
      id: `${domain.id}-${model.name}`,
    });
    nodeIds.set(model.name, nodeId);
    positions[column] += height + 54;
  });

  let externalY = 140;
  for (const modelName of externalNames) {
    const model = modelByName.get(modelName);
    const externalDomain = domainByModel.get(modelName);
    const nodeId = builder.vertex({
      value: modelLabel(model, false, true),
      style: entityStyle(externalDomain, true),
      x: 1570,
      y: externalY,
      width: 430,
      height: 76,
      id: `${domain.id}-external-${model.name}`,
    });
    nodeIds.set(model.name, nodeId);
    externalY += 100;
  }

  for (const relation of relevantRelations) {
    const oneToOne = relationIsOneToOne(relation);
    const crossDomain =
      domainByModel.get(relation.ownerModel).id !== domainByModel.get(relation.targetModel).id;
    builder.edge({
      source: nodeIds.get(relation.ownerModel),
      target: nodeIds.get(relation.targetModel),
      value: relationLabel(relation),
      style: edgeStyle(oneToOne, crossDomain),
      id: `${domain.id}-relation-${relation.ownerModel}-${relation.relationName}`,
    });
  }

  builder.height = Math.max(1400, ...positions, externalY) + 120;
  diagrams.push(builder.toXml());
}

const generatedAt = new Date().toISOString();
const xml = `<?xml version="1.0" encoding="UTF-8"?><mxfile host="app.diagrams.net" modified="${escapeXml(generatedAt)}" agent="Ruta Emocional relational diagram generator" version="24.7.17" type="device" compressed="false">${diagrams.join("")}</mxfile>`;

fs.writeFileSync(outputPath, xml, "utf8");
console.log(
  JSON.stringify(
    {
      outputPath,
      models: models.length,
      relations: allRelations.length,
      pages: diagrams.length,
    },
    null,
    2,
  ),
);
