import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getFirestore,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  type Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  derivePassLookupId,
  generateRandomHex,
  hashPasscodePBKDF2,
  isDateExpired,
  normalizePasscode,
  verifyPasscodePBKDF2,
} from '../utils/passcodeCrypto';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export const OWNER_EMAIL = 'mohamad.awad.2018@gmail.com';
export const MAX_PAUSE_MESSAGE_LENGTH = 300;
export const MAX_SIGNATURE_LENGTH = 120;
export const MAX_KEY_LABEL_LENGTH = 80;
export const MAX_DEVICE_LABEL_LENGTH = 60;

const ACCESS_CACHE_KEY = 'boq_remote_access_cache_v3';
const PERSONAL_PASS_CACHE_KEY = 'boq_personal_pass_cache_v1';
const DEVICE_ID_STORAGE_KEY = 'boq_device_id_v1';
const DEVICE_BLOCKED_CACHE_KEY = 'boq_device_blocked_v1';
const ACCESS_DOC_PATH = 'app_config/access_control';

// Pre-derived PBKDF2-SHA256 (100k iterations) initial passcode hash & salt (never plaintext)
const INITIAL_PASSCODE_SALT = 'e3cb1fb0de687c8fccb7c90ba7b0d64a';
const INITIAL_PASSCODE_HASH =
  'be8b90e4615dda92d640e29f17b5ee3ed304a5664375a56642b930603f37b6ef';

export const DEFAULT_OWNER_SIGNATURE = '© م. محمد عواد — جميع الحقوق محفوظة';
const LEGACY_OWNER_SIGNATURE = '© م. محمد عوض — جميع الحقوق محفوظة';
export const DEFAULT_PAUSE_MESSAGE =
  'تم إيقاف التطبيق مؤقتاً من قبل المسؤول. يُرجى التواصل مع المهندس المختص لإعادة التفعيل.';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate connection to Firestore on startup (offline-safe)
async function testConnection(): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();

export interface AppAccessState {
  isActive: boolean;
  pauseMessage: string;
  ownerSignature: string;
  passcodeEnabled: boolean;
  passcodeSalt: string;
  passcodeHash: string;
  passcodeVersion: number;
  synced: boolean;
}

export interface OwnerAccessKeyRecord {
  id: string;
  label: string;
  passLookupId: string;
  active: boolean;
  expiresAt: string;
  version: number;
}

export interface DeviceSessionRecord {
  id: string;
  deviceName: string;
  platform: 'mobile' | 'tablet' | 'desktop';
  customLabel: string;
  isBlocked: boolean;
  isOnline: boolean;
  createdMs: number;
  lastSeenMs: number;
  isCurrentlyConnected: boolean;
}

interface CachedPersonalPass {
  passLookupId: string;
  verifySalt: string;
  verifyHash: string;
  active: boolean;
  expiresAt: string;
  version: number;
}

export interface PasscodeVerificationResult {
  ok: boolean;
  mode?: 'global' | 'personal';
  passLookupId?: string;
  version?: number;
  error?: string;
}

function defaultAccessState(): AppAccessState {
  return {
    isActive: true,
    pauseMessage: DEFAULT_PAUSE_MESSAGE,
    ownerSignature: DEFAULT_OWNER_SIGNATURE,
    passcodeEnabled: true,
    passcodeSalt: INITIAL_PASSCODE_SALT,
    passcodeHash: INITIAL_PASSCODE_HASH,
    passcodeVersion: 1,
    synced: false,
  };
}

export function loadCachedAccessState(): AppAccessState {
  try {
    const raw = window.localStorage.getItem(ACCESS_CACHE_KEY);
    if (!raw) return defaultAccessState();
    const parsed = JSON.parse(raw) as Partial<AppAccessState>;
    const hasConfiguredPasscode =
      typeof parsed.passcodeSalt === 'string' && typeof parsed.passcodeHash === 'string';
    return {
      isActive: typeof parsed.isActive === 'boolean' ? parsed.isActive : true,
      pauseMessage:
        typeof parsed.pauseMessage === 'string' && parsed.pauseMessage.trim()
          ? parsed.pauseMessage
          : DEFAULT_PAUSE_MESSAGE,
      ownerSignature:
        typeof parsed.ownerSignature === 'string' &&
        parsed.ownerSignature.trim() &&
        parsed.ownerSignature.trim() !== LEGACY_OWNER_SIGNATURE
          ? parsed.ownerSignature
          : DEFAULT_OWNER_SIGNATURE,
      passcodeEnabled:
        typeof parsed.passcodeEnabled === 'boolean' ? parsed.passcodeEnabled : true,
      passcodeSalt: hasConfiguredPasscode ? (parsed.passcodeSalt as string) : INITIAL_PASSCODE_SALT,
      passcodeHash: hasConfiguredPasscode ? (parsed.passcodeHash as string) : INITIAL_PASSCODE_HASH,
      passcodeVersion:
        typeof parsed.passcodeVersion === 'number' && parsed.passcodeVersion >= 1
          ? Math.floor(parsed.passcodeVersion)
          : 1,
      synced: false,
    };
  } catch {
    return defaultAccessState();
  }
}

