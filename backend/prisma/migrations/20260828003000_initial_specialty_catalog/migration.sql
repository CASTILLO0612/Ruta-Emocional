-- The professional onboarding flow requires at least one selectable specialty.
-- These rows are versioned reference data, not a read-time fallback. Existing
-- catalog decisions are preserved: conflicts are never overwritten or
-- reactivated by this migration.
INSERT INTO "specialties" ("code", "name", "is_active") VALUES
    ('PSICOLOGIA_GENERAL', 'Psicología general', true),
    ('PSICOLOGIA_CLINICA', 'Psicología clínica', true),
    ('PSICOLOGIA_INFANTIL_ADOLESCENTE', 'Psicología infantil y adolescente', true),
    ('PSICOLOGIA_PAREJA_FAMILIA', 'Psicología de pareja y familia', true),
    ('PSICOLOGIA_SALUD', 'Psicología de la salud', true),
    ('NEUROPSICOLOGIA', 'Neuropsicología', true),
    ('PSICOLOGIA_PERINATAL', 'Psicología perinatal', true),
    ('ADICCIONES', 'Atención de adicciones', true),
    ('TRAUMA_CRISIS', 'Trauma y atención en crisis', true)
ON CONFLICT DO NOTHING;
