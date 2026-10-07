import type { Metadata } from "next";
import { AuthCard } from "@/components/auth-card";
import { ForgotForm } from "./forgot-form";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <AuthCard title="Forgot password" subtitle="We email a 6 digit code to the address on your account.">
      <ForgotForm />
    </AuthCard>
  );
}
