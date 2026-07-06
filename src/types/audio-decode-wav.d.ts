declare module "@audio/decode-wav" {
  type DecodedWav = {
    channelData: Float32Array[];
    sampleRate: number;
  };

  export default function decodeWav(buffer: ArrayBuffer | Buffer): Promise<DecodedWav>;
}
