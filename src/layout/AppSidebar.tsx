"use client";
import React, { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSidebar } from "../context/SidebarContext";
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
} from "../icons/index";

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
      { name: "User Management", path: "/system-user/user-management" },
      { name: "Role & Access", path: "/system-user/role-access" },
      { name: "Activity Log / Notifications", path: "/system-user/activity-log" },
    ],
  },
];

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const pathname = usePathname();

  const [modulesEnabled, setModulesEnabled] = useState<Record<string, boolean>>(defaultModulesAll);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [brandInfo, setBrandInfo] = useState<{
    name: string;
    logo: string;
    primaryColor: string;
    secondaryColor: string;
  } | null>(null);

  const fetchActiveBrandModules = useCallback(async () => {
    try {
      const response = await fetch("/api/brand-profiles");
      if (!response.ok) {
        throw new Error("Failed to fetch brand profiles");
      }
      const data = await response.json();
      let profiles: any[] = [];

      if (Array.isArray(data)) {
        profiles = data;
      } else if (Array.isArray(data?.profiles)) {
        profiles = data.profiles;
      } else if (Array.isArray(data?.data)) {
        profiles = data.data;
      } else if (data) {
        profiles = [data];
      }

      const activeProfile =
        profiles.find((profile) => profile?.isActive) ?? profiles[0] ?? null;

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

    const handleModulesUpdated = () => {
      fetchActiveBrandModules();
    };

    window.addEventListener("brand-modules:updated", handleModulesUpdated);
    return () => {
      window.removeEventListener("brand-modules:updated", handleModulesUpdated);
    };
  }, [fetchActiveBrandModules]);

  const [openSubmenu, setOpenSubmenu] = useState<{
    index: number;
  } | null>(null);

  const [subMenuHeight, setSubMenuHeight] = useState<Record<string, number>>({});
  const subMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const isActive = useCallback((path: string) => path === pathname, [pathname]);

  useEffect(() => {
    let submenuMatched = false;
    const filteredNav = staticNavItems
      .filter((nav) => !nav.moduleKey || modulesEnabled[nav.moduleKey])
      .map((nav) => ({
        ...nav,
        subItems: nav.subItems?.filter(
          (si) => !si.featureKey || modulesEnabled[si.featureKey]
        ),
      }));

    filteredNav.forEach((nav, index) => {
      if (nav.subItems) {
        nav.subItems.forEach((subItem) => {
          if (isActive(subItem.path)) {
            setOpenSubmenu({ index });
            submenuMatched = true;
          }
        });
      }
    });
    if (!submenuMatched) setOpenSubmenu(null);
  }, [pathname, isActive, modulesEnabled]);

  useEffect(() => {
    if (openSubmenu !== null) {
      const key = `main-${openSubmenu.index}`;
      if (subMenuRefs.current[key]) {
        setSubMenuHeight((prevHeights) => ({
          ...prevHeights,
          [key]: subMenuRefs.current[key]?.scrollHeight || 0,
        }));
      }
    }
  }, [openSubmenu]);

  const handleSubmenuToggle = (index: number) => {
    setOpenSubmenu((prev) =>
      prev && prev.index === index ? null : { index }
    );
  };

  const gatedByModules = staticNavItems
    .filter((nav) => !nav.moduleKey || modulesEnabled[nav.moduleKey])
    .map((nav) => ({
      ...nav,
      subItems: nav.subItems?.filter(
        (si) => !si.featureKey || modulesEnabled[si.featureKey]
      ),
    }));

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
          const filtered = nav.subItems.filter((si) => si.name === "Activity Log / Notifications");
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

  const navItems = filterByRole(gatedByModules);

  return (
    <aside
      className={`fixed mt-16 flex flex-col lg:mt-0 top-0 px-5 left-0 bg-white dark:bg-gray-900 dark:border-gray-800 text-gray-900 h-screen transition-all duration-300 ease-in-out z-50 border-r border-gray-200 
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
                        onClick={() => handleSubmenuToggle(index)}
                        className={`menu-item group ${
                          openSubmenu?.index === index
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
                            openSubmenu?.index === index
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
                              openSubmenu?.index === index
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
                        ref={(el) => {
                          subMenuRefs.current[`main-${index}`] = el;
                        }}
                        className="overflow-hidden transition-all duration-300"
                        style={{
                          height:
                            openSubmenu?.index === index
                              ? `${subMenuHeight[`main-${index}`]}px`
                              : "0px",
                        }}
                      >
                        <ul className="mt-2 space-y-1 ml-9">
                          {nav.subItems.map((subItem) => (
                            <li key={subItem.name}>
                              <Link
                                href={subItem.path}
                                className={`menu-dropdown-item ${
                                  isActive(subItem.path)
                                    ? "menu-dropdown-item-active"
                                    : "menu-dropdown-item-inactive"
                                }`}
                              >
                                {subItem.name}
                              </Link>
                            </li>
                          ))}
                        </ul>
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
