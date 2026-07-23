import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  FlatList,
  Image,
  StatusBar,
  Platform,
} from 'react-native';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import MapView, { Marker } from '../../components/common/CustomMapView';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { BorderRadius, Shadow, Spacing } from '../../theme/spacing';
import { CustomAlert } from '../../components/common/CustomAlert';

interface Message {
  id: string;
  sender: 'patient' | 'psychologist';
  text: string;
  timestamp: string;
}

export const ConsultationScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const psychologistName = route.params?.psychologistName ?? 'Dra. Maria Elena Castillo';
  const psychologistPhotoURL = route.params?.psychologistPhotoURL;
  const initialModality = route.params?.modality ?? 'chat';

  const [currentModality, setCurrentModality] = useState<'chat' | 'call' | 'video'>(initialModality);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [seconds, setSeconds] = useState(0);

  const [endSessionAlertVisible, setEndSessionAlertVisible] = useState(false);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'psychologist',
      text: `Hola, soy la ${psychologistName}. Estoy aquí para escucharte. Cuéntame, ¿cómo te has sentido hoy?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    let interval: any;
    if (currentModality !== 'chat') {
      interval = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setSeconds(0);
    }
    return () => clearInterval(interval);
  }, [currentModality]);

  const formatTime = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleEndSession = () => {
    setEndSessionAlertVisible(true);
  };

  const handleConfirmEndSession = () => {
    setEndSessionAlertVisible(false);
    navigation.navigate('Home');
  };

  const handleSendMessage = () => {
    if (!inputText.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'patient',
      text: inputText.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');

    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    setTimeout(() => {
      let psychologistReply = 'Entiendo perfectamente lo que me dices. Estoy aquí para acompañarte en este proceso.';
      const lower = userMsg.text.toLowerCase();

      if (lower.includes('ansiedad') || lower.includes('ansioso') || lower.includes('estres')) {
        psychologistReply = 'La ansiedad suele manifestarse con fuerza ante la incertidumbre. Intenta hacer una respiración profunda conmigo: inhala en 4 segundos, sostén y exhala en 4 segundos.';
      } else if (lower.includes('triste') || lower.includes('llorar') || lower.includes('tristeza')) {
        psychologistReply = 'Permitirte sentir y expresar la tristeza es el primer paso para sanar. No reprimas tu llanto, es una liberación necesaria.';
      } else if (lower.includes('gracias') || lower.includes('de acuerdo')) {
        psychologistReply = 'Gracias a ti por confiar en mí y abrir tu espacio seguro hoy.';
      }

      const replyMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'psychologist',
        text: psychologistReply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, replyMsg]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }, 1500);
  };

  if (currentModality === 'chat') {
    return (
      <View style={styles.chatRoot}>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.surface} />

        <SafeAreaView style={styles.chatHeaderWrapper}>
          <View style={styles.chatHeader}>
            <TouchableOpacity 
              style={styles.backBtn} 
              onPress={() => navigation.goBack()}
              accessibilityLabel="Back to inbox"
            >
              <MaterialIcons name="arrow-back" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>

            {psychologistPhotoURL ? (
              <Image source={{ uri: psychologistPhotoURL }} style={styles.chatAvatar} />
            ) : (
              <View style={styles.chatAvatarPlaceholder}>
                <MaterialIcons name="person" size={20} color={Colors.primary} />
              </View>
            )}
            
            <View style={styles.chatHeaderInfo}>
              <Text style={styles.chatHeaderName}>{psychologistName}</Text>
              <View style={styles.chatStatusRow}>
                <View style={styles.chatOnlineDot} />
                <Text style={styles.chatStatusText}>Sesión de chat activa</Text>
              </View>
            </View>

            <View style={styles.chatActionsRow}>
              <TouchableOpacity 
                style={styles.chatHeaderActionBtn} 
                onPress={() => setCurrentModality('call')}
                accessibilityLabel="Start voice call"
              >
                <MaterialIcons name="phone" size={20} color={Colors.primary} />
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.chatHeaderActionBtn} 
                onPress={() => setCurrentModality('video')}
                accessibilityLabel="Start video call"
              >
                <MaterialIcons name="videocam" size={20} color={Colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>

        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.chatList}
          renderItem={({ item }) => {
            const isPatient = item.sender === 'patient';
            return (
              <View style={[styles.bubbleContainer, isPatient ? styles.patientAlign : styles.psychologistAlign]}>
                <View style={[styles.bubble, isPatient ? styles.patientBubble : styles.psychologistBubble]}>
                  <Text style={[styles.bubbleText, isPatient ? styles.patientText : styles.psychologistText]}>
                    {item.text}
                  </Text>
                  <Text style={[styles.bubbleTime, isPatient ? styles.patientTime : styles.psychologistTime]}>
                    {item.timestamp}
                  </Text>
                </View>
              </View>
            );
          }}
        />

        <SafeAreaView style={styles.inputAreaWrapper}>
          <View style={styles.inputArea}>
            <TextInput
              style={styles.chatInput}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Escribe un mensaje..."
              placeholderTextColor={Colors.textDisabled}
              onSubmitEditing={handleSendMessage}
            />
            <TouchableOpacity style={styles.sendBtn} onPress={handleSendMessage}>
              <MaterialIcons name="send" size={18} color={Colors.textInverse} />
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        <CustomAlert
          visible={endSessionAlertVisible}
          title="Finalizar sesión"
          message="¿Estás seguro de que deseas finalizar esta sesión de apoyo?"
          confirmText="Finalizar"
          cancelText="Cancelar"
          showCancel
          onConfirm={handleConfirmEndSession}
          onCancel={() => setEndSessionAlertVisible(false)}
        />
      </View>
    );
  }

  return (
    <View style={styles.consultRoot}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      <View style={styles.videoArea}>
        {isCamOn ? (
          <View style={styles.remoteVideo}>
            {psychologistPhotoURL ? (
              <Image source={{ uri: psychologistPhotoURL }} style={styles.callAvatar} />
            ) : (
              <MaterialIcons name="person" size={80} color="rgba(255,255,255,0.3)" />
            )}
            <Text style={styles.remoteLabel}>{psychologistName}</Text>
            <Text style={styles.modalityLabelText}>
              {currentModality === 'video' ? 'Sesión de Video' : 'Llamada de Audio'}
            </Text>
          </View>
        ) : (
          <View style={styles.remoteVideo}>
            <View style={styles.camOffIcon}>
              <MaterialIcons name="videocam-off" size={48} color="rgba(255,255,255,0.4)" />
            </View>
            <Text style={styles.remoteLabel}>{psychologistName}</Text>
          </View>
        )}

        {currentModality === 'video' && isCamOn && (
          <View style={styles.localVideo}>
            <MaterialIcons name="person" size={28} color="rgba(255,255,255,0.5)" />
          </View>
        )}

        <View style={styles.timerBadge}>
          <View style={styles.timerDot} />
          <Text style={styles.timerText}>{formatTime(seconds)}</Text>
        </View>
      </View>

      <SafeAreaView style={styles.controlsSafe}>
        <View style={styles.consultTopBar}>
          <View style={styles.encryptedBadge}>
            <MaterialIcons name="lock" size={12} color={Colors.accent} />
            <Text style={styles.encryptedText}>Sesión de apoyo cifrada</Text>
          </View>
        </View>

        <View style={styles.controlsRow}>
          <TouchableOpacity
            style={[styles.controlBtn, !isMicOn && styles.controlBtnOff]}
            onPress={() => setIsMicOn((v) => !v)}
            accessibilityLabel="Toggle microphone"
          >
            <MaterialIcons
              name={isMicOn ? 'mic' : 'mic-off'}
              size={24}
              color={isMicOn ? Colors.textInverse : Colors.error}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.endCallBtn}
            onPress={handleEndSession}
            accessibilityLabel="End call button"
          >
            <MaterialIcons name="call-end" size={28} color={Colors.textInverse} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.controlBtn}
            onPress={() => setCurrentModality('chat')}
            accessibilityLabel="Switch back to chat"
          >
            <MaterialIcons name="chat" size={24} color={Colors.textInverse} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <CustomAlert
        visible={endSessionAlertVisible}
        title="Finalizar sesión"
        message="¿Estás seguro de que deseas finalizar esta sesión de apoyo?"
        confirmText="Finalizar"
        cancelText="Cancelar"
        showCancel
        onConfirm={handleConfirmEndSession}
        onCancel={() => setEndSessionAlertVisible(false)}
      />
    </View>
  );
};

export const RouteTrackingScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const psychologistName = route.params?.psychologistName ?? 'Dra. Maria Elena Castillo';
  const psychologistPhotoURL = route.params?.psychologistPhotoURL;

  const [eta, setEta] = useState(8);
  const [cancelRouteAlertVisible, setCancelRouteAlertVisible] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setEta((prev) => (prev > 1 ? prev - 1 : 1));
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleCancelRoute = () => {
    setCancelRouteAlertVisible(true);
  };

  const handleConfirmCancelRoute = () => {
    setCancelRouteAlertVisible(false);
    navigation.navigate('Home');
  };

  return (
    <View style={styles.routeRoot}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={{
          latitude: 12.1328,
          longitude: -86.2904,
          latitudeDelta: 0.03,
          longitudeDelta: 0.03,
        }}
        mapType="satellite"
      >
        <Marker
          coordinate={{ latitude: 12.1328, longitude: -86.2904 }}
          title="Tu Ubicación"
        />

        <Marker
          coordinate={{ latitude: 12.1348, longitude: -86.2914 }}
          title={psychologistName}
        />
      </MapView>

      <SafeAreaView style={styles.routeSafe}>
        <View style={styles.etaCard}>
          <View style={styles.etaRow}>
            {psychologistPhotoURL ? (
              <Image source={{ uri: psychologistPhotoURL }} style={styles.etaAvatar} />
            ) : (
              <MaterialIcons name="person" size={24} color={Colors.primary} />
            )}
            <View style={styles.etaInfo}>
              <Text style={styles.etaTitle}>{psychologistName}</Text>
              <Text style={styles.etaSubtitle}>Está en camino a tu domicilio</Text>
            </View>
            <View style={styles.etaBadge}>
              <Text style={styles.etaMinutes}>{eta}</Text>
              <Text style={styles.etaMin}>min</Text>
            </View>
          </View>

          <View style={styles.routeBar}>
            <View style={[styles.routeProgress, { width: `${100 - eta * 10}%` }]} />
          </View>
        </View>

        <TouchableOpacity
          style={styles.cancelRouteFab}
          onPress={handleCancelRoute}
          accessibilityLabel="Cancel Route button"
        >
          <MaterialIcons name="close" size={22} color={Colors.textInverse} />
        </TouchableOpacity>
      </SafeAreaView>

      <CustomAlert
        visible={cancelRouteAlertVisible}
        title="Cancelar seguimiento"
        message="¿Deseas finalizar el seguimiento de ruta y volver al inicio?"
        confirmText="Finalizar"
        cancelText="Cancelar"
        showCancel
        onConfirm={handleConfirmCancelRoute}
        onCancel={() => setCancelRouteAlertVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  chatRoot: {
    flex: 1,
    backgroundColor: '#F8FAF9',
  },
  chatHeaderWrapper: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 2,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chatAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  chatAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primaryFaded,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatHeaderInfo: {
    flex: 1,
  },
  chatHeaderName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  chatStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  chatOnlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accent,
  },
  chatStatusText: {
    fontSize: 10,
    color: Colors.textSecondary,
  },
  chatActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  chatHeaderActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chatEndBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatList: {
    padding: Spacing.base,
    gap: Spacing.md,
  },
  bubbleContainer: {
    flexDirection: 'row',
    width: '100%',
  },
  patientAlign: {
    justifyContent: 'flex-end',
  },
  psychologistAlign: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '80%',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.xxs,
  },
  patientBubble: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  psychologistBubble: {
    backgroundColor: Colors.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 20,
  },
  patientText: {
    color: Colors.textInverse,
  },
  psychologistText: {
    color: Colors.textPrimary,
  },
  bubbleTime: {
    fontSize: 10,
    alignSelf: 'flex-end',
  },
  patientTime: {
    color: 'rgba(255,255,255,0.6)',
  },
  psychologistTime: {
    color: Colors.textSecondary,
  },
  inputAreaWrapper: {
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  inputArea: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  chatInput: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    fontSize: 14,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  consultRoot: {
    flex: 1,
    backgroundColor: '#0A0A1A',
  },
  videoArea: {
    flex: 1,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  remoteVideo: {
    alignItems: 'center',
    gap: Spacing.md,
  },
  callAvatar: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 3,
    borderColor: Colors.accent,
  },
  camOffIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  remoteLabel: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textInverse,
  },
  modalityLabelText: {
    fontSize: 13,
    color: Colors.accent,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  localVideo: {
    position: 'absolute',
    bottom: Spacing.xl,
    right: Spacing.base,
    width: 80,
    height: 110,
    borderRadius: BorderRadius.lg,
    backgroundColor: '#222',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  timerBadge: {
    position: 'absolute',
    top: Spacing.base + 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  timerDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: Colors.error,
  },
  timerText: {
    fontSize: 13,
    color: Colors.textInverse,
    fontWeight: '700',
  },
  controlsSafe: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  consultTopBar: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.base,
    alignItems: 'center',
  },
  encryptedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  encryptedText: {
    fontSize: 11,
    color: Colors.accent,
    fontWeight: '700',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xl,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.base,
    backgroundColor: 'rgba(0,0,0,0.7)',
    marginHorizontal: Spacing.base,
    borderRadius: BorderRadius.xxl,
    marginBottom: Spacing.xl,
  },
  controlBtn: {
    width: 54,
    height: 54,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlBtnOff: {
    backgroundColor: 'rgba(239,68,68,0.2)',
  },
  endCallBtn: {
    width: 68,
    height: 68,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.lg,
  },

  routeRoot: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  routeSafe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  etaCard: {
    margin: Spacing.base,
    marginTop: Spacing.xxl + 10,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    gap: Spacing.md,
    ...Shadow.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  etaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  etaAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  etaInfo: {
    flex: 1,
  },
  etaTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  etaSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  etaBadge: {
    alignItems: 'center',
    backgroundColor: Colors.primaryFaded,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.lg,
  },
  etaMinutes: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.primary,
  },
  etaMin: {
    fontSize: 10,
    color: Colors.primary,
    fontWeight: '600',
  },
  routeBar: {
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  routeProgress: {
    height: '100%',
    backgroundColor: Colors.accent,
    borderRadius: 3,
  },
  cancelRouteFab: {
    position: 'absolute',
    top: Spacing.xxl + 140,
    left: Spacing.xl,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.md,
  },
});
