/**
 * Validation Utility Functions
 */

export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const isValidPhoneNumber = (phone: string): boolean => {
  const phoneRegex = /^\d{10,11}$/;
  return phoneRegex.test(phone.replace(/\D/g, ''));
};

export const isValidStationName = (name: string): boolean => {
  return name.trim().length >= 2 && name.trim().length <= 20;
};