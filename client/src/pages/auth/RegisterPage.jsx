import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Mail, Lock, User, Phone, UserPlus, Check } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { registerSchema } from "../../lib/validations";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Alert } from "../../components/ui/Alert";

export const RegisterPage = () => {
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
      terms: false,
    },
  });

  const password = watch("password");

  const onSubmit = async (data) => {
    setError("");
    try {
      const { confirmPassword, terms, ...userData } = data;
      await registerUser(userData);
      navigate("/dashboard");
    } catch (err) {
      setError(
        err.response?.data?.message || "Registration failed. Please try again.",
      );
    }
  };

  const passwordChecks = [
    { label: "8+ characters", valid: password?.length >= 8 },
    { label: "Uppercase letter", valid: /[A-Z]/.test(password || "") },
    { label: "Lowercase letter", valid: /[a-z]/.test(password || "") },
    { label: "Number", valid: /\d/.test(password || "") },
    { label: "Special character", valid: /[@$!%*?&#]/.test(password || "") },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-900">
      <div className="w-full max-w-2xl">
        <Link to="/" className="flex items-center justify-center gap-2 mb-8">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
            <span className="text-white font-bold">B</span>
          </div>
          <span className="text-xl font-bold">SecureBank</span>
        </Link>

        <div className="card p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold tracking-tight">
              Create your account
            </h1>
            <p className="mt-2 text-slate-500">
              Get started with SecureBank in minutes
            </p>
          </div>

          {error && (
            <Alert variant="error" className="mb-6" dismissible>
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Input
                label="First name"
                placeholder="John"
                icon={User}
                error={errors.firstName}
                {...register("firstName")}
              />
              <Input
                label="Last name"
                placeholder="Doe"
                icon={User}
                error={errors.lastName}
                {...register("lastName")}
              />
            </div>

            <Input
              label="Email address"
              type="email"
              placeholder="you@example.com"
              icon={Mail}
              autoComplete="email"
              error={errors.email}
              {...register("email")}
            />

            <Input
              label="Phone number"
              type="tel"
              placeholder="+1 234 567 8900"
              icon={Phone}
              autoComplete="tel"
              error={errors.phone}
              {...register("phone")}
            />

            <div>
              <Input
                label="Password"
                type="password"
                placeholder="Create a strong password"
                icon={Lock}
                autoComplete="new-password"
                error={errors.password}
                {...register("password")}
              />
              {password && (
                <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-2">
                  {passwordChecks.map((check) => (
                    <div
                      key={check.label}
                      className={`flex items-center gap-1.5 text-xs ${
                        check.valid ? "text-success-500" : "text-slate-400"
                      }`}
                    >
                      <Check
                        className={`h-3.5 w-3.5 ${
                          check.valid ? "opacity-100" : "opacity-30"
                        }`}
                      />
                      {check.label}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Input
              label="Confirm password"
              type="password"
              placeholder="Re-enter your password"
              icon={Lock}
              autoComplete="new-password"
              error={errors.confirmPassword}
              {...register("confirmPassword")}
            />

            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="terms"
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                {...register("terms")}
              />
              <label
                htmlFor="terms"
                className="text-sm text-slate-600 dark:text-slate-300"
              >
                I agree to the{" "}
                <Link to="/terms" className="link">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link to="/privacy" className="link">
                  Privacy Policy
                </Link>
              </label>
            </div>
            {errors.terms && (
              <p className="text-xs text-danger-500">{errors.terms.message}</p>
            )}

            <Button
              type="submit"
              className="w-full"
              size="lg"
              isLoading={isSubmitting}
              leftIcon={UserPlus}
            >
              Create account
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Already have an account?{" "}
            <Link to="/login" className="link">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