function saveCachedAccessState(state: AppAccessState): void {
  try {
    window.localStorage.setItem(
      ACCESS_CACHE_KEY,
      JSON.stringify({
        isActive: state.isActive,
        pauseMessage: state.pauseMessage,
        ownerSignature: state.ownerSignature,
        passcodeEnabled: state.passcodeEnabled,
        passcodeSalt: state.passcodeSalt,
        passcodeHash: state.passcodeHash,
        passcodeVersion: state.passcodeVersion,
      })
    );
  } catch {
    // ignore storage errors
  }
}

function loadCachedPersonalPass(): CachedPersonalPass | null {
  try {
    const raw = window.localStorage.getItem(PERSONAL_PASS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedPersonalPass>;
    if (
      typeof parsed.passLookupId === 'string' &&
      typeof parsed.verifySalt === 'string' &&
      typeof parsed.verifyHash === 'string'
    ) {
      return {
        passLookupId: parsed.passLookupId,
        verifySalt: parsed.verifySalt,
        verifyHash: parsed.verifyHash,
        active: parsed.active === true,
        expiresAt: typeof parsed.expiresAt === 'string' ? parsed.expiresAt : '',
        version: typeof parsed.version === 'number' ? parsed.version : 1,
      };
    }
    return null;
  } catch {
    return null;
  }
}

function saveCachedPersonalPass(pass: CachedPersonalPass): void {
  try {
    window.localStorage.setItem(PERSONAL_PASS_CACHE_KEY, JSON.stringify(pass));
  } catch {
    // ignore storage errors
  }
}

export function clearCachedPersonalPass(): void {
  try {
    window.localStorage.removeItem(PERSONAL_PASS_CACHE_KEY);
  } catch {
    // ignore storage errors
  }
}

export function isOwnerUser(user: User | null): boolean {
  if (!user || !user.email) return false;
  return user.emailVerified === true && user.email.toLowerCase() === OWNER_EMAIL;
}

export function subscribeToOwnerAuth(callback: (user: User | null, isOwner: boolean) => void) {
  return onAuthStateChanged(auth, (user) => {
    callback(user, isOwnerUser(user));
  });
}

export async function signInOwnerWithGoogle(): Promise<{ ok: boolean; error?: string }> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    const result = await signInWithPopup(auth, provider);
    if (!isOwnerUser(result.user)) {
      await signOut(auth);
      return {
        ok: false,
        error: 'هذا الحساب غير مخوّل للتحكم بالتطبيق — الصلاحية محصورة بحساب المالك فقط.',
      };
    }
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('popup-closed-by-user')) {
      return { ok: false, error: 'تم إلغاء نافذة تسجيل الدخول.' };
    }
    return { ok: false, error: 'تعذر تسجيل الدخول عبر Google — تأكد من الاتصال بالإنترنت.' };
  }
}

export async function signOutOwner(): Promise<void> {
  await signOut(auth);
}

