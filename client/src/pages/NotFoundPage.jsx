import { Link } from "react-router-dom";
import { Home, ArrowLeft } from "lucide-react";
import { Button } from "../components/ui/Button";

export const NotFoundPage = () => (
  <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-900">
    <div className="text-center">
      <h1 className="text-9xl font-bold bg-gradient-to-r from-primary-500 to-primary-700 bg-clip-text text-transparent">
        404
      </h1>
      <h2 className="mt-4 text-2xl font-bold">Page not found</h2>
      <p className="mt-2 text-slate-500 max-w-md mx-auto">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <div className="mt-8 flex gap-3 justify-center">
        <Link to="/dashboard">
          <Button leftIcon={Home}>Back to Dashboard</Button>
        </Link>
        <Button
          variant="outline"
          leftIcon={ArrowLeft}
          onClick={() => window.history.back()}
        >
          Go Back
        </Button>
      </div>
    </div>
  </div>
);
