import nodemailer from "nodemailer";
import { decryptSecret } from "./secretCrypto";

type SmtpConfiguration = {
  host: string;
  port: number;
  username: string | null;
  passwordEncrypted: string | null;
  fromName: string;
  fromEmail: string;
  secure: boolean;
};

export async function sendSmtpMessage(settings: SmtpConfiguration, to: string[], subject: string, body: string) {
  if (!to.length) throw new Error("No hay destinatarios con correo electrónico.");
  const password = settings.passwordEncrypted ? decryptSecret(settings.passwordEncrypted) : undefined;
  const transporter = nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    auth: settings.username ? { user: settings.username, pass: password } : undefined,
  });
  await transporter.sendMail({
    from: `"${settings.fromName}" <${settings.fromEmail}>`,
    to: to.join(", "),
    subject,
    text: body,
  });
}
