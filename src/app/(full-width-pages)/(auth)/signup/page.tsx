import SignUpForm from "@/components/auth/SignUpForm";
import { Metadata } from "next";

// Ensure server and client render the same fresh markup
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign Up | Bakung Dashboard",
  description:
    "Create a Bakung Dashboard account and collaborate across HDP Works brands.",
};

export default function SignUp() {
  return <SignUpForm />;
}
