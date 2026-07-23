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
import { BorderRadius, Shadow, Spacing } from '../../theme/spacing';
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
    specialty: 'Ansiedad y Estres',
    date: '08/07/2026',
    time: '10:00 AM',
    price: 350,
    modality: 'chat',
    status: 'completed',
  },
  {
    id: 'h_002',
    professionalName: 'Dr. Carlos Mendez Rios',
    specialty: 'Depresion y Duelo',
    date: '05/07/2026',
    time: '04:30 PM',
    price: 500,
    modality: 'call',
    status: 'completed',
  },
  {
    id: 'h_003',
    professionalName: 'Lic. Sofia Vargas Luna',
    specialty: 'Trauma y TEPT',
    date: '28/06/2026',
    time: '02:00 PM',
    price: 450,
    modality: 'chat',
    status: 'completed',
  },
  {
    id: 'h_004',
    professionalName: 'Dr. Roberto Jimenez',
    specialty: 'Pareja y Familia',
    date: '20/06/2026',
    time: '11:00 AM',
    price: 700,
    modality: 'in-person',
    status: 'cancelled',
  },
];

const MODALITY_LABELS: Record<string, string> = {
  chat: 'Sesion de Chat',
  call: 'Llamada de Audio',
  'in-person': 'Consulta Presencial',
};

const MODALITY_ICONS: Record<string, keyof typeof MaterialIcons.glyphMap> = {
  chat: 'chat-bubble-outline',
  call: 'phone',
  'in-person': 'location-on',
};

export const HistoryScreen: React.FC = () => {
  const navigation = useNavigation<any>();

  const renderItem = ({ item }: { item: PastSession }) => {
    const isCompleted = item.status === 'completed';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.modalityBadge}>
            <MaterialIcons
              name={MODALITY_ICONS[item.modality]}
              size={14}
              color={Colors.primary}
            />
            <Text style={styles.modalityText}>
              {MODALITY_LABELS[item.modality]}
            </Text>
          </View>
          <View
            style={[
              styles.statusPill,
              isCompleted ? styles.statusPillCompleted : styles.statusPillCancelled,
            ]}
          >
            <Text
              style={[
                styles.statusText,
                isCompleted ? styles.statusTextCompleted : styles.statusTextCancelled,
              ]}
            >
              {isCompleted ? 'Completado' : 'Cancelado'}
            </Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.name}>{item.professionalName}</Text>
          <Text style={styles.specialty}>{item.specialty}</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.cardFooter}>
          <View style={styles.dateTime}>
            <MaterialIcons name="event" size={14} color={Colors.textSecondary} />
            <Text style={styles.dateTimeText}>
              {item.date} · {item.time}
            </Text>
          </View>
          <Text style={styles.price}>C${item.price}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.surface} />
      
      <SafeAreaView style={styles.appBarSafe}>
        <View style={styles.appBar}>
          <Text style={styles.appBarTitle}>Mis consultas</Text>
          <Text style={styles.appBarSubtitle}>Historial terapeutico</Text>
        </View>
      </SafeAreaView>

      <FlatList
        data={MOCK_HISTORY}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  appBarSafe: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    ...Shadow.sm,
  },
  appBar: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
  },
  appBarTitle: {
    ...Typography.h2,
    color: Colors.textPrimary,
  },
  appBarSubtitle: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  listContent: {
    padding: Spacing.base,
    paddingBottom: Spacing.xxl,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
    ...Shadow.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.primaryFaded,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  modalityText: {
    ...Typography.caption,
    color: Colors.primary,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  statusPill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  statusPillCompleted: {
    backgroundColor: Colors.accentFaded,
  },
  statusPillCancelled: {
    backgroundColor: '#EF444415',
  },
  statusText: {
    ...Typography.caption,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  statusTextCompleted: {
    color: Colors.accentDark,
  },
  statusTextCancelled: {
    color: Colors.error,
  },
  cardBody: {
    gap: 2,
  },
  name: {
    ...Typography.h4,
    color: Colors.textPrimary,
  },
  specialty: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.divider,
    marginVertical: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  dateTimeText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  price: {
    ...Typography.priceSm,
    color: Colors.primary,
  },
});
