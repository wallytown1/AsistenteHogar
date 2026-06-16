import { create } from 'zustand';
import Purchases, {
  CustomerInfo,
  CustomerInfoUpdateListener,
  PurchasesPackage,
} from 'react-native-purchases';
import { Platform } from 'react-native';

const RC_API_KEY = process.env.EXPO_PUBLIC_RC_KEY || '';

// Referencia al listener activo para poder desuscribirlo y evitar duplicados
// (fuga de memoria si `configure` se reejecutara o en hot-reload de desarrollo).
let customerInfoListener: CustomerInfoUpdateListener | null = null;

interface PurchasesState {
  isConfigured: boolean;
  isPremium: boolean;
  packages: PurchasesPackage[];
  customerInfo: CustomerInfo | null;
  configure: () => Promise<void>;
  logIn: (appUserId: string) => Promise<void>;
  logOut: () => Promise<void>;
  checkPremium: (info?: CustomerInfo) => Promise<void>;
  loadPackages: () => Promise<void>;
  purchasePackage: (pack: PurchasesPackage) => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
}

export const usePurchasesStore = create<PurchasesState>((set, get) => ({
  isConfigured: false,
  isPremium: false,
  packages: [],
  customerInfo: null,

  configure: async () => {
    if (!RC_API_KEY) {
      console.warn('Falta EXPO_PUBLIC_RC_KEY. RevenueCat no se inicializará.');
      return;
    }
    if (get().isConfigured) return;

    try {
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        Purchases.configure({ apiKey: RC_API_KEY });
        set({ isConfigured: true });

        // Listener de actualización (cuando la suscripción cambia en background).
        // Quitamos cualquier listener previo antes de registrar el nuevo para no
        // acumular suscripciones duplicadas.
        if (customerInfoListener) {
          Purchases.removeCustomerInfoUpdateListener(customerInfoListener);
        }
        customerInfoListener = (info) => {
          get().checkPremium(info);
        };
        Purchases.addCustomerInfoUpdateListener(customerInfoListener);

        // Verificación inicial
        await get().checkPremium();
      }
    } catch (error) {
      console.error('Error configurando RevenueCat:', error);
    }
  },

  logIn: async (appUserId: string) => {
    if (!get().isConfigured) return;
    try {
      const { customerInfo } = await Purchases.logIn(appUserId);
      await get().checkPremium(customerInfo);
    } catch (error) {
      console.error('Error haciendo logIn en RevenueCat:', error);
    }
  },

  logOut: async () => {
    if (!get().isConfigured) return;
    try {
      const customerInfo = await Purchases.logOut();
      await get().checkPremium(customerInfo);
    } catch (error) {
      console.error('Error haciendo logOut en RevenueCat:', error);
    }
  },

  checkPremium: async (info?: CustomerInfo) => {
    try {
      const currentInfo = info || (await Purchases.getCustomerInfo());
      // Verificamos si existe el entitlement "premium" y está activo
      const isPremium = currentInfo?.entitlements.active['premium'] !== undefined;
      set({ customerInfo: currentInfo, isPremium });
    } catch (error) {
      console.error('Error chequeando status premium:', error);
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
      console.error('Error cargando packages:', error);
    }
  },

  purchasePackage: async (pack: PurchasesPackage) => {
    try {
      const { customerInfo } = await Purchases.purchasePackage(pack);
      const isPremium = customerInfo.entitlements.active['premium'] !== undefined;
      set({ customerInfo, isPremium });
      return isPremium;
    } catch (error: any) {
      if (!error.userCancelled) {
        console.error('Error comprando paquete:', error);
      }
      return false;
    }
  },

  restorePurchases: async () => {
    try {
      const customerInfo = await Purchases.restorePurchases();
      const isPremium = customerInfo.entitlements.active['premium'] !== undefined;
      set({ customerInfo, isPremium });
      return isPremium;
    } catch (error) {
      console.error('Error restaurando compras:', error);
      return false;
    }
  },
}));
