import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';

import { AuthShell } from '../../components/auth/AuthShell';
import type {
  AuthNavigation,
  AuthStackParamList,
  LegalSection,
} from '../../navigation/navigationTypes';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { FontFamily, Typography } from '../../theme/typography';

interface ContentSection {
  readonly title: string;
  readonly paragraphs: readonly string[];
}

interface LegalContent {
  readonly title: string;
  readonly subtitle: string;
  readonly sections: readonly ContentSection[];
}

const CONTENT: Readonly<Record<LegalSection, LegalContent>> = {
  privacy: {
    title: 'Privacidad',
    subtitle: 'Cómo tratamos la información en esta versión de Ruta Emocional.',
    sections: [
      {
        title: 'Información necesaria',
        paragraphs: [
          'Usamos los datos de cuenta y perfil para autenticarte, mostrarte funciones según tu rol y conectar solicitudes con profesionales.',
          'La información clínica sólo está disponible para actores autorizados dentro de una relación de atención válida.',
        ],
      },
      {
        title: 'Control y trazabilidad',
        paragraphs: [
          'Las acciones sensibles generan registros de auditoría. Los consentimientos específicos se solicitan dentro del flujo que los necesita.',
        ],
      },
    ],
  },
  terms: {
    title: 'Términos de uso',
    subtitle: 'Condiciones esenciales para utilizar el MVP responsablemente.',
    sections: [
      {
        title: 'Alcance',
        paragraphs: [
          'Ruta Emocional facilita el contacto y la continuidad entre pacientes y profesionales. No sustituye servicios de emergencia ni garantiza resultados clínicos.',
        ],
      },
      {
        title: 'Cuentas profesionales',
        paragraphs: [
          'El panel de psicología se habilita únicamente después de revisar la evidencia profesional y cumplir los requisitos del perfil.',
        ],
      },
      {
        title: 'Uso responsable',
        paragraphs: [
          'Cada persona debe proteger sus credenciales y utilizar la plataforma de forma lícita, respetuosa y coherente con su rol.',
        ],
      },
    ],
  },
  help: {
    title: 'Ayuda para ingresar',
    subtitle: 'Soluciones rápidas para recuperar el acceso.',
    sections: [
      {
        title: 'Revisa tus datos',
        paragraphs: [
          'Confirma que el correo esté completo y que no haya espacios. Puedes mostrar temporalmente la contraseña para revisarla.',
        ],
      },
      {
        title: 'Recupera tu contraseña',
        paragraphs: [
          'Desde el acceso, selecciona “¿Olvidaste tu contraseña?”. La respuesta no confirma si un correo está registrado, para proteger la privacidad de las cuentas.',
        ],
      },
      {
        title: 'Cuenta profesional',
        paragraphs: [
          'Puedes ingresar desde que creas la cuenta. Mientras la verificación esté pendiente, Ruta Emocional te llevará al proceso de habilitación profesional.',
        ],
      },
    ],
  },
};

export const LegalInformationScreen: React.FC = () => {
  const navigation = useNavigation<AuthNavigation>();
  const route = useRoute<RouteProp<AuthStackParamList, 'LegalInformation'>>();
  const content = CONTENT[route.params.section] ?? CONTENT.help;

  return (
    <AuthShell title={content.title} subtitle={content.subtitle} onBack={() => navigation.goBack()}>
      <View style={styles.content}>
        {content.sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.paragraphs.map((paragraph) => (
              <Text key={paragraph} style={styles.paragraph}>{paragraph}</Text>
            ))}
          </View>
        ))}
        <Text style={styles.disclaimer}>
          Documento informativo del MVP. La versión legal definitiva requiere aprobación antes del lanzamiento productivo.
        </Text>
      </View>
    </AuthShell>
  );
};

const styles = StyleSheet.create({
  content: { gap: Spacing.xl },
  section: { gap: Spacing.sm },
  sectionTitle: { ...Typography.h4, color: Colors.textPrimary },
  paragraph: { ...Typography.bodySmall, color: Colors.textSecondary },
  disclaimer: {
    ...Typography.caption,
    fontFamily: FontFamily.bodyMedium,
    color: Colors.textTertiary,
    paddingTop: Spacing.md,
  },
});