export function subscribeToAccessControl(
  onUpdate: (state: AppAccessState) => void
): () => void {
  const ref = doc(db, 'app_config', 'access_control');
  return onSnapshot(
    ref,
    (snapshot) => {
      if (!snapshot.exists()) {
        const next: AppAccessState = { ...defaultAccessState(), synced: true };
        saveCachedAccessState(next);
        onUpdate(next);
        return;
      }
      const data = snapshot.data();
      const hasPasscodeFields =
        typeof data.passcodeSalt === 'string' && typeof data.passcodeHash === 'string';
      const next: AppAccessState = {
        isActive: typeof data.isActive === 'boolean' ? data.isActive : true,
        pauseMessage:
          typeof data.pauseMessage === 'string' && data.pauseMessage.trim()
            ? data.pauseMessage
            : DEFAULT_PAUSE_MESSAGE,
        ownerSignature:
          typeof data.ownerSignature === 'string' &&
          data.ownerSignature.trim() &&
          data.ownerSignature.trim() !== LEGACY_OWNER_SIGNATURE
            ? data.ownerSignature
            : DEFAULT_OWNER_SIGNATURE,
        passcodeEnabled:
          typeof data.passcodeEnabled === 'boolean' ? data.passcodeEnabled : true,
        passcodeSalt: hasPasscodeFields ? data.passcodeSalt : INITIAL_PASSCODE_SALT,
        passcodeHash: hasPasscodeFields ? data.passcodeHash : INITIAL_PASSCODE_HASH,
        passcodeVersion:
          typeof data.passcodeVersion === 'number' && data.passcodeVersion >= 1
            ? Math.floor(data.passcodeVersion)
            : 1,
        synced: true,
      };
      saveCachedAccessState(next);
      onUpdate(next);
    },
    (error) => {
      if (error.code === 'permission-denied') {
        handleFirestoreError(error, OperationType.GET, ACCESS_DOC_PATH);
      } else {
        console.warn('Access control listener offline, using cached state:', error.message);
      }
    }
  );
}

export async function saveAccessControlPolicy(
  current: AppAccessState,
  patch: Partial<{
    isActive: boolean;
    pauseMessage: string;
    ownerSignature: string;
    passcodeEnabled: boolean;
    newMasterPasscode: string;
    clearMasterPasscode: boolean;
    bumpVersion: boolean;
  }>
): Promise<void> {
  const currentUser = auth.currentUser;
  if (!isOwnerUser(currentUser) || !currentUser) {
    throw new Error('غير مصرح — يتطلب تسجيل دخول المالك.');
  }

  let passcodeSalt = current.passcodeSalt;
  let passcodeHash = current.passcodeHash;
  let passcodeVersion = Math.max(1, Math.floor(current.passcodeVersion || 1));

  if (patch.clearMasterPasscode) {
    passcodeSalt = '';
    passcodeHash = '';
    passcodeVersion += 1;
  } else if (patch.newMasterPasscode !== undefined) {
    const clean = normalizePasscode(patch.newMasterPasscode);
    if (clean.length < 4) {
      throw new Error('يجب أن تتكون كلمة السر من 4 أحرف أو أرقام على الأقل.');
    }
    passcodeSalt = generateRandomHex(16);
    passcodeHash = await hashPasscodePBKDF2(clean, passcodeSalt);
    passcodeVersion += 1;
  } else if (patch.bumpVersion) {
    passcodeVersion += 1;
  }

  const sanitizedMessage = (
    (patch.pauseMessage !== undefined ? patch.pauseMessage : current.pauseMessage).trim() ||
    DEFAULT_PAUSE_MESSAGE
  ).slice(0, MAX_PAUSE_MESSAGE_LENGTH);

  const sanitizedSignature = (
    (patch.ownerSignature !== undefined ? patch.ownerSignature : current.ownerSignature).trim() ||
    DEFAULT_OWNER_SIGNATURE
  ).slice(0, MAX_SIGNATURE_LENGTH);

  const ref = doc(db, 'app_config', 'access_control');
  try {
    await setDoc(ref, {
      isActive: patch.isActive !== undefined ? Boolean(patch.isActive) : Boolean(current.isActive),
      pauseMessage: sanitizedMessage,
      ownerSignature: sanitizedSignature,
      passcodeEnabled:
        patch.passcodeEnabled !== undefined
          ? Boolean(patch.passcodeEnabled)
          : Boolean(current.passcodeEnabled),
      passcodeSalt,
      passcodeHash,
      passcodeVersion: Math.min(1_000_000, passcodeVersion),
      updatedBy: currentUser.uid,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, ACCESS_DOC_PATH);
  }
}

// =========================================================================
// CONNECTED DEVICES TRACKING & OWNER-CONTROLLED PER-DEVICE BLOCKING
// =========================================================================

export function getOrCreateLocalDeviceId(): string {
  try {
    const existing = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (existing && /^dev_[a-f0-9]{16}$/.test(existing)) {
      return existing;
    }
    const fresh = `dev_${generateRandomHex(8)}`;
    window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, fresh);
    return fresh;
  } catch {
    return `dev_${generateRandomHex(8)}`;
  }
}

