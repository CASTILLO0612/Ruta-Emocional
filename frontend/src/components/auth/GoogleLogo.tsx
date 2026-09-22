import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { ExternalBrandColors } from '../../theme/colors';

interface GoogleLogoProps {
  readonly size?: number;
}

export const GoogleLogo: React.FC<GoogleLogoProps> = ({ size = 20 }) => (
  <Svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
  >
    <Path
      testID="google-logo-blue"
      fill={ExternalBrandColors.googleBlue}
      d="M21.6 12.227c0-.709-.064-1.391-.182-2.046H12v3.868h5.382a4.6 4.6 0 0 1-1.995 3.018v2.509h3.232c1.891-1.741 2.981-4.305 2.981-7.349Z"
    />
    <Path
      testID="google-logo-green"
      fill={ExternalBrandColors.googleGreen}
      d="M12 22c2.7 0 4.964-.895 6.619-2.424l-3.232-2.509c-.895.6-2.041.955-3.387.955-2.605 0-4.809-1.759-5.596-4.123H3.064v2.591A9.996 9.996 0 0 0 12 22Z"
    />
    <Path
      testID="google-logo-yellow"
      fill={ExternalBrandColors.googleYellow}
      d="M6.404 13.899A6.012 6.012 0 0 1 6.091 12c0-.659.114-1.3.313-1.899V7.51h-3.34A9.996 9.996 0 0 0 2 12c0 1.614.386 3.141 1.064 4.49l3.34-2.591Z"
    />
    <Path
      testID="google-logo-red"
      fill={ExternalBrandColors.googleRed}
      d="M12 5.977c1.468 0 2.786.505 3.823 1.496l2.868-2.868C16.959 2.991 14.695 2 12 2a9.996 9.996 0 0 0-8.936 5.51l3.34 2.591C7.191 7.737 9.395 5.977 12 5.977Z"
    />
  </Svg>
);
