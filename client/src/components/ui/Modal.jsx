import { Fragment } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { X } from "lucide-react";
import clsx from "clsx";

export const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  size = "md",
  footer,
}) => {
  const sizes = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel
                className={clsx(
                  "w-full transform overflow-hidden rounded-2xl bg-white dark:bg-slate-800 shadow-xl transition-all",
                  sizes[size],
                )}
              >
                {title && (
                  <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                    <Dialog.Title className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                      {title}
                    </Dialog.Title>
                    <button
                      onClick={onClose}
                      className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                      <X className="h-5 w-5 text-slate-500" />
                    </button>
                  </div>
                )}
                <div className="px-6 py-4 max-h-[70vh] overflow-y-auto">
                  {children}
                </div>
                {footer && (
                  <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                    {footer}
                  </div>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};
