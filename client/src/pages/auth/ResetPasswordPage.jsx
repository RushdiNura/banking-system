import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Lock, CheckCircle } from "lucide-react";
import { authService } from "../../services/authService";
import { changePasswordSchema } from "../../lib/validations";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Alert } from "../../components/ui/Alert";

export const ResetPasswordPage = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(changePasswordSchema.omit({ currentPassword: true })),
  });

  const onSubmit = async (data) => {
    setError("");
    try {
      await authService.resetPassword(token, data.newPassword);
      setSuccess(true);
      setTimeout(() => navigate("/login"), 3000);
    } catch (err) {
      setError(err.response?.data?.message || "Password reset failed");
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-900">
        <div className="card p-8 max-w-md w-full text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-success-50 dark:bg-success-700/20 flex items-center justify-center">
            <CheckCircle className="h-6 w-6 text-success-500" />
          </div>
          <h1 className="mt-4 text-2xl font-bold">Password reset successful</h1>
          <p className="mt-2 text-slate-500">
            Your password has been updated. Redirecting to login...
          </p>
          <Link to="/login" className="mt-6 inline-block">
            <Button>Go to login</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-900">
      <div className="card p-8 max-w-md w-full">
        <h1 className="text-2xl font-bold">Reset your password</h1>
        <p className="mt-2 text-sm text-slate-500">
          Enter a new password for your account.
        </p>

        {error && (
          <Alert variant="error" className="mt-6" dismissible>
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-5">
          <Input
            label="New password"
            type="password"
            placeholder="Enter new password"
            icon={Lock}
            error={errors.newPassword}
            {...register("newPassword")}
          />
          <Input
            label="Confirm password"
            type="password"
            placeholder="Confirm new password"
            icon={Lock}
            error={errors.confirmPassword}
            {...register("confirmPassword")}
          />
          <Button
            type="submit"
            className="w-full"
            size="lg"
            isLoading={isSubmitting}
          >
            Reset password
          </Button>
        </form>
      </div>
    </div>
  );
};
