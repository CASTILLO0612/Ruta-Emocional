import { useEffect, type RefObject } from 'react';
import {
  AccessibilityInfo,
  findNodeHandle,
  Platform,
  type View,
} from 'react-native';

export function useModalAccessibilityFocus(
  modalRef: RefObject<View | null>,
  visible: boolean
): void {
  useEffect(() => {
    if (!visible || Platform.OS === 'web') return undefined;

    const frame = requestAnimationFrame(() => {
      const node = findNodeHandle(modalRef.current);
      if (node) AccessibilityInfo.setAccessibilityFocus(node);
    });

    return () => cancelAnimationFrame(frame);
  }, [modalRef, visible]);
}
