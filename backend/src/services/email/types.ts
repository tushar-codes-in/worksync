export interface MailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailProvider {
  readonly name: string;
  send(params: MailParams): Promise<void>;
}
