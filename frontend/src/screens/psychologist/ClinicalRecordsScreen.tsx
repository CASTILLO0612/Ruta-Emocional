import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { randomUUID } from 'expo-crypto';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppButton } from '../../components/common/AppButton';
import {
  amendClinicalNote,
  ClinicalEncounter,
  ClinicalNote,
  ClinicalNoteVersion,
  ClinicalPatient,
  ClinicalPolicy,
  ClinicalRecord,
  createClinicalEncounter,
  createTreatmentPlan,
  fetchClinicalNoteVersions,
  fetchClinicalPatients,
  fetchClinicalPolicy,
  fetchClinicalRecord,
  signClinicalNote,
  TreatmentGoalStatus,
  TreatmentPlan,
  transitionTreatmentPlan,
  updateClinicalDraft,
  updateTreatmentGoalStatus,
} from '../../repositories/ClinicalRecordRepository';
import {
  fetchTriageAssessment,
  reviewTriageAssessment,
  TriageAssessment,
} from '../../repositories/TriageRepository';
import { Colors } from '../../theme/colors';
import { clinicalRecordsStyles as styles } from './clinicalRecordsStyles';

type EditorMode = 'ENCOUNTER' | 'DRAFT' | 'AMENDMENT' | 'PLAN' | null;

const NOTE_STATUS_LABELS: Record<ClinicalNote['status'], string> = {
  DRAFT: 'Borrador',
  SIGNED: 'Firmada',
  AMENDED: 'Enmendada',
};

const PLAN_STATUS_LABELS: Record<TreatmentPlan['status'], string> = {
  DRAFT: 'Borrador',
  ACTIVE: 'Activo',
  COMPLETED: 'Completado',
  CANCELLED: 'Cancelado',
};

