export class AudioHandler {
  private context: AudioContext;
  private workletNode: AudioWorkletNode | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private readonly sampleRate = 24000;

  private nextPlayTime: number = 0;
  private isPlaying: boolean = false;
  private playbackQueue: AudioBufferSourceNode[] = [];
  private recordedChunks: Float32Array[] = [];

  constructor() {
    this.context = new AudioContext({ sampleRate: this.sampleRate });
  }

  async initialize() {
    await this.context.audioWorklet.addModule("/audio-processor.js");
  }

  async startRecording() {
    try {
      if (!this.workletNode) {
        await this.initialize();
      }

      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: this.sampleRate,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      await this.context.resume();
      this.source = this.context.createMediaStreamSource(this.stream);
      this.workletNode = new AudioWorkletNode(
        this.context,
        "audio-recorder-processor",
      );

      this.workletNode.port.onmessage = (event) => {
        if (event.data.eventType === "audio") {
          this.recordedChunks.push(event.data.audioData);
        }
      };

      this.source.connect(this.workletNode);
      this.workletNode.connect(this.context.destination);

      this.workletNode.port.postMessage({ command: "START_RECORDING" });
    } catch (error) {
      console.error("Error starting recording:", error);
      throw error;
    }
  }

  async stopRecording(): Promise<Uint8Array> {
    if (!this.workletNode || !this.source || !this.stream) {
      throw new Error("Recording not started");
    }

    this.workletNode.port.postMessage({ command: "STOP_RECORDING" });

    this.workletNode.disconnect();
    this.source.disconnect();
    this.stream.getTracks().forEach((track) => track.stop());

    // Merge recorded chunks
    const combinedBuffer = this.mergeBuffers(this.recordedChunks);
    this.recordedChunks = [];

    // Convert Float32Array to Int16Array
    const int16Buffer = this.float32ToInt16(combinedBuffer);
    return new Uint8Array(int16Buffer.buffer);
  }

  private mergeBuffers(chunks: Float32Array[]): Float32Array {
    let length = 0;
    chunks.forEach((chunk) => {
      length += chunk.length;
    });
    const result = new Float32Array(length);
    let offset = 0;
    chunks.forEach((chunk) => {
      result.set(chunk, offset);
      offset += chunk.length;
    });
    return result;
  }

  private float32ToInt16(buffer: Float32Array): Int16Array {
    const l = buffer.length;
    const result = new Int16Array(l);
    for (let i = 0; i < l; i++) {
      const s = Math.max(-1, Math.min(1, buffer[i]));
      result[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return result;
  }

  startStreamingPlayback() {
    this.isPlaying = true;
    this.nextPlayTime = this.context.currentTime;
  }

  stopStreamingPlayback() {
    this.isPlaying = false;
    this.playbackQueue.forEach((source) => source.stop());
    this.playbackQueue = [];
  }

  playChunk(chunk: Uint8Array) {
    if (!this.isPlaying) return;

    const int16Data = new Int16Array(chunk.buffer);

    const float32Data = new Float32Array(int16Data.length);
    for (let i = 0; i < int16Data.length; i++) {
      float32Data[i] = int16Data[i] / (int16Data[i] < 0 ? 0x8000 : 0x7fff);
    }

    const audioBuffer = this.context.createBuffer(
      1,
      float32Data.length,
      this.sampleRate,
    );
    audioBuffer.getChannelData(0).set(float32Data);

    const source = this.context.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.context.destination);

    const chunkDuration = audioBuffer.length / this.sampleRate;

    source.start(this.nextPlayTime);

    this.playbackQueue.push(source);
    source.onended = () => {
      const index = this.playbackQueue.indexOf(source);
      if (index > -1) {
        this.playbackQueue.splice(index, 1);
      }
    };

    this.nextPlayTime += chunkDuration;

    if (this.nextPlayTime < this.context.currentTime) {
      this.nextPlayTime = this.context.currentTime;
    }
  }
  async close() {
    this.workletNode?.disconnect();
    this.source?.disconnect();
    this.stream?.getTracks().forEach((track) => track.stop());
    await this.context.close();
  }
}

async function processWavFile(file: File): Promise<Uint8Array> {
  const arrayBuffer = await file.arrayBuffer();
  const audioContext = new AudioContext();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  
  // Resample to 24kHz mono
  const offlineContext = new OfflineAudioContext(1, audioBuffer.length, 24000);
  const source = offlineContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offlineContext.destination);
  source.start();
  
  const resampledBuffer = await offlineContext.startRendering();
  
  // Convert to 16-bit PCM
  const pcmData = new Int16Array(resampledBuffer.length);
  const channelData = resampledBuffer.getChannelData(0);
  
  for (let i = 0; i < resampledBuffer.length; i++) {
    const s = Math.max(-1, Math.min(1, channelData[i]));
    pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  
  return new Uint8Array(pcmData.buffer);
}
