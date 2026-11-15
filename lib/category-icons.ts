import {
  AppWindow, Baby, Banknote, Bed, Beer, Bike, Blocks, BookOpen, Bone, Brain, Briefcase, Building, Building2,
  Bus, Cable, Car, CarTaxiFront, Circle, CircleHelp, Clapperboard, Cloud, Coffee, CreditCard, Droplet,
  Droplets, Dumbbell, Ellipsis, FileText, Flame, Flower2, Footprints, Fuel, Gamepad2, Gift, Glasses,
  GraduationCap, HandCoins, Heart, HeartHandshake, HeartPulse, House, KeyRound, Landmark, Laptop, Map,
  Microscope, MonitorSmartphone, Package, Palette, PartyPopper, PawPrint, Pencil, Percent, Pill, Plane,
  Plug, Presentation, Receipt, School, Scissors, Shield, ShieldCheck, ShieldPlus, Shirt, ShoppingCart,
  Smartphone, Smile, Sofa, Sparkles, SprayCan, SquareParking, Stethoscope, Store, Syringe, Tag, Ticket,
  TriangleAlert, Trophy, Tv, Umbrella, Users, Utensils, UtensilsCrossed, Wallet, WashingMachine, Watch,
  Wifi, Wine, Wrench, Zap,
  type LucideIcon,
} from "lucide-react";

/**
 * Nombre guardado en categories.icon → componente de lucide.
 * Mapa explícito para que el bundle solo incluya los iconos usados.
 */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  "app-window": AppWindow, baby: Baby, banknote: Banknote, bed: Bed, beer: Beer, bike: Bike, blocks: Blocks,
  "book-open": BookOpen, bone: Bone, brain: Brain, briefcase: Briefcase, building: Building,
  "building-2": Building2, bus: Bus, cable: Cable, car: Car, "car-taxi-front": CarTaxiFront, circle: Circle,
  "circle-help": CircleHelp, clapperboard: Clapperboard, cloud: Cloud, coffee: Coffee,
  "credit-card": CreditCard, droplet: Droplet, droplets: Droplets, dumbbell: Dumbbell, ellipsis: Ellipsis,
  "file-text": FileText, flame: Flame, "flower-2": Flower2, footprints: Footprints, fuel: Fuel,
  "gamepad-2": Gamepad2, gift: Gift, glasses: Glasses, "graduation-cap": GraduationCap,
  "hand-coins": HandCoins, heart: Heart, "heart-handshake": HeartHandshake, "heart-pulse": HeartPulse,
  home: House, house: House, "key-round": KeyRound, landmark: Landmark, laptop: Laptop, map: Map,
  microscope: Microscope, "monitor-smartphone": MonitorSmartphone, package: Package, palette: Palette,
  "party-popper": PartyPopper, "paw-print": PawPrint, pencil: Pencil, percent: Percent, pill: Pill,
  plane: Plane, plug: Plug, presentation: Presentation, receipt: Receipt, school: School,
  scissors: Scissors, shield: Shield, "shield-check": ShieldCheck, "shield-plus": ShieldPlus, shirt: Shirt,
  "shopping-cart": ShoppingCart, smartphone: Smartphone, smile: Smile, sofa: Sofa, sparkles: Sparkles,
  "spray-can": SprayCan, "square-parking": SquareParking, stethoscope: Stethoscope, store: Store,
  syringe: Syringe, tag: Tag, ticket: Ticket, "triangle-alert": TriangleAlert, trophy: Trophy, tv: Tv,
  umbrella: Umbrella, users: Users, utensils: Utensils, "utensils-crossed": UtensilsCrossed, wallet: Wallet,
  "washing-machine": WashingMachine, watch: Watch, wifi: Wifi, wine: Wine, wrench: Wrench, zap: Zap,
};

export function getCategoryIcon(name: string | null | undefined): LucideIcon {
  return (name && CATEGORY_ICONS[name]) || Tag;
}

/** Iconos ofrecidos al crear una categoría propia. */
export const PICKABLE_ICONS = [
  "tag", "shopping-cart", "utensils", "coffee", "car", "bus", "fuel", "house", "zap", "wifi", "smartphone",
  "heart-pulse", "pill", "dumbbell", "shirt", "gift", "plane", "bed", "ticket", "tv", "gamepad-2", "book-open",
  "graduation-cap", "baby", "paw-print", "laptop", "briefcase", "wrench", "banknote", "credit-card", "receipt",
  "party-popper", "beer", "wine", "sparkles", "scissors", "palette", "trophy", "umbrella", "wallet",
];

export const PICKABLE_COLORS = [
  "#6366F1", "#3B82F6", "#0EA5E9", "#06B6D4", "#14B8A6", "#059669", "#84CC16", "#F59E0B",
  "#F97316", "#EF4444", "#E11D48", "#EC4899", "#A855F7", "#A16207", "#64748B", "#9CA3AF",
];
