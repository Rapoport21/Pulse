import React from 'react';
import { UserRole } from '../types';
import { LoginScreenTactical } from './LoginScreenTactical';

/**
 * LoginScreen — thin re-export of the chosen visual direction.
 *
 * PULSE committed to the Tactical direction on 2026-04-10. The earlier
 * A/B/C router that compared Tactical against Linear and Editorial has
 * been removed. The rejected variants are archived at
 * ~/Documents/PULSE-design-archive/ for future reference.
 */
interface LoginScreenProps {
  onLogin: (role: UserRole) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  return <LoginScreenTactical onLogin={onLogin} />;
};
