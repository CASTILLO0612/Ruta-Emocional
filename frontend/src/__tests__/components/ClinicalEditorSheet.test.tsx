import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { ClinicalEditorSheet } from '../../components/clinical/ClinicalEditorSheet';
import type { ClinicalPolicy } from '../../repositories/ClinicalRecordRepository';

const policy: ClinicalPolicy = {
  maximumNoteLength: 4000,
  maximumEncounterReasonLength: 500,
  maximumTreatmentSummaryLength: 2000,
  maximumGoalLength: 1000,
  maximumGoalsPerPlan: 20,
  minimumAmendmentReasonLength: 10,
  maximumAmendmentReasonLength: 500,
};

const baseProps = {
  policy,
  encounterReason: '',
  amendmentReason: '',
  planSummary: '',
  goalDescription: '',
  isSubmitting: false,
  onNoteContentChange: jest.fn(),
  onEncounterReasonChange: jest.fn(),
  onAmendmentReasonChange: jest.fn(),
  onPlanSummaryChange: jest.fn(),
  onGoalDescriptionChange: jest.fn(),
  onSubmit: jest.fn(),
  onClose: jest.fn(),
};

describe('ClinicalEditorSheet', () => {
  beforeEach(() => jest.clearAllMocks());

  it('expone un diálogo clínico y bloquea una nota incompleta', async () => {
    const view = await render(
      <ClinicalEditorSheet
        {...baseProps}
        mode="ENCOUNTER"
        noteContent=""
        canSubmit={false}
      />
    );

    expect(view.getByLabelText('Nuevo encuentro')).toBeTruthy();
    expect(view.getByLabelText('Contenido de la nota clínica')).toBeTruthy();
    expect(view.getByRole('button', { name: 'Guardar cambios' }).props.accessibilityState)
      .toEqual(expect.objectContaining({ disabled: true }));
  });

  it('separa la creación del plan y conserva una sola acción principal', async () => {
    const onSubmit = jest.fn();
    const view = await render(
      <ClinicalEditorSheet
        {...baseProps}
        mode="PLAN"
        noteContent=""
        planSummary="Plan de seguimiento semanal"
        goalDescription="Reducir la frecuencia de síntomas reportados"
        canSubmit
        onSubmit={onSubmit}
      />
    );

    expect(view.getByLabelText('Resumen del plan')).toBeTruthy();
    expect(view.getByLabelText('Primer objetivo terapéutico')).toBeTruthy();
    expect(view.queryByLabelText('Contenido de la nota clínica')).toBeNull();

    await fireEvent.press(view.getByRole('button', { name: 'Crear plan' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
