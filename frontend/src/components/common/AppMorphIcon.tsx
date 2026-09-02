import { MorphIcon } from 'morphicons/react-native';

import { Colors } from '../../theme/colors';
import { IconSize, IconStroke } from '../../theme/icons';
import type { AppMorphIconProps } from './AppMorphIcon.types';

/**
 * Native icon transition for meaningful state changes.
 * Static iconography should continue using lucide-react-native directly.
 */
export function AppMorphIcon({
  icon,
  size = IconSize.action,
  color = Colors.textPrimary,
  strokeWidth = IconStroke.regular,
  spring = 'smooth',
  label,
  testID,
}: AppMorphIconProps) {
  return (
    <MorphIcon
      icon={icon}
      size={size}
      color={color}
      strokeWidth={strokeWidth}
      spring={spring}
      reducedMotion="user"
      label={label}
      testID={testID}
    />
  );
}
