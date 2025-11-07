import dynamic from "next/dynamic";
import { Metadata } from "next";

// Hindari pre-render statis agar HTML server dan client selalu selaras
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign In | Bakung Dashboard",
  description:
    "Access your Bakung Dashboard account to manage multi-brand operations for HDP Works.",
};

// Render SignInForm hanya di client untuk mencegah SSR mismatch
const SignInForm = dynamic(() => import("@/components/auth/SignInForm"), { ssr: false });

export default function SignIn() {
  return <SignInForm />;
}
