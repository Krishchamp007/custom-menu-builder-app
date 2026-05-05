import { BrowserRouter, Route, Routes } from "react-router-dom";
import { BottomNav } from "@/components/BottomNav";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ToastProvider } from "@/components/Toast";
import WeekPage from "@/pages/WeekPage";
import DishPage from "@/pages/DishPage";
import ShoppingListPage from "@/pages/ShoppingListPage";
import SettingsPage from "@/pages/SettingsPage";

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <main className="max-w-md mx-auto px-4 pt-[max(env(safe-area-inset-top),12px)] pb-28">
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<WeekPage />} />
              <Route path="/dish/:dayIndex/:slot" element={<DishPage />} />
              <Route path="/shopping" element={<ShoppingListPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </ErrorBoundary>
        </main>
        <BottomNav />
      </ToastProvider>
    </BrowserRouter>
  );
}
