import { Activity, House, User, Users, type LucideIcon } from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

/** Rotas definitivas do app autenticado (implementadas na Etapa 4). */
export const navItems: NavItem[] = [
  { href: "/inicio", label: "Início", icon: House },
  { href: "/grupos", label: "Grupos", icon: Users },
  { href: "/atividade", label: "Atividade", icon: Activity },
  { href: "/perfil", label: "Perfil", icon: User },
];
