import { Alert, Platform } from 'react-native';

export function showAlert(title: string, message: string, buttons?: any[]) {
  if (Platform.OS === 'web') {
    console.warn(`[Alert] ${title}: ${message}`);
    window.alert(`${title}\n\n${message}`);
    if (buttons && buttons.length > 0) {
      const positiveBtn = buttons.find(b => b.style !== 'cancel') || buttons[0];
      if (positiveBtn && typeof positiveBtn.onPress === 'function') {
        positiveBtn.onPress();
      }
    }
  } else {
    Alert.alert(title, message, buttons);
  }
}
