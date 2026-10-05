'use client';

export type OverlayId =
  | 'none'
  | 'plus-menu'
  | 'assistant-picker'
  | 'task-composer'
  | 'connector-panel'
  | 'history-drawer';

type OverlayListener = (activeOverlay: OverlayId) => void;

class OverlayManager {
  private activeOverlay: OverlayId = 'none';
  private listeners: Set<OverlayListener> = new Set();

  public getActive(): OverlayId {
    return this.activeOverlay;
  }

  public open(id: OverlayId) {
    if (this.activeOverlay !== id) {
      this.activeOverlay = id;
      this.notify();
    }
  }

  public close(id?: OverlayId) {
    if (!id || this.activeOverlay === id) {
      this.activeOverlay = 'none';
      this.notify();
    }
  }

  public toggle(id: OverlayId) {
    if (this.activeOverlay === id) {
      this.close(id);
    } else {
      this.open(id);
    }
  }

  public subscribe(listener: OverlayListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    for (const listener of this.listeners) {
      listener(this.activeOverlay);
    }
  }
}

class ServerOverlayManager {
  getActive(): OverlayId {
    return 'none';
  }
  open() {}
  close() {}
  toggle() {}
  subscribe() {
    return () => {};
  }
}

export const overlayManager =
  typeof window !== 'undefined' ? new OverlayManager() : new ServerOverlayManager();