const GOAL_STATUS_LABELS: Record<TreatmentGoalStatus, string> = {
  PENDING: 'Pendiente',
  IN_PROGRESS: 'En progreso',
  ACHIEVED: 'Alcanzado',
  CANCELLED: 'Cancelado',
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('es-NI', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function nextGoalStatus(status: TreatmentGoalStatus): TreatmentGoalStatus | null {
  if (status === 'PENDING') return 'IN_PROGRESS';
  if (status === 'IN_PROGRESS') return 'ACHIEVED';
  return null;
}

export const ClinicalRecordsScreen: React.FC = () => {
  const [policy, setPolicy] = useState<ClinicalPolicy | null>(null);
  const [patients, setPatients] = useState<readonly ClinicalPatient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const selectedPatientIdRef = useRef<string | null>(null);
  const [record, setRecord] = useState<ClinicalRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingRecord, setIsLoadingRecord] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<EditorMode>(null);
  const [editingEncounter, setEditingEncounter] = useState<ClinicalEncounter | null>(null);
  const [noteContent, setNoteContent] = useState('');
  const [encounterReason, setEncounterReason] = useState('');
  const [amendmentReason, setAmendmentReason] = useState('');
  const [planSummary, setPlanSummary] = useState('');
  const [goalDescription, setGoalDescription] = useState('');
  const [versions, setVersions] = useState<readonly ClinicalNoteVersion[] | null>(null);
  const [versionsNoteId, setVersionsNoteId] = useState<string | null>(null);
  const [triageAssessment, setTriageAssessment] = useState<TriageAssessment | null>(null);

  const selectedPatient = useMemo(
    () => patients.find(({ patientUserId }) => patientUserId === selectedPatientId) ?? null,
    [patients, selectedPatientId]
  );

  const loadRecord = useCallback(async (patientUserId: string, signal?: AbortSignal) => {
    setIsLoadingRecord(true);
    try {
      const nextRecord = await fetchClinicalRecord(patientUserId, undefined, signal);
      if (!signal?.aborted) setRecord(nextRecord);
    } finally {
      if (!signal?.aborted) setIsLoadingRecord(false);
    }
  }, []);

  const loadWorkspace = useCallback(async (signal?: AbortSignal) => {
    try {
      setError(null);
      const [nextPolicy, patientPage] = await Promise.all([
        fetchClinicalPolicy(signal),
        fetchClinicalPatients(undefined, signal),
      ]);
      if (signal?.aborted) return;
      setPolicy(nextPolicy);
      setPatients(patientPage.data);
      const currentPatientId = selectedPatientIdRef.current;
      const nextPatientId = currentPatientId
        && patientPage.data.some(({ patientUserId }) => patientUserId === currentPatientId)
        ? currentPatientId
        : patientPage.data[0]?.patientUserId ?? null;
      selectedPatientIdRef.current = nextPatientId;
      setSelectedPatientId(nextPatientId);
      if (nextPatientId) await loadRecord(nextPatientId, signal);
      else setRecord(null);
    } catch (loadError) {
      if (loadError instanceof Error && loadError.name === 'AbortError') return;
      setError(loadError instanceof Error ? loadError.message : 'No pudimos cargar los expedientes.');
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [loadRecord]);

  useFocusEffect(useCallback(() => {
    const controller = new AbortController();
    void loadWorkspace(controller.signal);
    return () => controller.abort();
  }, [loadWorkspace]));

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadWorkspace();
    setIsRefreshing(false);
  }, [loadWorkspace]);

  const choosePatient = useCallback(async (patientUserId: string) => {
    selectedPatientIdRef.current = patientUserId;
    setSelectedPatientId(patientUserId);
    setTriageAssessment(null);
    setRecord(null);
    setEditorMode(null);
    setVersions(null);
    setError(null);
    try {
      await loadRecord(patientUserId);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No pudimos abrir el expediente.');
    }
  }, [loadRecord]);

  const loadTriageAssessment = async (assessmentId: string) => {
    setBusyAction('triage-read');
    setError(null);
    try {
      setTriageAssessment(await fetchTriageAssessment(assessmentId));
    } catch (triageError) {
      setError(triageError instanceof Error ? triageError.message : 'No pudimos abrir la orientación.');
    } finally {
      setBusyAction(null);
    }
  };

  const markTriageReviewed = async () => {
    if (!triageAssessment) return;
    setBusyAction('triage-review');
    setError(null);
    try {
      setTriageAssessment(await reviewTriageAssessment(triageAssessment.id));
    } catch (triageError) {
      setError(triageError instanceof Error ? triageError.message : 'No pudimos registrar la revisión.');
    } finally {
      setBusyAction(null);
    }
  };

  const closeEditor = useCallback(() => {
    setEditorMode(null);
    setEditingEncounter(null);
    setNoteContent('');
    setEncounterReason('');
    setAmendmentReason('');
    setPlanSummary('');
    setGoalDescription('');
  }, []);

  const openEncounterEditor = useCallback(() => {
    setEditingEncounter(null);
    setNoteContent('');
    setEncounterReason('');
    setAmendmentReason('');
    setEditorMode('ENCOUNTER');
  }, []);

  const openNoteEditor = useCallback((encounter: ClinicalEncounter, mode: 'DRAFT' | 'AMENDMENT') => {
    setEditingEncounter(encounter);
    setNoteContent(encounter.note.content);
    setEncounterReason('');
    setAmendmentReason('');
    setEditorMode(mode);
  }, []);

  const runMutation = useCallback(async (
    actionId: string,
    operation: () => Promise<ClinicalRecord>
  ) => {
    setBusyAction(actionId);
    setError(null);
    try {
      setRecord(await operation());
      closeEditor();
      const patientPage = await fetchClinicalPatients();
      setPatients(patientPage.data);
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : 'No pudimos guardar los cambios.');
    } finally {
      setBusyAction(null);
    }
  }, [closeEditor]);

  const submitEditor = useCallback(async () => {
    if (!selectedPatient || !policy) return;
    if (editorMode === 'ENCOUNTER') {
      if (!noteContent.trim()) return;
      await runMutation('encounter', () => createClinicalEncounter({
        patientUserId: selectedPatient.patientUserId,
        startedAt: new Date().toISOString(),
        ...(encounterReason.trim() ? { reason: encounterReason.trim() } : {}),
        noteContent: noteContent.trim(),
      }, randomUUID()));
      return;
    }
    if (editorMode === 'DRAFT' && editingEncounter) {
      await runMutation(editingEncounter.note.id, () => updateClinicalDraft(
        editingEncounter.note.id,
        editingEncounter.note.latestVersionNumber,
        noteContent.trim(),
        randomUUID()
      ));
      return;
    }
    if (editorMode === 'AMENDMENT' && editingEncounter) {
      await runMutation(editingEncounter.note.id, () => amendClinicalNote(
        editingEncounter.note.id,
        {
          expectedVersion: editingEncounter.note.latestVersionNumber,
          content: noteContent.trim(),
          reason: amendmentReason.trim(),
        },
        randomUUID()
      ));
      return;
    }
    if (editorMode === 'PLAN' && planSummary.trim() && goalDescription.trim()) {
      setBusyAction('plan');
      setError(null);
      try {
        const plan = await createTreatmentPlan({
          patientUserId: selectedPatient.patientUserId,
          summary: planSummary.trim(),
          goals: [{ description: goalDescription.trim() }],
        }, randomUUID());
        setRecord((current) => current ? {
          ...current,
          treatmentPlans: [plan, ...current.treatmentPlans],
        } : current);
        closeEditor();
      } catch (mutationError) {
        setError(mutationError instanceof Error ? mutationError.message : 'No pudimos crear el plan.');
      } finally {
        setBusyAction(null);
      }
    }
  }, [
    amendmentReason,
    closeEditor,
    editingEncounter,
    editorMode,
    encounterReason,
    goalDescription,
    noteContent,
    planSummary,
    policy,
    runMutation,
    selectedPatient,
  ]);

  const confirmSign = useCallback((encounter: ClinicalEncounter) => {
    Alert.alert(
      'Firmar nota clínica',
      'Después de firmarla no podrá editarse. Cualquier corrección quedará registrada como una enmienda.',
      [
        { text: 'Volver', style: 'cancel' },
        {
          text: 'Firmar nota',
          onPress: () => void runMutation(encounter.note.id, () => signClinicalNote(
            encounter.note.id,
            encounter.note.latestVersionNumber,
            randomUUID()
          )),
        },
      ]
    );
  }, [runMutation]);

  const showVersions = useCallback(async (noteId: string) => {
    if (versionsNoteId === noteId && versions) {
      setVersions(null);
      setVersionsNoteId(null);
      return;
    }
    setBusyAction(`versions:${noteId}`);
    setError(null);
    try {
      setVersions(await fetchClinicalNoteVersions(noteId));
      setVersionsNoteId(noteId);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No pudimos cargar las versiones.');
    } finally {
      setBusyAction(null);
    }
  }, [versions, versionsNoteId]);

  const replacePlan = useCallback((plan: TreatmentPlan) => {
    setRecord((current) => current ? {
      ...current,
      treatmentPlans: current.treatmentPlans.map((item) => item.id === plan.id ? plan : item),
    } : current);
  }, []);

  const runPlanTransition = useCallback(async (
    plan: TreatmentPlan,
    transition: 'ACTIVATE' | 'COMPLETE' | 'CANCEL'
  ) => {
    setBusyAction(plan.id);
    setError(null);
    try {
      replacePlan(await transitionTreatmentPlan(plan.id, transition, randomUUID()));
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : 'No pudimos actualizar el plan.');
    } finally {
      setBusyAction(null);
    }
  }, [replacePlan]);

  const advanceGoal = useCallback(async (goalId: string, status: TreatmentGoalStatus) => {
    const next = nextGoalStatus(status);
    if (!next) return;
    setBusyAction(goalId);
    setError(null);
    try {
      replacePlan(await updateTreatmentGoalStatus(goalId, next, randomUUID()));
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : 'No pudimos actualizar el objetivo.');
    } finally {
      setBusyAction(null);
    }
  }, [replacePlan]);

  const canSubmitEditor = useMemo(() => {
    if (!policy) return false;
    if (editorMode === 'ENCOUNTER' || editorMode === 'DRAFT') {
      return noteContent.trim().length > 0 && noteContent.trim().length <= policy.maximumNoteLength;
    }
    if (editorMode === 'AMENDMENT') {
      return noteContent.trim().length > 0
        && noteContent.trim().length <= policy.maximumNoteLength
        && amendmentReason.trim().length >= policy.minimumAmendmentReasonLength
        && amendmentReason.trim().length <= policy.maximumAmendmentReasonLength;
    }
    if (editorMode === 'PLAN') {
      return planSummary.trim().length > 0
        && planSummary.trim().length <= policy.maximumTreatmentSummaryLength
        && goalDescription.trim().length > 0
        && goalDescription.trim().length <= policy.maximumGoalLength;
    }
    return false;
  }, [amendmentReason, editorMode, goalDescription, noteContent, planSummary, policy]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.supportingText}>Cargando expedientes</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.flex}>
          <Text style={styles.title}>Pacientes</Text>
          <Text style={styles.subtitle}>Historia clínica privada y versionada</Text>
        </View>
        <View style={styles.securityMark} accessibilityLabel="Contenido cifrado">
          <MaterialIcons name="lock-outline" size={18} color={Colors.primary} />
          <Text style={styles.securityText}>Privado</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={(
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void refresh()}
            tintColor={Colors.primary}
          />
        )}
      >
        {error ? (
          <Pressable style={styles.errorBanner} onPress={() => setError(null)}>
            <MaterialIcons name="error-outline" size={20} color={Colors.error} />
            <Text style={styles.errorText}>{error}</Text>
            <MaterialIcons name="close" size={18} color={Colors.textTertiary} />
          </Pressable>
        ) : null}

        {patients.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <MaterialIcons name="people-outline" size={30} color={Colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>Sin pacientes activos</Text>
            <Text style={styles.emptyText}>
              Los expedientes aparecerán cuando exista una relación asistencial activa.
            </Text>
          </View>
        ) : (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.patientStrip}>
              {patients.map((patient) => {
                const selected = patient.patientUserId === selectedPatientId;
                return (
                  <Pressable
                    key={patient.patientUserId}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => void choosePatient(patient.patientUserId)}
                    style={[styles.patientChip, selected && styles.patientChipSelected]}
                  >
                    <View style={[styles.avatar, selected && styles.avatarSelected]}>
                      <MaterialIcons
                        name="person-outline"
                        size={20}
                        color={selected ? Colors.textInverse : Colors.primary}
                      />
                    </View>
                    <View>
                      <Text style={[styles.patientName, selected && styles.patientNameSelected]}>
                        {patient.displayName}
                      </Text>
                      <Text style={[styles.patientMeta, selected && styles.patientMetaSelected]}>
                        {patient.draftNotesCount > 0
                          ? `${patient.draftNotesCount} borrador${patient.draftNotesCount === 1 ? '' : 'es'}`
                          : patient.lastEncounterAt ? formatDate(patient.lastEncounterAt) : 'Sin encuentros'}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>

            {isLoadingRecord ? (
              <ActivityIndicator style={styles.recordLoader} color={Colors.primary} />
            ) : record && selectedPatient ? (
              <>
                <View style={styles.recordHeader}>
                  <View style={styles.flex}>
                    <Text style={styles.recordTitle}>{record.patient.displayName}</Text>
                    <Text style={styles.recordCaption}>
                      {record.id ? `Expediente ${record.status === 'OPEN' ? 'abierto' : 'restringido'}` : 'Expediente por iniciar'}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Registrar encuentro"
                    onPress={editorMode === 'ENCOUNTER' ? closeEditor : openEncounterEditor}
                    style={({ pressed }) => [styles.primaryIconButton, pressed && styles.pressed]}
                  >
                    <MaterialIcons name={editorMode === 'ENCOUNTER' ? 'close' : 'note-add'} size={23} color={Colors.textInverse} />
                  </Pressable>
                </View>

                {selectedPatient.triageAssessmentId ? (
                  triageAssessment ? (
                    <View style={styles.triageCard}>
                      <View style={styles.triageHeading}>
                        <View style={styles.triageIcon}>
                          <MaterialIcons name="health-and-safety" size={21} color={Colors.primary} />
                        </View>
                        <View style={styles.flex}>
                          <Text style={styles.triageTitle}>Orientación MENTA vinculada</Text>
                          <Text style={styles.triageMeta}>
                            {triageAssessment.primaryNeed.name} · Riesgo {triageAssessment.riskLevel.toLowerCase()}
                          </Text>
                        </View>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Cerrar orientación"
                          onPress={() => setTriageAssessment(null)}
                          style={({ pressed }) => pressed && styles.pressed}
                        >
                          <MaterialIcons name="close" size={20} color={Colors.textTertiary} />
                        </Pressable>
                      </View>
                      <Text style={styles.triageSummary}>{triageAssessment.orientationSummary}</Text>
                      <View style={styles.triageTransparency}>
                        <MaterialIcons name="smart-toy" size={16} color={Colors.textTertiary} />
                        <Text style={styles.triageTransparencyText}>
                          Orientación automatizada, no diagnóstico · Reglas {triageAssessment.evaluatorVersion}
                        </Text>
                      </View>
                      {triageAssessment.reviewedAt ? (
                        <View style={styles.reviewedMark}>
                          <MaterialIcons name="verified" size={18} color={Colors.success} />
                          <Text style={styles.reviewedText}>
                            Revisada {formatDate(triageAssessment.reviewedAt)}
                          </Text>
                        </View>
                      ) : (
                        <AppButton
                          label="Registrar revisión profesional"
                          onPress={() => void markTriageReviewed()}
                          isLoading={busyAction === 'triage-review'}
                          fullWidth
                          variant="secondary"
                        />
                      )}
                    </View>
                  ) : (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => void loadTriageAssessment(selectedPatient.triageAssessmentId!)}
                      style={({ pressed }) => [styles.triageLauncher, pressed && styles.pressed]}
                    >
                      {busyAction === 'triage-read' ? (
                        <ActivityIndicator color={Colors.primary} />
                      ) : (
                        <MaterialIcons name="health-and-safety" size={22} color={Colors.primary} />
                      )}
                      <View style={styles.flex}>
                        <Text style={styles.triageLauncherTitle}>Revisar orientación MENTA</Text>
                        <Text style={styles.triageLauncherText}>
                          Resultado previo congelado al iniciar la relación asistencial.
                        </Text>
                      </View>
                      <MaterialIcons name="chevron-right" size={22} color={Colors.textTertiary} />
                    </Pressable>
                  )
                ) : null}

                {editorMode ? (
                  <View style={styles.editorPanel}>
                    <View style={styles.sectionHeading}>
                      <Text style={styles.sectionTitle}>
                        {editorMode === 'ENCOUNTER' ? 'Nuevo encuentro'
                          : editorMode === 'DRAFT' ? 'Editar borrador'
                            : editorMode === 'AMENDMENT' ? 'Enmendar nota'
                              : 'Nuevo plan de tratamiento'}
                      </Text>
                      <MaterialIcons
                        name={editorMode === 'PLAN' ? 'assignment' : 'description'}
                        size={22}
                        color={Colors.primary}
                      />
                    </View>

                    {editorMode === 'PLAN' ? (
                      <>
                        <Text style={styles.inputLabel}>Resumen del plan</Text>
                        <TextInput
                          value={planSummary}
                          onChangeText={setPlanSummary}
                          multiline
                          maxLength={policy?.maximumTreatmentSummaryLength}
                          placeholder="Enfoque, frecuencia y criterios de seguimiento"
                          placeholderTextColor={Colors.textTertiary}
                          style={styles.textArea}
                        />
                        <Text style={styles.inputLabel}>Primer objetivo</Text>
                        <TextInput
                          value={goalDescription}
                          onChangeText={setGoalDescription}
                          multiline
                          maxLength={policy?.maximumGoalLength}
                          placeholder="Objetivo observable y clínicamente pertinente"
                          placeholderTextColor={Colors.textTertiary}
                          style={styles.compactTextArea}
                        />
                      </>
                    ) : (
                      <>
                        {editorMode === 'ENCOUNTER' ? (
                          <>
                            <Text style={styles.inputLabel}>Motivo del encuentro</Text>
                            <TextInput
                              value={encounterReason}
                              onChangeText={setEncounterReason}
                              maxLength={policy?.maximumEncounterReasonLength}
                              placeholder="Opcional"
                              placeholderTextColor={Colors.textTertiary}
                              style={styles.input}
                            />
                          </>
                        ) : null}
                        <Text style={styles.inputLabel}>Nota clínica</Text>
                        <TextInput
                          value={noteContent}
                          onChangeText={setNoteContent}
                          multiline
                          maxLength={policy?.maximumNoteLength}
                          placeholder="Registra observaciones relevantes y evita información innecesaria"
                          placeholderTextColor={Colors.textTertiary}
                          style={styles.noteArea}
                        />
                        {editorMode === 'AMENDMENT' ? (
                          <>
                            <Text style={styles.inputLabel}>Motivo de la enmienda</Text>
                            <TextInput
                              value={amendmentReason}
                              onChangeText={setAmendmentReason}
                              maxLength={policy?.maximumAmendmentReasonLength}
                              placeholder="Explica por qué se corrige la nota firmada"
                              placeholderTextColor={Colors.textTertiary}
                              style={styles.compactTextArea}
                              multiline
                            />
                          </>
                        ) : null}
                      </>
                    )}

                    <View style={styles.editorActions}>
                      <AppButton label="Cancelar" variant="ghost" size="sm" onPress={closeEditor} />
                      <AppButton
                        label={editorMode === 'PLAN' ? 'Crear plan' : 'Guardar'}
                        variant="secondary"
                        size="sm"
                        disabled={!canSubmitEditor}
                        isLoading={busyAction !== null}
                        onPress={() => void submitEditor()}
                      />
                    </View>
                  </View>
                ) : null}

                <View style={styles.sectionHeadingWithAction}>
                  <View>
                    <Text style={styles.sectionTitle}>Plan de tratamiento</Text>
                    <Text style={styles.sectionCaption}>Objetivos y seguimiento del proceso</Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Crear plan de tratamiento"
                    onPress={() => editorMode === 'PLAN' ? closeEditor() : setEditorMode('PLAN')}
                    style={styles.secondaryIconButton}
                  >
                    <MaterialIcons name={editorMode === 'PLAN' ? 'close' : 'add'} size={21} color={Colors.primary} />
                  </Pressable>
                </View>

                {record.treatmentPlans.length === 0 ? (
                  <View style={styles.inlineEmpty}>
                    <MaterialIcons name="assignment" size={22} color={Colors.textTertiary} />
                    <Text style={styles.inlineEmptyText}>Todavía no hay un plan de tratamiento.</Text>
                  </View>
                ) : record.treatmentPlans.map((plan) => (
                  <View key={plan.id} style={styles.planCard}>
                    <View style={styles.cardTopRow}>
                      <View style={styles.flex}>
                        <Text style={styles.planSummary}>{plan.summary}</Text>
                        <Text style={styles.cardDate}>Iniciado {formatDate(plan.startsAt)}</Text>
                      </View>
                      <View style={styles.statusPill}>
                        <Text style={styles.statusText}>{PLAN_STATUS_LABELS[plan.status]}</Text>
                      </View>
                    </View>
                    {plan.goals.map((goal) => {
                      const next = nextGoalStatus(goal.status);
                      return (
                        <Pressable
                          key={goal.id}
                          disabled={!next || busyAction !== null || !['DRAFT', 'ACTIVE'].includes(plan.status)}
                          onPress={() => void advanceGoal(goal.id, goal.status)}
                          style={styles.goalRow}
                        >
                          {busyAction === goal.id ? (
                            <ActivityIndicator size="small" color={Colors.primary} />
                          ) : (
                            <MaterialIcons
                              name={goal.status === 'ACHIEVED' ? 'check-circle' : 'radio-button-unchecked'}
                              size={20}
                              color={goal.status === 'ACHIEVED' ? Colors.success : Colors.primary}
                            />
                          )}
                          <View style={styles.flex}>
                            <Text style={styles.goalText}>{goal.description}</Text>
                            <Text style={styles.goalStatus}>{GOAL_STATUS_LABELS[goal.status]}</Text>
                          </View>
                        </Pressable>
                      );
                    })}
                    <View style={styles.actionRow}>
                      {plan.status === 'DRAFT' ? (
                        <AppButton
                          label="Activar plan"
                          size="sm"
                          variant="secondary"
                          isLoading={busyAction === plan.id}
                          onPress={() => void runPlanTransition(plan, 'ACTIVATE')}
                        />
                      ) : null}
                      {plan.status === 'ACTIVE' ? (
                        <AppButton
                          label="Completar"
                          size="sm"
                          variant="secondary"
                          isLoading={busyAction === plan.id}
                          onPress={() => void runPlanTransition(plan, 'COMPLETE')}
                        />
                      ) : null}
                      {['DRAFT', 'ACTIVE'].includes(plan.status) ? (
                        <AppButton
                          label="Cancelar"
                          size="sm"
                          variant="ghost"
                          disabled={busyAction !== null}
                          onPress={() => void runPlanTransition(plan, 'CANCEL')}
                        />
                      ) : null}
                    </View>
                  </View>
                ))}

                <View style={styles.timelineHeading}>
                  <View>
                    <Text style={styles.sectionTitle}>Línea clínica</Text>
                    <Text style={styles.sectionCaption}>Notas propias en orden cronológico</Text>
                  </View>
                  <MaterialIcons name="history" size={23} color={Colors.primary} />
                </View>

                {record.encounters.length === 0 ? (
                  <View style={styles.inlineEmpty}>
                    <MaterialIcons name="description" size={22} color={Colors.textTertiary} />
                    <Text style={styles.inlineEmptyText}>Aún no se han registrado encuentros.</Text>
                  </View>
                ) : record.encounters.map((encounter) => (
                  <View key={encounter.id} style={styles.encounterCard}>
                    <View style={styles.timelineRail}>
                      <View style={styles.timelineDot} />
                      <View style={styles.timelineLine} />
                    </View>
                    <View style={styles.encounterBody}>
                      <View style={styles.cardTopRow}>
                        <View style={styles.flex}>
                          <Text style={styles.encounterDate}>{formatDate(encounter.startedAt)}</Text>
                          <Text style={styles.cardDate}>{encounter.reason ?? 'Encuentro clínico'}</Text>
                        </View>
                        <View style={styles.statusPill}>
                          <Text style={styles.statusText}>{NOTE_STATUS_LABELS[encounter.note.status]}</Text>
                        </View>
                      </View>
                      <Text style={styles.noteText}>{encounter.note.content}</Text>
                      <View style={styles.noteMeta}>
                        <MaterialIcons name="layers" size={15} color={Colors.textTertiary} />
                        <Text style={styles.metaText}>Versión {encounter.note.latestVersionNumber}</Text>
                        {encounter.note.signedAt ? (
                          <>
                            <View style={styles.dot} />
                            <MaterialIcons name="verified" size={15} color={Colors.success} />
                            <Text style={styles.metaText}>Firmada</Text>
                          </>
                        ) : null}
                      </View>
                      <View style={styles.actionRow}>
                        {encounter.note.status === 'DRAFT' ? (
                          <>
                            <AppButton
                              label="Editar"
                              size="sm"
                              variant="outline"
                              disabled={busyAction !== null}
                              onPress={() => openNoteEditor(encounter, 'DRAFT')}
                            />
                            <AppButton
                              label="Firmar"
                              size="sm"
                              variant="secondary"
                              isLoading={busyAction === encounter.note.id}
                              onPress={() => confirmSign(encounter)}
                            />
                          </>
                        ) : (
                          <AppButton
                            label="Enmendar"
                            size="sm"
                            variant="outline"
                            disabled={busyAction !== null}
                            onPress={() => openNoteEditor(encounter, 'AMENDMENT')}
                          />
                        )}
                        <AppButton
                          label="Versiones"
                          size="sm"
                          variant="ghost"
                          isLoading={busyAction === `versions:${encounter.note.id}`}
                          onPress={() => void showVersions(encounter.note.id)}
                        />
                      </View>

                      {versionsNoteId === encounter.note.id && versions ? (
                        <View style={styles.versionPanel}>
                          {versions.map((version) => (
                            <View key={version.id} style={styles.versionItem}>
                              <View style={styles.cardTopRow}>
                                <Text style={styles.versionTitle}>Versión {version.versionNumber}</Text>
                                <Text style={styles.versionDate}>{formatDate(version.createdAt)}</Text>
                              </View>
                              <Text style={styles.versionAuthor}>Por {version.author.displayName}</Text>
                              <Text style={styles.versionContent}>{version.content}</Text>
                              {version.amendmentReason ? (
                                <View style={styles.amendmentBox}>
                                  <Text style={styles.amendmentLabel}>Motivo de la enmienda</Text>
                                  <Text style={styles.amendmentText}>{version.amendmentReason}</Text>
                                </View>
                              ) : null}
                            </View>
                          ))}
                        </View>
                      ) : null}
                    </View>
                  </View>
                ))}
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};
