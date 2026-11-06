// Held in memory only: the email must not go in route params, storage or logs.
let pending: string | null = null;

export const setPendingEmail = (email: string) => {
  pending = email;
};
export const getPendingEmail = (): string | null => pending;
export const clearPendingEmail = () => {
  pending = null;
};
