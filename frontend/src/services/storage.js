// src/services/storage.js
const STORAGE_KEY = 'nestjs-erd-state';

export const storageService = {
  saveState(state) {
    try {
      const serializedState = JSON.stringify(state);
      localStorage.setItem(STORAGE_KEY, serializedState);
    } catch (err) {
      console.error('Could not save state:', err);
    }
  },

  loadState() {
    try {
      const serializedState = localStorage.getItem(STORAGE_KEY);
      if (serializedState === null) {
        return undefined;
      }
      return JSON.parse(serializedState);
    } catch (err) {
      console.error('Could not load state:', err);
      return undefined;
    }
  },

  clearState() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.error('Could not clear state:', err);
    }
  }
};