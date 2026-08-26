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
  Animated,
  Easing,
  Linking,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import MapView, { Marker, Polyline } from '../../components/common/CustomMapView';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { BorderRadius, Shadow, Spacing } from '../../theme/spacing';
import { CustomAlert } from '../../components/common/CustomAlert';
import { useAuthStore } from '../../store/useAuthStore';
import { useRequestStore } from '../../store/useRequestStore';
import { useCallStore } from '../../store/useCallStore';
import { transientStorage } from '../../services/transientStorage';
import { getSocket, joinRoom, leaveRoom } from '../../services/socketClient';
import { IncomingCallOverlay } from './components/IncomingCallOverlay';
import { OutgoingCallScreen } from './components/OutgoingCallScreen';
import { ActiveCallScreen } from './components/ActiveCallScreen';

import * as Location from 'expo-location';
import {
  listenToChatMessages,
  sendChatMessage,
  ChatMessage,
} from '../../repositories/ChatRepository';

const CHAT_REQ_KEY = 'ruta_emocional_active_chat_request_id';
const CHAT_NAME_KEY = 'ruta_emocional_active_chat_name';



// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Outgoing Call Screen â€” pantalla de repique para el PsicÃ³logo
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// OutgoingCallScreen component extracted to ./components/OutgoingCallScreen.tsx// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Active Call Screen â€” pantalla de llamada en vivo para ambos
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€


// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ConsultationScreen â€” pantalla principal de sesiÃ³n (chat + llamadas)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const ConsultationScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { userProfile } = useAuthStore();
  const { activeRequest } = useRequestStore();
  const {
    callState,
    callType,
    callSeconds,
    remoteName,
    initCallListeners,
    destroyCallListeners,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
  } = useCallStore();

  const isPsychologist = userProfile?.role === 'psychologist';

  const paramReqId = route.params?.requestId;
  const storeReqId = activeRequest?.id;
  const savedReqId = transientStorage.getItem(CHAT_REQ_KEY);

  const requestId = paramReqId || storeReqId || savedReqId || 'demo_request';

  const savedName = transientStorage.getItem(CHAT_NAME_KEY);
  const psychologistName = route.params?.psychologistName || savedName || 'Dra. Maria Elena Castillo';
  const psychologistPhotoURL = route.params?.psychologistPhotoURL;

  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [endSessionAlertVisible, setEndSessionAlertVisible] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  // Persistir IDs para resistir recarga de pÃ¡gina
  useEffect(() => {
    if (requestId && requestId !== 'demo_request') {
      transientStorage.setItem(CHAT_REQ_KEY, requestId);
    }
  }, [requestId]);

  useEffect(() => {
    if (route.params?.psychologistName) {
      transientStorage.setItem(CHAT_NAME_KEY, route.params.psychologistName);
    }
  }, [route.params?.psychologistName]);

  // Inicializar listeners de llamadas vÃ­a socketClient centralizado
  useEffect(() => {
    if (requestId && requestId !== 'demo_request') {
      initCallListeners(requestId);
    }
    return () => {
      destroyCallListeners();
    };
  }, [requestId]);

  // Escuchar mensajes en tiempo real
  useEffect(() => {
    if (!requestId) return;
    const unsub = listenToChatMessages(requestId, (serverList) => {
      setMessages((prev) => {
        if (!serverList || serverList.length === 0) return prev;
        const pendingOptimistic = prev.filter(
          (m) => m.id?.startsWith('temp_') && !serverList.some((s) => s.text === m.text)
        );
        return [...serverList, ...pendingOptimistic];
      });
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    });
    return () => unsub();
  }, [requestId]);

  const handleEndSession = () => {
    setEndSessionAlertVisible(true);
  };

  const handleConfirmEndSession = () => {
    setEndSessionAlertVisible(false);
    transientStorage.removeItem(CHAT_REQ_KEY);
    transientStorage.removeItem(CHAT_NAME_KEY);
    destroyCallListeners();
    navigation.goBack();
  };

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;
    const textToSend = inputText.trim();
    setInputText('');

    const senderRole = userProfile?.role || 'patient';
    const senderName = userProfile?.displayName || (senderRole === 'psychologist' ? 'Doctor' : 'Paciente');
    const senderId = userProfile?.id || 'guest_user';

    const optimisticMsg: ChatMessage = {
      id: `temp_${Date.now()}`,
      request: requestId,
      sender: senderId,
      senderName,
      senderRole,
      text: textToSend,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);

    await sendChatMessage({ requestId, senderId, senderName, senderRole, text: textToSend });
  };

  const handleInitiateCall = (type: 'voice' | 'video') => {
    startCall({ roomId: requestId, callerName: userProfile?.displayName || 'PsicÃ³logo', callType: type });
  };

  // â”€â”€ Renderizar overlay de llamada entrante (Paciente) â”€â”€
  if (callState === 'incoming' && callType) {
    return (
      <IncomingCallOverlay
        callerName={remoteName || psychologistName}
        callType={callType}
        onAccept={acceptCall}
        onReject={rejectCall}
      />
    );
  }

  // â”€â”€ Renderizar pantalla de repique (PsicÃ³logo estÃ¡ llamando) â”€â”€
  if (callState === 'outgoing' && callType) {
    return (
      <OutgoingCallScreen
        callType={callType}
        remoteName={psychologistName}
        onCancel={endCall}
      />
    );
  }

  // â”€â”€ Renderizar llamada activa (ambos lados) â”€â”€
  if (callState === 'connected' && callType) {
    return (
      <ActiveCallScreen
        callType={callType}
        remoteName={isPsychologist ? (remoteName || 'Paciente') : psychologistName}
        seconds={callSeconds}
        isMicOn={isMicOn}
        isCamOn={isCamOn}
        onToggleMic={() => setIsMicOn((v) => !v)}
        onToggleCam={() => setIsCamOn((v) => !v)}
        onEndCall={endCall}
      />
    );
  }

  // â”€â”€ Vista de Chat â”€â”€
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
              <Text style={styles.chatStatusText}>SesiÃ³n de chat activa</Text>
            </View>
          </View>

          {/* Solo el PSICÃ“LOGO puede iniciar llamadas */}
          {isPsychologist && (
            <View style={styles.chatActionsRow}>
              <TouchableOpacity
                style={styles.chatHeaderActionBtn}
                onPress={() => handleInitiateCall('voice')}
                accessibilityLabel="Iniciar llamada de voz"
              >
                <MaterialIcons name="phone" size={20} color={Colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.chatHeaderActionBtn}
                onPress={() => handleInitiateCall('video')}
                accessibilityLabel="Iniciar videollamada"
              >
                <MaterialIcons name="videocam" size={20} color={Colors.primary} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </SafeAreaView>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item, index) => item.id || item._id || index.toString()}
        contentContainerStyle={styles.chatList}
        renderItem={({ item }) => {
          const isUserSender = item.sender === userProfile?.id || item.senderRole === userProfile?.role;
          const timeStr = item.createdAt
            ? new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : '';

          return (
            <View style={[styles.bubbleContainer, isUserSender ? styles.patientAlign : styles.psychologistAlign]}>
              <View style={[styles.bubble, isUserSender ? styles.patientBubble : styles.psychologistBubble]}>
                <Text style={[styles.bubbleText, isUserSender ? styles.patientText : styles.psychologistText]}>
                  {item.text}
                </Text>
                <Text style={[styles.bubbleTime, isUserSender ? styles.patientTime : styles.psychologistTime]}>
                  {timeStr}
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
            placeholder="Escribe un mensaje en tiempo real..."
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
        title="Finalizar sesiÃ³n"
        message="Â¿EstÃ¡s seguro de que deseas finalizar esta sesiÃ³n de apoyo?"
        confirmText="Finalizar"
        cancelText="Cancelar"
        showCancel
        onConfirm={handleConfirmEndSession}
        onCancel={() => setEndSessionAlertVisible(false)}
      />
    </View>
  );
};

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// RouteTrackingScreen â€” mapa de seguimiento para visitas presenciales
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const RouteTrackingScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { cancelSearch } = useRequestStore();
  const { userProfile } = useAuthStore();

  const psychologistName = route.params?.psychologistName ?? 'Dr. Carlos MÃ©ndez RÃ­os';
  const amount = route.params?.amount ?? 500;
  const requestId = route.params?.requestId;

  const [endRouteAlertVisible, setEndRouteAlertVisible] = useState(false);
  const [patientCoords, setPatientCoords] = useState({ latitude: 12.2080, longitude: -86.3595 }); // Ciudad Sandino
  const [psychCoords, setPsychCoords] = useState({ latitude: 12.1283, longitude: -86.2791 }); // Altamira Managua
  const [etaMinutes, setEtaMinutes] = useState(28);
  const [routeCoordinates, setRouteCoordinates] = useState<Array<{ latitude: number; longitude: number }>>([
    { latitude: 12.1358, longitude: -86.2893 },
    { latitude: 12.1298, longitude: -86.2924 }
  ]);
  const [routeDistanceKm, setRouteDistanceKm] = useState<number>(11.4);
  const [originLabel, setOriginLabel] = useState<string>('Tu ubicaciÃ³n');
  const [destLabel, setDestLabel] = useState<string>(`Consultorio de ${psychologistName}`);

  // Reverse geocoding via Nominatim (OpenStreetMap) â€” funciona en Web y nativo sin API key
  useEffect(() => {
    const nominatimGeocode = async (lat: number, lon: number): Promise<string | null> => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&accept-language=es`,
          { headers: { 'User-Agent': 'RutaEmocional/1.0' } }
        );
        const data = await res.json();
        const addr = data?.address;
        if (!addr) return null;
        // Prioridad: barrio > colonia > calle > municipio
        return (
          addr.neighbourhood ||
          addr.suburb ||
          addr.quarter ||
          addr.road ||
          addr.town ||
          addr.city ||
          addr.county ||
          null
        );
      } catch {
        return null;
      }
    };

    (async () => {
      const [origin, dest] = await Promise.all([
        nominatimGeocode(patientCoords.latitude, patientCoords.longitude),
        nominatimGeocode(psychCoords.latitude, psychCoords.longitude),
      ]);
      if (origin) setOriginLabel(origin);
      if (dest) setDestLabel(dest);
    })();
  }, []);

  const initialRegion = {
    latitude: (patientCoords.latitude + psychCoords.latitude) / 2,
    longitude: (patientCoords.longitude + psychCoords.longitude) / 2,
    latitudeDelta: Math.abs(patientCoords.latitude - psychCoords.latitude) * 1.6 + 0.04,
    longitudeDelta: Math.abs(patientCoords.longitude - psychCoords.longitude) * 1.6 + 0.04,
  };

  // CÃ¡lculo de ETA en tiempo real estilo Waze (distancia Manhattan en ciudad + factor de trÃ¡fico y semÃ¡foros)
  const calculateWazeEta = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const latDistKm = Math.abs(lat1 - lat2) * 111;
    const lngDistKm = Math.abs(lon1 - lon2) * 111 * Math.cos((lat2 * Math.PI) / 180);
    const totalDistKm = parseFloat((latDistKm + lngDistKm).toFixed(1));
    setRouteDistanceKm(Math.max(0.5, totalDistKm));
    // Velocidad promedio en ciudad con trÃ¡fico intensivo ~18 km/h + demora por intersecciones y semÃ¡foros
    const trafficDelay = Math.round(totalDistKm * 1.5);
    return Math.max(3, Math.round(totalDistKm / 0.32) + trafficDelay);
  };

  // Obtener trazo real por las calles (geometrÃ­a de carreteras tipo inDrive / Waze)
  useEffect(() => {
    const fetchRealStreetRoute = async () => {
      try {
        const start = patientCoords;
        const end = psychCoords;
        if (!start.latitude || !end.latitude) return;

        const url = `https://router.project-osrm.org/route/v1/driving/${start.longitude},${start.latitude};${end.longitude},${end.latitude}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        const data = await res.json();
        if (data && data.routes && data.routes.length > 0) {
          const coords = data.routes[0].geometry.coordinates.map((item: [number, number]) => ({
            latitude: item[1],
            longitude: item[0],
          }));
          setRouteCoordinates(coords);
          const distKm = parseFloat((data.routes[0].distance / 1000).toFixed(1));
          setRouteDistanceKm(distKm);

          // ETA = tiempo de conducciÃ³n de OSRM + 25% por trÃ¡fico real (sin doble penalizaciÃ³n por km)
          const baseMinutes = Math.round(data.routes[0].duration / 60);
          setEtaMinutes(Math.max(3, Math.round(baseMinutes * 1.25)));
        } else {
          setRouteCoordinates([patientCoords, psychCoords]);
        }
      } catch (err) {
        console.warn('[Route] Error obteniendo trazo de calles, usando coordenadas:', err);
        setRouteCoordinates([patientCoords, psychCoords]);
      }
    };

    fetchRealStreetRoute();
  }, [patientCoords.latitude, patientCoords.longitude, psychCoords.latitude, psychCoords.longitude]);

  // Obtener ubicaciÃ³n GPS real del paciente o consultorio
  useEffect(() => {
    const getLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.warn('[Route] Permiso de ubicaciÃ³n denegado');
          return;
        }
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        if (userProfile?.role === 'psychologist') {
          setPsychCoords({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
          setEtaMinutes(calculateWazeEta(patientCoords.latitude, patientCoords.longitude, location.coords.latitude, location.coords.longitude));
        } else {
          setPatientCoords({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
          setEtaMinutes(calculateWazeEta(location.coords.latitude, location.coords.longitude, psychCoords.latitude, psychCoords.longitude));

          if (requestId) {
            const socket = getSocket();
            socket.emit('location_update', {
              roomId: requestId,
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            });
          }
        }
      } catch (err) {
        console.warn('[Route] Error obteniendo GPS:', err);
      }
    };
    getLocation();
  }, [requestId, userProfile?.role]);

  // Escuchar actualizaciones de ubicaciÃ³n vÃ­a WebSockets
  useEffect(() => {
    if (!requestId) return;

    const socket = getSocket();
    joinRoom(requestId);

    const onLocationUpdate = (data: { latitude: number; longitude: number }) => {
      if (typeof data.latitude === 'number' && typeof data.longitude === 'number') {
        if (userProfile?.role === 'psychologist') {
          setPatientCoords({ latitude: data.latitude, longitude: data.longitude });
          setEtaMinutes(calculateWazeEta(data.latitude, data.longitude, psychCoords.latitude, psychCoords.longitude));
        } else {
          setPsychCoords({ latitude: data.latitude, longitude: data.longitude });
          setEtaMinutes(calculateWazeEta(patientCoords.latitude, patientCoords.longitude, data.latitude, data.longitude));
        }
      }
    };

    socket.on('receive_location_update', onLocationUpdate);

    return () => {
      socket.off('receive_location_update', onLocationUpdate);
      leaveRoom(requestId);
    };
  }, [requestId, patientCoords, psychCoords, userProfile?.role]);

  const handleCancelRoute = () => {
    setEndRouteAlertVisible(true);
  };

  const handleConfirmCancel = () => {
    setEndRouteAlertVisible(false);
    cancelSearch();
    navigation.goBack();
  };

  return (
    <View style={styles.routeRoot}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        showsUserLocation
        showsMyLocationButton={false}
        routeStart={patientCoords}
        routeEnd={psychCoords}
      >
        <Marker
          coordinate={patientCoords}
          title={userProfile?.role === 'psychologist' ? `Paciente en camino (${psychologistName})` : 'Tu ubicaciÃ³n (en camino)'}
        >
          <View style={styles.markerCircle}>
            <MaterialIcons name="person-pin-circle" size={32} color={Colors.primary} />
          </View>
        </Marker>

        <Marker
          coordinate={psychCoords}
          title={userProfile?.role === 'psychologist' ? 'Tu consultorio profesional' : `Consultorio de ${psychologistName}`}
        >
          <View style={styles.markerCircle}>
            <MaterialIcons name="local-hospital" size={28} color={Colors.accentDark} />
          </View>
        </Marker>

        {/* LÃ­nea elegante y fina que recorre la geometrÃ­a de las calles, al estilo inDrive */}
        {routeCoordinates && routeCoordinates.length >= 2 ? (
          <>
            <Polyline
              coordinates={routeCoordinates}
              strokeColor="#1E293B"
              strokeWidth={5}
            />
            <Polyline
              coordinates={routeCoordinates}
              strokeColor="#FFFFFF"
              strokeWidth={3}
            />
          </>
        ) : null}
      </MapView>

      {/* â”€â”€â”€ Floating White InDrive-style route header card â”€â”€â”€ */}
      <SafeAreaView style={styles.routeTopBar}>
        <View style={styles.routeHeaderCard}>

          {/* Row 1: origin pin + name */}
          <View style={styles.routeHeaderRow}>
            <MaterialIcons name="near-me" size={16} color={Colors.textSecondary} />
            <Text style={styles.routeHeaderOriginText} numberOfLines={1}>
              {userProfile?.role === 'psychologist' ? destLabel : originLabel}
            </Text>
          </View>

          {/* Hairline divider */}
          <View style={styles.routeHeaderDivider} />

          {/* Row 2: flag + destination name + close button */}
          <View style={styles.routeHeaderRow}>
            <MaterialIcons name="flag" size={16} color={Colors.primary} />
            <Text style={styles.routeHeaderDestText} numberOfLines={1}>
              {userProfile?.role === 'psychologist' ? originLabel : destLabel}
            </Text>
            <TouchableOpacity style={styles.routeCloseBtn} onPress={handleCancelRoute}>
              <MaterialIcons name="close" size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

        </View>
      </SafeAreaView>

      {/* â”€â”€â”€ Flat Bottom Panel (single surface, no nested cards) â”€â”€â”€ */}
      <View style={styles.routeCard}>
        <View style={styles.routeHandle} />

        {/* Row 1: ETA + Name + Price â€” all inline, balanced and centered */}
        <View style={styles.routeRow1}>
          <Text style={styles.routeEtaNumber}>{etaMinutes}<Text style={styles.routeEtaUnit}> min</Text></Text>
          <View style={styles.routeNameCol}>
            <Text style={styles.routeHeroName} numberOfLines={1}>{psychologistName}</Text>
            <View style={styles.routeChipsRow}>
              <MaterialIcons name="straighten" size={13} color={Colors.textSecondary} />
              <Text style={styles.routeChipText}>{routeDistanceKm} km</Text>
            </View>
          </View>
          <Text style={styles.routePrice}>C${amount}</Text>
        </View>

        <View style={styles.routeDivider} />

        {/* Row 2: Actions */}
        <View style={styles.routeActions}>
          <TouchableOpacity
            style={styles.routeCallBtn}
            onPress={() => navigation.navigate('Consultation', { modality: 'call' })}
          >
            <MaterialIcons name="phone" size={17} color={Colors.primary} />
            <Text style={styles.routeCallBtnText}>Llamar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.routeChatBtn}
            onPress={() => navigation.navigate('Consultation', { modality: 'chat' })}
          >
            <MaterialIcons name="chat-bubble" size={17} color={Colors.textInverse} />
            <Text style={styles.routeChatBtnText}>Chat</Text>
          </TouchableOpacity>
        </View>
      </View>

      <CustomAlert
        visible={endRouteAlertVisible}
        title="Cancelar recorrido"
        message="Â¿EstÃ¡s seguro de que deseas cancelar la visita presencial?"
        confirmText="SÃ­, cancelar"
        cancelText="No, continuar"
        showCancel
        onConfirm={handleConfirmCancel}
        onCancel={() => setEndRouteAlertVisible(false)}
      />
    </View>
  );
};

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Styles
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Estilos de chat y mapa */
const styles = StyleSheet.create({
  chatRoot: { flex: 1, backgroundColor: Colors.background },
  chatHeaderWrapper: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    ...Shadow.sm,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatAvatar: { width: 38, height: 38, borderRadius: 19 },
  chatAvatarPlaceholder: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primaryFaded,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatHeaderInfo: { flex: 1 },
  chatHeaderName: { ...Typography.h4, color: Colors.textPrimary },
  chatStatusRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  chatOnlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.accent },
  chatStatusText: { ...Typography.caption, color: Colors.textSecondary },
  chatActionsRow: { flexDirection: 'row', gap: Spacing.xs },
  chatHeaderActionBtn: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },

  chatList: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.base,
    gap: Spacing.md,
  },
  bubbleContainer: { width: '100%', marginBottom: Spacing.xs },
  patientAlign: { alignItems: 'flex-end' },
  psychologistAlign: { alignItems: 'flex-start' },
  bubble: {
    maxWidth: '80%',
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    gap: 2,
    ...Shadow.sm,
  },
  patientBubble: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: BorderRadius.xs,
  },
  psychologistBubble: {
    backgroundColor: Colors.surface,
    borderBottomLeftRadius: BorderRadius.xs,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bubbleText: { ...Typography.body },
  patientText: { color: Colors.textInverse },
  psychologistText: { color: Colors.textPrimary },
  bubbleTime: { fontSize: 10, alignSelf: 'flex-end', marginTop: 2 },
  patientTime: { color: 'rgba(255,255,255,0.7)' },
  psychologistTime: { color: Colors.textSecondary },

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
    ...Typography.body,
    color: Colors.textPrimary,
    backgroundColor: Colors.background,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },

  routeRoot: { flex: 1, backgroundColor: Colors.background },
  markerCircle: { alignItems: 'center', justifyContent: 'center' },

  /* â”€â”€ Top bar & floating header card â”€â”€ */
  routeTopBar: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 14,
    zIndex: 10,
  },
  routeBackBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.md,
  },
  routeHeaderCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    paddingVertical: 2,
    paddingHorizontal: 4,
    shadowColor: '#0D1B3E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  routeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  routeHeaderOriginText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    letterSpacing: 0.1,
  },
  routeHeaderDestText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: 0.1,
  },
  routeHeaderEtaBadge: {
    backgroundColor: 'transparent',
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  routeHeaderEtaText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primaryDark,
    letterSpacing: 0.2,
  },
  routeHeaderDivider: {
    height: 1,
    backgroundColor: Colors.divider,
    marginHorizontal: 12,
  },
  routeCloseBtn: {
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* â”€â”€ Premium bottom sheet card â”€â”€ */
  routeCard: {
    position: 'absolute',
    bottom: 24,
    left: 14,
    right: 14,
    backgroundColor: Colors.surface,
    borderRadius: 24,
    paddingTop: 10,
    paddingBottom: 18,
    paddingHorizontal: 20,
    gap: 14,
    shadowColor: '#0D1B3E',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 16,
  },
  routeHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.borderStrong,
    alignSelf: 'center',
    marginBottom: 4,
  },

  /* Hero ETA row â€” flat, centered and balanced */
  routeRow1: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  routeEtaNumber: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.primaryDark,
    letterSpacing: -0.5,
  },
  routeEtaUnit: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  routeNameCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  routeHeroName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  routeChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  routeChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  routeChipSep: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.textTertiary,
  },
  routeLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#059669',
  },
  routePrice: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.primaryDark,
    letterSpacing: -0.5,
  },

  routeDivider: { height: 1, backgroundColor: Colors.divider, marginVertical: 2 },

  /* Action buttons */
  routeActions: { flexDirection: 'row', gap: 10 },
  routeCallBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  routeCallBtnText: { fontSize: 14, fontWeight: '700', color: Colors.primary },
  routeChatBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: Colors.primaryDark,
  },
  routeChatBtnText: { fontSize: 14, fontWeight: '700', color: Colors.textInverse },
});
