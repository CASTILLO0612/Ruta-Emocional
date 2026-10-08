import React from 'react';

interface GoogleNavigationProviderProps {
  readonly children: React.ReactNode;
}

export const GoogleNavigationProvider: React.FC<GoogleNavigationProviderProps> = ({
  children,
}) => children;
