declare module 'xlsx' {
  export interface Sheet {}
  export interface WorkBook {
    SheetNames: string[];
    Sheets: { [sheet: string]: Sheet };
  }
  
  export const utils: {
    sheet_to_json(sheet: Sheet, options?: any): any[];
    json_to_sheet(data: any[], options?: any): Sheet;
    writeFile(wb: WorkBook, filename: string): void;
  };
  
  export function read(data: any, options?: any): WorkBook;
}

declare module 'tesseract.js' {
  export interface TesseractWorker {
    loadLanguage: (lang: string) => Promise<void>;
    initialize: (lang: string) => Promise<void>;
    recognize: (image: string) => Promise<{
      data: {
        text: string;
      };
    }>;
    terminate: () => Promise<void>;
  }

  export interface CreateWorkerOptions {
    logger?: (log: { status: string; progress: number }) => void;
    errorHandler?: (error: Error) => void;
    langPath?: string;
    cachePath?: string;
    workerPath?: string;
    corePath?: string;
    workerOptions?: {
      tessedit_ocr_engine_mode?: string;
      tessedit_pageseg_mode?: string;
      tessedit_char_whitelist?: string;
      preserve_interword_spaces?: string;
      textord_heavy_nr?: string;
      tessedit_do_invert?: string;
      language_model_penalty_non_dict_word?: string;
      language_model_penalty_non_freq_dict_word?: string;
    };
  }

  export const PSM: {
    AUTO: 0;
    SINGLE_BLOCK: 1;
    SINGLE_COLUMN: 6;
  };

  export function createWorker(options?: CreateWorkerOptions): Promise<TesseractWorker>;
} 