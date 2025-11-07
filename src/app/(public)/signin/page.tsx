import SignInForm from "@/components/auth/SignInForm";
import { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign In | Bakung Dashboard",
  description:
    "Access your Bakung Dashboard account to manage multi-brand operations for HDP Works.",
};

export default function SignIn() {
  return <SignInForm />;
}
