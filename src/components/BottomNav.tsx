import { NavLink } from "react-router-dom";
import { CalendarDays, ShoppingBasket, Settings as SettingsIcon } from "lucide-react";

const items = [
  { to: "/", label: "Menu", icon: CalendarDays, end: true },
  { to: "/shopping", label: "List", icon: ShoppingBasket },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

export function BottomNav() {
  return (
    <nav className="no-print fixed bottom-0 inset-x-0 z-30 bg-bg/90 backdrop-blur-md border-t border-border pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-md mx-auto grid grid-cols-3">
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition ${
                isActive ? "text-accent" : "text-muted hover:text-text"
              }`
            }
          >
            <Icon size={20} strokeWidth={1.6} />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
