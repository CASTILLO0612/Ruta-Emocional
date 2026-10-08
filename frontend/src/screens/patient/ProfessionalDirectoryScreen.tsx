import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SearchX } from 'lucide-react-native';

import { AppButton } from '../../components/common/AppButton';
import { ProfessionalCompactCard } from '../../components/shared/ProfessionalCompactCard';
import { AppHeader } from '../../components/shared/AppHeader';
import type { SpecialtyCatalogItem } from '../../models/ProfessionalProfile';
import type { DirectoryModality, Psychologist } from '../../models/Psychologist';
import type { AppNavigation } from '../../navigation/navigationTypes';
import { getSpecialtyCatalog } from '../../repositories/ProfessionalProfileRepository';
import { getAvailablePsychologistPage } from '../../repositories/PsychologistRepository';
import { Colors } from '../../theme/colors';
import { IconSize, IconStroke } from '../../theme/icons';
import { Spacing } from '../../theme/spacing';
import { FontFamily, Typography } from '../../theme/typography';
import { formatModalityLabel } from '../../utils/modality';
import { presentUserError } from '../../utils/userFacingError';

const MODALITIES: readonly DirectoryModality[] = ['CHAT', 'CALL', 'IN_PERSON'];

export const ProfessionalDirectoryScreen: React.FC = () => {
  const navigation = useNavigation<AppNavigation>();
  const requestGeneration = useRef(0);
  const loadingMoreRef = useRef(false);
  const [items, setItems] = useState<readonly Psychologist[]>([]);
  const [specialties, setSpecialties] = useState<readonly SpecialtyCatalogItem[]>([]);
  const [specialty, setSpecialty] = useState<string | null>(null);
  const [modality, setModality] = useState<DirectoryModality | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (options: { readonly cursor?: string; readonly signal?: AbortSignal } = {}) => {
    const appending = Boolean(options.cursor);
    if (appending && loadingMoreRef.current) return;
    const generation = ++requestGeneration.current;
    if (appending) {
      loadingMoreRef.current = true;
      setIsLoadingMore(true);
    }
    else {
      loadingMoreRef.current = false;
      setIsLoadingMore(false);
      setIsLoading(true);
    }
    setError(null);
    try {
      const page = await getAvailablePsychologistPage({
        ...(specialty ? { specialty } : {}),
        ...(modality ? { modality } : {}),
        ...(options.cursor ? { cursor: options.cursor } : {}),
        limit: 20,
      }, options.signal);
      if (options.signal?.aborted || generation !== requestGeneration.current) return;
      setItems((current) => appending ? [...current, ...page.items] : page.items);
      setNextCursor(page.nextCursor);
    } catch (loadError) {
      if (options.signal?.aborted || (loadError instanceof Error && loadError.name === 'AbortError')) return;
      if (generation !== requestGeneration.current) return;
      setError(presentUserError(loadError, 'No pudimos cargar el directorio profesional.'));
    } finally {
      if (!options.signal?.aborted && generation === requestGeneration.current) {
        setIsLoading(false);
        setIsLoadingMore(false);
        loadingMoreRef.current = false;
      }
    }
  }, [modality, specialty]);

  useEffect(() => {
    const controller = new AbortController();
    void getSpecialtyCatalog(controller.signal)
      .then(setSpecialties)
      .catch(() => setSpecialties([]));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setItems([]);
    setNextCursor(null);
    void load({ signal: controller.signal });
    return () => {
      requestGeneration.current += 1;
      controller.abort();
    };
  }, [load]);

  const refresh = async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  };

  const filters = (
    <View style={styles.filters}>
      <Text style={styles.filterLabel}>Especialidad</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        <FilterOption label="Todas" selected={specialty === null} onPress={() => setSpecialty(null)} />
        {specialties.map((item) => (
          <FilterOption
            key={item.code}
            label={item.name}
            selected={specialty === item.code}
            onPress={() => setSpecialty(item.code)}
          />
        ))}
      </ScrollView>

      <Text style={styles.filterLabel}>Modalidad</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        <FilterOption label="Todas" selected={modality === null} onPress={() => setModality(null)} />
        {MODALITIES.map((item) => (
          <FilterOption
            key={item}
            label={formatModalityLabel(item)}
            selected={modality === item}
            onPress={() => setModality(item)}
          />
        ))}
      </ScrollView>
    </View>
  );

  return (
    <View style={styles.screen}>
      <AppHeader title="Profesionales" subtitle="Perfiles verificados" showBack />
      {filters}
      {isLoading && items.length === 0 ? (
        <View style={styles.centered} accessibilityRole="progressbar">
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.supporting}>Buscando profesionales</Text>
        </View>
      ) : error && items.length === 0 ? (
        <View style={styles.centered} accessibilityRole="alert">
          <Text style={styles.emptyTitle}>No pudimos cargar el directorio</Text>
          <Text style={styles.supporting}>{error}</Text>
          <AppButton label="Volver a intentar" variant="outline" onPress={() => void load()} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={({ id }) => id}
          renderItem={({ item, index }) => (
            <ProfessionalCompactCard
              psychologist={item}
              isLast={index === items.length - 1}
              onPress={() => navigation.navigate('PsychologistProfile', { psychologistId: item.id })}
            />
          )}
          contentContainerStyle={[styles.list, items.length === 0 && styles.emptyList]}
          refreshControl={(
            <RefreshControl refreshing={isRefreshing} onRefresh={() => void refresh()} tintColor={Colors.primary} />
          )}
          ListEmptyComponent={(
            <View style={styles.empty}>
              <SearchX size={IconSize.state} color={Colors.primary} strokeWidth={IconStroke.regular} />
              <Text style={styles.emptyTitle}>Sin resultados</Text>
              <Text style={styles.supporting}>Prueba otra especialidad o modalidad.</Text>
              <AppButton
                label="Limpiar filtros"
                variant="outline"
                onPress={() => {
                  setSpecialty(null);
                  setModality(null);
                }}
              />
            </View>
          )}
          ListFooterComponent={isLoadingMore ? (
            <ActivityIndicator style={styles.footerLoader} color={Colors.primary} />
          ) : null}
          onEndReached={() => {
            if (nextCursor && !isLoadingMore) void load({ cursor: nextCursor });
          }}
          onEndReachedThreshold={0.35}
          initialNumToRender={8}
          windowSize={7}
          removeClippedSubviews
        />
      )}
    </View>
  );
};

