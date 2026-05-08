"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { login } from "@/lib/api";
import Notification from "@/components/ui/Notification";
import styles from "./LoginForm.module.css";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState({ message: "", type: "" });

  const closeNotification = () => {
    setNotification({ message: "", type: "" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setNotification({ message: "", type: "" });
    setIsLoading(true);

    try {
      await login(email, password);
      setNotification({ message: "Login successful! Redirecting...", type: "success" });
      setTimeout(() => {
        router.replace("/");
      }, 1000);
    } catch (err) {
      setNotification({ message: err.message || "Failed to login. Please check your credentials.", type: "error" });
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.formContainer}>
      <Notification 
        message={notification.message} 
        type={notification.type} 
        onClose={closeNotification} 
      />
      <h2 className={styles.title}>Login</h2>
      
      <form onSubmit={handleSubmit}>
        <div className={styles.formGroup}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••••"
          />
        </div>

        <button type="submit" className={styles.button} disabled={isLoading}>
          {isLoading ? "Logging in..." : "Login"}
        </button>
      </form>

      <p className={styles.authSwitch}>
        Don&apos;t have an account? <Link href="/register">Register</Link>
      </p>
    </div>
  );
}
