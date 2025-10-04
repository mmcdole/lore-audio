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
    <div className="glass-surface rounded-3xl border border-border/30 bg-card/80 p-8 shadow-card backdrop-blur-xl">
      <div className="mb-6 text-center">
        <p className="text-xs uppercase tracking-widest text-primary">Flix Audio</p>
        <h1 className="mt-3 text-3xl font-semibold text-foreground">Sign in to your library</h1>
        <p className="mt-2 text-sm text-muted-foreground">Stream your audiobooks anywhere, anytime.</p>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="space-y-2">
          <label htmlFor="username" className="text-sm font-medium text-foreground">
            Username
          </label>
          <Input id="username" autoComplete="username" placeholder="Username" {...register("username")} />
          {errors.username ? <p className="text-xs text-destructive">{errors.username.message}</p> : null}
        </div>
        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium text-foreground">
            Password
          </label>
          <Input id="password" type="password" autoComplete="current-password" placeholder="••••••••" {...register("password")} />
          {errors.password ? <p className="text-xs text-destructive">{errors.password.message}</p> : null}
        </div>
        {formError ? <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{formError}</p> : null}
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in...
            </>
          ) : (
            "Sign in"
          )}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Need an account? Contact your administrator.
      </p>
    </div>
  );
}
