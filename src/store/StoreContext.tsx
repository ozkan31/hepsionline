import React, { createContext, useContext, useReducer, useEffect, useRef, useState } from 'react';
import type { Product, CartItem, Order, User, Address } from '@/types';
import { fetchCart, fetchOrders, fetchWishlist, saveCart, saveWishlist } from '@/lib/api';

interface StoreState {
  cart: CartItem[];
  wishlist: Product[];
  user: User | null;
  orders: Order[];
  isAuthenticated: boolean;
}

type StoreAction =
  | { type: 'ADD_TO_CART'; payload: CartItem }
  | { type: 'REMOVE_FROM_CART'; payload: string }
  | { type: 'UPDATE_CART_QUANTITY'; payload: { id: string; quantity: number } }
  | { type: 'CLEAR_CART' }
  | { type: 'ADD_TO_WISHLIST'; payload: Product }
  | { type: 'REMOVE_FROM_WISHLIST'; payload: string }
  | { type: 'SET_WISHLIST'; payload: Product[] }
  | { type: 'SET_ORDERS'; payload: Order[] }
  | { type: 'SET_USER'; payload: User | null }
  | { type: 'ADD_ORDER'; payload: Order }
  | { type: 'ADD_ADDRESS'; payload: Address }
  | { type: 'REMOVE_ADDRESS'; payload: string }
  | { type: 'SET_CART'; payload: CartItem[] }
  | { type: 'LOAD_STATE'; payload: StoreState };

const initialState: StoreState = {
  cart: [],
  wishlist: [],
  user: null,
  orders: [],
  isAuthenticated: false,
};

function sanitizeCartItems(items: unknown): CartItem[] {
  if (!Array.isArray(items)) return [];

  return items
    .filter((item) => {
      if (!item || typeof item !== 'object') return false;
      const cartItem = item as Partial<CartItem>;
      const product = cartItem.product as Product | undefined;
      return Boolean(
        product &&
          typeof product.id === 'string' &&
          product.id.trim() &&
          typeof product.name === 'string' &&
          Number.isFinite(Number(product.price))
      );
    })
    .map((item) => {
      const cartItem = item as CartItem;
      return {
        ...cartItem,
        quantity: Number.isInteger(Number(cartItem.quantity)) && Number(cartItem.quantity) > 0 ? Number(cartItem.quantity) : 1,
      };
    });
}

function mergeCartItems(localItems: CartItem[], serverItems: CartItem[]): CartItem[] {
  const safeLocalItems = sanitizeCartItems(localItems);
  const safeServerItems = sanitizeCartItems(serverItems);
  const merged = new Map<string, CartItem>();
  const toKey = (item: CartItem) => `${item.product.id}::${item.color ?? ''}`;

  for (const item of safeServerItems) {
    merged.set(toKey(item), { ...item });
  }

  for (const item of safeLocalItems) {
    const key = toKey(item);
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, { ...item });
      continue;
    }
    merged.set(key, { ...existing, quantity: existing.quantity + item.quantity });
  }

  return Array.from(merged.values());
}

function storeReducer(state: StoreState, action: StoreAction): StoreState {
  switch (action.type) {
    case 'ADD_TO_CART': {
      const existingItem = state.cart.find(
        item => item.product.id === action.payload.product.id && item.color === action.payload.color
      );
      if (existingItem) {
        return {
          ...state,
          cart: state.cart.map(item =>
            item.product.id === action.payload.product.id && item.color === action.payload.color
              ? { ...item, quantity: item.quantity + action.payload.quantity }
              : item
          ),
        };
      }
      return { ...state, cart: [...state.cart, action.payload] };
    }
    case 'REMOVE_FROM_CART':
      return {
        ...state,
        cart: state.cart.filter(item => item.product.id !== action.payload),
      };
    case 'UPDATE_CART_QUANTITY':
      return {
        ...state,
        cart: state.cart.map(item =>
          item.product.id === action.payload.id
            ? { ...item, quantity: action.payload.quantity }
            : item
        ),
      };
    case 'CLEAR_CART':
      return { ...state, cart: [] };
    case 'ADD_TO_WISHLIST': {
      const exists = state.wishlist.find(item => item.id === action.payload.id);
      if (exists) return state;
      return { ...state, wishlist: [...state.wishlist, action.payload] };
    }
    case 'REMOVE_FROM_WISHLIST':
      return {
        ...state,
        wishlist: state.wishlist.filter(item => item.id !== action.payload),
      };
    case 'SET_WISHLIST':
      return {
        ...state,
        wishlist: action.payload,
      };
    case 'SET_ORDERS':
      return {
        ...state,
        orders: action.payload,
      };
    case 'SET_USER':
      return {
        ...state,
        user: action.payload,
        isAuthenticated: !!action.payload,
      };
    case 'ADD_ORDER':
      return {
        ...state,
        orders: [...state.orders, action.payload],
      };
    case 'ADD_ADDRESS':
      if (!state.user) return state;
      return {
        ...state,
        user: {
          ...state.user,
          addresses: [...state.user.addresses, action.payload],
        },
      };
    case 'REMOVE_ADDRESS':
      if (!state.user) return state;
      return {
        ...state,
        user: {
          ...state.user,
          addresses: state.user.addresses.filter(addr => addr.id !== action.payload),
        },
      };
    case 'SET_CART':
      return {
        ...state,
        cart: sanitizeCartItems(action.payload),
      };
    case 'LOAD_STATE':
      return action.payload;
    default:
      return state;
  }
}

