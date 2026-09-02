import type { IconInput, SpringPreset } from 'morphicons';

export interface AppMorphIconProps {
  readonly icon: IconInput;
  readonly size?: number;
  readonly color?: string;
  readonly strokeWidth?: number;
  readonly spring?: SpringPreset;
  readonly label?: string;
  readonly testID?: string;
}