export function loadCachedDeviceBlocked(): boolean {
  try {
    return window.localStorage.getItem(DEVICE_BLOCKED_CACHE_KEY) === '1';
  } catch {
    return false;
  }
}

function saveCachedDeviceBlocked(blocked: boolean): void {
  try {
    window.localStorage.setItem(DEVICE_BLOCKED_CACHE_KEY, blocked ? '1' : '0');
  } catch {
    // ignore storage errors
  }
}

function detectDeviceInfo(): { deviceName: string; platform: 'mobile' | 'tablet' | 'desktop' } {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  const isIPad = /iPad/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  const isTablet = isIPad || (/Android/i.test(ua) && !/Mobile/i.test(ua));
  const isMobile = !isTablet && /Android|iPhone|iPod|Mobile/i.test(ua);
  const platform: 'mobile' | 'tablet' | 'desktop' = isTablet
    ? 'tablet'
    : isMobile
    ? 'mobile'
    : 'desktop';

  let os = 'جهاز';
  if (/iPhone/i.test(ua)) os = 'iPhone';
  else if (isIPad) os = 'iPad';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Mac OS X|Macintosh/i.test(ua)) os = 'Mac';
  else if (/Linux/i.test(ua)) os = 'Linux';

  let browser = 'Browser';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/OPR\/|Opera/i.test(ua)) browser = 'Opera';
  else if (/SamsungBrowser/i.test(ua)) browser = 'Samsung';
  else if (/CriOS|Chrome/i.test(ua)) browser = 'Chrome';
  else if (/FxiOS|Firefox/i.test(ua)) browser = 'Firefox';
  else if (/Safari/i.test(ua)) browser = 'Safari';

  return {
    deviceName: `${os} · ${browser}`.slice(0, 64),
    platform,
  };
}

export function registerAndWatchCurrentDevice(
  onBlockStatusChange: (isBlocked: boolean) => void
): () => void {
  const deviceId = getOrCreateLocalDeviceId();
  const { deviceName, platform } = detectDeviceInfo();
  const ref = doc(db, 'devices', deviceId);

  let disposed = false;
  let knownBlocked = loadCachedDeviceBlocked();

  const sendPresence = async (onlineFlag: boolean) => {
    if (disposed || knownBlocked) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    try {
      const snap = await getDoc(ref);
      if (disposed) return;
      if (!snap.exists()) {
        if (!onlineFlag) return;
        await setDoc(ref, {
          deviceName,
          platform,
          customLabel: '',
          isBlocked: false,
          isOnline: true,
          createdAt: serverTimestamp(),
          lastSeenAt: serverTimestamp(),
        });
      } else {
        const data = snap.data();
        if (data.isBlocked === true) {
          knownBlocked = true;
          saveCachedDeviceBlocked(true);
          onBlockStatusChange(true);
          return;
        }
        await updateDoc(ref, {
          deviceName,
          platform,
          isOnline: onlineFlag,
          lastSeenAt: serverTimestamp(),
        });
      }
    } catch {
      // Offline or blocked by security rules — safely ignore without crashing offline BOQ work
    }
  };

  void sendPresence(true);

  const unsubSnapshot = onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        if (knownBlocked) {
          knownBlocked = false;
          saveCachedDeviceBlocked(false);
          onBlockStatusChange(false);
        }
        return;
      }
      const data = snap.data();
      const blockedNow = data.isBlocked === true;
      knownBlocked = blockedNow;
      saveCachedDeviceBlocked(blockedNow);
      onBlockStatusChange(blockedNow);
    },
    () => {
      // Offline — retain cached block state
    }
  );

  const heartbeatInterval = window.setInterval(() => {
    if (document.visibilityState === 'visible') {
      void sendPresence(true);
    }
  }, 60_000);

  const handleVisibility = () => {
    void sendPresence(document.visibilityState === 'visible');
  };

  const handlePageHide = () => {
    void sendPresence(false);
  };

  const handleOnline = () => {
    void sendPresence(true);
  };

  document.addEventListener('visibilitychange', handleVisibility);
  window.addEventListener('pagehide', handlePageHide);
  window.addEventListener('online', handleOnline);

  return () => {
    disposed = true;
    unsubSnapshot();
    window.clearInterval(heartbeatInterval);
    document.removeEventListener('visibilitychange', handleVisibility);
    window.removeEventListener('pagehide', handlePageHide);
    window.removeEventListener('online', handleOnline);
  };
}

