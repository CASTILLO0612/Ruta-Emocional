import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  StatusBar,
  Switch,
  Modal,
  Platform,
} from 'react-native';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { BorderRadius, Shadow, Spacing } from '../../theme/spacing';
import { useAuthStore } from '../../store/useAuthStore';
import { signOutUser } from '../../services/AuthService';
import { CustomAlert } from '../../components/common/CustomAlert';

export const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { userProfile, clearAuth } = useAuthStore();
  const isPsychologist = userProfile?.role === 'psychologist';

  const [logoutAlertVisible, setLogoutAlertVisible] = useState(false);
  const [saveSuccessAlertVisible, setSaveSuccessAlertVisible] = useState(false);
  const [activePanel, setActivePanel] = useState<'datos' | 'seguridad' | 'pagos' | 'notificaciones' | 'soporte' | null>(null);

  const [name, setName] = useState(userProfile?.displayName ?? 'Ángel');
  const [email, setEmail] = useState(userProfile?.email ?? 'angel@rutaemocional.ni');
  const [phone, setPhone] = useState('+505 8888-8888');

  const [pin, setPin] = useState('1234');
  const [newPin, setNewPin] = useState('');
  
  const [cardNumber, setCardNumber] = useState('**** **** **** 4321');
  const [cardHolder, setCardHolder] = useState(userProfile?.displayName ?? 'ÁNGEL GONZÁLEZ');
  const [cardExpiry, setCardExpiry] = useState('12/29');
  
  const [notifChat, setNotifChat] = useState(true);
  const [notifOffers, setNotifOffers] = useState(true);
  const [notifEmail, setNotifEmail] = useState(false);

  const [supportText, setSupportText] = useState('');

  const handleSignOut = () => {
    setLogoutAlertVisible(true);
  };

  const handleConfirmSignOut = async () => {
    setLogoutAlertVisible(false);
    try {
      await signOutUser();
      clearAuth();
    } catch (error) {
      console.warn('[Profile] Error signing out', error);
    }
  };

  const handleSavePanel = () => {
    setActivePanel(null);
    setSaveSuccessAlertVisible(true);
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.surface} />
      
      <SafeAreaView style={styles.appBarSafe}>
        <View style={styles.appBar}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            accessibilityLabel="Back button"
          >
            <MaterialIcons name="arrow-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.appBarTitle}>Mi perfil</Text>
          <View style={{ width: 36 }} />
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.profileHeader}>
          <View style={styles.avatarWrapper}>
            {userProfile?.photoURL ? (
              <Image source={{ uri: userProfile.photoURL }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <MaterialIcons
                  name={isPsychologist ? 'psychology' : 'person'}
                  size={42}
                  color={Colors.primary}
                />
              </View>
            )}
          </View>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.email}>{email}</Text>
          
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>
              {isPsychologist ? 'Psicólogo verificado' : 'Paciente'}
            </Text>
          </View>
        </View>

        <View style={styles.statsCard}>
          <View style={styles.statCol}>
            <Text style={styles.statVal}>{isPsychologist ? 'C$4,750' : 'C$1,200'}</Text>
            <Text style={styles.statLbl}>{isPsychologist ? 'Ganancias' : 'Presupuesto'}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCol}>
            <Text style={styles.statVal}>8</Text>
            <Text style={styles.statLbl}>Sesiones</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCol}>
            <Text style={styles.statVal}>4.9</Text>
            <Text style={styles.statLbl}>{isPsychologist ? 'Rating' : 'Progreso'}</Text>
          </View>
        </View>

        <View style={styles.menuList}>
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => setActivePanel('datos')}
            activeOpacity={0.7}
          >
            <View style={styles.menuIconBg}>
              <MaterialIcons name="person-outline" size={20} color={Colors.primary} />
            </View>
            <Text style={styles.menuLabel}>Datos personales</Text>
            <MaterialIcons name="chevron-right" size={20} color={Colors.textDisabled} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => setActivePanel('seguridad')}
            activeOpacity={0.7}
          >
            <View style={styles.menuIconBg}>
              <MaterialIcons name="shield" size={20} color={Colors.primary} />
            </View>
            <Text style={styles.menuLabel}>Seguridad y PIN</Text>
            <MaterialIcons name="chevron-right" size={20} color={Colors.textDisabled} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => setActivePanel('pagos')}
            activeOpacity={0.7}
          >
            <View style={styles.menuIconBg}>
              <MaterialIcons name="credit-card" size={20} color={Colors.primary} />
            </View>
            <Text style={styles.menuLabel}>Métodos de pago</Text>
            <MaterialIcons name="chevron-right" size={20} color={Colors.textDisabled} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => setActivePanel('notificaciones')}
            activeOpacity={0.7}
          >
            <View style={styles.menuIconBg}>
              <MaterialIcons name="notifications-none" size={20} color={Colors.primary} />
            </View>
            <Text style={styles.menuLabel}>Notificaciones</Text>
            <MaterialIcons name="chevron-right" size={20} color={Colors.textDisabled} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => setActivePanel('soporte')}
            activeOpacity={0.7}
          >
            <View style={styles.menuIconBg}>
              <MaterialIcons name="help-outline" size={20} color={Colors.primary} />
            </View>
            <Text style={styles.menuLabel}>Soporte y ayuda</Text>
            <MaterialIcons name="chevron-right" size={20} color={Colors.textDisabled} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleSignOut} activeOpacity={0.8}>
          <Feather name="log-out" size={18} color={Colors.error} />
          <Text style={styles.logoutBtnText}>Cerrar sesión</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={activePanel === 'datos'} animationType="slide">
        <SafeAreaView style={styles.panelRoot}>
          <View style={styles.panelHeader}>
            <TouchableOpacity onPress={() => setActivePanel(null)} style={styles.panelCloseBtn}>
              <MaterialIcons name="close" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.panelTitle}>Datos personales</Text>
            <View style={{ width: 44 }} />
          </View>
          <ScrollView contentContainerStyle={styles.panelBody}>
            <Text style={styles.inputLabel}>Nombre completo</Text>
            <TextInput style={styles.panelInput} value={name} onChangeText={setName} />

            <Text style={styles.inputLabel}>Correo electrónico</Text>
            <TextInput style={styles.panelInput} value={email} onChangeText={setEmail} keyboardType="email-address" />

            <Text style={styles.inputLabel}>Teléfono móvil</Text>
            <TextInput style={styles.panelInput} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

            <View style={{ height: Spacing.xl }} />
            <TouchableOpacity style={styles.saveBtn} onPress={handleSavePanel}>
              <Text style={styles.saveBtnText}>Guardar cambios</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal visible={activePanel === 'seguridad'} animationType="slide">
        <SafeAreaView style={styles.panelRoot}>
          <View style={styles.panelHeader}>
            <TouchableOpacity onPress={() => setActivePanel(null)} style={styles.panelCloseBtn}>
              <MaterialIcons name="close" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.panelTitle}>Seguridad y PIN</Text>
            <View style={{ width: 44 }} />
          </View>
          <ScrollView contentContainerStyle={styles.panelBody}>
            <Text style={styles.inputLabel}>PIN actual de acceso</Text>
            <TextInput style={styles.panelInput} value={pin} onChangeText={setPin} secureTextEntry maxLength={4} keyboardType="number-pad" />

            <Text style={styles.inputLabel}>Nuevo PIN (4 dígitos)</Text>
            <TextInput style={styles.panelInput} value={newPin} onChangeText={setNewPin} secureTextEntry maxLength={4} keyboardType="number-pad" placeholder="Ingresa 4 números" placeholderTextColor={Colors.textDisabled} />

            <View style={{ height: Spacing.xl }} />
            <TouchableOpacity style={styles.saveBtn} onPress={handleSavePanel}>
              <Text style={styles.saveBtnText}>Actualizar PIN</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal visible={activePanel === 'pagos'} animationType="slide">
        <SafeAreaView style={styles.panelRoot}>
          <View style={styles.panelHeader}>
            <TouchableOpacity onPress={() => setActivePanel(null)} style={styles.panelCloseBtn}>
              <MaterialIcons name="close" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.panelTitle}>Métodos de pago</Text>
            <View style={{ width: 44 }} />
          </View>
          <ScrollView contentContainerStyle={styles.panelBody}>
            <View style={styles.creditCard}>
              <View style={styles.cardHeaderRow}>
                <Feather name="credit-card" size={22} color={Colors.textInverse} />
                <Text style={styles.cardBrand}>Ruta Card</Text>
              </View>
              <Text style={styles.cardNumberText}>{cardNumber}</Text>
              <View style={styles.cardFooterRow}>
                <View>
                  <Text style={styles.cardLabel}>TITULAR</Text>
                  <Text style={styles.cardValue}>{cardHolder.toUpperCase()}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.cardLabel}>EXPIRA</Text>
                  <Text style={styles.cardValue}>{cardExpiry}</Text>
                </View>
              </View>
            </View>

            <Text style={styles.inputLabel}>Número de Tarjeta</Text>
            <TextInput style={styles.panelInput} value={cardNumber} onChangeText={setCardNumber} placeholder="xxxx xxxx xxxx xxxx" placeholderTextColor={Colors.textDisabled} />

            <Text style={styles.inputLabel}>Nombre del Titular</Text>
            <TextInput style={styles.panelInput} value={cardHolder} onChangeText={setCardHolder} />

            <Text style={styles.inputLabel}>Fecha de Expiración</Text>
            <TextInput style={styles.panelInput} value={cardExpiry} onChangeText={setCardExpiry} placeholder="MM/AA" placeholderTextColor={Colors.textDisabled} />

            <View style={{ height: Spacing.xl }} />
            <TouchableOpacity style={styles.saveBtn} onPress={handleSavePanel}>
              <Text style={styles.saveBtnText}>Actualizar Tarjeta</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal visible={activePanel === 'notificaciones'} animationType="slide">
        <SafeAreaView style={styles.panelRoot}>
          <View style={styles.panelHeader}>
            <TouchableOpacity onPress={() => setActivePanel(null)} style={styles.panelCloseBtn}>
              <MaterialIcons name="close" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.panelTitle}>Notificaciones</Text>
            <View style={{ width: 44 }} />
          </View>
          <ScrollView contentContainerStyle={styles.panelBody}>
            <View style={styles.switchRow}>
              <View style={styles.switchInfo}>
                <Text style={styles.switchTitle}>Mensajes de chat</Text>
                <Text style={styles.switchDesc}>Recibir alertas de nuevos mensajes de tu psicólogo</Text>
              </View>
              <Switch value={notifChat} onValueChange={setNotifChat} trackColor={{ true: Colors.primary }} />
            </View>

            <View style={styles.switchRow}>
              <View style={styles.switchInfo}>
                <Text style={styles.switchTitle}>Nuevas ofertas</Text>
                <Text style={styles.switchDesc}>Alertar cuando los psicólogos envíen presupuestos</Text>
              </View>
              <Switch value={notifOffers} onValueChange={setNotifOffers} trackColor={{ true: Colors.primary }} />
            </View>

            <View style={styles.switchRow}>
              <View style={styles.switchInfo}>
                <Text style={styles.switchTitle}>Notificaciones por Correo</Text>
                <Text style={styles.switchDesc}>Enviar resúmenes de sesión y recibos a tu email</Text>
              </View>
              <Switch value={notifEmail} onValueChange={setNotifEmail} trackColor={{ true: Colors.primary }} />
            </View>

            <View style={{ height: Spacing.xl }} />
            <TouchableOpacity style={styles.saveBtn} onPress={handleSavePanel}>
              <Text style={styles.saveBtnText}>Guardar preferencias</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal visible={activePanel === 'soporte'} animationType="slide">
        <SafeAreaView style={styles.panelRoot}>
          <View style={styles.panelHeader}>
            <TouchableOpacity onPress={() => setActivePanel(null)} style={styles.panelCloseBtn}>
              <MaterialIcons name="close" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.panelTitle}>Soporte y ayuda</Text>
            <View style={{ width: 44 }} />
          </View>
          <ScrollView contentContainerStyle={styles.panelBody}>
            <Text style={styles.supportIntro}>
              ¿Tienes algún inconveniente con el servicio o el cobro de tus sesiones? Descríbelo abajo y un agente técnico te contactará por correo.
            </Text>

            <Text style={styles.inputLabel}>Mensaje o Reporte</Text>
            <View style={styles.supportTextAreaWrapper}>
              <TextInput
                style={styles.supportTextArea}
                value={supportText}
                onChangeText={setSupportText}
                placeholder="Escribe aquí los detalles..."
                placeholderTextColor={Colors.textDisabled}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
              />
            </View>

            <View style={{ height: Spacing.xl }} />
            <TouchableOpacity 
              style={[styles.saveBtn, !supportText.trim() && { opacity: 0.5 }]} 
              disabled={!supportText.trim()}
              onPress={() => {
                setSupportText('');
                handleSavePanel();
              }}
            >
              <Text style={styles.saveBtnText}>Enviar reporte</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <CustomAlert
        visible={logoutAlertVisible}
        title="Cerrar sesión"
        message="¿Estás seguro de que deseas cerrar sesión de tu cuenta?"
        confirmText="Cerrar sesión"
        cancelText="Cancelar"
        showCancel
        onConfirm={handleConfirmSignOut}
        onCancel={() => setLogoutAlertVisible(false)}
      />

      <CustomAlert
        visible={saveSuccessAlertVisible}
        title="Guardado exitoso"
        message="Los datos han sido actualizados correctamente."
        confirmText="Aceptar"
        onConfirm={() => setSaveSuccessAlertVisible(false)}
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
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm + 2,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  appBarTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  scrollContent: {
    paddingBottom: Spacing.xxxl,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: Spacing.sm,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.full,
    borderWidth: 3,
    borderColor: Colors.accent,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primaryFaded,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: Colors.accent,
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  email: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  roleBadge: {
    backgroundColor: Colors.primaryFaded,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.sm,
  },
  roleText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    margin: Spacing.base,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadow.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statVal: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  statLbl: {
    fontSize: 11,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.border,
    marginVertical: 4,
  },
  menuList: {
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.divider,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md + 2,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  menuIconBg: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    marginHorizontal: Spacing.base,
    marginTop: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    backgroundColor: '#EF444408',
  },
  logoutBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.error,
  },

  panelRoot: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  panelCloseBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  panelTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  panelBody: {
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: -4,
  },
  panelInput: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textInverse,
  },

  creditCard: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    gap: Spacing.lg,
    ...Shadow.lg,
    marginBottom: Spacing.md,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardBrand: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.accent,
    letterSpacing: 1,
  },
  cardNumberText: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textInverse,
    letterSpacing: 2,
    marginVertical: Spacing.xs,
  },
  cardFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardLabel: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '600',
    marginBottom: 2,
  },
  cardValue: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textInverse,
  },

  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.xs,
  },
  switchInfo: {
    flex: 1,
    paddingRight: Spacing.md,
    gap: 3,
  },
  switchTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  switchDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
  },

  supportIntro: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: Spacing.sm,
  },
  supportTextAreaWrapper: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  supportTextArea: {
    fontSize: 15,
    color: Colors.textPrimary,
    minHeight: 120,
  },
});
