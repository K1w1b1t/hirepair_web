/** Dados mínimos para processar áudio sem colocar conteúdo pessoal no Redis. */
export interface AudioProcessingJobData {
  applicationId: string;
}

/** Dados mínimos para gerar um PDF sem colocar o currículo serializado no Redis. */
export interface PdfGenerationJobData {
  resumeId: string;
}