function timestampToMs(ts: unknown): number {
  if (!ts || typeof ts !== 'object') return 0;
  const maybeTs = ts as Timestamp;
  if (typeof maybeTs.toMillis === 'function') return maybeTs.toMillis();
  return 0;
}

export function subscribeToConnectedDevices(
  onUpdate: (devices: DeviceSessionRecord[]) => void
): () => void {
  const currentUser = auth.currentUser;
  if (!isOwnerUser(currentUser) || !currentUser) {
    onUpdate([]);
    return () => {};
  }

  // Filter matches Firestore rule `resource.data.deviceName is string`
  const q = query(collection(db, 'devices'), where('deviceName', '>=', ''));

  return onSnapshot(
    q,
    (snapshot) => {
      const now = Date.now();
      const list: DeviceSessionRecord[] = snapshot.docs.map((d) => {
        const data = d.data();
        const lastSeenMs = timestampToMs(data.lastSeenAt);
        const createdMs = timestampToMs(data.createdAt);
        const isBlocked = data.isBlocked === true;
        const isOnline = data.isOnline === true;
        // Consider truly live if isOnline && heartbeat within last 3 minutes
        const isCurrentlyConnected =
          !isBlocked && isOnline && lastSeenMs > 0 && now - lastSeenMs < 180_000;

        const rawPlat = data.platform;
        const platform: 'mobile' | 'tablet' | 'desktop' =
          rawPlat === 'mobile' || rawPlat === 'tablet' || rawPlat === 'desktop'
            ? rawPlat
            : 'desktop';

        return {
          id: d.id,
          deviceName: typeof data.deviceName === 'string' ? data.deviceName : 'جهاز غير معروف',
          platform,
          customLabel: typeof data.customLabel === 'string' ? data.customLabel : '',
          isBlocked,
          isOnline,
          createdMs,
          lastSeenMs,
          isCurrentlyConnected,
        };
      });

      list.sort((a, b) => {
        if (a.isCurrentlyConnected !== b.isCurrentlyConnected) {
          return a.isCurrentlyConnected ? -1 : 1;
        }
        return b.lastSeenMs - a.lastSeenMs;
      });
      onUpdate(list);
    },
    (error) => {
      if (error.code === 'permission-denied') {
        handleFirestoreError(error, OperationType.LIST, 'devices');
      } else {
        console.warn('Devices listener offline:', error.message);
      }
    }
  );
}

export async function setDeviceBlockedStatus(
  device: DeviceSessionRecord,
  nextBlocked: boolean
): Promise<void> {
  const currentUser = auth.currentUser;
  if (!isOwnerUser(currentUser) || !currentUser) {
    throw new Error('غير مصرح — يتطلب تسجيل دخول المالك.');
  }

  try {
    await updateDoc(doc(db, 'devices', device.id), {
      isBlocked: Boolean(nextBlocked),
      isOnline: nextBlocked ? false : device.isOnline,
      lastSeenAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `devices/${device.id}`);
  }
}

export async function renameDeviceLabel(deviceId: string, customLabel: string): Promise<void> {
  const currentUser = auth.currentUser;
  if (!isOwnerUser(currentUser) || !currentUser) {
    throw new Error('غير مصرح — يتطلب تسجيل دخول المالك.');
  }

  try {
    await updateDoc(doc(db, 'devices', deviceId), {
      customLabel: customLabel.trim().slice(0, MAX_DEVICE_LABEL_LENGTH),
      lastSeenAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `devices/${deviceId}`);
  }
}

export async function deleteDeviceRecord(deviceId: string): Promise<void> {
  const currentUser = auth.currentUser;
  if (!isOwnerUser(currentUser) || !currentUser) {
    throw new Error('غير مصرح — يتطلب تسجيل دخول المالك.');
  }

  try {
    await deleteDoc(doc(db, 'devices', deviceId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `devices/${deviceId}`);
  }
}

// =========================================================================
// OWNER-ONLY INDIVIDUAL ACCESS KEYS MANAGEMENT
// =========================================================================

export function subscribeToOwnerAccessKeys(
  onUpdate: (keys: OwnerAccessKeyRecord[]) => void
): () => void {
  const currentUser = auth.currentUser;
  if (!isOwnerUser(currentUser) || !currentUser) {
    onUpdate([]);
    return () => {};
  }

  const q = query(
    collection(db, 'owner_access_keys'),
    where('createdBy', '==', currentUser.uid)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const list: OwnerAccessKeyRecord[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          label: typeof data.label === 'string' ? data.label : '',
          passLookupId: typeof data.passLookupId === 'string' ? data.passLookupId : '',
          active: data.active === true,
          expiresAt: typeof data.expiresAt === 'string' ? data.expiresAt : '',
          version: typeof data.version === 'number' ? data.version : 1,
        };
      });
      list.sort((a, b) => a.label.localeCompare(b.label, 'ar'));
      onUpdate(list);
    },
    (error) => {
      if (error.code === 'permission-denied') {
        handleFirestoreError(error, OperationType.LIST, 'owner_access_keys');
      } else {
        console.warn('Owner access keys listener offline:', error.message);
      }
    }
  );
}

