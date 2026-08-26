import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated, Easing } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../../../theme/colors';
import { Spacing } from '../../../theme/spacing';
import { callStyles } from './callStyles';

interface IncomingCallOverlayProps {
  callerName: string;
  callType: 'voice' | 'video';
  onAccept: () => void;
  onReject: () => void;
}

export const IncomingCallOverlay: React.FC<IncomingCallOverlayProps> = ({
  callerName,
  callType,
  onAccept,
  onReject,
}) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 700,
          useNativeDriver: true,
          easing: Easing.ease,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
          easing: Easing.ease,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  return (
    <View style={callStyles.incomingOverlay}>
      <View style={callStyles.incomingCard}>
        <View style={callStyles.incomingTypeRow}>
          <MaterialIcons
            name={callType === 'video' ? 'videocam' : 'phone'}
            size={18}
            color={Colors.accent}
          />
          <Text style={callStyles.incomingSubtitle}>
            {callType === 'video' ? 'Videollamada entrante' : 'Llamada de voz entrante'}
          </Text>
        </View>
        <Animated.View
          style={[callStyles.incomingAvatarWrapper, { transform: [{ scale: pulseAnim }] }]}>
          <View style={callStyles.incomingAvatar}>
            <MaterialIcons name="psychology" size={48} color={Colors.primary} />
          </View>
        </Animated.View>
        <Text style={callStyles.incomingName}>{callerName}</Text>
        <Text style={callStyles.incomingRole}>Psicólogo de tu sesión activa</Text>
        <View style={callStyles.incomingActions}>
          <TouchableOpacity
            style={callStyles.rejectBtn}
            onPress={onReject}
            accessibilityLabel="Rechazar llamada"
          >
            <MaterialIcons name="call-end" size={30} color={Colors.textInverse} />
          </TouchableOpacity>
          <TouchableOpacity
            style={callStyles.acceptBtn}
            onPress={onAccept}
            accessibilityLabel="Aceptar llamada"
          >
            <MaterialIcons
              name={callType === 'video' ? 'videocam' : 'call'}
              size={30}
              color={Colors.textInverse}
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};
