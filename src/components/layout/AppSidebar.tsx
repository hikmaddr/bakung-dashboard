"use client";
import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSidebar } from "@/context/SidebarContext";
import {
  GridIcon,
  UserCircleIcon,
  ListIcon,
  TableIcon,
  PageIcon,
  PieChartIcon,
  BoxCubeIcon,
  PlugInIcon,
  CalenderIcon,
  ChevronDownIcon,
  HorizontaLDots,
} from "@/icons";

type FeatureKey =
  | "sales.quotation"
  | "sales.order"
  | "sales.invoice"
  | "sales.receipt"
  | "sales.delivery"
  | "purchase.order"
  | "purchase.invoice"
  | "purchase.receipt"
  | "purchase.receiving"
  | "inventory.products"
  | "inventory.stock";

type NavItem = {
  name: string;
  icon: React.ReactNode;
  path?: string;
  subItems?: { name: string; path: string; pro?: boolean; new?: boolean; featureKey?: FeatureKey }[];
  moduleKey?: ModuleKey;
};

type ModuleKey = "sales" | "purchase" | "inventory";

const defaultModulesTop: Record<ModuleKey, boolean> = {
  sales: true,
  purchase: true,
  inventory: true,
};

const FEATURES_BY_MODULE: Record<ModuleKey, Array<{ key: FeatureKey }>> = {
  sales: [
    { key: "sales.quotation" },
    { key: "sales.order" },
    { key: "sales.invoice" },
    { key: "sales.receipt" },
    { key: "sales.delivery" },
  ],
  purchase: [
    { key: "purchase.order" },
    { key: "purchase.invoice" },
    { key: "purchase.receipt" },
    { key: "purchase.receiving" },
  ],
  inventory: [
    { key: "inventory.products" },
    { key: "inventory.stock" },
  ],
};

const buildDefaultModulesAll = (): Record<string, boolean> => {
  const base: Record<string, boolean> = { ...defaultModulesTop };
  (Object.keys(FEATURES_BY_MODULE) as ModuleKey[]).forEach((mk) => {
    FEATURES_BY_MODULE[mk].forEach(({ key }) => {
      base[key] = true;
    });
  });
  return base;
};

const defaultModulesAll: Record<string, boolean> = buildDefaultModulesAll();

const normalizeModules = (value: unknown): Record<ModuleKey, boolean> => {
  if (!value || typeof value !== "object") {
    return { ...defaultModules };
  }

  const record = value as Record<string, unknown>;
  return {
    sales: Boolean(record.sales ?? defaultModules.sales),
    purchase: Boolean(record.purchase ?? defaultModules.purchase),
    inventory: Boolean(record.inventory ?? defaultModules.inventory),
  };
};

