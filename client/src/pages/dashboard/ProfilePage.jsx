import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Camera,
  Save,
  User,
  Mail,
  Phone,
  Upload,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Trash2,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../../contexts/AuthContext";
import { authService } from "../../services/authService";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { getInitials, getStatusColor } from "../../lib/utils";

const profileSchema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  phone: z.string().min(10),
  occupation: z.string().optional(),
  annualIncome: z.number().optional(),
});

const DOCUMENT_TYPES = [
  { value: "id_proof", label: "Government ID (Passport / License)" },
  {
    value: "address_proof",
    label: "Address Proof (Utility Bill / Bank Statement)",
  },
  { value: "income_proof", label: "Income Proof (Pay Slip / Tax Return)" },
  { value: "signature", label: "Signature" },
  { value: "other", label: "Other" },
];

export const ProfilePage = () => {
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const [profilePic, setProfilePic] = useState(null);
  const [kycFiles, setKycFiles] = useState([]); // [{ file, type }]
  const fileInputRef = useRef(null);
  const kycInputRef = useRef(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      phone: user?.phone || "",
      occupation: user?.occupation || "",
      annualIncome: user?.annualIncome || 0,
    },
  });

  const updateMutation = useMutation({
    mutationFn: authService.updateProfile,
    onSuccess: async () => {
      await refreshUser();
      queryClient.invalidateQueries({ queryKey: ["user"] });
      toast.success("Profile updated successfully");
    },
    onError: (err) =>
      toast.error(err.response?.data?.message || "Update failed"),
  });

  const uploadMutation = useMutation({
    mutationFn: authService.uploadProfilePicture,
    onSuccess: async () => {
      await refreshUser();
      toast.success("Profile picture updated");
      setProfilePic(null);
    },
    onError: (err) =>
      toast.error(err.response?.data?.message || "Upload failed"),
  });

  const kycMutation = useMutation({
    mutationFn: ({ files, types }) => authService.uploadKYC(files, types),
    onSuccess: async () => {
      await refreshUser();
      setKycFiles([]);
      toast.success("KYC documents uploaded — pending review");
    },
    onError: (err) =>
      toast.error(err.response?.data?.message || "KYC upload failed"),
  });

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }
    setProfilePic({ file, preview: URL.createObjectURL(file) });
  };

  const handleUpload = () => {
    if (profilePic?.file) uploadMutation.mutate(profilePic.file);
  };

  const handleKYCFileAdd = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newFiles = files.map((file) => ({
      file,
      type: "id_proof",
      preview: file.type.startsWith("image/")
        ? URL.createObjectURL(file)
        : null,
    }));

    setKycFiles((prev) => [...prev, ...newFiles]);
    if (kycInputRef.current) kycInputRef.current.value = "";
  };

  const updateKYCFileType = (index, type) => {
    setKycFiles((prev) =>
      prev.map((item, i) => (i === index ? { ...item, type } : item)),
    );
  };

  const removeKYCFile = (index) => {
    setKycFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleKYCSubmit = () => {
    if (kycFiles.length === 0) {
      toast.error("Please select at least one document");
      return;
    }
    kycMutation.mutate({
      files: kycFiles.map((k) => k.file),
      types: kycFiles.map((k) => k.type),
    });
  };

  const kycBadge = () => {
    switch (user?.kycStatus) {
      case "verified":
        return (
          <Badge variant="success">
            <CheckCircle className="h-3 w-3 mr-1" /> KYC Verified
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="warning">
            <Clock className="h-3 w-3 mr-1" /> KYC Pending Review
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="danger">
            <XCircle className="h-3 w-3 mr-1" /> KYC Rejected
          </Badge>
        );
      default:
        return (
          <Badge variant="primary">
            <FileText className="h-3 w-3 mr-1" /> KYC Not Started
          </Badge>
        );
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Profile
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage your personal information and KYC verification
        </p>
      </div>

      {/* Profile Card */}
      <Card>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            <div className="relative">
              {profilePic?.preview || user?.profilePicture?.url ? (
                <img
                  src={profilePic?.preview || user.profilePicture.url}
                  alt={user?.firstName}
                  className="h-24 w-24 rounded-full object-cover ring-4 ring-white dark:ring-slate-800 shadow-lg"
                />
              ) : (
                <div className="h-24 w-24 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                  {getInitials(user?.firstName, user?.lastName)}
                </div>
              )}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-primary-600 text-white flex items-center justify-center hover:bg-primary-700 shadow-lg"
              >
                <Camera className="h-4 w-4" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            <div className="flex-1 text-center sm:text-left">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {user?.firstName} {user?.lastName}
              </h2>
              <p className="text-sm text-slate-500">{user?.email}</p>
              <div className="mt-3 flex flex-wrap gap-2 justify-center sm:justify-start">
                <Badge variant="primary" className="capitalize">
                  {user?.role}
                </Badge>
                {kycBadge()}
                {user?.isVerified && <Badge variant="success">Verified</Badge>}
              </div>
            </div>

            {profilePic?.file && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setProfilePic(null)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  isLoading={uploadMutation.isPending}
                  onClick={handleUpload}
                >
                  Upload
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* KYC Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" /> KYC Verification
          </CardTitle>
          <p className="text-sm text-slate-500 mt-1">
            Upload documents to verify your identity. Accepted: JPG, PNG, or PDF
            (max 10MB each).
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status display */}
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
            <p className="text-xs text-slate-500 mb-1">Current KYC status</p>
            <div>{kycBadge()}</div>
            {user?.kycStatus === "pending" && (
              <p className="text-xs text-slate-500 mt-2">
                Your documents are being reviewed by our team. This usually
                takes a few hours.
              </p>
            )}
            {user?.kycStatus === "verified" && (
              <p className="text-xs text-slate-500 mt-2">
                You have full access to all banking features.
              </p>
            )}
            {user?.kycStatus === "rejected" && (
              <p className="text-xs text-danger-500 mt-2">
                Please re-upload clear documents.
              </p>
            )}
          </div>

          {/* Existing uploaded documents */}
          {user?.documents && user.documents.length > 0 && (
            <div className="rounded-lg bg-slate-50 dark:bg-slate-900/50 p-3">
              <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
                Uploaded documents ({user.documents.length})
              </p>
              <ul className="space-y-1.5">
                {user.documents.map((doc, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                      <FileText className="h-3 w-3" />
                      {doc.originalName || `Document ${i + 1}`}
                      <span className="text-slate-400">({doc.type})</span>
                    </span>
                    {doc.verified ? (
                      <CheckCircle className="h-3.5 w-3.5 text-success-500" />
                    ) : (
                      <Clock className="h-3.5 w-3.5 text-warning-500" />
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Upload form (hidden once verified) */}
          {user?.kycStatus !== "verified" && (
            <>
              <div>
                <label className="label">Select documents</label>
                <input
                  ref={kycInputRef}
                  type="file"
                  multiple
                  accept="image/*,.pdf"
                  onChange={handleKYCFileAdd}
                  className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 dark:file:bg-primary-900/20 dark:file:text-primary-400 cursor-pointer"
                />
              </div>

              {/* File list */}
              {kycFiles.length > 0 && (
                <div className="space-y-2">
                  {kycFiles.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 rounded-lg border border-slate-200 dark:border-slate-700 p-2"
                    >
                      {item.preview ? (
                        <img
                          src={item.preview}
                          alt=""
                          className="h-10 w-10 rounded object-cover"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                          <FileText className="h-5 w-5 text-slate-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">
                          {item.file.name}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {Math.round(item.file.size / 1024)} KB
                        </p>
                      </div>
                      <select
                        value={item.type}
                        onChange={(e) => updateKYCFileType(i, e.target.value)}
                        className="text-xs rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1"
                      >
                        {DOCUMENT_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => removeKYCFile(i)}
                        className="text-danger-500 hover:bg-danger-50 p-1 rounded"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <Button
                onClick={handleKYCSubmit}
                isLoading={kycMutation.isPending}
                disabled={kycFiles.length === 0}
                leftIcon={Upload}
                className="w-full sm:w-auto"
              >
                Submit for verification ({kycFiles.length})
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Personal Information */}
      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleSubmit((data) => updateMutation.mutate(data))}
            className="space-y-5"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Input
                label="First Name"
                icon={User}
                error={errors.firstName}
                {...register("firstName")}
              />
              <Input
                label="Last Name"
                icon={User}
                error={errors.lastName}
                {...register("lastName")}
              />
            </div>

            <Input
              label="Email"
              icon={Mail}
              value={user?.email}
              disabled
              className="opacity-60"
            />

            <Input
              label="Phone"
              icon={Phone}
              error={errors.phone}
              {...register("phone")}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Input
                label="Occupation"
                placeholder="e.g. Software Engineer"
                error={errors.occupation}
                {...register("occupation")}
              />
              <Input
                label="Annual Income"
                type="number"
                placeholder="50000"
                error={errors.annualIncome}
                {...register("annualIncome", { valueAsNumber: true })}
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="submit"
                leftIcon={Save}
                disabled={!isDirty}
                isLoading={updateMutation.isPending}
              >
                Save Changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
