import React from 'react';
import { Head, useForm } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AuthLayout from '@/layouts/auth-layout';

export default function SetPassword({ token, email }: { token: string; email: string }) {
  const { data, setData, post, processing, errors } = useForm({
    token: token,
    password: '',
    password_confirmation: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    post('/set-password');
  };

  return (
    <AuthLayout
      title="Definir votre mot de passe"
      description={`Creez un mot de passe securise pour le compte ${email}`}
    >
      <Head title="Définir votre mot de passe" />
      <div className="space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Nouveau mot de passe</Label>
            <Input
              id="password"
              type="password"
              value={data.password}
              onChange={(e) => setData('password', e.target.value)}
              placeholder="Entrez votre mot de passe"
              required
            />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password_confirmation">Confirmer le mot de passe</Label>
            <Input
              id="password_confirmation"
              type="password"
              value={data.password_confirmation}
              onChange={(e) => setData('password_confirmation', e.target.value)}
              placeholder="Confirmez votre mot de passe"
              required
            />
            {errors.password_confirmation && (
              <p className="text-sm text-destructive">{errors.password_confirmation}</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={processing}>
            {processing ? 'Enregistrement...' : 'Definir le mot de passe'}
          </Button>
        </form>
      </div>
    </AuthLayout>
  );
}
