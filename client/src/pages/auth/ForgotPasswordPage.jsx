import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Mail, ArrowLeft, Send } from "lucide-react";
import { authService } from "../../services/authService";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Alert } from "../../components/ui/Alert";

const schema = z.object({
  email: z.string().email("Invalid email address"),
});

export const ForgotPasswordPage = () => {
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (data) => {
    try {
      await authService.forgotPassword(data.email);
      setSuccess(true);
    } catch (err) {
      // Always show success to prevent email enumeration
      setSuccess(true);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-900">
      <div className="w-full max-w-md">
        <Link
          to="/login"
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-6"
        >
          <ArrowLeft className="h-4 w-4" /> Back to login
        </Link>

        <div className="card p-8">
          {success ? (
            <div className="text-center">
              <div className="mx-auto h-12 w-12 rounded-full bg-success-50 dark:bg-success-700/20 flex items-center justify-center">
                <Mail className="h-6 w-6 text-success-500" />
              </div>
              <h1 className="mt-4 text-2xl font-bold">Check your email</h1>
              <p className="mt-2 text-slate-500">
                If an account exists with that email, we've sent password reset
                instructions.
              </p>
              <Link to="/login" className="mt-6 inline-block">
                <Button variant="outline">Back to login</Button>
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold">Forgot password?</h1>
              <p className="mt-2 text-sm text-slate-500">
                Enter your email address and we'll send you a link to reset your
                password.
              </p>

              <form
                onSubmit={handleSubmit(onSubmit)}
                className="mt-6 space-y-5"
              >
                <Input
                  label="Email address"
                  type="email"
                  placeholder="you@example.com"
                  icon={Mail}
                  autoComplete="email"
                  error={errors.email}
                  {...register("email")}
                />

                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  isLoading={isSubmitting}
                  leftIcon={Send}
                >
                  Send reset link
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