export async function createPersonalAccessKey(params: {
  label: string;
  passcode: string;
  expiresAt: string;
  policyVersion: number;
}): Promise<void> {
  const currentUser = auth.currentUser;
  if (!isOwnerUser(currentUser) || !currentUser) {
    throw new Error('غير مصرح — يتطلب تسجيل دخول المالك.');
  }

  const cleanLabel = params.label.trim().slice(0, MAX_KEY_LABEL_LENGTH);
  if (!cleanLabel) {
    throw new Error('أدخل اسم الشخص أو الموقع أولاً.');
  }

  const cleanCode = normalizePasscode(params.passcode);
  if (cleanCode.length < 4) {
    throw new Error('رمز الدخول يجب أن يكون 4 أحرف أو أرقام على الأقل.');
  }

  const cleanExpiry = /^\d{4}-\d{2}-\d{2}$/.test(params.expiresAt.trim())
    ? params.expiresAt.trim()
    : '';

  const passLookupId = await derivePassLookupId(cleanCode);
  const verifySalt = generateRandomHex(16);
  const verifyHash = await hashPasscodePBKDF2(cleanCode, verifySalt);
  const keyId = `key_${generateRandomHex(8)}`;
  const version = Math.max(1, Math.min(1_000_000, Math.floor(params.policyVersion || 1)));

  const batch = writeBatch(db);
  const passRef = doc(db, 'access_passes', passLookupId);
  const ownerKeyRef = doc(db, 'owner_access_keys', keyId);

  batch.set(passRef, {
    active: true,
    expiresAt: cleanExpiry,
    version,
    verifySalt,
    verifyHash,
    updatedBy: currentUser.uid,
    updatedAt: serverTimestamp(),
  });

  batch.set(ownerKeyRef, {
    label: cleanLabel,
    passLookupId,
    active: true,
    expiresAt: cleanExpiry,
    version,
    createdBy: currentUser.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `owner_access_keys/${keyId}`);
  }
}

export async function togglePersonalAccessKey(
  key: OwnerAccessKeyRecord,
  nextActive: boolean
): Promise<void> {
  const currentUser = auth.currentUser;
  if (!isOwnerUser(currentUser) || !currentUser) {
    throw new Error('غير مصرح — يتطلب تسجيل دخول المالك.');
  }

  const batch = writeBatch(db);
  batch.update(doc(db, 'owner_access_keys', key.id), {
    active: Boolean(nextActive),
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(db, 'access_passes', key.passLookupId), {
    active: Boolean(nextActive),
    updatedBy: currentUser.uid,
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `owner_access_keys/${key.id}`);
  }
}

export async function deletePersonalAccessKey(key: OwnerAccessKeyRecord): Promise<void> {
  const currentUser = auth.currentUser;
  if (!isOwnerUser(currentUser) || !currentUser) {
    throw new Error('غير مصرح — يتطلب تسجيل دخول المالك.');
  }

  const batch = writeBatch(db);
  batch.delete(doc(db, 'access_passes', key.passLookupId));
  batch.delete(doc(db, 'owner_access_keys', key.id));

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `owner_access_keys/${key.id}`);
  }
}

// =========================================================================
// ONLINE + OFFLINE PASSCODE GATE VERIFICATION
// =========================================================================

