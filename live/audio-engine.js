import { AMBIENTS } from './presets.js';
const AMBIENT_BASE_GAIN = .12;
function silentAudio() {
  const data = new Uint8Array(844), view = new DataView(data.buffer);
  for (const [offset, value] of [[0, 'RIFF'], [8, 'WAVEfmt '], [36, 'data']]) for (let i = 0; i < value.length; i++) data[offset + i] = value.charCodeAt(i);
  view.setUint32(4, 836, true); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, 8000, true); view.setUint32(28, 16000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); view.setUint32(40, 800, true);
  return 'data:audio/wav;base64,' + btoa(String.fromCharCode(...data));
}
export class CafeAudio {
  constructor(send, blocked, preview = false) {
    this.send = send; this.blocked = blocked; this.preview = preview; this.owner = false;
    this.track = new Audio(); this.voice = new Audio(); this.settings = {}; this.radio = {}; this.active = null;
    this.track.id = 'trackAudio'; this.voice.id = 'voiceAudio'; this.track.hidden = this.voice.hidden = true; document.body.append(this.track, this.voice);
    this.speech = []; this.speaking = false; this.speechVersion = 0; this.appliedSeek = -1;
  }
  async enable() {
    if (this.preview) return;
    try {
      // Both HTML audio players must be unlocked inside the actual click, before any await.
      // Resuming Web Audio alone does not unlock voice playback in stricter browsers.
      this.context ||= new AudioContext();
      this.context.onstatechange = () => {
        if (this.owner && ['suspended', 'interrupted'].includes(this.context.state)) {
          this.owner = false; this.track.pause(); this.stopSpeech();
          this.send({ t: 'audio', enabled: false });
          this.blocked('Safari tạm ngừng tiếng · bấm để bật lại âm thanh');
        }
      };
      const src = silentAudio();
      const unlock = [this.track, this.voice].map(player => {
        player.pause(); player.onended = player.onerror = player.onloadedmetadata = player.ontimeupdate = player.onplaying = null;
        player.src = src;
        return player.play().then(() => { player.pause(); player.currentTime = 0; player.removeAttribute('src'); });
      });
      await Promise.all([this.context.resume(), ...unlock]);
      this.active = null; this.appliedSeek = -1; this.completed = null;
      if (!this.master) { this.master = this.context.createGain(); this.master.gain.value = 0; this.master.connect(this.context.destination); }
      // iPhone Safari ignores HTMLMediaElement.volume. Route media through Web Audio
      // so both the music slider and speech ducking work on the phone.
      if (!this.trackSource && this.context.createMediaElementSource) {
        this.trackSource = this.context.createMediaElementSource(this.track);
        this.trackGain = this.context.createGain(); this.trackGain.gain.value = 0;
        this.trackSource.connect(this.trackGain); this.trackGain.connect(this.context.destination);
      }
      if (!this.voiceSource && this.context.createMediaElementSource && this.context.createDynamicsCompressor) {
        this.voiceSource = this.context.createMediaElementSource(this.voice);
        this.voiceGain = this.context.createGain(); this.voiceGain.gain.value = 0;
        const limiter = this.context.createDynamicsCompressor();
        limiter.threshold.value = -12; limiter.knee.value = 6; limiter.ratio.value = 6;
        limiter.attack.value = .003; limiter.release.value = .25;
        this.voiceSource.connect(this.voiceGain); this.voiceGain.connect(limiter); limiter.connect(this.context.destination);
      }
      this.nextBeat = this.context.currentTime; this.step = 0;
      this.timer ||= setInterval(() => this.ambientTick(), 80);
      this.send({ t: 'audio', enabled: true });
    } catch { this.blocked('Trình duyệt chặn tiếng · bấm lại để bật âm thanh'); }
  }
  setOwner(value) {
    this.owner = !!value && !this.preview;
    if (!this.owner) { this.track.pause(); this.active = null; this.stopSpeech(); }
    this.sync();
    if (this.owner && this.blockedSpeech) { const job = this.blockedSpeech; this.blockedSpeech = null; this.speech.unshift(job); this.playSpeech(); }
  }
  setSettings(value) { if (this.settings.ambient !== value.ambient) { this.step = 0; if (this.context) this.nextBeat = this.context.currentTime; } this.settings = value; this.sync(); }
  setRadio(value) { this.radio = value; this.sync(); }
  sync() {
    const s = this.settings, r = this.radio, duck = this.speaking ? Math.min(25, s.duckVolume ?? 15) / 100 : 1;
    const music = (s.trackVolume ?? 60) / 100;
    this.track.volume = this.trackGain ? 1 : music * duck;
    this.voice.volume = this.voiceGain ? 1 : (s.voiceVolume ?? 100) / 100;
    if (this.trackGain && this.context) this.trackGain.gain.setTargetAtTime(this.owner ? music * duck : 0, this.context.currentTime, .03);
    if (this.voiceGain && this.context) this.voiceGain.gain.setTargetAtTime(1.8 * (s.voiceVolume ?? 100) / 100, this.context.currentTime, .04);
    if (this.master && this.context) this.master.gain.setTargetAtTime(this.owner && s.music && !r.playing && !r.paused ? AMBIENT_BASE_GAIN * (s.ambientVolume ?? 35) / 100 * (music / .6) * duck : 0, this.context.currentTime, .15);
    if (!this.owner || this.preview) { this.track.pause(); return; }
    const p = r.playing;
    if (!p) { this.track.pause(); this.active = null; this.track.removeAttribute('src'); return; }
    if (this.active !== p.token) {
      this.active = p.token; this.completed = null; this.appliedSeek = -1; this.track.src = p.url;
      const token = p.token;
      this.track.onended = () => { if (this.active === token && this.completed !== token) { this.completed = token; this.send({ t: 'ended', token }); } };
      this.track.onerror = () => this.trackError(token);
      this.track.onloadedmetadata = () => { this.seek(); this.reportTime(); };
      this.track.ontimeupdate = () => { if (!this.lastReport || performance.now() - this.lastReport > 1000) this.reportTime(); };
    }
    this.seek();
    if (r.paused) { this.track.pause(); return; }
    if (this.track.paused && this.completed !== this.active && !this.playPending) {
      const token = this.active; this.playPending = true;
      this.track.play().catch(error => {
        if (token !== this.active || error.name === 'AbortError') return;
        if (error.name === 'NotAllowedError') { this.owner = false; this.send({ t: 'audio', enabled: false }); this.blocked('♫ Bấm để cho phép phát nhạc'); }
        else this.trackError(token);
      }).finally(() => { this.playPending = false; if (this.active !== token) this.sync(); });
    }
  }
  seek() {
    if (!Number.isFinite(this.track.duration) || this.appliedSeek === this.radio.seekVersion) return;
    this.appliedSeek = this.radio.seekVersion;
    this.track.currentTime = Math.max(0, Math.min(this.track.duration, this.radio.seekTo || this.radio.position || 0));
  }
  trackError(token) { if (this.owner && this.active === token && this.completed !== token) { this.completed = token; this.send({ t: 'audioError', token }); } }
  reportTime() {
    if (!this.owner || !this.active || !Number.isFinite(this.track.duration)) return;
    this.lastReport = performance.now(); this.send({ t: 'mediaTime', token: this.active, position: this.track.currentTime, duration: this.track.duration });
  }
  enqueueSpeech(url, metadata = {}) { if (this.owner && this.speech.length < 10) { this.speech.push({ url, source: metadata.source, playbackRate: metadata.playbackRate }); this.playSpeech(); } }
  enqueueFallback(job) { if (this.owner && this.speech.length < 10) { this.speech.push(job); this.playSpeech(); } }
  playSpeech() {
    if (!this.owner || this.speaking || !this.speech.length) return;
    this.speaking = true; const version = this.speechVersion, job = this.speech.shift(); this.sync();
    let finished = false;
    const done = () => { if (finished || version !== this.speechVersion) return; finished = true; clearTimeout(this.speechTimer); this.voice.pause(); this.speaking = false; this.sync(); this.playSpeech(); };
    const error = event => {
      if (finished || version !== this.speechVersion) return;
      const code = event?.name === 'NotAllowedError' ? 'NotAllowedError' : event?.name === 'NotSupportedError' ? 'NotSupportedError' : 'MediaError';
      this.send({ t: 'voiceError', code });
      if (code === 'NotAllowedError') { this.blockedSpeech = job; this.owner = false; this.track.pause(); this.send({ t: 'audio', enabled: false }); this.blocked('♫ Bấm để cho phép giọng đọc'); }
      done();
    };
    if (!job.url) { void this.speakLocal(job, done, version); return; }
    this.voice.src = job.url; this.voice.playbackRate = Number.isFinite(job.playbackRate) ? Math.max(.5, Math.min(1.5, job.playbackRate)) : 1; this.voice.preservesPitch = true; this.voice.onended = done; this.voice.onerror = error;
    this.voice.onplaying = () => { if (version === this.speechVersion && !finished) { document.body.dataset.speechSource = job.source || 'file'; this.send({ t: 'voiceStatus', status: 'playing', source: job.source || 'file' }); } };
    this.speechTimer = setTimeout(error, 60000); this.voice.play().catch(error);
  }
  async speakLocal(job, done, version) {
    const synth = window.speechSynthesis;
    if (synth && !synth.getVoices().length) await new Promise(resolve => { const ready = () => { clearTimeout(timer); synth.removeEventListener('voiceschanged', ready); resolve(); }; const timer = setTimeout(ready, 1500); synth.addEventListener('voiceschanged', ready, { once: true }); });
    if (version !== this.speechVersion || !this.owner) return;
    const voices = synth?.getVoices().filter(v => /^vi(?:[-_]|$)/i.test(v.lang)) || [];
    if (!voices.length) { this.send({ t: 'voiceStatus', status: 'fallbackUnavailable' }); done(); return; }
    const utterance = new SpeechSynthesisUtterance(job.text); utterance.voice = voices[0]; utterance.lang = 'vi-VN';
    utterance.rate = Math.max(.5, 1 + (job.rate || 0) / 100); utterance.pitch = Math.max(.4, Math.min(1.8, 1 + (job.pitch || 0) / 70)); utterance.volume = (this.settings.voiceVolume ?? 100) / 100;
    utterance.onend = done; utterance.onerror = done; this.speechTimer = setTimeout(() => { synth.cancel(); done(); }, 40000);
    this.send({ t: 'voiceStatus', status: 'fallbackSpeaking' }); synth.speak(utterance);
  }
  stopSpeech() { this.speechVersion++; clearTimeout(this.speechTimer); this.speech = []; this.blockedSpeech = null; this.voice.pause(); window.speechSynthesis?.cancel(); this.speaking = false; this.sync(); }
  tone(frequency, at, duration, level, wave = 'sine') {
    const osc = this.context.createOscillator(), gain = this.context.createGain();
    osc.type = wave; osc.frequency.value = frequency; gain.gain.setValueAtTime(.0001, at); gain.gain.exponentialRampToValueAtTime(level, at + .025); gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
    osc.connect(gain); gain.connect(this.master); osc.start(at); osc.stop(at + duration + .03);
  }
  ambientTick() {
    if (!this.owner || !this.settings.music || this.radio.playing || this.radio.paused || !this.context || this.context.state !== 'running') return;
    const preset = AMBIENTS.find(p => p.id === this.settings.ambient) || AMBIENTS[0], now = this.context.currentTime;
    if (this.nextBeat < now - .2) this.nextBeat = now;
    if (this.nextBeat > now + .12) return;
    const step = this.step++, at = this.nextBeat, beat = 60 / preset.bpm, root = preset.notes[Math.floor(step / 4) % preset.notes.length]; this.nextBeat += beat;
    document.body.dataset.ambientPreset = preset.id;
    if (step % 4 === 0) for (const [i, interval] of [0, 4, 7, 11].entries()) this.tone(root * 2 ** (interval / 12), at + i * .045, beat * 4.5, .24, preset.wave);
    this.tone(root * 2 ** (preset.melody[step % preset.melody.length] / 12), at + .04, beat * .85, .16, preset.wave);
    if (step % 2 === 0) this.tone(root / 2, at, beat * .7, .2);
    if (preset.rain) {
      const buffer = this.context.createBuffer(1, Math.ceil(this.context.sampleRate * beat), this.context.sampleRate), data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * .09;
      const source = this.context.createBufferSource(), filter = this.context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 1800; source.buffer = buffer; source.connect(filter); filter.connect(this.master); source.start(at);
    }
  }
  close() { clearInterval(this.timer); this.stopSpeech(); this.track.pause(); this.context?.close(); }
}
