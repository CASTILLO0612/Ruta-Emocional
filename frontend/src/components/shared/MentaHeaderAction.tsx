/**
 * MentaHeaderAction — Botón de encabezado para acceder al agente MENTA.
 *
 * Muestra el acceso unificado a MENTA desde cualquier pantalla autorizada,
 * navegando hacia MentaAgentScreen en el AppStack.
 */
import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { BrainCircuit } from 'lucide-react-native';

import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { IconSize, IconStroke } from '../../theme/icons';

interface MentaHeaderActionProps {
  readonly accessibilityLabel?: string;
  readonly color?: string;
}

export const MentaHeaderAction: React.FC<MentaHeaderActionProps> = ({
  accessibilityLabel = 'Abrir MENTA',
  color = Colors.textPrimary,
}) => {
  const navigation = useNavigation();

  return (
    <TouchableOpacity
      onPress={() => (navigation as any).navigate('MentaAgent')}
      style={styles.button}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <BrainCircuit
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
