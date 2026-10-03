export const ACCESS_COOKIE = "em_access";
export const REFRESH_COOKIE = "em_refresh";

/** Where each role lands after login. */
export const ROLE_HOME = {
  ADMIN: "/dashboard",
  FACULTY: "/dashboard",
  STUDENT: "/learn",
} as const;

export const DEVICE_ID_STORAGE_KEY = "em_device_id";
