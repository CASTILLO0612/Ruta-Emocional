/**
 * InboxHeaderAction — Botón de encabezado para acceder a la bandeja de mensajes.
 *
 * En v1 NO muestra badge de no leídos debido a que el contrato actual de
 * conversaciones no incluye unreadCount ni campos de lectura confiables.
 */
import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MessageCircle } from 'lucide-react-native';

import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { IconSize, IconStroke } from '../../theme/icons';

interface InboxHeaderActionProps {
  readonly accessibilityLabel?: string;
  readonly color?: string;
}

export const InboxHeaderAction: React.FC<InboxHeaderActionProps> = ({
  accessibilityLabel = 'Abrir mensajes',
  color = Colors.textPrimary,
}) => {
  const navigation = useNavigation();

  return (
    <TouchableOpacity
      onPress={() => (navigation as any).navigate('Inbox')}
      style={styles.button}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <MessageCircle
        size={IconSize.navigation}
        color={color}
        strokeWidth={IconStroke.regular}
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    padding: Spacing.xs,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
