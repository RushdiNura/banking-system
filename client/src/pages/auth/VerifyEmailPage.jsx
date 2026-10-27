import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { authService } from "../../services/authService";
import { Button } from "../../components/ui/Button";

export const VerifyEmailPage = () => {
  const { token } = useParams();
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    const verify = async () => {
      try {
        await authService.verifyEmail(token);
        setStatus("success");
      } catch {
        setStatus("error");
      }
    };
    verify();
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-900">
      <div className="card p-8 max-w-md w-full text-center">
        {status === "loading" && (
          <>
            <Loader2 className="h-12 w-12 text-primary-500 animate-spin mx-auto" />
            <h1 className="mt-4 text-2xl font-bold">Verifying your email...</h1>
          </>
        )}
        {status === "success" && (
          <>
            <div className="mx-auto h-12 w-12 rounded-full bg-success-50 flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-success-500" />
            </div>
            <h1 className="mt-4 text-2xl font-bold">Email verified!</h1>
            <p className="mt-2 text-slate-500">
              Your email has been verified successfully.
            </p>
            <Link to="/login" className="mt-6 inline-block">
              <Button>Continue to login</Button>
            </Link>
          </>
        )}
        {status === "error" && (
          <>
            <div className="mx-auto h-12 w-12 rounded-full bg-danger-50 flex items-center justify-center">
              <XCircle className="h-6 w-6 text-danger-500" />
            </div>
            <h1 className="mt-4 text-2xl font-bold">Verification failed</h1>
            <p className="mt-2 text-slate-500">
              The verification link is invalid or has expired.
            </p>
            <Link to="/login" className="mt-6 inline-block">
              <Button variant="outline">Back to login</Button>
            </Link>
          </>
        )}
      </div>
    </div>
  );
};
