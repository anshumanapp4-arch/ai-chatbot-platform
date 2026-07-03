declare module 'pdf-parse' {
  interface PDFInfo {
    PDFFormatVersion: string;
    IsAcroFormPresent: boolean;
    IsXFAPresent: boolean;
    Creator: string;
    Producer: string;
    CreationDate: string;
    ModDate: string;
    Format: string;
    Encryption: string;
    Linearized: string;
  }

  interface PDFMetadata {
    info: PDFInfo;
    metadata: any;
  }

  interface PDFData {
    numpages: number;
    numrender: number;
    info: PDFInfo;
    metadata: any;
    text: string;
    version: string;
  }

  function pdf(dataBuffer: Buffer, options?: any): Promise<PDFData>;
  export = pdf;
}
