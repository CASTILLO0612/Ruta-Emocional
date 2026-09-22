import React, { useRef } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LocateFixed, MapPin, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useModalAccessibilityFocus } from '../../hooks/useModalAccessibilityFocus';
import { useReducedMotionPreference } from '../../hooks/useReducedMotionPreference';
import { Colors } from '../../theme/colors';
import { IconSize, IconStroke } from '../../theme/icons';
import { BorderRadius, Shadow, Spacing } from '../../theme/spacing';
import { Typography } from '../../theme/typography';
import { AppButton } from '../common/AppButton';

interface PracticeLocationSheetProps {
  readonly visible: boolean;
  readonly name: string;
  readonly address: string;
  readonly directions: string;
  readonly coordinates: { readonly latitude: number; readonly longitude: number } | null;
  readonly isLocating: boolean;
  readonly isSaving: boolean;
  readonly onNameChange: (value: string) => void;
  readonly onAddressChange: (value: string) => void;
  readonly onDirectionsChange: (value: string) => void;
  readonly onLocate: () => void;
  readonly onSave: () => void;
  readonly onClose: () => void;
}

export function PracticeLocationSheet({
  visible,
  name,
  address,
  directions,
  coordinates,
  isLocating,
  isSaving,
  onNameChange,
  onAddressChange,
  onDirectionsChange,
  onLocate,
  onSave,
  onClose,
}: PracticeLocationSheetProps) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotionPreference();
  const sheetRef = useRef<View>(null);
  const canSave = name.trim().length >= 2
    && address.trim().length >= 5
    && Boolean(coordinates)
    && !isSaving;
  useModalAccessibilityFocus(sheetRef, visible);

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType={reduceMotion ? 'none' : 'slide'}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
        <View
          ref={sheetRef}
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, Spacing.xl) }]}
          role="dialog"
          accessibilityViewIsModal
          accessibilityLabel="Configurar ubicación del consultorio"
          collapsable={false}
        >
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <View style={styles.iconBox}>
                <MapPin size={IconSize.action} color={Colors.primary} strokeWidth={IconStroke.regular} />
              </View>
              <View style={styles.titleCopy}>
                <Text style={styles.title}>Consultorio</Text>
                <Text style={styles.subtitle}>Se compartirá después de aceptar una atención presencial.</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Cerrar configuración de ubicación"
            >
              <X size={IconSize.action} color={Colors.textSecondary} strokeWidth={IconStroke.regular} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.form}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Nombre del lugar</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={onNameChange}
                placeholder="Consultorio principal"
                placeholderTextColor={Colors.textTertiary}
                maxLength={120}
                accessibilityLabel="Nombre del consultorio"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Dirección</Text>
              <TextInput
                style={styles.input}
                value={address}
                onChangeText={onAddressChange}
                placeholder="Dirección visible para el paciente"
                placeholderTextColor={Colors.textTertiary}
                maxLength={300}
                accessibilityLabel="Dirección del consultorio"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Referencia opcional</Text>
              <TextInput
                style={[styles.input, styles.multilineInput]}
                value={directions}
                onChangeText={onDirectionsChange}
                placeholder="Piso, recepción o punto de referencia"
                placeholderTextColor={Colors.textTertiary}
                maxLength={500}
                multiline
                accessibilityLabel="Referencia para llegar al consultorio"
              />
            </View>

            <TouchableOpacity
              style={styles.locationButton}
              onPress={onLocate}
              disabled={isLocating || isSaving}
              accessibilityRole="button"
              accessibilityLabel="Usar mi ubicación actual como ubicación del consultorio"
            >
              <LocateFixed size={IconSize.action} color={Colors.primary} strokeWidth={IconStroke.regular} />
              <View style={styles.locationCopy}>
                <Text style={styles.locationTitle}>
                  {isLocating ? 'Obteniendo ubicación' : coordinates ? 'Ubicación registrada' : 'Usar ubicación actual'}
                </Text>
                <Text style={styles.locationDetail}>
                  {coordinates
                    ? 'Punto guardado con precisión.'
                    : 'Activa la ubicación mientras estés en el consultorio.'}
                </Text>
              </View>
            </TouchableOpacity>

            <AppButton
              label="Guardar ubicación"
              onPress={onSave}
              disabled={!canSave}
              isLoading={isSaving}
              fullWidth
              size="lg"
            />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: Colors.overlay },
  sheet: {
    width: '100%', maxWidth: 600, maxHeight: '92%', alignSelf: 'center', gap: Spacing.lg,
    paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm,
    borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl,
    backgroundColor: Colors.surface, ...Shadow.lg,
  },
  handle: { width: 36, height: 4, borderRadius: BorderRadius.full, backgroundColor: Colors.borderStrong, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  titleRow: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  iconBox: {
    width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
    borderRadius: BorderRadius.full, backgroundColor: Colors.primaryTint,
  },
  titleCopy: { flex: 1, gap: Spacing.xxs },
  title: { ...Typography.h3, color: Colors.textPrimary },
  subtitle: { ...Typography.bodySmall, color: Colors.textSecondary },
  closeButton: {
    width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
    borderRadius: BorderRadius.full, marginTop: -Spacing.xs, marginRight: -Spacing.sm,
  },
  form: { gap: Spacing.lg },
  fieldGroup: { gap: Spacing.xs },
  label: { ...Typography.label, color: Colors.textSecondary },
  input: {
    ...Typography.body, minHeight: 48, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md,
    backgroundColor: Colors.background, color: Colors.textPrimary,
  },
  multilineInput: { minHeight: 84, textAlignVertical: 'top' },
  locationButton: {
    minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.lg,
    backgroundColor: Colors.primaryTint,
  },
  locationCopy: { flex: 1, gap: Spacing.xxs },
  locationTitle: { ...Typography.label, color: Colors.primary },
  locationDetail: { ...Typography.caption, color: Colors.textSecondary },
});
