import {
  Activity, Bed, Bell, Bike, BookMarked, BookOpen, Brain, Cake, CalendarDays, ChartLine, Check, ChevronLeft,
  ChevronRight, CircleCheck, Clock, Coffee, Coins, Command, Crown, Download, Dumbbell, Ellipsis, ExternalLink,
  Film, Flag, Flame, Footprints, Gamepad2, Gem, Gift, GraduationCap, Hammer, Headphones, Heart, Hourglass, House,
  Info, Landmark, LayoutGrid, Leaf, Library, ListChecks, Lock, Map as MapIcon, Maximize2, Milestone, Minus,
  Monitor, Moon, Mountain, Music, Orbit, Pause, Pencil, Pizza, Plane, Play, Plus, Power, Quote, RefreshCw, Rocket,
  Route, Scale, Search, Send, Settings, ShoppingBag, Sigma, Sparkles, Square, Star, Store, Sun, Target, Telescope,
  Timer, Trash2, TrendingDown, TrendingUp, Trophy, Tv, Upload, Users, Wallet, X, Zap,
  Palette, Code, Camera, Globe, Sprout, Briefcase, Languages, Droplets, PawPrint, Hand, Cookie, LocateFixed, Eye, EyeOff,
  GripVertical, ArrowUp, ArrowDown, Volume2, VolumeX, Smile, NotebookPen, Utensils, Armchair, BellRing,
  type LucideIcon,
} from 'lucide-react';

const MAP: Record<string, LucideIcon> = {
  activity: Activity, bed: Bed, bell: Bell, bike: Bike, 'book-marked': BookMarked, 'book-open': BookOpen,
  brain: Brain, cake: Cake, calendar: CalendarDays, chart: ChartLine, check: Check, 'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight, 'circle-check': CircleCheck, clock: Clock, coffee: Coffee, coins: Coins,
  command: Command, crown: Crown, download: Download, dumbbell: Dumbbell, more: Ellipsis, external: ExternalLink,
  film: Film, flag: Flag, flame: Flame, footprints: Footprints, gamepad: Gamepad2, gem: Gem, gift: Gift,
  graduation: GraduationCap, hammer: Hammer, headphones: Headphones, heart: Heart, hourglass: Hourglass,
  house: House, info: Info, landmark: Landmark, grid: LayoutGrid, leaf: Leaf, library: Library,
  'list-checks': ListChecks, lock: Lock, map: MapIcon, maximize: Maximize2, milestone: Milestone, minus: Minus,
  monitor: Monitor, moon: Moon, mountain: Mountain, music: Music, orbit: Orbit, pause: Pause, pencil: Pencil,
  pizza: Pizza, plane: Plane, play: Play, plus: Plus, power: Power, quote: Quote, refresh: RefreshCw,
  rocket: Rocket, route: Route, scale: Scale, search: Search, send: Send, settings: Settings,
  'shopping-bag': ShoppingBag, sigma: Sigma, sparkles: Sparkles, square: Square, star: Star, store: Store,
  sun: Sun, target: Target, telescope: Telescope, timer: Timer, trash: Trash2, 'trending-up': TrendingUp, 'trending-down': TrendingDown,
  trophy: Trophy, tv: Tv, upload: Upload, users: Users, wallet: Wallet, x: X, zap: Zap,
  palette: Palette, code: Code, camera: Camera, globe: Globe, sprout: Sprout, briefcase: Briefcase, languages: Languages,
  droplets: Droplets, paw: PawPrint, hand: Hand, cookie: Cookie, locate: LocateFixed, eye: Eye, 'eye-off': EyeOff,
  grip: GripVertical, 'arrow-up': ArrowUp, 'arrow-down': ArrowDown, volume: Volume2, 'volume-off': VolumeX, smile: Smile,
  notebook: NotebookPen, utensils: Utensils, armchair: Armchair, 'bell-ring': BellRing,
};

export const REWARD_ICONS = ['coffee', 'film', 'gamepad', 'pizza', 'cake', 'plane', 'shopping-bag', 'music', 'bed', 'tv', 'headphones', 'gift'];

export function Icon({ name, size = 18, stroke = 2, className }: { name: string; size?: number; stroke?: number; className?: string }) {
  const C = MAP[name] ?? Sparkles;
  return <C size={size} strokeWidth={stroke} className={className} aria-hidden />;
}
