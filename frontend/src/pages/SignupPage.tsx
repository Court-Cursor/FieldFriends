import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";

export function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    try {
      await signup(email, password);
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Signup failed");
    }
  }

  return (
    <section className="panel auth-panel">
      <h1>Create an account</h1>
      <p style={{ color: "#6b7280", margin: 0 }}>Join FieldFriends and start playing</p>
      <form onSubmit={onSubmit} className="form">
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            minLength={8}
            required
          />
        </label>
        <button type="submit">Create account</button>
        {error ? <p className="error">{error}</p> : null}
      </form>
      <p className="auth-footer">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </section>
  );
}