export async function verifyAccessPasscode(
  inputCode: string,
  accessState: AppAccessState
): Promise<PasscodeVerificationResult> {
  const clean = normalizePasscode(inputCode);
  if (!clean) {
    return { ok: false, error: 'يُرجى إدخال كلمة السر أو رمز الدخول.' };
  }

  // 1. Check Global Master Passcode (works 100% online & offline via cached PBKDF2 hash)
  if (accessState.passcodeSalt && accessState.passcodeHash) {
    const matchesGlobal = await verifyPasscodePBKDF2(
      clean,
      accessState.passcodeSalt,
      accessState.passcodeHash
    );
    if (matchesGlobal) {
      return {
        ok: true,
        mode: 'global',
        version: accessState.passcodeVersion,
      };
    }
  }

  // 2. Check Personal Access Key (Online lookup first, then Offline cached hash fallback)
  const passLookupId = await derivePassLookupId(clean);
  const isOnline = typeof navigator === 'undefined' ? true : navigator.onLine;

  if (isOnline) {
    try {
      const snap = await getDoc(doc(db, 'access_passes', passLookupId));
      if (snap.exists()) {
        const data = snap.data();
        const active = data.active === true;
        const expiresAt = typeof data.expiresAt === 'string' ? data.expiresAt : '';
        const verifySalt = typeof data.verifySalt === 'string' ? data.verifySalt : '';
        const verifyHash = typeof data.verifyHash === 'string' ? data.verifyHash : '';
        const version = typeof data.version === 'number' ? data.version : 1;

        if (!active) {
          clearCachedPersonalPass();
          return {
            ok: false,
            error: 'تم إيقاف رمز الدخول الخاص بك من قِبل المالك.',
          };
        }
        if (isDateExpired(expiresAt)) {
          clearCachedPersonalPass();
          return {
            ok: false,
            error: `انتهت صلاحية رمز الدخول بتاريخ ${expiresAt}.`,
          };
        }

        const verified = await verifyPasscodePBKDF2(clean, verifySalt, verifyHash);
        if (verified) {
          saveCachedPersonalPass({
            passLookupId,
            verifySalt,
            verifyHash,
            active: true,
            expiresAt,
            version,
          });
          return {
            ok: true,
            mode: 'personal',
            passLookupId,
            version,
          };
        }
      }
    } catch {
      // Network hiccup — fall through to offline cached personal pass verification
    }
  }

  // Offline verification using this device's previously synced salted PBKDF2 personal pass
  const cachedPass = loadCachedPersonalPass();
  if (cachedPass && cachedPass.passLookupId === passLookupId) {
    if (!cachedPass.active) {
      return { ok: false, error: 'تم إيقاف رمز الدخول الخاص بك من قِبل المالك.' };
    }
    if (isDateExpired(cachedPass.expiresAt)) {
      return {
        ok: false,
        error: `انتهت صلاحية رمز الدخول بتاريخ ${cachedPass.expiresAt}.`,
      };
    }
    const verifiedOffline = await verifyPasscodePBKDF2(
      clean,
      cachedPass.verifySalt,
      cachedPass.verifyHash
    );
    if (verifiedOffline) {
      return {
        ok: true,
        mode: 'personal',
        passLookupId,
        version: cachedPass.version,
      };
    }
  }

  if (!isOnline && !accessState.passcodeHash && !cachedPass) {
    return {
      ok: false,
      error: 'يتطلب التحقق من رمز الدخول الشخصي اتصالاً بالإنترنت في المرة الأولى فقط.',
    };
  }

  return {
    ok: false,
    error: 'كلمة السر أو رمز الدخول غير صحيح.',
  };
}

export function subscribeToPersonalPassStatus(
  passLookupId: string,
  onRevoked: (reason: string) => void
): () => void {
  const ref = doc(db, 'access_passes', passLookupId);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        clearCachedPersonalPass();
        onRevoked('تم إلغاء رمز الدخول الخاص بك من قِبل المالك.');
        return;
      }
      const data = snap.data();
      const active = data.active === true;
      const expiresAt = typeof data.expiresAt === 'string' ? data.expiresAt : '';
      if (!active) {
        clearCachedPersonalPass();
        onRevoked('تم إيقاف رمز الدخول الخاص بك من قِبل المالك.');
        return;
      }
      if (isDateExpired(expiresAt)) {
        clearCachedPersonalPass();
        onRevoked(`انتهت صلاحية رمز الدخول بتاريخ ${expiresAt}.`);
      }
    },
    () => {
      // Ignore offline errors — stay offline-friendly while unlocked
    }
  );
}
