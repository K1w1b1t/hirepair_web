declare module 'mammoth/mammoth.browser' {
  interface RawTextOptions {
    arrayBuffer: ArrayBuffer;
  }

  interface RawTextResult {
    value: string;
  }

  export function extractRawText(options: RawTextOptions): Promise<RawTextResult>;
}
