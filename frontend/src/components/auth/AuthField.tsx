import React, { useState } from 'react';
import {
  ReturnKeyTypeOptions,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { CircleCheck, type LucideIcon } from 'lucide-react-native';

import { Colors } from '../../theme/colors';
import { IconSize, IconStroke } from '../../theme/icons';
import { BorderRadius, Spacing } from '../../theme/spacing';
import { FontFamily, Typography } from '../../theme/typography';

type FieldStatus = 'default' | 'valid' | 'error';

interface AuthFieldProps {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly placeholder: string;
  readonly value: string;
  readonly onChangeText: (value: string) => void;
  readonly secureTextEntry?: boolean;
  readonly keyboardType?: 'default' | 'email-address';
  readonly autoCapitalize?: 'none' | 'words';
  readonly autoComplete?: 'email' | 'password' | 'new-password' | 'name' | 'off';
  readonly accessibilityLabel?: string;
  readonly errorMessage?: string;
  readonly helperText?: string;
  readonly valid?: boolean;
  readonly disabled?: boolean;
  readonly rightElement?: React.ReactNode;
  readonly returnKeyType?: ReturnKeyTypeOptions;
  readonly onSubmitEditing?: () => void;
}

export const AuthField: React.FC<AuthFieldProps> = ({
  icon,
  label,
  placeholder,
  value,
  onChangeText,
  secureTextEntry,
  keyboardType = 'default',
  autoCapitalize = 'none',
  autoComplete = 'off',
  accessibilityLabel,
  errorMessage,
  helperText,
  valid = false,
  disabled = false,
  rightElement,
  returnKeyType,
  onSubmitEditing,
}) => {
  const [focused, setFocused] = useState(false);
  const FieldIcon = icon;
  const status: FieldStatus = errorMessage ? 'error' : valid ? 'valid' : 'default';
  const iconColor = status === 'error'
    ? Colors.error
    : focused
      ? Colors.primary
      : status === 'valid'
        ? Colors.success
        : Colors.textTertiary;

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View
        style={[
          styles.inputShell,
          focused && styles.inputShellFocused,
          status === 'error' && styles.inputShellError,
          status === 'valid' && styles.inputShellValid,
          disabled && styles.inputShellDisabled,
        ]}
      >
        <FieldIcon size={IconSize.action} strokeWidth={IconStroke.regular} color={iconColor} />
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.textDisabled}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          autoCorrect={false}
          editable={!disabled}
          accessibilityLabel={accessibilityLabel ?? label}
          accessibilityHint={errorMessage ?? helperText}
          accessibilityState={{ disabled }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
        />
        {rightElement ? (
          <View style={styles.right}>{rightElement}</View>
        ) : status === 'valid' ? (
          <View
            accessible
            accessibilityLabel={`${label} válido`}
            style={styles.statusIcon}
          >
            <CircleCheck
              size={IconSize.inline}
              strokeWidth={IconStroke.emphasized}
              color={Colors.success}
            />
          </View>
        ) : null}
      </View>
      {errorMessage ? (
        <Text style={styles.errorText} accessibilityRole="alert">
          {errorMessage}
        </Text>
      ) : helperText ? (
        <Text style={styles.helperText}>{helperText}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: { gap: Spacing.sm },
  label: {
    ...Typography.bodySmall,
    fontFamily: FontFamily.bodySemiBold,
    color: Colors.textSecondary,
  },
  inputShell: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.base,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  inputShellFocused: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySubtle,
  },
  inputShellError: { borderColor: Colors.error, backgroundColor: Colors.errorSurface },
  inputShellValid: { borderColor: Colors.successBorder },
  inputShellDisabled: { opacity: 0.55, backgroundColor: Colors.surfaceMuted },
  input: {
    ...Typography.bodyLarge,
    flex: 1,
    color: Colors.textPrimary,
    paddingVertical: Spacing.md,
    padding: 0,
  },
  right: { marginLeft: Spacing.xs },
  statusIcon: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: { ...Typography.caption, color: Colors.error },
  helperText: { ...Typography.caption, color: Colors.textTertiary },
});
