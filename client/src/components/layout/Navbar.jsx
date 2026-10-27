import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import {
  Menu,
  Moon,
  Sun,
  Bell,
  User,
  LogOut,
  Settings,
  ChevronDown,
} from "lucide-react";
import { Menu as HeadlessMenu, Transition } from "@headlessui/react";
import { Fragment } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { getInitials } from "../../lib/utils";
import clsx from "clsx";

export const Navbar = ({ onMenuClick }) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-800/80 backdrop-blur-lg border-b border-slate-200 dark:border-slate-700">
      <div className="flex h-16 items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuClick}
            className="lg:hidden rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
              <span className="text-white font-bold text-sm">B</span>
            </div>
            <span className="hidden md:block font-bold text-slate-900 dark:text-white">
              SecureBank
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? (
              <Sun className="h-5 w-5 text-slate-600 dark:text-slate-300" />
            ) : (
              <Moon className="h-5 w-5 text-slate-600 dark:text-slate-300" />
            )}
          </button>

          <Link
            to="/dashboard/notifications"
            className="relative rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <Bell className="h-5 w-5 text-slate-600 dark:text-slate-300" />
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-danger-500" />
          </Link>

          <HeadlessMenu as="div" className="relative">
            <HeadlessMenu.Button className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700">
              {user?.profilePicture?.url ? (
                <img
                  src={user.profilePicture.url}
                  alt={user.firstName}
                  className="h-8 w-8 rounded-full object-cover"
                />
              ) : (
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white text-xs font-semibold">
                  {getInitials(user?.firstName, user?.lastName)}
                </div>
              )}
              <ChevronDown className="hidden md:block h-4 w-4 text-slate-500" />
            </HeadlessMenu.Button>

            <Transition
              as={Fragment}
              enter="transition ease-out duration-100"
              enterFrom="transform opacity-0 scale-95"
              enterTo="transform opacity-100 scale-100"
              leave="transition ease-in duration-75"
              leaveFrom="transform opacity-100 scale-100"
              leaveTo="transform opacity-0 scale-95"
            >
              <HeadlessMenu.Items className="absolute right-0 mt-2 w-56 origin-top-right divide-y divide-slate-200 dark:divide-slate-700 rounded-xl bg-white dark:bg-slate-800 shadow-lg ring-1 ring-black/5 focus:outline-none">
                <div className="p-3">
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {user?.email}
                  </p>
                  <span className="mt-2 badge-primary capitalize">
                    {user?.role}
                  </span>
                </div>
                <div className="p-1">
                  <HeadlessMenu.Item>
                    {({ active }) => (
                      <Link
                        to="/dashboard/profile"
                        className={clsx(
                          "flex items-center gap-2 rounded-lg px-3 py-2 text-sm",
                          active && "bg-slate-100 dark:bg-slate-700",
                        )}
                      >
                        <User className="h-4 w-4" /> Profile
                      </Link>
                    )}
                  </HeadlessMenu.Item>
                  <HeadlessMenu.Item>
                    {({ active }) => (
                      <Link
                        to="/dashboard/settings"
                        className={clsx(
                          "flex items-center gap-2 rounded-lg px-3 py-2 text-sm",
                          active && "bg-slate-100 dark:bg-slate-700",
                        )}
                      >
                        <Settings className="h-4 w-4" /> Settings
                      </Link>
                    )}
                  </HeadlessMenu.Item>
                </div>
                <div className="p-1">
                  <HeadlessMenu.Item>
                    {({ active }) => (
                      <button
                        onClick={handleLogout}
                        className={clsx(
                          "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-danger-500",
                          active && "bg-danger-50 dark:bg-danger-900/20",
                        )}
                      >
                        <LogOut className="h-4 w-4" /> Sign out
                      </button>
                    )}
                  </HeadlessMenu.Item>
                </div>
              </HeadlessMenu.Items>
            </Transition>
          </HeadlessMenu>
        </div>
      </div>
    </header>
  );
};
