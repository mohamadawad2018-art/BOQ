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
  doc,
  getDoc,
  getDocFromServer,
  getFirestore,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
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

const ACCESS_CACHE_KEY = 'boq_remote_access_cache_v2';
const PERSONAL_PASS_CACHE_KEY = 'boq_personal_pass_cache_v1';
const ACCESS_DOC_PATH = 'app_config/access_control';

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
    passcodeEnabled: false,
    passcodeSalt: '',
    passcodeHash: '',
    passcodeVersion: 1,
    synced: false,
  };
}

export function loadCachedAccessState(): AppAccessState {
  try {
    const raw = window.localStorage.getItem(ACCESS_CACHE_KEY);
    if (!raw) return defaultAccessState();
    const parsed = JSON.parse(raw) as Partial<AppAccessState>;
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
      passcodeEnabled: typeof parsed.passcodeEnabled === 'boolean' ? parsed.passcodeEnabled : false,
      passcodeSalt: typeof parsed.passcodeSalt === 'string' ? parsed.passcodeSalt : '',
      passcodeHash: typeof parsed.passcodeHash === 'string' ? parsed.passcodeHash : '',
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
          typeof data.passcodeEnabled === 'boolean' ? data.passcodeEnabled : false,
        passcodeSalt: typeof data.passcodeSalt === 'string' ? data.passcodeSalt : '',
        passcodeHash: typeof data.passcodeHash === 'string' ? data.passcodeHash : '',
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
