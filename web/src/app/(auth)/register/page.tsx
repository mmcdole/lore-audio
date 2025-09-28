"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const schema = z
  .object({
    username: z.string().min(3, "Minimum 3 characters"),
    password: z.string().min(8, "Minimum 8 characters"),
    confirmPassword: z.string().min(8, "Confirm your password"),
    inviteCode: z.string().optional()
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"]
  });

type FormValues = z.infer<typeof schema>;

export default function RegisterPage() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { inviteCode: "" }
  });

  const onSubmit = async (_values: FormValues) => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    router.push("/login?registered=true");
  };

  return (
    <div className="glass-surface rounded-3xl border border-border/30 bg-card/80 p-8 shadow-card backdrop-blur-xl">
      <div className="mb-6 text-center">
        <p className="text-xs uppercase tracking-widest text-primary">Flix Audio</p>
        <h1 className="mt-3 text-3xl font-semibold text-foreground">Create your account</h1>
        <p className="mt-2 text-sm text-muted-foreground">Access the full Flix Audio catalog in seconds.</p>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="space-y-2">
          <label htmlFor="username" className="text-sm font-medium text-foreground">
            Username
          </label>
          <Input id="username" placeholder="alex.mercer" {...register("username")} />
          {errors.username ? <p className="text-xs text-destructive">{errors.username.message}</p> : null}
        </div>
        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium text-foreground">
            Password
          </label>
          <Input id="password" type="password" autoComplete="new-password" {...register("password")} />
          {errors.password ? <p className="text-xs text-destructive">{errors.password.message}</p> : null}
        </div>
        <div className="space-y-2">
          <label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">
            Confirm password
          </label>
          <Input id="confirmPassword" type="password" autoComplete="new-password" {...register("confirmPassword")} />
          {errors.confirmPassword ? <p className="text-xs text-destructive">{errors.confirmPassword.message}</p> : null}
        </div>
        <div className="space-y-2">
          <label htmlFor="inviteCode" className="text-sm font-medium text-foreground">
            Invite code (optional)
          </label>
          <Input id="inviteCode" placeholder="INVITE-123" {...register("inviteCode")} />
        </div>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating account...
            </>
          ) : (
            "Create account"
          )}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account? <Link href="/login" className="text-primary hover:text-primary/80">Sign in</Link>
      </p>
    </div>
  );
}
