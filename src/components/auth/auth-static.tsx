import Link from "next/link";

/*
 * Peças fixas das telas de autenticação, renderizadas no servidor (sem "use client"):
 * vêm prontas no HTML e não dependem do JavaScript nem do registro de componentes de cliente.
 */

function Heading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-7">
      <h1 className="text-[28px] leading-tight font-extrabold">{title}</h1>
      {description ? <p className="text-muted-foreground mt-2 text-[15px]">{description}</p> : null}
    </div>
  );
}

/**
 * Enquanto o formulário (que lê a URL no navegador) não hidrata: o título já vem no HTML,
 * e o resto é um contorno do mesmo tamanho. Evita a tela em branco e o salto de layout.
 */
export function AuthFormFallback({ title, description, fields }: { title: string; description?: string; fields: number }) {
  return (
    <div aria-busy="true">
      <Heading title={title} description={description} />
      <div className="space-y-4">
        {Array.from({ length: fields }, (_, i) => (
          <div key={i} className="space-y-2">
            <div className="bg-muted h-4 w-20 rounded" />
            <div className="bg-muted h-12 rounded-xl" />
          </div>
        ))}
        <div className="bg-muted h-12 rounded-xl" />
      </div>
    </div>
  );
}

/** Aviso legal do login com Google (texto fixo: vem no HTML, não espera o JavaScript). */
export function GoogleLegalNote() {
  return (
    <p className="text-muted-foreground mt-3 text-center text-xs">
      Entrar com Google pela primeira vez cria uma conta e significa concordar com os{" "}
      <Link href="/termos" className="underline underline-offset-4">
        Termos
      </Link>{" "}
      e a{" "}
      <Link href="/privacidade" className="underline underline-offset-4">
        Privacidade
      </Link>
      .
    </p>
  );
}
