import "server-only";
import type { EmailMessage } from "./mailer";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function layout({ title, intro, cta, url, outro }: { title: string; intro: string; cta: string; url: string; outro: string }) {
  const safeUrl = escapeHtml(url);
  return `<!doctype html>
<html lang="pt-BR"><body style="margin:0;background:#f8faf9;font-family:Inter,Segoe UI,Arial,sans-serif;color:#192a30">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:20px;border:1px solid #e3e9e6">
<tr><td style="padding:32px 32px 8px;font-size:24px;font-weight:800;letter-spacing:-1px;color:#172d40">meluno<span style="color:#1fa36d">.</span></td></tr>
<tr><td style="padding:8px 32px 0"><h1 style="margin:0;font-size:20px;color:#172d40">${title}</h1></td></tr>
<tr><td style="padding:12px 32px 0;font-size:15px;line-height:1.55">${intro}</td></tr>
<tr><td style="padding:24px 32px"><a href="${safeUrl}" style="display:inline-block;background:#172d40;color:#ffffff;text-decoration:none;font-weight:600;padding:14px 22px;border-radius:12px">${cta}</a></td></tr>
<tr><td style="padding:0 32px 32px;font-size:13px;line-height:1.5;color:#64747d">${outro}<br><br>Se o botão não funcionar, copie este endereço:<br><span style="word-break:break-all">${safeUrl}</span></td></tr>
</table></td></tr></table></body></html>`;
}

export function verifyEmailMessage(to: string, name: string, url: string): EmailMessage {
  const first = name.trim().split(/\s+/)[0] ?? "";
  return {
    to,
    subject: "Confirme seu e-mail no Meluno",
    html: layout({
      title: `Boas-vindas, ${escapeHtml(first)}!`,
      intro: "Falta só confirmar seu e-mail para começar a dividir despesas.",
      cta: "Confirmar e-mail",
      url,
      outro: "O link expira em 24 horas. Se você não criou uma conta no Meluno, ignore esta mensagem.",
    }),
    text: `Boas-vindas, ${first}!\n\nConfirme seu e-mail para começar a usar o Meluno:\n${url}\n\nO link expira em 24 horas. Se você não criou uma conta, ignore esta mensagem.`,
  };
}

export function invitationMessage(to: string, inviterName: string, groupName: string, url: string): EmailMessage {
  return {
    to,
    subject: `${inviterName} convidou você para "${groupName}" no Meluno`,
    html: layout({
      title: `Você foi convidado para ${escapeHtml(groupName)}`,
      intro: `${escapeHtml(inviterName)} está usando o Meluno para dividir as despesas do grupo e quer você junto.`,
      cta: "Ver convite",
      url,
      outro: "O convite expira em 14 dias. Se você não conhece essa pessoa, pode ignorar esta mensagem.",
    }),
    text: `${inviterName} convidou você para o grupo "${groupName}" no Meluno.\n\nVer convite:\n${url}\n\nO convite expira em 14 dias.`,
  };
}

export function resetPasswordMessage(to: string, url: string): EmailMessage {
  return {
    to,
    subject: "Redefinir sua senha do Meluno",
    html: layout({
      title: "Redefinir senha",
      intro: "Recebemos um pedido para redefinir a senha da sua conta.",
      cta: "Criar nova senha",
      url,
      outro: "O link expira em 1 hora. Se você não pediu isso, ignore esta mensagem — sua senha continua a mesma.",
    }),
    text: `Recebemos um pedido para redefinir a senha da sua conta Meluno.\n\nCrie uma nova senha:\n${url}\n\nO link expira em 1 hora. Se você não pediu isso, ignore esta mensagem.`,
  };
}
