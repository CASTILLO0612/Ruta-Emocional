import { useFocusEffect } from '@react-navigation/native';
import { randomUUID } from 'expo-crypto';
import {
  BadgeCheck,
  Bot,
  ChevronRight,
  Circle,
  CircleAlert,
  CircleCheck,
  ClipboardList,
  FileText,
  History,
  Layers3,
  LockKeyhole,
  ShieldCheck,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react-native';
import { FilePlus2, Plus, X as MorphX } from 'lucide';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ClinicalEditorSheet,
  ClinicalEditorMode,
} from '../../components/clinical/ClinicalEditorSheet';
import { AppButton } from '../../components/common/AppButton';
import { AppHeader } from '../../components/shared/AppHeader';
import { AppMorphIcon } from '../../components/common/AppMorphIcon';
import { showAlert } from '../../utils/alert';
import { presentUserError } from '../../utils/userFacingError';
import {
  amendClinicalNote,
  ClinicalEncounter,
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
import { IconSize, IconStroke } from '../../theme/icons';
import {
  formatClinicalDate,
  getNextGoalStatus,
  GOAL_STATUS_LABELS,
  NOTE_STATUS_LABELS,
  PLAN_STATUS_LABELS,
} from '../../utils/clinicalPresentation';
import { clinicalRecordsStyles as styles } from './clinicalRecordsStyles';

type RecordSection = 'OVERVIEW' | 'PLAN' | 'NOTES';

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
  const [editorMode, setEditorMode] = useState<ClinicalEditorMode>(null);
  const [editingEncounter, setEditingEncounter] = useState<ClinicalEncounter | null>(null);
  const [noteContent, setNoteContent] = useState('');
  const [encounterReason, setEncounterReason] = useState('');
  const [amendmentReason, setAmendmentReason] = useState('');
  const [planSummary, setPlanSummary] = useState('');
  const [goalDescription, setGoalDescription] = useState('');
  const [versions, setVersions] = useState<readonly ClinicalNoteVersion[] | null>(null);
  const [versionsNoteId, setVersionsNoteId] = useState<string | null>(null);
  const [triageAssessment, setTriageAssessment] = useState<TriageAssessment | null>(null);
  const [recordSection, setRecordSection] = useState<RecordSection>('OVERVIEW');

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
      setError(presentUserError(loadError, 'No pudimos cargar los expedientes. Inténtalo nuevamente.'));
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
    setRecordSection('OVERVIEW');
    setError(null);
    try {
      await loadRecord(patientUserId);
    } catch (loadError) {
      setError(presentUserError(loadError, 'No pudimos abrir el expediente. Inténtalo nuevamente.'));
    }
  }, [loadRecord]);

  const loadTriageAssessment = async (assessmentId: string) => {
    setBusyAction('triage-read');
    setError(null);
    try {
      setTriageAssessment(await fetchTriageAssessment(assessmentId));
    } catch (triageError) {
      setError(presentUserError(triageError, 'No pudimos abrir la orientación. Inténtalo nuevamente.'));
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
      setError(presentUserError(triageError, 'No pudimos registrar la revisión. Inténtalo nuevamente.'));
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
    setRecordSection('NOTES');
    setEditorMode('ENCOUNTER');
  }, []);

  const openNoteEditor = useCallback((encounter: ClinicalEncounter, mode: 'DRAFT' | 'AMENDMENT') => {
    setEditingEncounter(encounter);
    setNoteContent(encounter.note.content);
    setEncounterReason('');
    setAmendmentReason('');
    setRecordSection('NOTES');
    setEditorMode(mode);
  }, []);

  const selectRecordSection = useCallback((section: RecordSection) => {
    if (editorMode || busyAction) return;
    setRecordSection(section);
    setVersions(null);
    setVersionsNoteId(null);
    if (section !== 'OVERVIEW') setTriageAssessment(null);
  }, [busyAction, editorMode]);

  const togglePlanEditor = useCallback(() => {
    if (editorMode === 'PLAN') {
      closeEditor();
      return;
    }
    setRecordSection('PLAN');
    setEditorMode('PLAN');
  }, [closeEditor, editorMode]);

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
      setError(presentUserError(mutationError, 'No pudimos guardar los cambios. Inténtalo nuevamente.'));
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
        setError(presentUserError(mutationError, 'No pudimos crear el plan. Inténtalo nuevamente.'));
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
    showAlert(
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
      ],
      'warning'
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
      setError(presentUserError(loadError, 'No pudimos cargar las versiones. Inténtalo nuevamente.'));
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
      setError(presentUserError(mutationError, 'No pudimos actualizar el plan. Inténtalo nuevamente.'));
    } finally {
      setBusyAction(null);
    }
  }, [replacePlan]);

  const advanceGoal = useCallback(async (goalId: string, status: TreatmentGoalStatus) => {
    const next = getNextGoalStatus(status);
    if (!next) return;
    setBusyAction(goalId);
    setError(null);
    try {
      replacePlan(await updateTreatmentGoalStatus(goalId, next, randomUUID()));
    } catch (mutationError) {
      setError(presentUserError(mutationError, 'No pudimos actualizar el objetivo. Inténtalo nuevamente.'));
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
    <SafeAreaView style={styles.screen} edges={['left', 'right']}>
      <AppHeader
        title="Pacientes"
        subtitle="Historia clínica privada y versionada"
        showBrand={false}
        showBrandMark
        showMenta
        showInbox
      />

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
            <CircleAlert size={20} color={Colors.error} strokeWidth={1.9} />
            <Text style={styles.errorText}>{error}</Text>
            <X size={18} color={Colors.textTertiary} strokeWidth={2} />
          </Pressable>
        ) : null}

        {patients.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <UsersRound size={30} color={Colors.primary} strokeWidth={1.7} />
            </View>
            <Text style={styles.emptyTitle}>Sin pacientes activos</Text>
            <Text style={styles.emptyText}>
              Los expedientes aparecerán cuando exista una relación asistencial activa.
            </Text>
          </View>
        ) : (
          <>
            <FlatList
              horizontal
              data={patients}
              keyExtractor={({ patientUserId }) => patientUserId}
              showsHorizontalScrollIndicator={false}
              style={styles.patientStrip}
              contentContainerStyle={styles.patientStripContent}
              initialNumToRender={5}
              windowSize={5}
              renderItem={({ item: patient }) => {
                const selected = patient.patientUserId === selectedPatientId;
                return (
                  <Pressable
                    key={patient.patientUserId}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    aria-pressed={selected}
                    onPress={() => void choosePatient(patient.patientUserId)}
                    style={[styles.patientChip, selected && styles.patientChipSelected]}
                  >
                    <View style={[styles.avatar, selected && styles.avatarSelected]}>
                      <UserRound
                        size={20}
                        color={selected ? Colors.textInverse : Colors.primary}
                        strokeWidth={1.9}
                      />
                    </View>
                    <View>
                      <Text style={[styles.patientName, selected && styles.patientNameSelected]}>
                        {patient.displayName}
                      </Text>
                      <Text style={[styles.patientMeta, selected && styles.patientMetaSelected]}>
                        {patient.draftNotesCount > 0
                          ? `${patient.draftNotesCount} borrador${patient.draftNotesCount === 1 ? '' : 'es'}`
                          : patient.lastEncounterAt ? formatClinicalDate(patient.lastEncounterAt) : 'Sin encuentros'}
                      </Text>
                    </View>
                  </Pressable>
                );
              }}
            />

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
                    <AppMorphIcon
                      icon={editorMode === 'ENCOUNTER' ? MorphX : FilePlus2}
                      size={IconSize.navigation}
                      color={Colors.textInverse}
                      strokeWidth={editorMode === 'ENCOUNTER' ? IconStroke.emphasized : IconStroke.regular}
                    />
                  </Pressable>
                </View>

                <View style={styles.recordNavigation} accessibilityRole="tablist">
                  {([
                    ['OVERVIEW', 'Resumen'],
                    ['PLAN', 'Plan'],
                    ['NOTES', 'Notas'],
                  ] as const).map(([value, label]) => {
                    const selected = recordSection === value;
                    return (
                      <Pressable
                        key={value}
                        onPress={() => selectRecordSection(value)}
                        disabled={Boolean(editorMode || busyAction)}
                        accessibilityRole="tab"
                        accessibilityState={{ selected, disabled: Boolean(editorMode || busyAction) }}
                        aria-selected={selected}
                        style={[styles.recordTab, selected && styles.recordTabSelected]}
                      >
                        <Text style={[styles.recordTabText, selected && styles.recordTabTextSelected]}>
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {recordSection === 'OVERVIEW' ? (
                  <View style={styles.overviewSection}>
                    <View style={styles.clinicalSummary}>
                      <View style={styles.summaryMetric}>
                        <Text style={styles.summaryValue}>{record.encounters.length}</Text>
                        <Text style={styles.summaryLabel}>Encuentros</Text>
                      </View>
                      <View style={styles.summaryDivider} />
                      <View style={styles.summaryMetric}>
                        <Text style={styles.summaryValue}>{record.treatmentPlans.length}</Text>
                        <Text style={styles.summaryLabel}>Planes</Text>
                      </View>
                      <View style={styles.summaryDivider} />
                      <View style={styles.summaryMetric}>
                        <Text style={styles.summaryValue}>{selectedPatient.draftNotesCount}</Text>
                        <Text style={styles.summaryLabel}>Borradores</Text>
                      </View>
                    </View>
                    <View style={styles.privacyNotice}>
                      <LockKeyhole size={IconSize.inline} color={Colors.primary} strokeWidth={IconStroke.regular} />
                      <Text style={styles.privacyNoticeText}>
                        Información clínica privada. Solo se muestra dentro de esta relación asistencial.
                      </Text>
                    </View>

                {selectedPatient.triageAssessmentId ? (
                  triageAssessment ? (
                    <View style={styles.triageCard}>
                      <View style={styles.triageHeading}>
                        <View style={styles.triageIcon}>
                          <ShieldCheck size={21} color={Colors.primary} strokeWidth={1.9} />
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
                          <X size={20} color={Colors.textTertiary} strokeWidth={2} />
                        </Pressable>
                      </View>
                      <Text style={styles.triageSummary}>{triageAssessment.orientationSummary}</Text>
                      <View style={styles.triageTransparency}>
                        <Bot size={16} color={Colors.textTertiary} strokeWidth={1.8} />
                        <Text style={styles.triageTransparencyText}>
                          Orientación automatizada, no diagnóstico · Reglas {triageAssessment.evaluatorVersion}
                        </Text>
                      </View>
                      {triageAssessment.reviewedAt ? (
                        <View style={styles.reviewedMark}>
                          <BadgeCheck size={18} color={Colors.success} strokeWidth={2} />
                          <Text style={styles.reviewedText}>
                            Revisada {formatClinicalDate(triageAssessment.reviewedAt)}
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
                        <ShieldCheck size={22} color={Colors.primary} strokeWidth={1.9} />
                      )}
                      <View style={styles.flex}>
                        <Text style={styles.triageLauncherTitle}>Revisar orientación MENTA</Text>
                        <Text style={styles.triageLauncherText}>
                          Resultado previo congelado al iniciar la relación asistencial.
                        </Text>
                      </View>
                      <ChevronRight size={22} color={Colors.textTertiary} strokeWidth={2} />
                    </Pressable>
                  )
                ) : (
                  <View style={styles.inlineEmpty}>
                    <ShieldCheck size={IconSize.action} color={Colors.textTertiary} strokeWidth={IconStroke.regular} />
                    <Text style={styles.inlineEmptyText}>No hay una orientación previa vinculada.</Text>
                  </View>
                )}
                  </View>
                ) : null}

                {recordSection === 'PLAN' ? (
                  <>
                <View style={styles.sectionHeadingWithAction}>
                  <View>
                    <Text style={styles.sectionTitle}>Plan de tratamiento</Text>
                    <Text style={styles.sectionCaption}>Objetivos y seguimiento del proceso</Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Crear plan de tratamiento"
                    onPress={togglePlanEditor}
                    style={styles.secondaryIconButton}
                  >
                    <AppMorphIcon
                      icon={editorMode === 'PLAN' ? MorphX : Plus}
                      size={IconSize.action}
                      color={Colors.primary}
                      strokeWidth={IconStroke.emphasized}
                    />
                  </Pressable>
                </View>

                {record.treatmentPlans.length === 0 ? (
                  <View style={styles.inlineEmpty}>
                    <ClipboardList size={22} color={Colors.textTertiary} strokeWidth={1.9} />
                    <Text style={styles.inlineEmptyText}>Todavía no hay un plan de tratamiento.</Text>
                  </View>
                ) : record.treatmentPlans.map((plan) => (
                  <View key={plan.id} style={styles.planCard}>
                    <View style={styles.cardTopRow}>
                      <View style={styles.flex}>
                        <Text style={styles.planSummary}>{plan.summary}</Text>
                        <Text style={styles.cardDate}>Iniciado {formatClinicalDate(plan.startsAt)}</Text>
                      </View>
                      <View style={styles.statusPill}>
                        <Text style={styles.statusText}>{PLAN_STATUS_LABELS[plan.status]}</Text>
                      </View>
                    </View>
                    {plan.goals.map((goal) => {
                      const next = getNextGoalStatus(goal.status);
                      return (
                        <Pressable
                          key={goal.id}
                          disabled={!next || busyAction !== null || !['DRAFT', 'ACTIVE'].includes(plan.status)}
                          onPress={() => void advanceGoal(goal.id, goal.status)}
                          style={styles.goalRow}
                        >
                          {busyAction === goal.id ? (
                            <ActivityIndicator size="small" color={Colors.primary} />
                          ) : goal.status === 'ACHIEVED' ? (
                            <CircleCheck size={20} color={Colors.success} strokeWidth={2} />
                          ) : (
                            <Circle size={20} color={Colors.primary} strokeWidth={1.8} />
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
                  </>
                ) : null}

                {recordSection === 'NOTES' ? (
                  <>
                <View style={styles.timelineHeading}>
                  <View>
                    <Text style={styles.sectionTitle}>Línea clínica</Text>
                    <Text style={styles.sectionCaption}>Notas propias en orden cronológico</Text>
                  </View>
                  <History size={23} color={Colors.primary} strokeWidth={1.9} />
                </View>

                {record.encounters.length === 0 ? (
                  <View style={styles.inlineEmpty}>
                    <FileText size={22} color={Colors.textTertiary} strokeWidth={1.9} />
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
                          <Text style={styles.encounterDate}>{formatClinicalDate(encounter.startedAt)}</Text>
                          <Text style={styles.cardDate}>{encounter.reason ?? 'Encuentro clínico'}</Text>
                        </View>
                        <View style={styles.statusPill}>
                          <Text style={styles.statusText}>{NOTE_STATUS_LABELS[encounter.note.status]}</Text>
                        </View>
                      </View>
                      <Text style={styles.noteText}>{encounter.note.content}</Text>
                      <View style={styles.noteMeta}>
                        <Layers3 size={15} color={Colors.textTertiary} strokeWidth={1.9} />
                        <Text style={styles.metaText}>Versión {encounter.note.latestVersionNumber}</Text>
                        {encounter.note.signedAt ? (
                          <>
                            <View style={styles.dot} />
                            <BadgeCheck size={15} color={Colors.success} strokeWidth={2} />
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
                                <Text style={styles.versionDate}>{formatClinicalDate(version.createdAt)}</Text>
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
            ) : null}
          </>
        )}
      </ScrollView>
      <ClinicalEditorSheet
        mode={editorMode}
        policy={policy}
        noteContent={noteContent}
        encounterReason={encounterReason}
        amendmentReason={amendmentReason}
        planSummary={planSummary}
        goalDescription={goalDescription}
        canSubmit={canSubmitEditor}
        isSubmitting={busyAction !== null}
        onNoteContentChange={setNoteContent}
        onEncounterReasonChange={setEncounterReason}
        onAmendmentReasonChange={setAmendmentReason}
        onPlanSummaryChange={setPlanSummary}
        onGoalDescriptionChange={setGoalDescription}
        onSubmit={() => void submitEditor()}
        onClose={closeEditor}
      />
    </SafeAreaView>
  );
};