const staticNavItems: NavItem[] = [
  {
    icon: <GridIcon />,
    name: "Dashboard",
    path: "/",
  },
  {
    icon: <UserCircleIcon />,
    name: "Client",
    subItems: [
      { name: "Client List", path: "/client/list" },
    ],
  },
  {
    icon: <PieChartIcon />,
    name: "Finance",
    subItems: [
      { name: "Payment", path: "/finance/payment" },
      { name: "Expense", path: "/finance/expense" },
    ],
  },
  {
    icon: <ListIcon />,
    name: "Penjualan",
    moduleKey: "sales",
    subItems: [
      { name: "Quotation", path: "/penjualan/quotation", featureKey: "sales.quotation" },
      { name: "Order Penjualan", path: "/penjualan/order-penjualan", featureKey: "sales.order" },
      { name: "Invoice Penjualan", path: "/penjualan/invoice-penjualan", featureKey: "sales.invoice" },
      { name: "Kwitansi Penjualan", path: "/penjualan/kwitansi-penjualan", featureKey: "sales.receipt" },
      { name: "Surat Jalan", path: "/penjualan/surat-jalan", featureKey: "sales.delivery" },
    ],
  },
  {
    icon: <TableIcon />,
    name: "Pembelian",
    moduleKey: "purchase",
    subItems: [
      { name: "Order Pembelian", path: "/pembelian/order-pembelian", featureKey: "purchase.order" },
      { name: "Invoice Pembelian", path: "/pembelian/invoice-pembelian", featureKey: "purchase.invoice" },
      { name: "Kwitansi Pembelian", path: "/pembelian/kwitansi-pembelian", featureKey: "purchase.receipt" },
      { name: "Surat Penerimaan Barang", path: "/pembelian/surat-penerimaan-barang", featureKey: "purchase.receiving" },
      { name: "Pembelian Langsung", path: "/pembelian/pembelian-langsung" },
    ],
  },
  {
    icon: <BoxCubeIcon />,
    name: "Produk & Stok",
    moduleKey: "inventory",
    subItems: [
      { name: "Produk", path: "/produk-stok/produk", featureKey: "inventory.products" },
      { name: "Stok & Gudang", path: "/produk-stok/stok-gudang", featureKey: "inventory.stock" },
      { name: "Log Stok", path: "/persediaan/log-stok" },
    ],
  },
  {
    icon: <PageIcon />,
    name: "Template & Branding",
    subItems: [
      { name: "Template Manager", path: "/template-branding/template-manager" },
      { name: "Brand Settings", path: "/template-branding/brand-settings" },
    ],
  },
  {
    icon: <PieChartIcon />,
    name: "Reporting & Rekap",
    subItems: [
      { name: "Rekap & Reporting", path: "/reporting/rekap" },
    ],
  },
  {
    icon: <PlugInIcon />,
    name: "System & User",
    subItems: [
      { name: "Role & Access", path: "/system-user/role-access" },
      { name: "User Management", path: "/system-user/user-management" },
      { name: "Activity Log", path: "/system-user/activity-log" },
      { name: "Notifikasi User", path: "/system-user/notifications/user" },
      { name: "Notifikasi Sistem", path: "/system-user/notifications/system" },
    ],
  },
];

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered, openMap, toggleGroup, setGroupOpen, setOnlyOpen } = useSidebar();
  const pathname = usePathname();
  const autoOpenedForPathRef = useRef<string | null>(null);
  const touchedOnPathRef = useRef<Record<string, Set<string>>>({});

  const [modulesEnabled, setModulesEnabled] = useState<Record<string, boolean>>(defaultModulesAll);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [invoiceOpenCount, setInvoiceOpenCount] = useState<number | null>(null);
  const [brandInfo, setBrandInfo] = useState<{
    name: string;
    logo: string;
    primaryColor: string;
    secondaryColor: string;
  } | null>(null);

  const fetchActiveBrandModules = useCallback(async () => {
    try {
      // 1) Try the dedicated active-brand endpoint first
      let activeProfile: any | null = null;
      try {
        const activeRes = await fetch("/api/brand-profiles/active", { cache: "no-store" });
        if (activeRes.ok) {
          activeProfile = await activeRes.json();
        } else {
          // Log status/text for debugging but do not throw – we will fallback
          const text = await activeRes.text().catch(() => "");
          console.warn("[AppSidebar] /api/brand-profiles/active non-OK:", activeRes.status, text);
        }
      } catch (e) {
        console.warn("[AppSidebar] /api/brand-profiles/active request error", e);
      }

      // 2) If not found, fallback to the list endpoint and pick the active (or first)
      if (!activeProfile) {
        try {
          const res = await fetch("/api/brand-profiles", { cache: "no-store" });
          let profiles: any[] = [];
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) profiles = data;
            else if (Array.isArray(data?.profiles)) profiles = data.profiles;
            else if (Array.isArray(data?.data)) profiles = data.data;
            else if (data) profiles = [data];
          } else {
            const text = await res.text().catch(() => "");
            console.warn("[AppSidebar] /api/brand-profiles non-OK:", res.status, text);
          }
          activeProfile = profiles.find((p) => p?.isActive) ?? profiles[0] ?? null;
        } catch (e) {
          console.warn("[AppSidebar] /api/brand-profiles request error", e);
        }
      }

      if (activeProfile) {
        const raw: Record<string, boolean> =
          activeProfile?.modules && typeof activeProfile.modules === "object"
            ? (activeProfile.modules as Record<string, boolean>)
            : {};

        // derive top-level first
        const top: Record<ModuleKey, boolean> = {
          sales: Boolean(raw.sales ?? defaultModulesTop.sales),
          purchase: Boolean(raw.purchase ?? defaultModulesTop.purchase),
          inventory: Boolean(raw.inventory ?? defaultModulesTop.inventory),
        };

        const merged: Record<string, boolean> = { ...raw, ...top };
        // ensure feature keys present; default follow top-level state
        (Object.keys(FEATURES_BY_MODULE) as ModuleKey[]).forEach((mk) => {
          FEATURES_BY_MODULE[mk].forEach(({ key }) => {
            if (merged[key] === undefined) merged[key] = top[mk];
          });
        });

        setModulesEnabled(merged);

        // Simpan info brand untuk logo/nama di sidebar
        const normalizedBrand = {
          name: activeProfile?.name ?? "",
          logo: activeProfile?.logo ?? activeProfile?.logoUrl ?? "",
          primaryColor: activeProfile?.primaryColor ?? "#0EA5E9",
          secondaryColor: activeProfile?.secondaryColor ?? "#ECFEFF",
        };
        setBrandInfo(normalizedBrand);
      } else {
        // No brand info available – use defaults so the menu remains usable
        setModulesEnabled(defaultModulesAll);
        setBrandInfo(null);
      }
    } catch (error) {
      console.error("[AppSidebar] Failed to load brand modules:", error);
      setModulesEnabled(defaultModulesAll);
      setBrandInfo(null);
    }
  }, []);

  useEffect(() => {
    fetchActiveBrandModules();
    // Load current user roles to gate menu
    (async () => {
      try {
        const r = await fetch("/api/profile", { cache: "no-store" });
        const j = await r.json();
        if (j?.success && Array.isArray(j?.data?.roles)) setUserRoles(j.data.roles);
      } catch (e) {
        // ignore
      }
    })();

    // Load count of open (unpaid) sales invoices for badge
    (async () => {
      try {
        const r = await fetch("/api/reporting/piutang", { cache: "no-store" });
        if (r.ok) {
          const j = await r.json();
          const c = j?.metrics?.invoiceOpen;
          if (typeof c === "number") setInvoiceOpenCount(c);
        }
      } catch (e) {
        // ignore
      }
    })();

    const handleModulesUpdated = () => {
      fetchActiveBrandModules();
    };

    window.addEventListener("brand-modules:updated", handleModulesUpdated);
    return () => {
      window.removeEventListener("brand-modules:updated", handleModulesUpdated);
    };
  }, [fetchActiveBrandModules]);

  // Dropdown open state disediakan oleh SidebarContext melalui openMap

  const isActive = useCallback(
    (path: string) => {
      if (!path) return false;
      if (pathname === path) return true;
      const normalized = path.endsWith("/") ? path.slice(0, -1) : path;
      return pathname.startsWith(normalized + "/");
    },
    [pathname]
  );


  

  const handleSubmenuToggle = (key: string) => {
    // Tandai bahwa user sudah melakukan toggle pada group di rute saat ini
    if (!touchedOnPathRef.current[pathname]) {
      touchedOnPathRef.current[pathname] = new Set<string>();
    }
    touchedOnPathRef.current[pathname].add(key);

    // Accordion behavior: buka satu, tutup yang lain
    if (!openMap[key]) {
      setOnlyOpen(key);
      console.log("[AppSidebar] open-only", key);
    } else {
      // jika sudah terbuka, tutup
      setGroupOpen(key, false);
      console.log("[AppSidebar] close", key);
    }
  };

  const gatedByModules = useMemo(() => (
    staticNavItems
      .filter((nav) => !nav.moduleKey || modulesEnabled[nav.moduleKey])
      .map((nav) => ({
        ...nav,
        subItems: nav.subItems?.filter(
          (si) => !si.featureKey || modulesEnabled[si.featureKey]
        ),
      }))
  ), [modulesEnabled]);

  const rolesLower = userRoles.map((r) => String(r).toLowerCase());
  const isOwner = rolesLower.includes("owner");
  const isAdmin = rolesLower.includes("admin");
  const isFinance = rolesLower.includes("finance");
  const isWarehouse = rolesLower.includes("warehouse");
  const isStaff = rolesLower.includes("staff");

  const filterByRole = (items: typeof gatedByModules): typeof gatedByModules => {
    if (isOwner) return items; // full access

    return items
      .filter((nav) => {
        // Keep group visible but filter subitems later; hide group only if empty
        // Hide Template & Branding unless Owner or Admin
        if (nav.name === "Template & Branding" && !isAdmin) return false;
        // Hide Finance except Owner, Admin, Finance
        if (nav.name === "Finance" && !(isAdmin || isFinance)) return false;
        // Hide Reporting for Warehouse
        if (nav.name === "Reporting & Rekap" && isWarehouse) return false;
        return true;
      })
      .map((nav) => {
        // Sub-item gating for Warehouse in Penjualan
        if (nav.name === "Penjualan" && isWarehouse && Array.isArray(nav.subItems)) {
          return { ...nav, subItems: nav.subItems.filter((si) => si.name === "Surat Jalan") };
        }
        // System & User: only expose Activity Log for non-owner
        if (nav.name === "System & User" && Array.isArray(nav.subItems)) {
          const filtered = nav.subItems.filter((si) => si.name.startsWith("Activity Log"));
          // If nothing remains, drop the group by returning a sentinel
          return { ...nav, subItems: filtered.length ? filtered : [] } as typeof nav;
        }
        return nav;
      })
      .filter((nav) => {
        if (nav.name === "System & User") {
          return Array.isArray(nav.subItems) && nav.subItems.length > 0;
        }
        return true;
      });
  };

  const navItems = useMemo(
    () => filterByRole(gatedByModules),
    [gatedByModules, isOwner, isAdmin, isFinance, isWarehouse]
  );

  // Grid-based submenu animation removes need to pre-compute heights

  // Auto-open submenu when navigating to a page within it, but don't auto-close manual toggles
  useEffect(() => {
    // Auto-open sekali per perubahan pathname; jangan override kalau user menutup manual
    let matchedKey: string | null = null;
    for (const nav of navItems) {
      if (!nav.subItems) continue;
      if (nav.subItems.some((si) => isActive(si.path))) {
        matchedKey = nav.name;
        break;
      }
    }
    if (matchedKey) {
      const touched = touchedOnPathRef.current[pathname]?.has(matchedKey) ?? false;
      const alreadyAutoOpened = autoOpenedForPathRef.current === pathname;
      if (!touched && !alreadyAutoOpened) {
        setOnlyOpen(matchedKey);
        autoOpenedForPathRef.current = pathname;
        console.log("[AppSidebar] route:", pathname, "auto-open:", matchedKey);
      } else {
        if (touched) {
          console.log("[AppSidebar] route:", pathname, "auto-open suppressed due to manual toggle:", matchedKey);
        } else {
          console.log("[AppSidebar] route:", pathname, "auto-open skipped (already opened):", matchedKey);
        }
      }
    }
  }, [pathname, isActive, navItems, setGroupOpen]);

  return (
    <aside
      className={`fixed mt-16 flex flex-col lg:mt-0 top-0 px-5 left-0 bg-white dark:bg-gray-900 dark:border-gray-800 text-gray-900 h-screen transition-all duration-300 ease-in-out z-[10000] border-r border-gray-200 pointer-events-auto
        ${
          isExpanded || isMobileOpen
            ? "w-[290px]"
            : isHovered
            ? "w-[290px]"
            : "w-[90px]"
        }
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Logo */}
      <div
        className={`py-8 flex  ${
          !isExpanded && !isHovered ? "lg:justify-center" : "justify-start"
        }`}
      >
        <Link href="/">
          {isExpanded || isHovered || isMobileOpen ? (
            brandInfo?.logo ? (
              <Image
                src={brandInfo.logo}
                alt={brandInfo.name || "Brand"}
                width={120}
                height={32}
                className="object-contain"
              />
            ) : (
              <div
                className="flex items-center gap-3"
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold shadow"
                  style={{ backgroundColor: brandInfo?.primaryColor || "#0EA5E9" }}
                >
                  {(brandInfo?.name || "B").charAt(0)}
                </div>
                <span className="text-base font-semibold text-gray-900 dark:text-white">
                  {brandInfo?.name || "Brand"}
                </span>
              </div>
            )
          ) : (
            brandInfo?.logo ? (
              <Image
                src={brandInfo.logo}
                alt={brandInfo.name || "Brand"}
                width={24}
                height={24}
                className="object-contain"
              />
            ) : (
              <Image
                src="/images/logo/logo-icon.svg"
                alt="Logo"
                width={24}
                height={24}
              />
            )
          )}
        </Link>
      </div>

      {/* Menu */}
      <div className="flex flex-col overflow-y-auto duration-300 ease-linear no-scrollbar">
        <nav className="mb-6">
          <div className="flex flex-col gap-4">
            <div>
              <h2
                className={`mb-4 text-xs uppercase flex leading-[20px] text-gray-400 ${
                  !isExpanded && !isHovered ? "lg:justify-center" : "justify-start"
                }`}
              >
                {isExpanded || isHovered || isMobileOpen ? "Menu" : <HorizontaLDots />}
              </h2>
              <ul className="flex flex-col gap-4">
                {navItems.map((nav, index) => (
                  <li key={nav.name}>
                    {nav.subItems ? (
                      <button
                        onClick={() => handleSubmenuToggle(nav.name)}
                        aria-expanded={Boolean(openMap[nav.name])}
                        className={`menu-item group ${
                          openMap[nav.name]
                            ? "menu-item-active"
                            : "menu-item-inactive"
                        } cursor-pointer ${
                          !isExpanded && !isHovered
                            ? "lg:justify-center"
                            : "lg:justify-start"
                        }`}
                      >
                        <span
                          className={`${
                            openMap[nav.name]
                              ? "menu-item-icon-active"
                              : "menu-item-icon-inactive"
                          }`}
                        >
                          {nav.icon}
                        </span>
                        {(isExpanded || isHovered || isMobileOpen) && (
                          <span className="menu-item-text">{nav.name}</span>
                        )}
                        {(isExpanded || isHovered || isMobileOpen) && (
                          <ChevronDownIcon
                            className={`ml-auto w-5 h-5 transition-transform duration-200  ${
                              openMap[nav.name]
                                ? "rotate-180 text-brand-500"
                                : ""
                            }`}
                          />
                        )}
                      </button>
                    ) : (
                      nav.path && (
                        <Link
                          href={nav.path}
                          className={`menu-item group ${
                            isActive(nav.path)
                              ? "menu-item-active"
                              : "menu-item-inactive"
                          }`}
                        >
                          <span
                            className={`${
                              isActive(nav.path)
                                ? "menu-item-icon-active"
                                : "menu-item-icon-inactive"
                            }`}
                          >
                            {nav.icon}
                          </span>
                          {(isExpanded || isHovered || isMobileOpen) && (
                            <span className="menu-item-text">{nav.name}</span>
                          )}
                        </Link>
                      )
                    )}

                    {/* Submenu */}
                    {nav.subItems && (isExpanded || isHovered || isMobileOpen) && (
                      <div
                        className={`grid transition-[grid-template-rows] duration-300 ${
                          openMap[nav.name] ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                        }`}
                        aria-hidden={openMap[nav.name] ? "false" : "true"}
                      >
                        <div className="overflow-hidden">
                          <ul className="mt-2 space-y-1 ml-9">
                            {nav.subItems.map((subItem) => (
                              <li key={subItem.name}>
                                {(() => {
                                  const active = isActive(subItem.path);
                                  const baseCls = `menu-dropdown-item ${
                                    active ? "menu-dropdown-item-active" : "menu-dropdown-item-inactive"
                                  }`;
                                  const showInvoiceBadge =
                                    subItem.name === "Invoice Penjualan" && typeof invoiceOpenCount === "number" && invoiceOpenCount > 0;
                                  return (
                                    <Link href={subItem.path} className={baseCls}>
                                      <span className="flex-1">{subItem.name}</span>
                                      {showInvoiceBadge && (
                                        <span className={`menu-dropdown-badge ${
                                          active ? "menu-dropdown-badge-active" : "menu-dropdown-badge-inactive"
                                        }`}>{invoiceOpenCount}</span>
                                      )}
                                    </Link>
                                  );
                                })()}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
    </nav>
      </div>

    </aside>
  );
};

export default AppSidebar;
