import React from 'react';
import { View, Text, StatusBar, SafeAreaView, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../../../theme/colors';
import { callStyles } from './callStyles';

type Props = {
  callType: 'voice' | 'video';
  remoteName: string;
  seconds: number;
  isMicOn: boolean;
  isCamOn: boolean;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onEndCall: () => void;
};

export const ActiveCallScreen: React.FC<Props> = ({
  callType,
  remoteName,
  seconds,
  isMicOn,
  isCamOn,
  onToggleMic,
  onToggleCam,
  onEndCall,
}) => {
  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <View style={callStyles.activeRoot}>
      <StatusBar barStyle="light-content" backgroundColor="#0A2463" />

      <View style={callStyles.activeRemote}>
        <View style={callStyles.activeAvatarWrapper}>
          {callType === 'video' && isCamOn ? (
            <View style={callStyles.activeVideoPlaceholder}>
              <MaterialIcons name="videocam" size={60} color="rgba(255,255,255,0.3)" />
              <Text style={callStyles.activeVideoLabel}>Cámara simulada</Text>
            </View>
          ) : (
            <View style={callStyles.activeAudioAvatar}>
              <MaterialIcons name="person" size={72} color="rgba(255,255,255,0.5)" />
            </View>
          )}
        </View>
        <Text style={callStyles.activeName}>{remoteName}</Text>
      </View>

      {/* Timer */}
      <View style={callStyles.activeTimerRow}>
        <View style={callStyles.activeLiveDot} />
        <Text style={callStyles.activeTimer}>{formatTime(seconds)}</Text>
      </View>

      {/* Self preview (videollamada) */}
      {callType === 'video' && (
        <View style={callStyles.activeSelfPreview}>
          <MaterialIcons name="person" size={28} color="rgba(255,255,255,0.7)" />
          <Text style={callStyles.activeSelfLabel}>Tú</Text>
        </View>
      )}

      {/* Controls */}
      <SafeAreaView style={callStyles.activeControls}>
        <View style={callStyles.activeControlsRow}>
          <View style={callStyles.activeControlCol}>
            <TouchableOpacity
              style={[callStyles.activeBtn, !isMicOn && callStyles.activeBtnOff]}
              onPress={onToggleMic}
              accessibilityLabel="Toggle microphone"
            >
              <MaterialIcons
                name={isMicOn ? 'mic' : 'mic-off'}
                size={26}
                color={Colors.textInverse}
              />
            </TouchableOpacity>
            <Text style={callStyles.activeBtnLabel}>{isMicOn ? 'Silenciar' : 'Activar mic'}</Text>
          </View>

          <View style={callStyles.activeControlCol}>
            <TouchableOpacity
              style={callStyles.activeEndBtn}
              onPress={onEndCall}
              accessibilityLabel="End call"
            >
              <MaterialIcons name="call-end" size={30} color={Colors.textInverse} />
            </TouchableOpacity>
            <Text style={callStyles.activeBtnLabel}>Colgar</Text>
          </View>

          {callType === 'video' && (
            <View style={callStyles.activeControlCol}>
              <TouchableOpacity
                style={[callStyles.activeBtn, !isCamOn && callStyles.activeBtnOff]}
                onPress={onToggleCam}
                accessibilityLabel="Toggle camera"
              >
                <MaterialIcons
                  name={isCamOn ? 'videocam' : 'videocam-off'}
                  size={26}
                  color={Colors.textInverse}
                />
              </TouchableOpacity>
              <Text style={callStyles.activeBtnLabel}>{isCamOn ? 'Apagar cam' : 'Activar cam'}</Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
};
