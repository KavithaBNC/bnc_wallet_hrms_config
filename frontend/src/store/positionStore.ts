import { create } from 'zustand';
import positionService, { Position } from '../services/position.service';

interface PositionStore {
  positions: Position[];
  currentPosition: Position | null;
  loading: boolean;
  error: string | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };

  // Actions
  fetchPositions: (params?: any) => Promise<void>;
  fetchPositionById: (id: string) => Promise<void>;
  createPosition: (data: any) => Promise<Position>;
  updatePosition: (id: string, data: any) => Promise<Position>;
  deletePosition: (id: string) => Promise<void>;
  setCurrentPosition: (position: Position | null) => void;
  clearError: () => void;
}

export const usePositionStore = create<PositionStore>((set) => ({
  positions: [],
  currentPosition: null,
  loading: false,
  error: null,
  pagination: {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  },

  fetchPositions: async (params?: any) => {
    set({ loading: true, error: null });
    try {
      const response = await positionService.getAll(params);
      console.log('Positions API Response:', response);
      // Handle both response formats
      const positions = response.positions || [];
      const pagination = response.pagination || {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
      };
      set({
        positions,
        pagination,
        loading: false,
      });
    } catch (error: any) {
      console.error('Error fetching positions:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to fetch positions';
      set({ error: errorMessage, loading: false, positions: [] });
    }
  },

  fetchPositionById: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const position = await positionService.getById(id);
      set({ currentPosition: position, loading: false });
    } catch (error: any) {
      set({ error: error.message || 'Failed to fetch position', loading: false });
    }
  },

  createPosition: async (data: any) => {
    set({ loading: true, error: null });
    try {
      const position = await positionService.create(data);
      set((state) => ({
        positions: [...state.positions, position],
        loading: false,
      }));
      return position;
    } catch (error: any) {
      set({ error: error.message || 'Failed to create position', loading: false });
      throw error;
    }
  },

  updatePosition: async (id: string, data: any) => {
    set({ loading: true, error: null });
    try {
      const position = await positionService.update(id, data);
      set((state) => ({
        positions: state.positions.map((p) => (p.id === id ? position : p)),
        currentPosition: state.currentPosition?.id === id ? position : state.currentPosition,
        loading: false,
      }));
      return position;
    } catch (error: any) {
      set({ error: error.message || 'Failed to update position', loading: false });
      throw error;
    }
  },

  deletePosition: async (id: string) => {
    set({ loading: true, error: null });
    try {
      await positionService.delete(id);
      set((state) => ({
        positions: state.positions.filter((p) => p.id !== id),
        loading: false,
      }));
    } catch (error: any) {
      set({ error: error.message || 'Failed to delete position', loading: false });
      throw error;
    }
  },

  setCurrentPosition: (position: Position | null) => {
    set({ currentPosition: position });
  },

  clearError: () => {
    set({ error: null });
  },
}));
