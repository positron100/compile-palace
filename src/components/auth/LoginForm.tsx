import { useState, type FormEvent } from "react";
import { Mail, Lock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useMagnetic } from "@/hooks/use-magnetic";
import { AuthField } from "./AuthField";
import "./AuthForm.css";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const magnetic = useMagnetic<HTMLDivElement>({ strength: 10 });

  // Native `required` blocks the submit event (and shows the browser's own
  // validation bubble) before this ever runs, so empty fields never reach here.
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Signed in successfully!");
        // Don't navigate here — Auth.tsx's own effect (watching `user` from
        // AuthContext) is the single source of truth for the post-login
        // redirect. Navigating from both places raced two view-transitions
        // against each other and the browser silently skipped one.
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error signing in");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-form">
      <h1 className="auth-form__title">Log in</h1>
      <form className="auth-form__body" aria-label="Log in" onSubmit={handleSubmit}>
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
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
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
            disabled={submitting}
          >
            {submitting && <Loader2 size={16} className="animate-spin" />}
            {submitting ? "Logging in…" : "Log in"}
          </Button>
        </div>
      </form>
    </div>
  );
}
