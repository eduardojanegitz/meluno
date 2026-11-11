import {
  Car,
  CircleEllipsis,
  Clapperboard,
  Flame,
  HeartHandshake,
  House,
  Lightbulb,
  Plane,
  ShoppingCart,
  Ticket,
  Users,
  Utensils,
  type LucideIcon,
} from "lucide-react";

/**
 * Catálogos de categoria. As chaves serão os valores dos enums do banco
 * (Etapa 3); rótulos e ícones ficam só na apresentação.
 */

export const groupCategories = {
  TRIP: { label: "Viagem", icon: Plane },
  HOME: { label: "Casa", icon: House },
  COUPLE: { label: "Casal", icon: HeartHandshake },
  EVENT: { label: "Evento", icon: Flame },
  FRIENDS: { label: "Amigos", icon: Users },
  OTHER: { label: "Outro", icon: CircleEllipsis },
} as const satisfies Record<string, { label: string; icon: LucideIcon }>;

export type GroupCategory = keyof typeof groupCategories;

export const expenseCategories = {
  FOOD: { label: "Alimentação", icon: Utensils },
  GROCERIES: { label: "Mercado", icon: ShoppingCart },
  TRANSPORT: { label: "Transporte", icon: Car },
  HOUSING: { label: "Moradia", icon: House },
  UTILITIES: { label: "Contas", icon: Lightbulb },
  LEISURE: { label: "Lazer", icon: Clapperboard },
  TRAVEL: { label: "Viagem", icon: Plane },
  EVENTS: { label: "Ingressos", icon: Ticket },
  OTHER: { label: "Outros", icon: CircleEllipsis },
} as const satisfies Record<string, { label: string; icon: LucideIcon }>;

export type ExpenseCategory = keyof typeof expenseCategories;
