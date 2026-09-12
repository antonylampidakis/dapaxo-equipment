import { useState } from "react";
import type { FormEvent } from "react";
import { supabase } from "../lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setErrorMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error(error);
      setErrorMessage("Λάθος email ή κωδικός πρόσβασης.");
      setLoading(false);
      return;
    }

    setLoading(false);
  }

  return (
    <main>
      <h1>ΔΑΠΑΧΟ</h1>
      <h2>Διαχείριση Εξοπλισμού</h2>

      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="email">Email</label>
          <br />

          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="email"
          />
        </div>

        <br />

        <div>
          <label htmlFor="password">Κωδικός πρόσβασης</label>
          <br />

          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoComplete="current-password"
          />
        </div>

        <br />

        {errorMessage && (
          <p role="alert">{errorMessage}</p>
        )}

        <button type="submit" disabled={loading}>
          {loading ? "Σύνδεση..." : "Σύνδεση"}
        </button>
      </form>
    </main>
  );
}