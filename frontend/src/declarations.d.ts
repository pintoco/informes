declare module '*.png' {
  const src: string;
  export default src;
}

declare module 'react-signature-canvas' {
  import { Component } from 'react';
  interface ReactSignatureCanvasProps {
    canvasProps?: React.CanvasHTMLAttributes<HTMLCanvasElement>;
    backgroundColor?: string;
    onBegin?: () => void;
    onEnd?: () => void;
    [key: string]: any;
  }
  class ReactSignatureCanvas extends Component<ReactSignatureCanvasProps> {
    clear(): void;
    isEmpty(): boolean;
    toDataURL(type?: string): string;
    fromDataURL(dataURL: string): void;
  }
  export default ReactSignatureCanvas;
}
