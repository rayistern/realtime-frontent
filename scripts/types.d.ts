declare module 'web-audio-api' {
    export class AudioContext {
        decodeAudioData(buffer: ArrayBuffer): Promise<AudioBuffer>;
    }
    
    export class OfflineAudioContext {
        constructor(numberOfChannels: number, length: number, sampleRate: number);
        createBufferSource(): AudioBufferSourceNode;
        destination: AudioDestinationNode;
        startRendering(): Promise<AudioBuffer>;
    }

    export interface AudioBuffer {
        length: number;
        numberOfChannels: number;
        sampleRate: number;
        duration: number;
        getChannelData(channel: number): Float32Array;
    }

    export interface AudioBufferSourceNode {
        buffer: AudioBuffer | null;
        connect(destination: AudioDestinationNode): void;
        start(when?: number): void;
    }

    export interface AudioDestinationNode {
    }
} 