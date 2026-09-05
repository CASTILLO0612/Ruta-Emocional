import React from 'react';
import { CircleHelp, MapPin, MessageCircle, Phone, type LucideIcon } from 'lucide-react-native';

import type { AppointmentModality } from '../../repositories/AppointmentRepository';
import { IconSize, IconStroke } from '../../theme/icons';

const MODALITY_ICONS: Record<AppointmentModality, LucideIcon> = {
  CHAT: MessageCircle,
  CALL: Phone,
  IN_PERSON: MapPin,
};

interface AppointmentModalityIconProps {
  readonly modality: AppointmentModality;
  readonly color: string;
  readonly size?: number;
}

export const AppointmentModalityIcon: React.FC<AppointmentModalityIconProps> = ({
  modality,
  color,
  size = IconSize.inline,
}) => {
  const Icon = MODALITY_ICONS[modality] ?? CircleHelp;
  return <Icon size={size} strokeWidth={IconStroke.regular} color={color} />;
};
