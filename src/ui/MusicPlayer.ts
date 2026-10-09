export class MusicPlayer {
  private audio = new Audio();
  private playlist: { name: string; url: string }[] = [];
  private index = -1;
  onUpdate?: () => void;

  constructor() {
    this.audio.volume = 0.5;
    this.audio.addEventListener('ended', () => this.next());
    this.audio.addEventListener('play', () => this.onUpdate?.());
    this.audio.addEventListener('pause', () => this.onUpdate?.());

    document.getElementById('musicPlay')?.addEventListener('click', () => this.toggle());
    document.getElementById('musicNext')?.addEventListener('click', () => this.next());
    document.getElementById('musicPrev')?.addEventListener('click', () => this.prev());
    document.getElementById('musicVol')?.addEventListener('input', (e) => {
      this.audio.volume = parseFloat((e.target as HTMLInputElement).value);
    });
    document.getElementById('musicUpload')?.addEventListener('click', () => {
      (document.getElementById('musicFile') as HTMLInputElement).click();
    });
    document.getElementById('musicFile')?.addEventListener('change', (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files) this.loadFiles(files);
    });
  }

  private loadFiles(files: FileList): void {
    const urls = [];
    for (const f of Array.from(files)) {
      if (!f.type.startsWith('audio/')) continue;
      urls.push({ name: f.name, url: URL.createObjectURL(f) });
    }
    if (!urls.length) return;
    this.playlist.push(...urls);
    if (this.index === -1) this.play(this.playlist.length - urls.length);
    this.onUpdate?.();
  }

  play(i: number): void {
    if (i < 0 || i >= this.playlist.length) return;
    this.index = i;
    this.audio.src = this.playlist[i].url;
    this.audio.play().catch(() => {});
  }

  toggle(): void {
    if (this.index < 0) return;
    if (this.audio.paused) this.audio.play().catch(() => {});
    else this.audio.pause();
  }

  next(): void {
    if (this.index < 0) return;
    this.play((this.index + 1) % this.playlist.length);
  }

  prev(): void {
    if (this.index < 0) return;
    this.play((this.index - 1 + this.playlist.length) % this.playlist.length);
  }

  get playing(): boolean {
    return !this.audio.paused && this.index >= 0;
  }

  get currentName(): string {
    return this.index >= 0 ? this.playlist[this.index].name : '— Parça yok —';
  }
}
