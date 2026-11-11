import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";

/**
 * Pares fundo/texto com contraste AA, escolhidos de forma determinística
 * pelo identificador do membro (a cor de uma pessoa não muda entre telas).
 */
const swatches = [
  "bg-[#dff5ea] text-[#145c3c] dark:bg-[#143428] dark:text-[#a6f0c9]",
  "bg-[#e3ecf6] text-[#1d4569] dark:bg-[#1b2f44] dark:text-[#b4d0ee]",
  "bg-[#f6e9df] text-[#7a3d17] dark:bg-[#3a2a1e] dark:text-[#f2c9a8]",
  "bg-[#ece6f6] text-[#4b2f7a] dark:bg-[#2c2340] dark:text-[#d2c2f0]",
  "bg-[#f6e3e8] text-[#7d2440] dark:bg-[#3d1f29] dark:text-[#f0b8c8]",
  "bg-[#e5f1f2] text-[#1b5559] dark:bg-[#183538] dark:text-[#a9e3e6]",
] as const;

function hash(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) | 0;
  return Math.abs(h);
}

type MemberAvatarProps = {
  name: string;
  /** Chave estável para a cor (id do membro). Usa o nome se ausente. */
  colorKey?: string;
  imageUrl?: string | null;
  size?: "sm" | "default" | "lg" | "xl";
  /** Membro provisório (sem conta): contorno tracejado. */
  provisional?: boolean;
  className?: string;
};

export function MemberAvatar({ name, colorKey, imageUrl, size = "default", provisional, className }: MemberAvatarProps) {
  const swatch = swatches[hash(colorKey ?? name) % swatches.length];
  const xl = size === "xl";
  return (
    <Avatar
      size={xl ? "default" : size}
      className={cn(xl && "size-16", provisional && "outline-muted-foreground/50 outline-1 outline-offset-1 outline-dashed", className)}
      title={provisional ? `${name} (ainda sem conta)` : name}
    >
      {imageUrl ? <AvatarImage src={imageUrl} alt="" /> : null}
      <AvatarFallback className={cn("font-semibold", swatch, xl && "text-lg")}>{initials(name)}</AvatarFallback>
    </Avatar>
  );
}

export function MemberAvatarStack({
  members,
  max = 4,
  size = "default",
}: {
  members: { id: string; name: string; imageUrl?: string | null }[];
  max?: number;
  size?: "sm" | "default";
}) {
  const visible = members.slice(0, max);
  const rest = members.length - visible.length;
  return (
    <AvatarGroup aria-label={`${members.length} participantes`}>
      {visible.map((m) => (
        <MemberAvatar key={m.id} name={m.name} colorKey={m.id} imageUrl={m.imageUrl} size={size} />
      ))}
      {rest > 0 ? <AvatarGroupCount className="text-xs font-semibold">+{rest}</AvatarGroupCount> : null}
    </AvatarGroup>
  );
}
