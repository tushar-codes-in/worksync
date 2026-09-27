'use client';
import { Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const schema = z.object({
  password: z
    .string()
    .min(8)
    .refine((p) => /[A-Z]/.test(p), 'Needs an uppercase letter')
    .refine((p) => /[a-z]/.test(p), 'Needs a lowercase letter')
    .refine((p) => /[0-9]/.test(p), 'Needs a number'),
});
type FormValues = z.infer<typeof schema>;

function ResetPasswordInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormValues) => {
    try {
      await api('/api/auth/reset-password', {
        method: 'POST',
        body: { token, password: data.password },
        skipAuth: true,
      });
      toast.success('Password reset — you can now log in');
      router.replace('/login');
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Set a new password</CardTitle>
        <CardDescription>Choose a strong password you don&apos;t use elsewhere.</CardDescription>
      </CardHeader>
      <CardContent>
        {!token ? (
          <p className="text-sm text-destructive">Missing reset token. Use the link from your email.</p>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <Input id="password" type="password" autoComplete="new-password" {...register('password')} />
              {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Reset password'}
            </Button>
          </form>
        )}
        <p className="mt-4 text-center text-sm text-muted-foreground">
          <Link href="/login" className="underline">Back to login</Link>
        </p>
      </CardContent>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="container flex min-h-screen items-center justify-center">
      <Suspense fallback={<div className="text-muted-foreground">Loading…</div>}>
        <ResetPasswordInner />
      </Suspense>
    </main>
  );
}
