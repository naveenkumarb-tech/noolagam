// Filled in from package.json when the app is built. See vite.config.ts.
declare const __APP_VERSION__: string;

export const APP_VERSION = __APP_VERSION__;
export const APP_DESCRIPTION = "Track the books you own, who gave them, and what you are reading.";
export const DEVELOPER_NAME = "Naveen Kumar B";
export const DEVELOPER_EMAIL = "connectwithnaveenkumarb@gmail.com";
// A fixed year on purpose: it's when the work was first published, not the current year.
export const COPYRIGHT_NOTICE = `© 2026 ${DEVELOPER_NAME}. All rights reserved.`;
