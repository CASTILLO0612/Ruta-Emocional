import { Bell, CalendarDays, CircleAlert, Plus, X } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '../../components/common/AppButton';
import { AppointmentCard } from '../../components/appointment/AppointmentCard';
import { AppointmentOptionsSheet } from '../../components/appointment/AppointmentOptionsSheet';
import { AppointmentScheduleSheet } from '../../components/appointment/AppointmentScheduleSheet';
import { ProfessionalAvailabilitySheet } from '../../components/appointment/ProfessionalAvailabilitySheet';
import { ProfessionalAvailabilityView } from '../../components/appointment/ProfessionalAvailabilityView';
import { AppHeader } from '../../components/shared/AppHeader';
import { useAppointmentAgenda } from '../../hooks/useAppointmentAgenda';
import { useProfessionalAvailability } from '../../hooks/useProfessionalAvailability';
import { useAuthStore } from '../../store/useAuthStore';
import { Colors } from '../../theme/colors';
import { BorderRadius, Spacing } from '../../theme/spacing';
import { Typography } from '../../theme/typography';
import { IconSize, IconStroke } from '../../theme/icons';

export const AgendaScreen: React.FC = () => {
  const role = useAuthStore(({ role: currentRole }) => currentRole);
  const canCreate = useAuthStore(({ userProfile }) => (
    userProfile?.capabilities.includes('appointment:create:self') ?? false
  ));
  const canManageAvailability = useAuthStore(({ userProfile }) => (
    userProfile?.capabilities.includes('availability:manage:self') ?? false
  ));
  const [section, setSection] = useState<'APPOINTMENTS' | 'AVAILABILITY'>('APPOINTMENTS');
  const [scope, setScope] = useState<'UPCOMING' | 'HISTORY'>('UPCOMING');
  const {
    relationships,
    policy,
    upcoming,
    history,
    isLoading,
    isRefreshing,
    error,
    reminderMessage,
    dismissReminder,
    refresh,
    openSchedule,
    handlePrimaryAction,
    optionsAppointment,
    setOptionsAppointment,
    handleOptionsReschedule,
    handleCancel,
    mutationId,
    schedule,
  } = useAppointmentAgenda();
  const {
    profile: professionalProfile,
    timezone: availabilityTimezone,
    isLoading: isAvailabilityLoading,
    isRefreshing: isAvailabilityRefreshing,
    isSaving: isAvailabilitySaving,
    isSheetOpen: isAvailabilitySheetOpen,
    error: availabilityError,
    mutationError: availabilityMutationError,
    load: loadAvailability,
    refresh: refreshAvailability,
    save: saveAvailability,
    openEditor: openAvailabilityEditor,
    closeEditor: closeAvailabilityEditor,
  } = useProfessionalAvailability(canManageAvailability);
  const visibleAppointments = scope === 'UPCOMING' ? upcoming : history;
  const openCreateSchedule = () => openSchedule();
  const screenTitle = role === 'psychologist' ? 'Agenda' : 'Citas';
  const screenSubtitle = section === 'AVAILABILITY' && canManageAvailability
    ? 'Define cuándo pueden reservarte'
    : role === 'psychologist'
      ? 'Organiza tus próximas atenciones'
      : 'Consulta y administra tus sesiones';

  const listHeader = (
    <View>
      {error ? (
        <Pressable
          onPress={() => void refresh()}
          style={styles.errorBanner}
          accessibilityRole="button"
          accessibilityLabel="Error al cargar la agenda. Volver a intentar"
        >
          <CircleAlert
            size={IconSize.action}
            strokeWidth={IconStroke.regular}
            color={Colors.error}
          />
          <View style={styles.flex}>
            <Text style={styles.errorText}>{error}</Text>
            <Text style={styles.retryText}>Toca para volver a cargar</Text>
          </View>
        </Pressable>
      ) : null}

      {reminderMessage ? (
        <Pressable
          onPress={dismissReminder}
          style={styles.reminderBanner}
          accessibilityRole="button"
          accessibilityLabel={reminderMessage + ' Cerrar recordatorio'}
        >
          <Bell
            size={IconSize.action}
            strokeWidth={IconStroke.regular}
            color={Colors.primary}
          />
          <Text style={styles.reminderText}>{reminderMessage}</Text>
          <X
            size={IconSize.action}
            strokeWidth={IconStroke.regular}
            color={Colors.textTertiary}
          />
        </Pressable>
      ) : null}

      <View style={styles.segmentedControl}>
        {(['UPCOMING', 'HISTORY'] as const).map((value) => {
          const selected = scope === value;
          return (
            <Pressable
              key={value}
              onPress={() => setScope(value)}
              style={[styles.segment, selected && styles.segmentActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              aria-selected={selected}
            >
              <Text style={[styles.segmentText, selected && styles.segmentTextActive]}>
                {value === 'UPCOMING' ? 'Próximas' : 'Historial'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {visibleAppointments.length > 0 ? (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {scope === 'UPCOMING' ? 'Próximas sesiones' : 'Sesiones anteriores'}
          </Text>
          <Text style={styles.sectionCaption}>
            {visibleAppointments.length === 1
              ? '1 cita'
              : String(visibleAppointments.length) + ' citas'}
          </Text>
        </View>
      ) : null}
    </View>
  );

  const emptyState = (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <CalendarDays
          size={IconSize.state}
          strokeWidth={IconStroke.regular}
          color={Colors.primary}
        />
      </View>
      <Text style={styles.emptyTitle}>
        {scope === 'UPCOMING' ? 'No hay citas próximas' : 'No hay citas en el historial'}
      </Text>
      <Text style={styles.emptyText}>
        {canCreate && relationships.length > 0 && scope === 'UPCOMING'
          ? 'Puedes programar una sesión desde una relación de atención activa.'
          : 'Las citas aparecerán después de establecer una relación de atención activa.'}
      </Text>
      {canCreate && relationships.length > 0 && scope === 'UPCOMING' ? (
        <AppButton
          label="Programar cita"
          onPress={openCreateSchedule}
          size="md"
          style={styles.emptyAction}
        />
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.surface} />
      <AppHeader
        title={screenTitle}
        subtitle={screenSubtitle}
        showBrand={false}
        showBrandMark
        showInbox
        contextualAction={
          section === 'APPOINTMENTS'
          && canCreate
          && relationships.length > 0
          && visibleAppointments.length > 0
            ? {
                label: 'Programar una cita',
                icon: Plus,
                onPress: openCreateSchedule,
              }
            : undefined
        }
      />

      {canManageAvailability ? (
        <View style={styles.primaryNavigation} accessibilityRole="tablist">
          {(['APPOINTMENTS', 'AVAILABILITY'] as const).map((value) => {
            const selected = section === value;
            return (
              <Pressable
                key={value}
                onPress={() => setSection(value)}
                style={[styles.primaryNavigationItem, selected && styles.primaryNavigationItemActive]}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                aria-selected={selected}
              >
                <Text style={[
                  styles.primaryNavigationText,
                  selected && styles.primaryNavigationTextActive,
                ]}>
                  {value === 'APPOINTMENTS' ? 'Citas' : 'Disponibilidad'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {section === 'AVAILABILITY' && canManageAvailability ? (
        isAvailabilityLoading && !professionalProfile ? (
          <View style={styles.centered} accessibilityRole="progressbar">
            <ActivityIndicator color={Colors.primary} size="large" />
            <Text style={styles.supportingText}>Cargando disponibilidad</Text>
          </View>
        ) : availabilityError && !professionalProfile ? (
          <View style={styles.centered}>
            <CircleAlert
              size={IconSize.state}
              strokeWidth={IconStroke.regular}
              color={Colors.error}
            />
            <Text style={styles.availabilityErrorText}>{availabilityError}</Text>
            <AppButton
              label="Volver a intentar"
              variant="outline"
              onPress={() => void loadAvailability()}
            />
          </View>
        ) : professionalProfile ? (
          <ScrollView
            showsVerticalScrollIndicator={false}
            refreshControl={(
              <RefreshControl
                refreshing={isAvailabilityRefreshing}
                onRefresh={() => void refreshAvailability()}
                tintColor={Colors.primary}
              />
            )}
          >
            {availabilityError ? (
              <Pressable
                onPress={() => void loadAvailability()}
                style={[styles.errorBanner, styles.availabilityBanner]}
                accessibilityRole="button"
                accessibilityLabel="No pudimos actualizar la disponibilidad. Volver a intentar"
              >
                <CircleAlert
                  size={IconSize.action}
                  strokeWidth={IconStroke.regular}
                  color={Colors.error}
                />
                <View style={styles.flex}>
                  <Text style={styles.errorText}>{availabilityError}</Text>
                  <Text style={styles.retryText}>Toca para volver a cargar</Text>
                </View>
              </Pressable>
            ) : null}
            <ProfessionalAvailabilityView
              timezone={availabilityTimezone}
              rules={professionalProfile.availability.weeklyRules}
              onEdit={openAvailabilityEditor}
            />
          </ScrollView>
        ) : null
      ) : isLoading ? (
        <View style={styles.centered} accessibilityRole="progressbar">
          <ActivityIndicator color={Colors.primary} size="large" />
          <Text style={styles.supportingText}>Cargando agenda</Text>
        </View>
      ) : (
        <FlatList
          data={visibleAppointments}
          keyExtractor={({ id }) => id}
          renderItem={({ item }) => (
            <AppointmentCard
              appointment={item}
              role={role}
              isBusy={mutationId === item.id}
              onPrimaryAction={handlePrimaryAction}
              onOpenOptions={setOptionsAppointment}
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={emptyState}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={(
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => void refresh()}
              tintColor={Colors.primary}
            />
          )}
          initialNumToRender={6}
          windowSize={7}
        />
      )}

      <AppointmentScheduleSheet
        visible={schedule.visible}
        role={role}
        rescheduling={schedule.rescheduling}
        policy={policy}
        relationships={relationships}
        selectedRelationshipId={schedule.selectedRelationshipId}
        selectedModality={schedule.selectedModality}
        slots={schedule.slots}
        selectedSlot={schedule.selectedSlot}
        isLoadingSlots={schedule.isLoadingSlots}
        isSubmitting={schedule.isSubmitting}
        error={schedule.error}
        onSelectRelationship={schedule.onSelectRelationship}
        onSelectModality={schedule.onSelectModality}
        onSelectSlot={schedule.onSelectSlot}
        onConfirm={() => void schedule.onConfirm()}
        onClose={schedule.onClose}
      />

      <AppointmentOptionsSheet
        appointment={optionsAppointment}
        role={role}
        isSubmitting={Boolean(optionsAppointment && mutationId === optionsAppointment.id)}
        onReschedule={handleOptionsReschedule}
        onCancel={(appointment, reason) => void handleCancel(appointment, reason)}
        onClose={() => {
          if (mutationId === null) setOptionsAppointment(null);
        }}
      />

      <ProfessionalAvailabilitySheet
        visible={isAvailabilitySheetOpen}
        timezone={availabilityTimezone}
        rules={professionalProfile?.availability.weeklyRules ?? []}
        isSubmitting={isAvailabilitySaving}
        error={availabilityMutationError}
        onSubmit={(rules) => void saveAvailability(rules)}
        onClose={closeAvailabilityEditor}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  primaryNavigation: {
    minHeight: 52,
    flexDirection: 'row',
    paddingHorizontal: Spacing.base,
    gap: Spacing.xl,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  primaryNavigationItem: {
    flex: 1,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  primaryNavigationItemActive: {
    borderBottomColor: Colors.primary,
  },
  primaryNavigationText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  primaryNavigationTextActive: {
    color: Colors.primary,
  },
  availabilityErrorText: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    maxWidth: 320,
  },
  availabilityBanner: {
    marginHorizontal: Spacing.base,
    marginTop: Spacing.base,
    marginBottom: 0,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  supportingText: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xxxl,
  },
  separator: {
    height: Spacing.md,
  },
  errorBanner: {
    flexDirection: 'row',
    gap: Spacing.md,
    padding: Spacing.md,
    marginBottom: Spacing.base,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.errorSurface,
    borderWidth: 1,
    borderColor: Colors.errorBorder,
  },
  errorText: {
    ...Typography.bodySmall,
    color: Colors.error,
  },
  retryText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: Spacing.xxs,
  },
  reminderBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    marginBottom: Spacing.base,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.infoSurface,
    borderWidth: 1,
    borderColor: Colors.infoBorder,
  },
  reminderText: {
    ...Typography.bodySmall,
    color: Colors.textPrimary,
    flex: 1,
  },
  segmentedControl: {
    flexDirection: 'row',
    padding: Spacing.xs,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceMuted,
    marginBottom: Spacing.lg,
  },
  segment: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.sm,
  },
  segmentActive: {
    backgroundColor: Colors.surface,
  },
  segmentText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  segmentTextActive: {
    color: Colors.primary,
  },
  sectionHeader: {
    marginBottom: Spacing.md,
    gap: Spacing.xxs,
  },
  sectionTitle: {
    ...Typography.h4,
    color: Colors.textPrimary,
  },
  sectionCaption: {
    ...Typography.bodySmall,
    color: Colors.textTertiary,
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xxxl,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryTint,
    marginBottom: Spacing.base,
  },
  emptyTitle: {
    ...Typography.h3,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  emptyText: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.sm,
    maxWidth: 320,
  },
  emptyAction: {
    marginTop: Spacing.lg,
  },
});
