import type { Metadata } from "next";
import { AuthCard } from "@/components/auth-card";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Register" };

export default function RegisterPage() {
  return (
    <AuthCard
      title="New student registration"
      subtitle="Create your account and try the free demo. Full access opens when the institute approves your admission."
    >
      <RegisterForm />
    </AuthCard>
  );
}
