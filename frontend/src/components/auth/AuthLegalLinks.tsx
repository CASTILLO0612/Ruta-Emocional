import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { AuthNavigation, LegalSection } from '../../navigation/navigationTypes';
import { Colors } from '../../theme/colors';
import { Layout } from '../../theme/layout';
import { Spacing } from '../../theme/spacing';
import { FontFamily, Typography } from '../../theme/typography';

interface AuthLegalLinksProps {
  readonly navigation: AuthNavigation;
}

const LINKS: readonly { label: string; section: LegalSection }[] = [
  { label: 'Privacidad', section: 'privacy' },
  { label: 'Términos', section: 'terms' },
  { label: 'Ayuda', section: 'help' },
];

export const AuthLegalLinks: React.FC<AuthLegalLinksProps> = ({ navigation }) => (
  <View style={styles.container} accessibilityRole="menu">
    {LINKS.map(({ label, section }, index) => (
      <React.Fragment key={section}>
        {index > 0 ? <Text style={styles.separator} accessibilityElementsHidden>·</Text> : null}
        <TouchableOpacity
          style={styles.link}
          onPress={() => navigation.navigate('LegalInformation', { section })}
          accessibilityRole="link"
          accessibilityLabel={label}
        >
          <Text style={styles.linkText}>{label}</Text>
        </TouchableOpacity>
      </React.Fragment>
    ))}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: Spacing.sm,
  },
  link: {
    minHeight: Layout.minimumTouchTarget,
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
  },
  linkText: {
    ...Typography.caption,
    fontFamily: FontFamily.bodyMedium,
    color: Colors.textSecondary,
  },
  separator: { ...Typography.caption, color: Colors.borderStrong },
});
