import React, { useEffect, useState } from 'react';
import {
  Ban,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Copyright,
  Edit3,
  Eye,
  EyeOff,
  KeyRound,
  Laptop,
  Lock,
  LogOut,
  Plus,
  Power,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Tablet,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import {
  AppAccessState,
  createPersonalAccessKey,
  deleteDeviceRecord,
  deletePersonalAccessKey,
  DeviceSessionRecord,
  getOrCreateLocalDeviceId,
  MAX_DEVICE_LABEL_LENGTH,
  MAX_KEY_LABEL_LENGTH,
  MAX_PAUSE_MESSAGE_LENGTH,
  MAX_SIGNATURE_LENGTH,
  OwnerAccessKeyRecord,
  PasscodeVerificationResult,
  renameDeviceLabel,
  saveAccessControlPolicy,
  setDeviceBlockedStatus,
  signInOwnerWithGoogle,
  signOutOwner,
  subscribeToConnectedDevices,
  subscribeToOwnerAccessKeys,
  togglePersonalAccessKey,
  verifyAccessPasscode,
} from '../services/firebaseService';
import { generateReadableAccessCode, isDateExpired } from '../utils/passcodeCrypto';

type OwnerPanelTab = 'devices' | 'passcode' | 'users' | 'copyright' | 'general';

function formatRelativeTime(ms: number): string {
  if (!ms) return 'غير معروف';
  const diffSec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (diffSec < 60) return 'الآن';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `منذ ${diffMin} دقيقة`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `منذ ${diffHr} ساعة`;
  return new Date(ms).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
}

interface OwnerControlBarProps {
  accessState: AppAccessState;
  onStatusChanged: (msg: string) => void;
}

export const OwnerControlBar: React.FC<OwnerControlBarProps> = ({
  accessState,
  onStatusChanged,
}) => {
  const [panelOpen, setPanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<OwnerPanelTab>('devices');
  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  // Connected devices state
  const [devices, setDevices] = useState<DeviceSessionRecord[]>([]);
  const [editingDeviceId, setEditingDeviceId] = useState<string | null>(null);
  const [deviceLabelDraft, setDeviceLabelDraft] = useState('');
  const localDeviceId = getOrCreateLocalDeviceId();

  // General tab state
  const [draftMessage, setDraftMessage] = useState(accessState.pauseMessage);

  // Copyright tab state
  const [draftSignature, setDraftSignature] = useState(accessState.ownerSignature);

  // Master passcode tab state
  const [newMasterCode, setNewMasterCode] = useState('');
  const [showMasterCode, setShowMasterCode] = useState(true);
  const [lastSavedMasterCode, setLastSavedMasterCode] = useState<string | null>(null);
  const [copiedMaster, setCopiedMaster] = useState(false);

  // Personal access keys tab state
  const [personalKeys, setPersonalKeys] = useState<OwnerAccessKeyRecord[]>([]);
  const [newKeyLabel, setNewKeyLabel] = useState('');
  const [newKeyCode, setNewKeyCode] = useState(() => generateReadableAccessCode());
  const [newKeyExpiry, setNewKeyExpiry] = useState('');
  const [lastCreatedKey, setLastCreatedKey] = useState<{
    label: string;
    code: string;
    expiresAt: string;
  } | null>(null);
  const [copiedPersonal, setCopiedPersonal] = useState(false);

  useEffect(() => {
    setDraftMessage(accessState.pauseMessage);
  }, [accessState.pauseMessage]);

  useEffect(() => {
    setDraftSignature(accessState.ownerSignature);
  }, [accessState.ownerSignature]);

  useEffect(() => {
    const unsubKeys = subscribeToOwnerAccessKeys((list) => {
      setPersonalKeys(list);
    });
    const unsubDevices = subscribeToConnectedDevices((list) => {
      setDevices(list);
    });
    return () => {
      unsubKeys();
      unsubDevices();
    };
  }, []);

  const copyText = async (text: string, which: 'master' | 'personal') => {
    try {
      await navigator.clipboard.writeText(text);
      if (which === 'master') {
        setCopiedMaster(true);
        window.setTimeout(() => setCopiedMaster(false), 2000);
      } else {
        setCopiedPersonal(true);
        window.setTimeout(() => setCopiedPersonal(false), 2000);
      }
      onStatusChanged('تم النسخ إلى الحافظة');
    } catch {
      onStatusChanged('تعذر النسخ تلقائياً — انسخ الرمز يدوياً');
    }
  };

  const handleToggleApp = async () => {
    setBusy(true);
    setErrorText(null);
    try {
      const nextActive = !accessState.isActive;
      await saveAccessControlPolicy(accessState, { isActive: nextActive });
      onStatusChanged(
        nextActive
          ? 'تم تشغيل التطبيق للجميع بنجاح'
          : 'تم إيقاف التطبيق عن جميع المستخدمين (باستثناء جهازك)'
      );
    } catch (err) {
      setErrorText(
        err instanceof Error ? err.message : 'تعذر تحديث حالة التطبيق — تأكد من الاتصال بالإنترنت.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleSaveMessage = async () => {
    setBusy(true);
    setErrorText(null);
    try {
      await saveAccessControlPolicy(accessState, { pauseMessage: draftMessage });
      onStatusChanged('تم حفظ رسالة الإيقاف المخصّصة');
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : 'تعذر حفظ الرسالة.');
    } finally {
      setBusy(false);
    }
  };

  const handleForceLockAllSessions = async () => {
    setBusy(true);
    setErrorText(null);
    try {
      await saveAccessControlPolicy(accessState, { bumpVersion: true });
      onStatusChanged('تم إغلاق جميع الجلسات المفتوحة — سيُطلب الرمز مجدداً من الجميع');
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : 'تعذر تنفيذ الأمر.');
    } finally {
      setBusy(false);
    }
  };

  const handleTogglePasscodeLock = async () => {
    const nextEnabled = !accessState.passcodeEnabled;
    if (nextEnabled && !accessState.passcodeHash && personalKeys.length === 0) {
      setPanelOpen(true);
      setActiveTab('passcode');
      setErrorText('عيّن كلمة سر عامة أو أضف رمز دخول لمستخدم واحد على الأقل قبل تفعيل القفل.');
      return;
    }
    setBusy(true);
    setErrorText(null);
    try {
      await saveAccessControlPolicy(accessState, {
        passcodeEnabled: nextEnabled,
        bumpVersion: nextEnabled,
      });
      onStatusChanged(
        nextEnabled
          ? 'تم تفعيل قفل كلمة السر (يعمل أونلاين وأوفلاين على جميع الأجهزة)'
          : 'تم تعطيل قفل كلمة السر — التطبيق مفتوح الآن بدون رمز'
      );
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : 'تعذر تحديث إعداد القفل.');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveMasterPasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newMasterCode.trim();
    if (trimmed.length < 4) {
      setErrorText('يجب أن تتكون كلمة السر من 4 أحرف أو أرقام على الأقل.');
      return;
    }
    setBusy(true);
    setErrorText(null);
    try {
      await saveAccessControlPolicy(accessState, {
        newMasterPasscode: trimmed,
        passcodeEnabled: true,
      });
      setLastSavedMasterCode(trimmed);
      setNewMasterCode('');
      onStatusChanged('تم تعديل وحفظ كلمة السر الجديدة وتفعيل القفل فوراً');
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : 'تعذر حفظ كلمة السر.');
    } finally {
      setBusy(false);
    }
  };

  const handleClearMasterPasscode = async () => {
    setBusy(true);
    setErrorText(null);
    try {
      await saveAccessControlPolicy(accessState, {
        clearMasterPasscode: true,
        passcodeEnabled: personalKeys.length > 0 ? accessState.passcodeEnabled : false,
      });
      setLastSavedMasterCode(null);
      onStatusChanged('تم إلغاء كلمة السر العامة (يبقى الدخول عبر أكواد المستخدمين الفردية فقط)');
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : 'تعذر إلغاء كلمة السر العامة.');
    } finally {
      setBusy(false);
    }
  };

  const handleToggleDeviceBlock = async (device: DeviceSessionRecord) => {
    setBusy(true);
    setErrorText(null);
    try {
      const nextBlocked = !device.isBlocked;
      await setDeviceBlockedStatus(device, nextBlocked);
      const name = device.customLabel || device.deviceName;
      onStatusChanged(
        nextBlocked
          ? `تم حظر الجهاز "${name}" فوراً ومنعه من الدخول (حتى أوفلاين)`
          : `تم فك الحظر عن الجهاز "${name}"`
      );
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : 'تعذر تحديث حالة الجهاز.');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveDeviceLabel = async (deviceId: string) => {
    setBusy(true);
    setErrorText(null);
    try {
      await renameDeviceLabel(deviceId, deviceLabelDraft);
      setEditingDeviceId(null);
      onStatusChanged('تم حفظ تسمية الجهاز');
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : 'تعذر حفظ اسم الجهاز.');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteDevice = async (device: DeviceSessionRecord) => {
    setBusy(true);
    setErrorText(null);
    try {
      await deleteDeviceRecord(device.id);
      onStatusChanged(`تمت إزالة الجهاز "${device.customLabel || device.deviceName}" من القائمة`);
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : 'تعذر حذف سجل الجهاز.');
    } finally {
      setBusy(false);
    }
  };

  const handleCreatePersonalKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrorText(null);
    try {
      const codeToSave = newKeyCode.trim();
      const labelToSave = newKeyLabel.trim();
      const expiryToSave = newKeyExpiry.trim();

      await createPersonalAccessKey({
        label: labelToSave,
        passcode: codeToSave,
        expiresAt: expiryToSave,
        policyVersion: accessState.passcodeVersion,
      });

      if (!accessState.passcodeEnabled) {
        await saveAccessControlPolicy(accessState, { passcodeEnabled: true });
      }

      setLastCreatedKey({
        label: labelToSave,
        code: codeToSave,
        expiresAt: expiryToSave,
      });
      setNewKeyLabel('');
      setNewKeyCode(generateReadableAccessCode());
      setNewKeyExpiry('');
      onStatusChanged(`تم إنشاء رمز الدخول الخاص بـ "${labelToSave}" بنجاح`);
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : 'تعذر إنشاء رمز الدخول.');
    } finally {
      setBusy(false);
    }
  };

  const handleTogglePersonalKey = async (key: OwnerAccessKeyRecord) => {
    setBusy(true);
    setErrorText(null);
    try {
      await togglePersonalAccessKey(key, !key.active);
      onStatusChanged(
        !key.active
          ? `تم إعادة تفعيل دخول "${key.label}"`
          : `تم إيقاف ومنع دخول "${key.label}" فوراً`
      );
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : 'تعذر تعديل صلاحية المستخدم.');
    } finally {
      setBusy(false);
    }
  };

  const handleDeletePersonalKey = async (key: OwnerAccessKeyRecord) => {
    setBusy(true);
    setErrorText(null);
    try {
      await deletePersonalAccessKey(key);
      onStatusChanged(`تم حذف صلاحية "${key.label}" نهائياً`);
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : 'تعذر حذف صلاحية المستخدم.');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveSignature = async () => {
    setBusy(true);
    setErrorText(null);
    try {
      await saveAccessControlPolicy(accessState, { ownerSignature: draftSignature });
      onStatusChanged('تم حفظ حقوق الملكية وتحديثها في جميع الشاشات وملفات Excel');
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : 'تعذر حفظ حقوق الملكية.');
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    await signOutOwner();
    onStatusChanged('تم إخفاء لوحة المالك وتسجيل الخروج');
  };

  const onlineDevicesCount = devices.filter((d) => d.isCurrentlyConnected).length;
  const blockedDevicesCount = devices.filter((d) => d.isBlocked).length;

  return (
    <div
      className={`rounded-2xl border overflow-hidden transition-colors ${
        accessState.isActive
          ? 'bg-[#111827] border-emerald-500/40'
          : 'bg-rose-950/35 border-rose-500/60'
      }`}
    >
      {/* Compact 1-Row Owner Header */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 p-3.5 sm:px-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
              accessState.isActive
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                : 'bg-rose-500/20 border-rose-500/50 text-rose-300'
            }`}
          >
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="text-xs sm:text-sm font-bold text-slate-100">
                لوحة المالك والحماية
              </span>
              <span
                className={`text-[11px] font-semibold ${
                  accessState.isActive ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {accessState.isActive ? 'يعمل' : 'متوقف'}
              </span>
              <span className="text-slate-600" aria-hidden="true">
                ·
              </span>
              <span
                className={`text-[11px] font-semibold ${
                  accessState.passcodeEnabled ? 'text-cyan-400' : 'text-amber-400'
                }`}
              >
                {accessState.passcodeEnabled ? 'القفل مفعّل' : 'بدون قفل'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 truncate">
              <strong className="font-num text-emerald-400">{onlineDevicesCount}</strong> متصل الآن
              {' · '}
              <strong className="font-num text-slate-200">{devices.length}</strong> جهاز مسجّل
              {blockedDevicesCount > 0 && (
                <>
                  {' · '}
                  <strong className="font-num text-rose-400">{blockedDevicesCount}</strong> محظور
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          <button
            type="button"
            disabled={busy}
            onClick={handleToggleApp}
            className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 min-h-[40px] px-3 rounded-xl text-xs font-bold text-white transition-colors whitespace-nowrap disabled:opacity-50 ${
              accessState.isActive
                ? 'bg-rose-600 hover:bg-rose-500'
                : 'bg-emerald-600 hover:bg-emerald-500'
            }`}
          >
            <Power className="h-3.5 w-3.5" />
            <span>{accessState.isActive ? 'إيقاف التطبيق' : 'تشغيل التطبيق'}</span>
          </button>

          <button
            type="button"
            onClick={() => setPanelOpen((v) => !v)}
            className={`inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-xl border text-xs font-semibold transition-colors whitespace-nowrap ${
              panelOpen
                ? 'border-cyan-400/60 bg-cyan-500/15 text-cyan-300'
                : 'border-slate-700 bg-[#0b0f19] text-slate-200 hover:border-cyan-500/40'
            }`}
          >
            <KeyRound className="h-3.5 w-3.5" />
            <span>الأجهزة وكلمة السر</span>
            {panelOpen ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>

          <button
            type="button"
            onClick={handleSignOut}
            title="إخفاء لوحة المالك"
            className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-xl border border-slate-800 bg-[#0b0f19] text-slate-400 hover:border-slate-600 hover:text-slate-100 transition-colors"
            aria-label="إخفاء لوحة المالك"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>

      {errorText && (
        <div className="mx-3.5 mb-3 rounded-xl bg-rose-500/10 border border-rose-500/40 px-3 py-2 text-xs text-rose-300 flex items-center justify-between gap-2">
          <span>{errorText}</span>
          <button
            type="button"
            onClick={() => setErrorText(null)}
            className="text-rose-400 hover:text-rose-200"
            aria-label="إغلاق التنبيه"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Expandable 5-Tab Security, Devices & Copyright Control Center */}
      {panelOpen && (
        <div className="border-t border-slate-800/80 bg-[#0b0f19]/60 p-3.5 sm:p-4 space-y-4">
          {/* 5-Tab Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setActiveTab('devices')}
              className={`inline-flex items-center justify-center gap-1.5 min-h-[38px] px-3 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 border ${
                activeTab === 'devices'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-[#0b0f19] border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Smartphone className="h-3.5 w-3.5" />
              <span>الأجهزة ({devices.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('passcode')}
              className={`inline-flex items-center justify-center gap-1.5 min-h-[38px] px-3 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 border ${
                activeTab === 'passcode'
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                  : 'bg-[#0b0f19] border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Lock className="h-3.5 w-3.5" />
              <span>كلمة السر</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('users')}
              className={`inline-flex items-center justify-center gap-1.5 min-h-[38px] px-3 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 border ${
                activeTab === 'users'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-[#0b0f19] border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              <span>أكواد فردية ({personalKeys.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('copyright')}
              className={`inline-flex items-center justify-center gap-1.5 min-h-[38px] px-3 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 border ${
                activeTab === 'copyright'
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                  : 'bg-[#0b0f19] border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Copyright className="h-3.5 w-3.5" />
              <span>حقوق الملكية</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('general')}
              className={`inline-flex items-center justify-center gap-1.5 min-h-[38px] px-3 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 border ${
                activeTab === 'general'
                  ? 'bg-rose-500/15 text-rose-300 border-rose-500/40'
                  : 'bg-[#0b0f19] border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              <span>الإيقاف والجلسات</span>
            </button>
          </div>

          {/* TAB 0: CONNECTED DEVICES & PER-DEVICE BLOCKING */}
          {activeTab === 'devices' && (
            <div className="space-y-3">
              {/* Live Summary Strip */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-[#111827] border border-emerald-500/30 p-3 text-center">
                  <div className="font-num text-lg font-bold text-emerald-400">
                    {onlineDevicesCount}
                  </div>
                  <div className="text-[11px] text-slate-400">متصل الآن</div>
                </div>
                <div className="rounded-xl bg-[#111827] border border-slate-800 p-3 text-center">
                  <div className="font-num text-lg font-bold text-slate-100">{devices.length}</div>
                  <div className="text-[11px] text-slate-400">إجمالي الأجهزة</div>
                </div>
                <div className="rounded-xl bg-[#111827] border border-rose-500/30 p-3 text-center">
                  <div className="font-num text-lg font-bold text-rose-400">
                    {blockedDevicesCount}
                  </div>
                  <div className="text-[11px] text-slate-400">أجهزة محظورة</div>
                </div>
              </div>

              {devices.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-800 py-6 px-4 text-center text-xs text-slate-400">
                  لم يتم تسجيل أجهزة متصلة بعد — سيظهر هنا كل جهاز يفتح التطبيق تلقائياً مع إمكانية
                  تسميته أو حظره فوراً.
                </div>
              ) : (
                <div className="space-y-2">
                  {devices.map((dev) => {
                    const isThisDevice = dev.id === localDeviceId;
                    const isEditing = editingDeviceId === dev.id;

                    return (
                      <div
                        key={dev.id}
                        className={`rounded-xl border p-3 space-y-2.5 transition-colors ${
                          dev.isBlocked
                            ? 'bg-rose-950/25 border-rose-500/45'
                            : dev.isCurrentlyConnected
                            ? 'bg-[#111827] border-emerald-500/35'
                            : 'bg-[#111827] border-slate-800'
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="flex items-start gap-2.5 min-w-0">
                            <div
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
                                dev.isBlocked
                                  ? 'bg-rose-500/15 border-rose-500/40 text-rose-400'
                                  : dev.isCurrentlyConnected
                                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                                  : 'bg-slate-800/70 border-slate-700 text-slate-400'
                              }`}
                            >
                              {dev.platform === 'mobile' ? (
                                <Smartphone className="h-4 w-4" />
                              ) : dev.platform === 'tablet' ? (
                                <Tablet className="h-4 w-4" />
                              ) : (
                                <Laptop className="h-4 w-4" />
                              )}
                            </div>

                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                <span className="text-xs sm:text-sm font-bold text-slate-100 truncate">
                                  {dev.customLabel || dev.deviceName}
                                </span>
                                {isThisDevice && (
                                  <span className="text-[11px] font-semibold text-cyan-400">
                                    (جهازك الحالي)
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-x-2">
                                {dev.customLabel && <span>{dev.deviceName}</span>}
                                {dev.customLabel && <span aria-hidden="true">·</span>}
                                <span
                                  className={
                                    dev.isBlocked
                                      ? 'text-rose-400 font-semibold'
                                      : dev.isCurrentlyConnected
                                      ? 'text-emerald-400 font-semibold'
                                      : 'text-slate-400'
                                  }
                                >
                                  {dev.isBlocked
                                    ? 'محظور من الدخول'
                                    : dev.isCurrentlyConnected
                                    ? 'متصل الآن'
                                    : `آخر ظهور: ${formatRelativeTime(dev.lastSeenMs)}`}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span className="font-num text-slate-500" dir="ltr">
                                  {dev.id.slice(0, 10)}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => {
                                if (isEditing) {
                                  setEditingDeviceId(null);
                                } else {
                                  setEditingDeviceId(dev.id);
                                  setDeviceLabelDraft(dev.customLabel);
                                }
                              }}
                              title="تسمية الجهاز"
                              className="inline-flex items-center gap-1 min-h-[36px] px-2.5 rounded-lg border border-slate-700 bg-[#0b0f19] text-xs font-medium text-slate-300 hover:border-cyan-500/40 hover:text-cyan-300 transition-colors"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                              <span>تسمية</span>
                            </button>

                            {!isThisDevice && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => handleToggleDeviceBlock(dev)}
                                className={`inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-lg text-xs font-bold transition-colors whitespace-nowrap disabled:opacity-50 ${
                                  dev.isBlocked
                                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                    : 'bg-rose-600 hover:bg-rose-500 text-white'
                                }`}
                              >
                                <Ban className="h-3.5 w-3.5" />
                                <span>{dev.isBlocked ? 'فك الحظر' : 'حظر الجهاز'}</span>
                              </button>
                            )}

                            {!isThisDevice && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => handleDeleteDevice(dev)}
                                title="حذف من القائمة"
                                className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-lg border border-slate-800 bg-[#0b0f19] text-slate-400 hover:border-rose-500/40 hover:text-rose-400 transition-colors"
                                aria-label="حذف سجل الجهاز"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {isEditing && (
                          <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
                            <input
                              type="text"
                              maxLength={MAX_DEVICE_LABEL_LENGTH}
                              value={deviceLabelDraft}
                              onChange={(e) => setDeviceLabelDraft(e.target.value)}
                              placeholder="مثلاً: موبايل م. أحمد — الموقع الشمالي"
                              className="flex-1 min-h-[38px] rounded-lg bg-[#0b0f19] border border-slate-700 px-3 text-xs text-slate-100 focus:border-cyan-400/70 outline-none"
                            />
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => handleSaveDeviceLabel(dev.id)}
                              className="min-h-[38px] px-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-xs font-bold text-white whitespace-nowrap"
                            >
                              حفظ
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 1: MASTER PASSCODE (ONLINE + OFFLINE) */}
          {activeTab === 'passcode' && (
            <div className="space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#111827] border border-slate-800 p-3.5">
                <div className="space-y-0.5">
                  <div className="text-xs sm:text-sm font-bold text-slate-100">
                    قفل التطبيق بكلمة سر (أونلاين وأوفلاين)
                  </div>
                  <p className="text-[11px] text-slate-400">
                    عند التفعيل، يُطلب إدخال كلمة السر في كل مرة يُفتح فيها التطبيق حتى بدون اتصال إنترنت.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleTogglePasscodeLock}
                  className={`min-h-[40px] px-4 rounded-xl text-xs font-bold transition-colors whitespace-nowrap disabled:opacity-50 ${
                    accessState.passcodeEnabled
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                  }`}
                >
                  {accessState.passcodeEnabled ? 'مفعّل — اضغط للتعطيل' : 'معطّل — اضغط للتفعيل'}
                </button>
              </div>

              <form
                onSubmit={handleSaveMasterPasscode}
                className="rounded-xl bg-[#111827] border border-slate-800 p-3.5 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-bold text-slate-200">
                    تعديل كلمة السر العامة (تُحفظ مشفّرة بالكامل وتُطبَّق فوراً على الجميع)
                  </label>
                  <span
                    className={`text-[11px] font-semibold ${
                      accessState.passcodeHash ? 'text-emerald-400' : 'text-slate-500'
                    }`}
                  >
                    {accessState.passcodeHash ? 'كلمة السر مفعّلة' : 'غير معيّنة'}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 min-w-[180px]">
                    <input
                      type={showMasterCode ? 'text' : 'password'}
                      value={newMasterCode}
                      onChange={(e) => setNewMasterCode(e.target.value)}
                      placeholder="أدخل كلمة السر الجديدة (4 أحرف أو أرقام على الأقل)..."
                      dir="ltr"
                      className="font-num w-full min-h-[42px] rounded-xl bg-[#0b0f19] border border-slate-700/80 pl-10 pr-3.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-cyan-400/70 outline-none text-left"
                    />
                    <button
                      type="button"
                      onClick={() => setShowMasterCode((v) => !v)}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                      aria-label="إظهار أو إخفاء كلمة السر"
                    >
                      {showMasterCode ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setNewMasterCode(generateReadableAccessCode())}
                    className="inline-flex items-center gap-1.5 min-h-[42px] px-3 rounded-xl border border-slate-700 bg-[#0b0f19] text-xs font-semibold text-slate-300 hover:border-cyan-500/40 hover:text-cyan-300 transition-colors whitespace-nowrap"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>توليد</span>
                  </button>

                  <button
                    type="submit"
                    disabled={busy || newMasterCode.trim().length < 4}
                    className="min-h-[42px] px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-xs font-bold text-white transition-colors whitespace-nowrap disabled:opacity-50"
                  >
                    حفظ التعديل
                  </button>
                </div>

                {lastSavedMasterCode && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/35 px-3 py-2 text-xs">
                    <span className="text-emerald-200">
                      كلمة السر الجديدة:{' '}
                      <strong className="font-num text-emerald-300 select-all" dir="ltr">
                        {lastSavedMasterCode}
                      </strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => copyText(lastSavedMasterCode, 'master')}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600/30 border border-emerald-400/40 px-2.5 py-1 text-[11px] font-bold text-emerald-200 hover:bg-emerald-600/45"
                    >
                      {copiedMaster ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      <span>{copiedMaster ? 'تم النسخ' : 'نسخ'}</span>
                    </button>
                  </div>
                )}

                {accessState.passcodeHash && (
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={handleClearMasterPasscode}
                      className="text-[11px] text-slate-400 hover:text-rose-400 transition-colors"
                    >
                      إلغاء كلمة السر العامة (والاكتفاء بأكواد المستخدمين الفردية)
                    </button>
                  </div>
                )}
              </form>
            </div>
          )}

          {/* TAB 2: INDIVIDUAL NAMED ACCESS KEYS */}
          {activeTab === 'users' && (
            <div className="space-y-3.5">
              <form
                onSubmit={handleCreatePersonalKey}
                className="rounded-xl bg-[#111827] border border-slate-800 p-3.5 space-y-3"
              >
                <div className="space-y-0.5">
                  <div className="text-xs sm:text-sm font-bold text-slate-100">
                    إنشاء رمز دخول خاص لشخص محدد
                  </div>
                  <p className="text-[11px] text-slate-400">
                    أعطِ كل مهندس أو مستخدم رمزاً خاصاً به وتاريخ انتهاء اختياري — ويمكنك إيقافه وحده فوراً دون التأثير على الباقين.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                  <div className="sm:col-span-5">
                    <input
                      type="text"
                      maxLength={MAX_KEY_LABEL_LENGTH}
                      value={newKeyLabel}
                      onChange={(e) => setNewKeyLabel(e.target.value)}
                      placeholder="اسم الشخص أو الموقع (مثلاً: م. أحمد)"
                      className="w-full min-h-[42px] rounded-xl bg-[#0b0f19] border border-slate-700/80 px-3 text-xs sm:text-sm text-slate-100 placeholder:text-slate-600 focus:border-emerald-400/70 outline-none"
                    />
                  </div>

                  <div className="sm:col-span-4 flex items-center gap-1.5">
                    <input
                      type="text"
                      value={newKeyCode}
                      onChange={(e) => setNewKeyCode(e.target.value)}
                      placeholder="رمز الدخول"
                      dir="ltr"
                      className="font-num flex-1 min-w-0 min-h-[42px] rounded-xl bg-[#0b0f19] border border-slate-700/80 px-3 text-xs sm:text-sm text-emerald-300 focus:border-emerald-400/70 outline-none text-left"
                    />
                    <button
                      type="button"
                      onClick={() => setNewKeyCode(generateReadableAccessCode())}
                      title="توليد رمز عشوائي"
                      className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-[#0b0f19] text-slate-300 hover:border-cyan-400/60 hover:text-cyan-300"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="sm:col-span-3">
                    <input
                      type="date"
                      value={newKeyExpiry}
                      onChange={(e) => setNewKeyExpiry(e.target.value)}
                      title="تاريخ انتهاء الصلاحية (اختياري)"
                      className="font-num w-full min-h-[42px] rounded-xl bg-[#0b0f19] border border-slate-700/80 px-2.5 text-xs text-slate-200 focus:border-emerald-400/70 outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-500">
                    تاريخ الانتهاء اختياري — اتركه فارغاً للصلاحية الدائمة حتى توقفه يدوياً
                  </span>
                  <button
                    type="submit"
                    disabled={busy || !newKeyLabel.trim() || newKeyCode.trim().length < 4}
                    className="inline-flex items-center gap-1.5 min-h-[40px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition-colors whitespace-nowrap disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" />
                    <span>إضافة رمز دخول</span>
                  </button>
                </div>

                {lastCreatedKey && (
                  <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/40 p-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs text-emerald-100 space-y-0.5">
                      <div>
                        تم إنشاء رمز <strong>{lastCreatedKey.label}</strong> (احفظه الآن لأنه يُشفَّر ولا يُعرض مجدداً):
                      </div>
                      <div className="font-num text-sm font-bold text-emerald-300 select-all" dir="ltr">
                        {lastCreatedKey.code}
                        {lastCreatedKey.expiresAt ? `  (حتى ${lastCreatedKey.expiresAt})` : ''}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        copyText(
                          `رمز الدخول الخاص بك لتطبيق حصر الكميات:\n${lastCreatedKey.code}${
                            lastCreatedKey.expiresAt
                              ? `\nصالح حتى: ${lastCreatedKey.expiresAt}`
                              : ''
                          }`,
                          'personal'
                        )
                      }
                      className="inline-flex items-center gap-1.5 min-h-[38px] px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white"
                    >
                      {copiedPersonal ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      <span>{copiedPersonal ? 'تم النسخ' : 'نسخ لإرساله'}</span>
                    </button>
                  </div>
                )}
              </form>

              {/* List of Created Personal Keys */}
              <div className="space-y-2">
                {personalKeys.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-800 py-6 px-4 text-center text-xs text-slate-400">
                    لا توجد أكواد فردية بعد — يمكنك إضافة أشخاص محددين من النموذج أعلاه للتحكم بكل شخص بشكل مستقل.
                  </div>
                ) : (
                  personalKeys.map((k) => {
                    const expired = isDateExpired(k.expiresAt);
                    return (
                      <div
                        key={k.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#111827] border border-slate-800 px-3.5 py-2.5"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <UserCheck
                            className={`h-4 w-4 shrink-0 ${
                              k.active && !expired ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          />
                          <div className="min-w-0">
                            <div className="text-xs sm:text-sm font-bold text-slate-100 truncate">
                              {k.label}
                            </div>
                            <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-x-2">
                              <span
                                className={
                                  !k.active
                                    ? 'text-rose-400 font-semibold'
                                    : expired
                                    ? 'text-amber-400 font-semibold'
                                    : 'text-emerald-400 font-semibold'
                                }
                              >
                                {!k.active ? 'موقوف' : expired ? 'منتهي الصلاحية' : 'مفعّل'}
                              </span>
                              {k.expiresAt && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="font-num">ينتهي: {k.expiresAt}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleTogglePersonalKey(k)}
                            className={`min-h-[36px] px-3 rounded-lg text-xs font-bold transition-colors whitespace-nowrap disabled:opacity-50 ${
                              k.active
                                ? 'bg-amber-500/15 border border-amber-500/35 text-amber-300 hover:bg-amber-500/25'
                                : 'bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 hover:bg-emerald-500/25'
                            }`}
                          >
                            {k.active ? 'إيقاف الدخول' : 'تفعيل'}
                          </button>

                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleDeletePersonalKey(k)}
                            title="حذف نهائي"
                            className="flex h-[36px] w-[36px] items-center justify-center rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 disabled:opacity-50"
                            aria-label="حذف"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 3: INTELLECTUAL PROPERTY / COPYRIGHT SIGNATURE */}
          {activeTab === 'copyright' && (
            <div className="rounded-xl bg-[#111827] border border-slate-800 p-3.5 space-y-3">
              <div className="space-y-0.5">
                <div className="text-xs sm:text-sm font-bold text-slate-100">
                  حقوق الملكية الفكرية وبصمة المبرمج
                </div>
                <p className="text-[11px] text-slate-400">
                  يظهر هذا النص تلقائياً في الشريط العلوي لكل الشاشات الرئيسية، شاشة القفل، تذييل التطبيق، وخصائص وتذييل كل ملف Excel يتم تصديره (ولا يمكن لغيرك تعديله).
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  maxLength={MAX_SIGNATURE_LENGTH}
                  value={draftSignature}
                  onChange={(e) => setDraftSignature(e.target.value)}
                  placeholder="© م. محمد عواد — جميع الحقوق محفوظة"
                  className="flex-1 min-h-[42px] rounded-xl bg-[#0b0f19] border border-slate-700/80 px-3.5 text-sm text-slate-100 focus:border-cyan-400/70 outline-none"
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleSaveSignature}
                  className="min-h-[42px] px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-xs font-bold text-white transition-colors whitespace-nowrap disabled:opacity-50"
                >
                  حفظ حقوق الملكية
                </button>
              </div>

              <div className="text-[11px] text-slate-500">
                المعاينة الحالية:{' '}
                <span className="text-slate-300 font-semibold">{draftSignature}</span>
              </div>
            </div>
          )}

          {/* TAB 4: PAUSE MESSAGE & FORCE LOCK SESSIONS */}
          {activeTab === 'general' && (
            <div className="space-y-3">
              <div className="rounded-xl bg-[#111827] border border-slate-800 p-3.5 space-y-2.5">
                <label className="text-xs font-bold text-slate-200">
                  الرسالة التي تظهر للمستخدمين عند إيقاف التطبيق ({draftMessage.length}/
                  {MAX_PAUSE_MESSAGE_LENGTH})
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    maxLength={MAX_PAUSE_MESSAGE_LENGTH}
                    value={draftMessage}
                    onChange={(e) => setDraftMessage(e.target.value)}
                    className="flex-1 min-h-[42px] rounded-xl bg-[#0b0f19] border border-slate-700/80 px-3.5 text-sm text-slate-100 focus:border-cyan-400/70 outline-none"
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleSaveMessage}
                    className="min-h-[42px] px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-xs font-bold text-white transition-colors whitespace-nowrap disabled:opacity-50"
                  >
                    حفظ الرسالة
                  </button>
                </div>
              </div>

              <div className="rounded-xl bg-[#111827] border border-amber-500/30 p-3.5 flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-amber-300">
                    إغلاق جميع الجلسات المفتوحة فوراً (إصدار الجلسة #{accessState.passcodeVersion})
                  </div>
                  <p className="text-[11px] text-slate-400">
                    يُعيد قفل شاشة كل مستخدم متصل حالياً ويُجبره على إدخال كلمة السر مجدداً.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleForceLockAllSessions}
                  className="min-h-[40px] px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-xs font-bold text-white transition-colors whitespace-nowrap disabled:opacity-50"
                >
                  قفل جميع الأجهزة الآن
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

interface OwnerLoginModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const OwnerLoginModal: React.FC<OwnerLoginModalProps> = ({
  open,
  onClose,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    const res = await signInOwnerWithGoogle();
    setLoading(false);
    if (res.ok) {
      onSuccess();
      onClose();
    } else {
      setError(res.error || 'تعذر التحقق من صلاحية المالك.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-sm rounded-2xl bg-[#111827] border border-slate-700/80 p-6 shadow-2xl space-y-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/35 text-emerald-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">بوابة تحكم المالك</h3>
              <p className="text-xs text-slate-400">
                مراقبة الأجهزة المتصلة، حظرها، وتعديل كلمة السر وحقوق الملكية
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-100"
            aria-label="إغلاق"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-xs leading-relaxed text-slate-300">
          يتم التحقق عبر حساب Google الخاص بمالك التطبيق فقط. بعد تسجيل الدخول ستظهر لوحة
          التحكم الكاملة على جهازك فقط ولن تظهر لأي شخص آخر.
        </p>

        {error && (
          <div className="rounded-xl bg-rose-500/10 border border-rose-500/35 px-3.5 py-2.5 text-xs text-rose-300">
            {error}
          </div>
        )}

        <button
          type="button"
          disabled={loading}
          onClick={handleLogin}
          className="w-full min-h-[46px] rounded-xl bg-emerald-600 hover:bg-emerald-500 text-sm font-bold text-white transition-colors disabled:opacity-50"
        >
          {loading ? 'جارٍ التحقق من الحساب...' : 'تسجيل الدخول بحساب Google للمالك'}
        </button>
      </div>
    </div>
  );
};

interface AppPasscodeGateProps {
  accessState: AppAccessState;
  revokedNotice?: string | null;
  onUnlocked: (result: PasscodeVerificationResult) => void;
  onOpenOwnerLogin: () => void;
}

export const AppPasscodeGate: React.FC<AppPasscodeGateProps> = ({
  accessState,
  revokedNotice,
  onUnlocked,
  onOpenOwnerLogin,
}) => {
  const [code, setCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(revokedNotice || null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [cooldownUntil, setCooldownUntil] = useState<number>(0);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (revokedNotice) setError(revokedNotice);
  }, [revokedNotice]);

  useEffect(() => {
    if (cooldownUntil <= Date.now()) {
      setSecondsLeft(0);
      return;
    }
    const timer = window.setInterval(() => {
      const diff = Math.ceil((cooldownUntil - Date.now()) / 1000);
      if (diff <= 0) {
        setSecondsLeft(0);
        setCooldownUntil(0);
      } else {
        setSecondsLeft(diff);
      }
    }, 500);
    return () => window.clearInterval(timer);
  }, [cooldownUntil]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cooldownUntil > Date.now() || checking) return;
    if (!code.trim()) {
      setError('أدخل كلمة السر أو رمز الدخول أولاً.');
      return;
    }

    setChecking(true);
    setError(null);
    try {
      const res = await verifyAccessPasscode(code, accessState);
      if (res.ok) {
        setFailedAttempts(0);
        setCode('');
        onUnlocked(res);
      } else {
        const nextFails = failedAttempts + 1;
        setFailedAttempts(nextFails);
        if (nextFails >= 5) {
          setCooldownUntil(Date.now() + 30_000);
          setSecondsLeft(30);
          setFailedAttempts(0);
          setError('تم إدخال رمز خاطئ عدة مرات — يُرجى الانتظار 30 ثانية قبل المحاولة مجدداً.');
        } else {
          setError(res.error || 'كلمة السر أو رمز الدخول غير صحيح.');
        }
      }
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md rounded-2xl bg-[#111827] border border-slate-800 p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="text-center space-y-3">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 shadow-[0_0_24px_-8px_rgba(16,185,129,0.55)]">
            <Lock className="h-7 w-7" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-slate-100">حصر الكميات الهندسي — BOQ</h1>
            <p className="text-xs font-semibold text-cyan-400">{accessState.ownerSignature}</p>
          </div>
          <p className="text-xs leading-relaxed text-slate-400">
            هذا التطبيق محمي بحقوق الملكية وكلمة السر. أدخل كلمة السر أو رمز الدخول الخاص بك
            للمتابعة (يعمل حتى بدون اتصال بالإنترنت).
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              كلمة السر أو رمز الدخول الخاص
            </label>
            <div className="relative">
              <input
                type={showCode ? 'text' : 'password'}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={checking || secondsLeft > 0}
                autoFocus
                placeholder="أدخل كلمة السر..."
                dir="ltr"
                className="font-num w-full min-h-[48px] rounded-xl bg-[#0b0f19] border border-slate-700/80 pl-11 pr-4 text-base text-slate-100 placeholder:text-slate-600 focus:border-emerald-400/70 outline-none text-left disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowCode((v) => !v)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                aria-label="إظهار أو إخفاء الرمز"
              >
                {showCode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-xl bg-rose-500/10 border border-rose-500/35 px-3.5 py-2.5 text-xs text-rose-300 leading-relaxed">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={checking || secondsLeft > 0 || !code.trim()}
            className="w-full min-h-[48px] rounded-xl bg-emerald-600 hover:bg-emerald-500 text-sm font-bold text-white shadow-[0_0_20px_-6px_rgba(16,185,129,0.7)] transition-colors disabled:opacity-50"
          >
            {checking
              ? 'جارٍ التحقق...'
              : secondsLeft > 0
              ? `انتظر ${secondsLeft} ثانية...`
              : 'فتح التطبيق'}
          </button>
        </form>

        <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between gap-2 text-[11px] text-slate-500">
          <span>حماية أونلاين وأوفلاين</span>
          <button
            type="button"
            onClick={onOpenOwnerLogin}
            className="inline-flex items-center gap-1 font-semibold text-slate-400 hover:text-emerald-300 transition-colors"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>دخول المالك</span>
          </button>
        </div>
      </div>
    </div>
  );
};

interface DeviceBlockedScreenProps {
  ownerSignature: string;
  onOpenOwnerLogin: () => void;
}

export const DeviceBlockedScreen: React.FC<DeviceBlockedScreenProps> = ({
  ownerSignature,
  onOpenOwnerLogin,
}) => {
  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl bg-[#111827] border border-rose-500/40 p-8 text-center space-y-4 shadow-2xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/15 border border-rose-500/45 text-rose-400">
          <Ban className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-bold text-slate-100">تم حظر هذا الجهاز من الوصول</h1>
        <p className="text-sm leading-relaxed text-slate-300">
          تم إيقاف وحظر صلاحية هذا الجهاز من قِبل مالك التطبيق. لا يمكن فتح التطبيق على هذا الجهاز
          حتى يتم فك الحظر من قِبل المالك.
        </p>
        <div className="pt-4 border-t border-slate-800/80 space-y-2">
          <p className="text-xs font-semibold text-cyan-400">{ownerSignature}</p>
          <button
            type="button"
            onClick={onOpenOwnerLogin}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-emerald-300 transition-colors"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>دخول المالك</span>
          </button>
        </div>
      </div>
    </div>
  );
};

interface AppPausedScreenProps {
  message: string;
  ownerSignature: string;
  onSecretOwnerTrigger: () => void;
}

export const AppPausedScreen: React.FC<AppPausedScreenProps> = ({
  message,
  ownerSignature,
  onSecretOwnerTrigger,
}) => {
  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl bg-[#111827] border border-slate-800 p-8 text-center space-y-4 shadow-2xl">
        <button
          type="button"
          onClick={onSecretOwnerTrigger}
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-400 cursor-default focus:outline-none"
          aria-label="حالة التطبيق"
        >
          <Lock className="h-7 w-7" />
        </button>
        <h1 className="text-xl font-bold text-slate-100">التطبيق متوقف مؤقتاً</h1>
        <p className="text-sm leading-relaxed text-slate-300">{message}</p>
        <div className="pt-4 border-t border-slate-800/80 text-xs font-semibold text-cyan-400">
          {ownerSignature}
        </div>
      </div>
    </div>
  );
};
