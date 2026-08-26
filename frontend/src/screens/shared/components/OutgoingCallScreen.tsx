import React from 'react';
import { View, Text, StatusBar, SafeAreaView, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../../../theme/colors';
import { callStyles } from './callStyles';

type Props = {
  callType: 'voice' | 'video';
  remoteName: string;
  onCancel: () => void;
};

export const OutgoingCallScreen: React.FC<Props> = ({ callType, remoteName, onCancel }) => {
  return (
    <View style={callStyles.outgoingRoot}>
      <StatusBar barStyle="light-content" backgroundColor="#0A2463" />
      <View style={callStyles.outgoingInner}>
        <View style={callStyles.outgoingAvatarWrapper}>
          <MaterialIcons name="phone" size={48} color={Colors.textInverse} />
        </View>
        <Text style={callStyles.outgoingName}>Llamando a {remoteName}</Text>
        <Text style={callStyles.outgoingStatus}>{callType === 'video' ? 'Videollamada saliente' : 'Llamada de voz saliente'}</Text>
      </View>
      <SafeAreaView>
        <TouchableOpacity style={callStyles.cancelCallBtn} onPress={onCancel} accessibilityLabel="Cancel call">
          <MaterialIcons name="call-end" size={30} color={Colors.textInverse} />
        </TouchableOpacity>
        <Text style={callStyles.cancelCallLabel}>Cancelar</Text>
      </SafeAreaView>
    </View>
  );
};