interface StoreContextType {
  state: StoreState;
  dispatch: React.Dispatch<StoreAction>;
  cartTotal: number;
  cartCount: number;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(storeReducer, initialState);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isCartSyncReady, setIsCartSyncReady] = useState(false);
  const [isWishlistSyncReady, setIsWishlistSyncReady] = useState(false);
  const syncUserIdRef = useRef<string | null>(null);
  const shouldMergeLocalCartOnNextAuthSyncRef = useRef(false);

  useEffect(() => {
    const savedState = localStorage.getItem('parisMoveStore');
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        const sanitizedState: StoreState = {
          ...initialState,
          ...parsed,
          cart: sanitizeCartItems(parsed?.cart),
          wishlist: Array.isArray(parsed?.wishlist) ? parsed.wishlist : [],
          orders: Array.isArray(parsed?.orders) ? parsed.orders : [],
          user: parsed?.user ?? null,
          isAuthenticated: Boolean(parsed?.isAuthenticated && parsed?.user),
        };
        shouldMergeLocalCartOnNextAuthSyncRef.current =
          !Boolean(sanitizedState?.isAuthenticated) &&
          Array.isArray(sanitizedState?.cart) &&
          sanitizedState.cart.length > 0;
        dispatch({ type: 'LOAD_STATE', payload: sanitizedState });
      } catch (e) {
        console.error('Failed to load store state:', e);
      }
    }
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    localStorage.setItem('parisMoveStore', JSON.stringify(state));
  }, [state, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    if (!state.isAuthenticated && state.cart.length > 0) {
      // Merge guest cart once right after user logs in.
      shouldMergeLocalCartOnNextAuthSyncRef.current = true;
    }
  }, [state.isAuthenticated, state.cart.length, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    if (!state.isAuthenticated || !state.user) {
      syncUserIdRef.current = null;
      setIsCartSyncReady(false);
      setIsWishlistSyncReady(false);
      return;
    }

    if (syncUserIdRef.current === state.user.id) return;
    syncUserIdRef.current = state.user.id;
    setIsCartSyncReady(false);
    setIsWishlistSyncReady(false);

    let isMounted = true;
    const localCartSnapshot = state.cart;
    const loadUserState = async () => {
      try {
        const [serverCart, serverWishlist, serverOrders] = await Promise.all([
          fetchCart(),
          fetchWishlist(),
          fetchOrders(),
        ]);
        if (!isMounted) return;
        const shouldMergeLocalCart = shouldMergeLocalCartOnNextAuthSyncRef.current;
        const nextCart = shouldMergeLocalCart
          ? mergeCartItems(localCartSnapshot, serverCart)
          : serverCart;
        dispatch({ type: 'SET_CART', payload: nextCart });
        shouldMergeLocalCartOnNextAuthSyncRef.current = false;
        dispatch({ type: 'SET_WISHLIST', payload: serverWishlist });
        dispatch({ type: 'SET_ORDERS', payload: serverOrders });
      } catch (error) {
        console.error('Failed to load user state from server:', error);
      } finally {
        if (isMounted) {
          setIsCartSyncReady(true);
          setIsWishlistSyncReady(true);
        }
      }
    };

    loadUserState();
    return () => {
      isMounted = false;
    };
  }, [state.isAuthenticated, state.user?.id, isHydrated]);

  useEffect(() => {
    if (!isHydrated || !isCartSyncReady) return;
    if (!state.isAuthenticated || !state.user) return;

    const sync = async () => {
      try {
        await saveCart(state.cart);
      } catch (error) {
        console.error('Failed to sync cart to server:', error);
      }
    };

    sync();
  }, [state.cart, state.isAuthenticated, state.user?.id, isHydrated, isCartSyncReady]);

  useEffect(() => {
    if (!isHydrated || !isWishlistSyncReady) return;
    if (!state.isAuthenticated || !state.user) return;

    const sync = async () => {
      try {
        await saveWishlist(state.wishlist);
      } catch (error) {
        console.error('Failed to sync wishlist to server:', error);
      }
    };

    sync();
  }, [state.wishlist, state.isAuthenticated, state.user?.id, isHydrated, isWishlistSyncReady]);

  const cartTotal = sanitizeCartItems(state.cart).reduce(
    (total, item) => total + item.product.price * item.quantity,
    0
  );

  const cartCount = state.cart.reduce((count, item) => count + item.quantity, 0);

  return (
    <StoreContext.Provider value={{ state, dispatch, cartTotal, cartCount }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (context === undefined) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
}
