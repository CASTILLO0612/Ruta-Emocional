import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, Phone } from 'lucide-react-native';
import React from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import type { AppNavigation } from '../../navigation/navigationTypes';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Typography } from '../../theme/typography';

export const CallSessionScreen: React.FC = () => {
  const navigation = useNavigation<AppNavigation>();
  return (
    <SafeAreaView style={styles.screen}>
      <Pressable accessibilityRole="button" accessibilityLabel="Volver" onPress={() => navigation.goBack()} style={styles.back}>
        <ArrowLeft size={23} color={Colors.primary} />
      </Pressable>
      <View style={styles.content}>
        <Phone size={34} color={Colors.primary} strokeWidth={1.8} />
        <Text style={styles.title}>Llamadas desde la app móvil</Text>
        <Text style={styles.body}>
          Para cuidar la calidad del audio y video, las llamadas están disponibles en la aplicación nativa para Android y iOS. Puedes continuar la conversación por chat desde este dispositivo.
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  back: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xxl, gap: Spacing.md },
  title: { ...Typography.h2, color: Colors.textPrimary, textAlign: 'center' },
  body: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center', maxWidth: 520 },
});
