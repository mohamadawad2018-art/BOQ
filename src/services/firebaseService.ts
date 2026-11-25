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
  doc,
  getDocFromServer,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export const OWNER_EMAIL = 'mohamad.awad.2018@gmail.com';
export const MAX_PAUSE_MESSAGE_LENGTH = 300;
const ACCESS_CACHE_KEY = 'boq_remote_access_cache_v1';
const ACCESS_DOC_PATH = 'app_config/access_control';

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
  synced: boolean;
}

const DEFAULT_PAUSE_MESSAGE =
  'تم إيقاف التطبيق مؤقتاً من قبل المسؤول. يُرجى التواصل مع المهندس المختص لإعادة التفعيل.';

export function loadCachedAccessState(): AppAccessState {
  try {
    const raw = window.localStorage.getItem(ACCESS_CACHE_KEY);
    if (!raw) {
      return { isActive: true, pauseMessage: DEFAULT_PAUSE_MESSAGE, synced: false };
    }
    const parsed = JSON.parse(raw) as Partial<AppAccessState>;
    return {
      isActive: typeof parsed.isActive === 'boolean' ? parsed.isActive : true,
      pauseMessage:
        typeof parsed.pauseMessage === 'string' && parsed.pauseMessage.trim()
          ? parsed.pauseMessage
          : DEFAULT_PAUSE_MESSAGE,
      synced: false,
    };
  } catch {
    return { isActive: true, pauseMessage: DEFAULT_PAUSE_MESSAGE, synced: false };
  }
}

function saveCachedAccessState(state: AppAccessState): void {
  try {
    window.localStorage.setItem(
      ACCESS_CACHE_KEY,
      JSON.stringify({ isActive: state.isActive, pauseMessage: state.pauseMessage })
    );
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
        const next: AppAccessState = {
          isActive: true,
          pauseMessage: DEFAULT_PAUSE_MESSAGE,
          synced: true,
        };
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
        synced: true,
      };
      saveCachedAccessState(next);
      onUpdate(next);
    },
    (error) => {
      // Offline / network errors must NOT crash the offline-first BOQ app; log structured info
      if (error.code === 'permission-denied') {
        handleFirestoreError(error, OperationType.GET, ACCESS_DOC_PATH);
      } else {
        console.warn('Access control listener offline, using cached state:', error.message);
      }
    }
  );
}

export async function setRemoteAppStatus(
  isActive: boolean,
  pauseMessage: string
): Promise<void> {
  const currentUser = auth.currentUser;
  if (!isOwnerUser(currentUser) || !currentUser) {
    throw new Error('غير مصرح — يتطلب تسجيل دخول المالك.');
  }

  const sanitizedMessage = (pauseMessage.trim() || DEFAULT_PAUSE_MESSAGE).slice(
    0,
    MAX_PAUSE_MESSAGE_LENGTH
  );

  const ref = doc(db, 'app_config', 'access_control');
  try {
    await setDoc(ref, {
      isActive: Boolean(isActive),
      pauseMessage: sanitizedMessage,
      updatedBy: currentUser.uid,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, ACCESS_DOC_PATH);
  }
}