const FilterOption: React.FC<{
  readonly label: string;
  readonly selected: boolean;
  readonly onPress: () => void;
}> = ({ label, selected, onPress }) => (
  <Pressable
    onPress={onPress}
    style={[styles.filterOption, selected && styles.filterOptionSelected]}
    accessibilityRole="radio"
    accessibilityState={{ checked: selected }}
    aria-checked={selected}
  >
    <Text style={[styles.filterOptionText, selected && styles.filterOptionTextSelected]}>{label}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  filters: {
    paddingTop: Spacing.md, paddingBottom: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.divider, backgroundColor: Colors.surface,
  },
  filterLabel: {
    ...Typography.caption, color: Colors.textSecondary,
    paddingHorizontal: Spacing.base, marginBottom: Spacing.xs,
  },
  filterRow: { paddingHorizontal: Spacing.base, gap: Spacing.lg, marginBottom: Spacing.md },
  filterOption: {
    minHeight: 36, justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  filterOptionSelected: { borderBottomColor: Colors.primary },
  filterOptionText: { ...Typography.bodySmall, color: Colors.textSecondary },
  filterOptionTextSelected: { color: Colors.primary, fontFamily: FontFamily.bodySemiBold },
  list: { paddingHorizontal: Spacing.base, paddingTop: Spacing.sm, paddingBottom: Spacing.xxxl },
  emptyList: { flexGrow: 1 },
  centered: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  emptyTitle: { ...Typography.h3, color: Colors.textPrimary, textAlign: 'center' },
  supporting: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center', maxWidth: 380 },
  footerLoader: { marginVertical: Spacing.xl },
});
