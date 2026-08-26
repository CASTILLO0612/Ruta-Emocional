import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { BorderRadius, Spacing } from '../../theme/spacing';
import { Modality } from '../../models/Psychologist';

interface PastSession {
  id: string;
  professionalName: string;
  specialty: string;
  date: string;
  time: string;
  price: number;
  modality: Modality;
  status: 'completed' | 'cancelled';
}

const MOCK_HISTORY: PastSession[] = [
  {
    id: 'h_001',
    professionalName: 'Dra. Maria Elena Castillo',
    specialty: 'Ansiedad y Estrés',
    date: '08 Jul 2026',
    time: '10:00',
    price: 350,
    modality: 'chat',
    status: 'completed',
  },
  {
    id: 'h_002',
    professionalName: 'Dr. Carlos Méndez Ríos',
    specialty: 'Depresión y Duelo',
    date: '05 Jul 2026',
    time: '16:30',
    price: 500,
    modality: 'call',
    status: 'completed',
  },
  {
    id: 'h_003',
    professionalName: 'Lic. Sofía Vargas Luna',
    specialty: 'Trauma y TEPT',
    date: '28 Jun 2026',
    time: '14:00',
    price: 450,
    modality: 'chat',
    status: 'completed',
  },
  {
    id: 'h_004',
    professionalName: 'Dr. Roberto Jiménez',
    specialty: 'Pareja y Familia',
    date: '20 Jun 2026',
    time: '11:00',
    price: 700,
    modality: 'in-person',
    status: 'cancelled',
  },
];

const MODALITY_ICONS: Record<string, keyof typeof MaterialIcons.glyphMap> = {
  chat: 'chat-bubble-outline',
  call: 'phone',
  video: 'videocam',
  'in-person': 'directions-walk',
};

const MODALITY_LABELS: Record<string, string> = {
  chat: 'Chat',
  call: 'Llamada',
  video: 'Video',
  'in-person': 'Presencial',
};

export const HistoryScreen: React.FC = () => {
  const navigation = useNavigation<any>();

  const renderItem = ({ item, index }: { item: PastSession; index: number }) => {
    const isCompleted = item.status === 'completed';
    const isLast = index === MOCK_HISTORY.length - 1;

    return (
      <TouchableOpacity
        style={[styles.row, isLast && styles.rowLast]}
        activeOpacity={0.6}
        accessibilityLabel={`Sesión con ${item.professionalName}`}
      >
        {/* Icono de modalidad */}
        <View style={[styles.modalityIcon, isCompleted ? styles.modalityIconDone : styles.modalityIconCancelled]}>
          <MaterialIcons
            name={MODALITY_ICONS[item.modality] || 'chat-bubble-outline'}
            size={18}
            color={isCompleted ? Colors.primary : Colors.textTertiary}
          />
        </View>

        {/* Info principal */}
        <View style={styles.rowInfo}>
          <View style={styles.rowTop}>
            <Text style={styles.name} numberOfLines={1}>{item.professionalName}</Text>
            <Text style={[styles.price, !isCompleted && styles.priceCancelled]}>
              {isCompleted ? `C$${item.price}` : '—'}
            </Text>
          </View>
          <View style={styles.rowMeta}>
            <Text style={styles.specialty} numberOfLines={1}>{item.specialty}</Text>
            <View style={[styles.statusPill, isCompleted ? styles.pillDone : styles.pillCancelled]}>
              <Text style={[styles.statusText, isCompleted ? styles.textDone : styles.textCancelled]}>
                {isCompleted ? 'Completado' : 'Cancelado'}
              </Text>
            </View>
          </View>
          <View style={styles.rowBottom}>
            <MaterialIcons name="access-time" size={11} color={Colors.textTertiary} />
            <Text style={styles.datetime}>{item.date} · {item.time}</Text>
            <Text style={styles.modalityLabel}>· {MODALITY_LABELS[item.modality]}</Text>
          </View>
        </View>

        <MaterialIcons name="chevron-right" size={18} color={Colors.borderStrong} />
      </TouchableOpacity>
    );
  };

  const ListHeader = () => (
    <View style={styles.listHeader}>
      <Text style={styles.sectionLabel}>{MOCK_HISTORY.length} sesiones</Text>
    </View>
  );

  const ListEmpty = () => (
    <View style={styles.emptyState}>
      <MaterialIcons name="history" size={40} color={Colors.textDisabled} />
      <Text style={styles.emptyTitle}>Sin historial aún</Text>
      <Text style={styles.emptySub}>Tus sesiones completadas aparecerán aquí.</Text>
    </View>
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.surface} />

      <SafeAreaView style={styles.headerSafe}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Historial</Text>
          <Text style={styles.headerSub}>Tus sesiones de apoyo</Text>
        </View>
      </SafeAreaView>

      <FlatList
        data={MOCK_HISTORY}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={<ListHeader />}
        ListEmptyComponent={<ListEmpty />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  headerSafe: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  header: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.base,
    paddingBottom: Spacing.md,
  },
  headerTitle: { ...Typography.h1, color: Colors.textPrimary },
  headerSub: { ...Typography.bodySmall, color: Colors.textSecondary, marginTop: 2 },

  listContent: { paddingBottom: Spacing.xxl },
  listHeader: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xs,
  },
  sectionLabel: { ...Typography.overline, color: Colors.textTertiary },

  // Row — reemplaza cards completamente
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.base,
    backgroundColor: Colors.surface,
    gap: Spacing.md,
  },
  rowLast: {
    borderBottomLeftRadius: BorderRadius.lg,
    borderBottomRightRadius: BorderRadius.lg,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.borderSubtle,
    marginLeft: Spacing.base + 44,
  },
  modalityIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  modalityIconDone: { backgroundColor: Colors.primaryFaded },
  modalityIconCancelled: { backgroundColor: 'transparent' },

  rowInfo: { flex: 1, gap: 4 },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  name: { ...Typography.h4, color: Colors.textPrimary, flex: 1 },
  price: { ...Typography.bodyLarge, fontWeight: '700', color: Colors.primary },
  priceCancelled: { color: Colors.textDisabled },

  rowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  specialty: { ...Typography.bodySmall, color: Colors.textSecondary, flex: 1 },
  statusPill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 1,
    borderRadius: BorderRadius.full,
  },
  pillDone: { backgroundColor: Colors.accentFaded },
  pillCancelled: { backgroundColor: Colors.errorFaded },
  statusText: { ...Typography.caption, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  textDone: { color: Colors.accentDark },
  textCancelled: { color: Colors.error },

  rowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  datetime: { ...Typography.caption, color: Colors.textTertiary },
  modalityLabel: { ...Typography.caption, color: Colors.textTertiary },

  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.md,
  },
  emptyTitle: { ...Typography.h3, color: Colors.textPrimary },
  emptySub: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center' },
});
