"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth/auth-context";

const schema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required")
});

type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { username: "", password: "" }
  });

  const { login } = useAuth();

  const onSubmit = async (values: FormValues) => {
    try {
      setFormError(null);
      await login(values.username, values.password);
      router.push(searchParams.get("redirectTo") ?? "/home");
    } catch (error) {
      setFormError((error as Error)?.message ?? "Invalid credentials");
    }
  };

  return (
    <div className="glass-surface rounded-3xl border border-border/30 bg-card/80 px-12 py-14 shadow-card backdrop-blur-xl">
      {/* Header Section - Clear Visual Hierarchy */}
      <div className="mb-10 text-center">
        <div className="mb-8">
          <p className="text-5xl font-bold uppercase tracking-wide text-primary">LORE</p>
        </div>
        <h1 className="text-2xl font-semibold leading-tight text-foreground">
          Sign in to your library
        </h1>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          Stream your audiobooks anywhere, anytime.
        </p>
      </div>

      {/* Form Section - Generous Spacing */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Username Field */}
        <div className="space-y-2.5">
          <label htmlFor="username" className="block text-sm font-medium text-foreground">
            Username
          </label>
          <Input
            id="username"
            autoComplete="username"
            placeholder="Username"
            className="h-12 text-base"
            {...register("username")}
          />
          {errors.username ? (
            <p className="text-sm text-destructive">{errors.username.message}</p>
          ) : null}
        </div>

        {/* Password Field */}
        <div className="space-y-2.5">
          <label htmlFor="password" className="block text-sm font-medium text-foreground">
            Password
          </label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            className="h-12 text-base"
            {...register("password")}
          />
          {errors.password ? (
            <p className="text-sm text-destructive">{errors.password.message}</p>
          ) : null}
        </div>

        {/* Error Message */}
        {formError ? (
          <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
            {formError}
          </div>
        ) : null}

        {/* Submit Button - Prominent CTA */}
        <Button
          type="submit"
          className="h-12 w-full text-base font-medium"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Signing in...
            </>
          ) : (
            "Sign in"
          )}
        </Button>
      </form>

      {/* Help Text - Clear Separation */}
      <div className="mt-8 border-t border-border/20 pt-6 text-center">
        <p className="text-sm text-muted-foreground">
          Need an account? Contact your administrator.
        </p>
      </div>
    </div>
  );
}
