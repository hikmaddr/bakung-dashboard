"use client";
import { ChevronDown, Share2, PlusCircle } from "lucide-react";
import { useState } from "react";

interface DropdownItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
}

interface PageHeaderProps {
  title: string;
  primaryLabel: string;
  primaryHref: string;
  dropdownItems?: DropdownItem[];
}

export default function PageHeader({
  title,
  primaryLabel,
  primaryHref,
  dropdownItems = [],
}: PageHeaderProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex justify-between items-center mb-8">
      <h1 className="text-xl font-semibold">{title}</h1>

      <div className="flex items-center gap-3">
        {dropdownItems.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setOpen(!open)}
              className="flex items-center border rounded-full px-4 py-2 text-gray-700 bg-white hover:bg-gray-100 shadow-sm transition"
            >
              <Share2 className="w-4 h-4 mr-2 text-gray-600" />
              Unduh dan Bagikan
              <ChevronDown className="w-4 h-4 ml-2 text-gray-500" />
            </button>

            {open && (
              <div className="absolute right-0 mt-2 w-56 bg-white border rounded-lg shadow-lg z-10 overflow-hidden">
                <ul className="py-1 text-sm text-gray-700">
                  {dropdownItems.map((item, idx) => (
                    <li key={idx}>
                      <button
                        onClick={item.onClick}
                        className="flex items-center w-full px-4 py-2 hover:bg-gray-50"
                      >
                        {item.icon && <span className="mr-2">{item.icon}</span>}
                        {item.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <a
          href={primaryHref}
          className="flex items-center bg-blue-600 text-white rounded-full px-4 py-2 hover:bg-blue-700 shadow-sm transition"
        >
          <PlusCircle className="w-4 h-4 mr-2" />
          {primaryLabel}
        </a>
      </div>
    </div>
  );
}
