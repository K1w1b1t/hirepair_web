export interface CorrelatedJobData {
  correlationId?: string;
}
/** Dados mínimos para processar áudio sem colocar conteúdo pessoal no Redis. */
export interface AudioProcessingJobData extends CorrelatedJobData {
  applicationId: string;
}
/** Dados mínimos para gerar um PDF sem colocar o currículo serializado no Redis. */
export interface PdfGenerationJobData extends CorrelatedJobData {
  resumeId: string;
}
