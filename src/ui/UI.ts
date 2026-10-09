export interface LocationResult {
  name: string;
  lat: number;
  lon: number;
  fullName: string;
}

export class UI {
  onTeleport?: (loc: LocationResult) => void;
  onSearch?: (q: string) => void;

  private overlay: HTMLElement;
  private views: Record<string, HTMLElement> = {};
  private selected: LocationResult | null = null;
  private searchTimer: number | null = null;

  constructor() {
    this.overlay = document.getElementById('overlay')!;
    this.views.viewMenu = document.getElementById('viewMenu')!;
    this.views.viewSearch = document.getElementById('viewSearch')!;
    this.views.viewConfirm = document.getElementById('viewConfirm')!;
    this.views.loading = document.getElementById('loading')!;

    this.wire();
  }

  private wire(): void {
    // Menü
    this.views.viewMenu.querySelectorAll('.mode').forEach((btn) => {
      btn.addEventListener('click', () => {
        const act = (btn as HTMLElement).dataset.act;
        if (act === 'free') this.onTeleport?.({
          name: 'Varsayılan', lat: 41.1053, lon: 28.5500, fullName: 'Varsayılan'
        });
        else if (act === 'search') this.showView('viewSearch');
      });
    });

    document.getElementById('backMenu')!.addEventListener('click', () => this.showView('viewMenu'));
    document.getElementById('backSearch')!.addEventListener('click', () => this.showView('viewSearch'));

    const input = document.getElementById('searchInput') as HTMLInputElement;
    input.addEventListener('input', () => {
      if (this.searchTimer) clearTimeout(this.searchTimer);
      const q = input.value.trim();
      if (q.length >= 3) {
        this.searchTimer = window.setTimeout(() => this.onSearch?.(q), 700);
      }
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.onSearch?.(input.value.trim());
    });
    document.getElementById('searchBtn')!.addEventListener('click', () => {
      this.onSearch?.(input.value.trim());
    });

    document.getElementById('teleportBtn')!.addEventListener('click', () => {
      if (this.selected) this.onTeleport?.(this.selected);
    });

    // Müzik paneli
    document.getElementById('musicClose')?.addEventListener('click', () => {
      document.getElementById('musicPanel')?.classList.add('hidden');
    });
  }

  open(): void {
    this.overlay.classList.remove('hidden');
    this.showView('viewMenu');
  }

  close(): void {
    this.overlay.classList.add('hidden');
  }

  showView(id: string): void {
    for (const k of Object.keys(this.views)) {
      this.views[k].classList.toggle('hidden', k !== id);
    }
  }

  showLoading(text: string): void {
    document.getElementById('loadingText')!.textContent = text;
    this.showView('loading');
  }

  renderResults(items: LocationResult[]): void {
    const box = document.getElementById('searchResults')!;
    if (!items.length) {
      box.innerHTML = '<div style="color:#4aa8c8;font-size:12px;padding:10px">Sonuç bulunamadı.</div>';
      return;
    }
    box.innerHTML = '';
    for (const it of items) {
      const div = document.createElement('div');
      div.className = 'result';
      div.innerHTML = `${this.esc(it.fullName)}<small>${it.lat.toFixed(4)}, ${it.lon.toFixed(4)}</small>`;
      div.addEventListener('click', () => {
        this.selected = it;
        document.getElementById('locName')!.textContent = it.name;
        document.getElementById('locCoords')!.textContent =
          `${it.lat.toFixed(4)}°, ${it.lon.toFixed(4)}°`;
        this.showView('viewConfirm');
      });
      box.appendChild(div);
    }
  }

  private esc(s: string): string {
    return s.replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]!));
  }

  toggleMusicPanel(): void {
    document.getElementById('musicPanel')?.classList.toggle('hidden');
  }

  setMusicName(name: string): void {
    document.getElementById('musicName')!.textContent = name;
  }

  setMusicPlayIcon(playing: boolean): void {
    document.getElementById('musicPlay')!.textContent = playing ? '⏸' : '▶';
  }
}
