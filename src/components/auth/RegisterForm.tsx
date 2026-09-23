import { useState, type FormEvent } from "react";
import { User, Mail, Lock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useMagnetic } from "@/hooks/use-magnetic";
import { AuthField } from "./AuthField";
import "./AuthForm.css";

interface RegisterFormProps {
  onSwitchToLogin: () => void;
}

export function RegisterForm({ onSwitchToLogin }: RegisterFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const magnetic = useMagnetic<HTMLDivElement>({ strength: 10 });

  // Only mismatch needs custom checking — everything else (empty, too-short
  // password) is native `required`/`minLength`, which blocks the submit event
  // before this handler ever runs.
  const mismatch = confirmPassword.length > 0 && password !== confirmPassword;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }

    setSubmitting(true);
    try {
      const redirectUrl = `${window.location.origin}/`;
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: redirectUrl, data: { name } },
      });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Account created! You can now sign in.");
        setPassword("");
        setConfirmPassword("");
        onSwitchToLogin();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error creating account");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-form">
      <h1 className="auth-form__title">Create account</h1>
      <form className="auth-form__body" aria-label="Sign up" onSubmit={handleSubmit}>
        <AuthField
          label="Name"
          name="name"
          icon={User}
          autoComplete="name"
          minLength={3}
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={submitting}
          previewText="Ada Lovelace"
          required
        />
        <AuthField
          label="Email address"
          type="email"
          name="email"
          icon={Mail}
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={submitting}
          previewText="you@example.com"
          required
        />
        <AuthField
          label="Password"
          type="password"
          name="password"
          icon={Lock}
          autoComplete="new-password"
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={submitting}
          previewText="hunter22"
          required
        />
        <AuthField
          label="Confirm password"
          type="password"
          name="confirmPassword"
          icon={Lock}
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          error={mismatch ? "Passwords don't match" : undefined}
          disabled={submitting}
          previewText="hunter22"
          required
        />
        <div
          ref={magnetic.ref}
          className="auth-form__submit-wrap"
          onMouseMove={magnetic.onMouseMove}
          onMouseLeave={magnetic.onMouseLeave}
        >
          <Button
            type="submit"
            className="auth-form__submit cp-pill cp-lift cp-accent-bg text-white"
            disabled={submitting || mismatch}
          >
            {submitting && <Loader2 size={16} className="animate-spin" />}
            {submitting ? "Creating account…" : "Sign up"}
          </Button>
        </div>
      </form>
    </div>
  );
}
