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

const schema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(6, "Minimum 6 characters"),
  rememberMe: z.boolean().optional()
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
    defaultValues: { username: "", password: "", rememberMe: false }
  });

  const onSubmit = async (values: FormValues) => {
    try {
      setFormError(null);
      // TODO: integrate with backend authentication API
      await new Promise((resolve) => setTimeout(resolve, 800));
      router.push(searchParams.get("redirectTo") ?? "/home");
    } catch (error) {
      setFormError((error as Error)?.message ?? "Unable to sign in");
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
          <Input id="username" autoComplete="username" placeholder="alex.mercer" {...register("username")} />
          {errors.username ? <p className="text-xs text-destructive">{errors.username.message}</p> : null}
        </div>
        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium text-foreground">
            Password
          </label>
          <Input id="password" type="password" autoComplete="current-password" placeholder="••••••••" {...register("password")} />
          {errors.password ? <p className="text-xs text-destructive">{errors.password.message}</p> : null}
        </div>
        <div className="flex items-center justify-between text-sm">
          <label className="inline-flex items-center gap-2 text-muted-foreground">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-border/60 bg-background text-primary focus:ring-primary"
              {...register("rememberMe")}
            />
            Remember me
          </label>
          <Link href="/forgot-password" className="text-primary hover:text-primary/80">
            Forgot password?
          </Link>
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
        New here? <Link href="/register" className="text-primary hover:text-primary/80">Create an account</Link>
      </p>
    </div>
  );
}
