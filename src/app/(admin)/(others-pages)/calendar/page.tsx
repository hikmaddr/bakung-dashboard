import Calendar from "@/components/calendar/Calendar";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Calendar | Bakung Dashboard",
  description:
    "Plan and track activities for every HDP Works brand with the Bakung Dashboard calendar.",
};
export default function page() {
  return (
    <div>
      <PageBreadcrumb pageTitle="Calendar" />
      <Calendar />
    </div>
  );
}
