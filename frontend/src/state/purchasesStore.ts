import { create } from 'zustand';
import Purchases, {
  CustomerInfo,
  CustomerInfoUpdateListener,
  PurchasesPackage,
} from 'react-native-purchases';
import { Platform } from 'react-native';

const RC_API_KEY = process.env.EXPO_PUBLIC_RC_KEY || '';

// Logger que solo emite en desarrollo: evita filtrar detalles de errores de
// RevenueCat (stack traces, respuestas del SDK) en la consola de builds de producción.
function logDev(...args: unknown[]): void {
  if (__DEV__) {
    console.error(...args);
  }
}

let customerInfoListener: CustomerInfoUpdateListener | null = null;

interface PurchasesState {
  isConfigured: boolean;
  isPremium: boolean;
  isFamilia: boolean;
  packages: PurchasesPackage[];
  customerInfo: CustomerInfo | null;
  configure: () => Promise<void>;
  logIn: (appUserId: string) => Promise<void>;
  logOut: () => Promise<void>;
  checkEntitlements: (info?: CustomerInfo) => Promise<void>;
  loadPackages: () => Promise<void>;
  purchasePackage: (pack: PurchasesPackage) => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
}

function _computeTiers(info: CustomerInfo): { isPremium: boolean; isFamilia: boolean } {
  const active = info.entitlements.active;
  const isFamilia = active['familia'] !== undefined;
  const isPremium = isFamilia || active['premium'] !== undefined;
  return { isPremium, isFamilia };
}

export const usePurchasesStore = create<PurchasesState>((set, get) => ({
  isConfigured: false,
  isPremium: false,
  isFamilia: false,
  packages: [],
  customerInfo: null,

  configure: async () => {
    if (!RC_API_KEY) {
      logDev('Falta EXPO_PUBLIC_RC_KEY. RevenueCat no se inicializará.');
      return;
    }
    if (get().isConfigured) return;

    try {
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        Purchases.configure({ apiKey: RC_API_KEY });

        if (customerInfoListener) {
          Purchases.removeCustomerInfoUpdateListener(customerInfoListener);
        }
        customerInfoListener = (info) => {
          get().checkEntitlements(info);
        };
        Purchases.addCustomerInfoUpdateListener(customerInfoListener);

        await get().checkEntitlements();

        set({ isConfigured: true });
      }
    } catch (error) {
      logDev('Error configurando RevenueCat:', error);
    }
  },

  logIn: async (appUserId: string) => {
    if (!get().isConfigured) return;
    try {
      const { customerInfo } = await Purchases.logIn(appUserId);
      await get().checkEntitlements(customerInfo);
    } catch (error) {
      logDev('Error haciendo logIn en RevenueCat:', error);
    }
  },

  logOut: async () => {
    if (!get().isConfigured) return;
    try {
      const customerInfo = await Purchases.logOut();
      await get().checkEntitlements(customerInfo);
    } catch (error) {
      logDev('Error haciendo logOut en RevenueCat:', error);
    }
  },

  checkEntitlements: async (info?: CustomerInfo) => {
    try {
      const currentInfo = info || (await Purchases.getCustomerInfo());
      const { isPremium, isFamilia } = _computeTiers(currentInfo);
      set({ customerInfo: currentInfo, isPremium, isFamilia });
    } catch (error) {
      logDev('Error chequeando entitlements:', error);
    }
  },

  loadPackages: async () => {
    if (!get().isConfigured) return;
    try {
      const offerings = await Purchases.getOfferings();
      if (offerings.current && offerings.current.availablePackages.length !== 0) {
        set({ packages: offerings.current.availablePackages });
      }
    } catch (error) {
      logDev('Error cargando packages:', error);
    }
  },

  purchasePackage: async (pack: PurchasesPackage) => {
    try {
      const { customerInfo } = await Purchases.purchasePackage(pack);
      const { isPremium, isFamilia } = _computeTiers(customerInfo);
      set({ customerInfo, isPremium, isFamilia });
      return isPremium;
    } catch (error: any) {
      if (!error.userCancelled) {
        logDev('Error comprando paquete:', error);
      }
      return false;
    }
  },

  restorePurchases: async () => {
    try {
      const customerInfo = await Purchases.restorePurchases();
      const { isPremium, isFamilia } = _computeTiers(customerInfo);
      set({ customerInfo, isPremium, isFamilia });
      return isPremium;
    } catch (error) {
      logDev('Error restaurando compras:', error);
      return false;
    }
  },
}));
