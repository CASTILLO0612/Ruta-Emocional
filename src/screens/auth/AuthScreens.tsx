import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
} from 'react-native';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { BorderRadius, Shadow, Spacing } from '../../theme/spacing';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { registerUser, signIn } from '../../services/AuthService';
import { useAuthStore } from '../../store/useAuthStore';
import { showAlert } from '../../utils/alert';

export const LoginScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { setFirebaseUser } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      showAlert('Campos requeridos', 'Ingresa tu correo y contrasena.');
      return;
    }
    setIsLoading(true);
    try {
      const user = await signIn(email.trim(), password);
      setFirebaseUser(user);
    } catch (error) {
      showAlert('Error de inicio de sesion', `${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
      <View style={styles.header}>
        <SafeAreaView>
          <View style={styles.headerContent}>
            <View style={styles.logoMark}>
              <MaterialIcons name="favorite" size={28} color={Colors.accent} />
            </View>
            <Text style={styles.logoTitle}>Ruta Emocional</Text>
            <Text style={styles.logoSubtitle}>
              Apoyo emocional cuando mas lo necesitas
            </Text>
          </View>
        </SafeAreaView>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <AppCard elevation="lg" style={styles.card}>
            <Text style={styles.cardTitle}>Iniciar sesion</Text>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Correo electronico</Text>
              <View style={styles.inputWrapper}>
                <MaterialIcons name="email" size={18} color={Colors.textSecondary} />
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="tu@correo.com"
                  placeholderTextColor={Colors.textDisabled}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  accessibilityLabel="Email input"
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Contrasena</Text>
              <View style={styles.inputWrapper}>
                <MaterialIcons name="lock-outline" size={18} color={Colors.textSecondary} />
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor={Colors.textDisabled}
                  secureTextEntry={!showPass}
                  autoCapitalize="none"
                  accessibilityLabel="Password input"
                />
                <TouchableOpacity onPress={() => setShowPass((v) => !v)}>
                  <MaterialIcons
                    name={showPass ? 'visibility-off' : 'visibility'}
                    size={18}
                    color={Colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <AppButton
              label="Ingresar"
              onPress={handleLogin}
              variant="secondary"
              size="lg"
              fullWidth
              isLoading={isLoading}
            />

            <TouchableOpacity
              style={styles.registerLink}
              onPress={() => navigation.navigate('Register')}
            >
              <Text style={styles.registerLinkText}>
                No tienes cuenta?{' '}
                <Text style={styles.registerLinkBold}>Registrate</Text>
              </Text>
            </TouchableOpacity>
          </AppCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

export const RegisterScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { setFirebaseUser } = useAuthStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'patient' | 'psychologist'>('patient');
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async () => {
    if (!name || !email || !password) {
      showAlert('Campos requeridos', 'Completa todos los campos.');
      return;
    }
    if (password.length < 6) {
      showAlert('Contrasena insegura', 'Minimo 6 caracteres.');
      return;
    }
    setIsLoading(true);
    try {
      const user = await registerUser(email.trim(), password, name.trim(), role);
      setFirebaseUser(user);
    } catch (error) {
      showAlert('Error de registro', `${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
      <View style={styles.header}>
        <SafeAreaView>
          <View style={styles.headerContent}>
            <View style={styles.logoMark}>
              <MaterialIcons name="favorite" size={28} color={Colors.accent} />
            </View>
            <Text style={styles.logoTitle}>Ruta Emocional</Text>
            <Text style={styles.logoSubtitle}>Crea tu cuenta gratuita</Text>
          </View>
        </SafeAreaView>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <AppCard elevation="lg" style={styles.card}>
            <Text style={styles.cardTitle}>Crear cuenta</Text>

            <View style={styles.roleRow}>
              {(['patient', 'psychologist'] as const).map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.roleChip, role === r && styles.roleChipActive]}
                  onPress={() => setRole(r)}
                >
                  <MaterialIcons
                    name={r === 'patient' ? 'person' : 'psychology'}
                    size={18}
                    color={role === r ? Colors.textInverse : Colors.primary}
                  />
                  <Text
                    style={[styles.roleChipText, role === r && styles.roleChipTextActive]}
                  >
                    {r === 'patient' ? 'Paciente' : 'Psicologo'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Nombre completo</Text>
              <View style={styles.inputWrapper}>
                <MaterialIcons name="person-outline" size={18} color={Colors.textSecondary} />
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Tu nombre"
                  placeholderTextColor={Colors.textDisabled}
                  autoCapitalize="words"
                  accessibilityLabel="Full name input"
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Correo electronico</Text>
              <View style={styles.inputWrapper}>
                <MaterialIcons name="email" size={18} color={Colors.textSecondary} />
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="tu@correo.com"
                  placeholderTextColor={Colors.textDisabled}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  accessibilityLabel="Email input"
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Contrasena</Text>
              <View style={styles.inputWrapper}>
                <MaterialIcons name="lock-outline" size={18} color={Colors.textSecondary} />
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Min. 6 caracteres"
                  placeholderTextColor={Colors.textDisabled}
                  secureTextEntry
                  autoCapitalize="none"
                  accessibilityLabel="Password input"
                />
              </View>
            </View>

            <AppButton
              label="Crear cuenta"
              onPress={handleRegister}
              variant="primary"
              size="lg"
              fullWidth
              isLoading={isLoading}
            />

            <TouchableOpacity
              style={styles.registerLink}
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={styles.registerLinkText}>
                Ya tienes cuenta?{' '}
                <Text style={styles.registerLinkBold}>Inicia sesion</Text>
              </Text>
            </TouchableOpacity>
          </AppCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.primary },
  flex: { flex: 1 },
  header: { backgroundColor: Colors.primary },
  headerContent: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  logoMark: {
    width: 68,
    height: 68,
    borderRadius: BorderRadius.xl,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.accent,
  },
  logoTitle: { ...Typography.h1, color: Colors.textInverse },
  logoSubtitle: { ...Typography.body, color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
  scrollContent: { flexGrow: 1, justifyContent: 'flex-end' },
  card: {
    margin: Spacing.base,
    borderRadius: BorderRadius.xxl,
    gap: Spacing.base,
    padding: Spacing.xl,
  },
  cardTitle: { ...Typography.h2, color: Colors.textPrimary },
  roleRow: { flexDirection: 'row', gap: Spacing.sm },
  roleChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  roleChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  roleChipText: { ...Typography.button, color: Colors.primary, fontSize: 13 },
  roleChipTextActive: { color: Colors.textInverse },
  field: { gap: Spacing.xs },
  fieldLabel: { ...Typography.label, color: Colors.textSecondary },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.background,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
  },
  input: {
    flex: 1,
    ...Typography.body,
    color: Colors.textPrimary,
    padding: 0,
  },
  registerLink: { alignItems: 'center', paddingVertical: Spacing.sm },
  registerLinkText: { ...Typography.body, color: Colors.textSecondary },
  registerLinkBold: { color: Colors.primary, fontWeight: '700' },
});
